import './br.js'; // Fórmulas de Bilbao Ride (globalThis.BR): debe cargarse antes que secciones.js
import { createBackend, errorText, REF_MAX } from './data.js';
import { APP_NAME, CICLISMO } from './config.js';
import * as E from './entreno.js';
import { crearSecciones, NOV_V } from './secciones.js';
import { crearEntreno } from './entreno-ui.js';
import { LEGAL_V, legalDoc, legalTab, legalLinksHTML, legalCheckHTML, LEGAL_TABS, LEGAL_TITULOS, CONTACTO } from './legal.js';
import { PORTAL_LINK, planUrl, PAGOS_ACTIVOS, betaTagHTML, listaProHTML, ventajasBetaHTML } from './pro.js';
import * as CAL from './calorias.js';
import { leerRetorno } from './strava.js';
import { crearRecordatorios, leerIr } from './push.js';
import { crearStrava } from './strava-ui.js';
import { iniciarInstalar } from './instalar.js';
import * as UI from './ui.js';
import * as OB from './onboarding.js';
import * as C3 from './cuerpo.js';
import * as RG from './regional.js';

/* ================================================================== */
/* Utilidades                                                          */
/* ================================================================== */
const root = document.getElementById('root');
import { esc, num, nf, todayISO, fmtDate, lsGet, lsSet, toast, I } from './util.js';

/* ---------- objetivos ---------- */
const GOALS = [
  { id: 'perder', t: 'Perder grasa', s: 'Bajar peso sin perder fuerza', ico: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: 'musculo', t: 'Ganar músculo', s: 'Más fuerza en piernas y tronco', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'rendimiento', t: CICLISMO ? 'Rendir más en la bici' : 'Rendir más', s: CICLISMO ? 'Más potencia y fondo en las subidas' : 'Más fuerza, potencia y resistencia', ico: '<path d="M3 18l6-8 4 5 3-4 5 7"/>' },
  { id: 'prueba', t: 'Preparar un maratón', s: 'Llegar en forma a una fecha concreta', ico: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>' },
  { id: 'mantener', t: 'Mantener mi peso', s: 'Estable y con energía', ico: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>' },
  { id: 'salud', t: 'Ganar salud', s: 'Dormir mejor, menos estrés, más vitalidad', ico: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
];
const goalIcon = (g, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${g.ico}</svg>`;
const goalById = (id) => GOALS.find((g) => g.id === id);

/* ---------- cálculos ---------- */
const imc = (kg, cm) => (kg > 0 && cm > 0 ? kg / Math.pow(cm / 100, 2) : NaN);
const imcLabel = (v) => (!isFinite(v) ? '' : v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad');
// Mifflin-St Jeor: calorías que gasta el cuerpo en reposo.
const bmr = (p) => Math.round(CAL.tmb(p || {}));

/* ---------- instalación ---------- */
let installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (st.view === 'main') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('App instalada'); if (st.view === 'main') render(); });

/* ---------- tema ---------- */
// Tema: «dark» (por defecto), «light» o «system» (lee prefers-color-scheme del móvil).
const THEMES = ['dark', 'light', 'system'];
const themePref = () => { const t = lsGet('cadencia-theme'); return THEMES.includes(t) ? t : 'dark'; };
const applyTheme = () => {
  document.documentElement.dataset.theme = themePref();
  try { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000000'; } catch (e) { /* nada */ }
};
applyTheme();
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (themePref() === 'system') applyTheme(); }); } catch (e) { /* navegador antiguo */ }

/* ---------- enlace de invitación: https://cadencia-11cb6.web.app/?ref=CÓDIGO ---------- */
// Al abrir la app se lee `ref`, se guarda en localStorage (`cadencia-ref`, para que sobreviva al cuestionario) y se quita de la barra de direcciones.
// Solo se quita `ref`: el resto de parámetros (`ir` de los avisos, `code` de Strava…) los siguen leyendo `push.js` y `strava.js`, por eso esto va ANTES de ellos.
const REF_URL = 'https://cadencia-11cb6.web.app/';
const REF_TEXTO = 'Únete a Cadencia, la app de entrenamiento con IA. Usa mi enlace y llévate 1 semana PRO gratis.';
const REF_CLAVE = 'cadencia-ref';
let refMem = ''; // copia en memoria por si el navegador no deja usar localStorage
(function capturarRef() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('ref')) return;
    const c = (u.searchParams.get('ref') || '').trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(c)) { refMem = c; lsSet(REF_CLAVE, c); }
    u.searchParams.delete('ref');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch (e) { /* sin URL o sin historial: no pasa nada */ }
})();
const refGuardado = () => { const c = String(lsGet(REF_CLAVE) || refMem || '').trim().toUpperCase(); return /^[A-Z0-9]{6}$/.test(c) ? c : ''; };
const refLimpiar = () => { refMem = ''; lsSet(REF_CLAVE, null); };

/* ================================================================== */
/* Estado                                                              */
/* ================================================================== */
let api = null;
const st = {
  view: 'boot', user: null, profile: null, weights: [],
  authMode: 'welcome', authMsg: null, busy: false, registering: false, vieneDeRegistro: false, codigo: null, refBusy: false,
  ob: null, tab: lsGet('cadencia-tab') || 'inicio', editGoals: null,
  workouts: [], wkTab: lsGet('cadencia-wktab') || 'semana', wk: null, rw: null, re: null, live: null, liveMin: false, lib: null,
};

function render() {
  const antesUI = UI.antes(root);
  if (st.view === 'auth') root.innerHTML = viewAuth();
  else if (st.view === 'onboarding') { root.innerHTML = viewOnboarding() + (st.legal ? legalSheetHTML() : ''); obGuardarAnon(); }
  else if (st.view === 'paywall') root.innerHTML = viewPaywall();
  else if (st.view === 'main') root.innerHTML = viewMain();
  else if (st.view === 'error') root.innerHTML = viewError();
  UI.despues(root, antesUI);
  document.body.dataset.view = st.view;
  document.title = APP_NAME;
  if (M) M.afterRender();
  C3.enganchar(root);
  RG.pintarMapas(root);
  if (st.view === 'main' && st.compartir) pintarCompartir();
  document.body.classList.toggle('noscroll', !!(st.limite || st.liveFin || st.rutNuevos || st.compartir || st.calentar || st.moverSel || st.dia7 || st.pf || st.proInfo || st.codigo || st.rutShare || st.mealDet != null || st.rutDelAsk || st.wkHist || st.wkDel || st.novModal || st.exView || st.lib || st.food || st.tl || st.pesoSheet || st.pesoHist || st.pesoDel || st.cfg || st.pwd || st.meta || st.regPick || st.modoSel || st.resumen || st.cuerpo3d || st.legal || st.del || st.pro || st.proWelcome || st.recAsk));
}

/* ================================================================== */
/* Acceso: iniciar sesión / crear cuenta                               */
/* ================================================================== */
function heroProfile() {
  // Perfil de un puerto: la silueta que ve un ciclista en el libro de ruta.
  return `<svg class="profile-svg" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
    <path class="area" d="M0 120 L0 104 C30 102 48 96 70 92 C96 87 104 70 132 66 C160 62 168 80 192 74 C224 66 236 34 270 22 C296 13 306 30 326 40 C346 50 362 46 380 52 L400 56 L400 120 Z"/>
    <path class="road" d="M0 114 C60 112 120 108 200 104 C280 100 340 100 400 98"/>
  </svg>`;
}

const heroHTML = (tag = 'h1') => `<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor"><path d="M12 8H56V22H28V42H56V56H12Z" transform="translate(6.8 0) skewX(-12)"/></svg>
      <${tag} class="wordmark">${esc(APP_NAME)}</${tag}>${tag === 'h1' ? `<p class="tagline">${CICLISMO ? 'Tu peso, tus objetivos y tu bici, en un mismo sitio.' : 'Tu peso, tus objetivos y tus entrenos, en un mismo sitio.'}</p>` : ''}
      ${heroProfile()}`;

// Sin sesión: primero la bienvenida (el cuestionario empieza SIN cuenta); «Iniciar sesión» lleva al formulario de acceso.
function viewAuth() {
  if (st.authMode !== 'login') return OB.bienvenidaHTML(heroHTML('p'), (() => { const g = obAnonLeer(); return !!g && (g.step !== 'nombre' || !!(g.nombre || g.apellidos)); })()) + (st.legal ? legalSheetHTML() : '');
  const m = st.authMsg;
  return `<div class="screen">
    <div class="auth-hero">${heroHTML()}</div>
    <div class="auth-card">
      ${betaTagHTML('beta-l')}
      <h2 class="auth-h">Iniciar sesión</h2>
      <form data-form="login" class="form-grid" novalidate>
        <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="tu@email.com"></label>
        <label class="field"><span>Contraseña</span>
          <div class="pass-wrap"><input class="input" type="password" name="pass" autocomplete="current-password" required minlength="6"><button type="button" data-act="peek">Ver</button></div>
        </label>
        ${m ? `<div class="msg ${m.ok ? 'ok' : ''}" role="alert">${esc(m.text)}</div>` : ''}
        <button class="btn block" type="submit" ${st.busy ? 'disabled' : ''}>${st.busy ? '<span class="spinner"></span>' : 'Entrar'}</button>
        <button type="button" class="link" data-act="forgot">He olvidado mi contraseña</button>
      </form>
      <div class="auth-or"><span>o</span></div>
      <button type="button" class="btn block quiet" data-act="login-google" ${st.busy ? 'disabled' : ''}>Continuar con Google</button>
      <button type="button" class="btn block quiet" data-act="login-apple" ${st.busy ? 'disabled' : ''}>Continuar con Apple</button>
      <p class="small muted">¿Todavía no tienes cuenta? Vuelve atrás y pulsa «Empezar»: la creas al final del cuestionario. Si entras con Google o Apple por primera vez aquí, aceptas los ${legalCheckHTML()}.</p>
      <button type="button" class="link" data-act="auth-volver">${I.arrl} Volver</button>
      ${api.mode === 'local' ? `<p class="note"><span>●</span><span><b>Modo prueba.</b> Las cuentas y los datos se guardan solo en este dispositivo hasta que conectes Firebase.</span></p>` : ''}
    </div>
  </div>${st.legal ? legalSheetHTML() : ''}`;
}

/* ---------- términos, privacidad y borrar la cuenta ---------- */
function legalSheetHTML() {
  const cur = legalTab(st.legal);
  return `<div class="sheet-back" data-act="legal-close"></div>
    <div class="sheet legal-sheet" role="dialog" aria-modal="true" aria-label="Información legal">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><span style="width:44px"></span><h2>Información legal</h2><button type="button" class="iconbtn" data-act="legal-close" aria-label="Cerrar">${I.close}</button></div>
      <div class="seg mini legal-seg" role="tablist" aria-label="Documentos legales">${LEGAL_TABS.map((t) => `<button type="button" role="tab" id="legal-t-${t.id}" aria-selected="${t.id === cur}" aria-controls="legal-panel" tabindex="${t.id === cur ? 0 : -1}" data-act="legal-tab" data-v="${t.id}">${t.t}</button>`).join('')}</div>
      <div class="sheet-list legal" id="legal-panel" role="tabpanel" aria-labelledby="legal-t-${cur}"><h2 class="legal-h">${LEGAL_TITULOS[cur]}</h2>${legalDoc(cur)}</div>
      <div class="sheet-foot"><button type="button" class="btn block" data-act="legal-close">Cerrar</button></div>
    </div>`;
}
function delSheetHTML() {
  const D = st.del, ok = D.txt.trim().toUpperCase() === 'BORRAR' && !!D.pass;
  return `<div class="sheet-back" data-act="del-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Borrar mi cuenta">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="del-close" aria-label="Cerrar">${I.back}</button><h2>Borrar mi cuenta</h2><span style="width:36px"></span></div>
      <form class="sheet-list form-grid" data-form="delacc" novalidate>
        <div class="msg"><b>¿Estás seguro? Esta acción no se puede deshacer.</b> Se borrarán <b>para siempre</b> tu cuenta y todos tus datos: perfil, foto, pesos, entrenos, rutinas, objetivos y comidas.</div>
        ${st.profile && st.profile.isPro === true ? '<div class="msg ok">Tienes Cadencia Pro. Borrar la cuenta <b>no cancela la suscripción</b>: cancélala antes desde el enlace del recibo de Stripe que te llegó por email.</div>' : ''}
        <label class="field"><span>Tu contraseña</span><input class="input" type="password" name="pass" data-del="pass" autocomplete="current-password" value="${esc(D.pass)}"></label>
        <label class="field"><span>Escribe BORRAR para confirmar</span><input class="input" name="txt" data-del="txt" autocapitalize="characters" autocomplete="off" value="${esc(D.txt)}" placeholder="BORRAR"></label>
        ${D.msg ? `<div class="msg" role="alert">${esc(D.msg)}</div>` : ''}
        <button class="btn block danger-solid" type="submit" id="del-go" ${ok && !D.busy ? '' : 'disabled'}>${D.busy ? '<span class="spinner"></span> Borrando…' : 'Borrar mi cuenta y todos mis datos'}</button>
      </form>
    </div>`;
}
async function borrarCuenta() {
  const D = st.del;
  if (D.txt.trim().toUpperCase() !== 'BORRAR') { D.msg = 'Escribe BORRAR para confirmar.'; return render(); }
  if (!D.pass) { D.msg = 'Escribe tu contraseña.'; return render(); }
  D.busy = true; D.msg = ''; render();
  try {
    await api.deleteAccount(D.pass);
    // Limpia lo que la app guarda en este móvil (salvo el tema claro u oscuro).
    try { Object.keys(localStorage).filter((k) => k.startsWith('cadencia-') && k !== 'cadencia-theme' && k !== 'cadencia-local-v1').forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nada */ }
    st.del = null; st.modoSel = null; st.resumen = null; st.compartir = null; st.rutNuevos = null; st.cuerpo3d = null; st.limite = null; st.calentar = null; st.moverSel = null; st.dia7 = null; st.liveFin = null; st.live = null; st.tab = 'inicio'; st.authMode = 'login';
    obAnonBorrar();
    st.authMsg = { ok: true, text: 'Tu cuenta y todos tus datos se han borrado.' };
    if (st.user) enter(null); else render();
  } catch (e) {
    D.busy = false;
    D.msg = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(e && e.code) ? 'La contraseña no es correcta.' : `No se ha podido borrar: ${errorText(e)}`;
    render();
  }
}

async function onLogin(form) {
  const email = form.email.value.trim(), pass = form.pass.value;
  if (!email || !pass) { st.authMsg = { text: 'Escribe tu email y tu contraseña.' }; return render(); }
  st.busy = true; st.authMsg = null; render();
  try { await api.login(email, pass); } catch (e) { st.authMsg = { text: errorText(e) }; st.busy = false; render(); keepForm({ email }); }
}

// Entrar con Google o Apple desde la pantalla de acceso (cuentas que ya existen; si es la primera vez, se crea y pasa por el cuestionario).
async function onSocial(prov) {
  st.busy = true; st.authMsg = null; render();
  try {
    const u = prov === 'google' ? await api.loginGoogle() : await api.loginApple();
    try { const p = await api.getProfile(u.uid); if (!p || !p.legal) await api.saveProfile(u.uid, { legal: { v: LEGAL_V, fecha: new Date().toISOString(), via: 'continuar' } }); } catch (e) { /* se reintenta en el siguiente guardado */ }
  } catch (e) { st.busy = false; st.authMsg = { text: errorText(e) }; render(); }
}

function keepForm(vals) {
  const f = root.querySelector('form');
  if (!f) return;
  Object.entries(vals).forEach(([k, v]) => { if (f[k]) { if (f[k].type === 'checkbox') f[k].checked = !!v; else f[k].value = v; } });
}

async function onForgot() {
  const f = root.querySelector('form');
  const email = f && f.email.value.trim();
  if (!email) { st.authMsg = { text: 'Escribe tu email arriba y vuelve a tocar «He olvidado mi contraseña».' }; return render(); }
  try { await api.resetPassword(email); st.authMsg = { ok: true, text: `Te hemos enviado un email a ${email} para crear una contraseña nueva.` }; }
  catch (e) { st.authMsg = { text: errorText(e) }; }
  render(); keepForm({ email });
}

/* ================================================================== */
/* Cuestionario inicial (rediseño 2026-11-15; pantallas y cálculos en onboarding.js) */
/* ================================================================== */

// Nombre de usuario: solo letras, números, _ y -, sin espacios (3–20).
const USER_RE = /^[a-zA-Z0-9_-]+$/;
const userErr = (u) => (!u ? 'Escribe tu nombre de usuario.' : u.length < 3 || u.length > 20 ? 'El nombre de usuario tiene de 3 a 20 caracteres.' : !USER_RE.test(u) ? 'El usuario solo admite letras, números, guion bajo (_) y guion medio (-), sin espacios.' : '');
// «Nombre» y «Apellidos» a partir de lo guardado (o del nombre completo con el que se registró).
function nomApe(p, fallback = '') {
  const full = (p.nombreCompleto || p.nombre || fallback || '').trim().replace(/\s+/g, ' '), nom = p.nombre || full.split(' ')[0] || '';
  return [nom, p.apellidos != null ? p.apellidos : (full.startsWith(nom) ? full.slice(nom.length).trim() : '')];
}

// «¿Dónde entrenas?» puede venir de una versión antigua como texto suelto: se normaliza a lista.
const dondeOb = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((k) => OB.DONDE.some((d) => d.id === k));

// Qué quiere lograr, precargado en cuentas antiguas: sus objetivos (perder + músculo = recomposición) o, si no, hacia dónde apunta su peso objetivo.
function metaOb(p, ultimoKg) {
  const g = Array.isArray(p.objetivos) ? p.objetivos : [], kg = ultimoKg || p.pesoKg;
  if (g.includes('perder') && g.includes('musculo')) return 'recomp';
  if (g.includes('perder')) return 'perder';
  if (g.includes('musculo')) return 'volumen';
  return p.pesoObjetivo > 0 && kg > 0 && Math.abs(p.pesoObjetivo - kg) >= 0.5 ? (p.pesoObjetivo < kg ? 'perder' : 'volumen') : '';
}
// Respuestas de «¿Te suena alguna de estas situaciones?» ya guardadas: solo se aceptan las frases conocidas con valor booleano.
const psicoOb = (x) => { const r = {}; if (x && typeof x === 'object') OB.PSICO.forEach((q) => { if (typeof x[q.id] === 'boolean') r[q.id] = x[q.id]; }); return r; };
// `anon`: el cuestionario se hace SIN cuenta (no hay `st.user`); al final, `registro` crea la cuenta y guarda todo. Con cuenta (sesión iniciada pero sin cuestionario hecho) se hace como antes, sin `registro`.
function startOnboarding(ultimoKg = null, { anon = false } = {}) {
  if (anon) { const g = obAnonLeer(); if (g) { st.ob = g; st.view = 'onboarding'; return render(); } } // hay un avance guardado en este móvil: se sigue donde se dejó
  const p = st.profile || {}, [nom, ape] = nomApe(p, st.user && st.user.name);
  st.ob = {
    step: 'nombre', uid: st.user && st.user.uid, anon,
    nombre: nom, apellidos: ape, usuario: p.usuario || '',
    sexo: p.sexo || '', edad: p.edad ? String(p.edad) : '', alturaCm: p.alturaCm ? String(p.alturaCm) : '',
    exp: OB.EXPS.some((e) => e.id === p.experiencia) ? p.experiencia : '',
    donde: dondeOb(p.donde), material: (Array.isArray(p.material) ? p.material : []).filter((k) => OB.MATERIAL_TODOS.some((m) => m.id === k)),
    gymInit: Array.isArray(p.material) && p.material.some((k) => OB.esGym(k)), // ya eligió material de gimnasio antes: no se vuelve a marcar todo
    freq: p.diasSemana >= 2 && p.diasSemana <= 7 ? p.diasSemana : 0,
    tiempo: OB.TIEMPOS.some(([m]) => m === p.minutosSesion) ? p.minutosSesion : 0,
    obstaculo: OB.OBSTACULOS.some((x) => x.id === p.obstaculo) ? p.obstaculo : '',
    psico: psicoOb(p.psico),
    pesoKg: ultimoKg || p.pesoKg ? nf(ultimoKg || p.pesoKg, 1) : '', ultimoKg, pesoObjetivo: p.pesoObjetivo ? nf(p.pesoObjetivo, 1) : '',
    meta: metaOb(p, ultimoKg), ritmo: p.ritmoKgSemana >= OB.RITMO.min && p.ritmoKgSemana <= OB.RITMO.max ? OB.ritmoDe(p.ritmoKgSemana) : OB.RITMO.def,
    msg: '', saving: false, firmado: false,
  };
  st.view = 'onboarding';
  render();
}

function viewOnboarding() {
  const o = st.ob, flow = OB.flujo(o), i = Math.max(0, flow.indexOf(o.step)), s = o.step;
  const pct = ((i + 1) / flow.length) * 100;
  let body = '', nextLabel = 'Siguiente';

  if (s === 'nombre') body = OB.nombreHTML(o);                 // «Tus datos», una pregunta por pantalla
  else if (s === 'sexo') body = OB.sexoHTML(o);
  else if (s === 'edad') body = OB.edadHTML(o);
  else if (s === 'altura') body = OB.alturaHTML(o);
  else if (s === 'exp') body = OB.expHTML(o);
  else if (s === 'registro') body = OB.registroHTML(o);        // solo sin cuenta: crea la cuenta y guarda todo
  else if (s === 'donde') body = OB.dondeHTML(o);
  else if (s === 'material') body = OB.materialHTML(o);
  else if (s === 'dias') body = OB.diasHTML(o);
  else if (s === 'tiempo') body = OB.tiempoHTML(o);           // minutos por sesión
  else if (s === 'peso') body = OB.pesoHTML(o);   // peso actual + qué quiere lograr
  else if (s === 'meta') body = OB.metaHTML(o);   // peso meta (sin recomendaciones de IMC)
  else if (s === 'ritmo') body = OB.ritmoHTML(o, todayISO()); // ritmo elegido (kg/semana) + fecha en vivo
  else if (s === 'obstaculos') body = OB.obstaculosHTML(o);   // mayor obstáculo
  else if (s === 'psicologia') { body = OB.psicologiaHTML(o); nextLabel = 'Continuar'; } // 4 frases Sí / No
  else if (s === 'historia') { body = OB.historiaHTML(o); nextLabel = 'Continuar'; } // «Es normal sentirse así» (fondo oscuro)
  else if (s === 'carga') body = OB.cargaHTML(o);              // pantalla de carga: sin menú ni botón, avanza sola
  else if (s === 'plan') { body = OB.planHTML(o, obProfile(), todayISO()); nextLabel = 'Aceptar mi plan'; }
  else body = OB.firmaHTML(o, `${o.nombre.trim()} ${o.apellidos.trim()}`.replace(/\s+/g, ' '));

  const paso = OB.PASO[s];
  const sinMenu = s === 'carga';
  return `<form class="screen${s === 'historia' ? ' ob-dark' : ''}${sinMenu ? ' ob-carga' : ''}" data-form="ob" novalidate>
    ${sinMenu ? '' : `<div class="ob-top">
      ${(i > 0 || o.anon) && !o.saving && s !== 'registro' ? `<button type="button" class="ob-back" data-act="ob-back" aria-label="Atrás">${I.back}</button>` : ''}
      <div class="ob-track" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <span class="ob-count">${paso ? `Paso ${paso} de ${OB.PASOS}` : s === 'registro' ? 'Último paso' : 'Tus datos'}</span>
    </div>`}
    <div class="ob-body">${body}
      ${o.msg ? `<div class="msg" role="alert">${esc(o.msg)}</div>` : ''}
    </div>
    ${s === 'firma' || s === 'registro' || sinMenu ? '' : `<div class="ob-foot"><button class="btn block" type="submit" data-next ${OB.puedeSeguir(o) ? '' : 'disabled'}>${nextLabel}</button></div>`}
  </form>`;
}

function obProfile() {
  const o = st.ob, act = num(o.pesoKg), obj = num(o.pesoObjetivo);
  const nombre = o.nombre.trim().replace(/\s+/g, ' '), apellidos = o.apellidos.trim().replace(/\s+/g, ' ');
  return {
    nombre, apellidos, nombreCompleto: `${nombre} ${apellidos}`, usuario: o.usuario.trim() || genUsuario(o),
    objetivos: OB.objetivosDe(o.meta), ritmoKgSemana: o.ritmo, sexo: o.sexo, edad: Math.round(num(o.edad)),
    alturaCm: Math.round(num(o.alturaCm)), pesoKg: Math.round(act * 10) / 10,
    pesoObjetivo: isFinite(obj) ? Math.round(obj * 10) / 10 : null,
    experiencia: o.exp, donde: o.donde, material: o.material, eqSel: OB.eqDesde(o.donde, o.material), diasSemana: o.freq,
    // Fase 1 (variables para el Coach AI): minutos por sesión, mayor obstáculo y respuestas Sí/No (booleanos por frase).
    minutosSesion: o.tiempo, obstaculo: o.obstaculo, psico: { ...o.psico },
  };
}

function obValidate() {
  const o = st.ob, s = o.step;
  if (s === 'nombre') {
    if (!o.nombre.trim()) return 'Escribe tu nombre.';
    if (!o.apellidos.trim()) return 'Escribe tus apellidos.';
  }
  if (s === 'edad') { const e = num(o.edad); if (!(e >= 14 && e <= 100)) return 'Escribe una edad entre 14 y 100 años.'; }
  if (s === 'altura') {
    const h = num(o.alturaCm);
    if (h > 1 && h < 2.5) o.alturaCm = String(Math.round(h * 100)); // escribió metros
    else if (!(h >= 120 && h <= 230)) return 'Escribe tu estatura en centímetros, entre 120 y 230.';
  }
  if (s === 'peso') {
    const w = num(o.pesoKg); if (!(w >= 30 && w <= 250)) return 'Escribe un peso actual entre 30 y 250 kg.';
    if (!o.meta) return 'Elige qué quieres lograr.';
  }
  if (s === 'meta') {
    const w = num(o.pesoKg), t = num(o.pesoObjetivo);
    if (!isFinite(t)) return 'Escribe tu peso meta con números.';
    if (o.meta === 'perder' && !(t <= w - 0.5)) return 'Para perder grasa, tu peso meta tiene que ser menor que el de hoy.';
    if (o.meta === 'volumen' && !(t >= w + 0.5)) return 'Para ganar volumen, tu peso meta tiene que ser mayor que el de hoy.';
    if (o.meta === 'recomp' && !(t <= w)) return 'En una recomposición, tu peso meta no puede ser mayor que el de hoy.';
    return objetivoInvalido(t, num(o.alturaCm), o.sexo, OB.objetivosDe(o.meta));
  }
  return '';
}

function obNext() {
  const o = st.ob;
  if (o.step === 'registro') return obRegistrar('email'); // el único botón con «submit» de esta pantalla es el de crear la cuenta con email
  if (!OB.puedeSeguir(o)) return;
  const err = obValidate();
  if (err) { o.msg = err; return render(); }
  o.msg = '';
  const flow = OB.flujo(o), nxt = flow[flow.indexOf(o.step) + 1];
  if (!nxt) return;
  if (nxt === 'material') Object.assign(o, OB.materialInicial(o)); // con Gimnasio: lista pre-marcada (solo la primera vez); quita lo que ya no corresponde
  if (nxt === 'meta' && o.meta === 'recomp' && !o.pesoObjetivo.trim()) { const r = OB.recompDe(o); if (r) o.pesoObjetivo = nf(r.objetivo, 1); } // recomposición: propone el peso estimado
  if (nxt === 'carga' && o.cargaVista) return obNextA(o, flow[flow.indexOf('carga') + 1]); // ya la vio (volvió atrás): no se repite
  if (nxt === 'carga') { o.cargaT0 = performance.now(); o.cargaRaf = 0; }
  if (nxt === 'firma' && !o.pausaVista && !matchMedia('(prefers-reduced-motion: reduce)').matches) { o.pausaT0 = performance.now(); o.pausaFin = false; pausaFirma(o); } // pausa dramática (una vez)
  obNextA(o, nxt);
}
function obNextA(o, nxt) {
  o.step = nxt; render(); window.scrollTo(0, 0);
  if (nxt === 'carga') OB.iniciarCarga(root, o, () => { if (st.ob === o && o.step === 'carga') obNext(); }); // a mano: el botón no existe
  else focusFirst();
}
// Pausa antes de la firma: pasados OB.PAUSA_MS enseña la promesa y el botón de golpe. Se marca como vista aunque el usuario haya vuelto atrás.
function pausaFirma(o) {
  setTimeout(() => { o.pausaFin = true; o.pausaVista = true; if (st.ob === o && o.step === 'firma') render(); }, OB.PAUSA_MS);
}

function obBack() {
  const o = st.ob, flow = OB.flujo(o), i = flow.indexOf(o.step);
  if (o.saving) return;
  if (i <= 0) { if (o.anon) { obGuardarAnon(); st.view = 'auth'; st.authMode = 'welcome'; render(); } return; } // sin cuenta: vuelve a la bienvenida (lo respondido se conserva)
  const prev = flow[i - 1] === 'carga' ? flow[i - 2] : flow[i - 1]; // la pantalla de carga nunca se vuelve a visitar hacia atrás
  o.step = prev; o.msg = ''; render(); window.scrollTo(0, 0);
}

// Se llama al completar la firma (mantener pulsado 2 s). Guarda TODO el perfil y, solo si la escritura sale bien,
// marca `onboardingCompletado: true`, quita el cuestionario y enseña la app con un fundido.
async function obFirmado() {
  const o = st.ob;
  if (!o || o.saving) return;
  if (o.anon) { // sin cuenta todavía: no se guarda nada; tras el ✓ pasa a crear la cuenta (`registro`)
    if (o.firmado) return;
    o.firmado = true; render();
    setTimeout(() => { if (st.ob !== o || o.step !== 'firma') return; o.step = 'registro'; render(); window.scrollTo(0, 0); }, 900);
    return;
  }
  o.firmado = true; o.saving = true; o.msg = '';
  setTimeout(async () => { // deja ver el ✓ un instante antes de redibujar
    if (st.ob !== o) return;
    render();
    try {
      const p = obProfile(), uid = st.user.uid, hoy = todayISO();
      const ant = st.profile || {}; // cuenta antigua: conserva su punto de partida y los objetivos que el cuestionario no pregunta
      const extra = (Array.isArray(ant.objetivos) ? ant.objetivos : []).filter((g) => !['perder', 'musculo', 'mantener'].includes(g));
      const data = { ...p, objetivos: [...p.objetivos, ...extra], firmaFecha: hoy, pesoInicial: ant.pesoInicial || p.pesoKg, fechaInicio: ant.fechaInicio || hoy, onboarded: true, onboardingCompletado: true, onboardingVersion: OB.VERSION, novVista: NOV_V };
      data.calorias = CAL.resumen({ ...ant, ...data }, p.pesoKg);
      if (o.ultimoKg !== p.pesoKg) await api.addWeight(uid, hoy, p.pesoKg); // primero el peso (solo si cambió respecto al último)…
      await api.saveProfile(uid, data);        // …y el perfil con la marca al final: si algo falla antes, la marca NO queda puesta
      st.profile = { ...(st.profile || {}), ...data };
      toast('¡Compromiso firmado!');
    } catch (e) {
      o.saving = false; o.firmado = false; o.msg = errorText(e); render(); return;
    }
    try { await entrarApp(st.user, { fade: true }); } // carga normal: peso, entrenos, racha…
    catch (e) { st.errText = errorText(e); st.view = 'error'; render(); } // el perfil ya está guardado: «Reintentar» entra directo
  }, 450);
}

/* ---------- cuestionario SIN cuenta: avance guardado en este móvil, usuario automático y alta final ---------- */
// El estado del cuestionario vive en `st.ob`; además se copia a localStorage (sin contraseña ni datos de la pantalla de carga/pausa) por si se recarga la página o el navegador cierra la pestaña.
// Se borra al guardarlo en la cuenta. Es una copia local en el propio móvil de la persona; no se envía a ningún servidor.
const OB_ANON_KEY = 'cadencia-ob-anon', OB_NO_GUARDAR = ['regPass', 'regEmailV', 'regEmail', 'msg', 'saving', 'cuenta', 'justRegistered', 'cargaT0', 'cargaRaf', 'cargaVista', 'pausaT0', 'pausaFin', 'pausaVista'];
function obGuardarAnon() {
  const o = st.ob;
  if (!o || !o.anon || o.justRegistered) return;
  try { const c = {}; Object.keys(o).forEach((k) => { if (!OB_NO_GUARDAR.includes(k)) c[k] = o[k]; }); lsSet(OB_ANON_KEY, JSON.stringify(c)); } catch (e) { /* sin espacio: se sigue en memoria */ }
}
function obAnonLeer() {
  try {
    const c = JSON.parse(lsGet(OB_ANON_KEY) || 'null');
    if (!c || typeof c !== 'object' || !c.anon || !OB.flujo(c).includes(c.step)) return null;
    if (c.step === 'carga') c.step = 'historia'; // la carga es solo un efecto: no se retoma a medias
    return { ...c, msg: '', saving: false };
  } catch (e) { return null; }
}
function obAnonBorrar() { try { lsSet(OB_ANON_KEY, null); } catch (e) { /* nada */ } }
// Usuario automático (letras, números, _ y -; 3–20): nombre + inicial del apellido + 3 cifras. Se cambia luego en Perfil. Se fija la primera vez para que no cambie entre reintentos.
function genUsuario(o) {
  if (o.usuarioAuto) return o.usuarioAuto;
  const limpia = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = (limpia((o.nombre || '').trim().split(/\s+/)[0]).slice(0, 12) || 'cadencia') + limpia((o.apellidos || '').trim()).slice(0, 1);
  o.usuarioAuto = `${base}_${String(Math.floor(Math.random() * 900) + 100)}`.slice(0, 20);
  return o.usuarioAuto;
}

// Último paso del cuestionario sin cuenta. `via`: 'google' | 'apple' | 'email'. La cuenta se crea AQUÍ y el cuestionario entero se guarda en su perfil; si falla el guardado, la cuenta ya existe (`o.cuenta`) y el reintento solo vuelve a guardar.
async function obRegistrar(via) {
  const o = st.ob;
  if (!o || !o.anon || o.saving) return;
  o.msg = '';
  if (!o.acepto) { o.msg = 'Para crear la cuenta tienes que aceptar los Términos de Uso, la Política de Privacidad y el aviso de salud.'; return render(); }
  let email = '', pass = '';
  if (via === 'email' && !o.cuenta) {
    email = (o.regEmailV || '').trim(); pass = o.regPass || '';
    if (!email) { o.msg = 'Escribe tu email.'; return render(); }
    if (pass.length < 6) { o.msg = 'La contraseña necesita al menos 6 caracteres.'; return render(); }
  }
  o.saving = true; st.registering = true; render();
  try {
    let u = o.cuenta;
    if (!u) {
      const completo = `${o.nombre.trim()} ${o.apellidos.trim()}`.replace(/\s+/g, ' ');
      u = via === 'google' ? await api.loginGoogle() : via === 'apple' ? await api.loginApple() : await api.register(completo, email, pass);
      o.cuenta = u;
    }
    st.user = u;
    const previo = await api.getProfile(u.uid);
    if (via !== 'email' && onboardingHecho(previo)) { // la cuenta de Google/Apple ya existía y estaba completa: se entra en ella y lo respondido se descarta
      st.registering = false; st.ob = null; obAnonBorrar(); toast('Ya tenías cuenta: hemos entrado en ella');
      return enter(u);
    }
    const p = obProfile(), hoy = todayISO(), ant = previo || {};
    const extra = (Array.isArray(ant.objetivos) ? ant.objetivos : []).filter((g) => !['perder', 'musculo', 'mantener'].includes(g));
    const data = { ...p, email: u.email || ant.email || '', objetivos: [...p.objetivos, ...extra], firmaFecha: hoy, pesoInicial: ant.pesoInicial || p.pesoKg, fechaInicio: ant.fechaInicio || hoy, onboarded: true, onboardingCompletado: true, onboardingVersion: OB.VERSION, novVista: NOV_V, legal: { v: LEGAL_V, fecha: new Date().toISOString() } };
    data.calorias = CAL.resumen({ ...ant, ...data }, p.pesoKg);
    await api.addWeight(u.uid, hoy, p.pesoKg); // primero el peso…
    await api.saveProfile(u.uid, data);        // …y el perfil con la marca al final: si algo falla antes, la marca NO queda puesta
    st.profile = { ...ant, ...data };
    obAnonBorrar();
    // Si llegó con el enlace de un amigo, se canjea solo (esperando como mucho 4 s; si tarda más, sigue por detrás y `pwVigilar` lo recoge).
    const canje = refAutoCanje();
    const aplicado = await Promise.race([canje, new Promise((ok) => setTimeout(() => ok(null), 4000))]);
    st.registering = false; o.saving = false; o.justRegistered = true;
    if (aplicado === true) return pwSalir(); // ya tiene PRO de regalo: entra directo a la app (el aviso de éxito ya salió)
    st.vieneDeRegistro = true;
    st.pf = { v: 'suscripcion', plan: 'anual', f: {}, busy: false }; st.pwAviso = false;
    st.view = 'paywall'; render(); window.scrollTo(0, 0);
    pwVigilar(u);
  } catch (e) {
    st.registering = false; o.saving = false; o.msg = errorText(e); render();
  }
}

/* ---------- paywall en cascada: justo tras registrarse, a pantalla completa ---------- */
// Solo se ve al venir del registro (`st.vieneDeRegistro === true`). La X NO cierra: abre el aviso de fricción; solo «Continuar con la versión básica» apaga la marca y entra en la app gratuita.
function viewPaywall() {
  return `<div class="screen pw-full">
    <div class="pw-top"><button type="button" class="iconbtn" data-act="pw-cerrar" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <h1 class="ob-title">Tu plan está listo</h1>
    ${PAGOS_ACTIVOS ? '' : betaTagHTML('beta-c')}
    <p class="ob-sub">${PAGOS_ACTIVOS ? 'Desbloquéalo con Cadencia PRO: Coach AI, rutinas ilimitadas y todas las funciones.' : 'Todo es gratis durante la beta abierta. Apúntate a la lista prioritaria y te avisaremos cuando llegue Cadencia PRO.'}</p>
    ${suscripcionHTML()}
    ${PAGOS_ACTIVOS ? '' : '<button type="button" class="btn ghost block" data-act="pw-seguir">Continuar gratis</button>'}
    ${st.profile && st.profile.codigoUsado === true ? '' : `<button type="button" class="btn ghost block pw-codigo" data-act="cod-open">${I.gift} Tengo un código de invitación</button>`}
  </div>${st.proInfo ? proInfoHTML() : ''}${st.pwAviso ? pwAvisoHTML() : ''}${st.codigo ? codigoSheetHTML() : ''}`;
}
/* ---------- referidos: 1 semana de Pro por amigo invitado (máx. 10) ---------- */
// Todo lo decide el servidor (Cloud Functions miCodigo, canjearCodigo y reclamarReferido): aquí solo se pide y se pinta.
const diaPro = (ms) => fmtDate(new Date(ms).toISOString().slice(0, 10));
const proRegalo = (pr) => (pr && pr.isPro === true && Number(pr.proCaduca) > Date.now() ? Number(pr.proCaduca) : 0); // fin del Pro regalado, o 0
function codigoSheetHTML() {
  const c = st.codigo;
  return `<div class="sheet-back sheet-back-top" data-act="cod-close"></div>
    <div class="sheet short pw-aviso cod-sheet" role="dialog" aria-modal="true" aria-label="Código de invitación">
      <div class="sheet-grab"></div>
      <form class="pw-aviso-b" data-form="codigo" novalidate>
        <h2>${I.gift} Código de invitación</h2>
        <p>Si un amigo te ha invitado, escribe su código y recibirás <b>7 días de Cadencia PRO</b>. Solo se puede usar un código por cuenta.</p>
        <input class="input cod-input" name="codigo" value="${esc(c.val || '')}" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="Ej. CAD67X" aria-label="Código de invitación">
        ${c.msg ? `<p class="cod-msg" role="alert">${esc(c.msg)}</p>` : ''}
        <button type="submit" class="btn block"${c.busy ? ' disabled' : ''}>${c.busy ? '<span class="spinner"></span>' : 'Canjear código'}</button>
        <button type="button" class="btn ghost block pw-ghost" data-act="cod-close">Ahora no</button>
      </form>
    </div>`;
}
async function canjearCodigo(codigo) {
  const c = st.codigo; if (!c || c.busy) return;
  const cod = String(codigo || '').trim().toUpperCase().replace(/[\s-]/g, '');
  c.val = cod;
  if (!/^[A-Z0-9]{6}$/.test(cod)) { c.msg = 'El código tiene 6 letras y números.'; return render(); }
  c.busy = true; c.msg = ''; render();
  try {
    const r = await api.canjearCodigo(cod);
    st.profile = { ...st.profile, isPro: true, proCaduca: r.proCaduca, codigoUsado: true };
    const enPaywall = st.view === 'paywall';
    st.codigo = null;
    toast(`¡Listo! Tienes Cadencia PRO hasta el ${diaPro(r.proCaduca)}`);
    if (enPaywall) return pwSalir();
    render();
  } catch (e) { c.busy = false; c.msg = errorText(e); render(); }
}
// Auto-canje del enlace de un amigo (se llama al terminar el registro). Devuelve true si se aplicó. Los errores definitivos
// (código inexistente, lleno, propio…) borran el código guardado y avisan; los de red lo dejan para el botón «Tengo un código».
const REF_DEFINITIVOS = ['ref/ref-formato', 'ref/ref-no-existe', 'ref/ref-propio', 'ref/ref-usado', 'ref/ref-pro-pago', 'ref/ref-lleno'];
async function refAutoCanje() {
  const cod = refGuardado(); if (!cod) return false;
  try {
    const r = await api.canjearCodigo(cod);
    refLimpiar();
    st.profile = { ...st.profile, isPro: true, proCaduca: r.proCaduca, codigoUsado: true };
    toast('¡Código de amigo aplicado! Tienes 1 semana PRO gratis');
    return true;
  } catch (e) {
    if (REF_DEFINITIVOS.includes(e && e.code)) { refLimpiar(); toast(`No se ha podido aplicar el código de tu amigo. ${errorText(e)}`); }
    return false;
  }
}
// Hito i (1..10) de la hoja: reclamado (gris) / reclamable (amarillo) / bloqueado (borde, desactivado).
function refHitoHTML(i, ref, rec) {
  const hecho = rec.includes(i), listo = !hecho && ref >= i, txt = `${i} ${i === 1 ? 'amigo' : 'amigos'}`;
  const btn = hecho ? '<button type="button" class="btn small ref-btn is-done" disabled>Reclamado</button>'
    : listo ? `<button type="button" class="btn small ref-btn"${st.refBusy ? ' disabled' : ''} data-act="ref-reclamar" data-v="${i}">Reclamar 1 semana</button>`
    : `<button type="button" class="btn ghost small ref-btn" disabled>Invita a ${txt}</button>`;
  return `<li class="ref-hito${hecho ? ' is-done' : listo ? ' is-ready' : ''}"><span class="ref-n" aria-hidden="true">${i}</span><span class="ref-t"><b>${txt}</b><small>+1 semana de PRO</small></span>${btn}</li>`;
}
function referidosSheetHTML() {
  const p = st.profile || {}, ref = Math.min(REF_MAX, Math.max(0, Number(p.referidos) || 0)), rec = Array.isArray(p.recompensas) ? p.recompensas : [];
  const fin = proRegalo(p), lleno = ref >= REF_MAX;
  return `<div class="sheet-list ref-body">
    <p class="small muted">Comparte tu enlace: tu amigo recibe <b>7 días de Cadencia PRO</b> al registrarse con él (o al escribir tu código) y tú ganas <b>1 semana</b> por cada amigo, hasta ${REF_MAX} amigos. Las semanas se reclaman a mano y se suman a tu PRO.</p>
    <section class="ref-code"><span class="small muted">Tu código</span>
      ${p.refCode ? `<b class="ref-cod" id="ref-cod">${esc(p.refCode)}</b>
      <div class="ref-acts"><button type="button" class="btn small" data-act="ref-share">Invitar amigos</button><button type="button" class="btn ghost small" data-act="ref-copy">Copiar código</button></div>
      <span class="small muted ref-link" id="ref-link">${esc(REF_URL)}?ref=${esc(p.refCode)}</span>`
      : '<b class="ref-cod ref-cod-no">Generando…</b><span class="small muted">Un momento, estamos creando tu código.</span>'}</section>
    <section class="ref-prog" aria-label="Progreso de invitaciones"><p><b>Has invitado a ${ref}/${REF_MAX} amigos</b></p>
      <div class="ref-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${REF_MAX}" aria-valuenow="${ref}"><i style="width:${ref * 100 / REF_MAX}%"></i></div>
      ${lleno ? '<p class="small muted">Has llegado al máximo de invitados. Puedes reclamar las semanas que te queden.</p>' : ''}
      ${fin ? `<p class="small muted">Tu PRO de regalo dura hasta el <b>${diaPro(fin)}</b>.</p>` : ''}</section>
    <ol class="ref-lista">${Array.from({ length: REF_MAX }, (_, k) => refHitoHTML(k + 1, ref, rec)).join('')}</ol>
    ${p.codigoUsado === true ? '' : `<button type="button" class="btn ghost block" data-act="cod-open">${I.gift} Tengo un código de invitación</button>`}
    <p class="small muted">Si ya pagas Cadencia PRO, reclama tus semanas cuando termine tu plan: no se pierden. Cada persona solo puede canjear un código.</p>
  </div>`;
}
async function reclamarReferido(hito) {
  if (st.refBusy) return;
  const h = Number(hito); if (!Number.isInteger(h)) return;
  st.refBusy = true; render();
  try {
    const r = await api.reclamarReferido(h);
    st.profile = { ...st.profile, isPro: true, proCaduca: r.proCaduca, recompensas: r.recompensas };
    st.refBusy = false; render();
    toast(`¡+1 semana de PRO! Ya tienes Cadencia PRO hasta el ${diaPro(r.proCaduca)}`);
  } catch (e) { st.refBusy = false; render(); toast(errorText(e)); }
}
// Al abrir la hoja: pide el código si aún no lo tiene y refresca el número de invitados (otros amigos pueden haberlo usado desde la última vez).
async function refAbrir() {
  const u = st.user; if (!u) return;
  try {
    if (!st.profile.refCode) { const r = await api.miCodigo(); st.profile.refCode = r.refCode; }
    const p = await api.getProfile(u.uid);
    if (p) st.profile = { ...st.profile, referidos: p.referidos || 0, recompensas: p.recompensas || [], isPro: p.isPro, proCaduca: p.proCaduca, refCode: p.refCode || st.profile.refCode, codigoUsado: p.codigoUsado };
    if (st.pf && st.pf.v === 'referidos') render();
  } catch (e) { /* sin conexión: se ve lo que ya había */ }
}
// Copia un texto; si el navegador no deja, selecciona el enlace visible para copiarlo a mano.
async function refCopiarTexto(txt, ok) {
  try { await navigator.clipboard.writeText(txt); toast(ok); }
  catch (e) { const el = document.getElementById('ref-link') || document.getElementById('ref-cod'); if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const g = window.getSelection(); g.removeAllRanges(); g.addRange(r); } toast('Mantén pulsado el texto para copiarlo'); }
}
const refCopiar = () => { const c = st.profile && st.profile.refCode; return c ? refCopiarTexto(c, 'Código copiado') : undefined; };
// «Invitar amigos»: hoja de compartir del móvil (Web Share) con el enlace mágico; sin ella, copia el mensaje con el enlace.
async function refCompartir() {
  const c = st.profile && st.profile.refCode; if (!c) return;
  const url = `${REF_URL}?ref=${c}`;
  if (navigator.share) {
    try { await navigator.share({ title: APP_NAME, text: REF_TEXTO, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* cancelado: nada; otro error: se copia */ }
  }
  await refCopiarTexto(`${REF_TEXTO} ${url}`, 'Enlace copiado: pégalo en un mensaje');
}

function pwAvisoHTML() {
  return `<div class="sheet-back sheet-back-top" data-act="pw-aviso-cerrar"></div>
    <div class="sheet short pw-aviso" role="dialog" aria-modal="true" aria-label="¿Seguro que quieres irte?">
      <div class="sheet-grab"></div>
      <div class="pw-aviso-b">
        <h2>${I.warn} ¿Seguro que quieres irte?</h2>
        <p>Tu plan de entrenamiento está guardado, pero sin Cadencia PRO no tendrás acceso al Coach IA ni a las analíticas de progreso. No dejes tu potencial a medias.</p>
        <button type="button" class="btn block" data-act="pw-aviso-cerrar">Activar Cadencia PRO</button>
        <button type="button" class="btn ghost block pw-ghost" data-act="pw-seguir">Continuar con la versión básica</button>
      </div>
    </div>`;
}
// Si paga y vuelve (el servidor activa Pro), entra solo en la app.
let pwParar = null;
function pwVigilar(u) {
  pwQuitar();
  if (typeof api.watchProfile !== 'function') return;
  pwParar = api.watchProfile(u.uid, (p) => { if (st.view === 'paywall' && p && p.isPro === true) { st.profile = { ...st.profile, ...p }; toast('¡Bienvenido a Cadencia PRO!'); pwSalir(); } });
}
function pwQuitar() { if (pwParar) { try { pwParar(); } catch (e) { /* ya estaba parado */ } pwParar = null; } }
async function pwSalir() {
  pwQuitar(); st.vieneDeRegistro = false; st.pwAviso = false; st.pf = null; st.proInfo = null; st.codigo = null;
  try { await entrarApp(st.user, { fade: true }); } catch (e) { st.errText = errorText(e); st.view = 'error'; render(); }
}
function pwSeguir() { return pwSalir(); }

function focusFirst() {
  const i = root.querySelector('.big-input input');
  if (i && !i.value) { try { i.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
}

/* ================================================================== */
/* App principal                                                       */
/* ================================================================== */
// Entreno vive en entreno-ui.js; Nutrición, Rutas, Taller, Progreso y Objetivos en secciones.js.
const W = crearEntreno({ st, root, get api() { return api; }, render, get M() { return M; }, currentKg: () => currentKg(), goalById: (id) => goalById(id), stravaBtn: () => (CICLISMO ? S.syncBtnHTML() : ''), gearHTML: () => gearHTML() });
const { exViewHTML, rutinaOf, homeTraining, viewEntreno, viewRutWizard, viewLive, liveBarHTML, viewWkForm, libSheetHTML, wkSave, rwNext, regSheetHTML, wkHistSheetHTML, wkDelSheetHTML, rutDelSheetHTML, rachaActual, fuegoHTML, modoSheetHTML, limiteSheetHTML, calentarSheetHTML, moverSheetHTML, dia7SheetHTML, rutNuevosSheetHTML, resumenSheetHTML, compartirSheetHTML, pintarCompartir, recuperacionHTML, cuerpoSheetHTML, rutShareSheetHTML, finSheetHTML } = W;
const M = crearSecciones({
  st, get api() { return api; }, render, toast, esc, num, nf, todayISO, fmtDate, lsGet, lsSet, I, E, errorText,
  currentKg: () => currentKg(), rutinaOf: () => rutinaOf(), viewPeso: (sub) => viewPeso(sub), gearHTML: () => gearHTML(),
});

const S = crearStrava({ st, get api() { return api; }, render, toast, esc, E, currentKg: () => currentKg(), todayISO, fmtDate, lsGet, lsSet, errorText });
const R = crearRecordatorios({ st, get api() { return api; }, render, toast, esc, lsGet, lsSet, errorText, I });
let irPendiente = leerIr(); // si venimos de tocar un aviso, aquí queda la pantalla a la que ir
let stravaRet = CICLISMO ? leerRetorno() : null; // si venimos de la pantalla de permisos de Strava, aquí queda el código temporal

const gearHTML = () => `<button type="button" class="gear" data-act="cfg-open" aria-label="Configuración">${I.gear}</button>`;
function viewMain() {
  const sheet = st.dia7 ? dia7SheetHTML() : st.rutNuevos ? rutNuevosSheetHTML() : st.compartir ? compartirSheetHTML() : st.cuerpo3d ? cuerpoSheetHTML() : st.codigo ? codigoSheetHTML() : st.limite ? limiteSheetHTML() : st.proInfo ? proInfoHTML() : st.legal ? legalSheetHTML() : st.pf ? pfSheetHTML() : st.liveFin && st.live ? finSheetHTML() : st.calentar ? calentarSheetHTML() : st.moverSel ? moverSheetHTML() : st.rutShare ? rutShareSheetHTML() : st.modoSel ? modoSheetHTML() : st.resumen ? resumenSheetHTML() : st.del ? delSheetHTML() : st.exView ? exViewHTML() : st.lib ? libSheetHTML() : st.rutDelAsk ? rutDelSheetHTML() : st.wkDel ? wkDelSheetHTML() : st.wkHist ? wkHistSheetHTML() : st.regPick ? regSheetHTML() : st.pesoDel ? pesoDelSheetHTML() : st.pesoSheet ? pesoSheetHTML() : st.pesoHist ? pesoHistSheetHTML() : st.recAsk ? R.askHTML() : st.pwd ? pwdSheetHTML() : st.cfg ? cfgSheetHTML() : M.sheet();
  if (st.rw) return viewRutWizard() + sheet;
  if (st.live && !st.liveMin) return viewLive() + sheet;
  if (st.wk) return viewWkForm();
  const tab = M.tabActual(), tabs = M.tabs();
  const body = tab === 'perfil' ? viewPerfil() : tab === 'entreno' ? viewEntreno() : tab === 'inicio' ? viewInicio() : M.view(tab);
  // El engranaje va DENTRO de la cabecera (junto al reloj del historial) en Inicio, Forma física y Entreno con rutina; en el resto, flotante.
  const gearEnCabecera = tab === 'inicio' || tab === 'progreso' || (tab === 'entreno' && !!rutinaOf());
  return `${gearEnCabecera ? '' : gearHTML()}<main class="main ${st.live ? 'has-live' : ''}">${body}</main>${st.live ? liveBarHTML() : ''}${sheet}${M.novModalHTML()}
  <div class="tabbar"><nav aria-label="Secciones" class="n${tabs.length}">${tabs.map((t) => `<button type="button" data-act="tab" data-v="${t.id}" ${tab === t.id ? 'aria-current="page"' : ''}>${t.ico}<span>${t.t}</span></button>`).join('')}</nav></div>`;
}

const latestWeight = () => (st.weights.length ? st.weights[st.weights.length - 1] : null);
const currentKg = () => { const l = latestWeight(); return l ? l.kg : st.profile.pesoKg; };

function viewInicio() {
  const p = st.profile, kg = currentKg();
  const name = p.nombre || st.user.name || '';
  const first = st.weights[0];
  const delta = first && st.weights.length > 1 ? kg - first.kg : null;
  let goal = '';
  const start = first ? first.kg : p.pesoInicial; // el registro más antiguo es el punto de partida
  if (p.pesoObjetivo && start && p.pesoObjetivo !== start) {
    const total = p.pesoObjetivo - start, done = kg - start;
    const pct = Math.max(0, Math.min(100, (done / total) * 100));
    const left = p.pesoObjetivo - kg;
    const reached = total < 0 ? kg <= p.pesoObjetivo : kg >= p.pesoObjetivo;
    goal = `<div class="goalbar">
      <div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso hacia tu peso objetivo"><i style="width:${pct}%"></i></div>
      <div class="ends"><span>Empezaste en ${nf(start, 1)}</span><span>${reached ? '¡Objetivo conseguido!' : `Faltan ${nf(Math.abs(left), 1)} kg para ${nf(p.pesoObjetivo, 1)}`}</span></div>
    </div>`;
  }

  return `
    <header class="hello hello-home">
      <div><h1>Hola, ${esc(name)}</h1><p>${esc(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</p></div>
      <div class="hello-r">${st.profile && st.profile.isPro === true ? '<button class="protag pill" data-act="tab" data-v="perfil" aria-label="Tu plan: Cadencia Pro">Pro</button>' : ''}<div class="hello-ico">${M.novBell()}${gearHTML()}</div></div>
    </header>

    <section class="racha-home tap" data-act="tab" data-v="entreno" role="button" tabindex="0" aria-label="Tu racha: abrir Entreno">${fuegoHTML(rachaActual(), true)}<span class="racha-t"><b>${rachaActual() === 1 ? 'Día' : 'Días'} de racha</b><span class="small muted">${rachaActual() ? 'No la rompas hoy' : 'Entrena y enciende el fuego'}</span></span></section>

    <section class="card weight-hero tap" data-act="p-peso" role="button" tabindex="0" aria-label="Peso actual: abrir Forma física">
      <h2>Peso actual</h2>
      <div class="big num">${nf(kg, 1)}<em>kg</em></div>
      ${delta != null ? `<div class="delta">${delta > 0 ? '+' : delta < 0 ? '−' : ''}${nf(Math.abs(delta), 1)} kg desde el ${fmtDate(first.fecha, { day: 'numeric', month: 'long' })}</div>` : '<div class="delta">Registra tu peso cada pocos días para ver cómo evoluciona.</div>'}
      ${goal}
    </section>

    ${homeTraining()}

    ${M.homeCards()}

    <section class="card">
      <div class="card-head"><h2>Tus objetivos</h2><button class="link" data-act="tab" data-v="perfil">Cambiar</button></div>
      <div class="chips">${(p.objetivos || []).map((id) => { const g = goalById(id); return g ? `<span class="chip">${goalIcon(g, 16)}${g.t}</span>` : ''; }).join('')}</div>
    </section>

    ${installCard(true)}
  `;
}

function installCard(dismissable) {
  if (isStandalone()) return dismissable ? '' : `<section class="card"><h2>App</h2><p>Estás usando ${esc(APP_NAME)} instalada en tu dispositivo.</p></section>`;
  if (dismissable && lsGet('cadencia-install-hide')) return '';
  let inner;
  if (installEvt) {
    inner = `<p>Añádela a tu pantalla de inicio para abrirla como una app, a pantalla completa.</p>
      <button class="btn block" data-act="install">Instalar ${esc(APP_NAME)}</button>`;
  } else if (isIOS()) {
    inner = `<ol>
        <li>Abre esta página en <b>Safari</b>.</li>
        <li>Toca el botón Compartir ${I.share}.</li>
        <li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li>
      </ol>`;
  } else {
    inner = `<ol>
        <li>Abre esta página en <b>Chrome</b>.</li>
        <li>Toca el menú <b>⋮</b> arriba a la derecha.</li>
        <li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li>
      </ol>`;
  }
  return `<section class="card install">
    <div class="card-head"><h2>Instala ${esc(APP_NAME)} en tu móvil</h2>${dismissable ? `<button class="iconbtn" data-act="install-hide" aria-label="Ocultar">${I.close}</button>` : ''}</div>
    ${inner}
  </section>`;
}

/* ---------- pestaña Peso ---------- */
/* ---------- peso saludable ---------- */
// El IMC (18,5–25) sirve de guía, pero no distingue músculo de grasa: a alguien musculado le marca «sobrepeso»
// estando definido. Por eso solo bloqueamos el bajo peso (IMC < 18,5) y lo exagerado (IMC > 32), y si sabemos
// tu % de grasa calculamos el peso ideal a partir de tu masa magra.
const grasaActual = () => { const w = st.weights.slice().reverse().find((x) => x.grasa != null); return w ? { pct: w.grasa, kg: w.kg } : null; };
function rangoPeso(cm, sexo, objetivos, comp) {
  const h = cm / 100;
  if (!(h >= 1.2 && h <= 2.3)) return null;
  const r = (v) => Math.round(v * 2) / 2, mujer = sexo === 'mujer';
  const imcMax = (objetivos || []).includes('musculo') ? 27.5 : 25;
  const out = { min: r(18.5 * h * h), max: r(imcMax * h * h), tope: r(32 * h * h), ideal: r((mujer ? 21.5 : 22.5) * h * h), imcMax, magra: null };
  if (comp && comp.pct > 2 && comp.pct < 60 && comp.kg) {
    const lean = comp.kg * (1 - comp.pct / 100), [lo, mid, hi, esencial] = mujer ? [0.2, 0.23, 0.28, 0.14] : [0.1, 0.13, 0.18, 0.06];
    out.magra = { lo: r(lean / (1 - lo)), ideal: r(lean / (1 - mid)), hi: r(lean / (1 - hi)), minimo: r(lean / (1 - esencial)), pct: comp.pct, mid: mid * 100, rango: [lo * 100, hi * 100] };
    out.ideal = out.magra.ideal;
    out.min = Math.max(out.min, out.magra.minimo);
  }
  return out;
}
function objetivoInvalido(t, cm, sexo, objetivos, comp) {
  if (!isFinite(t)) return 'Escribe el peso objetivo con números, o déjalo vacío.';
  const r = rangoPeso(cm, sexo, objetivos, comp);
  if (!r) return t >= 30 && t <= 250 ? '' : 'El peso objetivo tiene que estar entre 30 y 250 kg.';
  if (r.magra && t < r.magra.minimo) return `Con tu músculo actual, por debajo de ${nf(r.magra.minimo, 1)} kg te quedarías sin la grasa que el cuerpo necesita. Elige ${nf(r.magra.minimo, 1)} kg o más.`;
  if (t < r.min) return `Con ${nf(cm / 100, 2)} m, por debajo de ${nf(r.min, 1)} kg tendrías bajo peso. Elige ${nf(r.min, 1)} kg o más.`;
  if (t > r.tope) return `Con ${nf(cm / 100, 2)} m, ${nf(t, 1)} kg está muy por encima de un peso saludable, incluso con mucho músculo. Elige como mucho ${nf(r.tope, 1)} kg.`;
  return '';
}
// Recomendación discreta de peso objetivo: una sola línea con «Ignorar». Se oculta si ya usas ese peso o si la ignoraste (hideWeightSuggestion).
function pesoGuiaHTML(cm, sexo, objetivos, ctx, comp, actual, oculto) {
  if (oculto) return '';
  const r = rangoPeso(cm, sexo, objetivos, comp);
  if (!r) return '';
  if (isFinite(actual) && actual != null && Math.abs(actual - r.ideal) < 0.05) return '';
  return `<p class="sug small muted" id="sug">Recomendado para ti: <b>${nf(r.ideal, 1)} kg</b> ${r.magra ? '(según tu músculo)' : '(orientativo)'} · <button type="button" class="link" data-act="sug-ignorar" data-ctx="${ctx}">Ignorar</button></p>`;
}

// Guía de peso objetivo en Perfil › Detalles personales. Con «Perder grasa» + «Ganar músculo» marcados es una recomposición corporal
// (OB.pesoRecomp) con botón para usar ese peso; si no, la recomendación de siempre. Lee lo escrito en el formulario (st.pf.f) y los objetivos marcados.
function pfGuiaHTML() {
  const p = st.profile, goals = st.editGoals || p.objetivos || [];
  if (!(goals.includes('perder') && goals.includes('musculo'))) return pesoGuiaHTML(p.alturaCm, p.sexo, goals, 'perfil', grasaActual(), p.pesoObjetivo, p.hideWeightSuggestion === true);
  const g = grasaActual();
  const r = OB.pesoRecomp({ kg: num(pfV('pesoKg', currentKg() || '')), alturaCm: num(pfV('alturaCm', p.alturaCm || '')), sexo: pfV('sexo', p.sexo === 'mujer' ? 'mujer' : 'hombre'),
    edad: CAL.edadDe({ fechaNac: pfV('fechaNac', p.fechaNac || ''), edad: p.edad }), grasaPct: g ? g.pct : null });
  if (!r) return '<p class="sug small muted">Recomposición corporal: rellena estatura, peso y fecha de nacimiento para estimar tu peso objetivo.</p>';
  return OB.recompCardHTML(r, 'recomp-usar');
}
const refrescarGuia = () => { const el = document.getElementById('pf-guia'); if (el && st.pf && st.pf.v === 'detalles') el.innerHTML = pfGuiaHTML(); };

// Ritmo de progreso en Perfil › Detalles personales (solo con «Perder grasa» o «Ganar músculo» marcados). El valor se conserva en st.pf.f.ritmoKgSemana.
const pfRitmoAplica = () => { const g = st.editGoals || st.profile.objetivos || []; return g.includes('perder') || g.includes('musculo'); };
const pfRitmo = () => OB.ritmoDe(pfV('ritmoKgSemana', CAL.ritmoDePerfil(st.profile) || OB.RITMO.def));
// Texto bajo el slider: etiqueta del ritmo + lo que supone en calorías con lo que hay escrito en el formulario (peso, objetivo, objetivos marcados).
function pfRitmoTxt() {
  const p = st.profile, r = pfRitmo(), goals = st.editGoals || p.objetivos || [], kg = num(pfV('pesoKg', currentKg() || '')) || currentKg();
  const obj = num(pfV('pesoObjetivo', p.pesoObjetivo || '')), sexo = pfV('sexo', p.sexo === 'mujer' ? 'mujer' : 'hombre');
  const c = kg ? CAL.resumen({ ...p, sexo, alturaCm: num(pfV('alturaCm', p.alturaCm || '')) || p.alturaCm, fechaNac: pfV('fechaNac', p.fechaNac || '') || p.fechaNac, objetivos: goals, pesoObjetivo: obj > 0 ? obj : null, ritmoKgSemana: r }, kg) : null;
  const dif = !c ? '' : c.modo === 'deficit' ? `<small class="muted">Con este ritmo: unas <b>${nf(c.kcal)} kcal al día</b> (${nf(c.deficit)} menos de lo que gastas).${c.ritmo && (c.deficit * 7) / 7700 < c.ritmo - 0.02 ? ` No bajo de ese mínimo de calorías, así que tu ritmo real será de unos <b>${nf((c.deficit * 7) / 7700, 2)} kg por semana</b>.` : ''}</small>`
    : c.modo === 'superavit' ? `<small class="muted">Con este ritmo: unas <b>${nf(c.kcal)} kcal al día</b> (${nf(c.superavit)} más de lo que gastas).</small>`
    : `<small class="muted">Con tu peso objetivo actual comes lo que gastas, así que el ritmo no cambia tus calorías.</small>`;
  return OB.ritmoInfoHTML(r) + dif;
}
function pfRitmoHTML() {
  if (!pfRitmoAplica()) return '';
  const goals = st.editGoals || st.profile.objetivos || [], r = pfRitmo(), verbo = goals.includes('perder') ? 'perder' : 'ganar';
  return `<div class="field"><span>Ritmo de progreso</span><div class="ritmo ritmo-pf">
      <div class="ritmo-val"><b class="num" id="pf-ritmo-v">${OB.fmtRitmo(r)}</b><span>kg / semana</span></div>
      <input type="range" class="ritmo-rng" name="ritmoKgSemana" min="${OB.RITMO.min}" max="${OB.RITMO.max}" step="${OB.RITMO.step}" value="${r}" style="--p:${OB.ritmoPct(r)}%" aria-label="Ritmo en kilos por semana">
      <div class="ritmo-ticks" aria-hidden="true"><span>0,25</span><span>0,5</span><span>0,75</span><span>1</span></div>
      <div id="pf-ritmo-txt" aria-live="polite">${pfRitmoTxt()}</div></div>
    <small>Cuántos kilos quieres ${verbo} cada semana. Tus calorías diarias se calculan con este ritmo.</small></div>`;
}
const refrescarRitmo = () => { // repinta el bloque entero (al marcar objetivos) o solo el texto (al cambiar peso, estatura…)
  if (!st.pf || st.pf.v !== 'detalles') return;
  const b = document.getElementById('pf-ritmo'); if (b) b.innerHTML = pfRitmoHTML();
};
const refrescarRitmoTxt = () => { const t = document.getElementById('pf-ritmo-txt'); if (t && st.pf && st.pf.v === 'detalles') t.innerHTML = pfRitmoTxt(); };

// Unidad en la que se escribe la composición (grasa, músculo, agua y hueso): '%' del peso o kilos. Se guarda igual que siempre:
// grasa y agua en %, músculo y hueso en kg, así que aquí se convierte según el peso del registro.
const pesoUnit = () => (st.pesoUnit === 'kg' || st.pesoUnit === 'pct' ? st.pesoUnit : (lsGet('cadencia-peso-unit') === 'kg' ? 'kg' : 'pct'));
const r2 = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const PH = { pct: { grasa: 'Ej. 18,5', musculo: 'Ej. 45', agua: 'Ej. 55', hueso: 'Ej. 4' }, kg: { grasa: 'Ej. 14', musculo: 'Ej. 58', agua: 'Ej. 44', hueso: 'Ej. 3,1' } };
const uTxt = (u) => (u === 'pct' ? '%' : 'kg');
// valor guardado → lo que se muestra en la unidad elegida
function aUnidad(c, val, kg, u) {
  if (val == null || !(kg > 0)) return '';
  if (u === 'pct') return r2(c.u === '%' ? val : (val / kg) * 100);
  return r2(c.u === 'kg' ? val : (val / 100) * kg);
}
// lo escrito (en la unidad elegida) → valor que se guarda (grasa/agua en %, músculo/hueso en kg)
function aGuardado(c, n, kg, u) {
  if (u === 'kg' && c.u === '%') return (n / kg) * 100;
  if (u === 'pct' && c.u === 'kg') return (n / 100) * kg;
  return n;
}
// Desglose por zonas (opcional) de las dos métricas que miden las básculas segmentales: músculo y grasa, siempre en kg.
// Alimenta el mapa regional del detalle; sin él, el mapa es una estimación. Se guarda en `regional: { musculo: {tronco, brazoI, …}, grasa: {…} }`.
const RG_MEDIDAS = [{ k: 'musculo', t: 'Músculo' }, { k: 'grasa', t: 'Grasa' }];
const rgCampo = (k, z) => `rg_${k}_${z}`;
function regionalFormHTML(m, ed) {
  const val = ed && ed.regional && ed.regional[m.k], abierto = RG.completo(val);
  return `<details class="rg-det" ${abierto ? 'open' : ''}><summary>${m.t} por zonas (kg) <span class="muted small">opcional</span></summary>
    <p class="small muted">Si tu báscula da el desglose por zonas, apúntalo en kilos. Rellena las 5 o ninguna. Izquierda y derecha son las de tu cuerpo, como en la báscula.</p>
    <div class="rg-grid">${RG.REGIONES.map(({ k, n }) => `<label class="field"><span>${n}</span><input class="input" name="${rgCampo(m.k, k)}" inputmode="decimal" value="${abierto ? esc(nf(val[k], 1)) : ''}" placeholder="0,0"></label>`).join('')}</div>
  </details>`;
}
// Lee los dos desgloses del formulario → { regional } listo para guardar, o { error } con el texto para la persona. `vacio` si no hay ninguno.
function leerRegional(raw, kg) {
  const regional = {};
  for (const m of RG_MEDIDAS) {
    const t = RG.REGIONES.map(({ k }) => String(raw[rgCampo(m.k, k)] || '').trim());
    if (t.every((x) => !x)) continue;
    if (t.some((x) => !x)) return { error: `${m.t} por zonas: rellena las 5 zonas o déjalas todas vacías` };
    const d = {};
    for (let i = 0; i < RG.REGIONES.length; i++) {
      const n = num(t[i]);
      if (!(n > 0 && n <= kg)) return { error: `${m.t} por zonas: ${RG.REGIONES[i].n} tiene que ser un número entre 0 y ${nf(kg, 1)} kg` };
      d[RG.REGIONES[i].k] = Math.round(n * 10) / 10;
    }
    if (Object.values(d).reduce((a, b) => a + b, 0) > kg) return { error: `${m.t} por zonas: la suma de las 5 zonas supera tu peso (${nf(kg, 1)} kg)` };
    regional[m.k] = d;
  }
  return { regional };
}
function pesoFormHTML(ed) {
  const u = pesoUnit(), kgBase = ed ? ed.kg : currentKg();
  return `<form class="form-grid" data-form="addweight" data-kgbase="${kgBase || ''}" ${ed ? `data-edit="${esc(ed.fecha)}"` : ''} novalidate>
        <div class="two">
          <label class="field"><span>Fecha${ed ? ' <span class="muted">(no se cambia al editar)</span>' : ''}</span><input class="input" type="date" name="fecha" value="${ed ? esc(ed.fecha) : todayISO()}" max="${todayISO()}" ${ed ? 'readonly' : ''}></label>
          <label class="field"><span>Peso (kg)</span><input class="input" name="kg" inputmode="decimal" value="${ed ? esc(nf(ed.kg, 1)) : ''}" placeholder="${nf(currentKg(), 1)}"></label>
        </div>
        <div class="comp-box">
          <div class="comp-head"><b>Composición corporal</b> <span class="muted small">(opcional)</span></div>
          <p class="small muted">Si tu báscula o tu centro deportivo te dan estos datos, apúntalos. Elige si los tienes en % del peso o en kilos: nosotros hacemos la conversión.</p>
          <div class="seg" role="group" aria-label="Unidad de la composición">
            <button type="button" data-act="peso-unit" data-v="pct" aria-pressed="${u === 'pct'}">En % del peso</button>
            <button type="button" data-act="peso-unit" data-v="kg" aria-pressed="${u === 'kg'}">En kilos (kg)</button>
          </div>
          <div class="two">
            ${COMP.slice(1).map((c) => `<label class="field"><span>${c.t} (<span data-ulbl>${uTxt(u)}</span>)</span><input class="input" name="${c.k}" inputmode="decimal" data-comp="${c.k}" value="${ed ? esc(aUnidad(c, ed[c.k], ed.kg, u)) : ''}" ${ed && ed[c.k] != null ? `data-orig="${ed[c.k]}"` : ''} placeholder="${PH[u][c.k]}"><small class="muted conv" data-conv="${c.k}"></small></label>`).join('')}
          </div>
          ${RG_MEDIDAS.map((m) => regionalFormHTML(m, ed)).join('')}
        </div>
        <button class="btn block" type="submit">${ed ? 'Guardar cambios' : 'Guardar registro'}</button>
      </form>`;
}
// Texto «≈ …» bajo cada campo con el valor en la otra unidad.
function pesoHints() {
  const f = document.querySelector('form[data-form="addweight"]'); if (!f) return;
  const u = pesoUnit(), kg = num(f.kg.value) || Number(f.dataset.kgbase) || 0;
  for (const c of COMP.slice(1)) {
    const el = f.querySelector(`[data-conv="${c.k}"]`), n = num(f[c.k].value);
    if (!el) continue;
    el.textContent = n > 0 && kg > 0 ? (u === 'pct' ? `≈ ${nf((n / 100) * kg, 1)} kg` : `≈ ${nf((n / kg) * 100, 1)} % de tu peso`) : '';
  }
}
// Cambia % ↔ kg sin perder lo ya escrito: convierte los valores del formulario con el peso que haya puesto.
function cambiarUnidad(u) {
  const prev = pesoUnit(); if (u === prev) return;
  const f = document.querySelector('form[data-form="addweight"]');
  if (f) {
    const kg = num(f.kg.value) || Number(f.dataset.kgbase) || 0;
    for (const c of COMP.slice(1)) {
      const inp = f[c.k], n = num(inp.value);
      if (inp.dataset.orig !== undefined && !inp.dataset.tocado) inp.value = aUnidad(c, Number(inp.dataset.orig), Number(f.dataset.kgbase), u); // sin tocar: se muestra desde lo guardado
      else if (inp.value.trim() && n > 0 && kg > 0) inp.value = r2(prev === 'pct' ? (n / 100) * kg : (n / kg) * 100);
      inp.placeholder = PH[u][c.k];
    }
    f.querySelectorAll('[data-ulbl]').forEach((el) => { el.textContent = uTxt(u); });
    f.querySelectorAll('[data-act="peso-unit"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === u)));
  }
  st.pesoUnit = u; lsSet('cadencia-peso-unit', u);
  pesoHints();
}
// Al editar, los datos de composición que no has tocado se conservan exactamente como estaban guardados.
function keepEdit(f) {
  const keep = {};
  if (f.dataset.edit) for (const c of COMP.slice(1)) { const i = f[c.k]; if (i && i.dataset.orig !== undefined && !i.dataset.tocado) keep[c.k] = Number(i.dataset.orig); }
  return keep;
}
function pesoSheetHTML() {
  const ed = st.pesoEdit ? st.weights.find((w) => w.fecha === st.pesoEdit) : null;
  return `<div class="sheet-back" data-act="peso-sheet-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${ed ? 'Editar registro' : 'Añadir registro'}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="peso-sheet-close" aria-label="Cerrar">${I.back}</button><h2>${ed ? 'Editar registro' : 'Añadir registro'}</h2><span style="width:36px"></span></div>
      <div class="sheet-list">${pesoFormHTML(ed)}</div>
    </div>`;
}

/* ---------- historial de registros (se abre con el icono de arriba a la derecha) ---------- */
const compTxt = (w) => COMP.slice(1).filter((c) => w[c.k] != null).map((c) => `${c.t} ${nf(w[c.k], 1)} ${c.u}`).join(' · ');
function pesoHistSheetHTML() {
  const rows = st.weights.slice().reverse(), mod = !!st.pesoMod;
  return `<div class="sheet-back" data-act="peso-hist-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Historial de registros">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="peso-hist-close" aria-label="Cerrar">${I.back}</button><h2>Historial de registros</h2>
        ${rows.length ? `<button type="button" class="link" data-act="peso-hist-mod">${mod ? 'Listo' : 'Modificar'}</button>` : '<span style="width:36px"></span>'}</div>
      <div class="sheet-list">${rows.length ? `<div class="list">${rows.map((w, i) => {
        const prev = rows[i + 1], dd = prev ? w.kg - prev.kg : null, ct = compTxt(w);
        return `<div class="row"><span>${esc(fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}${ct ? `<br><span class="muted small">${esc(ct)}</span>` : ''}</span>
          <span class="hrow-r"><span class="muted small">${dd == null ? '' : (dd > 0 ? '+' : dd < 0 ? '−' : '±') + nf(Math.abs(dd), 1)}</span><b class="nowrap">${nf(w.kg, 1)} kg</b>
          ${mod ? `<button type="button" class="iconbtn" data-act="w-edit" data-v="${esc(w.fecha)}" aria-label="Editar el registro del ${esc(w.fecha)}">${I.pencil}</button><button type="button" class="iconbtn bad" data-act="w-del-ask" data-v="${esc(w.fecha)}" aria-label="Borrar el registro del ${esc(w.fecha)}">${I.trash}</button>` : ''}</span></div>`;
      }).join('')}</div>` : '<div class="empty">Sin registros todavía.</div>'}</div>
    </div>`;
}
function pesoDelSheetHTML() {
  const w = st.weights.find((x) => x.fecha === st.pesoDel);
  return `<div class="sheet-back" data-act="w-del-no"></div>
    <div class="sheet short" role="alertdialog" aria-modal="true" aria-label="Borrar registro">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="w-del-no" aria-label="Cancelar">${I.back}</button><h2>Borrar registro</h2><span style="width:36px"></span></div>
      <div class="sheet-list form-grid">
        <p>¿Borrar el registro del <b>${esc(w ? fmtDate(w.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '')}</b>${w ? ` (${nf(w.kg, 1)} kg)` : ''}?</p>
        <p class="small muted">Se borra de tu cuenta, con su composición corporal. No se puede deshacer.</p>
        <button type="button" class="btn block danger-solid" data-act="w-del-yes">Borrar registro</button>
        <button type="button" class="btn ghost block" data-act="w-del-no">Cancelar</button>
      </div>
    </div>`;
}

/* ---------- gráfica y composición corporal ---------- */
const COMP = [
  { k: 'kg', t: 'Peso', u: 'kg', d: 1 },
  { k: 'grasa', t: 'Grasa', u: '%', d: 1, lo: 3, hi: 60 },
  { k: 'musculo', t: 'Músculo', u: 'kg', d: 1, lo: 10, hi: 100 },
  { k: 'agua', t: 'Agua', u: '%', d: 1, lo: 30, hi: 75 },
  { k: 'hueso', t: 'Hueso', u: 'kg', d: 1, lo: 1, hi: 6 },
];
function chart(points, target, label = 'Evolución del peso', dec = 0) {
  if (points.length < 2) return '';
  const W = 340, H = 150, P = { l: 30, r: 8, t: 10, b: 22 };
  const ys = points.map((p) => p.kg).concat(target ? [target] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
  lo = Math.floor(lo - .3); hi = Math.ceil(hi + .3);
  const t0 = new Date(points[0].fecha).getTime(), t1 = new Date(points[points.length - 1].fecha).getTime();
  const x = (f) => P.l + ((new Date(f).getTime() - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.fecha).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points[points.length - 1].fecha).toFixed(1)} ${H - P.b} L${P.l} ${H - P.b} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map((t) => `<line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${nf(t, dec)}</text>`).join('')}
    ${target ? `<line class="tg" x1="${P.l}" x2="${W - P.r}" y1="${y(target)}" y2="${y(target)}"/>` : ''}
    <path class="ar" d="${area}"/><path class="ln" d="${d}"/>
    ${points.length <= 40 ? points.map((p) => `<circle class="dot" r="3.5" cx="${x(p.fecha)}" cy="${y(p.kg)}"/>`).join('') : ''}
    <text x="${P.l}" y="${H - 4}">${fmtDate(points[0].fecha)}</text>
    <text x="${W - P.r}" y="${H - 4}" text-anchor="end">${fmtDate(points[points.length - 1].fecha)}</text>
  </svg>`;
}

// ---------- Progreso → Peso: dial, rejilla 2×2 con siluetas y vista de detalle ----------
const sgn = (d) => (d > 0 ? '+' : d < 0 ? '−' : '±');
const pctOf = (c, w) => (c.u === '%' ? w[c.k] : w.kg ? (w[c.k] / w.kg) * 100 : null);
const kgOf = (c, w) => (c.u === 'kg' ? w[c.k] : w.kg ? (w.kg * w[c.k]) / 100 : null);

// Mapa regional de una métrica (músculo, grasa, agua, hueso) en un pesaje: 5 zonas (centro, brazos, piernas) con el color de la métrica
// y la opacidad según cuánto pesa cada una frente a su ideal. Si el pesaje trae el desglose de la báscula (`w.regional[métrica]`, kg por zona)
// se usa; si no, se estima repartiendo el total con proporciones típicas (y la tarjeta lo avisa).
function regionalDe(c, w) {
  const sexo = st.profile && st.profile.sexo === 'mujer' ? 'mujer' : 'hombre', total = w ? kgOf(c, w) : null;
  if (total == null || !isFinite(total)) return { tipo: c.k, sexo };
  const real = w.regional && w.regional[c.k], medido = RG.completo(real);
  const datos = medido ? real : RG.repartoEstimado(total, sexo, c.k);
  return { tipo: c.k, sexo, medido, datos, ideal: RG.idealPara({ datos, medido, total, kgCuerpo: w.kg, sexo, tipo: c.k }) };
}

// Maniquí 3D que se llena de abajo arriba con el % indicado (el relieve sale de la imagen; el color, de la métrica: agua, músculo, grasa, hueso).
// Capas: fondo gris apagado · color liso recortado con la forma del cuerpo · la misma imagen en gris multiplicada encima (da el relieve).
// Se usa cuando el pesaje NO trae kg por zona; con el desglose por zonas se pinta el mapa regional (`RG`).
function silueta(fill, k, cls = '') {
  const f = Math.max(0, Math.min(100, fill == null ? 0 : fill)), src = `/models/maniqui-${st.profile && st.profile.sexo === 'mujer' ? 'mujer' : 'hombre'}-1.png`;
  return `<span class="metric-mannequin m-${k} ${cls}" style="--fill:${f.toFixed(1)}%;--mq:url(${src})" role="img" aria-hidden="true">
    <img class="mannequin-bg" src="${src}" alt="" draggable="false" decoding="async">
    <span class="mannequin-fill-container"><span class="mannequin-color"></span><img class="mannequin-relief" src="${src}" alt="" draggable="false" decoding="async"></span>
  </span>`;
}

// Cabecera común: con kg por zona (`medido`) → mapa regional; si no → el maniquí que se llena de pies a cabeza con el %.
const figuraComp = (c, w, p, compacto) => {
  const rg = w ? regionalDe(c, w) : null;
  return rg && rg.medido ? RG.mapaHTML({ ...rg, compacto }) : silueta(p == null ? 0 : Math.max(p, compacto ? 6 : 4), c.k, compacto ? '' : 'big');
};

// Dial semicircular con el peso actual en el centro.
function dialPeso(ws, objetivo) {
  const cur = ws.length ? ws[ws.length - 1].kg : null, prev = ws.length > 1 ? ws[ws.length - 2].kg : null;
  const vals = ws.map((w) => w.kg).concat(objetivo ? [objetivo] : []);
  let lo = vals.length ? Math.floor(Math.min(...vals)) - 2 : 60, hi = vals.length ? Math.ceil(Math.max(...vals)) + 2 : 100;
  if (hi - lo < 8) { const m = (hi + lo) / 2; lo = Math.floor(m - 4); hi = lo + 8; }
  const fr = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const pt = (f, r) => [(120 - r * Math.cos(Math.PI * f)).toFixed(1), (120 - r * Math.sin(Math.PI * f)).toFixed(1)];
  const ticks = Array.from({ length: 21 }, (_, i) => { const a = pt(i / 20, i % 5 ? 82 : 78), b = pt(i / 20, 88); return `<line class="${i % 5 ? 'tk' : 'tk big'}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }).join('');
  const g = objetivo ? (() => { const a = pt(fr(objetivo), 90), b = pt(fr(objetivo), 118); return `<line class="goal" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; })() : '';
  const dd = cur != null && prev != null ? cur - prev : null;
  return `<section class="dial" aria-label="Peso actual">
    <svg viewBox="0 0 240 150" role="img" aria-label="${cur != null ? `Peso actual ${nf(cur, 1)} kilos` : 'Sin peso registrado'}">
      <defs><linearGradient id="dialg" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="220" y2="0"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#F2BE1A"/></linearGradient></defs>
      <path class="trk" d="M20 120A100 100 0 0 1 220 120" pathLength="100"/>
      ${cur != null ? `<path class="val-arc" d="M20 120A100 100 0 0 1 220 120" pathLength="100" stroke-dasharray="${(fr(cur) * 100).toFixed(1)} 100"/>` : ''}
      ${ticks}${g}
      <text class="sc" x="20" y="142" text-anchor="middle">${lo}</text><text class="sc" x="220" y="142" text-anchor="middle">${hi}</text>
    </svg>
    <div class="dial-c"><span class="lbl">Peso actual</span><b class="num">${cur != null ? nf(cur, 1) : '—'}<em>kg</em></b>
      <span class="sub">${dd != null ? `${sgn(dd)}${nf(Math.abs(dd), 1)} kg vs. anterior` : cur != null ? 'Primer registro' : 'Apunta tu primer peso'}${objetivo ? ` · <i>objetivo ${nf(objetivo, 1)} kg</i>` : ''}</span></div>
  </section>`;
}

// Rejilla 2×2: cada celda es un botón que abre el detalle.
function compCardHTML(ws) {
  const ord = ['agua', 'musculo', 'grasa', 'hueso'].map((k) => COMP.find((c) => c.k === k));
  return `<div class="cgrid">${ord.map((c) => {
    const con = ws.filter((w) => w[c.k] != null);
    if (!con.length) return `<button type="button" class="cg" data-act="comp-ver" data-v="${c.k}"><span class="label">${c.t}</span>${silueta(0, c.k)}<span class="val num">—</span><span class="hint">Sin datos todavía</span></button>`;
    const last = con[con.length - 1], p = pctOf(c, last), k = kgOf(c, last);
    const sec = c.u === '%' ? (k != null ? `≈ ${nf(k, 1)} kg` : '') : (p != null ? `${nf(p, 1)} % del peso` : '');
    return `<button type="button" class="cg" data-act="comp-ver" data-v="${c.k}"><span class="label">${c.t}</span>${figuraComp(c, last, p, true)}
      <span class="val num">${nf(last[c.k], 1)}<em>${c.u}</em></span><span class="hint">${sec}</span></button>`;
  }).join('')}</div>`;
}

// Vista de detalle de una métrica: silueta grande y selector kg / % / qué cambió.
function pesoDetalleHTML() {
  const c = COMP.find((x) => x.k === st.pesoComp) || COMP[1], modo = st.pesoModo || 'kg';
  const con = st.weights.filter((w) => w[c.k] != null), last = con[con.length - 1], prev = con.length > 1 ? con[con.length - 2] : null;
  const back = `<div class="det-top"><button type="button" class="iconbtn" data-act="comp-close" aria-label="Volver">${I.back}</button>
    <label class="det-sel"><span class="sr">Métrica</span><select data-comp-sel aria-label="Cambiar de métrica">${['agua', 'musculo', 'grasa', 'hueso'].map((k) => { const m = COMP.find((x) => x.k === k); return `<option value="${k}" ${m.k === c.k ? 'selected' : ''}>${esc(m.t)}</option>`; }).join('')}</select></label><span style="width:36px"></span></div>`;
  if (!last) return `<section class="det">${back}<div class="empty"><b>Aún no hay datos de ${esc(c.t.toLowerCase())}</b><span>Apúntalos con «Añadir registro» y verás aquí el detalle.</span></div></section>`;
  const p = pctOf(c, last), k = kgOf(c, last);
  const dk = prev && kgOf(c, prev) != null && k != null ? k - kgOf(c, prev) : null, dp = prev && pctOf(c, prev) != null && p != null ? p - pctOf(c, prev) : null;
  const dir = (d) => (d == null || Math.abs(d) < 0.05 ? 'neu' : (c.k === 'grasa' ? d < 0 : d > 0) ? 'up' : 'down'); // verde = bien, rojo = mal
  let top = '', sub = '';
  if (modo === 'kg') { top = `${k != null ? nf(k, 1) : '—'}<em>kg</em>`; sub = `${esc(c.t)} · ${esc(fmtDate(last.fecha, { day: 'numeric', month: 'long' }))}`; }
  else if (modo === 'pct') { top = `${p != null ? nf(p, 1) : '—'}<em>%</em>`; sub = `del peso total de ese día (${nf(last.kg, 1)} kg)`; }
  else if (dk == null && dp == null) { top = '—'; sub = 'Aún no hay un registro anterior con este dato para comparar.'; }
  else {
    top = `<span class="chg ${dir(dk != null ? dk : dp)}">${dk != null ? `${sgn(dk)}${nf(Math.abs(dk), 1)}<em>kg</em>` : ''}</span>`;
    sub = `<span class="chg ${dir(dp != null ? dp : dk)} small">${dp != null ? `${sgn(dp)}${nf(Math.abs(dp), 1)} %` : ''}</span> desde el ${esc(fmtDate(prev.fecha, { day: 'numeric', month: 'long' }))}`;
  }
  return `<section class="det">${back}
    <div class="det-val num">${top}</div><p class="det-sub">${sub}</p>
    ${(() => { const rg = regionalDe(c, last); return rg.medido
      ? `<div class="det-sil">${RG.tarjetaHTML({ ...rg, titulo: `Mapa regional de ${c.t.toLowerCase()}` })}</div>`
      : `<div class="det-sil">${silueta(p == null ? 0 : Math.max(p, 4), c.k, 'big')}</div>${RG_MEDIDAS.some((m) => m.k === c.k) ? `<p class="det-zonas">Sin desglose por zonas. Apúntalo en «Añadir registro» (Músculo o Grasa por zonas) para ver aquí dónde se concentra.</p>` : ''}`; })()}
    <div class="seg" role="group" aria-label="Forma de verlo">${[['kg', 'En kilogramos'], ['pct', 'Como porcentaje'], ['cambio', '¿Qué cambió?']].map(([v, t]) => `<button type="button" data-act="comp-modo" data-v="${v}" aria-pressed="${modo === v}">${t}</button>`).join('')}</div>
  </section>`;
}

function viewPeso(sub = false) {
  const ws = st.weights, p = st.profile;
  if (st.pesoComp) return pesoDetalleHTML();
  return `
    ${sub ? '' : `<header class="hello"><div><h1>Peso</h1><p>${ws.length} ${ws.length === 1 ? 'registro' : 'registros'}${p.pesoObjetivo ? ` · objetivo ${nf(p.pesoObjetivo, 1)} kg` : ''}</p></div></header>`}
    ${dialPeso(ws, p.pesoObjetivo)}
    ${compCardHTML(ws)}
    ${sub ? recuperacionHTML() : ''}
    ${sub ? imcGastoHTML() : ''}
    <div class="fab-space" aria-hidden="true"></div>
    <button type="button" class="fab" data-act="peso-sheet">${I.plus} Añadir registro</button>`;
}

// IMC y gasto en reposo: abajo del todo de Forma física.
function imcGastoHTML() {
  const kg = currentKg(), p = st.profile, v = imc(kg, p.alturaCm), b = bmr({ ...p, pesoKg: kg });
  return `<div class="stats">
    <section class="stat">
      <span class="label">IMC</span>
      <span class="val num">${nf(v, 1)}</span>
      <span><span class="tag ${imcLabel(v) === 'Normal' ? 'ok' : ''}">${imcLabel(v)}</span></span>
    </section>
    <section class="stat">
      <span class="label">Gasto en reposo</span>
      <span class="val num">${nf(b)}<em>kcal</em></span>
      <span class="hint">Lo que quema tu cuerpo al día sin moverte.</span>
    </section>
  </div>`;
}

// comp: { grasa, musculo, agua, hueso } como texto (opcionales), escritos en la unidad `unit` ('pct' o 'kg').
// Se convierten con el peso del registro y se guardan como siempre: grasa y agua en %, músculo y hueso en kg.
async function saveWeight(fecha, raw, comp = {}, unit = 'pct', editando = false, keep = {}, zonasRaw = {}) {
  const kg = num(raw);
  if (!(kg >= 30 && kg <= 250)) { toast('Escribe un peso entre 30 y 250 kg'); return false; }
  if (!fecha || fecha > todayISO()) { toast('Elige una fecha de hoy o anterior'); return false; }
  const v = Math.round(kg * 10) / 10;
  const extra = {};
  for (const c of COMP.slice(1)) {
    const t = String(comp[c.k] || '').trim();
    if (!t) continue;
    if (editando && keep[c.k] != null) { extra[c.k] = keep[c.k]; continue; } // no lo has tocado: se queda tal cual estaba guardado
    const n = num(t);
    if (!(n > 0)) { toast(`${c.t}: escribe un número`); return false; }
    const val = Math.round(aGuardado(c, n, v, unit) * 10) / 10;
    if (!(val >= c.lo && val <= c.hi)) {
      const mismaUnidad = (unit === 'pct') === (c.u === '%');
      toast(mismaUnidad ? `${c.t}: escribe un valor entre ${c.lo} y ${c.hi} ${c.u}` : `${c.t}: ${nf(n, 1)} ${uTxt(unit)} con ${nf(v, 1)} kg son ${nf(val, 1)} ${c.u}; tiene que estar entre ${c.lo} y ${c.hi} ${c.u}`);
      return false;
    }
    extra[c.k] = val;
  }
  if (extra.musculo && extra.musculo >= v) { toast('El músculo tiene que ser menor que tu peso'); return false; }
  const rz = leerRegional(zonasRaw, v);
  if (rz.error) { toast(rz.error); return false; }
  if (Object.keys(rz.regional).length) extra.regional = rz.regional;
  try {
    if (editando) await api.setWeight(st.user.uid, fecha, v, extra); else await api.addWeight(st.user.uid, fecha, v, extra);
    st.weights = await api.listWeights(st.user.uid);
    const last = latestWeight();
    if (last) { const d = { pesoKg: last.kg, calorias: CAL.resumen({ ...st.profile, pesoKg: last.kg }, last.kg) }; await api.saveProfile(st.user.uid, d); Object.assign(st.profile, d); }
    st.pesoSheet = false; st.pesoEdit = null; render();
    toast(editando ? 'Registro actualizado' : Object.keys(extra).length ? 'Peso y composición guardados' : 'Peso guardado');
    return true;
  } catch (e) { toast(errorText(e)); return false; }
}

async function delWeight(fecha) {
  if (st.weights.length <= 1) { toast('Necesitas al menos un registro de peso'); return; }
  try {
    await api.deleteWeight(st.user.uid, fecha);
    st.weights = await api.listWeights(st.user.uid);
    const last = latestWeight();
    if (last) { const d = { pesoKg: last.kg, calorias: CAL.resumen({ ...st.profile, pesoKg: last.kg }, last.kg) }; await api.saveProfile(st.user.uid, d); Object.assign(st.profile, d); }
    st.pesoDel = null; render(); toast('Registro borrado');
  } catch (e) { st.pesoDel = null; toast(errorText(e)); render(); }
}

/* ---------- pestaña Perfil ---------- */
const listaTxt = (pr) => (pr && pr.interesPro === true ? 'Estás en la lista PRO' : 'Ver Cadencia PRO');
function planCardHTML() {
  const pr = st.profile || {}, pro = pr.isPro === true;
  const dia = (ms) => fmtDate(new Date(ms).toISOString().slice(0, 10));
  const regalo = proRegalo(pr);
  const renueva = regalo ? `Tu PRO de regalo (referidos) dura hasta el <b>${dia(regalo)}</b>.` : pro && pr.proRenueva ? (pr.proCancela ? `Tu suscripción está cancelada: sigues con Pro hasta el <b>${dia(pr.proRenueva)}</b>.` : `Próxima renovación: <b>${dia(pr.proRenueva)}</b>.`) : '';
  if (!pro) return `<section class="card" id="plan-card">
      <div class="card-head"><h2>Tu plan</h2><span class="tag" id="plan-tag">Gratuita</span></div>
      <p class="small muted">${PAGOS_ACTIVOS ? 'El registro manual, las rutinas y el resto de la app son gratis. Con Pro desbloqueas la IA: Escanear alimento y el Coach AI.' : 'Estás en la beta abierta: todo es gratis por ahora. Cadencia PRO llegará más adelante con más ajustes de IA y el Coach AI ampliado.'}</p>
      <button class="btn block" data-act="pro-open" data-v="perfil">${PAGOS_ACTIVOS ? 'Hazte Pro' : listaTxt(pr)}</button>
    </section>`;
  return `<section class="card" id="plan-card">
      <div class="card-head"><h2>Tu plan</h2><span class="tag ok" id="plan-tag">Pro</span></div>
      <p><b>Cadencia Pro</b></p>
      <p class="small muted">Incluye Escanear alimento, el Coach AI y 10 consultas de IA al día. ${renueva}</p>
    </section>`;
}

const fotoHTML = (big = false) => {
  const p = st.profile || {}, n = (p.nombreCompleto || p.nombre || st.user.name || '?').trim();
  return `<span class="avatar ${big ? 'big' : ''}">${p.fotoUrl ? `<img src="${esc(p.fotoUrl)}" alt="Tu foto de perfil">` : esc(n.charAt(0).toUpperCase())}</span>`;
};
const tieneGoogle = () => { try { return api.providers().includes('google.com'); } catch (e) { return false; } };
const tienePass = () => { try { return api.providers().includes('password'); } catch (e) { return true; } };

/* ---------- Perfil: lista de ajustes y una vista (hoja) por apartado ---------- */
const PF_IC = {
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2M16 7l3 3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/>',
  mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
};
const pfIc = (k) => `<svg class="pf-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PF_IC[k]}</svg>`;
// Fila de la lista: botón (act/v) o enlace (href). val = texto gris a la derecha.
const pfRow = (ic, t, { act, v = '', href, val = '', cls = '', tag = '' } = {}) => {
  const inner = `${pfIc(ic)}<span class="pf-t">${t}</span>${val ? `<span class="pf-v">${esc(val)}</span>` : ''}${tag}${act || href ? I.chev : ''}`;
  return href ? `<a class="pf-row ${cls}" href="${href}">${inner}</a>`
    : act ? `<button type="button" class="pf-row ${cls}" data-act="${act}" data-v="${v}">${inner}</button>`
    : `<div class="pf-row ${cls}">${inner}</div>`;
};
const pfGrupo = (t, filas) => `<section class="pf-group"><h3 class="pf-title">${t}</h3><div class="pf-list">${filas.join('')}</div></section>`;

function viewPerfil() {
  const p = st.profile;
  const idioma = p.idioma === 'en' ? 'English' : 'Español', tema = { dark: 'Oscuro', light: 'Claro', system: 'Sistema' }[themePref()];
  return `
    <header class="perfil-hero">${fotoHTML(true)}
      <h2 class="pf-user">${p.usuario ? `@${esc(p.usuario)}` : esc((p.nombreCompleto || p.nombre || st.user.name || 'Tu perfil').trim())}</h2>
      ${p.isPro === true ? `<span class="pro-badge">${I.crown} PRO</span>` : ''}
      <p class="small muted">${esc(st.user.email || '')}</p>
      ${betaTagHTML()}
      <button type="button" class="btn ghost small" data-act="pf-open" data-v="editar">Editar perfil</button></header>
    ${planCardHTML()}
    ${pfGrupo('Cuenta', [
      pfRow('gift', 'Invita a tus amigos', { act: 'pf-open', v: 'referidos', val: `${Math.min(REF_MAX, Number(p.referidos) || 0)}/${REF_MAX}` }),
      pfRow('crown', 'Administrar suscripción', { act: 'pf-open', v: 'suscripcion', val: p.isPro === true ? 'PRO' : 'Gratuita' }),
      pfRow('user', 'Detalles personales', { act: 'pf-open', v: 'detalles' }),
      pfRow('sliders', 'Preferencias', { act: 'pf-open', v: 'prefs', val: tema }),
      pfRow('globe', 'Idioma', { act: 'pf-open', v: 'idioma', val: idioma }),
      CICLISMO ? pfRow('link', 'Integraciones', { act: 'pf-open', v: 'integraciones', val: S.conectado() ? 'Strava' : '' }) : '',
      tienePass() ? pfRow('key', 'Modificar contraseña', { act: 'pwd-open' }) : '',
      tieneGoogle() ? pfRow('link', 'Cuenta de Google', { tag: '<span class="tag ok">Vinculada</span>' }) : pfRow('link', 'Vincular cuenta de Google', { act: 'google-link' }),
    ])}
    ${pfGrupo('Soporte', [
      pfRow('zap', 'Solicitar una función', { act: 'pf-open', v: 'func' }),
      pfRow('mail', 'Correo de soporte', { href: `mailto:${CONTACTO}?subject=${encodeURIComponent('Soporte Cadencia')}` }),
      pfRow('help', 'FAQ', { act: 'pf-open', v: 'faq' }),
    ])}
    ${pfGrupo('Acciones de la cuenta', [
      pfRow('out', 'Cerrar sesión', { act: 'logout', cls: 'mute' }),
      pfRow('trash', 'Eliminar cuenta', { act: 'del-open', cls: 'danger' }),
    ])}
    <p class="small muted pf-foot">${api.mode === 'firebase' ? 'Tus datos se guardan en la nube y los verás en cualquier dispositivo.' : 'Modo prueba: tus datos se guardan solo en este dispositivo.'}</p>
    ${legalLinksHTML('pf-legal')}`;
}

const PF_TITULO = { referidos: 'Invita a tus amigos', editar: 'Editar perfil', detalles: 'Detalles personales', prefs: 'Preferencias', idioma: 'Idioma', suscripcion: 'Administrar suscripción', integraciones: 'Integraciones', func: 'Solicitar una función', faq: 'Preguntas frecuentes' };
const pfV = (k, d) => (st.pf.f && k in st.pf.f ? st.pf.f[k] : d); // lo escrito se conserva si la hoja se redibuja (p. ej. tras cambiar la foto)

// «Guardar» solo se activa cuando algún valor es distinto del que había al abrir la hoja.
const pfCambios = () => { const P = st.pf, g = (x) => JSON.stringify([...(x || [])].sort()); return !!P.ini && (Object.keys(P.f).some((k) => k in P.ini && P.f[k] !== P.ini[k]) || (P.v === 'detalles' && !!st.editGoals && g(st.editGoals) !== g(st.profile.objetivos))); };
const pfGuardarBtn = () => `<button class="btn block" type="submit" id="pf-save" ${st.pf.busy ? 'disabled' : pfCambios() ? '' : 'disabled'}>${st.pf.busy ? '<span class="spinner"></span>' : 'Guardar'}</button>`;
const pfBtn = () => { const b = document.getElementById('pf-save'); if (b && st.pf && !st.pf.busy) b.disabled = !pfCambios(); };

function pfCuerpo(v) {
  const p = st.profile;
  if (v === 'referidos') return referidosSheetHTML();
  if (v === 'editar') {
    const [nom, ape] = nomApe(p);
    st.pf.ini = { nombre: nom, apellidos: ape, usuario: p.usuario || '' };
    return `<form class="sheet-list form-grid" data-form="pf-editar" novalidate>
      <div class="pf-foto">${fotoHTML(true)}<label class="btn ghost small"><input type="file" accept="image/*" data-foto hidden>Cambiar foto</label></div>
      <label class="field"><span>Nombre</span><input class="input" name="nombre" value="${esc(pfV('nombre', nom))}" autocomplete="given-name" maxlength="40"></label>
      <label class="field"><span>Apellidos</span><input class="input" name="apellidos" value="${esc(pfV('apellidos', ape))}" autocomplete="family-name" maxlength="60"></label>
      <label class="field"><span>Nombre de usuario</span><input class="input" name="usuario" value="${esc(pfV('usuario', p.usuario || ''))}" autocapitalize="none" autocomplete="username" maxlength="20" placeholder="ej. jean_ramirez"><small>Letras, números, _ y -, sin espacios.</small></label>
      ${pfGuardarBtn()}</form>`;
  }
  if (v === 'detalles') {
    const goals = st.editGoals || p.objetivos || [], sexo = pfV('sexo', p.sexo === 'mujer' ? 'mujer' : 'hombre'), kg = currentKg();
    st.pf.ini = { alturaCm: String(p.alturaCm || ''), pesoKg: kg ? nf(kg, 1) : '', fechaNac: p.fechaNac || '', sexo: p.sexo === 'mujer' ? 'mujer' : 'hombre', pesoObjetivo: p.pesoObjetivo ? nf(p.pesoObjetivo, 1) : '', ritmoKgSemana: String(OB.ritmoDe(CAL.ritmoDePerfil(p) || OB.RITMO.def)) };
    return `<form class="sheet-list form-grid" data-form="pf-det" novalidate>
      <div class="two">
        <label class="field"><span>Estatura (cm)</span><input class="input" name="alturaCm" inputmode="numeric" value="${esc(pfV('alturaCm', p.alturaCm || ''))}"></label>
        <label class="field"><span>Peso actual (kg)</span><input class="input" name="pesoKg" inputmode="decimal" value="${esc(pfV('pesoKg', kg ? nf(kg, 1) : ''))}"></label>
      </div>
      <label class="field"><span>Fecha de nacimiento${p.fechaNac ? '' : p.edad ? ` (ahora: ${esc(p.edad)} años)` : ''}</span><input class="input" type="date" name="fechaNac" max="${todayISO()}" value="${esc(pfV('fechaNac', p.fechaNac || ''))}"></label>
      <div class="field"><span>Género</span>
        <div class="seg" role="group" aria-label="Género">
          <button type="button" data-act="psex" data-v="hombre" aria-pressed="${sexo === 'hombre'}">Hombre</button>
          <button type="button" data-act="psex" data-v="mujer" aria-pressed="${sexo === 'mujer'}">Mujer</button>
        </div><input type="hidden" name="sexo" value="${sexo}">
      </div>
      <label class="field"><span>Peso objetivo (kg)</span><input class="input" name="pesoObjetivo" inputmode="decimal" value="${esc(pfV('pesoObjetivo', p.pesoObjetivo ? nf(p.pesoObjetivo, 1) : ''))}" placeholder="Opcional"></label>
      <div class="field"><span>Objetivos</span><div class="choices">${GOALS.map((g) => `<button type="button" class="choice" data-act="pgoal" data-v="${g.id}" aria-pressed="${goals.includes(g.id)}">
        <span class="ico">${goalIcon(g)}</span><span class="t">${g.t}</span><span class="tick">${goals.includes(g.id) ? I.check : ''}</span></button>`).join('')}</div></div>
      <div id="pf-guia">${pfGuiaHTML()}</div>
      <div id="pf-ritmo">${pfRitmoHTML()}</div>
      ${pfGuardarBtn()}</form>`;
  }
  if (v === 'prefs') {
    const t = themePref();
    return `<div class="sheet-list"><section class="card"><h2>Apariencia</h2>
      <div class="seg" role="group" aria-label="Tema">${[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Sistema']].map(([k, l]) => `<button type="button" data-act="theme" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div>
      <p class="small muted">${t === 'system' ? 'Sigue el modo claro u oscuro de tu móvil.' : t === 'light' ? 'Fondo claro con el mismo amarillo.' : 'Negro y amarillo, el estilo de Cadencia.'}</p></section></div>`;
  }
  if (v === 'suscripcion') return suscripcionHTML();
  if (v === 'integraciones' && CICLISMO) return `<div class="sheet-list">${S.integracionesHTML()}</div>`;
  if (v === 'idioma') {
    const l = p.idioma === 'en' ? 'en' : 'es';
    return `<div class="sheet-list"><div class="pf-list">${[['es', 'Español'], ['en', 'English']].map(([k, n]) => `<button type="button" class="pf-row" data-act="pf-idioma" data-v="${k}"><span class="pf-t">${n}</span>${l === k ? `<span class="pf-ok">${I.check}</span>` : ''}</button>`).join('')}</div>
      <p class="small muted">Cadencia por ahora solo está traducida al español. Guardamos tu elección para activar el inglés en cuanto esté lista.</p></div>`;
  }
  if (v === 'func') {
    return `<form class="sheet-list form-grid" data-form="pf-func" novalidate>
      <label class="field"><span>¿Qué te gustaría que hiciera Cadencia?</span><textarea class="input" name="texto" rows="6" maxlength="1000" placeholder="Cuéntanos tu idea…">${esc(pfV('texto', ''))}</textarea></label>
      <button class="btn block" type="submit" ${st.pf.busy ? 'disabled' : ''}>${st.pf.busy ? '<span class="spinner"></span>' : 'Enviar'}</button>
      <a class="small muted" href="mailto:${CONTACTO}?subject=${encodeURIComponent('Idea para Cadencia')}">O envíanosla por correo</a></form>`;
  }
  if (v === 'faq') {
    const Q = [['¿Cómo registro mi peso?', 'En Forma física, pulsa «Añadir registro». También puedes cambiarlo en Perfil → Detalles personales.'],
      ['¿Cómo se calcula la recuperación muscular?', 'Al entrenar un músculo baja a 0–20 % según las series, y se recupera en torno a un 33 % cada 24 horas hasta el 100 % a las 72 horas.'],
      ['¿Cómo cancelo Cadencia Pro?', 'Desde Perfil → Administrar suscripción, con «Gestionar suscripción». Seguirás con Pro hasta que termine el periodo pagado.'],
      ['¿Mis datos son privados?', 'Solo tú puedes verlos en la app, y no los vendemos ni los usamos para publicidad. Las funciones de IA envían solo lo necesario a sus proveedores (detalles en Privacidad, al final de Perfil). Puedes borrar todo cuando quieras con «Eliminar cuenta».']];
    return `<div class="sheet-list">${Q.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p class="small muted">${a}</p></details>`).join('')}</div>`;
  }
  return '';
}
const PLANES = [
  { id: 'mensual', n: 'PRO Mensual', precio: '4,99 €', nota: 'Facturado mensualmente' },
  { id: 'anual', n: 'PRO Anual', precio: '39,99 €', nota: 'Facturado anualmente' },
  { id: 'siempre', n: 'PRO Para Siempre', precio: '89,99 €', nota: 'Pago único' },
];
// Tabla comparativa Gratis vs Pro. true = ✓, false = ✗, texto = tal cual.
// [función, gratis, pro, descripción corta]
const COMPARATIVA = [
  ['Registrar entrenamientos', true, true, 'Apunta series, kilos y repeticiones'],
  ['Crear rutinas', '3', 'Ilimitadas', 'Guarda tus propios planes de entreno'],
  ['Escáner IA de alimentos', '1/día', 'Ilimitado', 'Calcula calorías y macros desde una foto'],
  ['Mapa de Fatiga', false, true, 'Ve qué músculos están listos para entrenar'],
  ['Modo Bestia', false, true, 'RIR, drop-sets y superseries en tus series'],
  ['Calculadora de Calentamiento', false, true, 'Series de aproximación hasta tu peso de trabajo'],
];
const cmpCelda = (v) => v === true ? `<span class="cmp-y" role="img" aria-label="Incluido">${I.check}</span>` : v === false ? `<span class="cmp-n" role="img" aria-label="No incluido">${I.no}</span>` : `<span class="cmp-t">${v}</span>`;
const planActivo = () => { const pr = st.profile || {}; return pr.isPro === true && PLANES.some((x) => x.id === pr.proPlan) ? pr.proPlan : null; };
// Botón principal de Administrar suscripción según el plan elegido (sel) y el activo (act).
// Pro recurrente (mensual/anual) que elige otro plan recurrente → portal de Stripe (prorrateo, sin cobro doble).
// Para Siempre es pago único → pasarela. Sin Pro → pasarela.
const RECURRENTES = ['mensual', 'anual'];
function subCta(sel, act) {
  const p = PLANES.find((x) => x.id === sel) || PLANES[1];
  if (act === 'siempre' && RECURRENTES.includes(p.id)) return { txt: 'Plan activo', act: '', dis: true };
  if (act && p.id === act) return act === 'siempre' ? { txt: 'Plan activo', act: '', dis: true } : { txt: 'Gestionar suscripción', act: 'bill-open', dis: false };
  if (RECURRENTES.includes(act) && RECURRENTES.includes(p.id)) return { txt: 'Cambiar de plan', act: 'bill-open', dis: false };
  return { txt: `Continuar con ${p.n}`, act: 'plan-go', dis: false };
}
const subCtaHTML = (c) => `<button type="button" class="btn block sub-cta"${c.act ? ` data-act="${c.act}"` : ''}${c.dis ? ' disabled' : ''}>${c.txt}</button>`;
// Cambia la selección sin render(): solo tarjetas (aria-checked → borde y radio amarillos) y botón principal.
function pintarSeleccion(sel) {
  const hoja = document.querySelector('.sub-plans'); if (!hoja) return false;
  hoja.querySelectorAll('.sub-plan').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.v === sel)));
  const b = document.querySelector('.sub .sub-cta'); if (!b) return false;
  const c = subCta(sel, planActivo());
  b.textContent = c.txt; b.disabled = c.dis;
  if (c.act) b.dataset.act = c.act; else b.removeAttribute('data-act');
  return true;
}
function suscripcionHTML() {
  const pro = st.profile && st.profile.isPro === true, act = planActivo();
  if (!PAGOS_ACTIVOS && !act) { // beta abierta sin cobros: ventajas de PRO + lista prioritaria (sin precios ni pasarela)
    return `<div class="sheet-list sub">
    <section class="sub-sec"><h3 class="pf-title">Suscripción actual</h3>
      <div class="sub-cur ${pro ? 'is-pro' : ''}"><b>${pro ? 'Cadencia PRO' : 'Beta abierta · Gratuita'}</b>
        <span class="small muted">${pro ? (proRegalo(st.profile) ? `Tu PRO de regalo dura hasta el ${diaPro(proRegalo(st.profile))}.` : 'Tienes todas las funciones Pro desbloqueadas.') : 'Todo lo gratuito está incluido sin coste durante la beta. Aún no se cobra nada.'}</span></div></section>
    ${pro ? '' : `<section class="sub-sec"><h3 class="pf-title">Cadencia PRO</h3>
      <p class="small muted">Próximamente. Esto incluirá:</p>
      ${ventajasBetaHTML(I.check)}
      ${listaProHTML(st.profile, st.listaBusy)}</section>`}
    <button type="button" class="sub-link" data-act="pro-info-open">Gratis vs PRO</button>
  </div>`;
  }
  const sel = (st.pf && st.pf.plan) || act || 'anual';
  const nomAct = act ? PLANES.find((x) => x.id === act).n.replace('PRO ', '') : '';
  return `<div class="sheet-list sub">
    <section class="sub-sec"><h3 class="pf-title">Suscripción actual</h3>
      <div class="sub-cur ${pro ? 'is-pro' : ''}"><b>${pro ? `Cadencia PRO${nomAct ? ` <span class="sub-dot">• ${nomAct}</span>` : ''}` : 'Suscripción Gratuita'}</b>
        <span class="small muted">${pro ? (proRegalo(st.profile) ? `Tu PRO de regalo dura hasta el ${diaPro(proRegalo(st.profile))}.` : 'Tienes todas las funciones Pro desbloqueadas.') : 'Pásate a PRO para desbloquear todas las funciones.'}</span></div></section>
    <section class="sub-sec"><h3 class="pf-title">Planes PRO</h3>
      <div class="sub-plans" role="radiogroup" aria-label="Planes PRO">${PLANES.map((x) => { const on = act === x.id, lock = act === 'siempre' && RECURRENTES.includes(x.id); return `<button type="button" class="sub-plan${on ? ' is-active' : ''}${lock ? ' is-locked' : ''}" role="radio" aria-checked="${sel === x.id}"${lock ? ' aria-disabled="true"' : ''} data-act="plan-sel" data-v="${x.id}">
        <span class="sub-radio" aria-hidden="true"></span><span class="sub-pt"><b>${x.n}</b><small>${x.nota}</small></span>${on ? '<span class="sub-price sub-now">Plan actual</span>' : `<span class="sub-price">${x.precio}</span>`}</button>`; }).join('')}</div>
      ${subCtaHTML(subCta(sel, act))}
      <button type="button" class="sub-link" data-act="pro-info-open">Ventajas de Cadencia PRO</button></section>
  </div>`;
}
function proInfoHTML() {
  const pro = st.profile && st.profile.isPro === true;
  return `<div class="sheet-back sheet-back-top" data-act="pro-info-close"></div>
    <div class="sheet pinfo" role="dialog" aria-modal="true" aria-label="Ventajas de Cadencia PRO">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><span style="width:36px"></span><h2>Gratis vs PRO</h2><button type="button" class="iconbtn" data-act="pro-info-close" aria-label="Cerrar">${I.close}</button></div>
      <div class="pinfo-scroll"><table class="cmp">
        <thead><tr><th scope="col"><span class="sr">Función</span></th><th scope="col">Gratis</th><th scope="col" class="cmp-pro">PRO</th></tr></thead>
        <tbody>${COMPARATIVA.map(([f, g, p, d]) => `<tr><th scope="row">${f}${d ? `<small class="cmp-d">${d}</small>` : ''}</th><td>${cmpCelda(g)}</td><td class="cmp-pro">${cmpCelda(p)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="pinfo-foot"><button type="button" class="btn block" data-act="pro-info-close">${pro || !PAGOS_ACTIVOS ? 'Cerrar' : 'Elegir Plan'}</button></div>
    </div>`;
}
function pfSheetHTML() {
  const v = st.pf.v;
  return `<div class="sheet-back" data-act="pf-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${PF_TITULO[v]}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="pf-close" aria-label="Cerrar">${I.back}</button><h2>${PF_TITULO[v]}</h2><span style="width:36px"></span></div>
      ${pfCuerpo(v)}
    </div>`;
}

async function pfGuardar(kind, f) {
  const uid = st.user.uid;
  let data;
  if (kind === 'pf-editar') {
    const nom = f.nombre.value.trim().replace(/\s+/g, ' '), ape = f.apellidos.value.trim().replace(/\s+/g, ' '), us = f.usuario.value.trim();
    if (!nom) return toast('Escribe tu nombre');
    if (!ape) return toast('Escribe tus apellidos');
    const ue = userErr(us); if (ue) return toast(ue);
    data = { nombre: nom, apellidos: ape, nombreCompleto: `${nom} ${ape}`, usuario: us };
  } else if (kind === 'pf-det') {
    const goals = st.editGoals || st.profile.objetivos || [], alt = num(f.alturaCm.value), kg = num(f.pesoKg.value), fn = f.fechaNac.value;
    const obj = f.pesoObjetivo.value.trim() ? num(f.pesoObjetivo.value) : null;
    let edad = st.profile.edad;
    if (fn) { const h = new Date(), n = new Date(`${fn}T00:00:00`); edad = h.getFullYear() - n.getFullYear() - (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate()) ? 1 : 0); }
    if (!(edad >= 14 && edad <= 100)) return toast('La edad tiene que estar entre 14 y 100 años');
    if (!(alt >= 120 && alt <= 230)) return toast('La estatura tiene que estar entre 120 y 230 cm');
    if (!(kg >= 30 && kg <= 300)) return toast('El peso tiene que estar entre 30 y 300 kg');
    if (!goals.length) return toast('Elige al menos un objetivo');
    if (obj != null) { const err = objetivoInvalido(obj, alt, f.sexo.value, goals, grasaActual()); if (err) return toast(err); }
    data = { sexo: f.sexo.value, edad: Math.round(edad), alturaCm: Math.round(alt), pesoObjetivo: obj == null ? null : Math.round(obj * 10) / 10, objetivos: goals };
    if (fn) data.fechaNac = fn;
    if (f.ritmoKgSemana) data.ritmoKgSemana = OB.ritmoDe(f.ritmoKgSemana.value); // el slider solo existe con «Perder grasa» o «Ganar músculo»
    const k1 = Math.round(kg * 10) / 10;
    try {
      if (k1 !== currentKg()) { await api.addWeight(uid, todayISO(), k1); st.weights = await api.listWeights(uid); data.pesoKg = k1; }
    } catch (e) { return toast(errorText(e)); }
    data.calorias = CAL.resumen({ ...st.profile, ...data }, k1);
  } else { // pf-func
    const texto = f.texto.value.trim();
    if (texto.length < 5) return toast('Cuéntanos un poco más');
    st.pf.busy = true; render();
    try { await api.addFeatureRequest(uid, st.user.email, texto); st.pf = null; render(); toast('¡Gracias! Hemos recibido tu idea'); }
    catch (e) { st.pf.busy = false; st.pf.f = { texto }; render(); toast(errorText(e)); }
    return;
  }
  st.pf.busy = true; render();
  try {
    await api.saveProfile(uid, data);
    st.profile = { ...st.profile, ...data }; st.pf = null; st.editGoals = null;
    render(); toast('Cambios guardados');
  } catch (e) { st.pf.busy = false; render(); toast(errorText(e)); }
}

/* ---------- Configuración (engranaje): apariencia y recordatorios ---------- */
function cfgSheetHTML() {
  const t = themePref();
  return `<div class="sheet-back" data-act="cfg-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Configuración">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="cfg-close" aria-label="Cerrar">${I.back}</button><h2>Configuración</h2><span style="width:36px"></span></div>
      <div class="sheet-list">
        <section class="card"><h2>Apariencia</h2>
          <div class="seg" role="group" aria-label="Tema">${[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Sistema']].map(([v, l]) => `<button type="button" data-act="theme" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}</div>
          <p class="small muted">${t === 'system' ? 'Sigue el modo claro u oscuro de tu móvil.' : t === 'light' ? 'Fondo claro con el mismo amarillo.' : 'Negro y amarillo, el estilo de Cadencia.'}</p>
        </section>
        ${CICLISMO ? `<section class="card"><h2>Funciones</h2>
          <div class="rec-row"><div class="rec-t"><b id="cfg-cic">Mostrar funciones de Ciclismo</b><span class="small muted">Pestaña Bici con rutas, mapa y taller de tu bici.</span></div>
            <button type="button" class="switch" role="switch" aria-checked="${M.tieneBici()}" aria-labelledby="cfg-cic" data-act="cfg-cic"><i></i></button></div>
        </section>` : ''}
        ${R.cardHTML()}
        ${installCard(false)}
      </div>
    </div>`;
}

function pwdSheetHTML() {
  const P = st.pwd;
  return `<div class="sheet-back" data-act="pwd-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Modificar contraseña">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="pwd-close" aria-label="Cerrar">${I.back}</button><h2>Modificar contraseña</h2><span style="width:36px"></span></div>
      <form class="sheet-list form-grid" data-form="pwd" novalidate>
        <label class="field"><span>Contraseña actual</span><input class="input" type="password" name="actual" autocomplete="current-password"></label>
        <label class="field"><span>Contraseña nueva</span><input class="input" type="password" name="nueva" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>
        <label class="field"><span>Repite la contraseña nueva</span><input class="input" type="password" name="repite" autocomplete="new-password"></label>
        ${P.msg ? `<div class="msg ${P.ok ? 'ok' : ''}" role="alert">${esc(P.msg)}</div>` : ''}
        <button class="btn block" type="submit" ${P.busy ? 'disabled' : ''}>${P.busy ? '<span class="spinner"></span>' : 'Guardar contraseña'}</button>
      </form>
    </div>`;
}

// Foto de perfil: el usuario encuadra y hace zoom en un modal (Cropper.js); se exporta 400×400 JPEG 0.7 y se sube a Firebase Storage (profile_pictures/{uid}/avatar.jpg).
// El modal vive fuera de #root a propósito: ningún render() puede destruir el recorte a medias.
function subirFoto(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast('Elige una imagen');
  if (!window.Cropper) return toast('No se ha podido cargar el recortador. Comprueba tu conexión.');
  const url = URL.createObjectURL(file);
  const m = document.createElement('div');
  m.className = 'crop-modal';
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Recortar foto de perfil');
  m.innerHTML = `<h2>Encuadra tu foto</h2><p class="small muted">Arrastra para mover y pellizca para hacer zoom.</p>
    <div class="crop-stage"><img alt="Foto seleccionada"></div>
    <div class="crop-acts"><button type="button" class="btn ghost" data-crop="no">Cancelar</button><button type="button" class="btn" data-crop="ok">Guardar foto</button></div>`;
  document.body.appendChild(m);
  const img = m.querySelector('img'), ok = m.querySelector('[data-crop=ok]'), no = m.querySelector('[data-crop=no]');
  let cropper = null, cerrado = false;
  const cerrar = () => { if (cerrado) return; cerrado = true; document.removeEventListener('keydown', tecla); if (cropper) cropper.destroy(); URL.revokeObjectURL(url); m.remove(); };
  const tecla = (e) => { if (e.key === 'Escape' && !ok.disabled) cerrar(); };
  document.addEventListener('keydown', tecla);
  no.onclick = cerrar;
  img.onload = () => { cropper = new window.Cropper(img, { aspectRatio: 1, viewMode: 1, dragMode: 'move', autoCropArea: 1, cropBoxMovable: false, cropBoxResizable: false, background: false, toggleDragModeOnDblclick: false }); };
  img.onerror = () => { cerrar(); toast('No se ha podido leer la foto.'); };
  img.src = url;
  ok.onclick = async () => {
    if (!cropper) return;
    ok.disabled = no.disabled = true; ok.innerHTML = '<span class="spinner"></span>';
    try {
      const c = cropper.getCroppedCanvas({ width: 400, height: 400, fillColor: '#fff', imageSmoothingQuality: 'high' });
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
      const fotoUrl = await api.uploadAvatar(st.user.uid, blob);
      await api.saveProfile(st.user.uid, { fotoUrl });
      st.profile = { ...st.profile, fotoUrl };
      cerrar(); toast('Foto actualizada'); render();
    } catch (e) { toast(errorText(e)); ok.disabled = no.disabled = false; ok.textContent = 'Guardar foto'; }
  };
}

async function guardarPwd(f) {
  const P = st.pwd, a = f.actual.value, n = f.nueva.value, r = f.repite.value;
  const err = (m) => { P.msg = m; P.ok = false; render(); };
  if (!a) return err('Escribe tu contraseña actual.');
  if (n.length < 6) return err('La contraseña nueva necesita al menos 6 caracteres.');
  if (n !== r) return err('Las contraseñas nuevas no coinciden.');
  if (n === a) return err('La nueva tiene que ser distinta de la actual.');
  P.busy = true; P.msg = ''; render();
  try { await api.changePassword(a, n); st.pwd = null; render(); toast('Contraseña cambiada'); }
  catch (e) { P.busy = false; P.ok = false; P.msg = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(e && e.code) ? 'La contraseña actual no es correcta.' : errorText(e); render(); }
}

/* ================================================================== */
/* Entreno                                                             */
/* ================================================================== */
/* ---------- error de carga ---------- */
function viewError() {
  return `<div class="screen" style="justify-content:center;gap:16px">
    <h1 class="ob-title">No se han podido cargar tus datos</h1>
    <p class="ob-sub">${esc(st.errText || '')}</p>
    <button class="btn block" data-act="retry">Volver a intentar</button>
    <button class="btn ghost block" data-act="logout">Cerrar sesión</button>
  </div>`;
}

/* ================================================================== */
/* Entrada y eventos                                                   */
/* ================================================================== */
async function enter(u) {
  if (u && st.view === 'paywall' && st.vieneDeRegistro) return; // aviso de sesión repetido mientras se ve el paywall: no entrar en la app todavía
  st.user = u; st.busy = false;
  if (!u && M) M.pararPro();
  if (!u) { pwQuitar(); st.vieneDeRegistro = false; const anon = st.ob && st.ob.anon && !st.ob.justRegistered ? st.ob : null; /* un cuestionario sin cuenta en marcha NO se pierde por un aviso «sin sesión» */ st.cfg = st.pwd = st.pf = st.proInfo = st.rutShare = st.codigo = null; st.pesoHist = st.pesoComp = st.pesoDel = st.pesoSheet = st.pesoEdit = null; st.recAsk = null; st.del = null; st.legal = false; st.view = anon && st.view === 'onboarding' ? 'onboarding' : 'auth'; st.ob = anon; st.profile = null; st.weights = []; st.workouts = []; st.wk = null; st.rw = null; st.re = null; st.live = null; st.lib = null; st.food = null; st.tl = null; st.dias = {}; st.nDate = null; return render(); }
  try {
    // PUERTA OBLIGATORIA: antes de pintar la app (y antes de pedir entrenos, peso, racha…) se lee el perfil.
    // Sin `onboardingCompletado: true` solo se ve el cuestionario: nada de cabecera, barra inferior ni secciones.
    st.profile = await api.getProfile(u.uid);
    if (!onboardingHecho(st.profile)) {
      if (st.view === 'onboarding' && st.ob && st.ob.uid === u.uid) return; // ya está dentro (aviso de sesión repetido): no perder lo escrito
      // Cuenta antigua (ya tenía datos): su peso más reciente sale de la lista de pesos, no del perfil (puede estar desfasado).
      let ultimo = null;
      if (st.profile && (st.profile.onboarded === true || st.profile.pesoKg)) { const ws = await api.listWeights(u.uid); ultimo = ws.length ? ws[ws.length - 1].kg : null; }
      return startOnboarding(ultimo);
    }
    await entrarApp(u);
  } catch (e) {
    st.errText = errorText(e); st.view = 'error'; render();
  }
}

// ¿Esta cuenta ya pasó por la versión ACTUAL del cuestionario? Vale `onboardingCompletado: true` y `onboardingVersion >= OB.VERSION` (sin campo = versión 1, por eso las que lo firmaron el 15-11 lo repiten una vez con la Fase 1). Las cuentas anteriores al 15-11 no la tienen:
// la primera vez que entran hacen el cuestionario (con sus datos ya rellenados) y al firmar queda en true, así que es una sola vez.
const onboardingHecho = (p) => !!p && p.onboardingCompletado === true && (p.onboardingVersion || 1) >= OB.VERSION;

// Carga normal de la app (peso, entrenos, racha, Pro…) y primera pantalla. `fade`: entrada suave tras firmar el cuestionario.
async function entrarApp(u, { fade = false } = {}) {
  st.weights = await api.listWeights(u.uid);
  st.workouts = await api.listWorkouts(u.uid);
  await M.cargar(u.uid);
  E.setPropios(st.profile.ejPropios);
  if (fade) { st.wk = null; st.wkHist = st.wkMod = st.wkDel = st.wkBack = false; st.rw = null; st.re = null; st.dias = {}; st.tab = 'inicio'; }
  // Si cerraste la app a mitad de un entrenamiento de fuerza, sigue donde lo dejaste.
  try { const sv = JSON.parse(lsGet('cadencia-live') || 'null'); if (sv && sv.uid === u.uid && Array.isArray(sv.ex)) { st.live = sv; st.liveMin = true; } } catch (e) { /* nada */ }
  st.ob = null;
  st.view = 'main';
  if (fade) { root.classList.add('app-in'); setTimeout(() => root.classList.remove('app-in'), 1000); }
  render();
  const llegoConDestino = !!(stravaRet || irPendiente);
  if (stravaRet) { const r = stravaRet; stravaRet = null; S.vuelta(r); }
  else if (irPendiente) { const d = irPendiente; irPendiente = null; st.tab = d.tab; lsSet('cadencia-tab', d.tab); if (d.hoja === 'peso') st.pesoSheet = true; render(); }
  R.mantener();
  if (!st.profile.refCode) api.miCodigo().then((r) => { if (st.profile) st.profile.refCode = r.refCode; }).catch(() => { /* se pedirá al abrir «Invita a tus amigos» */ });
  if (!llegoConDestino) R.preguntar();
}

UI.iniciarHojas(root);
OB.iniciarFirma(root, obFirmado);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.legal) { const b = root.querySelector('.sheet-back[data-act="legal-close"]'); if (b) b.click(); } });
root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tap')) { e.preventDefault(); e.target.click(); } });
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  if (act === 'ref-share') { refCompartir(); return; } // sin esperar a nada: navigator.share y el portapapeles solo valen justo tras el toque
  if (act === 'ref-copy') { refCopiar(); return; }
  if (b.closest('.nov-modal') && act !== 'nov-ok') M.novCerrar();
  if (R.click(act, v)) return; // sin esperar a nada: el permiso de notificaciones debe pedirse al instante del toque
  if (await S.click(act, v)) return;
  if (await M.click(act, v, b)) return;
  if (act === 'auth-ingresar') { st.authMode = 'login'; st.authMsg = null; render(); }
  else if (act === 'auth-volver') { st.authMode = 'welcome'; st.authMsg = null; render(); }
  else if (act === 'login-google') onSocial('google');
  else if (act === 'login-apple') onSocial('apple');
  else if (act === 'ob-empezar') startOnboarding(null, { anon: true });
  else if (act === 'reg-google') obRegistrar('google');
  else if (act === 'reg-apple') obRegistrar('apple');
  else if (act === 'reg-email') { st.ob.regEmail = true; st.ob.msg = ''; render(); const i = root.querySelector('[data-ob="regEmail"]'); if (i) i.focus(); }
  else if (act === 'pw-cerrar') { if (st.vieneDeRegistro && PAGOS_ACTIVOS) { st.pwAviso = true; render(); } else pwSalir(); }
  else if (act === 'pw-aviso-cerrar') { st.pwAviso = false; render(); }
  else if (act === 'pw-seguir') pwSeguir();
  else if (act === 'legal-open') { if (st.view === 'auth') { const f = root.querySelector('form'); st.authKeep = f && f.email ? { email: f.email.value, pass: f.pass.value } : null; } st.legal = legalTab(v); render(); if (st.authKeep) keepForm(st.authKeep); }
  else if (act === 'legal-tab') { st.legal = legalTab(v); render(); const t = root.querySelector('.legal-seg [aria-selected="true"]'); if (t) t.focus({ preventScroll: true }); }
  else if (act === 'legal-close') { st.legal = false; render(); if (st.view === 'auth' && st.authKeep) { keepForm(st.authKeep); st.authKeep = null; } }
  else if (act === 'pf-open') { st.pf = { v, f: {}, busy: false }; st.editGoals = null; render(); if (v === 'referidos') refAbrir(); }
  else if (act === 'cod-open') { st.codigo = { val: refGuardado(), msg: '', busy: false }; render(); const i = root.querySelector('.cod-input'); if (i) i.focus(); }
  else if (act === 'cod-close') { st.codigo = null; render(); }
  else if (act === 'ref-reclamar') reclamarReferido(v);
  else if (act === 'plan-sel') { if (planActivo() === 'siempre' && RECURRENTES.includes(v)) return; const actual = (st.pf && st.pf.plan) || planActivo() || 'anual'; if (v === actual) return; if (st.pf && PLANES.some((x) => x.id === v)) { st.pf.plan = v; if (!pintarSeleccion(v)) render(); } }
  else if (act === 'plan-go') { if (!PAGOS_ACTIVOS) return; const pa = planActivo(), el = (st.pf && st.pf.plan) || pa || 'anual'; if (subCta(el, pa).act !== 'plan-go') return; const url = planUrl((st.pf && st.pf.plan) || 'anual', st.user); if (!url) { toast('La suscripción estará disponible muy pronto.'); return; } const w = window.open(url, '_blank'); if (!w) location.assign(url); }
  else if (act === 'pro-info-open') { st.proInfo = true; render(); }
  else if (act === 'pro-info-close') { st.proInfo = null; render(); }
  else if (act === 'pf-close') { st.pf = null; st.editGoals = null; render(); }
  else if (act === 'pf-idioma') { st.profile.idioma = v; render(); try { await api.saveProfile(st.user.uid, { idioma: v }); } catch (e) { toast(errorText(e)); } }
  else if (act === 'del-open') { st.del = { pass: '', txt: '', msg: '', busy: false }; render(); }
  else if (act === 'del-close') { if (!st.del || !st.del.busy) { st.del = null; render(); } }
  else if (act === 'peek') { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Ver' : 'Ocultar'; }
  else if (act === 'forgot') onForgot();
  else if (act === 'ob-donde') { const g = st.ob.donde; st.ob.donde = g.includes(v) ? g.filter((x) => x !== v) : [...g, v]; render(); }
  else if (act === 'ob-mat') { st.ob.material = OB.alternaMaterial(st.ob.material, v); render(); }
  else if (act === 'ob-dias') { st.ob.freq = Number(v); render(); }
  else if (act === 'ob-tiempo') { st.ob.tiempo = Number(v); render(); }
  else if (act === 'ob-obst') { st.ob.obstaculo = v; render(); }
  else if (act === 'ob-psico') { st.ob.psico = { ...st.ob.psico, [b.dataset.k]: v === '1' }; render(); }
  else if (act === 'ob-exp') { st.ob.exp = v; render(); }
  else if (act === 'ob-meta') { st.ob.meta = v; render(); }
  else if (act === 'ob-recomp-usar') { st.ob.pesoObjetivo = nf(Number(v), 1); st.ob.msg = ''; render(); }
  else if (act === 'sex') { st.ob.sexo = v; render(); }
  else if (act === 'ob-back') obBack();
  else if (act === 'tab') { st.tab = v; st.editGoals = null; st.perfilDirty = false; st.mealDet = null; st.food = null; st.tl = null; lsSet('cadencia-tab', v); render(); window.scrollTo(0, 0); }
  else if (act === 'install') { if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') installEvt = null; render(); } }
  else if (act === 'install-hide') { lsSet('cadencia-install-hide', '1'); render(); }
  else if (act === 'peso-sheet') { st.pesoEdit = null; st.pesoSheet = true; render(); }
  else if (act === 'peso-sheet-close') { st.pesoSheet = false; st.pesoEdit = null; render(); }
  else if (act === 'peso-unit') cambiarUnidad(v);
  else if (act === 'peso-hist') { st.pesoHist = true; st.pesoMod = false; render(); }
  else if (act === 'peso-hist-close') { st.pesoHist = false; st.pesoMod = false; render(); }
  else if (act === 'peso-hist-mod') { st.pesoMod = !st.pesoMod; render(); }
  else if (act === 'w-edit') { st.pesoEdit = v; st.pesoSheet = true; render(); }
  else if (act === 'w-del-ask') { if (st.weights.length <= 1) toast('Necesitas al menos un registro de peso'); else { st.pesoDel = v; render(); } }
  else if (act === 'w-del-no') { st.pesoDel = null; render(); }
  else if (act === 'w-del-yes') { const f = st.pesoDel; if (f) delWeight(f); }
  else if (act === 'comp-ver') { st.pesoComp = v; st.pesoModo = 'kg'; render(); scrollTo(0, 0); }
  else if (act === 'comp-close') { st.pesoComp = null; render(); }
  else if (act === 'comp-modo') { st.pesoModo = v; render(); }
  else if (act === 'psex') { const f = b.closest('form'); f.sexo.value = v; if (st.pf) { st.pf.f.sexo = v; pfBtn(); refrescarGuia(); refrescarRitmoTxt(); } b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
  else if (act === 'pgoal') {
    const g = st.editGoals || [...(st.profile.objetivos || [])];
    st.editGoals = g.includes(v) ? g.filter((x) => x !== v) : [...g, v];
    b.setAttribute('aria-pressed', String(st.editGoals.includes(v)));
    b.querySelector('.tick').innerHTML = st.editGoals.includes(v) ? I.check : '';
    if (st.pf) { pfBtn(); refrescarGuia(); refrescarRitmo(); }
  }
  else if (act === 'recomp-usar') {
    const f = b.closest('form'), inp = f && f.pesoObjetivo;
    if (inp) { inp.value = nf(Number(v), 1); if (st.pf) { st.pf.f.pesoObjetivo = inp.value; pfBtn(); refrescarRitmoTxt(); } }
  }
  else if (act === 'cfg-cic') {
    const on = !M.tieneBici(); st.profile.ciclismo = on;
    if (!on && st.tab === 'bici') { st.tab = 'inicio'; lsSet('cadencia-tab', 'inicio'); }
    render();
    try { await api.saveProfile(st.user.uid, { ciclismo: on }); } catch (e) { toast(errorText(e)); }
  }
  else if (act === 'theme') { lsSet('cadencia-theme', THEMES.includes(v) ? v : 'dark'); applyTheme(); render(); }
  else if (act === 'cfg-open') { st.cfg = true; render(); }
  else if (act === 'cfg-close') { st.cfg = null; render(); }
  else if (act === 'pwd-open') { st.pwd = { msg: '', busy: false }; render(); }
  else if (act === 'pwd-close') { st.pwd = null; render(); }
  else if (act === 'bill-open') {
    // Crea la sesión del portal de Stripe y salta directo; si el usuario aún no tiene cliente guardado, usa el enlace de acceso.
    const t0 = b.textContent; b.disabled = true; b.textContent = 'Abriendo…';
    try { location.assign((await api.portal(location.href.split('#')[0])).url); }
    catch (e) { if (PORTAL_LINK) location.assign(PORTAL_LINK); else { toast('No se pudo abrir la suscripción'); b.disabled = false; b.textContent = t0; } }
  }
  else if (act === 'google-link') {
    st.gBusy = true; render();
    try { await api.linkGoogle(); toast('Cuenta de Google vinculada'); } catch (e) { toast(errorText(e)); }
    st.gBusy = false; render();
  }
  else if (act === 'sug-ignorar') {
    const el = document.getElementById('sug'); if (el) el.remove();
    if (b.dataset.ctx === 'ob' && st.ob) st.ob.hideSug = true;
    else { try { await api.saveProfile(st.user.uid, { hideWeightSuggestion: true }); st.profile.hideWeightSuggestion = true; } catch (e) { toast(errorText(e)); } }
  }
  else if (act === 'logout') { st.tab = 'inicio'; st.authMode = 'welcome'; st.authMsg = null; obAnonBorrar(); lsSet('cadencia-tab', null); await api.logout(); }
  else if (act === 'retry') { st.view = 'boot'; enter(st.user); }
});

root.addEventListener('input', (e) => {
  if (st.del && e.target.dataset.del) {
    st.del[e.target.dataset.del] = e.target.value;
    const go = document.getElementById('del-go'); if (go) go.disabled = !(st.del.txt.trim().toUpperCase() === 'BORRAR' && st.del.pass) || st.del.busy;
    return;
  }
  if (e.target.closest && e.target.closest('form[data-form="addweight"]')) { if (e.target.dataset && e.target.dataset.comp) e.target.dataset.tocado = '1'; pesoHints(); return; }
  if (st.pf && e.target.name && e.target.closest('form[data-form^="pf-"]')) {
    if (e.target.name === 'ritmoKgSemana') { // slider: se repinta número, barra y texto sin render() (si no, se pierde el dedo)
      const r = OB.ritmoDe(e.target.value); st.pf.f.ritmoKgSemana = String(r); pfBtn();
      e.target.style.setProperty('--p', OB.ritmoPct(r) + '%');
      const v = document.getElementById('pf-ritmo-v'); if (v) v.textContent = OB.fmtRitmo(r);
      refrescarRitmoTxt(); return;
    }
    st.pf.f[e.target.name] = e.target.value; pfBtn();
    if (['alturaCm', 'pesoKg', 'fechaNac'].includes(e.target.name)) refrescarGuia();
    if (['alturaCm', 'pesoKg', 'fechaNac', 'pesoObjetivo'].includes(e.target.name)) refrescarRitmoTxt();
  }
  if (st.view === 'main' && M.input(e.target)) return;
  const k = e.target.dataset && e.target.dataset.ob;
  if (!k || !st.ob) return;
  if (k === 'ritmo') { // slider del ritmo: se repinta el número, la barra y la etiqueta sin render() (si no, se perdería el dedo)
    const r = OB.ritmoDe(e.target.value); st.ob.ritmo = r;
    e.target.style.setProperty('--p', OB.ritmoPct(r) + '%');
    const v = document.getElementById('ob-ritmo-v'), tx = document.getElementById('ob-ritmo-txt');
    if (v) v.textContent = OB.fmtRitmo(r); if (tx) tx.innerHTML = OB.ritmoInfoHTML(r);
    const fe = document.getElementById('ob-ritmo-fecha'); if (fe) fe.innerHTML = OB.ritmoFechaHTML(st.ob, todayISO()); // fecha en vivo al deslizar
    return;
  }
  st.ob[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  obGuardarAnon();
  // activar/desactivar «Siguiente» sin redibujar (para no perder el foco del teclado)
  const o = st.ob, next = root.querySelector('[data-next]');
  if (next) next.disabled = !OB.puedeSeguir(o);
  if (o.step === 'meta') { const t = document.getElementById('ob-term'); if (t) t.innerHTML = OB.termometroHTML(num(o.pesoKg), num(o.pesoObjetivo)); } // termómetro en vivo, sin perder el teclado
});

root.addEventListener('change', async (e) => { if (st.view === 'main') { if (e.target.matches && e.target.matches('select[data-comp-sel]')) { st.pesoComp = e.target.value; st.pesoModo = 'kg'; render(); return; }  if (e.target.matches && e.target.matches('input[data-foto]')) { const f = e.target.files && e.target.files[0]; e.target.value = ''; return subirFoto(f); } if (R.change(e.target)) return; await M.change(e.target); } });

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, kind = f.dataset.form;
  if (await M.submit(kind, f)) return;
  if (kind === 'login') onLogin(f);
  else if (kind === 'ob') obNext();
  else if (kind === 'addweight') saveWeight(f.fecha.value, f.kg.value, { grasa: f.grasa.value, musculo: f.musculo.value, agua: f.agua.value, hueso: f.hueso.value }, pesoUnit(), !!f.dataset.edit, keepEdit(f), Object.fromEntries(RG_MEDIDAS.flatMap((m) => RG.REGIONES.map(({ k }) => [rgCampo(m.k, k), f.elements[rgCampo(m.k, k)] ? f.elements[rgCampo(m.k, k)].value : '']))));
  else if (kind.startsWith('pf-')) pfGuardar(kind, f);
  else if (kind === 'codigo') canjearCodigo(f.codigo.value);
  else if (kind === 'delacc') borrarCuenta();
  else if (kind === 'pwd') guardarPwd(f);
  else if (kind === 'wk') wkSave();
  else if (kind === 'rw') rwNext();
});

/* ---------- arranque ---------- */
(async function boot() {
  iniciarInstalar();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => { reg.update(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }); }).catch(() => { /* sin modo sin conexión */ });
    // Cuando llega una versión nueva de la app, recarga una vez para usarla.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && navigator.serviceWorker.controller) { reloaded = true; location.reload(); } });
  }
  try {
    api = await createBackend();
  } catch (e) {
    root.innerHTML = `<div class="screen" style="justify-content:center;gap:16px"><h1 class="ob-title">Sin conexión</h1><p class="ob-sub">Hace falta internet la primera vez que abres la app.</p><button class="btn block" onclick="location.reload()">Volver a intentar</button></div>`;
    return;
  }
  st.view = 'auth';
  api.onAuth((u) => { if (st.registering) return; enter(u); });
})();
