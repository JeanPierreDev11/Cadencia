// Banner inteligente de instalación (PWA). Solo se muestra en móvil (iOS/Android) y en el navegador,
// nunca dentro de la app ya instalada. Vive fuera de #root para que render() no lo borre.
import { lsGet, lsSet } from './util.js';

const KEY = 'cadencia-ib-hide';   // marca de «ahora no»
const DIAS = 7;                   // días que se oculta tras cerrarlo
const RETRASO = 2500;             // ms antes de aparecer

const ua = navigator.userAgent || '';
const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPad que se hace pasar por Mac
const esIOS = /iphone|ipad|ipod/i.test(ua) || touchMac;
const esAndroid = /android/i.test(ua);
const esIPad = /ipad/i.test(ua) || touchMac;
const esChromeIOS = /CriOS|FxiOS|EdgiOS/i.test(ua);
// Navegadores internos de Instagram, TikTok, Facebook…: ahí NO se puede instalar, hay que abrirlo en el navegador.
const esSocial = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter/i.test(ua);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

let evt = null;      // evento nativo de Android/Chrome
let banner = null, hoja = null;

const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICO = {
  share: svg('<path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/>'),
  addHome: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>'),
  dotsH: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  dotsV: svg('<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>'),
  open: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  arrow: svg('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};

// Qué guía mostrar y hacia dónde apunta la flecha.
function guia() {
  if (esSocial) {
    return esIOS
      ? { titulo: 'Ábrelo en Safari', arriba: false, pasos: [
          ['Toca <b>⋯</b> o el icono de la brújula', ICO.dotsH],
          ['Elige <b>«Abrir en Safari»</b>', ICO.open],
          ['Vuelve a pulsar <b>Instalar</b>', ICO.addHome]] }
      : { titulo: 'Ábrelo en Chrome', arriba: true, pasos: [
          ['Toca <b>⋮</b> arriba a la derecha', ICO.dotsV],
          ['Elige <b>«Abrir en Chrome»</b> o «Abrir en el navegador»', ICO.open],
          ['Vuelve a pulsar <b>Instalar</b>', ICO.addHome]] };
  }
  if (esIOS) {
    const arriba = esIPad || esChromeIOS; // en iPad y Chrome el botón de compartir está arriba
    return { titulo: 'Instala Cadencia', arriba, pasos: [
      [`Toca el icono de <b>Compartir</b> ${arriba ? 'arriba' : 'abajo'}`, ICO.share],
      ['Elige <b>«Añadir a pantalla de inicio»</b>', ICO.addHome],
      ['Pulsa <b>Añadir</b> y listo', ICO.addHome]] };
  }
  return { titulo: 'Instala Cadencia', arriba: true, pasos: [
    ['Toca <b>⋮</b> arriba a la derecha', ICO.dotsV],
    ['Elige <b>«Instalar aplicación»</b> o «Añadir a pantalla de inicio»', ICO.addHome]] };
}

function cerrarHoja() {
  if (!hoja) return;
  hoja.classList.remove('on');
  const h = hoja; hoja = null;
  document.removeEventListener('keydown', onKey);
  setTimeout(() => h.remove(), 220);
}
const onKey = (e) => { if (e.key === 'Escape') cerrarHoja(); };

function abrirHoja() {
  if (hoja) return;
  const g = guia();
  hoja = document.createElement('div');
  hoja.className = 'ib-back';
  hoja.innerHTML = `
    ${g.arriba ? `<div class="ib-arrow ib-arrow-top" aria-hidden="true">${ICO.arrow}</div>` : ''}
    <div class="ib-sheet" role="dialog" aria-modal="true" aria-label="${g.titulo}">
      <div class="ib-grip" aria-hidden="true"></div>
      <h2 class="ib-h">${g.titulo}</h2>
      <ol class="ib-steps">
        ${g.pasos.map((p, i) => `<li><span class="ib-n">${i + 1}</span><span class="ib-t">${p[0]}</span><span class="ib-i" style="animation-delay:${i * 0.35}s">${p[1]}</span></li>`).join('')}
      </ol>
      ${g.arriba ? '' : `<div class="ib-arrow ib-arrow-bot" aria-hidden="true">${ICO.arrow}</div>`}
      <button type="button" class="ib-ok" data-ib="cerrar">Entendido</button>
    </div>`;
  hoja.addEventListener('click', (e) => { if (e.target === hoja || e.target.closest('[data-ib="cerrar"]')) cerrarHoja(); });
  document.body.appendChild(hoja);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => hoja && hoja.classList.add('on'));
}

function ocultarBanner(recordar) {
  if (recordar) lsSet(KEY, String(Date.now()));
  if (!banner) return;
  banner.classList.remove('on');
  const b = banner; banner = null;
  setTimeout(() => b.remove(), 260);
}

async function instalar() {
  if (evt) {
    try {
      evt.prompt();
      const r = await evt.userChoice;
      evt = null;
      if (r.outcome === 'accepted') { ocultarBanner(false); return; }
      return; // lo rechazó en el diálogo nativo: no insistimos
    } catch (e) { evt = null; /* el aviso nativo falló: enseñamos la guía */ }
  }
  abrirHoja();
}

function mostrarBanner() {
  if (banner || instalada()) return;
  banner = document.createElement('div');
  banner.className = 'ib';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Instalar Cadencia');
  banner.innerHTML = `
    <img class="ib-logo" src="icons/icon-192.png" alt="" width="40" height="40">
    <div class="ib-txt"><b>Instala Cadencia</b><span>Entrena sin interrupciones</span></div>
    <button type="button" class="ib-btn" data-ib="instalar">Instalar</button>
    <button type="button" class="ib-x" data-ib="cerrar-banner" aria-label="Ahora no">${ICO.close}</button>`;
  banner.addEventListener('click', (e) => {
    if (e.target.closest('[data-ib="instalar"]')) instalar();
    else if (e.target.closest('[data-ib="cerrar-banner"]')) ocultarBanner(true);
  });
  document.body.appendChild(banner);
  requestAnimationFrame(() => requestAnimationFrame(() => banner && banner.classList.add('on')));
}

export function iniciarInstalar() {
  if (instalada() || !(esIOS || esAndroid)) return;           // ya instalada o es un ordenador
  const t = Number(lsGet(KEY));
  if (t && Date.now() - t < DIAS * 864e5) return;             // lo cerró hace poco
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); evt = e; });
  window.addEventListener('appinstalled', () => { evt = null; cerrarHoja(); ocultarBanner(false); });
  setTimeout(mostrarBanner, RETRASO);
}
