// Evita interrumpir la selección del filtro, el foco de teclado o la lectura del detalle.
async function actualizar() {
  const tablero = document.querySelector('.grid');
  if (!tablero || document.hidden || document.activeElement !== document.body) return;
  try {
    const respuesta = await fetch(location.href, { cache: 'no-store' });
    if (!respuesta.ok) return;
    const documento = new DOMParser().parseFromString(await respuesta.text(), 'text/html');
    if (document.activeElement !== document.body || !documento.querySelector('.grid')) return;
    const formulario = document.querySelector('form');
    const filtro = new URLSearchParams(location.search);
    if (formulario.proyecto.value !== (filtro.get('proyecto') || '') ||
        formulario.vista.value !== (filtro.get('vista') || 'Todas las tareas')) return;
    document.querySelector('main').replaceWith(documento.querySelector('main'));
  } catch { /* La lectura actual sigue disponible. */ }
}
setInterval(actualizar, 15000);
