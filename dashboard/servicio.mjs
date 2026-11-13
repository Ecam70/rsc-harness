import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { mostrar, guardar, reglasActuales } from './configuracion.mjs';
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

  const ruta = req.url.split('?')[0];
  const detalle = ruta.match(/^\/proyectos\/([^/]+)\/tareas\/([^/]+)\/(evidencia|historial)$/);
  if (!detalle && !['/', '/tablero.css', '/actualizar.js', '/configuracion', '/proyectos'].includes(ruta)) return responder(404, 'Ruta desconocida');
  try {
    if (ruta === '/configuracion') {
      const archivo = join(dirname(resolve(config)), 'reglas-modelos.json');
      const ids = JSON.parse(await readFile(config,'utf8')).map(p => p.id);
      if (req.method === 'POST') {
        if (req.headers.origin !== 'http://'+req.headers.host) return responder(403,'Origen no admitido');
        if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return responder(415,'Formulario no válido');
        const partes=[]; let longitud=0;
        for await (const parte of req) {
          longitud+=parte.length;
          if (longitud>4096) return responder(413,'Formulario demasiado grande');
          partes.push(parte);
        }
        const location=guardar(archivo,ids,new URLSearchParams(Buffer.concat(partes).toString()));
        res.writeHead(303,{Location:location}); return res.end();
      }
      if (req.method !== 'GET') return responder(405,'Método no admitido');
      const html=mostrar(archivo,ids,new URL(req.url,'http://127.0.0.1').searchParams);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
      return res.end(html);
    }
    if (req.method !== 'GET') return responder(405,'Solo lectura');
    if (ruta === '/tablero.css' || ruta === '/actualizar.js') {
      const css = await readFile(new URL('.' + ruta, import.meta.url));
      res.writeHead(200, { 'Content-Type':ruta.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
      return res.end(css);
    }
    const proyectos = await leerProyectos(config, almacen);
    if (ruta === '/') {
      const params = new URL(req.url, 'http://127.0.0.1').searchParams;
      const reglas = params.has('tarea') ? reglasActuales(join(dirname(resolve(config)), 'reglas-modelos.json')) : undefined;
      const html = tablero(proyectos, params, reglas);
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
    if (error.status===400) return responder(400,error.message);
    responder(error instanceof URIError ? 400 : 500, 'No se pudo consultar la lectura');
  }
});
servicio.listen(Number(puerto), '127.0.0.1', () => console.log('http://127.0.0.1:' + servicio.address().port + '/proyectos'));
