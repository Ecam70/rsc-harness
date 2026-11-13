import { readFile } from 'node:fs/promises';
import { tablero } from './tablero.mjs';
import { createServer } from 'node:http';
import { leerProyectos } from './proyectos.mjs';

const [config, almacen, puerto = '4317'] = process.argv.slice(2);
if (!config || !almacen) throw new Error('Uso: node dashboard/servicio.mjs proyectos.json carpeta-de-lecturas [puerto]');

const servicio = createServer(async (req, res) => {
  function responder(codigo, dato) {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(dato));
  }
  if (req.headers.host !== '127.0.0.1:' + servicio.address().port) return responder(403, 'Dirección no admitida');
  if (req.method !== 'GET') return responder(405, 'Solo lectura');
  const ruta = req.url.split('?')[0];
  const detalle = ruta.match(/^\/proyectos\/([^/]+)\/tareas\/([^/]+)\/(evidencia|historial)$/);
  if (!detalle && !['/', '/tablero.css', '/actualizar.js', '/proyectos'].includes(ruta)) return responder(404, 'Ruta desconocida');
  try {
    if (ruta === '/tablero.css' || ruta === '/actualizar.js') {
      const css = await readFile(new URL('.' + ruta, import.meta.url));
      res.writeHead(200, { 'Content-Type':ruta.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
      return res.end(css);
    }
    const proyectos = await leerProyectos(config, almacen);
    if (ruta === '/') {
      const html = tablero(proyectos, new URL(req.url, 'http://127.0.0.1').searchParams);
      res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
      return res.end(html);
    }
    if (!detalle) return responder(200, proyectos.map(p => ({ ...p, tareas: p.tareas.map(({ evidencia, historial, ...t }) => ({
      ...t, consulta: '/proyectos/' + encodeURIComponent(p.proyecto) + '/tareas/' + encodeURIComponent(t.id) + '/evidencia',
      historial: '/proyectos/' + encodeURIComponent(p.proyecto) + '/tareas/' + encodeURIComponent(t.id) + '/historial'
    })) })));
    const proyecto = proyectos.find(p => p.proyecto === decodeURIComponent(detalle[1]));
    const tarea = proyecto?.tareas.find(t => t.id === decodeURIComponent(detalle[2]));
    if (!tarea) return responder(404, 'Ficha desconocida');
    responder(200, { proyecto: proyecto.proyecto, disponible: proyecto.disponible, fecha: proyecto.fecha,
      tarea: tarea.id, fuente: tarea.fuente, ...(detalle[3] === 'historial' ? { intentos: tarea.historial ?? [] } : { evidencia: tarea.evidencia ?? null }) });
  } catch (error) {
    responder(error instanceof URIError ? 400 : 500, 'No se pudo consultar la lectura');
  }
});
servicio.listen(Number(puerto), '127.0.0.1', () => console.log('http://127.0.0.1:' + servicio.address().port + '/proyectos'));
