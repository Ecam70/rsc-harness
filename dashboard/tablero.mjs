const columnas = ['Entrada', 'Preparación', 'Ejecución', 'Verificación', 'Salida'];
export const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const normal = s => String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const fecha = s => s ? new Date(s).toISOString().replace('T',' ').slice(0,19) + ' UTC' : 'Sin registrar';
const url = (p,t) => '/?' + new URLSearchParams({ proyecto:p, tarea:t });
const espera = e => /esper|bloque|pendiente|cola|waiting|blocked|queued/.test(normal(e));
const decision = e => espera(e) && /aprobacion|decision|usuario|approval/.test(normal(e));

export function situacion(t) {
  const ultimo = t.ultimoMovimiento ?? t.historial?.at(-1)?.movimientos.at(-1);
  const cierre = normal(t.estado);
  if (['done','entregada','completada'].includes(cierre) && t.evidencia)
    return {columna:'Salida', estado:'Entregada', paso:'Cierre', desde:null};
  if (['cancelled','canceled','cancelada'].includes(cierre))
    return {columna:'Salida', estado:'Cancelada', paso:'Cancelación', desde:null};
  const paso = ultimo?.paso || t.paso || '';
  const estado = ultimo?.estado || ({'in-progress':'En curso','queued':'En cola','blocked':'Bloqueada'}[t.estado] ?? t.estado);
  const n = normal(paso);
  const columna = /revis|verifi|valid|prueba/.test(n) ? 'Verificación' :
    /prepar|plan|spec|clarif|analiz/.test(n) ? 'Preparación' :
    /impl|ejec|correc|desarr/.test(n) ? 'Ejecución' :
    /entrada|recep|cola/.test(n) || /queued|pending/.test(cierre) ? 'Entrada' :
    !paso && cierre === 'in-progress' ? 'Ejecución' : 'Sin clasificar';
  return {columna, estado, paso:paso || 'Sin registrar', desde:t.desdePaso ?? null,
    esperaDesde:espera(estado) ? t.desdeEstado ?? null : null};
}

function duracion(s) {
  if (!s) return 'Sin registrar';
  const minutos = Math.max(0, Math.floor((Date.now()-Date.parse(s))/60000));
  return minutos < 60 ? minutos+' min' : Math.floor(minutos/60)+' h '+minutos%60+' min';
}

export function pagina(titulo,contenido) {
  return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(titulo)+' · AI Factory</title><link rel="stylesheet" href="/tablero.css"><script defer src="/actualizar.js"></script><header><a href="/">AI Factory</a><a class="ajustes" href="/configuracion">Agentes y modelos</a></header><main>'+contenido+'</main></html>';
}

export function tablero(proyectos, params) {
  const filtro=params.get('proyecto') || '', id=params.get('tarea');
  const proyectosVista=proyectos.filter(p=>!filtro || p.proyecto===filtro);
  const filas=proyectosVista.flatMap(p=>p.tareas.map(t=>({p,t,s:situacion(t)})));
  const avisos=proyectosVista.filter(p=>!p.disponible).map(p=>'<p role="status">Proyecto '+esc(p.proyecto)+' sin acceso. Última lectura: '+esc(fecha(p.fecha))+'</p>').join('');
  if (id !== null) {
    const f=filas.find(f=>f.t.id===id && f.p.proyecto===filtro);
    if (!f) return pagina('Ficha desconocida','<a href="/">Volver al tablero</a><h1>Ficha desconocida</h1>');
    const {p,t,s}=f;
    const api='/proyectos/'+encodeURIComponent(p.proyecto)+'/tareas/'+encodeURIComponent(id);
    const recibos = Object.entries(t.recibos || {});
    const referencia = ref => {
      const i = recibos.findIndex(([nombre]) => nombre === ref);
      return i < 0 ? esc(ref) : '<a href="#recibo-'+i+'">'+esc(ref)+'</a>';
    };
    const fuentes = recibos.map(([ref, datos],i)=>'<details id="recibo-'+i+'"><summary>'+esc(ref)+'</summary><pre>'+esc(JSON.stringify(datos,null,2))+'</pre></details>').join('');
    const intentos=(t.historial||[]).map(i=>'<article><h3>'+esc(i.paso)+' · Intento '+esc(i.intento)+'</h3><ol>'+i.movimientos.map(m=>'<li><strong>'+esc(m.estado)+'</strong> · '+fecha(m.fecha)+'<br><small>'+referencia(m.fuente)+'</small></li>').join('')+'</ol></article>').join('');
    let evidencia = esc(t.evidencia || 'Sin registrar').replace(/\[([^\]\n]+)\]\((https:\/\/github\.com\/[^)\s]+)\)/g,'<a href="$2">$1</a>');
    evidencia=evidencia.replace(/\[([^\]\n]+)\]\((evidencias\/[\w/-]+\.json)\)/g,(original,label,ref)=>{
      const i=recibos.findIndex(([nombre])=>nombre===ref);
      return i<0 ? original : '<a href="#recibo-'+i+'">'+label+'</a>';
    });
    const contexto = [t.motivo && 'Motivo: '+t.motivo, t.responsable && 'Responsable: '+t.responsable].filter(Boolean).map(x=>'<p>'+esc(x)+'</p>').join('');
    return pagina(t.titulo, '<nav><a href="/?'+new URLSearchParams({proyecto:filtro})+'">← Tablero del proyecto '+esc(filtro)+'</a></nav>'+avisos+'<small>'+esc(p.proyecto)+' / '+esc(id)+'</small><h1>'+esc(t.titulo)+'</h1><section class="panel"><b>'+esc(s.columna)+' · '+esc(s.estado)+'</b>'+contexto+'<p>Paso: '+esc(s.paso)+' · Tiempo en el paso: '+duracion(s.desde)+'</p><small>Ficha: '+esc(t.fuente)+'</small></section><h2>Recorrido</h2>'+(intentos || '<p>Sin movimientos registrados.</p>')+'<section class="panel" id="evidencia"><h2>Evidencia</h2><div class="texto">'+evidencia+'</div>'+fuentes+'<p><a href="'+esc(api)+'/evidencia">Consultar registro de evidencia</a></p></section>');
  }
  const decisionSolo=params.get('vista')==='decisiones';
  const visibles=filas.filter(f=>!decisionSolo || decision(f.s.estado));
  const cola=visibles.filter(f=>f.s.esperaDesde).sort((a,b)=>Date.parse(a.s.esperaDesde)-Date.parse(b.s.esperaDesde));
  const enlace=f=>esc(url(f.p.proyecto,f.t.id));
  const tarjetas=grupo=>grupo.map(f=>'<a class="card" href="'+enlace(f)+'"><small>'+esc(f.p.proyecto)+' / '+esc(f.t.id)+'</small><strong>'+esc(f.t.titulo)+'</strong><span>'+esc(f.s.estado)+'</span><small>Paso: '+esc(f.s.paso)+'<br>Tiempo: '+duracion(f.s.desde)+'</small></a>').join('');
  const grupos=[...columnas,...(visibles.some(f=>f.s.columna==='Sin clasificar')?['Sin clasificar']:[])];
  const columnasHtml=grupos.map(c=>{
    const g=visibles.filter(f=>f.s.columna===c);
    const enEspera=g.filter(f=>espera(f.s.estado)).length;
    const resumen=c==='Salida' ? g.filter(f=>f.s.estado==='Entregada').length+' entregadas · '+g.filter(f=>f.s.estado==='Cancelada').length+' canceladas' :
      enEspera+' en espera · '+g.filter(f=>/en curso|in.progress|running/i.test(f.s.estado)).length+' en marcha';
    return '<section class="col"><h2>'+c+' <i>'+g.length+'</i></h2><small>'+resumen+'</small>'+(tarjetas(g)||'<p class="empty">Sin tareas</p>')+'</section>';
  }).join('');
  return pagina('Tablero','<h1>Tablero de la fábrica</h1>'+avisos+'<form><label>Proyecto <select name="proyecto"><option value="">Todos los proyectos</option>'+proyectos.map(p=>'<option '+(filtro===p.proyecto?'selected ':'')+'value="'+esc(p.proyecto)+'">'+esc(p.proyecto)+'</option>').join('')+'</select></label><label>Mostrar <select name="vista"><option>Todas las tareas</option><option value="decisiones" '+(decisionSolo?'selected':'')+'>Requieren mi decisión</option></select></label><button>Aplicar</button></form><p>'+visibles.length+' tareas · '+(cola[0]?'<a href="'+enlace(cola[0])+'">Abrir la espera más antigua ('+duracion(cola[0].s.esperaDesde)+')</a>':'Sin esperas con fecha registrada')+'</p><div class="grid">'+columnasHtml+'</div>');
}
