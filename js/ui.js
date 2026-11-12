// Detalles de interfaz: hojas inferiores (animación de entrada y cierre, arrastrar para cerrar) e interruptores animados.
// Todo cuelga del contenedor #root; no hay que tocar cada hoja por separado.

export const MS_CIERRE = 350; // lo que dura la animación de cierre (el CSS usa .4 s; se actúa un poco antes)

const reducido = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const claveSw = (s) => s.dataset.act + '|' + (s.dataset.v || '');
const etiqueta = (h) => h.getAttribute('aria-label') || '';

// Antes de que render() cambie el DOM: qué hojas e interruptores había.
export function antes(root) {
  return {
    hojas: new Set([...root.querySelectorAll('.sheet')].map(etiqueta)),
    sw: new Map([...root.querySelectorAll('.switch[data-act]')].map((s) => [claveSw(s), s.getAttribute('aria-checked')])),
  };
}

// Después: solo las hojas NUEVAS hacen la animación de entrada (así un render() con la hoja ya abierta no la hace saltar),
// y los interruptores que han cambiado arrancan en su estado anterior para que el círculo se deslice.
export function despues(root, a) {
  root.querySelectorAll('.sheet').forEach((h) => { if (!a.hojas.has(etiqueta(h))) h.classList.add('sheet-in'); });
  if (reducido()) return;
  root.querySelectorAll('.switch[data-act]').forEach((s) => {
    const viejo = a.sw.get(claveSw(s)), nuevo = s.getAttribute('aria-checked');
    if (viejo == null || viejo === nuevo) return;
    s.setAttribute('aria-checked', viejo);
    void s.offsetWidth; // fija el estado de partida antes de cambiarlo
    requestAnimationFrame(() => s.setAttribute('aria-checked', nuevo));
  });
}

const hojaSuperior = (root) => { const hs = root.querySelectorAll('.sheet:not(.sheet-closing)'); return hs.length ? hs[hs.length - 1] : null; };
const fondoDe = (hoja) => { const f = hoja.previousElementSibling; return f && f.classList.contains('sheet-back') ? f : null; };

export function iniciarHojas(root) {
  let cerrando = false, pase = false, arrastre = null;

  // Cierra la hoja: primero baja con animación (.sheet-closing) y, pasado el tiempo, se lanza la acción de cierre de siempre
  // (la misma que lleva su fondo en data-act: st.pf = null, render()…).
  function cerrar(hoja, fondo) {
    if (cerrando) return;
    const act = fondo.dataset.act;
    const lanzar = () => {
      const el = fondo.isConnected ? fondo : root.querySelector('.sheet-back[data-act="' + act + '"]');
      if (!el) return;
      pase = true;
      try { el.click(); } finally { pase = false; }
      // Si la acción no cerró nada (p. ej. está ocupada guardando), la hoja vuelve a su sitio en lugar de quedarse invisible.
      setTimeout(() => { if (hoja.isConnected) { hoja.classList.remove('sheet-closing'); fondo.classList.remove('sheet-closing'); } }, 150);
    };
    if (reducido()) return lanzar();
    cerrando = true;
    hoja.style.transition = ''; hoja.style.transform = '';
    hoja.classList.add('sheet-closing'); fondo.classList.add('sheet-closing');
    setTimeout(() => { cerrando = false; lanzar(); }, MS_CIERRE);
  }

  // Toda acción de cierre de la hoja de arriba (botón ‹, ✕, «Entendido», tocar el fondo…) pasa por la animación.
  root.addEventListener('click', (e) => {
    if (pase) return;
    if (cerrando) { e.stopPropagation(); e.preventDefault(); return; } // mientras baja, nada más responde
    const b = e.target.closest && e.target.closest('[data-act]');
    if (!b) return;
    const hoja = hojaSuperior(root), fondo = hoja && fondoDe(hoja);
    if (!fondo || b.dataset.act !== fondo.dataset.act) return;
    e.stopPropagation(); e.preventDefault();
    cerrar(hoja, fondo);
  }, true);

  // Arrastrar la rayita hacia abajo (estilo iOS): la hoja sigue al dedo y, pasados ~50 px, se cierra con la misma animación.
  root.addEventListener('touchstart', (e) => {
    arrastre = null;
    if (cerrando) return;
    const g = e.target.closest && e.target.closest('.sheet-grab');
    const hoja = g && g.closest('.sheet');
    if (!hoja || hoja.classList.contains('sheet-closing')) return;
    arrastre = { hoja, y0: e.touches[0].clientY, dy: 0 };
    hoja.style.transition = 'none';
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (!arrastre) return;
    arrastre.dy = Math.max(0, e.touches[0].clientY - arrastre.y0);
    arrastre.hoja.style.transform = 'translateY(' + arrastre.dy + 'px)';
  }, { passive: true });
  const soltar = (cancelado) => {
    if (!arrastre) return;
    const { hoja, dy } = arrastre; arrastre = null;
    hoja.style.transition = '';
    const fondo = fondoDe(hoja);
    if (!cancelado && dy > 50 && fondo) return cerrar(hoja, fondo);
    hoja.style.transform = ''; // no llegó a 50 px: vuelve a su sitio
  };
  root.addEventListener('touchend', () => soltar(false), { passive: true });
  root.addEventListener('touchcancel', () => soltar(true), { passive: true });
}
