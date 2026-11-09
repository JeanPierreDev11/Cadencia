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
  workouts: [], wkTab: lsGet('cadencia-wktab') || 'semana', wk: null, planDraft: null, planN: 4,
};

function render() {
  if (st.view === 'auth') root.innerHTML = viewAuth();
  else if (st.view === 'onboarding') root.innerHTML = viewOnboarding();
  else if (st.view === 'main') root.innerHTML = viewMain();
  else if (st.view === 'error') root.innerHTML = viewError();
  document.title = APP_NAME;
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
      </label>`;
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
    if (o.pesoObjetivo.trim()) { const t = num(o.pesoObjetivo); if (!(t >= 30 && t <= 250)) return 'El peso objetivo tiene que estar entre 30 y 250 kg, o déjalo vacío.'; }
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
    st.workouts = []; st.wk = null; st.planDraft = null;
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
  if (st.wk) return viewWkForm();
  const body = st.tab === 'peso' ? viewPeso() : st.tab === 'perfil' ? viewPerfil() : st.tab === 'entreno' ? viewEntreno() : viewInicio();
  return `<main class="main">${body}</main>
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
function chart(points, target) {
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
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
    ${ticks.map((t) => `<line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${nf(t, 0)}</text>`).join('')}
    ${target ? `<line class="tg" x1="${P.l}" x2="${W - P.r}" y1="${y(target)}" y2="${y(target)}"/>` : ''}
    <path class="ar" d="${area}"/><path class="ln" d="${d}"/>
    ${points.length <= 40 ? points.map((p) => `<circle class="dot" r="3.5" cx="${x(p.fecha)}" cy="${y(p.kg)}"/>`).join('') : ''}
    <text x="${P.l}" y="${H - 4}">${fmtDate(points[0].fecha)}</text>
    <text x="${W - P.r}" y="${H - 4}" text-anchor="end">${fmtDate(points[points.length - 1].fecha)}</text>
  </svg>`;
}

function viewPeso() {
  const ws = st.weights, p = st.profile;
  const rows = ws.slice().reverse();
  return `
    <header class="hello"><div><h1>Peso</h1><p>${ws.length} ${ws.length === 1 ? 'registro' : 'registros'}${p.pesoObjetivo ? ` · objetivo ${nf(p.pesoObjetivo, 1)} kg` : ''}</p></div></header>
    <section class="card">
      <h2>Evolución</h2>
      ${ws.length >= 2 ? chart(ws.slice(-90), p.pesoObjetivo) : '<div class="empty"><b>Aún no hay gráfica</b><span>Con dos registros verás aquí cómo cambia tu peso.</span></div>'}
    </section>
    <section class="card">
      <h2>Añadir registro</h2>
      <form class="form-grid" data-form="addweight" novalidate>
        <div class="two">
          <label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="${todayISO()}" max="${todayISO()}"></label>
          <label class="field"><span>Peso (kg)</span><input class="input" name="kg" inputmode="decimal" placeholder="${nf(currentKg(), 1)}"></label>
        </div>
        <button class="btn block" type="submit">Guardar peso</button>
      </form>
    </section>
    <section class="card">
      <h2>Historial</h2>
      ${rows.length ? `<div class="list">${rows.map((w, i) => {
        const prev = rows[i + 1];
        const dd = prev ? w.kg - prev.kg : null;
        return `<div class="row"><span>${esc(fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</span>
          <span style="display:flex;align-items:center;gap:10px"><span class="muted small">${dd == null ? '' : (dd > 0 ? '+' : dd < 0 ? '−' : '±') + nf(Math.abs(dd), 1)}</span><b>${nf(w.kg, 1)} kg</b>
          <button class="iconbtn" data-act="delweight" data-v="${esc(w.fecha)}" aria-label="Borrar registro del ${esc(w.fecha)}">${I.trash}</button></span></div>`;
      }).join('')}</div>` : '<div class="empty">Sin registros todavía.</div>'}
    </section>`;
}

async function saveWeight(fecha, raw) {
  const kg = num(raw);
  if (!(kg >= 30 && kg <= 250)) { toast('Escribe un peso entre 30 y 250 kg'); return false; }
  if (!fecha || fecha > todayISO()) { toast('Elige una fecha de hoy o anterior'); return false; }
  const v = Math.round(kg * 10) / 10;
  try {
    await api.addWeight(st.user.uid, fecha, v);
    st.weights = await api.listWeights(st.user.uid);
    const last = latestWeight();
    if (last) { await api.saveProfile(st.user.uid, { pesoKg: last.kg }); st.profile.pesoKg = last.kg; }
    render();
    toast('Peso guardado');
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
  if (obj != null && !(obj >= 30 && obj <= 250)) return toast('El peso objetivo tiene que estar entre 30 y 250 kg');
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
const planOf = () => (st.profile && st.profile.plan && Array.isArray(st.profile.plan.dias) && st.profile.plan.dias.length === 7 ? st.profile.plan.dias : null);
const dayPlan = (iso) => { const p = planOf(); const d = p && p[E.weekdayIdx(iso)]; return d && d.t !== 'descanso' ? d : null; };
const tipoIcon = (t) => (t === 'bici' ? I.bike : I.dumb);
const planCount = (dias) => dias.filter((d) => d.t !== 'descanso').length;

async function savePlan(dias) {
  const plan = { dias, n: planCount(dias) };
  await api.saveProfile(st.user.uid, { plan });
  st.profile = { ...st.profile, plan };
}

/* ---------- tarjeta en Inicio ---------- */
function homeTraining() {
  const today = todayISO(), mon = E.mondayOf(today), plan = planOf();
  const stt = E.weekStats(st.workouts, mon);
  const dp = dayPlan(today), doneToday = st.workouts.some((w) => w.fecha === today);
  const line = doneToday ? 'Hoy ya has entrenado. Buen trabajo.'
    : dp ? `Hoy: ${E.TIPOS[dp.t]}${dp.foco ? ' · ' + dp.foco : ''} · ${fmtDur(dp.min)}`
    : plan ? 'Hoy toca descansar.'
    : 'Crea tu plan semanal y la app te dirá qué toca cada día.';
  const planned = plan ? planCount(plan) : 0;
  return `<section class="card">
    <div class="card-head"><h2>Entreno de hoy</h2><button class="link" data-act="tab" data-v="entreno">Abrir</button></div>
    <p>${esc(line)}</p>
    <p class="small muted">Esta semana: ${stt.n}${planned ? ` de ${planned}` : ''} ${stt.n === 1 && !planned ? 'sesión' : 'sesiones'} · ${fmtDur(stt.min)}</p>
  </section>`;
}

/* ---------- pestaña Entreno ---------- */
function viewEntreno() {
  const today = todayISO(), mon = E.mondayOf(today), sun = E.addDays(mon, 6);
  const sub = ['semana', 'historial', 'plan'].includes(st.wkTab) ? st.wkTab : 'semana';
  const body = sub === 'historial' ? wkHistorial() : sub === 'plan' ? wkPlan() : wkSemana();
  return `<header class="hello"><div><h1>Entreno</h1><p>Semana del ${esc(fmtDate(mon))} al ${esc(fmtDate(sun))}</p></div>
      <button class="btn small" data-act="wk-new" data-date="${today}">${I.plus} Registrar</button></header>
    <div class="seg" role="group" aria-label="Secciones de entreno">
      ${[['semana', 'Semana'], ['historial', 'Historial'], ['plan', 'Plan']].map(([v, t]) => `<button type="button" data-act="wktab" data-v="${v}" aria-pressed="${sub === v}">${t}</button>`).join('')}
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
      const h = (s.min / max) * (H - P.t - P.b), x = P.l + i * bw + bw * 0.16, w = bw * 0.68, y = H - P.b - Math.max(h, s.min ? 3 : 0);
      const cur = i === series.length - 1;
      return `<rect class="bar ${cur ? 'cur' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, s.min ? 3 : 0).toFixed(1)}" rx="4"/>
        ${s.min ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${nf(s.min / 60, 1)}</text>` : ''}
        <text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(fmtDate(s.lunes))}</text>`;
    }).join('')}
  </svg>`;
}

function wkSemana() {
  const today = todayISO(), mon = E.mondayOf(today), ws = st.workouts, plan = planOf();
  const stt = E.weekStats(ws, mon);
  const planned = plan ? planCount(plan) : 0;
  const cells = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = E.addDays(mon, i), did = ws.some((w) => w.fecha === date), dp = dayPlan(date);
    const state = did ? 'done' : dp ? (date < today ? 'miss' : 'plan') : 'rest';
    const inner = did ? I.check : dp ? tipoIcon(dp.t) : '';
    const label = `${E.DIAS_LARGO[i]}: ${did ? 'entrenado' : dp ? E.TIPOS[dp.t] + ' previsto' : 'descanso'}`;
    return `<button type="button" class="dc ${state} ${date === today ? 'now' : ''}" data-act="wk-new" data-date="${date}" data-tipo="${dp ? dp.t : ''}" ${date > today ? 'disabled' : ''} aria-label="${esc(label)}"><span>${E.DIAS[i]}</span><i>${inner}</i></button>`;
  }).join('');

  const dp = dayPlan(today), doneToday = ws.some((w) => w.fecha === today);
  let todayCard;
  if (doneToday) todayCard = `<section class="card ok-card"><h2>Hoy</h2><p><b>Ya has entrenado hoy.</b> Come bien y descansa.</p></section>`;
  else if (dp) todayCard = `<section class="card"><h2>Hoy toca</h2>
      <p class="today-line">${tipoIcon(dp.t)}<span><b>${E.TIPOS[dp.t]}</b>${dp.foco ? ` · ${esc(dp.foco)}` : ''}<br><span class="muted small">${fmtDur(dp.min)} previstos</span></span></p>
      <button class="btn block" data-act="wk-new" data-date="${today}" data-tipo="${dp.t}">Registrar entreno</button></section>`;
  else if (plan) todayCard = `<section class="card"><h2>Hoy</h2><p>Hoy toca descansar. Si te apetece moverte, puedes registrar una sesión extra.</p></section>`;
  else todayCard = `<section class="card install"><h2>Aún no tienes plan semanal</h2><p>La app te propone uno según tus objetivos y luego lo ajustas a tu gusto.</p>
      <button class="btn block" data-act="plan-propose">Crear mi plan</button></section>`;

  const streak = E.streakWeeks(ws, mon);
  return `
    <section class="card"><h2>Tu semana</h2><div class="weekstrip">${cells}</div></section>
    ${todayCard}
    <div class="stats">
      <section class="stat"><span class="label">Tiempo</span><span class="val num nowrap">${fmtDur(stt.min).replace(" min", "")}${stt.min < 60 ? "<em>min</em>" : stt.min % 60 ? "<em>min</em>" : ""}</span></section>
      <section class="stat"><span class="label">Sesiones</span><span class="val num">${stt.n}${planned ? `<em>de ${planned}</em>` : ''}</span></section>
      <section class="stat"><span class="label">Distancia en bici</span><span class="val num">${nf(stt.km, 1)}<em>km</em></span>${stt.elev ? `<span class="hint">+${nf(stt.elev)} m de desnivel</span>` : ''}</section>
      <section class="stat"><span class="label">Calorías</span><span class="val num">${nf(stt.kcal)}<em>kcal</em></span><span class="hint">Estimadas según tu peso</span></section>
    </div>
    <section class="card"><div class="card-head"><h2>Racha</h2></div>
      <p class="streak"><b class="num">${streak}</b> ${streak === 1 ? 'semana seguida' : 'semanas seguidas'} entrenando</p>
      <p class="small muted">Cuenta cada semana con al menos un entreno.</p></section>
    <section class="card"><h2>Horas por semana</h2>${barsChart(E.weeksSeries(ws, mon, 8))}</section>`;
}

function wkRow(w) {
  const sub = [fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short' }), fmtDur(w.min)];
  if (w.tipo === 'bici') { if (w.km) sub.push(`${nf(w.km, 1)} km`); if (w.elev) sub.push(`+${nf(w.elev)} m`); }
  else { const ne = (w.ejercicios || []).length; if (ne) sub.push(`${ne} ${ne === 1 ? 'ejercicio' : 'ejercicios'}`); }
  return `<div class="row wrow"><span class="wico">${tipoIcon(w.tipo)}</span>
    <span class="wtxt"><b>${esc(w.nombre || E.TIPOS[w.tipo])}</b><span class="muted small">${esc(sub.join(' · '))}</span></span>
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

/* ---------- plan semanal ---------- */
function planEditRows(dias) {
  return dias.map((d, i) => `<div class="prow">
    <div class="prow-top"><b>${E.DIAS_LARGO[i]}</b>
      <select class="input sel" data-plan="${i}.t" aria-label="Entreno del ${E.DIAS_LARGO[i].toLowerCase()}">
        ${['descanso', 'bici', 'gym'].map((t) => `<option value="${t}" ${d.t === t ? 'selected' : ''}>${E.TIPOS[t]}</option>`).join('')}
      </select></div>
    ${d.t !== 'descanso' ? `<div class="prow-bot">
      <input class="input" data-plan="${i}.foco" value="${esc(d.foco || '')}" placeholder="En qué consiste" maxlength="40" aria-label="Descripción del ${E.DIAS_LARGO[i].toLowerCase()}">
      <label class="minbox"><input class="input" data-plan="${i}.min" inputmode="numeric" value="${esc(d.min || '')}" aria-label="Minutos del ${E.DIAS_LARGO[i].toLowerCase()}"><span>min</span></label></div>` : ''}
  </div>`).join('');
}

function wkPlan() {
  const plan = planOf(), draft = st.planDraft, goals = (st.profile.objetivos || []).map(goalById).filter(Boolean);
  const kind = E.planKind(st.profile.objetivos);
  return `
    ${plan ? `<section class="card"><h2>Tu plan semanal</h2><p class="small muted">Cambia el tipo, la descripción o los minutos de cada día. Se guarda solo.</p>${planEditRows(plan)}</section>` : ''}
    <section class="card">
      <h2>${plan ? 'Pedir otra propuesta' : 'Propuesta de la app'}</h2>
      <p class="small muted">Pensada para tus objetivos: ${esc(goals.map((g) => g.t.toLowerCase()).join(', ') || 'mantenerte en forma')}.</p>
      <p>${esc(E.KIND_TEXT[kind])}</p>
      <div class="field"><span>Días de entreno a la semana</span>
        <div class="seg" role="group" aria-label="Días de entreno">${[3, 4, 5].map((n) => `<button type="button" data-act="plan-n" data-v="${n}" aria-pressed="${st.planN === n}">${n} días</button>`).join('')}</div></div>
      <button class="btn ${draft ? 'quiet' : ''} block" data-act="plan-propose">${draft ? 'Actualizar propuesta' : 'Ver propuesta'}</button>
    </section>
    ${draft ? `<section class="card accent-card"><h2>Propuesta para ${planCount(draft)} días</h2>
      <div class="list">${draft.map((d, i) => `<div class="row"><span><b>${E.DIAS_LARGO[i]}</b></span><span class="muted" style="text-align:right">${d.t === 'descanso' ? 'Descanso' : `${E.TIPOS[d.t]} · ${esc(d.foco)} · ${fmtDur(d.min)}`}</span></div>`).join('')}</div>
      <button class="btn block" data-act="plan-use">${plan ? 'Sustituir mi plan por este' : 'Usar este plan'}</button>
      <button class="link" data-act="plan-discard">Descartar</button></section>` : ''}`;
}

/* ---------- formulario de registro ---------- */
function newWk(date, tipo) {
  const f = date || todayISO(), dp = dayPlan(f);
  const t = tipo === 'bici' || tipo === 'gym' ? tipo : dp ? dp.t : 'bici';
  const same = dp && dp.t === t;
  return { fecha: f, tipo: t, nombre: same ? dp.foco || '' : '', min: same && dp.min ? String(dp.min) : '', km: '', elev: '', pulso: '', esf: 2,
    ex: t === 'gym' ? [blankEx()] : [], msg: '', saving: false };
}
const blankEx = () => ({ n: '', s: [{ kg: '', reps: '' }] });

function wkKcal() {
  const w = st.wk;
  return E.estimateKcal({ tipo: w.tipo, min: num(w.min), km: num(w.km), esf: w.esf }, currentKg());
}

function viewWkForm() {
  const w = st.wk, bici = w.tipo === 'bici';
  const names = [...new Set([...st.workouts.flatMap((x) => (x.ejercicios || []).map((e) => e.n)), ...E.EJERCICIOS_COMUNES])];
  const kc = wkKcal();
  return `<form class="screen" data-form="wk" novalidate>
    <div class="ob-top"><button type="button" class="ob-back" data-act="wk-cancel" aria-label="Volver">${I.back}</button><h1 class="form-title">Registrar entreno</h1></div>
    <div class="form-grid" style="padding-top:20px;flex:1;align-content:start">
      <div class="seg" role="group" aria-label="Tipo de entreno">
        <button type="button" data-act="wk-tipo" data-v="bici" aria-pressed="${bici}">Bici</button>
        <button type="button" data-act="wk-tipo" data-v="gym" aria-pressed="${!bici}">Gimnasio</button>
      </div>
      <div class="two">
        <label class="field"><span>Fecha</span><input class="input" type="date" data-wk="fecha" value="${esc(w.fecha)}" max="${todayISO()}"></label>
        <label class="field"><span>Duración (min)</span><input class="input" data-wk="min" inputmode="numeric" value="${esc(w.min)}" placeholder="60"></label>
      </div>
      <label class="field"><span>Nombre <span class="muted">(opcional)</span></span><input class="input" data-wk="nombre" maxlength="60" value="${esc(w.nombre)}" placeholder="${bici ? 'Ej. Salida por Artxanda' : 'Ej. Pierna'}"></label>
      ${bici ? `<div class="two">
          <label class="field"><span>Distancia (km)</span><input class="input" data-wk="km" inputmode="decimal" value="${esc(w.km)}" placeholder="45"></label>
          <label class="field"><span>Desnivel (m)</span><input class="input" data-wk="elev" inputmode="numeric" value="${esc(w.elev)}" placeholder="600"></label>
        </div>
        <label class="field"><span>Pulso medio <span class="muted">(opcional)</span></span><input class="input" data-wk="pulso" inputmode="numeric" value="${esc(w.pulso)}" placeholder="140"></label>` : ''}
      <div class="field"><span>Esfuerzo</span>
        <div class="seg" role="group" aria-label="Esfuerzo">${[[1, 'Suave'], [2, 'Medio'], [3, 'Duro']].map(([v, t]) => `<button type="button" data-act="wk-esf" data-v="${v}" aria-pressed="${w.esf === v}">${t}</button>`).join('')}</div></div>
      ${bici ? '' : `<datalist id="exlist">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="field"><span>Ejercicios</span></div>
        ${w.ex.map((e, i) => `<div class="exc">
          <div class="exc-head"><input class="input" list="exlist" data-exn="${i}" value="${esc(e.n)}" placeholder="Ejercicio (ej. Sentadilla)" autocomplete="off" aria-label="Nombre del ejercicio ${i + 1}"><button type="button" class="iconbtn" data-act="ex-del" data-v="${i}" aria-label="Quitar ejercicio">${I.trash}</button></div>
          ${e.s.map((s, j) => `<div class="setrow"><span class="muted small">${j + 1}</span>
            <input class="input" data-set="${i}.${j}.kg" inputmode="decimal" value="${esc(s.kg)}" placeholder="kg" aria-label="Kilos de la serie ${j + 1}"><span class="muted">×</span>
            <input class="input" data-set="${i}.${j}.reps" inputmode="numeric" value="${esc(s.reps)}" placeholder="reps" aria-label="Repeticiones de la serie ${j + 1}">
            <button type="button" class="iconbtn" data-act="set-del" data-v="${i}.${j}" aria-label="Quitar serie ${j + 1}">✕</button></div>`).join('')}
          <button type="button" class="link" data-act="set-add" data-v="${i}">+ Añadir serie</button></div>`).join('')}
        <button type="button" class="btn quiet small" data-act="ex-add" style="justify-self:start">${I.plus} Añadir ejercicio</button>`}
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
  if (w.tipo === 'bici') {
    const opt = (raw, lo, hi, msg) => { if (!String(raw).trim()) return null; const v = num(raw); if (!(v >= lo && v <= hi)) throw new Error(msg); return v; };
    try {
      const km = opt(w.km, 0, 500, 'La distancia tiene que estar entre 0 y 500 km.');
      const el = opt(w.elev, 0, 10000, 'El desnivel tiene que estar entre 0 y 10.000 m.');
      const pu = opt(w.pulso, 40, 230, 'El pulso tiene que estar entre 40 y 230.');
      if (km) o.km = Math.round(km * 10) / 10;
      if (el) o.elev = Math.round(el);
      if (pu) o.pulso = Math.round(pu);
    } catch (e) { return fail(e.message); }
  } else {
    const ejs = [];
    for (const e of w.ex) {
      if (!e.n.trim()) continue;
      const series = [];
      for (const s of e.s) {
        const reps = num(s.reps), kg = String(s.kg).trim() ? num(s.kg) : 0;
        if (!String(s.reps).trim() && !String(s.kg).trim()) continue;
        if (!(reps >= 1 && reps <= 200) || !(kg >= 0 && kg <= 600)) return fail(`Revisa las series de «${e.n.trim()}»: repeticiones entre 1 y 200 y kilos entre 0 y 600.`);
        series.push({ kg: Math.round(kg * 10) / 10, reps: Math.round(reps) });
      }
      if (series.length) ejs.push({ n: e.n.trim().slice(0, 60), series });
    }
    if (ejs.length) o.ejercicios = ejs;
  }
  o.kcal = E.estimateKcal(o, currentKg());
  w.saving = true; w.msg = ''; render();
  try {
    const before = E.records(st.workouts), after = E.records([...st.workouts, o]);
    await api.saveWorkout(st.user.uid, o);
    st.workouts = await api.listWorkouts(st.user.uid);
    st.wk = null; st.tab = 'entreno'; st.wkTab = 'semana'; lsSet('cadencia-tab', 'entreno');
    render(); window.scrollTo(0, 0);
    toast(E.beatsRecord(before, after) ? '¡Nuevo récord personal!' : 'Entreno guardado');
  } catch (e) { w.saving = false; w.msg = errorText(e); render(); }
}

/* ---------- eventos del entreno ---------- */
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  const w = st.wk;
  if (act === 'wktab') { st.wkTab = v; lsSet('cadencia-wktab', v); render(); }
  else if (act === 'wk-new') { st.wk = newWk(b.dataset.date, b.dataset.tipo); render(); window.scrollTo(0, 0); }
  else if (act === 'wk-cancel') { st.wk = null; render(); }
  else if (act === 'wk-tipo' && w) { w.tipo = v; if (v === 'gym' && !w.ex.length) w.ex = [blankEx()]; render(); }
  else if (act === 'wk-esf' && w) { w.esf = Number(v); render(); }
  else if (act === 'ex-add' && w) { w.ex.push(blankEx()); render(); }
  else if (act === 'ex-del' && w) { w.ex.splice(Number(v), 1); if (!w.ex.length) w.ex.push(blankEx()); render(); }
  else if (act === 'set-add' && w) { const ex = w.ex[Number(v)]; const last = ex.s[ex.s.length - 1] || { kg: '', reps: '' }; ex.s.push({ kg: last.kg, reps: last.reps }); render(); }
  else if (act === 'set-del' && w) { const [i, j] = v.split('.').map(Number); w.ex[i].s.splice(j, 1); if (!w.ex[i].s.length) w.ex[i].s.push({ kg: '', reps: '' }); render(); }
  else if (act === 'wk-del') {
    if (!window.confirm('¿Borrar este entreno?')) return;
    try { await api.deleteWorkout(st.user.uid, v); st.workouts = await api.listWorkouts(st.user.uid); render(); toast('Entreno borrado'); } catch (err) { toast(errorText(err)); }
  }
  else if (act === 'plan-n') { st.planN = Number(v); if (st.planDraft) st.planDraft = E.proposePlan(st.profile.objetivos, st.planN); render(); }
  else if (act === 'plan-propose') { st.wkTab = 'plan'; lsSet('cadencia-wktab', 'plan'); st.planDraft = E.proposePlan(st.profile.objetivos, st.planN); render(); }
  else if (act === 'plan-discard') { st.planDraft = null; render(); }
  else if (act === 'plan-use') {
    try { await savePlan(st.planDraft); st.planDraft = null; st.wkTab = 'semana'; lsSet('cadencia-wktab', 'semana'); render(); window.scrollTo(0, 0); toast('Plan guardado'); } catch (err) { toast(errorText(err)); }
  }
});

root.addEventListener('input', (e) => {
  const t = e.target, w = st.wk;
  if (!w) return;
  if (t.dataset.wk) w[t.dataset.wk] = t.value;
  else if (t.dataset.exn != null) w.ex[Number(t.dataset.exn)].n = t.value;
  else if (t.dataset.set) { const [i, j, k] = t.dataset.set.split('.'); w.ex[Number(i)].s[Number(j)][k] = t.value; }
  else return;
  const kc = document.getElementById('wk-kcal');
  if (kc) { const v = wkKcal(); kc.textContent = v ? '≈ ' + nf(v) + ' kcal' : '–'; }
});

root.addEventListener('change', async (e) => {
  const t = e.target;
  const w = st.wk;
  // Al elegir un ejercicio que ya hiciste, se rellenan las series de la última vez.
  if (w && t.dataset.exn != null) {
    const ex = w.ex[Number(t.dataset.exn)];
    ex.n = t.value;
    const empty = ex.s.every((s) => !String(s.kg).trim() && !String(s.reps).trim());
    const prev = empty ? E.lastSets(st.workouts, ex.n) : null;
    if (prev) { ex.s = prev.map((s) => ({ kg: s.kg ? String(s.kg).replace('.', ',') : '', reps: String(s.reps) })); render(); }
    return;
  }
  // Edición del plan semanal: se guarda al terminar de editar cada campo.
  if (t.dataset.plan) {
    const plan = planOf();
    if (!plan) return;
    const [i, k] = t.dataset.plan.split('.');
    const dias = plan.map((d) => ({ ...d }));
    const d = dias[Number(i)];
    if (k === 't') { d.t = t.value; if (d.t === 'descanso') { d.foco = ''; d.min = 0; } else if (!(d.min > 0)) d.min = 60; }
    else if (k === 'foco') d.foco = t.value.trim().slice(0, 40);
    else if (k === 'min') { const m = num(t.value); d.min = m >= 5 && m <= 600 ? Math.round(m) : d.min; }
    try { await savePlan(dias); if (k === 't' || k === 'min') render(); toast('Plan guardado'); } catch (err) { toast(errorText(err)); }
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
  if (!u) { st.view = 'auth'; st.profile = null; st.weights = []; st.workouts = []; st.wk = null; st.planDraft = null; return render(); }
  try {
    st.profile = await api.getProfile(u.uid);
    if (!st.profile || !st.profile.onboarded) return startOnboarding();
    st.weights = await api.listWeights(u.uid);
    st.workouts = await api.listWorkouts(u.uid);
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
  else if (kind === 'addweight') saveWeight(f.fecha.value, f.kg.value);
  else if (kind === 'profile') saveProfileForm(f);
  else if (kind === 'wk') wkSave();
});

/* ---------- arranque ---------- */
(async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
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
