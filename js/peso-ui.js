// Editor del peso objetivo (2026-11-15): hoja inferior reutilizable con regla deslizable + termómetro de colores.
// Se abre con abrirEditorPesoObjetivo() desde Peso (lápiz junto al objetivo) y desde Perfil › Detalles personales.
// El termómetro y sus umbrales (<10 % verde · 10–15 % naranja · >15 % rojo) son los del cuestionario: viven en onboarding.js.
// Estado propio (`ed`): app.js solo pinta la hoja con pesoObjSheetHTML() y le pasa clics (data-act="pobj-…") y el evento input del slider.
import { esc, num, nf, I } from './util.js';
import { termometroHTML } from './onboarding.js';

const PASO = 0.1;
let ctx = { render() {}, toast() {} };
let ed = null; // { actual, valor, lo, hi, tenia, cb, validar, busy }

export const iniciarPesoUI = (c) => { ctx = { ...ctx, ...c }; };
export const editorAbierto = () => !!ed;
export const reiniciarPesoUI = () => { ed = null; };

const r1 = (v) => Math.round(v * 10) / 10;

// Rango de la regla: de un 40 % menos a un 40 % más que el peso actual (entre 30 y 250 kg), ampliado si el objetivo guardado se sale.
export function rangoRegla(actual, valor) {
  let lo = Math.max(30, Math.floor(actual * 0.6)), hi = Math.min(250, Math.ceil(actual * 1.4));
  if (valor < lo) lo = Math.floor(valor);
  if (valor > hi) hi = Math.ceil(valor);
  return { lo, hi };
}

// Regla: número grande con − / +, slider con marcas cada kilo y señal «Hoy» en el peso actual. Pura: no usa estado.
export function reglaPesoHTML(actual, valor, lo, hi) {
  const span = hi - lo, fr = (x) => Math.max(0, Math.min(1, (x - lo) / span));
  return `<div class="pobj-val">
      <button type="button" class="pobj-step" data-act="pobj-step" data-v="-1" aria-label="Quitar 100 gramos">−</button>
      <div class="pobj-num"><b class="num" id="pobj-v">${nf(valor, 1)}</b><span>kg</span></div>
      <button type="button" class="pobj-step" data-act="pobj-step" data-v="1" aria-label="Añadir 100 gramos">+</button>
    </div>
    <div class="pobj-ruler" style="--n:${span};--af:${fr(actual).toFixed(4)}">
      <i class="pobj-hoy" aria-hidden="true"><em>Hoy</em></i>
      <input type="range" class="ritmo-rng pobj-rng" data-pobj min="${lo}" max="${hi}" step="${PASO}" value="${valor}" style="--p:${(fr(valor) * 100).toFixed(2)}%" aria-label="Peso objetivo en kilos" aria-valuetext="${nf(valor, 1)} kilos">
    </div>
    <div class="ritmo-ticks" aria-hidden="true"><span>${lo} kg</span><span>${hi} kg</span></div>`;
}

const errDe = () => (ed && ed.validar ? ed.validar(ed.valor) || '' : '');

// Hoja `.sheet.short`. Va DESPUÉS de la hoja que haya debajo (Perfil) en viewMain: ui.js trata como superior la última.
export function pesoObjSheetHTML() {
  if (!ed) return '';
  const err = errDe();
  return `<div class="sheet-back" data-act="pobj-close"></div>
    <div class="sheet short pobj-sheet" role="dialog" aria-modal="true" aria-label="Peso objetivo">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="pobj-close" aria-label="Cerrar">${I.back}</button><h2>Peso objetivo</h2><span style="width:36px"></span></div>
      <div class="sheet-list pobj-body">
        <p class="small muted pobj-sub">Hoy pesas <b>${nf(ed.actual, 1)} kg</b>. Desliza la regla hasta tu meta.</p>
        ${reglaPesoHTML(ed.actual, ed.valor, ed.lo, ed.hi)}
        <div class="term" id="pobj-term" aria-live="polite">${termometroHTML(ed.actual, ed.valor)}</div>
        <p class="pobj-err" id="pobj-err" role="alert" ${err ? '' : 'hidden'}>${esc(err)}</p>
      </div>
      <div class="pobj-actions">
        <button type="button" class="btn block" id="pobj-save" data-act="pobj-save" ${err || ed.busy ? 'disabled' : ''}>${ed.busy ? '<span class="spinner"></span>' : ed.tenia ? 'Actualizar' : 'Guardar'}</button>
        ${ed.tenia ? '<button type="button" class="link" data-act="pobj-quitar">Quitar objetivo</button>' : ''}
      </div>
    </div>`;
}

// Un render() vuelve a pintar las hojas de abajo desde arriba: se conserva su posición de desplazamiento.
function renderConScroll() {
  const tops = [...document.querySelectorAll('.sheet-list:not(.pobj-body)')].map((e) => e.scrollTop);
  ctx.render();
  document.querySelectorAll('.sheet-list:not(.pobj-body)').forEach((e, i) => { if (tops[i]) e.scrollTop = tops[i]; });
}

// pesoActual: kg de hoy (referencia del termómetro). pesoObjetivoActual: número, texto («68,5») o vacío.
// callbackGuardar(valor|null): se llama con el kg elegido (null = quitar objetivo). Puede ser async; si devuelve un texto, es un error: se avisa y la hoja sigue abierta.
// opciones.validar(valor) → texto de error o '' (se enseña en vivo bajo el termómetro y desactiva «Guardar»).
export function abrirEditorPesoObjetivo(pesoActual, pesoObjetivoActual, callbackGuardar, opciones = {}) {
  const actual = num(pesoActual), obj = num(pesoObjetivoActual);
  if (!(actual >= 30 && actual <= 300)) { ctx.toast('Apunta primero tu peso actual'); return false; }
  const tenia = obj > 0, valor = r1(Math.max(30, Math.min(300, tenia ? obj : actual))), { lo, hi } = rangoRegla(actual, valor);
  ed = { actual, valor, lo, hi, tenia, cb: callbackGuardar, validar: opciones.validar || null, busy: false };
  renderConScroll();
  return true;
}

// Repinta número, barra, termómetro, aviso y botón sin render() (si no, se pierde el dedo al deslizar).
function pintar() {
  const rng = document.querySelector('.pobj-rng');
  if (rng) {
    if (num(rng.value) !== ed.valor) rng.value = String(ed.valor);
    rng.style.setProperty('--p', (((ed.valor - ed.lo) / (ed.hi - ed.lo)) * 100).toFixed(2) + '%');
    rng.setAttribute('aria-valuetext', `${nf(ed.valor, 1)} kilos`);
  }
  const v = document.getElementById('pobj-v'); if (v) v.textContent = nf(ed.valor, 1);
  const t = document.getElementById('pobj-term'); if (t) t.innerHTML = termometroHTML(ed.actual, ed.valor);
  const err = errDe(), e = document.getElementById('pobj-err'); if (e) { e.textContent = err; e.hidden = !err; }
  refrescarBoton();
}
function refrescarBoton() {
  const b = document.getElementById('pobj-save'); if (!b || !ed) return;
  b.disabled = !!errDe() || ed.busy;
  b.innerHTML = ed.busy ? '<span class="spinner"></span>' : ed.tenia ? 'Actualizar' : 'Guardar';
}

// Evento input del slider (data-pobj). Devuelve true si era suyo.
export function alMoverRegla(el) {
  if (!ed || !el.matches || !el.matches('[data-pobj]')) return false;
  const n = num(el.value);
  if (isFinite(n)) { ed.valor = r1(Math.max(ed.lo, Math.min(ed.hi, n))); pintar(); }
  return true;
}
// Botones − / + (100 g).
export function pasoRegla(dir) {
  if (!ed) return;
  ed.valor = r1(Math.max(ed.lo, Math.min(ed.hi, ed.valor + Math.sign(dir) * PASO)));
  pintar();
}

export function cerrarEditorPesoObjetivo() { if (!ed) return; ed = null; renderConScroll(); }

export async function guardarEditorPesoObjetivo(quitar = false) {
  if (!ed || ed.busy) return;
  const v = quitar ? null : ed.valor, err = quitar ? '' : errDe();
  if (err) return ctx.toast(err);
  ed.busy = true; refrescarBoton();
  let res = '';
  try { res = await ed.cb(v); } catch (e) { res = (e && e.message) || 'No se pudo guardar'; }
  if (!ed) return;
  if (typeof res === 'string' && res) { ed.busy = false; refrescarBoton(); return ctx.toast(res); }
  // Cierra con la animación de siempre: el clic en el fondo pasa por ui.js y termina en 'pobj-close'.
  const fondo = document.querySelector('.sheet-back[data-act="pobj-close"]');
  if (fondo) fondo.click(); else cerrarEditorPesoObjetivo();
}
