// Los recibos pueden estar citados en una ficha de verificación de otro proyecto.
export function intentosDeTarea(proyectos, proyecto, tarea) {
  const intentos = new Map();
  for (const p of proyectos) for (const ficha of p.tareas) {
    for (const [indice, [ruta, datos]] of Object.entries(ficha.recibos ?? {}).entries()) {
      for (const r of datos.primero && datos.siguiente ? [datos.primero, datos.siguiente] : [datos]) {
        const local = p.proyecto === proyecto && ficha.id === tarea.id;
        const asociado = local && tarea.historial?.find(i =>
          i.intento === r.intento && i.movimientos.some(m => m.fuente === ruta));
        if (r.tarea !== tarea.id || (r.proyecto ? r.proyecto !== proyecto : !asociado)) continue;
        if (r.intento == null) continue;
        const paso = r.paso ?? asociado?.paso;
        if (!paso) continue;
        const clave = JSON.stringify([paso,r.intento]);
        intentos.set(clave, {
          paso, intento:r.intento, inicio:r.inicio,
          agentePrevisto:r.agente, modeloPrevisto:r.solicitado ?? r.modelo_solicitado,
          agenteUsado:r.ejecutor ?? r.agente, modeloUsado:r.confirmado ?? r.modelo_confirmado,
          fuente:p.proyecto+' / '+ficha.id, enlace:'/?'+new URLSearchParams({proyecto:p.proyecto,tarea:ficha.id})+'#recibo-'+indice
        });
      }
    }
  }
  for (const i of tarea.historial ?? []) {
    const clave=JSON.stringify([i.paso,i.intento]);
    if (!intentos.has(clave)) intentos.set(clave,{paso:i.paso,intento:i.intento,inicio:i.movimientos[0]?.fecha});
  }
  return [...intentos.values()].sort((a,b)=>(a.inicio ?? '').localeCompare(b.inicio ?? ''));
}
