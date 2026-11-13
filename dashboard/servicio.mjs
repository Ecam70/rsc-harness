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
  const detalle = ruta.match(/^\/proyectos\/([^/]+)\/tareas\/([^/]+)\/evidencia$/);
  if (!detalle && ruta !== '/proyectos') return responder(404, 'Ruta desconocida');
  try {
    const proyectos = await leerProyectos(config, almacen);
    if (!detalle) return responder(200, proyectos.map(p => ({ ...p, tareas: p.tareas.map(({ evidencia, ...t }) => ({
      ...t, consulta: '/proyectos/' + encodeURIComponent(p.proyecto) + '/tareas/' + encodeURIComponent(t.id) + '/evidencia'
    })) })));
    const proyecto = proyectos.find(p => p.proyecto === decodeURIComponent(detalle[1]));
    const tarea = proyecto?.tareas.find(t => t.id === decodeURIComponent(detalle[2]));
    if (!tarea) return responder(404, 'Ficha desconocida');
    responder(200, { proyecto: proyecto.proyecto, disponible: proyecto.disponible, fecha: proyecto.fecha,
      tarea: tarea.id, fuente: tarea.fuente, evidencia: tarea.evidencia ?? null });
  } catch (error) {
    responder(error instanceof URIError ? 400 : 500, 'No se pudo consultar la lectura');
  }
});
servicio.listen(Number(puerto), '127.0.0.1', () => console.log('http://127.0.0.1:' + servicio.address().port + '/proyectos'));
