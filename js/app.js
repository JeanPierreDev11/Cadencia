import { createBackend, errorText } from './data.js';
import { APP_NAME } from './config.js';
import * as E from './entreno.js';

/* ================================================================== */
/* Utilidades                                                          */
/* ================================================================== */
const root = document.getElementById('root');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { if (v == null) return NaN; const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() === '' ? NaN : n; };
const nf = (n, d = 0) => (n == null || !isFinite(n) ? '–' : n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', opts); } catch (e) { return iso; } };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

let toastTimer;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- iconos ---------- */
const I = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9.5a5 5 0 0 1 8 0M12 9.5l1.5-2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bike: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h6l2 7M10 9l3.5 7M9 6h2.5"/></svg>',
  dumb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M7.5 11.5h2.5l1.5-2.5 2 4 1.5-1.5h1.5"/></svg>',
  ball: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M4.5 9.5c4.5 1.4 10.5 1.4 15 0M4.5 14.5c4.5-1.4 10.5-1.4 15 0"/></svg>',
  swap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg>',
  spark: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5L9 15M15 9l2.5-2.5"/></svg>',
  pencil: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  plusBig: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  male: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="14" r="6"/><path d="M14.5 9.5L20 4M15 4h5v5"/></svg>',
  female: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 19h6"/></svg>',
};

/* ---------- objetivos ---------- */
const GOALS = [
  { id: 'perder', t: 'Perder grasa', s: 'Bajar peso sin perder fuerza', ico: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: 'musculo', t: 'Ganar músculo', s: 'Más fuerza en piernas y tronco', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'rendimiento', t: 'Rendir más en la bici', s: 'Más potencia y fondo en las subidas', ico: '<path d="M3 18l6-8 4 5 3-4 5 7"/>' },
  { id: 'prueba', t: 'Preparar una marcha', s: 'Llegar en forma a una fecha concreta', ico: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>' },
  { id: 'mantener', t: 'Mantener mi peso', s: 'Estable y con energía', ico: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>' },
  { id: 'salud', t: 'Ganar salud', s: 'Dormir mejor, menos estrés, más vitalidad', ico: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
];
const goalIcon = (g, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${g.ico}</svg>`;
const goalById = (id) => GOALS.find((g) => g.id === id);

/* ---------- cálculos ---------- */
const imc = (kg, cm) => (kg > 0 && cm > 0 ? kg / Math.pow(cm / 100, 2) : NaN);
const imcLabel = (v) => (!isFinite(v) ? '' : v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad');
// Mifflin-St Jeor: calorías que gasta el cuerpo en reposo.
const bmr = (p) => (p && p.pesoKg && p.alturaCm && p.edad ? Math.round(10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.edad + (p.sexo === 'mujer' ? -161 : 5)) : NaN);

/* ---------- instalación ---------- */
let installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (st.view === 'main') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('App instalada'); if (st.view === 'main') render(); });

/* ---------- tema ---------- */
const applyTheme = () => { const t = lsGet('cadencia-theme'); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme();

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
  document.body.classList.toggle('noscroll', !!st.lib);
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
        ${reg ? `<label class="field"><span>Nombre</span><input class="input" name="name" autocomplete="given-name" required placeholder="Cómo quieres que te llamemos"></label>` : ''}
        <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="tu@email.com"></label>
        <label class="field"><span>Contraseña</span>
          <div class="pass-wrap"><input class="input" type="password" name="pass" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${reg ? 'Mínimo 6 caracteres' : ''}"><button type="button" data-act="peek">Ver</button></div>
        </label>
        ${m ? `<div class="msg ${m.ok ? 'ok' : ''}" role="alert">${esc(m.text)}</div>` : ''}
        <button class="btn block" type="submit" ${st.busy ? 'disabled' : ''}>${st.busy ? '<span class="spinner"></span>' : reg ? 'Crear cuenta' : 'Entrar'}</button>
        ${reg ? '' : '<button type="button" class="link" data-act="forgot">He olvidado mi contraseña</button>'}
      </form>
      ${api.mode === 'local' ? `<p class="note"><span>●</span><span><b>Modo prueba.</b> Las cuentas y los datos se guardan solo en este dispositivo hasta que conectes Firebase.</span></p>` : ''}
    </div>
  </div>`;
}

async function onLogin(form) {
  const email = form.email.value.trim(), pass = form.pass.value;
  if (!email || !pass) { st.authMsg = { text: 'Escribe tu email y tu contraseña.' }; return render(); }
  st.busy = true; st.authMsg = null; render();
  try { await api.login(email, pass); } catch (e) { st.authMsg = { text: errorText(e) }; st.busy = false; render(); keepForm({ email }); }
}

async function onRegister(form) {
  const name = form.name.value.trim(), email = form.email.value.trim(), pass = form.pass.value;
  if (!name) { st.authMsg = { text: 'Escribe tu nombre.' }; render(); return keepForm({ email }); }
  if (!email) { st.authMsg = { text: 'Escribe tu email.' }; render(); return keepForm({ name }); }
  if (pass.length < 6) { st.authMsg = { text: 'La contraseña necesita al menos 6 caracteres.' }; render(); return keepForm({ name, email }); }
  st.busy = true; st.authMsg = null; st.registering = true; render();
  try {
    const u = await api.register(name, email, pass);
    st.registering = false;
    await enter(u);
  } catch (e) {
    st.registering = false; st.busy = false; st.authMsg = { text: errorText(e) }; render(); keepForm({ name, email });
  }
}

function keepForm(vals) {
  const f = root.querySelector('form');
  if (!f) return;
  Object.entries(vals).forEach(([k, v]) => { if (f[k]) f[k].value = v; });
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
const OB_STEPS = 4; // objetivos, sobre ti, estatura, peso (+ resumen)

function startOnboarding() {
  const p = st.profile || {};
  st.ob = {
    step: 0,
    objetivos: p.objetivos || [],
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
    body = `<h1 class="ob-title">Cuéntanos sobre ti</h1>
      <p class="ob-sub">Con esto calculamos cuánta energía gasta tu cuerpo.</p>
      <div class="field"><span>Sexo</span>
        <div class="pair">
          <button type="button" class="choice" data-act="sex" data-v="hombre" aria-pressed="${o.sexo === 'hombre'}"><span class="ico">${I.male}</span>Hombre</button>
          <button type="button" class="choice" data-act="sex" data-v="mujer" aria-pressed="${o.sexo === 'mujer'}"><span class="ico">${I.female}</span>Mujer</button>
        </div>
      </div>
      <label class="field"><span>Edad</span>
        <div class="big-input"><input name="edad" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(o.edad)}" placeholder="30" data-ob="edad"><em>años</em></div>
      </label>`;
    canNext = !!o.sexo && !!o.edad;
  } else if (s === 2) {
    body = `<h1 class="ob-title">¿Cuánto mides?</h1>
      <label class="field"><span class="sr">Estatura</span>
        <div class="big-input"><input name="alturaCm" inputmode="decimal" maxlength="4" value="${esc(o.alturaCm)}" placeholder="175" data-ob="alturaCm" autofocus><em>cm</em></div>
        <small>En centímetros. Por ejemplo, 1,75 m son 175 cm.</small>
      </label>`;
    canNext = !!o.alturaCm;
  } else if (s === 3) {
    const wantsTarget = o.objetivos.some((g) => g === 'perder' || g === 'musculo');
    body = `<h1 class="ob-title">¿Cuánto pesas hoy?</h1>
      <label class="field">
        <div class="big-input"><input name="pesoKg" inputmode="decimal" maxlength="5" value="${esc(o.pesoKg)}" placeholder="72,5" data-ob="pesoKg" autofocus><em>kg</em></div>
        <small>Será el primer registro de tu historial de peso.</small>
      </label>
      <label class="field"><span>Peso objetivo ${wantsTarget ? '' : '<span class="muted">(opcional)</span>'}</span>
        <div class="big-input"><input name="pesoObjetivo" inputmode="decimal" maxlength="5" value="${esc(o.pesoObjetivo)}" placeholder="${wantsTarget ? 'Ej. 70' : 'Déjalo vacío si no tienes'}" data-ob="pesoObjetivo"><em>kg</em></div>
      </label>
      ${pesoGuiaHTML(num(o.alturaCm), o.sexo, o.objetivos, 'ob')}`;
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
  return {
    objetivos: o.objetivos, sexo: o.sexo, edad: Math.round(num(o.edad)),
    alturaCm: Math.round(num(o.alturaCm)), pesoKg: Math.round(num(o.pesoKg) * 10) / 10,
    pesoObjetivo: isFinite(obj) ? Math.round(obj * 10) / 10 : null,
  };
}

function obValidate() {
  const o = st.ob, s = o.step;
  if (s === 1) { const e = num(o.edad); if (!(e >= 14 && e <= 100)) return 'Escribe una edad entre 14 y 100 años.'; }
  if (s === 2) {
    const h = num(o.alturaCm);
    if (h > 1 && h < 2.5) { o.alturaCm = String(Math.round(h * 100)); return ''; } // escribió metros
    if (!(h >= 120 && h <= 230)) return 'Escribe tu estatura en centímetros, entre 120 y 230.';
  }
  if (s === 3) {
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
    const data = { ...p, pesoInicial: p.pesoKg, fechaInicio: todayISO(), onboarded: true };
    if (!st.profile || !st.profile.nombre) data.nombre = st.user.name || '';
    await api.saveProfile(uid, data);
    await api.addWeight(uid, todayISO(), p.pesoKg);
    st.profile = { ...(st.profile || {}), ...data };
    st.weights = await api.listWeights(uid);
    st.workouts = []; st.wk = null; st.rw = null; st.re = null;
    st.tab = 'inicio';
    st.view = 'main';
    render();
    toast('Perfil guardado');
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
const TABS = [
  { id: 'inicio', t: 'Inicio', ico: I.home },
  { id: 'entreno', t: 'Entreno', ico: I.pulse },
  { id: 'peso', t: 'Peso', ico: I.scale },
  { id: 'perfil', t: 'Perfil', ico: I.user },
];

function viewMain() {
  const sheet = st.lib ? libSheetHTML() : '';
  if (st.rw) return viewRutWizard() + sheet;
  if (st.live && !st.liveMin) return viewLive() + sheet;
  if (st.wk) return viewWkForm();
  const body = st.tab === 'peso' ? viewPeso() : st.tab === 'perfil' ? viewPerfil() : st.tab === 'entreno' ? viewEntreno() : viewInicio();
  return `<main class="main ${st.live ? 'has-live' : ''}">${body}</main>${st.live ? liveBarHTML() : ''}${sheet}
  <div class="tabbar"><nav aria-label="Secciones">${TABS.map((t) => `<button type="button" data-act="tab" data-v="${t.id}" ${st.tab === t.id ? 'aria-current="page"' : ''}>${t.ico}<span>${t.t}</span></button>`).join('')}</nav></div>`;
}

const latestWeight = () => (st.weights.length ? st.weights[st.weights.length - 1] : null);
const currentKg = () => { const l = latestWeight(); return l ? l.kg : st.profile.pesoKg; };

function viewInicio() {
  const p = st.profile, kg = currentKg();
  const name = p.nombre || st.user.name || '';
  const first = st.weights[0];
  const delta = first && st.weights.length > 1 ? kg - first.kg : null;
  const v = imc(kg, p.alturaCm);
  const b = bmr({ ...p, pesoKg: kg });
  const todayLogged = latestWeight() && latestWeight().fecha === todayISO();

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
      <button class="avatar" data-act="tab" data-v="perfil" aria-label="Tu perfil">${esc((name || '?').trim().charAt(0).toUpperCase())}</button>
    </header>

    <section class="card weight-hero">
      <h2>Peso actual</h2>
      <div class="big num">${nf(kg, 1)}<em>kg</em></div>
      ${delta != null ? `<div class="delta">${delta > 0 ? '+' : delta < 0 ? '−' : ''}${nf(Math.abs(delta), 1)} kg desde el ${fmtDate(first.fecha, { day: 'numeric', month: 'long' })}</div>` : '<div class="delta">Registra tu peso cada pocos días para ver cómo evoluciona.</div>'}
      ${goal}
    </section>

    <section class="card">
      <div class="card-head"><h2>${todayLogged ? 'Peso de hoy registrado' : '¿Te has pesado hoy?'}</h2></div>
      <form class="quick" data-form="quickweight" novalidate>
        <input class="input" name="kg" inputmode="decimal" placeholder="${todayLogged ? 'Corregir: ' + nf(latestWeight().kg, 1) : 'Peso en kg'}" aria-label="Peso de hoy en kg">
        <button class="btn" type="submit">Guardar</button>
      </form>
    </section>

    ${homeTraining()}

    <div class="stats">
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
    </div>

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
// Rango saludable por IMC (18,5–25; hasta 27,5 si buscas ganar músculo) y un peso ideal orientativo (IMC 22,5 hombres / 21,5 mujeres).
function rangoPeso(cm, sexo, objetivos) {
  const h = cm / 100;
  if (!(h >= 1.2 && h <= 2.3)) return null;
  const r = (v) => Math.round(v * 2) / 2;
  const imcMax = (objetivos || []).includes('musculo') ? 27.5 : 25;
  return { min: r(18.5 * h * h), max: r(imcMax * h * h), ideal: r((sexo === 'mujer' ? 21.5 : 22.5) * h * h), imcMax };
}
function objetivoInvalido(t, cm, sexo, objetivos) {
  if (!isFinite(t)) return 'Escribe el peso objetivo con números, o déjalo vacío.';
  const r = rangoPeso(cm, sexo, objetivos);
  if (!r) return t >= 30 && t <= 250 ? '' : 'El peso objetivo tiene que estar entre 30 y 250 kg.';
  if (t < r.min) return `Con ${nf(cm / 100, 2)} m, por debajo de ${nf(r.min, 1)} kg tendrías bajo peso. Elige un objetivo entre ${nf(r.min, 1)} y ${nf(r.max, 1)} kg.`;
  if (t > r.max) return `Con ${nf(cm / 100, 2)} m, el objetivo saludable llega hasta ${nf(r.max, 1)} kg. Elige un objetivo entre ${nf(r.min, 1)} y ${nf(r.max, 1)} kg.`;
  return '';
}
function pesoGuiaHTML(cm, sexo, objetivos, ctx) {
  const r = rangoPeso(cm, sexo, objetivos);
  if (!r) return '';
  return `<div class="guia">
    <p><b>Peso ideal orientativo: ${nf(r.ideal, 1)} kg</b> <button type="button" class="link" data-act="peso-ideal" data-ctx="${ctx}" data-v="${r.ideal}">Usar este</button></p>
    <p class="small muted">Para ${nf(cm / 100, 2)} m, un objetivo saludable está entre ${nf(r.min, 1)} y ${nf(r.max, 1)} kg${r.imcMax > 25 ? ' (hemos ampliado el máximo porque quieres ganar músculo)' : ''}. Es una guía basada en el IMC: no tiene en cuenta tu musculatura.</p>
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
function chart(points, target, label = 'Evolución del peso') {
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
    ${ticks.map((t) => `<line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${nf(t, 0)}</text>`).join('')}
    ${target ? `<line class="tg" x1="${P.l}" x2="${W - P.r}" y1="${y(target)}" y2="${y(target)}"/>` : ''}
    <path class="ar" d="${area}"/><path class="ln" d="${d}"/>
    ${points.length <= 40 ? points.map((p) => `<circle class="dot" r="3.5" cx="${x(p.fecha)}" cy="${y(p.kg)}"/>`).join('') : ''}
    <text x="${P.l}" y="${H - 4}">${fmtDate(points[0].fecha)}</text>
    <text x="${W - P.r}" y="${H - 4}" text-anchor="end">${fmtDate(points[points.length - 1].fecha)}</text>
  </svg>`;
}

function compCardHTML(ws) {
  const items = COMP.slice(1).map((c) => {
    const con = ws.filter((w) => w[c.k] != null);
    if (!con.length) return '';
    const last = con[con.length - 1], first = con[0], dd = con.length > 1 ? last[c.k] - first[c.k] : null;
    const extra = c.k === 'grasa' && last.kg ? `≈ ${nf((last.kg * last.grasa) / 100, 1)} kg de grasa` : c.k === 'agua' && last.kg ? `≈ ${nf((last.kg * last.agua) / 100, 1)} kg de agua` : '';
    return `<section class="stat"><span class="label">${c.t}</span><span class="val num">${nf(last[c.k], 1)}<em>${c.u}</em></span>
      <span class="hint">${dd != null ? `${dd > 0 ? '+' : dd < 0 ? '−' : '±'}${nf(Math.abs(dd), 1)} ${c.u} desde el ${esc(fmtDate(first.fecha))}` : 'Primer registro'}${extra ? `<br>${extra}` : ''}</span></section>`;
  }).join('');
  return items ? `<div class="stats">${items}</div>` : '';
}

function viewPeso() {
  const ws = st.weights, p = st.profile;
  const rows = ws.slice().reverse();
  const disp = COMP.filter((c) => c.k === 'kg' || ws.some((w) => w[c.k] != null));
  const met = disp.find((c) => c.k === st.pesoMet) || COMP[0];
  const pts = ws.filter((w) => w[met.k] != null).slice(-90).map((w) => ({ fecha: w.fecha, kg: w[met.k] }));
  const compTxt = (w) => COMP.slice(1).filter((c) => w[c.k] != null).map((c) => `${c.t} ${nf(w[c.k], 1)} ${c.u}`).join(' · ');
  return `
    <header class="hello"><div><h1>Peso</h1><p>${ws.length} ${ws.length === 1 ? 'registro' : 'registros'}${p.pesoObjetivo ? ` · objetivo ${nf(p.pesoObjetivo, 1)} kg` : ''}</p></div></header>
    <section class="card">
      <h2>Evolución</h2>
      ${disp.length > 1 ? `<div class="seg" role="group" aria-label="Qué ver">${disp.map((c) => `<button type="button" data-act="pesomet" data-v="${c.k}" aria-pressed="${met.k === c.k}">${c.t}</button>`).join('')}</div>` : ''}
      ${pts.length >= 2 ? chart(pts, met.k === 'kg' ? p.pesoObjetivo : null, `Evolución de ${met.t.toLowerCase()}`) : `<div class="empty"><b>Aún no hay gráfica</b><span>Con dos registros verás aquí cómo cambia ${met.k === 'kg' ? 'tu peso' : 'tu ' + met.t.toLowerCase()}.</span></div>`}
    </section>
    ${compCardHTML(ws)}
    <section class="card">
      <h2>Añadir registro</h2>
      <form class="form-grid" data-form="addweight" novalidate>
        <div class="two">
          <label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="${todayISO()}" max="${todayISO()}"></label>
          <label class="field"><span>Peso (kg)</span><input class="input" name="kg" inputmode="decimal" placeholder="${nf(currentKg(), 1)}"></label>
        </div>
        <details class="comp">
          <summary>Composición corporal <span class="muted">(opcional)</span></summary>
          <p class="small muted">Si tu báscula o tu centro deportivo te dan estos datos, apúntalos para ver cómo cambias por dentro.</p>
          <div class="two">
            <label class="field"><span>Grasa (%)</span><input class="input" name="grasa" inputmode="decimal" placeholder="Ej. 18,5"></label>
            <label class="field"><span>Músculo (kg)</span><input class="input" name="musculo" inputmode="decimal" placeholder="Ej. 58"></label>
            <label class="field"><span>Agua (%)</span><input class="input" name="agua" inputmode="decimal" placeholder="Ej. 55"></label>
            <label class="field"><span>Hueso (kg)</span><input class="input" name="hueso" inputmode="decimal" placeholder="Ej. 3,1"></label>
          </div>
        </details>
        <button class="btn block" type="submit">Guardar registro</button>
      </form>
    </section>
    <section class="card">
      <h2>Historial</h2>
      ${rows.length ? `<div class="list">${rows.map((w, i) => {
        const prev = rows[i + 1];
        const dd = prev ? w.kg - prev.kg : null;
        const ct = compTxt(w);
        return `<div class="row"><span>${esc(fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}${ct ? `<br><span class="muted small">${esc(ct)}</span>` : ''}</span>
          <span style="display:flex;align-items:center;gap:10px"><span class="muted small">${dd == null ? '' : (dd > 0 ? '+' : dd < 0 ? '−' : '±') + nf(Math.abs(dd), 1)}</span><b class="nowrap">${nf(w.kg, 1)} kg</b>
          <button class="iconbtn" data-act="delweight" data-v="${esc(w.fecha)}" aria-label="Borrar registro del ${esc(w.fecha)}">${I.trash}</button></span></div>`;
      }).join('')}</div>` : '<div class="empty">Sin registros todavía.</div>'}
    </section>`;
}

// comp: { grasa, musculo, agua, hueso } como texto (opcionales)
async function saveWeight(fecha, raw, comp = {}) {
  const kg = num(raw);
  if (!(kg >= 30 && kg <= 250)) { toast('Escribe un peso entre 30 y 250 kg'); return false; }
  if (!fecha || fecha > todayISO()) { toast('Elige una fecha de hoy o anterior'); return false; }
  const v = Math.round(kg * 10) / 10;
  const extra = {};
  for (const c of COMP.slice(1)) {
    const t = String(comp[c.k] || '').trim();
    if (!t) continue;
    const n = num(t);
    if (!(n >= c.lo && n <= c.hi)) { toast(`${c.t}: escribe un valor entre ${c.lo} y ${c.hi} ${c.u}`); return false; }
    extra[c.k] = Math.round(n * 10) / 10;
  }
  if (extra.musculo && extra.musculo >= v) { toast('El músculo tiene que ser menor que tu peso'); return false; }
  try {
    await api.addWeight(st.user.uid, fecha, v, extra);
    st.weights = await api.listWeights(st.user.uid);
    const last = latestWeight();
    if (last) { await api.saveProfile(st.user.uid, { pesoKg: last.kg }); st.profile.pesoKg = last.kg; }
    render();
    toast(Object.keys(extra).length ? 'Peso y composición guardados' : 'Peso guardado');
    return true;
  } catch (e) { toast(errorText(e)); return false; }
}

async function delWeight(fecha) {
  if (st.weights.length <= 1) { toast('Necesitas al menos un registro de peso'); return; }
  try {
    await api.deleteWeight(st.user.uid, fecha);
    st.weights = await api.listWeights(st.user.uid);
    const last = latestWeight();
    if (last) { await api.saveProfile(st.user.uid, { pesoKg: last.kg }); st.profile.pesoKg = last.kg; }
    render(); toast('Registro borrado');
  } catch (e) { toast(errorText(e)); }
}

/* ---------- pestaña Perfil ---------- */
function viewPerfil() {
  const p = st.profile;
  const goals = st.editGoals || p.objetivos || [];
  const theme = lsGet('cadencia-theme') || 'auto';
  return `
    <header class="hello"><div><h1>Perfil</h1><p>${esc(st.user.email || '')}</p></div></header>
    <form class="card form-grid" data-form="profile" novalidate>
      <h2>Tus datos</h2>
      <label class="field"><span>Nombre</span><input class="input" name="nombre" value="${esc(p.nombre || '')}" autocomplete="given-name"></label>
      <div class="field"><span>Sexo</span>
        <div class="seg" role="group" aria-label="Sexo">
          <button type="button" data-act="psex" data-v="hombre" aria-pressed="${p.sexo !== 'mujer'}">Hombre</button>
          <button type="button" data-act="psex" data-v="mujer" aria-pressed="${p.sexo === 'mujer'}">Mujer</button>
        </div>
        <input type="hidden" name="sexo" value="${p.sexo === 'mujer' ? 'mujer' : 'hombre'}">
      </div>
      <div class="two">
        <label class="field"><span>Edad</span><input class="input" name="edad" inputmode="numeric" value="${esc(p.edad || '')}"></label>
        <label class="field"><span>Estatura (cm)</span><input class="input" name="alturaCm" inputmode="numeric" value="${esc(p.alturaCm || '')}"></label>
      </div>
      <label class="field"><span>Peso objetivo (kg)</span><input class="input" name="pesoObjetivo" inputmode="decimal" value="${p.pesoObjetivo ? esc(nf(p.pesoObjetivo, 1)) : ''}" placeholder="Opcional"></label>
      ${pesoGuiaHTML(p.alturaCm, p.sexo, goals, 'perfil')}
      <div class="field"><span>Objetivos</span>
        <div class="choices">${GOALS.map((g) => `<button type="button" class="choice" data-act="pgoal" data-v="${g.id}" aria-pressed="${goals.includes(g.id)}">
          <span class="ico">${goalIcon(g)}</span><span class="t">${g.t}</span><span class="tick">${goals.includes(g.id) ? I.check : ''}</span></button>`).join('')}</div>
      </div>
      <button class="btn block" type="submit">Guardar cambios</button>
    </form>

    ${installCard(false)}

    <section class="card">
      <h2>Apariencia</h2>
      <div class="seg" role="group" aria-label="Tema">
        ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => `<button type="button" data-act="theme" data-v="${v}" aria-pressed="${theme === v}">${t}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Cuenta</h2>
      <p class="small muted">${api.mode === 'firebase' ? 'Tus datos se guardan en la nube y los verás en cualquier dispositivo donde inicies sesión.' : 'Modo prueba: tus datos se guardan solo en este dispositivo.'}</p>
      <button class="btn ghost block" data-act="logout">Cerrar sesión</button>
    </section>`;
}

async function saveProfileForm(form) {
  const goals = st.editGoals || st.profile.objetivos || [];
  const edad = num(form.edad.value), alt = num(form.alturaCm.value), obj = form.pesoObjetivo.value.trim() ? num(form.pesoObjetivo.value) : null;
  if (!form.nombre.value.trim()) return toast('Escribe tu nombre');
  if (!(edad >= 14 && edad <= 100)) return toast('La edad tiene que estar entre 14 y 100');
  if (!(alt >= 120 && alt <= 230)) return toast('La estatura tiene que estar entre 120 y 230 cm');
  if (obj != null) { const err = objetivoInvalido(obj, alt, form.sexo.value, goals); if (err) return toast(err); }
  if (!goals.length) return toast('Elige al menos un objetivo');
  const data = { nombre: form.nombre.value.trim(), sexo: form.sexo.value, edad: Math.round(edad), alturaCm: Math.round(alt), pesoObjetivo: obj == null ? null : Math.round(obj * 10) / 10, objetivos: goals };
  try {
    await api.saveProfile(st.user.uid, data);
    st.profile = { ...st.profile, ...data }; st.editGoals = null;
    render(); toast('Cambios guardados');
  } catch (e) { toast(errorText(e)); }
}

/* ================================================================== */
/* Entreno                                                             */
/* ================================================================== */
const fmtDur = (m) => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
const fmtClock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const RT = E.RTIPOS;
const WK_DE = { fuerza: 'gym', bici: 'bici', cardio: 'cardio', otro: 'otro' }; // tipo de rutina → tipo de entreno registrado
const clone = (o) => JSON.parse(JSON.stringify(o));
const rutinaOf = () => { const r = st.profile && st.profile.rutina; return r && Array.isArray(r.dias) && r.dias.length && r.sesiones ? r : null; };
const dayPlan = (iso) => { const r = rutinaOf(); if (!r) return null; const d = E.weekdayIdx(iso); return r.dias.includes(d) ? r.sesiones[d] || null : null; };
const tipoIcon = (t) => (t === 'bici' ? I.bike : t === 'cardio' ? I.heart : t === 'otro' ? I.ball : I.dumb);
const goalsKind = () => E.planKind(st.profile && st.profile.objetivos);
const sesDuracion = (s) => (s.t === 'fuerza' ? `${(s.ej || []).length} ejercicios` : fmtDur(s.min));
const sesResumen = (s) => {
  if (s.t === 'fuerza' && s.ej && s.ej.length) { const n = s.ej.map((e) => e.n); return n.length > 2 ? `${n.slice(0, 2).join(', ')} y ${n.length - 2} más` : n.join(' y '); }
  if ((s.t === 'bici' || s.t === 'cardio') && s.ses) { const x = E.sesionPorId(s.ses); return x ? x.d : ''; }
  return s.det || '';
};
const EQ_ICO = {
  barra: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>',
  mancuernas: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>',
  maquina: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M12 9v7M9 16h6"/>',
  polea: '<path d="M5 3h14M12 3v3"/><circle cx="12" cy="8.5" r="2.5"/><path d="M12 11v6M9 20h6M12 17v3"/>',
  multipower: '<path d="M5 3v18M19 3v18M5 10h14M3 21h4M17 21h4"/>',
  kettlebell: '<circle cx="12" cy="14.5" r="6"/><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0"/>',
  banda: '<path d="M4 17c4-9 12-9 16 0"/><path d="M4 12c4-7 12-7 16 0"/>',
  corporal: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-1.5 5 1.5M8.5 21l3.5-7 3.5 7"/>',
};
const eqIcon = (eq) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EQ_ICO[eq] || EQ_ICO.corporal}</svg>`;

/* ---------- tarjeta en Inicio ---------- */
function homeTraining() {
  const r = rutinaOf();
  if (!r) return `<section class="card"><div class="card-head"><h2>Entreno</h2><button class="link" data-act="tab" data-v="entreno">Abrir</button></div>
    <p>Añade tu rutina y la app te dirá qué toca cada día.</p></section>`;
  const today = todayISO(), stt = E.weekStats(st.workouts, E.mondayOf(today));
  const dp = dayPlan(today), doneToday = st.workouts.some((w) => w.fecha === today);
  const line = doneToday ? 'Hoy ya has entrenado. Buen trabajo.' : dp ? `Hoy: ${dp.nombre} · ${sesDuracion(dp)}` : 'Hoy toca descansar.';
  return `<section class="card">
    <div class="card-head"><h2>Entreno de hoy</h2><button class="link" data-act="tab" data-v="entreno">Abrir</button></div>
    <p>${esc(line)}</p>
    <p class="small muted">Esta semana: ${stt.n} de ${r.dias.length} sesiones · ${fmtDur(stt.min)}</p>
  </section>`;
}

/* ---------- pestaña Entreno ---------- */
function viewEntreno() {
  if (!rutinaOf()) {
    return `<div class="wk-empty"><button type="button" class="addbig" data-act="rw-start"><span class="addbig-c">${I.plusBig}</span><span>Añadir rutina</span></button></div>`;
  }
  const today = todayISO(), mon = E.mondayOf(today), sun = E.addDays(mon, 6);
  const sub = ['semana', 'historial', 'rutina'].includes(st.wkTab) ? st.wkTab : 'semana';
  const body = sub === 'historial' ? wkHistorial() : sub === 'rutina' ? wkRutina() : wkSemana();
  return `<header class="hello"><div><h1>Entreno</h1><p>Semana del ${esc(fmtDate(mon))} al ${esc(fmtDate(sun))}</p></div>
      <button class="btn small" data-act="wk-new" data-date="${today}">${I.plus} Registrar</button></header>
    <div class="seg" role="group" aria-label="Secciones de entreno">
      ${[['semana', 'Semana'], ['historial', 'Historial'], ['rutina', 'Rutina']].map(([v, t]) => `<button type="button" data-act="wktab" data-v="${v}" aria-pressed="${sub === v}">${t}</button>`).join('')}
    </div>
    ${body}`;
}

function barsChart(series) {
  const W = 340, H = 140, P = { l: 4, r: 4, t: 18, b: 22 };
  const max = Math.max(60, ...series.map((s) => s.min));
  const bw = (W - P.l - P.r) / series.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Horas de entreno por semana">
    <line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>
    ${series.map((s, i) => {
      const h = Math.max((s.min / max) * (H - P.t - P.b), s.min ? 3 : 0), x = P.l + i * bw + bw * 0.16, w = bw * 0.68, y = H - P.b - h;
      return `<rect class="bar ${i === series.length - 1 ? 'cur' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/>
        ${s.min ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}">${nf(s.min / 60, 1)}</text>` : ''}
        <text x="${(x + w / 2).toFixed(1)}" y="${H - 6}">${esc(fmtDate(s.lunes))}</text>`;
    }).join('')}
  </svg>`;
}

function wkSemana() {
  const today = todayISO(), mon = E.mondayOf(today), ws = st.workouts, r = rutinaOf();
  const stt = E.weekStats(ws, mon);
  const cells = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = E.addDays(mon, i), did = ws.some((w) => w.fecha === date), dp = dayPlan(date);
    const state = did ? 'done' : dp ? (date < today ? 'miss' : 'plan') : 'rest';
    const label = `${E.DIAS_LARGO[i]}: ${did ? 'entrenado' : dp ? dp.nombre + ' previsto' : 'descanso'}`;
    return `<button type="button" class="dc ${state} ${date === today ? 'now' : ''}" data-act="wk-new" data-date="${date}" data-tipo="${dp ? WK_DE[dp.t] : ''}" ${date > today ? 'disabled' : ''} aria-label="${esc(label)}"><span>${E.DIAS[i]}</span><i>${did ? I.check : dp ? tipoIcon(dp.t) : ''}</i></button>`;
  }).join('');

  const dp = dayPlan(today), doneToday = ws.some((w) => w.fecha === today);
  let todayCard;
  if (doneToday) todayCard = `<section class="card ok-card"><h2>Hoy</h2><p><b>Ya has entrenado hoy.</b> Come bien y descansa.</p></section>`;
  else if (dp) todayCard = `<section class="card"><h2>Hoy toca</h2>
      <p class="today-line">${tipoIcon(dp.t)}<span><b>${esc(dp.nombre)}</b> · ${sesDuracion(dp)}<br><span class="muted small">${esc(sesResumen(dp))}</span></span></p>
      <button class="btn block" data-act="wk-new" data-date="${today}" data-tipo="${WK_DE[dp.t]}">${dp.t === 'fuerza' ? 'Empezar entrenamiento' : 'Registrar entreno'}</button></section>`;
  else todayCard = `<section class="card"><h2>Hoy</h2><p>Hoy toca descansar. Si te apetece moverte, puedes registrar una sesión extra.</p></section>`;

  const streak = E.streakWeeks(ws, mon);
  return `
    <section class="card"><h2>Tu semana</h2><div class="weekstrip">${cells}</div></section>
    ${todayCard}
    <div class="stats">
      <section class="stat"><span class="label">Tiempo</span><span class="val num nowrap">${fmtDur(stt.min).replace(' min', '')}${stt.min % 60 ? '<em>min</em>' : ''}</span></section>
      <section class="stat"><span class="label">Sesiones</span><span class="val num">${stt.n}<em>de ${r.dias.length}</em></span></section>
      <section class="stat"><span class="label">Distancia en bici</span><span class="val num">${nf(stt.km, 1)}<em>km</em></span>${stt.elev ? `<span class="hint">+${nf(stt.elev)} m de desnivel</span>` : ''}</section>
      <section class="stat"><span class="label">Calorías</span><span class="val num">${nf(stt.kcal)}<em>kcal</em></span><span class="hint">Estimadas según tu peso</span></section>
    </div>
    <section class="card"><h2>Racha</h2>
      <p class="streak"><b class="num">${streak}</b> ${streak === 1 ? 'semana seguida' : 'semanas seguidas'} entrenando</p>
      <p class="small muted">Cuenta cada semana con al menos un entreno.</p></section>
    <section class="card"><h2>Horas por semana</h2>${barsChart(E.weeksSeries(ws, mon, 8))}</section>`;
}

function wkRow(w) {
  const sub = [fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short' }), fmtDur(w.min)];
  if (w.km) sub.push(`${nf(w.km, 1)} km`);
  if (w.elev) sub.push(`+${nf(w.elev)} m`);
  const ne = (w.ejercicios || []).length; if (ne) sub.push(`${ne} ${ne === 1 ? 'ejercicio' : 'ejercicios'}`);
  const icoT = w.tipo === 'gym' ? 'fuerza' : w.tipo;
  return `<div class="row wrow"><span class="wico">${tipoIcon(icoT)}</span>
    <span class="wtxt"><b>${esc(w.nombre || E.TIPOS[w.tipo] || 'Entreno')}</b><span class="muted small">${esc(sub.join(' · '))}</span></span>
    <span class="wkcal muted small">${w.kcal ? nf(w.kcal) + ' kcal' : ''}</span>
    <button class="iconbtn" data-act="wk-del" data-v="${esc(w.id)}" aria-label="Borrar entreno">${I.trash}</button></div>`;
}

function wkHistorial() {
  const ws = st.workouts;
  if (!ws.length) return `<section class="card"><div class="empty"><b>Todavía no hay entrenos</b><span>Registra tu primera sesión y aquí verás tu historial y tus récords.</span></div></section>`;
  const r = E.records(ws);
  const rec = [];
  if (r.bici.km) rec.push(['Salida más larga', `${nf(r.bici.km.v, 1)} km`, r.bici.km.fecha]);
  if (r.bici.elev) rec.push(['Más desnivel', `${nf(r.bici.elev.v)} m`, r.bici.elev.fecha]);
  if (r.bici.min) rec.push(['Más tiempo en bici', fmtDur(r.bici.min.v), r.bici.min.fecha]);
  r.gym.forEach((e) => rec.push([e.n.charAt(0).toUpperCase() + e.n.slice(1), e.best.kg > 0 ? `${nf(e.best.kg, 1)} kg × ${e.best.reps}` : `${e.best.reps} repeticiones`, e.best.fecha]));
  return `
    ${rec.length ? `<section class="card"><h2>Récords personales</h2><div class="list">${rec.map(([t, v, f]) => `<div class="row"><span>${esc(t)}<br><span class="muted small">${esc(fmtDate(f, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></span><b>${esc(v)}</b></div>`).join('')}</div></section>` : ''}
    <section class="card"><h2>Todos tus entrenos</h2><div class="list">${ws.map(wkRow).join('')}</div></section>`;
}

/* ---------- editor de rutina (se usa en el asistente y en la sección Rutina) ---------- */
const reNew = (draft, src) => ({ draft, src, alt: null, ses: null, dirty: false, msg: '' });

function rxHTML(d, i, e, s, re) {
  const key = `${d}.${i}`, open = re.alt === key;
  const alts = open ? E.alternativas(e, s.ej.map((x) => x.n), re.draft.equipo).slice(0, 6) : [];
  const x = E.ejercicio(e.n);
  return `<div class="rx">
    <div class="rx-top">${exThumb(x || { eq: 'corporal' })}<span class="rx-n">${esc(e.n)}<span class="small muted">${x ? E.MUSCULOS[x.m] : ''}</span></span><button type="button" class="iconbtn" data-act="re-del" data-v="${key}" aria-label="Quitar ${esc(e.n)}">✕</button></div>
    <div class="rx-bot">
      <span class="rx-sr"><input class="input" data-re="${d}.ej.${i}.series" inputmode="numeric" value="${esc(e.series)}" aria-label="Series de ${esc(e.n)}"><span>×</span><input class="input" data-re="${d}.ej.${i}.reps" value="${esc(e.reps)}" aria-label="Repeticiones de ${esc(e.n)}"></span>
      <button type="button" class="btn quiet small" data-act="re-alt" data-v="${key}" aria-expanded="${open}">${I.swap} Cambiar</button>
    </div>
    ${open ? `<div class="alts"><span class="small muted">Alternativas que trabajan lo mismo</span><div class="chips">${alts.map((a) => `<button type="button" class="chip chipbtn" data-act="re-swap" data-v="${key}" data-n="${esc(a)}">${esc(a)}</button>`).join('')}
      <button type="button" class="chip chipbtn more" data-act="re-lib-swap" data-v="${key}">Ver todos…</button></div></div>` : ''}
  </div>`;
}

function dayCardHTML(R, d, re) {
  const s = R.sesiones[d];
  const dl = E.DIAS_LARGO[d].toLowerCase();
  const sel = R.tipos.length > 1
    ? `<select class="input sel" data-ret="${d}" aria-label="Tipo de entreno del ${dl}">${R.tipos.map((t) => `<option value="${t}" ${s.t === t ? 'selected' : ''}>${RT[t]}</option>`).join('')}</select>`
    : `<span class="tag">${RT[s.t]}</span>`;
  let body = '';
  if (s.t === 'fuerza') {
    body = `<div class="rx-list">${s.ej.length ? s.ej.map((e, i) => rxHTML(d, i, e, s, re)).join('') : '<p class="small muted">Aún no hay ejercicios. Añade los que hagas este día.</p>'}</div>
      <button type="button" class="btn quiet small" data-act="re-lib-add" data-v="${d}">${I.plus} Añadir ejercicios</button>`;
  } else if (s.t === 'bici' || s.t === 'cardio') {
    const ses = s.ses ? E.sesionPorId(s.ses) : null;
    const open = re.ses === d || !ses;
    body = `${ses ? `<p class="small">${esc(ses.d)}</p>` : ''}
      ${open ? `<div class="alts"><span class="small muted">${ses ? 'Alternativas' : 'Elige una sesión'}</span>
          ${E.alternativasSesion(s.t, s.ses).map((a) => `<button type="button" class="altses" data-act="re-ses" data-v="${d}" data-id="${a.id}"><b>${esc(a.n)} · ${fmtDur(a.min)}</b><span class="small muted">${esc(a.d)}</span></button>`).join('')}
          ${ses ? `<button type="button" class="link" data-act="re-ses-close" data-v="${d}">Cerrar</button>` : ''}</div>`
        : `<button type="button" class="btn quiet small" data-act="re-ses-open" data-v="${d}">${I.swap} Cambiar sesión</button>`}`;
  } else {
    body = `<label class="field"><span>Notas <span class="muted">(opcional)</span></span><input class="input" data-re="${d}.det" value="${esc(s.det || '')}" maxlength="80" placeholder="Ej. Partido con amigos"></label>`;
  }
  // En fuerza no se pregunta el tiempo: lo mide el cronómetro al entrenar.
  const minBox = s.t === 'fuerza' ? '' : `<label class="minbox"><input class="input" data-re="${d}.min" inputmode="numeric" value="${esc(s.min || '')}" aria-label="Minutos del ${dl}"><span>min</span></label>`;
  return `<section class="card rday">
    <div class="rd-head"><b>${E.DIAS_LARGO[d]}</b>${sel}</div>
    <div class="rd-name"><input class="input" data-re="${d}.nombre" value="${esc(s.nombre || '')}" maxlength="40" aria-label="Nombre de la sesión del ${dl}">${minBox}</div>
    ${body}
  </section>`;
}
const editorHTML = (re) => [...re.draft.dias].sort((a, b) => a - b).map((d) => dayCardHTML(re.draft, d, re)).join('');

// Limpia y valida la rutina antes de guardarla. Devuelve { rutina } o { error }.
function normRutina(R) {
  const out = { tipos: R.tipos, otro: String(R.otro || '').trim().slice(0, 30), dias: [...R.dias].sort((a, b) => a - b), modo: R.modo,
    split: R.split || 'auto', exp: R.exp || '', equipo: R.equipo || null, eqSel: R.eqSel || [], sesiones: {} };
  for (const d of out.dias) {
    const s = R.sesiones[d];
    const o = { t: s.t, nombre: String(s.nombre || '').trim().slice(0, 40) || RT[s.t] };
    if (s.t === 'fuerza') {
      if (!s.ej.length) return { error: `Añade al menos un ejercicio al ${E.DIAS_LARGO[d].toLowerCase()}, o cambia ese día a otro tipo de entreno.` };
      if (s.foco) o.foco = s.foco;
      o.ej = s.ej.map((e) => { const sr = Math.round(num(e.series)); const x = E.ejercicio(e.n); return { n: e.n, m: e.m || (x ? x.m : ''), series: sr >= 1 && sr <= 10 ? sr : 3, reps: String(e.reps || '').trim().slice(0, 20) || '10' }; });
    } else {
      const m = Math.round(num(s.min));
      o.min = m >= 5 && m <= 600 ? m : 60;
      if (s.t === 'bici' || s.t === 'cardio') o.ses = s.ses || null;
      else o.det = String(s.det || '').trim().slice(0, 80);
    }
    out.sesiones[d] = o;
  }
  return { rutina: out };
}

async function saveRutina(R) {
  const res = normRutina(R);
  if (res.error) return res.error;
  await api.saveProfile(st.user.uid, { rutina: res.rutina });
  st.profile = { ...st.profile, rutina: res.rutina };
  return '';
}

/* ---------- sección Rutina ---------- */
function wkRutina() {
  const r = rutinaOf();
  if (!st.re || st.re.src !== 'tab') st.re = reNew(clone(r), 'tab');
  const re = st.re;
  const split = r.tipos.includes('fuerza') && r.split && E.SPLITS[r.split] ? ` · ${E.SPLITS[r.split].t}` : '';
  return `<section class="card">
      <div class="card-head"><h2>Tu rutina</h2><button class="link" data-act="rw-start">Cambiar días o tipos</button></div>
      <p><b>${r.dias.map((d) => E.DIAS[d]).join(', ')}</b> · ${r.tipos.map((t) => (t === 'otro' && r.otro ? r.otro : RT[t])).join(', ')}${esc(split)}</p>
      <p class="small muted">${r.modo === 'propuesta' ? 'Propuesta de la app según tus objetivos.' : 'Rutina creada por ti.'} Toca «Cambiar» en un ejercicio o sesión para ver alternativas.</p>
    </section>
    ${editorHTML(re)}
    ${re.msg ? `<div class="msg" role="alert">${esc(re.msg)}</div>` : ''}
    <div class="savebar" id="re-savebar" ${re.dirty ? '' : 'hidden'}><button type="button" class="btn block" data-act="re-save">Guardar cambios</button></div>`;
}

/* ---------- asistente para crear la rutina ---------- */
const RW_TIPOS = [
  { id: 'fuerza', t: 'Fuerza', s: 'Gimnasio, pesas o en casa', ico: () => I.dumb },
  { id: 'bici', t: 'Bici', s: 'Carretera, montaña o rodillo', ico: () => I.bike },
  { id: 'cardio', t: 'Cardio', s: 'Correr, elíptica, remo, comba…', ico: () => I.heart },
  { id: 'otro', t: 'Otro', s: 'Pádel, natación, yoga…', ico: () => I.ball },
];
const RW_EXP = [['nuevo', 'Soy nuevo en las pesas'], ['meses', 'Llevo unos meses'], ['anio', 'Llevo alrededor de un año'], ['anios', 'Llevo años entrenando'], ['compite', 'Compito']];
const RW_EQ = [
  ['gym', 'Gimnasio completo', 'Barras, mancuernas, máquinas y poleas'], ['barra', 'Barras', ''], ['mancuernas', 'Mancuernas', ''],
  ['kettlebell', 'Kettlebells', 'Pesas rusas'], ['maquina', 'Máquinas y poleas', ''], ['banda', 'Bandas elásticas', ''], ['ninguno', 'Solo mi peso corporal', 'Entreno en casa sin material'],
];
const rwSteps = (o) => ['tipos', ...(o.tipos.includes('fuerza') ? ['split', 'exp', 'equipo'] : []), 'n', 'dias', 'modo', 'editor'];
const rwStep = (o) => rwSteps(o)[o.step];
const expBars = (k) => `<span class="bars" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= k ? 'on' : ''}" style="height:${6 + i * 3}px"></i>`).join('')}</span>`;

function rwStart() {
  const r = rutinaOf();
  st.rw = r
    ? { step: 0, tipos: [...r.tipos], otro: r.otro || '', n: r.dias.length, dias: [...r.dias], modo: r.modo || '', split: r.split || '', exp: r.exp || '', eq: r.eqSel && r.eqSel.length ? [...r.eqSel] : (r.tipos.includes('fuerza') ? ['gym'] : []), msg: '' }
    : { step: 0, tipos: [], otro: '', n: 0, dias: [], modo: '', split: '', exp: '', eq: [], msg: '' };
  st.re = null;
  render(); window.scrollTo(0, 0);
}

function rwCanNext() {
  const o = st.rw, s = rwStep(o);
  if (s === 'tipos') return o.tipos.length > 0;
  if (s === 'split') return !!o.split;
  if (s === 'exp') return !!o.exp;
  if (s === 'equipo') return o.eq.length > 0;
  if (s === 'n') return o.n > 0;
  if (s === 'dias') return o.dias.length === o.n;
  if (s === 'modo') return !!o.modo;
  return true;
}

function viewRutWizard() {
  const o = st.rw, s = rwStep(o), total = rwSteps(o).length - 1;
  const pct = Math.min(100, ((o.step + 1) / (total + 1)) * 100);
  const tick = (on) => `<span class="tick">${on ? I.check : ''}</span>`;
  let body = '', next = 'Siguiente';
  if (s === 'tipos') {
    body = `<h1 class="ob-title">¿Qué sueles entrenar?</h1><p class="ob-sub">Elige todo lo que hagas.</p>
      <div class="choices">${RW_TIPOS.map((x) => `<button type="button" class="choice" data-act="rw-tipo" data-v="${x.id}" aria-pressed="${o.tipos.includes(x.id)}">
        <span class="ico">${x.ico()}</span><span class="t">${x.t}<small>${x.s}</small></span>${tick(o.tipos.includes(x.id))}</button>`).join('')}</div>
      ${o.tipos.includes('otro') ? `<label class="field"><span>¿Qué otro deporte?</span><input class="input" data-rw="otro" value="${esc(o.otro)}" maxlength="30" placeholder="Ej. Pádel"></label>` : ''}`;
  } else if (s === 'split') {
    body = `<h1 class="ob-title">¿Qué tipo de entrenamiento de fuerza sigues?</h1><p class="ob-sub">Así organizamos tus días de fuerza.</p>
      <div class="choices">${Object.entries(E.SPLITS).map(([k, v]) => `<button type="button" class="choice" data-act="rw-split" data-v="${k}" aria-pressed="${o.split === k}"><span class="t">${v.t}<small>${v.s}</small></span>${tick(o.split === k)}</button>`).join('')}</div>`;
  } else if (s === 'exp') {
    body = `<h1 class="ob-title">¿Cuánta experiencia tienes con las pesas?</h1><p class="ob-sub">Ajusta el número de ejercicios y de series.</p>
      <div class="choices">${RW_EXP.map(([k, t], i) => `<button type="button" class="choice" data-act="rw-exp" data-v="${k}" aria-pressed="${o.exp === k}"><span class="t">${t}</span>${expBars(i + 1)}</button>`).join('')}</div>`;
  } else if (s === 'equipo') {
    body = `<h1 class="ob-title">¿Qué material tienes?</h1><p class="ob-sub">Solo te propondremos ejercicios que puedas hacer.</p>
      <div class="choices">${RW_EQ.map(([k, t, sub]) => `<button type="button" class="choice" data-act="rw-eq" data-v="${k}" aria-pressed="${o.eq.includes(k)}"><span class="ico">${eqIcon(k === 'gym' ? 'maquina' : k === 'ninguno' ? 'corporal' : k)}</span><span class="t">${t}${sub ? `<small>${sub}</small>` : ''}</span>${tick(o.eq.includes(k))}</button>`).join('')}</div>`;
  } else if (s === 'n') {
    body = `<h1 class="ob-title">¿Cuántos días a la semana sueles entrenar?</h1>
      <div class="numgrid">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="numbtn num" data-act="rw-n" data-v="${n}" aria-pressed="${o.n === n}">${n}</button>`).join('')}</div>`;
  } else if (s === 'dias') {
    const k = o.dias.length, diff = o.n - k;
    body = `<h1 class="ob-title">¿Qué días entrenas?</h1><p class="ob-sub">Elige ${o.n} ${o.n === 1 ? 'día' : 'días'}.</p>
      <div class="choices daylist">${E.DIAS_LARGO.map((d, i) => `<button type="button" class="choice" data-act="rw-dia" data-v="${i}" aria-pressed="${o.dias.includes(i)}"><span class="t">${d}</span>${tick(o.dias.includes(i))}</button>`).join('')}</div>
      <p class="small ${diff ? 'muted' : ''}" role="status">${diff === 0 ? `Perfecto: ${o.n} ${o.n === 1 ? 'día' : 'días'}.` : diff > 0 ? `Te ${diff === 1 ? 'falta' : 'faltan'} ${diff}.` : `Te ${-diff === 1 ? 'sobra' : 'sobran'} ${-diff}. Quita alguno o vuelve atrás para cambiar el número de días.`}</p>`;
  } else if (s === 'modo') {
    const goals = (st.profile.objetivos || []).map(goalById).filter(Boolean).map((g) => g.t.toLowerCase());
    body = `<h1 class="ob-title">¿Cómo quieres montar tu rutina?</h1>
      <div class="choices">
        <button type="button" class="choice" data-act="rw-modo" data-v="propuesta" aria-pressed="${o.modo === 'propuesta'}"><span class="ico">${I.spark}</span><span class="t">Que la app me proponga una<small>Adaptada a tus objetivos${goals.length ? ': ' + esc(goals.join(', ')) : ''}. Luego puedes cambiar cualquier ejercicio.</small></span>${tick(o.modo === 'propuesta')}</button>
        <button type="button" class="choice" data-act="rw-modo" data-v="propia" aria-pressed="${o.modo === 'propia'}"><span class="ico">${I.pencil}</span><span class="t">La hago yo<small>Eliges los ejercicios y sesiones de cada día.</small></span>${tick(o.modo === 'propia')}</button>
      </div>`;
  } else {
    body = `<h1 class="ob-title">${o.modo === 'propuesta' ? 'Tu rutina propuesta' : 'Monta tu rutina'}</h1>
      <p class="ob-sub">${o.modo === 'propuesta' ? esc(E.KIND_TEXT[goalsKind()]) + ' Toca «Cambiar» para ver alternativas.' : 'Elige el tipo de cada día y añade los ejercicios o la sesión.'}</p>
      ${editorHTML(st.re)}`;
    next = 'Guardar rutina';
  }
  const msg = s === 'editor' ? st.re.msg : o.msg;
  return `<form class="screen" data-form="rw" novalidate>
    <div class="ob-top">
      <button type="button" class="ob-back" data-act="rw-back" aria-label="${o.step === 0 ? 'Cerrar' : 'Atrás'}">${o.step === 0 ? '✕' : I.back}</button>
      <div class="ob-track" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <span class="ob-count">${s !== 'editor' ? `${o.step + 1} de ${total}` : ''}</span>
    </div>
    <div class="ob-body">${body}${msg ? `<div class="msg" role="alert">${esc(msg)}</div>` : ''}</div>
    <div class="ob-foot"><button class="btn block" type="submit" data-rwnext ${rwCanNext() && !o.saving ? '' : 'disabled'}>${o.saving ? '<span class="spinner"></span>' : next}</button></div>
  </form>`;
}

async function rwNext() {
  const o = st.rw;
  if (!rwCanNext()) return;
  o.msg = '';
  const s = rwStep(o);
  if (s === 'modo') {
    const fuerza = o.tipos.includes('fuerza');
    const cfg = { tipos: RW_TIPOS.map((x) => x.id).filter((t) => o.tipos.includes(t)), dias: o.dias, otro: o.otro.trim(),
      split: fuerza ? o.split : 'auto', exp: fuerza ? o.exp : '', equipo: fuerza ? E.expandirEquipo(o.eq) : null };
    const R = o.modo === 'propuesta' ? E.proponerRutina(cfg, st.profile.objetivos) : E.rutinaVacia(cfg, st.profile.objetivos);
    R.eqSel = fuerza ? [...o.eq] : [];
    st.re = reNew(R, 'rw');
    o.step++; render(); window.scrollTo(0, 0); return;
  }
  if (s !== 'editor') { o.step++; render(); window.scrollTo(0, 0); return; }
  o.saving = true; st.re.msg = ''; render();
  try {
    const err = await saveRutina(st.re.draft);
    if (err) { o.saving = false; st.re.msg = err; return render(); }
    st.rw = null; st.re = null; st.tab = 'entreno'; st.wkTab = 'semana'; lsSet('cadencia-wktab', 'semana');
    render(); window.scrollTo(0, 0); toast('Rutina guardada');
  } catch (e) { o.saving = false; st.re.msg = errorText(e); render(); }
}

/* ---------- panel de ejercicios (sube desde abajo) ---------- */
const M_ORD = Object.keys(E.MUSCULOS);

// Mapa del cuerpo (dibujo propio): principales en color fuerte, secundarios en suave.
const BODY = {
  front: [
    ['ne', 'r', 27, 15, 6, 6], ['sh', 'e', 17, 26, 6, 5], ['sh', 'e', 43, 26, 6, 5], ['ch', 'e', 25, 32, 6.5, 5], ['ch', 'e', 35, 32, 6.5, 5],
    ['bi', 'e', 12.5, 40, 3.5, 7], ['bi', 'e', 47.5, 40, 3.5, 7], ['fo', 'e', 9.5, 56, 3, 8], ['fo', 'e', 50.5, 56, 3, 8],
    ['ab', 'r', 25, 38, 10, 23], ['ab', 'e', 21, 50, 2.5, 8], ['ab', 'e', 39, 50, 2.5, 8], ['abd', 'e', 18.5, 65, 3, 5], ['abd', 'e', 41.5, 65, 3, 5],
    ['qu', 'e', 22, 83, 5, 14], ['qu', 'e', 38, 83, 5, 14], ['ad', 'e', 27.5, 77, 2.2, 8], ['ad', 'e', 32.5, 77, 2.2, 8],
    ['ca', 'e', 22, 112, 3.5, 11], ['ca', 'e', 38, 112, 3.5, 11],
  ],
  back: [
    ['ne', 'r', 27, 15, 6, 6], ['tp', 'p', '30,18 41,25 30,37 19,25'], ['sh', 'e', 17, 26, 6, 5], ['sh', 'e', 43, 26, 6, 5],
    ['mb', 'r', 26, 29, 8, 14], ['la', 'e', 22, 41, 5.5, 10], ['la', 'e', 38, 41, 5.5, 10], ['lb', 'r', 25.5, 47, 9, 10],
    ['tr', 'e', 12.5, 40, 3.5, 7], ['tr', 'e', 47.5, 40, 3.5, 7], ['fo', 'e', 9.5, 56, 3, 8], ['fo', 'e', 50.5, 56, 3, 8],
    ['abd', 'e', 18.5, 62, 3, 4], ['abd', 'e', 41.5, 62, 3, 4], ['gl', 'e', 24.5, 67, 5.5, 6], ['gl', 'e', 35.5, 67, 5.5, 6],
    ['ha', 'e', 22.5, 86, 5, 12], ['ha', 'e', 37.5, 86, 5, 12], ['ad', 'e', 28, 80, 2, 6], ['ad', 'e', 32, 80, 2, 6],
    ['ca', 'e', 22, 110, 4, 10], ['ca', 'e', 38, 110, 4, 10],
  ],
};
function bodyMap(x, cls = '') {
  const { p, s } = E.musculosDet(x);
  const fill = (k) => (p.includes(k) ? 'mp' : s.includes(k) ? 'ms' : 'm0');
  const fig = (parts, dx) => `<g transform="translate(${dx} 0)">
    <circle class="bh" cx="30" cy="8" r="6.5"/>
    ${parts.map(([k, t, a, b, c, d]) => t === 'e' ? `<ellipse class="${fill(k)}" cx="${a}" cy="${b}" rx="${c}" ry="${d}"/>`
      : t === 'r' ? `<rect class="${fill(k)}" x="${a}" y="${b}" width="${c}" height="${d}" rx="2.5"/>` : `<polygon class="${fill(k)}" points="${a}"/>`).join('')}
    <ellipse class="bh" cx="22" cy="125" rx="3.5" ry="2"/><ellipse class="bh" cx="38" cy="125" rx="3.5" ry="2"/></g>`;
  const names = [...p.map((k) => E.MUSC_DET[k]), ...s.map((k) => E.MUSC_DET[k])].filter(Boolean);
  return `<svg class="bodymap ${cls}" viewBox="0 0 128 130" role="img" aria-label="Músculos que trabaja: ${esc(names.join(', '))}">${fig(BODY.front, 2)}${fig(BODY.back, 66)}</svg>`;
}
const exThumb = (x) => {
  const im = E.imagenes(x)[0];
  return im ? `<span class="thumb"><img src="${im}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">${eqIcon(x.eq)}</span>` : `<span class="eqico">${eqIcon(x ? x.eq : 'corporal')}</span>`;
};

// o = { mode: 'add' | 'swap', ctx: 're' | 'live', d, i }
function libOpen(o) {
  const r = rutinaOf();
  let rec = [], usados = [], from = '', R = null;
  if (o.ctx === 're') {
    R = st.re.draft; const s = R.sesiones[o.d];
    usados = s.ej.map((e) => e.n);
    rec = s.foco ? E.musculosDe(s.foco) : [...new Set(s.ej.map((e) => e.m).filter(Boolean))];
    if (o.mode === 'swap') from = s.ej[o.i].n;
  } else {
    const L = st.live;
    usados = L.ex.map((e) => e.n);
    rec = L.foco ? E.musculosDe(L.foco) : [...new Set(L.ex.map((e) => e.m).filter(Boolean))];
    if (o.mode === 'swap') from = L.ex[o.i].n;
  }
  const equipo = (R && R.equipo) || (r && r.equipo) || null;
  st.lib = { ...o, q: '', sel: [], rec, usados, from, equipo, soloEq: !!equipo, eqF: 'todo', crear: null, det: null, anim: true,
    m: o.mode === 'swap' ? 'alt' : rec.length ? 'rec' : 'todos' };
  render();
  st.lib.anim = false;
}

function libItems() {
  const L = st.lib, q = E.normTxt(L.q);
  let items;
  if (q && L.m !== 'alt') items = E.todosEjercicios().slice().sort((a, b) => M_ORD.indexOf(a.m) - M_ORD.indexOf(b.m)); // al buscar, se busca en todos
  else if (L.m === 'alt') items = E.alternativas({ n: L.from }, [], null, true).map(E.ejercicio).filter(Boolean);
  else if (L.m === 'rec') items = E.todosEjercicios().filter((x) => L.rec.includes(x.m)).sort((a, b) => L.rec.indexOf(a.m) - L.rec.indexOf(b.m));
  else if (L.m === 'todos') items = E.todosEjercicios().slice().sort((a, b) => M_ORD.indexOf(a.m) - M_ORD.indexOf(b.m));
  else items = E.todosEjercicios().filter((x) => x.m === L.m);
  if (L.eqF !== 'todo') items = items.filter((x) => x.eq === L.eqF);
  else if (L.equipo && L.soloEq) items = items.filter((x) => x.eq === 'corporal' || L.equipo.includes(x.eq));
  if (q) items = items.filter((x) => E.normTxt(x.n).includes(q) || E.normTxt(E.MUSCULOS[x.m]).includes(q) || E.normTxt(E.EQUIPOS[x.eq]).includes(q));
  return items;
}

function libListHTML() {
  const L = st.lib, items = libItems();
  if (!items.length) return `<div class="empty"><b>No hay ejercicios así</b><span>Prueba otro grupo o equipo, o créalo con «Crear».</span></div>`;
  const grouped = !L.q && (L.m === 'todos' || L.m === 'rec');
  const used = new Set(L.usados.map(E.normTxt));
  let prev = '', out = `<p class="small muted lcount">${items.length} ${items.length === 1 ? 'ejercicio' : 'ejercicios'}</p>`;
  for (const x of items) {
    if (grouped && x.m !== prev) { out += `<div class="lgroup">${E.MUSCULOS[x.m]}</div>`; prev = x.m; }
    const inUse = L.mode === 'add' && used.has(E.normTxt(x.n));
    const on = L.sel.includes(x.n);
    const mus = E.musculosDet(x).p.map((k) => E.MUSC_DET[k]).join(', ') || E.MUSCULOS[x.m] || '';
    out += `<div class="lrow ${on ? 'on' : ''} ${inUse ? 'used' : ''}">
      <button type="button" class="lrow-main" data-act="lib-pick" data-n="${esc(x.n)}" ${inUse ? 'disabled' : ''}>
        ${exThumb(x)}
        <span class="lrow-t"><b>${esc(x.n)}</b><span class="small muted">${esc(mus)} · ${E.EQUIPOS[x.eq] || ''}${x.propio ? ' · Creado por ti' : ''}${inUse ? ' · Ya está en la sesión' : ''}</span></span>
        ${L.mode === 'add' ? `<span class="lrow-c">${on ? I.check : ''}</span>` : ''}</button>
      <button type="button" class="iconbtn info" data-act="lib-det" data-n="${esc(x.n)}" aria-label="Ver cómo se hace ${esc(x.n)}">i</button>
    </div>`;
  }
  return out;
}

function libFootLabel() { const n = st.lib.sel.length; return n ? `Añadir ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}` : 'Elige ejercicios'; }

function libDetHTML(x) {
  const L = st.lib, [a, b] = E.imagenes(x), { p, s } = E.musculosDet(x);
  const used = L.mode === 'add' && L.usados.map(E.normTxt).includes(E.normTxt(x.n));
  const on = L.sel.includes(x.n);
  return `<div class="sheet-head"><button type="button" class="iconbtn" data-act="lib-det-close" aria-label="Volver">${I.back}</button><h2 class="det-title">${esc(x.n)}</h2><span style="width:36px"></span></div>
    <div class="sheet-list det">
      ${a ? `<div class="det-imgs"><figure><img src="${a}" alt="${esc(x.n)}: posición inicial"><figcaption>Inicio</figcaption></figure><figure><img src="${b}" alt="${esc(x.n)}: posición final"><figcaption>Final</figcaption></figure></div>` : ''}
      <div class="det-body">${bodyMap(x, 'big')}
        <div class="det-mus">
          ${p.length ? `<p><span class="dot mp"></span><b>Principal:</b> ${esc(p.map((k) => E.MUSC_DET[k]).join(', '))}</p>` : ''}
          ${s.length ? `<p><span class="dot ms"></span><b>Secundarios:</b> ${esc(s.map((k) => E.MUSC_DET[k]).join(', '))}</p>` : ''}
          <p class="small muted">Equipo: ${E.EQUIPOS[x.eq] || 'Otro'}</p>
        </div></div>
    </div>
    <div class="sheet-foot">${L.mode === 'swap' ? `<button type="button" class="btn block" data-act="lib-pick" data-n="${esc(x.n)}">Usar este ejercicio</button>`
      : used ? `<button type="button" class="btn block" disabled>Ya está en la sesión</button>`
      : `<button type="button" class="btn block ${on ? 'quiet' : ''}" data-act="lib-det-toggle" data-n="${esc(x.n)}">${on ? 'Quitar de la selección' : 'Seleccionar'}</button>`}</div>`;
}

function libSheetHTML() {
  const L = st.lib;
  let inner;
  if (L.det) inner = libDetHTML(E.ejercicio(L.det) || { n: L.det, eq: 'otro' });
  else if (L.crear) {
    const c = L.crear;
    inner = `<div class="sheet-head"><button type="button" class="iconbtn" data-act="lib-crear-cancel" aria-label="Volver">${I.back}</button><h2>Crear ejercicio</h2><span style="width:36px"></span></div>
      <div class="sheet-list form-grid">
        <label class="field"><span>Nombre</span><input class="input" data-libc="n" maxlength="50" value="${esc(c.n)}" placeholder="Ej. Press inclinado en máquina"></label>
        <label class="field"><span>Grupo muscular</span><select class="input" data-libc="m">${Object.entries(E.MUSCULOS).map(([k, v]) => `<option value="${k}" ${c.m === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Equipo</span><select class="input" data-libc="eq">${Object.entries(E.EQUIPOS).map(([k, v]) => `<option value="${k}" ${c.eq === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        ${c.msg ? `<div class="msg" role="alert">${esc(c.msg)}</div>` : ''}
      </div>
      <div class="sheet-foot"><button type="button" class="btn block" data-act="lib-crear-save">Guardar ejercicio</button></div>`;
  } else {
    const title = L.mode === 'swap' ? 'Cambiar ejercicio' : 'Añadir ejercicios';
    const gOpts = [...(L.mode === 'swap' ? [['alt', 'Alternativas']] : []), ...(L.rec.length ? [['rec', 'Recomendados para esta sesión']] : []), ['todos', 'Todos'], ...Object.entries(E.MUSCULOS)];
    inner = `<div class="sheet-head"><button type="button" class="iconbtn" data-act="lib-close" aria-label="Cerrar">✕</button><h2>${title}</h2><button type="button" class="btn quiet small" data-act="lib-crear">${I.plus} Crear</button></div>
      ${L.mode === 'swap' ? `<p class="small muted sheet-sub">En lugar de <b>${esc(L.from)}</b></p>` : ''}
      <div class="filters">
        <label class="field"><span>Grupo muscular</span><select class="input" data-libm>${gOpts.map(([k, t]) => `<option value="${k}" ${L.m === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Equipo</span><select class="input" data-libeqf><option value="todo">Todo</option>${Object.entries(E.EQUIPOS).map(([k, v]) => `<option value="${k}" ${L.eqF === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <input class="input" type="search" data-libq placeholder="Buscar ejercicio" value="${esc(L.q)}" aria-label="Buscar ejercicio" autocomplete="off">
      ${L.equipo && L.eqF === 'todo' ? `<label class="eqtoggle"><input type="checkbox" data-libeq ${L.soloEq ? 'checked' : ''}> Solo con mi material</label>` : ''}
      <div class="sheet-list" id="lib-list">${libListHTML()}</div>
      ${L.mode === 'add' ? `<div class="sheet-foot"><button type="button" class="btn block" id="lib-addbtn" data-act="lib-add" ${L.sel.length ? '' : 'disabled'}>${libFootLabel()}</button></div>` : ''}`;
  }
  return `<div class="sheet-back" data-act="lib-close"></div>
    <div class="sheet ${L.anim ? 'anim' : ''}" role="dialog" aria-modal="true" aria-label="Ejercicios"><div class="sheet-grab"></div>${inner}</div>`;
}

function libApply(names) {
  const L = st.lib, kind = goalsKind();
  if (L.ctx === 're') {
    const R = st.re.draft, s = R.sesiones[L.d];
    if (L.mode === 'swap') { const ex = s.ej[L.i], n = names[0], x = E.ejercicio(n); ex.reps = E.repsPara(n, ex.reps, kind); ex.n = n; ex.m = x ? x.m : ''; }
    else names.forEach((n) => s.ej.push(E.nuevoEjercicio(n, kind, R.exp)));
    st.re.dirty = true; st.re.alt = null;
  } else {
    const Lv = st.live;
    if (L.mode === 'swap') { const ex = Lv.ex[L.i]; Lv.ex[L.i] = liveEx(names[0], ex.s.length, ex.obj); }
    else names.forEach((n) => Lv.ex.push(liveEx(n, 3, '')));
    liveSave();
  }
  st.lib = null; render();
  toast(L.mode === 'swap' ? `Cambiado por ${names[0]}` : names.length === 1 ? `${names[0]} añadido` : `${names.length} ejercicios añadidos`);
}

async function libCrearSave() {
  const c = st.lib.crear, n = String(c.n || '').trim().slice(0, 50);
  if (!n) { c.msg = 'Escribe el nombre del ejercicio.'; return render(); }
  const existe = E.ejercicio(n);
  const nombre = existe ? existe.n : n;
  if (!existe) {
    const propios = [...(st.profile.ejPropios || []), { n, m: c.m, eq: c.eq }];
    try { await api.saveProfile(st.user.uid, { ejPropios: propios }); } catch (e) { c.msg = errorText(e); return render(); }
    st.profile.ejPropios = propios; E.setPropios(propios);
  }
  if (st.lib.mode === 'swap') return libApply([nombre]);
  st.lib.crear = null; st.lib.q = ''; st.lib.m = 'todos'; st.lib.eqF = 'todo';
  if (!st.lib.sel.includes(nombre)) st.lib.sel.push(nombre);
  render(); toast(existe ? 'Ese ejercicio ya existía: lo hemos marcado' : 'Ejercicio creado');
}

/* ---------- entrenamiento de fuerza en directo ---------- */
const liveSave = () => lsSet('cadencia-live', st.live ? JSON.stringify(st.live) : null);
// "8-12" → 8 · "10 por pierna" → 10 · "30-45 s" → 30
const primerNumero = (t) => { const m = String(t || '').match(/\d+/); return m ? m[0] : ''; };
function liveEx(n, nSets, obj) {
  const x = E.ejercicio(n), prev = E.lastSets(st.workouts, n) || [];
  const objReps = obj ? obj.split('×')[1].trim() : '';
  return { n, m: x ? x.m : '', obj: obj || '', objReps, uni: false, prev, s: Array.from({ length: Math.max(1, Math.min(10, nSets || 3)) }, () => ({ kg: '', reps: '', done: false })) };
}
// Sesiones que puede elegir como título: las de su rutina y las de su tipo de entrenamiento.
function liveOpciones() {
  const r = rutinaOf(), out = [];
  const add = (nombre, foco, ej) => { if (nombre && !out.some((o) => o.nombre === nombre)) out.push({ nombre, foco: foco || '', ej: ej || null }); };
  if (r) for (const d of r.dias) { const s = r.sesiones[d]; if (s && s.t === 'fuerza') add(s.nombre, s.foco, s.ej); }
  const split = r && r.split && r.split !== 'auto' ? r.split : null;
  if (split) for (const k of E.splitOrden(split, 3, goalsKind())) add(E.SES_FUERZA[k].n, k, null);
  return out;
}
function liveCargarSesion(op) {
  const L = st.live, r = rutinaOf();
  const ej = op.ej || E.sesionFuerza(op.foco, goalsKind(), { exp: r && r.exp, equipo: r && r.equipo }).ej;
  L.nombre = op.nombre; L.foco = op.foco || ''; L.custom = false;
  L.ex = ej.map((e) => liveEx(e.n, e.series, `${e.series} × ${e.reps}`));
}
function startLive(fecha) {
  if (st.live) {
    st.liveMin = false; st.wk = null; render(); window.scrollTo(0, 0);
    if (st.live.fecha !== fecha) toast('Ya tienes un entrenamiento de fuerza en curso');
    return;
  }
  const dp = dayPlan(fecha), plan = dp && dp.t === 'fuerza' ? dp : null;
  st.live = { uid: st.user.uid, fecha, start: Date.now(), nombre: plan ? plan.nombre : 'Entrenamiento', foco: (plan && plan.foco) || '', custom: !plan && !liveOpciones().length,
    ex: plan ? plan.ej.map((e) => liveEx(e.n, e.series, `${e.series} × ${e.reps}`)) : [], msg: '' };
  st.liveMin = false; st.wk = null; liveSave(); render(); window.scrollTo(0, 0);
}
// Una serie cuenta si la marcaste con ✓ o si escribiste algo en ella.
const serieCuenta = (s) => s.done || String(s.reps).trim() !== '' || String(s.kg).trim() !== '';
function liveTotals() {
  let vol = 0, sets = 0;
  for (const ex of st.live.ex) for (const s of ex.s) if (s.done) { sets++; vol += (num(s.kg) || 0) * (num(s.reps) || 0) * (ex.uni ? 2 : 1); }
  return { vol: Math.round(vol), sets };
}
const liveIsToday = () => st.live && st.live.fecha === todayISO();

function liveTitleHTML(L) {
  const ops = liveOpciones();
  const sel = L.custom ? '__custom' : ops.some((o) => o.nombre === L.nombre) ? L.nombre : '__custom';
  return `<span class="live-title">
    <select class="title-sel" data-livetitle aria-label="Sesión de hoy">
      ${ops.map((o) => `<option value="${esc(o.nombre)}" ${sel === o.nombre ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}
      <option value="__custom" ${sel === '__custom' ? 'selected' : ''}>Personalizado…</option>
    </select>
    ${sel === '__custom' ? `<input class="input title-in" data-livename value="${esc(L.custom || !ops.some((o) => o.nombre === L.nombre) ? (L.nombre === 'Entrenamiento' ? '' : L.nombre) : '')}" maxlength="40" placeholder="Ej. Pierna y hombro" aria-label="Nombre del entrenamiento">` : ''}
    <span class="small muted">${liveIsToday() ? 'Hoy' : esc(fmtDate(L.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
  </span>`;
}

function viewLive() {
  const L = st.live, t = liveTotals(), today = liveIsToday();
  const fmtKg = (v) => (v ? String(v).replace('.', ',') : '');
  const blocks = L.ex.map((e, i) => {
    const x = E.ejercicio(e.n), uniOk = E.puedeUnilateral(e.n);
    return `<section class="lex">
      <div class="lex-head">${exThumb(x || { eq: 'corporal' })}
        <span class="lex-t"><b>${esc(e.n)}</b><span class="small muted">${x ? E.MUSCULOS[x.m] : ''}${e.obj ? ` · Objetivo ${esc(e.obj)}` : ''}</span></span>
        <button type="button" class="iconbtn" data-act="live-swap" data-v="${i}" aria-label="Cambiar ${esc(e.n)}">${I.swap}</button>
        <button type="button" class="iconbtn" data-act="live-del" data-v="${i}" aria-label="Quitar ${esc(e.n)}">${I.trash}</button></div>
      ${uniOk ? `<div class="seg mini" role="group" aria-label="Lados"><button type="button" data-act="live-uni" data-v="${i}" data-u="0" aria-pressed="${!e.uni}">Ambos lados</button><button type="button" data-act="live-uni" data-v="${i}" data-u="1" aria-pressed="${!!e.uni}">Unilateral</button></div>` : ''}
      <div class="ltab">
        <div class="lrow-h"><span>Serie</span><span>Anterior</span><span>kg</span><span>${e.uni ? 'Reps/lado' : 'Reps'}</span><span></span></div>
        ${e.s.map((s, j) => { const p = e.prev[j]; const phKg = p && p.kg ? fmtKg(p.kg) : '–'; const phR = p ? String(p.reps) : e.objReps || '–'; return `<div class="lset ${s.done ? 'on' : ''}">
          <span class="num sn">${j + 1}</span>
          <span class="prev">${p ? `${p.kg ? fmtKg(p.kg) + ' × ' : ''}${p.reps}${p.uni ? ' /lado' : ''}` : '—'}</span>
          <input class="input" data-lv="${i}.${j}.kg" inputmode="decimal" value="${esc(s.kg)}" placeholder="${esc(phKg)}" aria-label="Kilos serie ${j + 1} de ${esc(e.n)}">
          <input class="input" data-lv="${i}.${j}.reps" inputmode="numeric" value="${esc(s.reps)}" placeholder="${esc(phR)}" aria-label="Repeticiones serie ${j + 1} de ${esc(e.n)}">
          <button type="button" class="chk" data-act="live-done" data-v="${i}.${j}" aria-pressed="${s.done}" aria-label="Marcar serie ${j + 1} como hecha">${I.check}</button>
        </div>`; }).join('')}
      </div>
      <div class="lex-foot"><button type="button" class="btn quiet small" data-act="live-set-add" data-v="${i}">${I.plus} Añadir serie</button>
        ${e.s.length > 1 ? `<button type="button" class="link" data-act="live-set-del" data-v="${i}">Quitar la última</button>` : ''}</div>
    </section>`;
  }).join('');
  return `<div class="screen live">
    <div class="live-top">
      <button type="button" class="ob-back" data-act="live-min" aria-label="Minimizar">${I.down}</button>
      ${liveTitleHTML(L)}
      <button type="button" class="btn small" data-act="live-fin">Finalizar</button>
    </div>
    <div class="live-stats">
      <div><span>Duración</span><b class="num" id="live-dur">${today ? fmtClock(Date.now() - L.start) : 'Estimada'}</b></div>
      <div><span>Volumen</span><b class="num" id="live-vol">${nf(t.vol)} kg</b></div>
      <div><span>Series</span><b class="num" id="live-sets">${t.sets}</b></div>
    </div>
    <p class="small muted live-hint">Los números grises son tu referencia (la última vez o el objetivo). Si marcas ✓ sin escribir, se apunta ese valor.</p>
    ${blocks || `<div class="empty"><b>Aún no hay ejercicios</b><span>Elige la sesión arriba o añade los que vayas a hacer.</span></div>`}
    <button type="button" class="btn block" data-act="live-lib">${I.plus} Añadir ejercicios</button>
    ${L.msg ? `<div class="msg" role="alert" id="live-msg">${esc(L.msg)}</div>` : ''}
    <button type="button" class="link center" data-act="live-discard">Descartar entrenamiento</button>
  </div>`;
}
const liveBarHTML = () => `<button type="button" class="livebar" data-act="live-open"><span class="dot"></span><span><b>${esc(st.live.nombre)}</b><span class="small" id="live-bar-t">${liveIsToday() ? fmtClock(Date.now() - st.live.start) : 'En curso'}</span></span><span class="small">Volver</span></button>`;

setInterval(() => {
  if (!st.live || !liveIsToday()) return;
  const t = fmtClock(Date.now() - st.live.start);
  const a = document.getElementById('live-dur'), b = document.getElementById('live-bar-t');
  if (a) a.textContent = t; if (b) b.textContent = t;
}, 1000);

// Rellena una serie con la referencia (la última vez, o el objetivo) si está vacía.
function rellenarSerie(ex, j) {
  const s = ex.s[j], p = ex.prev[j];
  if (!String(s.reps).trim()) s.reps = p ? String(p.reps) : primerNumero(ex.objReps);
  if (!String(s.kg).trim() && p && p.kg) s.kg = String(p.kg).replace('.', ',');
  return !!String(s.reps).trim();
}

async function liveFinish() {
  const L = st.live, ejs = [];
  const fail = (m) => { L.msg = m; render(); toast(m); const el = document.getElementById('live-msg'); if (el) el.scrollIntoView({ block: 'center' }); };
  if (!(L.nombre || '').trim()) L.nombre = 'Entrenamiento';
  for (const ex of L.ex) {
    const series = [];
    for (let j = 0; j < ex.s.length; j++) {
      const s = ex.s[j];
      if (!serieCuenta(s)) continue;
      if (!String(s.reps).trim()) rellenarSerie(ex, j);
      const reps = Math.round(num(s.reps)), kg = String(s.kg).trim() ? num(s.kg) : 0;
      if (!(reps >= 1 && reps <= 200) || !(kg >= 0 && kg <= 600)) return fail(`Revisa la serie ${j + 1} de «${ex.n}»: repeticiones entre 1 y 200 y kilos entre 0 y 600.`);
      series.push({ kg: Math.round(kg * 10) / 10, reps });
    }
    if (series.length) ejs.push(ex.uni ? { n: ex.n, uni: true, series } : { n: ex.n, series });
  }
  if (!ejs.length) return fail('Apunta al menos una serie (escribe los kilos o reps, o márcala con ✓) para guardar el entrenamiento.');
  const nSets = ejs.reduce((a, e) => a + e.series.length, 0);
  const min = liveIsToday() ? Math.max(1, Math.min(600, Math.round((Date.now() - L.start) / 60000))) : Math.max(15, nSets * 3);
  const o = { id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: L.fecha, tipo: 'gym', nombre: L.nombre.trim().slice(0, 60), min, esf: 2, ejercicios: ejs };
  o.kcal = E.estimateKcal(o, currentKg());
  toast('Guardando…');
  try {
    const before = E.records(st.workouts), after = E.records([...st.workouts, o]);
    await api.saveWorkout(st.user.uid, o);
    st.workouts = await api.listWorkouts(st.user.uid);
    st.live = null; st.liveMin = false; liveSave();
    st.tab = 'entreno'; st.wkTab = 'semana'; lsSet('cadencia-tab', 'entreno'); lsSet('cadencia-wktab', 'semana');
    render(); window.scrollTo(0, 0);
    toast(E.beatsRecord(before, after) ? '¡Nuevo récord personal!' : `Entrenamiento guardado · ${nSets} series`);
  } catch (e) { fail(`No se ha podido guardar: ${errorText(e)}`); }
}

/* ---------- registro de bici, cardio y otros ---------- */
function resolveTipo(date, tipo) {
  if (['bici', 'gym', 'cardio', 'otro'].includes(tipo)) return tipo;
  const dp = dayPlan(date || todayISO()), r = rutinaOf();
  return dp ? WK_DE[dp.t] : r ? WK_DE[r.tipos[0]] : 'bici';
}
function newWk(date, t) {
  const f = date || todayISO(), dp = dayPlan(f), same = dp && WK_DE[dp.t] === t;
  return { fecha: f, tipo: t, nombre: same ? dp.nombre || '' : '', min: same && dp.min ? String(dp.min) : '', km: '', elev: '', pulso: '', esf: 2, msg: '', saving: false };
}
function openRegistro(date, tipo) {
  const t = resolveTipo(date, tipo);
  if (t === 'gym') return startLive(date || todayISO());
  st.wk = newWk(date, t); render(); window.scrollTo(0, 0);
}
function wkKcal() {
  const w = st.wk;
  return E.estimateKcal({ tipo: w.tipo, min: num(w.min), km: num(w.km), esf: w.esf }, currentKg());
}

function viewWkForm() {
  const w = st.wk, t = w.tipo;
  const kc = wkKcal();
  const ph = { bici: 'Ej. Salida por Artxanda', cardio: 'Ej. Carrera suave', otro: 'Ej. Pádel' }[t];
  return `<form class="screen" data-form="wk" novalidate>
    <div class="ob-top"><button type="button" class="ob-back" data-act="wk-cancel" aria-label="Volver">${I.back}</button><h1 class="form-title">Registrar entreno</h1></div>
    <div class="form-grid" style="padding-top:20px;flex:1;align-content:start">
      <div class="seg" role="group" aria-label="Tipo de entreno">
        ${[['gym', 'Fuerza'], ['bici', 'Bici'], ['cardio', 'Cardio'], ['otro', 'Otro']].map(([v, l]) => `<button type="button" data-act="wk-tipo" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}
      </div>
      <div class="two">
        <label class="field"><span>Fecha</span><input class="input" type="date" data-wk="fecha" value="${esc(w.fecha)}" max="${todayISO()}"></label>
        <label class="field"><span>Duración (min)</span><input class="input" data-wk="min" inputmode="numeric" value="${esc(w.min)}" placeholder="60"></label>
      </div>
      <label class="field"><span>Nombre <span class="muted">(opcional)</span></span><input class="input" data-wk="nombre" maxlength="60" value="${esc(w.nombre)}" placeholder="${ph}"></label>
      ${t === 'bici' ? `<div class="two">
          <label class="field"><span>Distancia (km)</span><input class="input" data-wk="km" inputmode="decimal" value="${esc(w.km)}" placeholder="45"></label>
          <label class="field"><span>Desnivel (m)</span><input class="input" data-wk="elev" inputmode="numeric" value="${esc(w.elev)}" placeholder="600"></label>
        </div>
        <label class="field"><span>Pulso medio <span class="muted">(opcional)</span></span><input class="input" data-wk="pulso" inputmode="numeric" value="${esc(w.pulso)}" placeholder="140"></label>` : ''}
      ${t === 'cardio' ? `<label class="field"><span>Distancia (km) <span class="muted">(opcional)</span></span><input class="input" data-wk="km" inputmode="decimal" value="${esc(w.km)}" placeholder="6"></label>` : ''}
      <div class="field"><span>Esfuerzo</span>
        <div class="seg" role="group" aria-label="Esfuerzo">${[[1, 'Suave'], [2, 'Medio'], [3, 'Duro']].map(([v, l]) => `<button type="button" data-act="wk-esf" data-v="${v}" aria-pressed="${w.esf === v}">${l}</button>`).join('')}</div></div>
      <p class="small muted">Calorías estimadas: <b id="wk-kcal">${kc ? '≈ ' + nf(kc) + ' kcal' : '–'}</b></p>
      ${w.msg ? `<div class="msg" role="alert">${esc(w.msg)}</div>` : ''}
    </div>
    <div class="ob-foot"><button class="btn block" type="submit" ${w.saving ? 'disabled' : ''}>${w.saving ? '<span class="spinner"></span>' : 'Guardar entreno'}</button></div>
  </form>`;
}

async function wkSave() {
  const w = st.wk;
  const fail = (m) => { w.msg = m; render(); };
  const min = num(w.min);
  if (!(min >= 5 && min <= 1440)) return fail('Escribe la duración en minutos, entre 5 y 1440.');
  if (!w.fecha || w.fecha > todayISO()) return fail('Elige una fecha de hoy o anterior.');
  const o = { id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: w.fecha, tipo: w.tipo, min: Math.round(min), esf: w.esf };
  if (w.nombre.trim()) o.nombre = w.nombre.trim().slice(0, 60);
  const opt = (raw, lo, hi, msg) => { if (!String(raw).trim()) return null; const v = num(raw); if (!(v >= lo && v <= hi)) throw new Error(msg); return v; };
  try {
    if (w.tipo === 'bici' || w.tipo === 'cardio') { const km = opt(w.km, 0, 500, 'La distancia tiene que estar entre 0 y 500 km.'); if (km) o.km = Math.round(km * 10) / 10; }
    if (w.tipo === 'bici') {
      const el = opt(w.elev, 0, 10000, 'El desnivel tiene que estar entre 0 y 10.000 m.');
      const pu = opt(w.pulso, 40, 230, 'El pulso tiene que estar entre 40 y 230.');
      if (el) o.elev = Math.round(el);
      if (pu) o.pulso = Math.round(pu);
    }
  } catch (e) { return fail(e.message); }
  o.kcal = E.estimateKcal(o, currentKg());
  w.saving = true; w.msg = ''; render();
  try {
    const before = E.records(st.workouts), after = E.records([...st.workouts, o]);
    await api.saveWorkout(st.user.uid, o);
    st.workouts = await api.listWorkouts(st.user.uid);
    st.wk = null; st.tab = 'entreno'; st.wkTab = 'semana'; lsSet('cadencia-tab', 'entreno'); lsSet('cadencia-wktab', 'semana');
    render(); window.scrollTo(0, 0);
    toast(E.beatsRecord(before, after) ? '¡Nuevo récord personal!' : 'Entreno guardado');
  } catch (e) { w.saving = false; w.msg = errorText(e); render(); }
}

/* ---------- eventos del entreno ---------- */
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  const w = st.wk, o = st.rw, re = st.re, L = st.lib, Lv = st.live;

  // panel de ejercicios
  if (L && act.startsWith('lib-')) {
    if (act === 'lib-close') { st.lib = null; return render(); }
    if (act === 'lib-det') { L.det = b.dataset.n; return render(); }
    if (act === 'lib-det-close') { L.det = null; return render(); }
    if (act === 'lib-det-toggle') { const n = b.dataset.n; L.sel = L.sel.includes(n) ? L.sel.filter((x) => x !== n) : [...L.sel, n]; L.det = null; return render(); }
    if (act === 'lib-crear') { L.crear = { n: L.q, m: L.rec[0] || 'pecho', eq: (L.equipo && L.equipo[0]) || 'mancuernas', msg: '' }; return render(); }
    if (act === 'lib-crear-cancel') { L.crear = null; return render(); }
    if (act === 'lib-crear-save') return libCrearSave();
    if (act === 'lib-add') return L.sel.length ? libApply(L.sel) : null;
    if (act === 'lib-pick') {
      const n = b.dataset.n;
      if (L.mode === 'swap') return libApply([n]);
      L.sel = L.sel.includes(n) ? L.sel.filter((x) => x !== n) : [...L.sel, n];
      const on = L.sel.includes(n);
      b.parentNode.classList.toggle('on', on); b.querySelector('.lrow-c').innerHTML = on ? I.check : '';
      const btn = document.getElementById('lib-addbtn'); if (btn) { btn.disabled = !L.sel.length; btn.textContent = libFootLabel(); }
      return;
    }
  }

  // asistente
  if (act === 'rw-start') return rwStart();
  if (o && act === 'rw-back') { if (o.step === 0) { st.rw = null; st.re = null; } else { o.step--; o.msg = ''; } render(); return window.scrollTo(0, 0); }
  if (o && act === 'rw-tipo') { o.tipos = o.tipos.includes(v) ? o.tipos.filter((x) => x !== v) : [...o.tipos, v]; if (o.tipos.includes('fuerza') && !o.eq.length) o.eq = ['gym']; return render(); }
  if (o && act === 'rw-split') { o.split = v; return render(); }
  if (o && act === 'rw-exp') { o.exp = v; return render(); }
  if (o && act === 'rw-eq') {
    if (v === 'gym' || v === 'ninguno') o.eq = o.eq.includes(v) ? [] : [v];
    else { const rest = o.eq.filter((x) => x !== 'gym' && x !== 'ninguno'); o.eq = rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v]; }
    return render();
  }
  if (o && act === 'rw-n') { o.n = Number(v); if (o.dias.length !== o.n) o.dias = [...E.DIAS_DEF[o.n]]; return render(); }
  if (o && act === 'rw-dia') { const d = Number(v); o.dias = o.dias.includes(d) ? o.dias.filter((x) => x !== d) : [...o.dias, d].sort((a, c) => a - c); return render(); }
  if (o && act === 'rw-modo') { o.modo = v; return render(); }

  // editor de rutina
  if (re && act.startsWith('re-')) {
    const R = re.draft, kind = goalsKind();
    const touch = () => { re.dirty = true; re.msg = ''; };
    if (act === 're-alt') re.alt = re.alt === v ? null : v;
    else if (act === 're-swap') { const [d, i] = v.split('.').map(Number); const ex = R.sesiones[d].ej[i], n = b.dataset.n, x = E.ejercicio(n); ex.reps = E.repsPara(n, ex.reps, kind); ex.n = n; ex.m = x ? x.m : ''; re.alt = null; touch(); toast(`Cambiado por ${n}`); }
    else if (act === 're-lib-swap') { const [d, i] = v.split('.').map(Number); re.alt = null; return libOpen({ mode: 'swap', ctx: 're', d, i }); }
    else if (act === 're-lib-add') return libOpen({ mode: 'add', ctx: 're', d: Number(v) });
    else if (act === 're-del') { const [d, i] = v.split('.').map(Number); R.sesiones[d].ej.splice(i, 1); re.alt = null; touch(); }
    else if (act === 're-ses-open') re.ses = Number(v);
    else if (act === 're-ses-close') re.ses = null;
    else if (act === 're-ses') { const s = R.sesiones[Number(v)], x = E.sesionPorId(b.dataset.id); s.ses = x.id; s.nombre = x.n; s.min = x.min; re.ses = null; touch(); }
    else if (act === 're-save') {
      try { const err = await saveRutina(R); if (err) { re.msg = err; return render(); } st.re = null; render(); toast('Rutina guardada'); } catch (err) { re.msg = errorText(err); render(); }
      return;
    }
    return render();
  }

  // entrenamiento en directo
  if (Lv && act.startsWith('live-')) {
    if (act === 'live-min') { st.liveMin = true; render(); return window.scrollTo(0, 0); }
    if (act === 'live-open') { st.liveMin = false; render(); return window.scrollTo(0, 0); }
    if (act === 'live-lib') return libOpen({ mode: 'add', ctx: 'live' });
    if (act === 'live-swap') return libOpen({ mode: 'swap', ctx: 'live', i: Number(v) });
    if (act === 'live-del') { Lv.ex.splice(Number(v), 1); liveSave(); return render(); }
    if (act === 'live-set-add') { const ex = Lv.ex[Number(v)], last = ex.s[ex.s.length - 1] || { kg: '' }; ex.s.push({ kg: last.kg, reps: '', done: false }); liveSave(); return render(); }
    if (act === 'live-set-del') { const ex = Lv.ex[Number(v)]; if (ex.s.length > 1) ex.s.pop(); liveSave(); return render(); }
    if (act === 'live-done') {
      const [i, j] = v.split('.').map(Number), ex = Lv.ex[i], s = ex.s[j];
      if (!s.done && !rellenarSerie(ex, j)) { toast('Escribe las repeticiones de la serie'); return; }
      s.done = !s.done; Lv.msg = ''; liveSave(); return render();
    }
    if (act === 'live-uni') { Lv.ex[Number(v)].uni = b.dataset.u === '1'; liveSave(); return render(); }
    if (act === 'live-fin') return liveFinish();
    if (act === 'live-discard') {
      if (!window.confirm('¿Descartar este entrenamiento? Se perderán las series apuntadas.')) return;
      st.live = null; st.liveMin = false; liveSave(); render(); toast('Entrenamiento descartado'); return;
    }
  }

  // registro
  if (act === 'wktab') { st.wkTab = v; lsSet('cadencia-wktab', v); render(); }
  else if (act === 'wk-new') openRegistro(b.dataset.date, b.dataset.tipo);
  else if (act === 'wk-cancel') { st.wk = null; render(); }
  else if (act === 'wk-tipo' && w) {
    if (w.tipo === v) return;
    if (v === 'gym') return startLive(w.fecha);
    const nw = newWk(w.fecha, v); nw.esf = w.esf; if (!nw.min) nw.min = w.min; st.wk = nw; render();
  }
  else if (act === 'wk-esf' && w) { w.esf = Number(v); render(); }
  else if (act === 'wk-del') {
    if (!window.confirm('¿Borrar este entreno?')) return;
    try { await api.deleteWorkout(st.user.uid, v); st.workouts = await api.listWorkouts(st.user.uid); render(); toast('Entreno borrado'); } catch (err) { toast(errorText(err)); }
  }
});

root.addEventListener('input', (e) => {
  const t = e.target;
  if (st.lib && t.dataset.libq != null) { st.lib.q = t.value; const l = document.getElementById('lib-list'); if (l) { l.innerHTML = libListHTML(); l.scrollTop = 0; } return; }
  if (st.lib && st.lib.crear && t.dataset.libc) { st.lib.crear[t.dataset.libc] = t.value; return; }
  if (st.rw && t.dataset.rw) { st.rw[t.dataset.rw] = t.value; return; }
  if (st.live && t.dataset.livename != null) { st.live.nombre = t.value; st.live.custom = true; liveSave(); return; }
  if (st.live && t.dataset.lv) {
    const [i, j, k] = t.dataset.lv.split('.'); st.live.ex[Number(i)].s[Number(j)][k] = t.value; liveSave();
    const tt = liveTotals(), vEl = document.getElementById('live-vol'); if (vEl) vEl.textContent = `${nf(tt.vol)} kg`;
    return;
  }
  if (st.re && t.dataset.re) {
    const p = t.dataset.re.split('.'), s = st.re.draft.sesiones[Number(p[0])];
    if (p[1] === 'ej') s.ej[Number(p[2])][p[3]] = t.value; else s[p[1]] = t.value;
    st.re.dirty = true;
    const bar = document.getElementById('re-savebar'); if (bar) bar.hidden = false;
    return;
  }
  const w = st.wk;
  if (!w || !t.dataset.wk) return;
  w[t.dataset.wk] = t.value;
  const kc = document.getElementById('wk-kcal');
  if (kc) { const v = wkKcal(); kc.textContent = v ? '≈ ' + nf(v) + ' kcal' : '–'; }
});

root.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t.matches && t.matches('[data-re$=".series"], [data-re$=".reps"], [data-re$=".min"], [data-lv]')) setTimeout(() => { try { t.select(); } catch (err) { /* nada */ } }, 0);
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (st.lib && t.dataset.libm != null) { st.lib.m = t.value; return render(); }
  if (st.lib && t.dataset.libeqf != null) { st.lib.eqF = t.value; return render(); }
  if (st.live && t.dataset.livetitle != null) {
    const L = st.live;
    if (t.value === '__custom') { L.custom = true; L.nombre = ''; liveSave(); render(); const i = document.querySelector('[data-livename]'); if (i) i.focus(); return; }
    const op = liveOpciones().find((o) => o.nombre === t.value);
    const hecho = L.ex.some((ex) => ex.s.some(serieCuenta));
    if (op && !hecho) { liveCargarSesion(op); toast(`Cargados los ejercicios de ${op.nombre}`); }
    else { L.nombre = t.value; L.foco = op ? op.foco : ''; L.custom = false; if (hecho) toast('Nombre cambiado. Tus series se mantienen.'); }
    liveSave(); return render();
  }
  if (st.lib && t.dataset.libeq != null) { st.lib.soloEq = t.checked; const l = document.getElementById('lib-list'); if (l) l.innerHTML = libListHTML(); return; }
  if (st.lib && st.lib.crear && t.dataset.libc) { st.lib.crear[t.dataset.libc] = t.value; return; }
  // Cambiar el tipo de un día de la rutina.
  if (st.re && t.dataset.ret != null) {
    const d = Number(t.dataset.ret), R = st.re.draft;
    R.sesiones[d] = R.modo === 'propuesta' ? E.sesionPorDefecto(t.value, goalsKind(), R.otro, { split: R.split, exp: R.exp, equipo: R.equipo }) : E.sesionVacia(t.value, R.otro);
    st.re.dirty = true; st.re.alt = null; st.re.ses = null;
    render();
  }
});

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
  if (!u) { st.view = 'auth'; st.profile = null; st.weights = []; st.workouts = []; st.wk = null; st.rw = null; st.re = null; st.live = null; st.lib = null; return render(); }
  try {
    st.profile = await api.getProfile(u.uid);
    if (!st.profile || !st.profile.onboarded) return startOnboarding();
    st.weights = await api.listWeights(u.uid);
    st.workouts = await api.listWorkouts(u.uid);
    E.setPropios(st.profile.ejPropios);
    // Si cerraste la app a mitad de un entrenamiento de fuerza, sigue donde lo dejaste.
    try { const sv = JSON.parse(lsGet('cadencia-live') || 'null'); if (sv && sv.uid === u.uid && Array.isArray(sv.ex)) { st.live = sv; st.liveMin = true; } } catch (e) { /* nada */ }
    st.view = 'main';
    render();
  } catch (e) {
    st.errText = errorText(e); st.view = 'error'; render();
  }
}

root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  if (act === 'mode') { st.authMode = v; st.authMsg = null; const f = root.querySelector('form'); const email = f && f.email.value; render(); keepForm({ email }); }
  else if (act === 'peek') { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Ver' : 'Ocultar'; }
  else if (act === 'forgot') onForgot();
  else if (act === 'goal') { const g = st.ob.objetivos; st.ob.objetivos = g.includes(v) ? g.filter((x) => x !== v) : [...g, v]; render(); }
  else if (act === 'sex') { st.ob.sexo = v; render(); }
  else if (act === 'ob-back') { st.ob.step = Math.max(0, st.ob.step - 1); st.ob.msg = ''; render(); }
  else if (act === 'tab') { st.tab = v; st.editGoals = null; lsSet('cadencia-tab', v); render(); window.scrollTo(0, 0); }
  else if (act === 'install') { if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') installEvt = null; render(); } }
  else if (act === 'install-hide') { lsSet('cadencia-install-hide', '1'); render(); }
  else if (act === 'delweight') delWeight(v);
  else if (act === 'pesomet') { st.pesoMet = v; render(); }
  else if (act === 'peso-ideal') {
    const val = nf(Number(v), 1);
    if (b.dataset.ctx === 'ob' && st.ob) { st.ob.pesoObjetivo = val; st.ob.msg = ''; render(); }
    else { const i = root.querySelector('form[data-form="profile"] [name="pesoObjetivo"]'); if (i) i.value = val; }
    toast(`Objetivo: ${val} kg`);
  }
  else if (act === 'psex') { const f = b.closest('form'); f.sexo.value = v; b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
  else if (act === 'pgoal') {
    const g = st.editGoals || [...(st.profile.objetivos || [])];
    st.editGoals = g.includes(v) ? g.filter((x) => x !== v) : [...g, v];
    b.setAttribute('aria-pressed', String(st.editGoals.includes(v)));
    b.querySelector('.tick').innerHTML = st.editGoals.includes(v) ? I.check : '';
  }
  else if (act === 'theme') { lsSet('cadencia-theme', v === 'auto' ? null : v); applyTheme(); render(); }
  else if (act === 'logout') { st.tab = 'inicio'; st.authMode = 'login'; st.authMsg = null; lsSet('cadencia-tab', null); await api.logout(); }
  else if (act === 'retry') { st.view = 'boot'; enter(st.user); }
});

root.addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.ob;
  if (!k || !st.ob) return;
  st.ob[k] = e.target.value;
  // activar/desactivar «Siguiente» sin redibujar (para no perder el foco del teclado)
  const o = st.ob, next = root.querySelector('[data-next]');
  const ok = o.step === 1 ? !!o.sexo && !!o.edad : o.step === 2 ? !!o.alturaCm : o.step === 3 ? !!o.pesoKg : true;
  if (next) next.disabled = !ok;
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, kind = f.dataset.form;
  if (kind === 'login') onLogin(f);
  else if (kind === 'register') onRegister(f);
  else if (kind === 'ob') obNext();
  else if (kind === 'quickweight') { const ok = await saveWeight(todayISO(), f.kg.value); if (!ok) return; }
  else if (kind === 'addweight') saveWeight(f.fecha.value, f.kg.value, { grasa: f.grasa.value, musculo: f.musculo.value, agua: f.agua.value, hueso: f.hueso.value });
  else if (kind === 'profile') saveProfileForm(f);
  else if (kind === 'wk') wkSave();
  else if (kind === 'rw') rwNext();
});

/* ---------- arranque ---------- */
(async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => { /* sin modo sin conexión */ });
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
