// Cuerpo 3D de Recuperación muscular y «Esta semana»: colores, imágenes fijas (frente y espalda) y hoja con el visor giratorio.
// Aquí solo hay lo ligero; three.js y los modelos (js/vendor/cuerpo3d.js, public/models/) se descargan al abrir esa pantalla.
import { esc, I, fmtDate } from './util.js';
import * as E from './entreno.js';

const VERDE = '#3DDC84', AMBAR = '#FFB020', ROJO = '#FF453A', AMARILLO = '#F2BE1A';
export const MUSCULOS = ['ne', 'sh', 'ch', 'bi', 'fo', 'ab', 'abd', 'qu', 'ad', 'ca', 'tp', 'mb', 'la', 'lb', 'tr', 'gl', 'ha'];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mezcla = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
// Fatiga 0 (listo) → 100 (muy fatigado): verde → ámbar → rojo, continuo.
export const colFatiga = (f) => { f = Math.max(0, Math.min(100, f)); return f < 50 ? mezcla(VERDE, AMBAR, f / 50) : mezcla(AMBAR, ROJO, (f - 50) / 50); };
export const estadoFatiga = (f) => (f < 34 ? 'Listo' : f < 67 ? 'Descansando' : 'Fatigado');

// Datos del cuerpo: sin Pro no se calcula nada real (todo fresco y sin semana) para que el desenfoque no deje deducir la fatiga.
export const datos = (ws, pro, hoy) => (pro ? E.analisisMusculos(ws, new Date(), hoy) : { rec: {}, sem: {}, info: {} });
// Colores por músculo: { clave: [color, opacidad] }
export function colores(modo, d) {
  const o = {};
  if (modo === 'rec') MUSCULOS.forEach((k) => { o[k] = [colFatiga(100 - (d.rec[k] ?? 100)), 0.95]; });
  else Object.entries(d.sem).forEach(([k, v]) => { o[k] = [AMARILLO, +(0.25 + 0.75 * v).toFixed(2)]; });
  return o;
}

/* ---------- imágenes fijas ---------- */
const cache = new Map(); // huella → URL de la imagen
const pendientes = new Set();
let modulo = null, fallo = 0;
const cargarModulo = () => modulo || (modulo = import('./vendor/cuerpo3d.js').catch((e) => { modulo = null; throw e; }));
const huella = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const img = (u) => `<img src="${u}" alt="" width="240" height="480" decoding="async" draggable="false">`;
async function pedir(k, sexo, cols, lado) {
  pendientes.add(k);
  try {
    const m = await cargarModulo(), url = await m.foto(sexo, cols, lado);
    if (!url) throw new Error('imagen');
    cache.set(k, url);
    if (cache.size > 24) { const v = cache.keys().next().value; URL.revokeObjectURL(cache.get(v)); cache.delete(v); }
    document.querySelectorAll(`[data-c3k="${k}"]`).forEach((e) => { e.innerHTML = img(url); e.classList.add('listo'); });
  } catch (e) { fallo = Date.now(); } // sin red o sin WebGL: se queda el dibujo plano
  pendientes.delete(k);
}
// Figura de frente o de espalda: el dibujo plano (`plano`) hasta que llega la imagen 3D.
export function fig(sexo, modo, lado, cols, plano, nombre) {
  const k = huella(sexo + modo + lado + JSON.stringify(cols)), u = cache.get(k);
  if (!u && !pendientes.has(k) && Date.now() - fallo > 30000) pedir(k, sexo, cols, lado);
  return `<span class="c3-fig${u ? ' listo' : ''}" data-c3k="${k}" role="img" aria-label="${esc(nombre)}">${u ? img(u) : plano}</span>`;
}

/* ---------- hoja con el visor ---------- */
let cur = null, vivo = null, creando = false;
const host = document.createElement('div'); host.className = 'c3-host';

const dias = (iso, hoy) => { const n = Math.round((new Date(`${hoy}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 864e5); return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `el ${fmtDate(iso)}`; };
const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
function infoHTML(k, modo, d, hoy) {
  if (!k) return '<p class="c3-hint">Toca un músculo para ver cómo está.</p>';
  const nom = E.MUSC_DET[k] || k, i = d.info[k];
  if (modo === 'rec') {
    const pct = Math.round(d.rec[k] ?? 100), f = 100 - pct, c = colFatiga(f);
    const det = i ? [i.horas > 1 && pct < 100 ? `Listo en ~${Math.round(i.horas)} h` : '', `${n1(i.series)} series efectivas esta semana`, i.rir != null ? `RIR medio ${n1(i.rir)}` : '', i.fecha ? `Último entreno ${dias(i.fecha, hoy)}` : ''].filter(Boolean).join(' · ') : 'Sin entrenar en los últimos días.';
    return `<p class="c3-nom"><b>${esc(nom)}</b><span><i style="background:${c}"></i>${estadoFatiga(f)} · ${pct} % recuperado</span></p><p class="c3-det">${esc(det)}</p>`;
  }
  const v = d.sem[k];
  return `<p class="c3-nom"><b>${esc(nom)}</b><span><i style="background:${AMARILLO};opacity:${v ? (0.25 + 0.75 * v).toFixed(2) : 0.2}"></i>${v ? `Intensidad ${Math.round(v * 100)} %` : 'Sin entrenar esta semana'}</span></p><p class="c3-det">${v && i ? esc(`${n1(i.series)} series efectivas en 7 días · Último entreno ${dias(i.fecha, hoy)}`) : 'Aquí no hay volumen en los últimos 7 días.'}</p>`;
}
// est = st.cuerpo3d = { modo: 'rec' | 'sem', sel }
export function sheetHTML(est, sexo, d, hoy) {
  cur = { est, sexo, d, hoy };
  const b = (m, t) => `<button type="button" data-act="c3-modo" data-v="${m}" aria-pressed="${est.modo === m}">${t}</button>`;
  const leyenda = est.modo === 'rec'
    ? `<i style="background:${VERDE}"></i>Listo <i style="background:${AMBAR}"></i>Descansando <i style="background:${ROJO}"></i>Fatigado`
    : `<i style="background:${AMARILLO};opacity:.35"></i>Poco <i style="background:${AMARILLO}"></i>Mucho volumen e intensidad`;
  return `<div class="sheet-back" data-act="c3-close"></div>
    <div class="sheet c3-sheet" role="dialog" aria-modal="true" aria-label="Tu cuerpo en 3D">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="c3-close" aria-label="Cerrar">${I.back}</button><h2>Tu cuerpo en 3D</h2><span style="width:36px"></span></div>
      <div class="c3-body">
        <div class="seg c3-seg">${b('rec', 'Recuperación')}${b('sem', 'Esta semana')}</div>
        <div id="c3-vivo" class="c3-vivo" aria-label="Cuerpo 3D: arrastra para girarlo"></div>
        <p class="c3-fallo" id="c3-fallo" hidden>No se pudo cargar el modelo 3D. Comprueba tu conexión e inténtalo de nuevo.</p>
        <div class="c3-lados"><button type="button" class="btn ghost" data-act="c3-lado" data-v="front">Frente</button><button type="button" class="btn ghost" data-act="c3-lado" data-v="back">Espalda</button></div>
        <div id="c3-info" class="c3-info" aria-live="polite">${infoHTML(est.sel, est.modo, d, hoy)}</div>
        <div class="rcv-leg c3-leg">${leyenda}</div>
      </div>
    </div>`;
}
// Se llama después de cada render(): crea el visor cuando aparece la hoja, lo conserva entre repintados y lo destruye al cerrarla.
export function enganchar(root) {
  const ph = root.querySelector('#c3-vivo');
  if (!ph || !cur) { if (vivo) { vivo.destruir(); vivo = null; } return; }
  if (host.parentNode !== ph) ph.appendChild(host);
  const cols = colores(cur.est.modo, cur.d);
  if (vivo) { vivo.actualizar(cols); return; }
  if (creando) return;
  creando = true;
  cargarModulo().then((m) => m.visor(host, cur.sexo, cols, {
    onElegir: (k) => { if (!cur) return; cur.est.sel = k; const e = document.getElementById('c3-info'); if (e) e.innerHTML = infoHTML(k, cur.est.modo, cur.d, cur.hoy); },
  })).then((v) => {
    creando = false;
    if (!root.querySelector('#c3-vivo')) return v.destruir(); // se cerró mientras cargaba
    vivo = v; v.actualizar(colores(cur.est.modo, cur.d));
  }).catch(() => { creando = false; fallo = Date.now(); const e = document.getElementById('c3-fallo'); if (e) e.hidden = false; });
}
export const girarA = (lado) => { if (vivo) vivo.girarA(lado); };
export const elegir = (k) => { if (vivo) vivo.elegir(k); };
