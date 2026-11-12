import './br.js'; // Fórmulas de Bilbao Ride (globalThis.BR): debe cargarse antes que secciones.js
import { createBackend, errorText } from './data.js';
import { APP_NAME } from './config.js';
import * as E from './entreno.js';
import { crearSecciones, NOV_V } from './secciones.js';
import { crearEntreno } from './entreno-ui.js';
import { LEGAL_V, legalHTML, CONTACTO } from './legal.js';
import { PORTAL_LINK, planUrl } from './pro.js';
import * as CAL from './calorias.js';
import { leerRetorno } from './strava.js';
import { crearRecordatorios, leerIr } from './push.js';
import { crearStrava } from './strava-ui.js';
import { iniciarInstalar } from './instalar.js';

/* ================================================================== */
/* Utilidades                                                          */
/* ================================================================== */
const root = document.getElementById('root');
import { esc, num, nf, todayISO, fmtDate, lsGet, lsSet, toast, I } from './util.js';

/* ---------- objetivos ---------- */
const GOALS = [
  { id: 'perder', t: 'Perder grasa', s: 'Bajar peso sin perder fuerza', ico: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: 'musculo', t: 'Ganar músculo', s: 'Más fuerza en piernas y tronco', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'rendimiento', t: 'Rendir más en la bici', s: 'Más potencia y fondo en las subidas', ico: '<path d="M3 18l6-8 4 5 3-4 5 7"/>' },
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

/* ================================================================== */
/* Estado                                                              */
/* ================================================================== */
let api = null;
const st = {
  view: 'boot', user: null, profile: null, weights: [],
  authMode: 'login', authMsg: null, busy: false, registering: false,
  ob: null, tab: lsGet('cadencia-tab') || 'inicio', editGoals: null,
  workouts: [], wkTab: lsGet('cadencia-wktab') || 'semana', wk: null, rw: null, re: null, live: null, liveMin: false, lib: null,
};

function render() {
  if (st.view === 'auth') root.innerHTML = viewAuth();
  else if (st.view === 'onboarding') root.innerHTML = viewOnboarding();
  else if (st.view === 'main') root.innerHTML = viewMain();
  else if (st.view === 'error') root.innerHTML = viewError();
  document.title = APP_NAME;
  if (M) M.afterRender();
  document.body.classList.toggle('noscroll', !!(st.limite || st.calentar || st.pf || st.proInfo || st.rutShare || st.mealDet != null || st.rutDelAsk || st.wkHist || st.wkDel || st.novModal || st.lib || st.food || st.tl || st.pesoSheet || st.pesoHist || st.pesoDel || st.cfg || st.pwd || st.meta || st.regPick || st.modoSel || st.resumen || st.legal || st.del || st.pro || st.proWelcome || st.recAsk));
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

function viewAuth() {
  const reg = st.authMode === 'register';
  const m = st.authMsg;
  return `<div class="screen">
    <div class="auth-hero">
      <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor"><path d="M12 8H56V22H28V42H56V56H12Z" transform="translate(6.8 0) skewX(-12)"/></svg>
      <h1 class="wordmark">${esc(APP_NAME)}</h1>
      <p class="tagline">Tu peso, tus objetivos y tu bici, en un mismo sitio.</p>
      ${heroProfile()}
    </div>
    <div class="auth-card">
      <div class="seg" role="group" aria-label="Acceso">
        <button type="button" data-act="mode" data-v="login" aria-pressed="${!reg}">Iniciar sesión</button>
        <button type="button" data-act="mode" data-v="register" aria-pressed="${reg}">Crear cuenta</button>
      </div>
      <form data-form="${reg ? 'register' : 'login'}" class="form-grid" novalidate>
        ${reg ? `<label class="field"><span>Nombres y apellidos</span><input class="input" name="name" autocomplete="name" required placeholder="Tu nombre y tus apellidos"></label>` : ''}
        <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="tu@email.com"></label>
        <label class="field"><span>Contraseña</span>
          <div class="pass-wrap"><input class="input" type="password" name="pass" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${reg ? 'Mínimo 6 caracteres' : ''}"><button type="button" data-act="peek">Ver</button></div>
        </label>
        ${reg ? `<label class="check"><input type="checkbox" name="acepto" required><span>Acepto los <button type="button" class="link" data-act="legal-open">Términos de Uso, la Política de Privacidad y el aviso de salud</button></span></label>` : ''}
        ${m ? `<div class="msg ${m.ok ? 'ok' : ''}" role="alert">${esc(m.text)}</div>` : ''}
        <button class="btn block" type="submit" ${st.busy ? 'disabled' : ''}>${st.busy ? '<span class="spinner"></span>' : reg ? 'Crear cuenta' : 'Entrar'}</button>
        ${reg ? '' : '<button type="button" class="link" data-act="forgot">He olvidado mi contraseña</button>'}
      </form>
      ${api.mode === 'local' ? `<p class="note"><span>●</span><span><b>Modo prueba.</b> Las cuentas y los datos se guardan solo en este dispositivo hasta que conectes Firebase.</span></p>` : ''}
    </div>
  </div>${st.legal ? legalSheetHTML() : ''}`;
}

/* ---------- términos, privacidad y borrar la cuenta ---------- */
function legalSheetHTML() {
  return `<div class="sheet-back" data-act="legal-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Términos, privacidad y aviso de salud">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="legal-close" aria-label="Cerrar">${I.back}</button><h2>Términos y privacidad</h2><span style="width:36px"></span></div>
      <div class="sheet-list legal">${legalHTML()}</div>
      <div class="sheet-foot"><button class="btn block" data-act="legal-close">Entendido</button></div>
    </div>`;
}
function delSheetHTML() {
  const D = st.del, ok = D.txt.trim().toUpperCase() === 'BORRAR' && !!D.pass;
  return `<div class="sheet-back" data-act="del-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Borrar mi cuenta">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="del-close" aria-label="Cerrar">${I.back}</button><h2>Borrar mi cuenta</h2><span style="width:36px"></span></div>
      <form class="sheet-list form-grid" data-form="delacc" novalidate>
        <div class="msg"><b>¿Estás seguro? Esta acción no se puede deshacer.</b> Se borrarán <b>para siempre</b> tu cuenta y todos tus datos: perfil, foto, pesos, entrenos, rutinas, objetivos, comidas y taller.</div>
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
    st.del = null; st.modoSel = null; st.resumen = null; st.limite = null; st.calentar = null; st.live = null; st.tab = 'inicio'; st.authMode = 'login';
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

async function onRegister(form) {
  const name = form.name.value.trim(), email = form.email.value.trim(), pass = form.pass.value;
  if (name.split(/\s+/).filter(Boolean).length < 2) { st.authMsg = { text: 'Escribe tus nombres y apellidos.' }; render(); return keepForm({ name, email }); }
  if (!email) { st.authMsg = { text: 'Escribe tu email.' }; render(); return keepForm({ name }); }
  if (pass.length < 6) { st.authMsg = { text: 'La contraseña necesita al menos 6 caracteres.' }; render(); return keepForm({ name, email }); }
  if (!form.acepto.checked) { st.authMsg = { text: 'Para crear la cuenta tienes que aceptar los Términos de Uso, la Política de Privacidad y el aviso de salud.' }; render(); return keepForm({ name, email, pass }); }
  st.busy = true; st.authMsg = null; st.registering = true; render();
  try {
    const u = await api.register(name, email, pass);
    // Consentimiento expreso (datos de salud): qué versión aceptó y cuándo.
    try { await api.saveProfile(u.uid, { legal: { v: LEGAL_V, fecha: new Date().toISOString() } }); } catch (e) { /* se reintenta en el siguiente guardado */ }
    st.registering = false;
    await enter(u);
  } catch (e) {
    st.registering = false; st.busy = false; st.authMsg = { text: errorText(e) }; render(); keepForm({ name, email });
  }
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
/* Cuestionario inicial                                                */
/* ================================================================== */
const OB_STEPS = 5; // objetivos, qué entrenas, sobre ti, estatura, peso (+ resumen)
const OB_ENTRENOS = [['fuerza', 'Fuerza', 'Gimnasio, calistenia…', () => I.dumb], ['bici', 'Bici', 'Carretera, rodillo…', () => I.bike], ['cardio', 'Running', 'Correr en calle, cinta o monte', () => I.pulse], ['otro', 'Otro deporte', 'Fútbol, natación…', () => I.ball]];

// Nombre de usuario: solo letras, números, _ y -, sin espacios (3–20).
const USER_RE = /^[a-zA-Z0-9_-]+$/;
const userErr = (u) => (!u ? 'Escribe tu nombre de usuario.' : u.length < 3 || u.length > 20 ? 'El nombre de usuario tiene de 3 a 20 caracteres.' : !USER_RE.test(u) ? 'El usuario solo admite letras, números, guion bajo (_) y guion medio (-), sin espacios.' : '');
// «Nombre» y «Apellidos» a partir de lo guardado (o del nombre completo con el que se registró).
function nomApe(p, fallback = '') {
  const full = (p.nombreCompleto || p.nombre || fallback || '').trim().replace(/\s+/g, ' '), nom = p.nombre || full.split(' ')[0] || '';
  return [nom, p.apellidos != null ? p.apellidos : (full.startsWith(nom) ? full.slice(nom.length).trim() : '')];
}

function startOnboarding() {
  const p = st.profile || {};
  st.ob = {
    step: 0,
    objetivos: p.objetivos || [],
    entrenos: Array.isArray(p.entrenos) ? p.entrenos : [],
    nombre: nomApe(p, st.user && st.user.name)[0], apellidos: nomApe(p, st.user && st.user.name)[1], usuario: p.usuario || '',
    sexo: p.sexo || '', edad: p.edad ? String(p.edad) : '',
    alturaCm: p.alturaCm ? String(p.alturaCm) : '', pesoKg: p.pesoKg ? nf(p.pesoKg, 1) : '',
    pesoObjetivo: p.pesoObjetivo ? nf(p.pesoObjetivo, 1) : '',
    msg: '', saving: false,
  };
  st.view = 'onboarding';
  render();
}

function viewOnboarding() {
  const o = st.ob, s = o.step;
  const name = (st.profile && st.profile.nombre) || (st.user && st.user.name) || '';
  const pct = Math.min(100, ((s + 1) / (OB_STEPS + 1)) * 100);
  let body = '', canNext = true, nextLabel = 'Siguiente';

  if (s === 0) {
    body = `<h1 class="ob-title">${name ? `${esc(name)}, ¿qué` : '¿Qué'} quieres conseguir?</h1>
      <p class="ob-sub">Elige todos los que quieras. Los podrás cambiar cuando quieras.</p>
      <div class="choices">${GOALS.map((g) => `<button type="button" class="choice" data-act="goal" data-v="${g.id}" aria-pressed="${o.objetivos.includes(g.id)}">
        <span class="ico">${goalIcon(g)}</span><span class="t">${g.t}<small>${g.s}</small></span><span class="tick">${o.objetivos.includes(g.id) ? I.check : ''}</span></button>`).join('')}</div>`;
    canNext = o.objetivos.length > 0;
  } else if (s === 1) {
    body = `<h1 class="ob-title">¿Qué entrenas?</h1>
      <p class="ob-sub">Elige todo lo que haces. Si marcas Bici, activamos la pestaña de ciclismo (rutas y taller).</p>
      <div class="choices">${OB_ENTRENOS.map(([id, t, sub, ico]) => `<button type="button" class="choice" data-act="ent" data-v="${id}" aria-pressed="${o.entrenos.includes(id)}">
        <span class="ico">${ico()}</span><span class="t">${t}<small>${sub}</small></span><span class="tick">${o.entrenos.includes(id) ? I.check : ''}</span></button>`).join('')}</div>
      <p class="small muted">Puedes saltarte esta pregunta y cambiarlo luego en Configuración.</p>`;
  } else if (s === 2) {
    body = `<h1 class="ob-title">Cuéntanos sobre ti</h1>
      <p class="ob-sub">Con esto calculamos cuánta energía gasta tu cuerpo.</p>
      <label class="field"><span>Nombre</span><input class="input" data-ob="nombre" value="${esc(o.nombre)}" maxlength="40" autocomplete="given-name" required></label>
      <label class="field"><span>Apellidos</span><input class="input" data-ob="apellidos" value="${esc(o.apellidos)}" maxlength="60" autocomplete="family-name" required></label>
      <label class="field"><span>Nombre de usuario</span><input class="input" data-ob="usuario" value="${esc(o.usuario)}" maxlength="20" autocapitalize="none" autocomplete="username" placeholder="ej. jean_ramirez" required><small>Letras, números, _ y -, sin espacios.</small></label>
      <div class="field"><span>Sexo</span>
        <div class="pair">
          <button type="button" class="choice" data-act="sex" data-v="hombre" aria-pressed="${o.sexo === 'hombre'}"><span class="ico">${I.male}</span>Hombre</button>
          <button type="button" class="choice" data-act="sex" data-v="mujer" aria-pressed="${o.sexo === 'mujer'}"><span class="ico">${I.female}</span>Mujer</button>
        </div>
      </div>
      <label class="field"><span>Edad</span>
        <div class="big-input"><input name="edad" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(o.edad)}" placeholder="30" data-ob="edad"><em>años</em></div>
      </label>`;
    canNext = !!o.sexo && !!o.edad && !!o.nombre.trim() && !!o.apellidos.trim() && !!o.usuario;
  } else if (s === 3) {
    body = `<h1 class="ob-title">¿Cuánto mides?</h1>
      <label class="field"><span class="sr">Estatura</span>
        <div class="big-input"><input name="alturaCm" inputmode="decimal" maxlength="4" value="${esc(o.alturaCm)}" placeholder="175" data-ob="alturaCm" autofocus><em>cm</em></div>
        <small>En centímetros. Por ejemplo, 1,75 m son 175 cm.</small>
      </label>`;
    canNext = !!o.alturaCm;
  } else if (s === 4) {
    const wantsTarget = o.objetivos.some((g) => g === 'perder' || g === 'musculo');
    body = `<h1 class="ob-title">¿Cuánto pesas hoy?</h1>
      <label class="field">
        <div class="big-input"><input name="pesoKg" inputmode="decimal" maxlength="5" value="${esc(o.pesoKg)}" placeholder="72,5" data-ob="pesoKg" autofocus><em>kg</em></div>
        <small>Será el primer registro de tu historial de peso.</small>
      </label>
      <label class="field"><span>Peso objetivo ${wantsTarget ? '' : '<span class="muted">(opcional)</span>'}</span>
        <div class="big-input"><input name="pesoObjetivo" inputmode="decimal" maxlength="5" value="${esc(o.pesoObjetivo)}" placeholder="${wantsTarget ? 'Ej. 70' : 'Déjalo vacío si no tienes'}" data-ob="pesoObjetivo"><em>kg</em></div>
      </label>
      ${pesoGuiaHTML(num(o.alturaCm), o.sexo, o.objetivos, 'ob', null, o.pesoObjetivo.trim() ? num(o.pesoObjetivo) : null, o.hideSug)}`;
    canNext = !!o.pesoKg;
  } else {
    const p = obProfile();
    const v = imc(p.pesoKg, p.alturaCm);
    body = `<h1 class="ob-title">Todo listo${name ? `, ${esc(name)}` : ''}</h1>
      <p class="ob-sub">Revisa tus datos antes de empezar.</p>
      <div class="summary">
        <div class="chips">${p.objetivos.map((id) => { const g = goalById(id); return `<span class="chip">${goalIcon(g, 16)}${g.t}</span>`; }).join('')}</div>
        <dl>
          <dt>Sexo</dt><dd>${p.sexo === 'mujer' ? 'Mujer' : 'Hombre'}</dd>
          <dt>Edad</dt><dd>${p.edad} años</dd>
          <dt>Estatura</dt><dd>${p.alturaCm} cm</dd>
          <dt>Peso</dt><dd>${nf(p.pesoKg, 1)} kg</dd>
          ${p.pesoObjetivo ? `<dt>Peso objetivo</dt><dd>${nf(p.pesoObjetivo, 1)} kg</dd>` : ''}
          <dt>IMC</dt><dd>${nf(v, 1)} · ${imcLabel(v)}</dd>
          <dt>Gasto en reposo</dt><dd>${nf(bmr(p))} kcal/día</dd>
        </dl>
      </div>`;
    nextLabel = o.saving ? '<span class="spinner"></span>' : 'Empezar';
  }

  return `<form class="screen" data-form="ob" novalidate>
    <div class="ob-top">
      ${s > 0 ? `<button type="button" class="ob-back" data-act="ob-back" aria-label="Atrás">${I.back}</button>` : ''}
      <div class="ob-track" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <span class="ob-count">${s < OB_STEPS ? `${s + 1} de ${OB_STEPS}` : ''}</span>
    </div>
    <div class="ob-body">${body}
      ${o.msg ? `<div class="msg" role="alert">${esc(o.msg)}</div>` : ''}
    </div>
    <div class="ob-foot"><button class="btn block" type="submit" data-next ${canNext && !o.saving ? '' : 'disabled'}>${nextLabel}</button></div>
  </form>`;
}

function obProfile() {
  const o = st.ob;
  const obj = num(o.pesoObjetivo);
  const nombre = o.nombre.trim().replace(/\s+/g, ' '), apellidos = o.apellidos.trim().replace(/\s+/g, ' ');
  return {
    nombre, apellidos, nombreCompleto: `${nombre} ${apellidos}`, usuario: o.usuario.trim(),
    objetivos: o.objetivos, entrenos: o.entrenos, ciclismo: o.entrenos.includes('bici'), sexo: o.sexo, edad: Math.round(num(o.edad)),
    alturaCm: Math.round(num(o.alturaCm)), pesoKg: Math.round(num(o.pesoKg) * 10) / 10,
    pesoObjetivo: isFinite(obj) ? Math.round(obj * 10) / 10 : null,
    ...(o.hideSug ? { hideWeightSuggestion: true } : {}),
  };
}

function obValidate() {
  const o = st.ob, s = o.step;
  if (s === 2) {
    if (!o.nombre.trim()) return 'Escribe tu nombre.';
    if (!o.apellidos.trim()) return 'Escribe tus apellidos.';
    const ue = userErr(o.usuario.trim()); if (ue) return ue;
    const e = num(o.edad); if (!(e >= 14 && e <= 100)) return 'Escribe una edad entre 14 y 100 años.';
  }
  if (s === 3) {
    const h = num(o.alturaCm);
    if (h > 1 && h < 2.5) { o.alturaCm = String(Math.round(h * 100)); return ''; } // escribió metros
    if (!(h >= 120 && h <= 230)) return 'Escribe tu estatura en centímetros, entre 120 y 230.';
  }
  if (s === 4) {
    const w = num(o.pesoKg); if (!(w >= 30 && w <= 250)) return 'Escribe un peso entre 30 y 250 kg.';
    if (o.pesoObjetivo.trim()) { const err = objetivoInvalido(num(o.pesoObjetivo), num(o.alturaCm), o.sexo, o.objetivos); if (err) return err; }
  }
  return '';
}

async function obNext() {
  const o = st.ob;
  const err = obValidate();
  if (err) { o.msg = err; return render(); }
  o.msg = '';
  if (o.step < OB_STEPS) { o.step++; render(); focusFirst(); return; }
  // Guardar
  o.saving = true; render();
  try {
    const p = obProfile();
    const uid = st.user.uid;
    const data = { ...p, pesoInicial: p.pesoKg, fechaInicio: todayISO(), onboarded: true, novVista: NOV_V };
    data.calorias = CAL.resumen({ ...(st.profile || {}), ...data }, p.pesoKg);
    await api.saveProfile(uid, data);
    await api.addWeight(uid, todayISO(), p.pesoKg);
    st.profile = { ...(st.profile || {}), ...data };
    st.weights = await api.listWeights(uid);
    st.workouts = []; st.wk = null; st.wkHist = st.wkMod = st.wkDel = st.wkBack = false; st.rw = null; st.re = null; st.dias = {};
    st.tab = 'inicio';
    st.view = 'main';
    render();
    toast('Perfil guardado');
    R.preguntar();
  } catch (e) {
    o.saving = false; o.msg = errorText(e); render();
  }
}

function focusFirst() {
  const i = root.querySelector('.big-input input');
  if (i && !i.value) { try { i.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
}

/* ================================================================== */
/* App principal                                                       */
/* ================================================================== */
// Entreno vive en entreno-ui.js; Nutrición, Rutas, Taller, Progreso y Objetivos en secciones.js.
const W = crearEntreno({ st, root, get api() { return api; }, render, get M() { return M; }, currentKg: () => currentKg(), goalById: (id) => goalById(id), stravaBtn: () => S.syncBtnHTML() });
const { rutinaOf, homeTraining, viewEntreno, viewRutWizard, viewLive, liveBarHTML, viewWkForm, libSheetHTML, wkSave, rwNext, regSheetHTML, wkHistSheetHTML, wkDelSheetHTML, rutDelSheetHTML, rachaActual, fuegoHTML, modoSheetHTML, limiteSheetHTML, calentarSheetHTML, resumenSheetHTML, recuperacionHTML, rutShareSheetHTML } = W;
const M = crearSecciones({
  st, get api() { return api; }, render, toast, esc, num, nf, todayISO, fmtDate, lsGet, lsSet, I, E, errorText,
  currentKg: () => currentKg(), rutinaOf: () => rutinaOf(), viewPeso: (sub) => viewPeso(sub),
});

const S = crearStrava({ st, get api() { return api; }, render, toast, esc, E, currentKg: () => currentKg(), todayISO, fmtDate, lsGet, lsSet, errorText });
const R = crearRecordatorios({ st, get api() { return api; }, render, toast, esc, lsGet, lsSet, errorText, I });
let irPendiente = leerIr(); // si venimos de tocar un aviso, aquí queda la pantalla a la que ir
let stravaRet = leerRetorno(); // si venimos de la pantalla de permisos de Strava, aquí queda el código temporal

function viewMain() {
  const sheet = st.limite ? limiteSheetHTML() : st.proInfo ? proInfoHTML() : st.legal ? legalSheetHTML() : st.pf ? pfSheetHTML() : st.calentar ? calentarSheetHTML() : st.rutShare ? rutShareSheetHTML() : st.modoSel ? modoSheetHTML() : st.resumen ? resumenSheetHTML() : st.del ? delSheetHTML() : st.lib ? libSheetHTML() : st.rutDelAsk ? rutDelSheetHTML() : st.wkDel ? wkDelSheetHTML() : st.wkHist ? wkHistSheetHTML() : st.regPick ? regSheetHTML() : st.pesoDel ? pesoDelSheetHTML() : st.pesoSheet ? pesoSheetHTML() : st.pesoHist ? pesoHistSheetHTML() : st.recAsk ? R.askHTML() : st.pwd ? pwdSheetHTML() : st.cfg ? cfgSheetHTML() : M.sheet();
  if (st.rw) return viewRutWizard() + sheet;
  if (st.live && !st.liveMin) return viewLive() + sheet;
  if (st.wk) return viewWkForm();
  const tab = M.tabActual(), tabs = M.tabs();
  const body = tab === 'perfil' ? viewPerfil() : tab === 'entreno' ? viewEntreno() : tab === 'inicio' ? viewInicio() : M.view(tab);
  return `<button type="button" class="gear" data-act="cfg-open" aria-label="Configuración">${I.gear}</button><main class="main ${st.live ? 'has-live' : ''}">${body}</main>${st.live ? liveBarHTML() : ''}${sheet}${M.novModalHTML()}
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
    <header class="hello">
      <div><h1>Hola, ${esc(name)}</h1><p>${esc(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</p></div>
      <div class="hello-r">${M.novBell()}${st.profile && st.profile.isPro === true ? '<button class="protag pill" data-act="tab" data-v="perfil" aria-label="Tu plan: Cadencia Pro">Pro</button>' : ''}</div>
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
    <div class="card-head"><h2>Instala ${esc(APP_NAME)} en tu móvil</h2>${dismissable ? '<button class="iconbtn" data-act="install-hide" aria-label="Ocultar">✕</button>' : ''}</div>
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

// Silueta humana de puntos: se rellena de abajo arriba con el % indicado.
function silueta(fill, id, cls = '') {
  const f = Math.max(0, Math.min(100, fill == null ? 0 : fill)), y0 = 200 - (f / 100) * 200;
  return `<svg class="sil ${cls}" viewBox="0 0 100 200" role="img" aria-hidden="true">
    <defs><pattern id="d-${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="4" height="4" x="1" y="1" style="fill:var(--sil-off)"/></pattern><pattern id="y-${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="4" height="4" x="1" y="1" fill="#F2BE1A"/></pattern>
      <clipPath id="c-${id}"><circle cx="50" cy="20" r="14"/><path d="M30 42H70L88 50L95 112L84 114L78 70L74 70L72 112L74 198H54L50 130L46 198H26L28 112L26 70L22 70L16 114L5 112L12 50Z"/></clipPath></defs>
    <g clip-path="url(#c-${id})"><rect width="100" height="200" fill="url(#d-${id})"/><rect y="${y0.toFixed(1)}" width="100" height="${(200 - y0).toFixed(1)}" fill="url(#y-${id})"/></g>
  </svg>`;
}

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
    if (!con.length) return `<button type="button" class="cg" data-act="comp-ver" data-v="${c.k}"><span class="label">${c.t}</span>${silueta(0, 'g' + c.k)}<span class="val num">—</span><span class="hint">Sin datos todavía</span></button>`;
    const last = con[con.length - 1], p = pctOf(c, last), k = kgOf(c, last);
    const sec = c.u === '%' ? (k != null ? `≈ ${nf(k, 1)} kg` : '') : (p != null ? `${nf(p, 1)} % del peso` : '');
    return `<button type="button" class="cg" data-act="comp-ver" data-v="${c.k}"><span class="label">${c.t}</span>${silueta(p == null ? 0 : Math.max(p, 6), 'g' + c.k)}
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
    <div class="det-sil">${silueta(p == null ? 0 : Math.max(p, 4), 'det', 'big')}</div>
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
async function saveWeight(fecha, raw, comp = {}, unit = 'pct', editando = false, keep = {}) {
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
function planCardHTML() {
  const pr = st.profile || {}, pro = pr.isPro === true;
  const dia = (ms) => fmtDate(new Date(ms).toISOString().slice(0, 10));
  const renueva = pro && pr.proRenueva ? (pr.proCancela ? `Tu suscripción está cancelada: sigues con Pro hasta el <b>${dia(pr.proRenueva)}</b>.` : `Próxima renovación: <b>${dia(pr.proRenueva)}</b>.`) : '';
  if (!pro) return `<section class="card" id="plan-card">
      <div class="card-head"><h2>Tu plan</h2><span class="tag" id="plan-tag">Gratuita</span></div>
      <p class="small muted">El registro manual, las rutinas, las rutas y el resto de la app son gratis. Con Pro desbloqueas la IA: Escanear alimento y recomendaciones del Taller.</p>
      <button class="btn block" data-act="pro-open" data-v="perfil">Hazte Pro</button>
    </section>`;
  return `<section class="card" id="plan-card">
      <div class="card-head"><h2>Tu plan</h2><span class="tag ok" id="plan-tag">Pro</span></div>
      <p><b>Cadencia Pro</b></p>
      <p class="small muted">Incluye Escanear alimento, recomendaciones del Taller con IA y 10 consultas de IA al día. ${renueva}</p>
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
      ${p.isPro === true ? '<span class="pro-badge">👑 PRO</span>' : ''}
      <p class="small muted">${esc(st.user.email || '')}</p>
      <button type="button" class="btn ghost small" data-act="pf-open" data-v="editar">Editar perfil</button></header>
    ${planCardHTML()}
    ${pfGrupo('Cuenta', [
      pfRow('crown', 'Administrar suscripción', { act: 'pf-open', v: 'suscripcion', val: p.isPro === true ? 'PRO' : 'Gratuita' }),
      pfRow('user', 'Detalles personales', { act: 'pf-open', v: 'detalles' }),
      pfRow('sliders', 'Preferencias', { act: 'pf-open', v: 'prefs', val: tema }),
      pfRow('globe', 'Idioma', { act: 'pf-open', v: 'idioma', val: idioma }),
      pfRow('link', 'Integraciones', { act: 'pf-open', v: 'integraciones', val: S.conectado() ? 'Strava' : '' }),
      tienePass() ? pfRow('key', 'Modificar contraseña', { act: 'pwd-open' }) : '',
      tieneGoogle() ? pfRow('link', 'Cuenta de Google', { tag: '<span class="tag ok">Vinculada</span>' }) : pfRow('link', 'Vincular cuenta de Google', { act: 'google-link' }),
    ])}
    ${pfGrupo('Soporte y legal', [
      pfRow('zap', 'Solicitar una función', { act: 'pf-open', v: 'func' }),
      pfRow('mail', 'Correo de soporte', { href: `mailto:${CONTACTO}?subject=${encodeURIComponent('Soporte Cadencia')}` }),
      pfRow('help', 'FAQ', { act: 'pf-open', v: 'faq' }),
      pfRow('file', 'Términos y condiciones', { act: 'pf-open', v: 'terminos' }),
      pfRow('shield', 'Política de privacidad', { act: 'pf-open', v: 'privacidad' }),
    ])}
    ${pfGrupo('Acciones de la cuenta', [
      pfRow('out', 'Cerrar sesión', { act: 'logout', cls: 'mute' }),
      pfRow('trash', 'Eliminar cuenta', { act: 'del-open', cls: 'danger' }),
    ])}
    <p class="small muted pf-foot">${api.mode === 'firebase' ? 'Tus datos se guardan en la nube y los verás en cualquier dispositivo.' : 'Modo prueba: tus datos se guardan solo en este dispositivo.'}</p>`;
}

const PF_TITULO = { editar: 'Editar perfil', detalles: 'Detalles personales', prefs: 'Preferencias', idioma: 'Idioma', suscripcion: 'Administrar suscripción', integraciones: 'Integraciones', func: 'Solicitar una función', faq: 'Preguntas frecuentes', terminos: 'Términos y condiciones', privacidad: 'Política de privacidad' };
const pfV = (k, d) => (st.pf.f && k in st.pf.f ? st.pf.f[k] : d); // lo escrito se conserva si la hoja se redibuja (p. ej. tras cambiar la foto)
// El texto legal es uno solo (legal.js); cada vista toma las secciones que le tocan.
const pfLegal = (re) => `<div class="sheet-list legal">${legalHTML().split(/(?=<h3>)/).filter((x) => re.test(x.slice(0, 60))).join('')}</div>`;

// «Guardar» solo se activa cuando algún valor es distinto del que había al abrir la hoja.
const pfCambios = () => { const P = st.pf, g = (x) => JSON.stringify([...(x || [])].sort()); return !!P.ini && (Object.keys(P.f).some((k) => k in P.ini && P.f[k] !== P.ini[k]) || (P.v === 'detalles' && !!st.editGoals && g(st.editGoals) !== g(st.profile.objetivos))); };
const pfGuardarBtn = () => `<button class="btn block" type="submit" id="pf-save" ${st.pf.busy ? 'disabled' : pfCambios() ? '' : 'disabled'}>${st.pf.busy ? '<span class="spinner"></span>' : 'Guardar'}</button>`;
const pfBtn = () => { const b = document.getElementById('pf-save'); if (b && st.pf && !st.pf.busy) b.disabled = !pfCambios(); };

function pfCuerpo(v) {
  const p = st.profile;
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
    st.pf.ini = { alturaCm: String(p.alturaCm || ''), pesoKg: kg ? nf(kg, 1) : '', fechaNac: p.fechaNac || '', sexo: p.sexo === 'mujer' ? 'mujer' : 'hombre', pesoObjetivo: p.pesoObjetivo ? nf(p.pesoObjetivo, 1) : '' };
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
      ${pesoGuiaHTML(p.alturaCm, p.sexo, goals, 'perfil', grasaActual(), p.pesoObjetivo, p.hideWeightSuggestion === true)}
      ${pfGuardarBtn()}</form>`;
  }
  if (v === 'prefs') {
    const t = themePref();
    return `<div class="sheet-list"><section class="card"><h2>Apariencia</h2>
      <div class="seg" role="group" aria-label="Tema">${[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Sistema']].map(([k, l]) => `<button type="button" data-act="theme" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div>
      <p class="small muted">${t === 'system' ? 'Sigue el modo claro u oscuro de tu móvil.' : t === 'light' ? 'Fondo claro con el mismo amarillo.' : 'Negro y amarillo, el estilo de Cadencia.'}</p></section></div>`;
  }
  if (v === 'suscripcion') return suscripcionHTML();
  if (v === 'integraciones') return `<div class="sheet-list">${S.integracionesHTML()}</div>`;
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
      ['¿Mis datos son privados?', 'Sí. Solo tú puedes verlos y no los compartimos con anunciantes. Puedes borrarlos cuando quieras con «Eliminar cuenta».']];
    return `<div class="sheet-list">${Q.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p class="small muted">${a}</p></details>`).join('')}</div>`;
  }
  return pfLegal(v === 'terminos' ? /Aviso|Términos/ : /Privacidad/);
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
const cmpCelda = (v) => v === true ? '<span class="cmp-y" role="img" aria-label="Incluido">✓</span>' : v === false ? '<span class="cmp-n" role="img" aria-label="No incluido">✗</span>' : `<span class="cmp-t">${v}</span>`;
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
  const sel = (st.pf && st.pf.plan) || act || 'anual';
  const nomAct = act ? PLANES.find((x) => x.id === act).n.replace('PRO ', '') : '';
  return `<div class="sheet-list sub">
    <section class="sub-sec"><h3 class="pf-title">Suscripción actual</h3>
      <div class="sub-cur ${pro ? 'is-pro' : ''}"><b>${pro ? `Cadencia PRO${nomAct ? ` <span class="sub-dot">• ${nomAct}</span>` : ''}` : 'Suscripción Gratuita'}</b>
        <span class="small muted">${pro ? 'Tienes todas las funciones Pro desbloqueadas.' : 'Pásate a PRO para desbloquear todas las funciones.'}</span></div></section>
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
      <div class="sheet-head"><span style="width:36px"></span><h2>Gratis vs PRO</h2><button type="button" class="iconbtn" data-act="pro-info-close" aria-label="Cerrar">${I.close || '✕'}</button></div>
      <div class="pinfo-scroll"><table class="cmp">
        <thead><tr><th scope="col"><span class="sr">Función</span></th><th scope="col">Gratis</th><th scope="col" class="cmp-pro">PRO</th></tr></thead>
        <tbody>${COMPARATIVA.map(([f, g, p, d]) => `<tr><th scope="row">${f}${d ? `<small class="cmp-d">${d}</small>` : ''}</th><td>${cmpCelda(g)}</td><td class="cmp-pro">${cmpCelda(p)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="pinfo-foot"><button type="button" class="btn block" data-act="pro-info-close">${pro ? 'Cerrar' : 'Elegir Plan'}</button></div>
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
        <section class="card"><h2>Funciones</h2>
          <div class="rec-row"><div class="rec-t"><b id="cfg-cic">Mostrar funciones de Ciclismo</b><span class="small muted">Pestaña Bici con rutas, mapa y taller de tu bici.</span></div>
            <button type="button" class="switch" role="switch" aria-checked="${M.tieneBici()}" aria-labelledby="cfg-cic" data-act="cfg-cic"><i></i></button></div>
        </section>
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
  st.user = u; st.busy = false;
  if (!u && M) M.pararPro();
  if (!u) { st.cfg = st.pwd = st.pf = st.proInfo = st.rutShare = null; st.pesoHist = st.pesoComp = st.pesoDel = st.pesoSheet = st.pesoEdit = null; st.recAsk = null; st.del = null; st.legal = false; st.view = 'auth'; st.profile = null; st.weights = []; st.workouts = []; st.wk = null; st.rw = null; st.re = null; st.live = null; st.lib = null; st.food = null; st.tl = null; st.dias = {}; st.nDate = null; return render(); }
  try {
    st.profile = await api.getProfile(u.uid);
    if (!st.profile || !st.profile.onboarded) return startOnboarding();
    st.weights = await api.listWeights(u.uid);
    st.workouts = await api.listWorkouts(u.uid);
    await M.cargar(u.uid);
    E.setPropios(st.profile.ejPropios);
    // Si cerraste la app a mitad de un entrenamiento de fuerza, sigue donde lo dejaste.
    try { const sv = JSON.parse(lsGet('cadencia-live') || 'null'); if (sv && sv.uid === u.uid && Array.isArray(sv.ex)) { st.live = sv; st.liveMin = true; } } catch (e) { /* nada */ }
    st.view = 'main';
    render();
    const llegoConDestino = !!(stravaRet || irPendiente);
    if (stravaRet) { const r = stravaRet; stravaRet = null; S.vuelta(r); }
    else if (irPendiente) { const d = irPendiente; irPendiente = null; st.tab = d.tab; lsSet('cadencia-tab', d.tab); if (d.hoja === 'peso') st.pesoSheet = true; render(); }
    R.mantener();
    if (!llegoConDestino) R.preguntar();
  } catch (e) {
    st.errText = errorText(e); st.view = 'error'; render();
  }
}

root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tap')) { e.preventDefault(); e.target.click(); } });
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  if (b.closest('.nov-modal') && act !== 'nov-ok') M.novCerrar();
  if (R.click(act, v)) return; // sin esperar a nada: el permiso de notificaciones debe pedirse al instante del toque
  if (await S.click(act, v)) return;
  if (await M.click(act, v, b)) return;
  if (act === 'mode') { st.authMode = v; st.authMsg = null; const f = root.querySelector('form'); const email = f && f.email.value; render(); keepForm({ email }); }
  else if (act === 'legal-open') { if (st.view === 'auth') { const f = root.querySelector('form'); st.authKeep = f ? { name: f.name ? f.name.value : '', email: f.email.value, pass: f.pass.value, acepto: f.acepto ? f.acepto.checked : false } : null; } st.legal = true; render(); if (st.authKeep) keepForm(st.authKeep); }
  else if (act === 'legal-close') { st.legal = false; render(); if (st.view === 'auth' && st.authKeep) { keepForm(st.authKeep); st.authKeep = null; } }
  else if (act === 'pf-open') { st.pf = { v, f: {}, busy: false }; st.editGoals = null; render(); }
  else if (act === 'plan-sel') { if (planActivo() === 'siempre' && RECURRENTES.includes(v)) return; const actual = (st.pf && st.pf.plan) || planActivo() || 'anual'; if (v === actual) return; if (st.pf && PLANES.some((x) => x.id === v)) { st.pf.plan = v; if (!pintarSeleccion(v)) render(); } }
  else if (act === 'plan-go') { const pa = planActivo(), el = (st.pf && st.pf.plan) || pa || 'anual'; if (subCta(el, pa).act !== 'plan-go') return; const url = planUrl((st.pf && st.pf.plan) || 'anual', st.user); if (!url) { toast('La suscripción estará disponible muy pronto.'); return; } const w = window.open(url, '_blank'); if (!w) location.assign(url); }
  else if (act === 'pro-info-open') { st.proInfo = true; render(); }
  else if (act === 'pro-info-close') { st.proInfo = null; render(); }
  else if (act === 'pf-close') { st.pf = null; st.editGoals = null; render(); }
  else if (act === 'pf-idioma') { st.profile.idioma = v; render(); try { await api.saveProfile(st.user.uid, { idioma: v }); } catch (e) { toast(errorText(e)); } }
  else if (act === 'del-open') { st.del = { pass: '', txt: '', msg: '', busy: false }; render(); }
  else if (act === 'del-close') { if (!st.del || !st.del.busy) { st.del = null; render(); } }
  else if (act === 'peek') { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Ver' : 'Ocultar'; }
  else if (act === 'forgot') onForgot();
  else if (act === 'goal') { const g = st.ob.objetivos; st.ob.objetivos = g.includes(v) ? g.filter((x) => x !== v) : [...g, v]; render(); }
  else if (act === 'ent') { const g = st.ob.entrenos; st.ob.entrenos = g.includes(v) ? g.filter((x) => x !== v) : [...g, v]; render(); }
  else if (act === 'sex') { st.ob.sexo = v; render(); }
  else if (act === 'ob-back') { st.ob.step = Math.max(0, st.ob.step - 1); st.ob.msg = ''; render(); }
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
  else if (act === 'psex') { const f = b.closest('form'); f.sexo.value = v; if (st.pf) { st.pf.f.sexo = v; pfBtn(); } b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
  else if (act === 'pgoal') {
    const g = st.editGoals || [...(st.profile.objetivos || [])];
    st.editGoals = g.includes(v) ? g.filter((x) => x !== v) : [...g, v];
    b.setAttribute('aria-pressed', String(st.editGoals.includes(v)));
    b.querySelector('.tick').innerHTML = st.editGoals.includes(v) ? I.check : '';
    if (st.pf) pfBtn();
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
  else if (act === 'logout') { st.tab = 'inicio'; st.authMode = 'login'; st.authMsg = null; lsSet('cadencia-tab', null); await api.logout(); }
  else if (act === 'retry') { st.view = 'boot'; enter(st.user); }
});

root.addEventListener('input', (e) => {
  if (st.del && e.target.dataset.del) {
    st.del[e.target.dataset.del] = e.target.value;
    const go = document.getElementById('del-go'); if (go) go.disabled = !(st.del.txt.trim().toUpperCase() === 'BORRAR' && st.del.pass) || st.del.busy;
    return;
  }
  if (e.target.closest && e.target.closest('form[data-form="addweight"]')) { if (e.target.dataset && e.target.dataset.comp) e.target.dataset.tocado = '1'; pesoHints(); return; }
  if (st.pf && e.target.name && e.target.closest('form[data-form^="pf-"]')) { st.pf.f[e.target.name] = e.target.value; pfBtn(); }
  if (st.view === 'main' && M.input(e.target)) return;
  const k = e.target.dataset && e.target.dataset.ob;
  if (!k || !st.ob) return;
  st.ob[k] = e.target.value;
  // activar/desactivar «Siguiente» sin redibujar (para no perder el foco del teclado)
  const o = st.ob, next = root.querySelector('[data-next]');
  const ok = o.step === 2 ? !!o.sexo && !!o.edad && !!o.nombre.trim() && !!o.apellidos.trim() && !!o.usuario : o.step === 3 ? !!o.alturaCm : o.step === 4 ? !!o.pesoKg : true;
  if (next) next.disabled = !ok;
});

root.addEventListener('change', async (e) => { if (st.view === 'main') { if (e.target.matches && e.target.matches('select[data-comp-sel]')) { st.pesoComp = e.target.value; st.pesoModo = 'kg'; render(); return; }  if (e.target.matches && e.target.matches('input[data-foto]')) { const f = e.target.files && e.target.files[0]; e.target.value = ''; return subirFoto(f); } if (R.change(e.target)) return; await M.change(e.target); } });

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, kind = f.dataset.form;
  if (await M.submit(kind, f)) return;
  if (kind === 'login') onLogin(f);
  else if (kind === 'register') onRegister(f);
  else if (kind === 'ob') obNext();
  else if (kind === 'addweight') saveWeight(f.fecha.value, f.kg.value, { grasa: f.grasa.value, musculo: f.musculo.value, agua: f.agua.value, hueso: f.hueso.value }, pesoUnit(), !!f.dataset.edit, keepEdit(f));
  else if (kind.startsWith('pf-')) pfGuardar(kind, f);
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
