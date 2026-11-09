import { createBackend, errorText } from './data.js';
import { APP_NAME } from './config.js';

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
  { id: 'peso', t: 'Peso', ico: I.scale },
  { id: 'perfil', t: 'Perfil', ico: I.user },
];

function viewMain() {
  const body = st.tab === 'peso' ? viewPeso() : st.tab === 'perfil' ? viewPerfil() : viewInicio();
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
  if (!u) { st.view = 'auth'; st.profile = null; st.weights = []; return render(); }
  try {
    st.profile = await api.getProfile(u.uid);
    if (!st.profile || !st.profile.onboarded) return startOnboarding();
    st.weights = await api.listWeights(u.uid);
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
