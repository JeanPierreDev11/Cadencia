// Entreno: tarjeta de Inicio, pestaña Entreno (semana, historial, rutinas), asistente de rutinas,
// biblioteca de ejercicios, entrenamiento en directo y registro de bici, cardio y otros.
import { esc, num, nf, todayISO, fmtDate, lsSet, lsGet, toast, I } from './util.js';
import { errorText } from './data.js';
import * as E from './entreno.js';
import * as CAL from './calorias.js';
import { fetchAICoachRating, datosParaCoach, perfilParaCoach, COACH_DEMO } from './coach.js';

export function crearEntreno(ctx) {
  const { st, root } = ctx;
  const render = () => ctx.render();
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] }); // el acceso a datos se crea al arrancar
  const M = new Proxy({}, { get: (_, k) => ctx.M[k] });
  const currentKg = () => ctx.currentKg();
  const goalById = (id) => ctx.goalById(id);
  const esPro = () => !!(st.profile && st.profile.isPro === true);

const fmtDur = (m) => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
const fmtClock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const RT = E.RTIPOS;
const WK_DE = { fuerza: 'gym', bici: 'bici', cardio: 'cardio', otro: 'otro' }; // tipo de rutina → tipo de entreno registrado
const clone = (o) => JSON.parse(JSON.stringify(o));
const kgTxt = (v) => nf(Math.round(v * 10) / 10);
// Sugerencia Pro para la serie j: la misma serie de la última sesión (st.workouts ya viene de Firestore) con +1 rep o +2,5 kg.
// Las series de calentamiento (w) van delante: «Anterior» y la sugerencia se leen por posición entre las series de trabajo.
const idxTrabajo = (ex, j) => ex.s.slice(0, j).filter((q) => !q.w).length;
const sugSerie = (ex, j) => (esPro() && !(st.live && st.live.edit) && !ex.s[j].w ? E.sugerirSerie(ex.prev[idxTrabajo(ex, j)], ex.objReps) : null);
// Límite gratuito: 3 rutinas y 3 ejercicios propios. Sin Pro, al llegar a 3 se avisa en lugar de crear.
const LIM_FREE = 3;
const sobreLimite = (tipo) => !esPro() && (tipo === 'rutinas' ? rutinasList().length : ((st.profile && st.profile.ejPropios) || []).length) >= LIM_FREE;
function avisoLimite(tipo) { st.limite = { tipo }; render(); }
const abrirSuscripcion = () => { st.limite = null; st.pf = { v: 'suscripcion', f: {}, busy: false }; render(); };
// 1RM estimado (Brzycki) del ejercicio con lo que lleva escrito; vacío si no hay serie válida.
const ormHTML = (ex) => { const v = E.mejor1RM(ex.s, num); return v == null ? '' : `👑 1RM estimado: ${kgTxt(v)} kg`; };
const rutinaOf = () => { const r = st.profile && st.profile.rutina; return r && Array.isArray(r.dias) && r.dias.length && r.sesiones ? r : null; };
// Todas tus rutinas guardadas; la activa es la que usa la semana, Inicio y el entrenamiento en directo.
function rutinasList() {
  const p = st.profile || {}, a = rutinaOf();
  let list = Array.isArray(p.rutinas) ? p.rutinas.filter((x) => x && x.id && Array.isArray(x.dias)) : [];
  if (a) {
    if (!a.id) { a.id = 'r1'; a.nombre = a.nombre || 'Mi rutina'; }
    list = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list];
  }
  return list;
}
const nidR = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// dayPlanBase: lo que dice la rutina. dayPlan: además aplica los entrenos movidos a otro día (Pro, «Mover entreno a Hoy»): el día original pasa a descanso y el día destino hereda su sesión.
const dayPlanBase = (iso) => { const r = rutinaOf(); if (!r) return null; const d = E.weekdayIdx(iso); return r.dias.includes(d) ? r.sesiones[d] || null : null; };
const dayPlan = (iso) => {
  const sv = E.salvLista(st.profile);
  if (!sv.length) return dayPlanBase(iso);
  if (sv.some((x) => x.de === iso)) return null;
  const m = sv.find((x) => x.a === iso);
  return (m && dayPlanBase(m.de)) || dayPlanBase(iso);
};
// ¿Se puede mover a hoy la sesión del día d? (ver E.moverAHoy)
const moverInfo = (d) => E.moverAHoy(d, todayISO(), dayPlan, new Set(st.workouts.map((w) => w.fecha)), E.salvLista(st.profile));
// Día elegido en la tira semanal (por defecto hoy; si es de otra semana, vuelve a hoy).
const diaSel = () => { const t = todayISO(), m = E.mondayOf(t), v = st.wkDia; return v && v >= m && v <= E.addDays(m, 6) ? v : t; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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
// Racha: días entrenados seguidos (los descansos programados no la rompen). Color según días: 0 gris, 1-3 amarillo, 4-6 naranja, 7+ rojo «On Fire».
function rachaActual() {
  const r = rutinaOf();
  return E.streakDays(st.workouts, todayISO(), r ? (d) => !!dayPlan(d) : undefined);
}
function fuegoHTML(n, grande = false) {
  const nivel = n >= 7 ? 'fire' : n >= 4 ? 'hot' : n >= 1 ? 'on' : 'off';
  const fill = { off: '#333333', on: '#F2BE1A', hot: '#FF6A00', fire: 'url(#fg-fire)' }[nivel];
  const svg = `<svg viewBox="0 0 48 60" aria-hidden="true" focusable="false"><defs><linearGradient id="fg-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC21A"/><stop offset=".45" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E0161B"/></linearGradient></defs><path fill="${fill}" d="M24 1c2 13 17 19 17 36 0 12-7 22-17 22S7 49 7 37c0-8 4-13 8-19 1 6 4 8 6 8 0-8-2-17 3-25z"/></svg>`;
  return `<span class="flame ${nivel} ${grande ? 'lg' : ''}" role="img" aria-label="Racha de ${n} ${n === 1 ? 'día' : 'días'}">${svg}<b class="num">${n}</b></span>`;
}

function homeTraining() {
  const r = rutinaOf();
  const tarjeta = (titulo, l1, l2) => `<section class="card tap" data-act="tab" data-v="entreno" role="button" tabindex="0" aria-label="${esc(titulo)}: abrir Entreno">
    <h2>${esc(titulo)}</h2>${l1 ? `<p>${esc(l1)}</p>` : ''}${l2 ? `<p class="small muted">${esc(l2)}</p>` : ''}</section>`;
  if (!r) return tarjeta('Entreno de hoy', 'Añade tu rutina y la app te dirá qué toca cada día.', '');
  const today = todayISO(), stt = E.weekStats(st.workouts, E.mondayOf(today));
  const dp = dayPlan(today), doneToday = st.workouts.some((w) => w.fecha === today);
  const l1 = doneToday ? 'Hoy ya has entrenado. Buen trabajo.' : dp ? sesDuracion(dp) : 'Hoy toca descansar.';
  return tarjeta(`Entreno de hoy: ${dp ? dp.nombre : 'Descanso'}`, l1, `Esta semana: ${stt.n} de ${r.dias.length} sesiones · ${fmtDur(stt.min)}`);
}

/* ---------- pestaña Entreno ---------- */
function viewEntreno() {
  if (!rutinaOf()) {
    return `${ctx.stravaBtn ? ctx.stravaBtn() : ''}<div class="wk-empty"><button type="button" class="addbig" data-act="rw-start"><span class="addbig-c">${I.plusBig}</span><span>Añadir rutina</span></button><button type="button" class="btn ghost" data-act="rut-imp">Importar rutina con un código</button></div>`;
  }
  const today = todayISO(), mon = E.mondayOf(today), sun = E.addDays(mon, 6);
  const sub = ['semana', 'rutina', 'objetivos'].includes(st.wkTab) ? st.wkTab : 'semana';
  const body = sub === 'rutina' ? wkRutina() : sub === 'objetivos' ? M.viewObjetivos() : wkSemana();
  return `<header class="hello"><div><h1>Entreno</h1><p>Semana del ${esc(fmtDate(mon))} al ${esc(fmtDate(sun))}</p></div>
      <button type="button" class="iconbtn hist-btn" data-act="wk-hist" aria-label="Historial de entrenos">${I.clock}</button></header>
    ${ctx.stravaBtn ? ctx.stravaBtn() : ''}
    <div class="seg" role="group" aria-label="Secciones de entreno">
      ${[['semana', 'Semana'], ['rutina', 'Rutinas'], ['objetivos', 'Objetivos']].map(([v, t]) => `<button type="button" data-act="wktab" data-v="${v}" aria-pressed="${sub === v}">${t}</button>`).join('')}
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
  const stt = E.weekStats(ws, mon), sel = diaSel();
  // Tocar un día solo lo selecciona (métricas y plan de ese día abajo); registrar se hace con el botón de la tarjeta del día.
  const cells = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = E.addDays(mon, i), did = ws.some((w) => w.fecha === date), dp = dayPlan(date);
    const state = did ? 'done' : dp ? (date < today ? 'miss' : 'plan') : 'rest';
    const mov = !did && !dp && E.salvLista(st.profile).find((x) => x.de === date);
    const label = `${E.DIAS_LARGO[i]}: ${did ? 'entrenado' : dp ? dp.nombre + ' previsto' : mov ? 'entreno movido al ' + E.DIAS_LARGO[E.weekdayIdx(mov.a)].toLowerCase() : 'descanso'}`;
    return `<button type="button" class="dc ${state} ${date === today ? 'now' : ''}" data-act="wk-dia" data-date="${date}" aria-pressed="${date === sel}" aria-label="${esc(label)}"><span>${E.DIAS[i]}</span><i>${did ? I.check : dp ? tipoIcon(dp.t) : ''}</i></button>`;
  }).join('');

  const streak = E.streakDays(ws, today, (d) => !!dayPlan(d));
  // Si tu rutina no tiene bici y sí fuerza, el panel habla de series y kilos movidos en lugar de sesiones y distancia.
  const soloFuerza = r.dias.every((d) => r.sesiones[d].t !== 'bici') && r.dias.some((d) => r.sesiones[d].t === 'fuerza');
  const hoy = E.dayStats(ws, sel);
  const caja2 = soloFuerza
    ? `<section class="stat"><span class="label">Series</span><span class="val num">${nf(hoy.sets)}</span></section>`
    : `<section class="stat"><span class="label">Sesiones</span><span class="val num">${stt.n}<em>de ${r.dias.length}</em></span></section>`;
  const caja3 = soloFuerza
    ? `<section class="stat"><span class="label">Volumen total</span><span class="val num">${nf(hoy.vol)}<em>kg</em></span></section>`
    : `<section class="stat"><span class="label">Distancia en bici</span><span class="val num">${nf(stt.km, 1)}<em>km</em></span>${stt.elev ? `<span class="hint">+${nf(stt.elev)} m de desnivel</span>` : ''}</section>`;
  return `
    <section class="card"><h2>Tu semana</h2><div class="weekstrip">${cells}</div></section>
    ${diaHTML(sel, today)}
    <div class="stats" aria-label="Métricas del ${esc(sel === today ? 'día de hoy' : fmtDate(sel, { weekday: 'long', day: 'numeric' }))}">
      <section class="stat"><span class="label">Tiempo</span><span class="val num nowrap">${fmtDur(hoy.min).replace(' min', '')}${hoy.min % 60 ? '<em>min</em>' : ''}</span></section>
      ${caja2}
      ${caja3}
      <section class="stat"><span class="label">Calorías</span><span class="val num">${nf(hoy.kcal)}<em>kcal</em></span><span class="hint">Estimadas según tu peso</span></section>
    </div>
    <section class="card racha-card"><h2>Racha</h2>${fuegoHTML(streak, true)}
      <p class="small muted">Los descansos no la rompen. Vuelve a 0 si faltas a un día con entreno.</p></section>
    <section class="card"><h2>Horas por semana</h2>${barsChart(E.weeksSeries(ws, mon, 8))}</section>`;
}

// Tarjeta del día elegido en la tira: lo registrado (con Coach AI), lo previsto, «Registrar sesión» y «Mover entreno a Hoy».
function diaHTML(sel, today) {
  const esHoy = sel === today, futuro = sel > today, dp = dayPlan(sel), pro = esPro();
  const hechos = st.workouts.filter((w) => w.fecha === sel);
  const titulo = esHoy ? 'Hoy' : cap(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'short' }));
  const reg = (txt, cls = 'ghost') => (futuro ? '' : `<button type="button" class="btn ${cls} block" data-act="wk-new" data-date="${sel}">${txt}</button>`);
  const plan = dp ? `<p class="today-line">${tipoIcon(dp.t)}<span><b>${esc(dp.nombre)}</b> · ${sesDuracion(dp)}<br><span class="muted small">${esc(sesResumen(dp))}</span></span></p>` : '';
  const mv = moverInfo(sel);
  const mover = !mv ? '' : mv.ok
    ? `<button type="button" class="btn ghost block mover-btn ${pro ? '' : 'is-locked'}" data-act="wk-mover" data-v="${sel}">Mover entreno a Hoy${pro ? '' : ' <span class="protag">Pro</span>'}</button>`
    : `<p class="small muted">${esc(mv.msg)}</p>`;
  if (hechos.length) {
    return `<section class="card dia-card ${esHoy ? 'ok-card' : ''}"><h2>${esc(titulo)}</h2>
      ${esHoy ? '<p><b>Ya has entrenado hoy.</b> Come bien y descansa.</p>' : ''}
      ${hechos.map((w) => `<div class="dia-wk"><div class="list">${wkRow(w, false)}</div>${aiHTML(w, true)}</div>`).join('')}
      ${reg('Registrar otra sesión')}</section>`;
  }
  if (dp) {
    const txt = esHoy ? '' : futuro ? '<p class="small muted">Previsto en tu rutina.</p>' : '<p class="small muted">No registraste esta sesión.</p>';
    const empezar = esHoy ? `<button type="button" class="btn block" data-act="wk-new" data-date="${today}" data-tipo="${WK_DE[dp.t]}">${dp.t === 'fuerza' ? 'Empezar entrenamiento' : 'Registrar entreno'}</button>` : '';
    return `<section class="card dia-card"><h2>${esHoy ? 'Hoy toca' : esc(titulo)}</h2>${plan}${txt}${empezar}${reg('Registrar sesión', esHoy || futuro ? 'ghost' : '')}${mover}</section>`;
  }
  const movido = E.salvLista(st.profile).find((x) => x.de === sel);
  const desc = movido ? `La sesión de este día se movió al ${esc(E.DIAS_LARGO[E.weekdayIdx(movido.a)].toLowerCase())}. Cuenta como descanso.`
    : esHoy ? 'Hoy toca descansar. Si te apetece moverte, puedes registrar una sesión extra.' : futuro ? 'Día de descanso.' : 'Día de descanso. No hay ningún entreno registrado.';
  return `<section class="card dia-card"><h2>${esc(titulo)}</h2><p>${desc}</p>${reg('Registrar sesión')}</section>`;
}

/* ---------- Coach AI (Pro): bajo demanda y guardado en el propio entreno ---------- */
// Campos del documento users/{uid}/entrenos/{id}: aiNota (0-10), aiTitulo, aiTexto, aiConsejos[], aiDemo, aiFecha.
const AI_CAMPOS = ['aiNota', 'aiTitulo', 'aiTexto', 'aiConsejos', 'aiDemo', 'aiFecha'];
// Análisis guardado (o null). Uno de ejemplo deja de valer cuando la IA sea real (COACH_DEMO = false) y se puede volver a pedir.
const aiDe = (w) => (w && Number.isFinite(Number(w.aiNota)) && !(w.aiDemo && !COACH_DEMO)
  ? { nota: Number(w.aiNota), titulo: w.aiTitulo || '', analisis: w.aiTexto || '', consejos: Array.isArray(w.aiConsejos) ? w.aiConsejos : [], demo: !!w.aiDemo } : null);
const aiPosible = (w) => !!w && w.tipo === 'gym' && (w.ejercicios || []).length > 0;
function aiHTML(w, compacto = false) {
  if (!aiPosible(w)) return '';
  const ai = aiDe(w), pend = (st.aiPend || {})[w.id], pro = esPro();
  if (ai) {
    const pct = Math.max(0, Math.min(100, ai.nota * 10));
    return `<div class="ai-res ${compacto ? 'sm' : ''}">
      <span class="ai-lbl">🧠 Coach AI${ai.demo ? ' <em class="ai-demo">Ejemplo</em>' : ''}</span>
      <div class="ai-score ${compacto ? 'sm' : ''}" style="--p:${pct.toFixed(0)}"><b class="num">${nf(ai.nota, 1)}</b><span>/ 10</span></div>
      <p class="ai-tit">${esc(ai.titulo)}</p>
      <section class="ai-box"><span class="ai-lbl">Análisis</span><p>${esc(ai.analisis)}</p>
        ${ai.consejos.length ? `<ul>${ai.consejos.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</section></div>`;
  }
  if (pend === 'cargando') return `<div class="ai-load" role="status"><span class="ai-spin" aria-hidden="true"></span><span class="small muted">Analizando…</span></div>`;
  return `${pend === 'error' ? '<p class="small muted">No se ha podido analizar ahora mismo. Inténtalo otra vez.</p>' : ''}
    <button type="button" class="btn block ai-btn ${pro ? '' : 'is-locked'}" data-act="ai-pedir" data-v="${esc(w.id)}">Solicitar Análisis AI 🧠${pro ? '' : ' <span class="protag">Pro</span>'}</button>`;
}
// Pide el análisis (solo al pulsar el botón), lo guarda en el documento del entreno y repinta. Si ya está guardado, no vuelve a pedirlo.
async function pedirCoach(id) {
  const w0 = st.workouts.find((x) => x.id === id);
  st.aiPend = st.aiPend || {};
  if (!aiPosible(w0) || aiDe(w0) || st.aiPend[id] === 'cargando') return;
  st.aiPend[id] = 'cargando'; render();
  try {
    const res = await fetchAICoachRating(datosParaCoach(w0), perfilParaCoach(st.profile));
    const nota = Number(res && res.nota);
    if (!Number.isFinite(nota)) throw new Error('Respuesta no válida');
    const w = st.workouts.find((x) => x.id === id);
    if (!w || !st.user) { delete st.aiPend[id]; return render(); } // borrado o sesión cerrada mientras tanto
    const nuevo = { ...w,
      aiNota: Math.round(Math.max(0, Math.min(10, nota)) * 10) / 10,
      aiTitulo: String(res.titulo || '').slice(0, 80),
      aiTexto: String(res.analisis || '').slice(0, 1200),
      aiConsejos: (Array.isArray(res.consejos) ? res.consejos : []).slice(0, 5).map((c) => String(c).slice(0, 300)),
      aiDemo: !!res.demo,
      aiFecha: new Date().toISOString() };
    await api.saveWorkout(st.user.uid, nuevo);
    st.workouts = st.workouts.map((x) => (x.id === id ? nuevo : x));
    delete st.aiPend[id];
  } catch (e) { st.aiPend[id] = 'error'; }
  render();
}

function wkRow(w, mod) {
  const sub = [fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short' }), fmtDur(w.min)];
  if (w.km) sub.push(`${nf(w.km, 1)} km`);
  if (w.elev) sub.push(`+${nf(w.elev)} m`);
  if (w.fuente === 'strava') sub.push('Strava');
  const ne = (w.ejercicios || []).length; if (ne) sub.push(`${ne} ${ne === 1 ? 'ejercicio' : 'ejercicios'}`);
  const icoT = w.tipo === 'gym' ? 'fuerza' : w.tipo;
  return `<div class="row wrow"><span class="wico">${tipoIcon(icoT)}</span>
    <span class="wtxt"><b>${esc(w.nombre || E.TIPOS[w.tipo] || 'Entreno')}</b><span class="muted small">${esc(sub.join(' · '))}</span></span>
    <span class="wkcal muted small">${w.kcal ? nf(w.kcal) + ' kcal' : ''}</span>
    ${mod ? `<button type="button" class="iconbtn" data-act="wk-edit" data-v="${esc(w.id)}" aria-label="Editar entreno">${I.pencil}</button><button type="button" class="iconbtn bad" data-act="wk-del-ask" data-v="${esc(w.id)}" aria-label="Borrar entreno">${I.trash}</button>` : ''}</div>`;
}

function wkHistSheetHTML() {
  const ws = st.workouts, mod = !!st.wkMod;
  let body;
  if (!ws.length) body = `<div class="empty"><b>Todavía no hay entrenos</b><span>Pulsa «Iniciar entreno» y aquí verás tu historial y tus récords.</span></div>`;
  else {
    const r = E.records(ws), rec = [];
    if (r.bici.km) rec.push(['Salida más larga', `${nf(r.bici.km.v, 1)} km`, r.bici.km.fecha]);
    if (r.bici.elev) rec.push(['Más desnivel', `${nf(r.bici.elev.v)} m`, r.bici.elev.fecha]);
    if (r.bici.min) rec.push(['Más tiempo en bici', fmtDur(r.bici.min.v), r.bici.min.fecha]);
    r.gym.forEach((e) => rec.push([e.n.charAt(0).toUpperCase() + e.n.slice(1), e.best.kg > 0 ? `${nf(e.best.kg, 1)} kg × ${e.best.reps}` : `${e.best.reps} repeticiones`, e.best.fecha]));
    body = `${rec.length ? `<h3 class="sub-h">Récords personales</h3><div class="list">${rec.map(([t, v, f]) => `<div class="row"><span>${esc(t)}<br><span class="muted small">${esc(fmtDate(f, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></span><b class="nowrap">${esc(v)}</b></div>`).join('')}</div>` : ''}
      <h3 class="sub-h">Todos tus entrenos</h3><div class="list">${ws.map((w) => wkRow(w, mod)).join('')}</div>`;
  }
  return `<div class="sheet-back" data-act="wk-hist-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Historial de entrenos">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="wk-hist-close" aria-label="Cerrar">${I.back}</button><h2>Historial de entrenos</h2>
        ${ws.length ? `<button type="button" class="link" data-act="wk-mod">${mod ? 'Listo' : 'Modificar'}</button>` : '<span style="width:36px"></span>'}</div>
      <div class="sheet-list">${body}</div>
    </div>`;
}
function wkDelSheetHTML() {
  const w = st.workouts.find((x) => x.id === st.wkDel);
  return `<div class="sheet-back" data-act="wk-del-no"></div>
    <div class="sheet short" role="alertdialog" aria-modal="true" aria-label="Borrar entreno">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="wk-del-no" aria-label="Cancelar">${I.back}</button><h2>Borrar entreno</h2><span style="width:36px"></span></div>
      <div class="sheet-list form-grid">
        <p>¿Borrar <b>${esc(w ? w.nombre || E.TIPOS[w.tipo] || 'este entreno' : '')}</b>${w ? ` del ${esc(fmtDate(w.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}` : ''}?</p>
        <p class="small muted">Se borra de tu cuenta y de tus récords. No se puede deshacer.</p>
        <button type="button" class="btn block danger-solid" data-act="wk-del-yes">Borrar entreno</button>
        <button type="button" class="btn ghost block" data-act="wk-del-no">Cancelar</button>
      </div>
    </div>`;
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
  const tp = re && re.mix ? ['fuerza', 'bici', 'cardio', 'otro'] : R.tipos;
  const sel = tp.length > 1
    ? `<select class="input sel" data-ret="${d}" aria-label="Tipo de entreno del ${dl}">${tp.map((t) => `<option value="${t}" ${s.t === t ? 'selected' : ''}>${RT[t]}</option>`).join('')}</select>`
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
  const kmBox = s.t === 'bici' || s.t === 'cardio' ? `<label class="minbox"><input class="input" data-re="${d}.km" inputmode="decimal" value="${esc(s.km || '')}" aria-label="Kilómetros del ${dl}"><span>km</span></label>` : '';
  const minBox = s.t === 'fuerza' ? '' : kmBox + `<label class="minbox"><input class="input" data-re="${d}.min" inputmode="numeric" value="${esc(s.min || '')}" aria-label="Minutos del ${dl}"><span>min</span></label>`;
  const otras = rutinasList().filter((x) => x.id !== (re.rid || (st.rw && st.rw.rid)));
  const abierto = re.copy === d;
  const copiar = otras.length ? `<div class="copyday"><button type="button" class="btn quiet small" data-act="re-copy-open" data-v="${d}" aria-expanded="${abierto}">${I.copy || I.plus} Copiar día de otra rutina</button>
    ${abierto ? `<div class="alts"><span class="small muted">Elige el día que quieres traer aquí (sustituye este día)</span>${otras.map((r) => [...r.dias].sort((a, b) => a - b).map((dd) => {
      const ss = r.sesiones[dd], det = ss.t === 'fuerza' ? `${(ss.ej || []).length} ejercicios` : `${ss.min || ''} min`;
      return `<button type="button" class="altses" data-act="re-copy" data-v="${d}" data-rid="${esc(r.id)}" data-d="${dd}"><b>${esc(r.nombre || 'Rutina')} · ${E.DIAS_LARGO[dd]}</b><span class="small muted">${esc(ss.nombre || RT[ss.t])} · ${esc(det)}</span></button>`;
    }).join('')).join('')}</div>` : ''}</div>` : '';
  return `<section class="card rday">
    <div class="rd-head"><b>${E.DIAS_LARGO[d]}</b>${sel}</div>
    <div class="rd-name"><input class="input" data-re="${d}.nombre" value="${esc(s.nombre || '')}" maxlength="40" aria-label="Nombre de la sesión del ${dl}">${minBox}</div>
    ${body}
    ${copiar}
  </section>`;
}
const editorHTML = (re) => [...re.draft.dias].sort((a, b) => a - b).map((d) => dayCardHTML(re.draft, d, re)).join('');

// Limpia y valida la rutina antes de guardarla. Devuelve { rutina } o { error }.
function normRutina(R) {
  const used = [...new Set(R.dias.map((d) => R.sesiones[d].t))];
  const out = { tipos: used.length ? used : R.tipos, otro: String(R.otro || '').trim().slice(0, 30), dias: [...R.dias].sort((a, b) => a - b), modo: R.modo,
    split: R.split || 'auto', exp: R.exp || '', equipo: R.equipo || null, eqSel: R.eqSel || [], donde: dondeDe(R.donde), flex: !!R.flex, deporte: R.deporte || '', sesiones: {} };
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
      if (s.t === 'bici' || s.t === 'cardio') { o.ses = s.ses || null; const k = num(s.km); if (k > 0 && k <= 500) o.km = Math.round(k * 10) / 10; }
      else o.det = String(s.det || '').trim().slice(0, 80);
    }
    out.sesiones[d] = o;
  }
  return { rutina: out };
}

// Los días de entreno de la rutina activa cambian el nivel de actividad «Auto»: se actualizan las calorías guardadas.
function recalc(data) {
  const kg = st.weights.length ? st.weights[st.weights.length - 1].kg : st.profile.pesoKg, c = CAL.resumen({ ...st.profile, ...data }, kg);
  if (c) data.calorias = c;
}

// rid: la rutina que estás editando; sin rid se crea una nueva (y pasa a ser la activa).
async function saveRutina(R, rid) {
  const res = normRutina(R);
  if (res.error) return res.error;
  const list = rutinasList(), act = rutinaOf(), id = rid || nidR(), prev = list.find((x) => x.id === id);
  if (!prev && sobreLimite('rutinas')) { st.limite = { tipo: 'rutinas' }; return `Límite gratuito alcanzado (${LIM_FREE}/${LIM_FREE}). Desbloquea rutinas ilimitadas con Cadencia PRO`; }
  const rut = { ...res.rutina, id, nombre: (prev && prev.nombre) || (list.length ? `Rutina ${list.length + 1}` : 'Mi rutina'), ...(prev && prev.shareCode ? { shareCode: prev.shareCode } : {}) };
  const data = { rutinas: prev ? list.map((x) => (x.id === id ? rut : x)) : [...list, rut] };
  if (!act || !rid || act.id === id) data.rutina = rut;
  if (rut.tipos.includes('bici') && st.profile.ciclismo !== true) data.ciclismo = true;
  recalc(data);
  await api.saveProfile(st.user.uid, data);
  st.profile = { ...st.profile, ...data };
  return '';
}
async function saveRutinas(list, activa) {
  const data = { rutinas: list };
  if (activa) data.rutina = activa;
  recalc(data);
  await api.saveProfile(st.user.uid, data);
  st.profile = { ...st.profile, ...data };
}

/* ---------- sección Rutina ---------- */
function wkRutina() {
  const list = rutinasList(), act = rutinaOf(), mod = !!st.rutMod;
  const abierta = list.find((x) => x.id === st.rutSel) || null;
  if (abierta && (!st.re || st.re.src !== 'tab' || st.re.rid !== abierta.id)) { st.re = reNew(clone(abierta), 'tab'); st.re.rid = abierta.id; }
  if (!abierta && st.re && st.re.src === 'tab') st.re = null;
  const resumen = (x) => `${x.dias.map((d) => E.DIAS[d]).join(', ')} · ${x.tipos.map((t) => (t === 'otro' && x.otro ? x.otro : RT[t])).join(', ')}`;
  const cuerpo = (r) => {
    const re = st.re, esActiva = r.id === act.id;
    const split = r.tipos.includes('fuerza') && r.split && E.SPLITS[r.split] ? ` · ${E.SPLITS[r.split].t}` : '';
    return `<div class="rutbody" id="rut-${esc(r.id)}">
      <label class="field"><span>Nombre de la rutina</span><input class="input" data-rutname maxlength="30" value="${esc(r.nombre || '')}"></label>
      <p><b>${r.dias.map((d) => E.DIAS[d]).join(', ')}</b> · ${r.tipos.map((t) => (t === 'otro' && r.otro ? r.otro : RT[t])).join(', ')}${esc(split)}</p>
      <p class="small muted">${r.modo === 'propuesta' ? 'Propuesta de la app según tus objetivos.' : 'Rutina creada por ti.'} Toca «Cambiar» en un ejercicio o sesión para ver alternativas.</p>
      ${esActiva ? '' : `<button class="btn block" data-act="rut-use">Usar esta rutina</button>`}
      <div class="rut-acts">
        <button class="btn ghost small" data-act="rw-start" data-rid="${esc(r.id)}">Cambiar días o tipos</button>
        <button class="btn ghost small" data-act="rut-dup">Duplicar</button>
        <button class="btn ghost small" data-act="rut-share">${I.share} Compartir</button>
      </div>
      ${editorHTML(re)}
      ${re.msg ? `<div class="msg" role="alert">${esc(re.msg)}</div>` : ''}
    </div>`;
  };
  return `<section class="card">
      <div class="card-head"><h2>Mis rutinas</h2><span class="head-acts">
        <button type="button" class="iconbtn ${mod ? 'on' : ''}" data-act="rut-mod" aria-pressed="${mod}" aria-label="${mod ? 'Terminar de editar rutinas' : 'Editar o borrar rutinas'}">${mod ? I.check : I.pencil}</button>
        <button class="chip chipbtn" data-act="rut-imp">Importar</button><button class="chip chipbtn" data-act="rut-new">${I.plus} Nueva</button></span></div>
      <div class="rutacc">${list.map((x) => {
        const open = abierta && abierta.id === x.id;
        return `<div class="rutitem ${open ? 'open' : ''}">
          <div class="rutline">
            <button type="button" class="rutrow ${open ? 'on' : ''}" data-act="rut-sel" data-v="${esc(x.id)}" aria-expanded="${open}" aria-controls="rut-${esc(x.id)}">
              <span><b>${esc(x.nombre || 'Rutina')}</b><small class="muted">${esc(resumen(x))}</small></span>${x.id === act.id ? '<span class="tag ok">En uso</span>' : ''}<span class="chev" aria-hidden="true">${I.chev}</span></button>
            ${mod ? `<button type="button" class="iconbtn" data-act="rut-edit" data-v="${esc(x.id)}" aria-label="Editar ${esc(x.nombre || 'rutina')}">${I.pencil}</button><button type="button" class="iconbtn bad" data-act="rut-del-ask" data-v="${esc(x.id)}" aria-label="Borrar ${esc(x.nombre || 'rutina')}">${I.trash}</button>` : ''}
          </div>
          ${open ? cuerpo(x) : ''}
        </div>`;
      }).join('')}</div>
    </section>
    ${abierta ? `<div class="savebar" id="re-savebar" ${st.re.dirty ? '' : 'hidden'}><button type="button" class="btn block" data-act="re-save">Guardar cambios</button></div>` : ''}`;
}
// Compartir: muestra el código; Importar: pide un código y copia la rutina a tu cuenta.
function rutShareSheetHTML() {
  const S = st.rutShare, imp = S.mode === 'import';
  return `<div class="sheet-back" data-act="rut-share-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="${imp ? 'Importar rutina' : 'Compartir rutina'}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="rut-share-close" aria-label="Cerrar">${I.back}</button><h2>${imp ? 'Importar rutina' : 'Compartir rutina'}</h2><span style="width:36px"></span></div>
      <div class="sheet-list form-grid">${imp ? `
        <p class="small muted">Escribe el código de 6 caracteres que te han pasado. Se añadirá una copia a tus rutinas.</p>
        <label class="field"><span>Código</span><input class="input code-in" id="rut-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC123"></label>
        ${S.msg ? `<div class="msg" role="alert">${esc(S.msg)}</div>` : ''}
        <button type="button" class="btn block" data-act="rut-imp-go" ${S.busy ? 'disabled' : ''}>${S.busy ? '<span class="spinner"></span>' : 'Importar'}</button>`
      : S.code ? `
        <p class="small muted">Pásale este código a quien quieras. Podrá importar «${esc(S.nombre || 'tu rutina')}» desde Entreno → Importar.</p>
        <div class="share-code" aria-label="Código de la rutina">${esc(S.code)}</div>
        <button type="button" class="btn block" data-act="rut-copy" data-v="${esc(S.code)}">Copiar código</button>
        <p class="small muted">Si cambias la rutina, vuelve a pulsar Compartir para actualizar lo que verán.</p>`
      : '<p><span class="spinner"></span> Generando código…</p>'}</div>
    </div>`;
}
function rutDelSheetHTML() {
  const r = rutinasList().find((x) => x.id === st.rutDelAsk), esAct = r && rutinaOf() && r.id === rutinaOf().id, otras = rutinasList().length - 1;
  return `<div class="sheet-back" data-act="rut-del-no"></div>
    <div class="sheet short" role="alertdialog" aria-modal="true" aria-label="Borrar rutina">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="rut-del-no" aria-label="Cancelar">${I.back}</button><h2>Borrar rutina</h2><span style="width:36px"></span></div>
      <div class="sheet-list form-grid">
        <p>¿Borrar la rutina <b>${esc(r ? r.nombre || 'Rutina' : '')}</b>?</p>
        <p class="small muted">${esAct ? (otras ? 'Es la que usas ahora: pasarás a usar otra de tus rutinas. ' : 'Es tu única rutina: tendrás que crear otra para ver tu semana. ') : ''}No se puede deshacer.</p>
        <button type="button" class="btn block danger-solid" data-act="rut-del-yes">Borrar rutina</button>
        <button type="button" class="btn ghost block" data-act="rut-del-no">Cancelar</button>
      </div>
    </div>`;
}

/* ---------- asistente para crear la rutina (una pregunta por pantalla) ---------- */
const RW_MAIN = [
  { id: 'fuerza', t: 'Fuerza', s: 'Gimnasio, calistenia…', ico: () => I.dumb },
  { id: 'bici', t: 'Bici', s: 'Carretera, rodillo…', ico: () => I.bike },
  { id: 'cardio', t: 'Running', s: 'Correr en calle, cinta o monte', ico: () => I.pulse },
  { id: 'otro', t: 'Otro deporte', s: 'Fútbol, natación…', ico: () => I.ball },
];
const RW_EXP = [['nuevo', 'Debutante'], ['meses', 'Unos meses'], ['anio', 'Alrededor de 1 año'], ['anios', 'Años'], ['compite', 'Compito']];
const RW_DONDE = [['gym', 'Gimnasio', 'Máquinas, poleas y peso libre'], ['casa', 'Casa', 'Con poco o ningún material'], ['parque', 'Parque', 'Barras, paralelas y tu peso']];
const RW_MAT = [['maquina', 'Máquinas / poleas'], ['mancuernas', 'Mancuernas'], ['barra', 'Barras'], ['banda', 'Bandas elásticas'], ['kettlebell', 'Kettlebells'], ['ninguno', 'Solo peso corporal']];
const RW_DIV = [['ppl', 'Push · Pull · Legs', 'Empuje, tirón y pierna'], ['tp', 'Torso / Pierna', 'Tren superior e inferior'], ['full', 'Full body', 'Todo el cuerpo cada día'], ['weider', 'Un músculo por día', 'Pecho, espalda, pierna, hombro y brazos'], ['deporte', 'Fuerza para deporte', 'Potencia y core para tu deporte'], ['custom', 'Personalizado', 'Tú decides qué haces cada día']];
const RW_DEPORTES = ['Fútbol', 'Baloncesto', 'Bici', 'Pádel', 'Tenis', 'Natación', 'Running', 'Esquí'];
const EQ_DEF = { gym: ['maquina', 'mancuernas', 'barra'], casa: ['ninguno'], parque: ['ninguno'] };
// «Dónde entrenas» es una lista (['gym', 'casa']). Las rutinas guardadas antes con un solo texto ('gym') se leen como ['gym'].
const dondeDe = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((k) => EQ_DEF[k]);
// Material por defecto de los sitios elegidos; «ninguno» (peso corporal) solo si no hay nada más.
const eqDeDonde = (ds) => { const eq = [...new Set(ds.flatMap((k) => EQ_DEF[k]))]; return eq.length > 1 ? eq.filter((x) => x !== 'ninguno') : eq; };
const rwSteps = (o) => {
  if (o.main === 'fuerza') return ['tipo', 'exp', 'donde', 'material', 'n', 'dias', 'modo', ...(o.modo === 'propia' ? ['division'] : []), 'editor'];
  if (o.main === 'bici' || o.main === 'cardio') return ['tipo', 'exp', 'n', 'dias', 'modo', 'editor'];
  if (o.main === 'otro') return ['tipo', 'otro', 'n', 'dias', 'editor'];
  return ['tipo'];
};
const rwStep = (o) => rwSteps(o)[o.step] || 'tipo';
const expBars = (k) => `<span class="bars" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= k ? 'on' : ''}" style="height:${6 + i * 3}px"></i>`).join('')}</span>`;

function rwStart(rid, nueva) {
  const r = nueva ? null : rutinasList().find((x) => x.id === rid) || rutinaOf();
  if (!r && sobreLimite('rutinas')) return avisoLimite('rutinas'); // crear una rutina nueva
  const base = { step: 0, main: '', exp: '', donde: [], eq: [], n: 0, dias: [], flex: false, modo: '', division: '', deporte: '', otro: '', msg: '', anim: 'fwd' };
  st.rw = r
    ? { ...base, rid: r.id, main: r.tipos[0] || '', otro: r.otro || '', n: r.dias.length, dias: [...r.dias], flex: !!r.flex, exp: r.exp || '', donde: dondeDe(r.donde), eq: r.eqSel ? [...r.eqSel] : [], deporte: r.deporte || '' }
    : { ...base, nueva: true };
  st.re = null;
  render(); window.scrollTo(0, 0);
}

function rwCanNext() {
  const o = st.rw, s = rwStep(o);
  if (s === 'tipo') return !!o.main;
  if (s === 'exp') return !!o.exp;
  if (s === 'donde') return o.donde.length > 0;
  if (s === 'material') return o.eq.length > 0;
  if (s === 'otro') return o.otro.trim().length > 0;
  if (s === 'n') return o.n > 0;
  if (s === 'dias') return o.flex ? o.n > 0 : o.dias.length === o.n;
  if (s === 'modo') return !!o.modo;
  if (s === 'division') return !!o.division && (o.division !== 'deporte' || !!o.deporte);
  return true;
}

function viewRutWizard() {
  const o = st.rw, s = rwStep(o), steps = rwSteps(o), total = steps.length;
  const pct = o.main ? Math.min(100, ((o.step + 1) / total) * 100) : 8;
  const tick = (on) => `<span class="tick">${on ? I.check : ''}</span>`;
  const ch = (act, v, on, inner, extra = '') => `<button type="button" class="choice" data-act="${act}" data-v="${esc(v)}" aria-pressed="${on}" ${extra}>${inner}</button>`;
  let body = '', next = 'Siguiente', hint = '';
  if (s === 'tipo') {
    body = `<h1 class="ob-title">¿Qué tipo de entreno haces?</h1>
      <div class="choices big">${RW_MAIN.map((x) => ch('rw-main', x.id, o.main === x.id, `<span class="ico">${x.ico()}</span><span class="t">${x.t}<small>${x.s}</small></span>${tick(o.main === x.id)}`)).join('')}</div>`;
    hint = 'Toca una opción para continuar.';
  } else if (s === 'exp') {
    body = `<h1 class="ob-title">¿Cuánta experiencia tienes${o.main === 'fuerza' ? ' con las pesas' : o.main === 'bici' ? ' en bici' : ''}?</h1>
      <div class="choices big">${RW_EXP.map(([k, t], i) => ch('rw-exp', k, o.exp === k, `<span class="t">${t}</span>${expBars(i + 1)}`)).join('')}</div>`;
  } else if (s === 'donde') {
    body = `<h1 class="ob-title">¿Dónde entrenas?</h1>
      <p class="ob-sub">Marca todos los sitios donde entrenas.</p>
      <div class="choices big">${RW_DONDE.map(([k, t, sub]) => ch('rw-donde', k, o.donde.includes(k), `<span class="t">${t}<small>${sub}</small></span>${tick(o.donde.includes(k))}`)).join('')}</div>`;
  } else if (s === 'material') {
    body = `<h1 class="ob-title">¿Qué material tienes?</h1><p class="ob-sub">Marca todo lo que puedas usar. Solo te propondremos ejercicios con eso.</p>
      <div class="choices">${RW_MAT.map(([k, t]) => ch('rw-eq', k, o.eq.includes(k), `<span class="ico">${eqIcon(k === 'ninguno' ? 'corporal' : k)}</span><span class="t">${t}</span>${tick(o.eq.includes(k))}`)).join('')}</div>`;
  } else if (s === 'otro') {
    body = `<h1 class="ob-title">¿Qué deporte practicas?</h1>
      <label class="field"><span>Deporte</span><input class="input" data-rw="otro" value="${esc(o.otro)}" maxlength="30" placeholder="Ej. Fútbol, natación…" autocomplete="off"></label>
      <div class="chips">${RW_DEPORTES.map((d) => `<button type="button" class="chip chipbtn ${o.otro === d ? 'on' : ''}" data-act="rw-dep-otro" data-v="${esc(d)}">${esc(d)}</button>`).join('')}</div>`;
  } else if (s === 'n') {
    body = `<h1 class="ob-title">¿Cuántos días a la semana?</h1>
      <div class="numgrid big">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="numbtn num" data-act="rw-n" data-v="${n}" aria-pressed="${o.n === n}">${n}</button>`).join('')}</div>`;
  } else if (s === 'dias') {
    const k = o.dias.length, diff = o.n - k;
    body = `<h1 class="ob-title">¿Qué días?</h1><p class="ob-sub">Elige ${o.n} ${o.n === 1 ? 'día' : 'días'}, o dinos que sueles variar.</p>
      <div class="choices daylist">${E.DIAS_LARGO.map((d, i) => ch('rw-dia', i, !o.flex && o.dias.includes(i), `<span class="t">${d}</span>${tick(!o.flex && o.dias.includes(i))}`)).join('')}
        ${ch('rw-flex', 'flex', o.flex, `<span class="t">Suelo variar<small>Pondremos días orientativos y tú decides cada semana</small></span>${tick(o.flex)}`, 'style="margin-top:6px"')}</div>
      <p class="small ${o.flex || !diff ? '' : 'muted'}" role="status">${o.flex ? 'Sin días fijos: te sugerimos unos y cambias cuando quieras.' : diff === 0 ? `Perfecto: ${o.n} ${o.n === 1 ? 'día' : 'días'}.` : diff > 0 ? `Te ${diff === 1 ? 'falta' : 'faltan'} ${diff}.` : `Te ${-diff === 1 ? 'sobra' : 'sobran'} ${-diff}.`}</p>`;
    if (o.main === 'otro') next = 'Crear rutina';
  } else if (s === 'modo') {
    const goals = (st.profile.objetivos || []).map(goalById).filter(Boolean).map((g) => g.t.toLowerCase());
    const prop = o.main === 'cardio' ? 'Plan de running con rodajes suaves, series y tirada larga' : o.main === 'bici' ? 'Base aeróbica en zona 2, series y salida larga' : `Adaptada a tus objetivos${goals.length ? ': ' + goals.join(', ') : ''}`;
    body = `<h1 class="ob-title">¿Cómo quieres tu rutina?</h1>
      <div class="choices big">
        ${ch('rw-modo', 'propuesta', o.modo === 'propuesta', `<span class="ico">${I.spark}</span><span class="t">Te proponemos una<small>${esc(prop)}</small></span>${tick(o.modo === 'propuesta')}`)}
        ${ch('rw-modo', 'propia', o.modo === 'propia', `<span class="ico">${I.pencil}</span><span class="t">Personalizada<small>${o.main === 'fuerza' ? 'Eliges la división y los ejercicios de cada día' : 'Pones tú los km o el tiempo de cada día'}</small></span>${tick(o.modo === 'propia')}`)}
      </div>`;
  } else if (s === 'division') {
    body = `<h1 class="ob-title">Elige tu división</h1>
      <div class="choices big">${RW_DIV.map(([k, t, sub]) => ch('rw-div', k, o.division === k, `<span class="t">${t}<small>${sub}</small></span>${tick(o.division === k)}`)).join('')}</div>
      ${o.division === 'deporte' ? `<div class="field"><span>¿Para qué deporte?</span><div class="chips">${RW_DEPORTES.map((d) => `<button type="button" class="chip chipbtn ${o.deporte === d ? 'on' : ''}" data-act="rw-dep" data-v="${esc(d)}">${esc(d)}</button>`).join('')}</div></div>` : ''}`;
    if (o.division === 'deporte') next = 'Crear rutina';
  } else {
    const km = o.main === 'bici' || o.main === 'cardio';
    body = `<h1 class="ob-title">${o.modo === 'propuesta' ? 'Tu rutina propuesta' : 'Programa tus días'}</h1>
      <p class="ob-sub">${o.modo === 'propuesta' ? 'Toca «Cambiar» para ver alternativas y ajusta ' + (km ? 'los km o el tiempo' : 'lo que quieras') + '.' : km ? 'Elige la sesión de cada día y pon su objetivo de km o de tiempo.' : o.main === 'fuerza' ? 'Añade los ejercicios exactos de cada día.' : 'Pon el tiempo y una nota en cada día.'}</p>
      ${o.flex ? '<p class="small muted">Los días son orientativos: puedes entrenar otro día y registrarlo igual.</p>' : ''}
      ${editorHTML(st.re)}
      ${o.main !== 'otro' ? `<button type="button" class="btn quiet small" data-act="re-mix" aria-pressed="${!!st.re.mix}">${st.re.mix ? 'Un solo tipo de entreno' : 'Mezclar tipos de entreno'}</button>` : ''}`;
    next = 'Guardar rutina';
  }
  const msg = s === 'editor' ? st.re.msg : o.msg;
  const anim = o.anim ? ` step-in ${o.anim}` : ''; o.anim = null;
  const volvio = (o.maxStep || 0) > o.step; // si ya habías avanzado y has vuelto atrás, hay botón para seguir
  const showNext = volvio || (!(['tipo', 'exp', 'modo'].includes(s)) && !(s === 'n') && !(s === 'division' && o.division !== 'deporte'));
  return `<form class="screen" data-form="rw" novalidate>
    <div class="ob-top">
      <button type="button" class="ob-back" data-act="rw-back" aria-label="${o.step === 0 ? 'Cerrar' : 'Atrás'}">${o.step === 0 ? '✕' : I.back}</button>
      <div class="ob-track" aria-hidden="true" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      <span class="ob-count">${s !== 'editor' && o.main ? `${o.step + 1} de ${total}` : ''}</span>
    </div>
    <div class="ob-body${anim}">${body}${hint ? `<p class="small muted">${hint}</p>` : ''}${msg ? `<div class="msg" role="alert">${esc(msg)}</div>` : ''}</div>
    <div class="ob-foot">${showNext || s === 'editor' ? `<button class="btn block" type="submit" data-rwnext ${rwCanNext() && !o.saving ? '' : 'disabled'}>${o.saving ? '<span class="spinner"></span>' : next}</button>` : ''}</div>
  </form>`;
}

// Lo que has respondido → configuración para el motor de rutinas.
function rwCfg(o) {
  const fuerza = o.main === 'fuerza';
  const gymCompleto = o.donde.includes('gym') && ['maquina', 'mancuernas', 'barra'].every((x) => o.eq.includes(x)) && !o.eq.includes('ninguno');
  return { tipos: [o.main], dias: o.flex ? [...E.DIAS_DEF[o.n]] : [...o.dias], otro: o.main === 'otro' ? o.otro.trim() : '',
    split: 'auto', exp: o.exp, equipo: fuerza ? E.expandirEquipo(gymCompleto ? ['gym'] : o.eq) : null, run: o.main === 'cardio', escalar: o.main === 'bici' || o.main === 'cardio' };
}
// Rutina personalizada de fuerza: los días ya traen su enfoque (Push, Pierna…) pero sin ejercicios.
function rwPersonalizada(o) {
  const cfg = rwCfg(o), R = E.rutinaVacia(cfg, st.profile.objetivos);
  if (o.main === 'fuerza') {
    const split = o.division === 'deporte' ? (o.deporte === 'Bici' ? 'cicl' : 'dep') : o.division === 'custom' ? 'auto' : o.division;
    R.split = split;
    if (o.division !== 'custom') {
      const ord = E.splitOrden(split, R.dias.length, goalsKind());
      R.dias.forEach((d, i) => { const key = ord[i % ord.length]; R.sesiones[d] = { t: 'fuerza', nombre: E.SES_FUERZA[key].n, foco: key, ej: [] }; });
    }
  }
  return R;
}
// Mismas respuestas del asistente = mismo borrador (así «Atrás» y «Siguiente» no pierden lo que ya programaste).
const rwKey = (o) => JSON.stringify([o.main, o.exp, [...o.donde].sort(), [...o.eq].sort(), o.n, [...o.dias].sort(), o.flex, o.modo, o.division, o.deporte, o.otro.trim()]);
function rwGenerar() {
  const o = st.rw, key = rwKey(o), old = st.re && st.re.src === 'rw' ? st.re : null;
  if (old && old.genKey === key) { o.step = rwSteps(o).length - 1; o.maxStep = Math.max(o.maxStep || 0, o.step); o.anim = 'fwd'; render(); window.scrollTo(0, 0); return; }
  const cfg = rwCfg(o);
  const R = o.modo === 'propuesta' && o.main !== 'otro' ? E.proponerRutina(cfg, st.profile.objetivos) : rwPersonalizada(o);
  R.eqSel = o.main === 'fuerza' ? [...o.eq] : []; R.donde = [...o.donde]; R.flex = o.flex; R.deporte = o.deporte; R.exp = o.exp;
  const nuevo = reNew(R, 'rw'); nuevo.genKey = key;
  // Cambiaste una respuesta anterior: lo que ya habías programado a mano pasa al nuevo borrador (día a día, en orden) si el tipo de sesión es el mismo.
  if (old && (old.dirty || old.draft.modo === 'propia')) {
    const antes = [...old.draft.dias].sort((x, y) => x - y), ahora = [...R.dias].sort((x, y) => x - y);
    ahora.forEach((d, i) => {
      const prev = old.draft.sesiones[antes[i]];
      if (prev && prev.t === R.sesiones[d].t && (prev.t !== 'fuerza' || prev.ej.length)) R.sesiones[d] = clone(prev);
    });
    nuevo.ref = old.ref; nuevo.mix = old.mix; nuevo.dirty = true;
  }
  st.re = nuevo;
  o.step = rwSteps(o).length - 1; o.maxStep = Math.max(o.maxStep || 0, o.step); o.anim = 'fwd';
  render(); window.scrollTo(0, 0);
}
// Avance automático al tocar una opción de respuesta única (con un instante para ver la selección).
function rwAuto() {
  const o = st.rw, step = o.step;
  setTimeout(() => { if (st.rw === o && o.step === step && rwCanNext()) rwNext(); }, 170);
}

async function rwNext() {
  const o = st.rw;
  if (!rwCanNext()) return;
  o.msg = '';
  const s = rwStep(o);
  if ((s === 'modo' && !(o.modo === 'propia' && o.main === 'fuerza')) || s === 'division' || (s === 'dias' && o.main === 'otro')) return rwGenerar();
  if (s !== 'editor') { o.step++; o.maxStep = Math.max(o.maxStep || 0, o.step); o.anim = 'fwd'; render(); window.scrollTo(0, 0); return; }
  o.saving = true; st.re.msg = ''; render();
  try {
    const err = await saveRutina(st.re.draft, o.nueva ? null : o.rid);
    if (err) { o.saving = false; st.re.msg = err; return render(); }
    const otra = !o.nueva && rutinaOf() && o.rid !== rutinaOf().id;
    st.rutSel = otra ? o.rid : null;
    st.rw = null; st.re = null; st.tab = 'entreno'; st.wkTab = otra ? 'rutina' : 'semana'; lsSet('cadencia-wktab', st.wkTab);
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
// Grupo muscular → músculo concreto del mapa (por si el ejercicio no trae el detalle «mu»).
const GRUPO_MAP = { pecho: 'ch', espalda: 'la', hombro: 'sh', biceps: 'bi', triceps: 'tr', antebrazo: 'fo', cuadriceps: 'qu', femoral: 'ha', gluteo: 'gl', gemelos: 'ca', core: 'ab', aductores: 'ad', abductores: 'abd' };
const MUSC_ESPALDA = new Set(['la', 'mb', 'lb', 'tp', 'gl', 'ha', 'tr']);
// Silueta y degradados, definidos UNA vez en la página: cada tarjeta solo los referencia (<use>), así el scroll va ligero.
const ANATOMIA_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="an-body" x1="0" x2="1"><stop offset="0" style="stop-color:var(--an-b1)"/><stop offset=".5" style="stop-color:var(--an-b2)"/><stop offset="1" style="stop-color:var(--an-b1)"/></linearGradient>
  <radialGradient id="an-mp" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ff6a5c"/><stop offset=".55" stop-color="#e0201a"/><stop offset="1" stop-color="#8e0c08"/></radialGradient>
  <radialGradient id="an-ms" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ff6a5c" stop-opacity=".6"/><stop offset="1" stop-color="#8e0c08" stop-opacity=".55"/></radialGradient>
  <symbol id="an-sil" viewBox="0 0 60 130"><g fill="url(#an-body)">
    <circle cx="30" cy="8" r="6.5"/><rect x="27" y="13" width="6" height="7" rx="2"/>
    <path d="M16 25C22 20 38 20 44 25L42 45C40 54 39 60 40 70L20 70C21 60 20 54 18 45Z"/>
    <rect x="8.5" y="25" width="8" height="24" rx="4"/><rect x="43.5" y="25" width="8" height="24" rx="4"/>
    <rect x="6" y="48" width="7" height="19" rx="3.5"/><rect x="47" y="48" width="7" height="19" rx="3.5"/>
    <rect x="16.5" y="67" width="11" height="33" rx="5.5"/><rect x="32.5" y="67" width="11" height="33" rx="5.5"/>
    <rect x="18" y="98" width="8" height="27" rx="4"/><rect x="34" y="98" width="8" height="27" rx="4"/>
    <ellipse cx="22" cy="125" rx="3.8" ry="2"/><ellipse cx="38" cy="125" rx="3.8" ry="2"/></g></symbol>
</defs></svg>`;
document.body.insertAdjacentHTML('beforeend', ANATOMIA_DEFS);
// Figura anatómica: cuerpo gris con relieve y los músculos del ejercicio en rojo (principal fuerte, secundarios suaves).
// Es el sustituto hasta conectar imágenes 3D reales (ver IMG3D en ejercicios.js). lado: 'ambos' | 'front' | 'back'.
// fills: { clave de músculo: [relleno, opacidad?] }. Dibuja la silueta y solo esos músculos.
function figura(fills, lado, nombres = '') {
  const part = (parts, dx) => `<use href="#an-sil" x="${dx}" width="60" height="130"/><g transform="translate(${dx} 0)">${parts.filter(([k]) => fills[k]).map(([k, t, a, b, c, d]) => {
    const f = `fill="${fills[k][0]}"${fills[k][1] != null ? ` fill-opacity="${fills[k][1]}"` : ''}`;
    return t === 'e' ? `<ellipse ${f} cx="${a}" cy="${b}" rx="${c}" ry="${d}"/>` : t === 'r' ? `<rect ${f} x="${a}" y="${b}" width="${c}" height="${d}" rx="2.5"/>` : `<polygon ${f} points="${a}"/>`; }).join('')}</g>`;
  const solo = lado === 'ambos' ? null : lado === 'back' ? BODY.back : BODY.front;
  return `<svg class="anat" viewBox="${solo ? '0 0 64 130' : '0 0 128 130'}" role="img" aria-label="${esc(nombres)}">${solo ? part(solo, 2) : part(BODY.front, 2) + part(BODY.back, 66)}</svg>`;
}
function anatomia(x, lado = 'ambos') {
  let { p, s: sec } = E.musculosDet(x);
  if (!p.length && GRUPO_MAP[x.m]) p = [GRUPO_MAP[x.m]];
  const fills = {};
  sec.forEach((k) => { fills[k] = ['url(#an-ms)']; }); p.forEach((k) => { fills[k] = ['url(#an-mp)']; });
  return figura(fills, lado, [...p, ...sec].map((k) => E.MUSC_DET[k]).filter(Boolean).join(', '));
}
const chipIcono = (m) => { const k = GRUPO_MAP[m]; return k ? anatomia({ m, mu: k + '|' }, MUSC_ESPALDA.has(k) ? 'back' : 'front') : ''; };
// Miniatura cuadrada de un ejercicio: imagen 3D (IMG3D) si existe; si no, la misma figura anatómica de la Biblioteca (un solo lado, el del músculo principal).
const exThumb = (x) => {
  x = x || { eq: 'corporal' };
  const i3 = E.img3d(x), k = E.musculosDet(x).p[0] || GRUPO_MAP[x.m];
  return `<span class="thumb">${i3 ? `<img class="ex3d" src="${esc(i3)}" alt="" loading="lazy" decoding="async">` : anatomia(x, MUSC_ESPALDA.has(k) ? 'back' : 'front')}</span>`;
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
  if (q && L.m !== 'alt') items = E.todosEjercicios().slice(); // al buscar, se busca en todos
  else if (L.m === 'alt') items = E.alternativas({ n: L.from }, [], null, true).map(E.ejercicio).filter(Boolean);
  else if (L.m === 'rec') items = E.todosEjercicios().filter((x) => L.rec.includes(x.m)).sort((a, b) => L.rec.indexOf(a.m) - L.rec.indexOf(b.m));
  else if (L.m === 'fav') items = E.todosEjercicios().filter((x) => favs().includes(x.n));
  else if (L.m === 'todos') items = E.todosEjercicios().slice().sort((a, b) => M_ORD.indexOf(a.m) - M_ORD.indexOf(b.m));
  else items = E.todosEjercicios().filter((x) => x.m === L.m);
  if (L.eqF !== 'todo') items = items.filter((x) => x.eq === L.eqF);
  else if (L.equipo && L.soloEq) items = items.filter((x) => x.eq === 'corporal' || L.equipo.includes(x.eq));
  if (q) items = E.buscarEjercicios(items, L.q, (x) => `${E.MUSCULOS[x.m] || ''} ${E.EQUIPOS[x.eq] || ''}`);
  return items;
}

const BM_ICO = (on) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>`;
const favs = () => st.profile.ejFavs || [];
function libListHTML() {
  const L = st.lib, items = libItems();
  if (!items.length) return `<div class="empty"><b>${L.m === 'fav' && !L.q ? 'Aún no has guardado ejercicios' : 'No hay ejercicios así'}</b><span>${L.m === 'fav' && !L.q ? 'Toca el marcador de una tarjeta para guardarlo aquí.' : 'Prueba otro grupo o equipo, o créalo con «Crear».'}</span></div>`;
  const grouped = !L.q && (L.m === 'todos' || L.m === 'rec');
  const used = new Set(L.usados.map(E.normTxt)), fv = favs();
  let prev = '', out = `<p class="small muted lcount">${items.length} ${items.length === 1 ? 'ejercicio' : 'ejercicios'}</p>`;
  for (const x of items) {
    if (grouped && x.m !== prev) { out += `<div class="lgroup">${E.MUSCULOS[x.m]}</div>`; prev = x.m; }
    const inUse = L.mode === 'add' && used.has(E.normTxt(x.n)), on = L.sel.includes(x.n), saved = fv.includes(x.n);
    const img3d = E.img3d(x);
    out += `<div class="lcard ${on ? 'on' : ''} ${inUse ? 'used' : ''}">
      <button type="button" class="lc-main" data-act="lib-pick" data-n="${esc(x.n)}" ${inUse ? 'disabled' : ''} aria-label="${esc(x.n)}${inUse ? ' (ya está en la sesión)' : ''}">
        <span class="lc-img">${img3d ? `<img class="ex3d" src="${esc(img3d)}" alt="" loading="lazy" decoding="async">` : anatomia(x)}</span>
        <b class="lc-n">${esc(x.n)}</b><span class="lc-m">${esc(E.MUSCULOS[x.m] || '')}${x.propio ? ' · Tuyo' : ''}</span></button>
      <button type="button" class="lc-ico lc-bm ${saved ? 'on' : ''}" data-act="lib-fav" data-n="${esc(x.n)}" aria-pressed="${saved}" aria-label="${saved ? 'Quitar de guardados' : 'Guardar'} ${esc(x.n)}">${BM_ICO(saved)}</button>
      <button type="button" class="lc-ico lc-info" data-act="lib-det" data-n="${esc(x.n)}" aria-label="Ver cómo se hace ${esc(x.n)}">?</button>
      ${on ? `<span class="lc-ck" aria-hidden="true">${I.check}</span>` : ''}
    </div>`;
  }
  return `<div class="lgrid">${out}</div>`;
}
// Carrusel de grupos musculares: solo cambia el estado de los botones y la lista, sin repintar la hoja (así no se pierde el scroll ni el teclado).
function libChipsHTML() {
  const L = st.lib;
  const chips = [...(L.mode === 'swap' ? [['alt', 'Alternativas', '']] : []), ...(L.rec.length ? [['rec', 'Recomendados', '']] : []), ['fav', 'Guardados', BM_ICO(false)], ['todos', 'Todos', ''], ...Object.entries(E.MUSCULOS).map(([k, v]) => [k, v, chipIcono(k)])];
  return `<div class="lchips" role="group" aria-label="Grupo muscular">${chips.map(([k, t, ico]) => `<button type="button" class="lchip ${L.m === k ? 'on' : ''}" data-act="lib-m" data-v="${k}" aria-pressed="${L.m === k}">${ico ? `<span class="lchip-i">${ico}</span>` : ''}${esc(t)}</button>`).join('')}</div>`;
}

function libFootLabel() { const n = st.lib.sel.length; return n ? `Añadir ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}` : 'Elige ejercicios'; }

function libDetHTML(x) {
  const L = st.lib, { p, s } = E.musculosDet(x), i3 = E.img3d(x);
  const used = L.mode === 'add' && L.usados.map(E.normTxt).includes(E.normTxt(x.n));
  const on = L.sel.includes(x.n);
  return `<div class="sheet-head"><button type="button" class="iconbtn" data-act="lib-det-close" aria-label="Volver">${I.back}</button><h2 class="det-title">${esc(x.n)}</h2><span style="width:36px"></span></div>
    <div class="sheet-list det">
      <div class="det-hero">${i3 ? `<img class="ex3d" src="${esc(i3)}" alt="${esc(x.n)}">` : anatomia(x)}</div>
      <div class="det-body">
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
      <input class="input" type="search" data-libq placeholder="Buscar ejercicio" value="${esc(L.q)}" aria-label="Buscar ejercicio" autocomplete="off">
      ${libChipsHTML()}
      <div class="filters one">
        <label class="field"><span>Equipo</span><select class="input" data-libeqf aria-label="Equipo"><option value="todo">Todo</option>${Object.entries(E.EQUIPOS).map(([k, v]) => `<option value="${k}" ${L.eqF === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
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
    else names.forEach((n) => {
      const ex = E.nuevoEjercicio(n, kind, R.exp), rf = st.re.ref;
      // Si ya rellenaste el primer ejercicio (p. ej. 3 × 6-8), los nuevos salen con lo mismo.
      if (rf && num(rf.series) >= 1 && String(rf.reps || '').trim()) { ex.series = rf.series; ex.reps = String(rf.reps).trim(); }
      s.ej.push(ex);
    });
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
  if (!existe && sobreLimite('ejercicios')) return avisoLimite('ejercicios');
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
  return { n, m: x ? x.m : '', obj: obj || '', objReps, uni: false, superset: false, prev, s: Array.from({ length: Math.max(1, Math.min(10, nSets || 3)) }, () => ({ kg: '', reps: '', done: false, rir: '', dropset: false })) };
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
// Un entreno de fuerza nuevo pregunta el modo; si ya hay uno en curso, se continúa.
function empezarFuerza(fecha) {
  if (st.live) return startLive(fecha);
  st.modoSel = { fecha }; render();
}
// Pro: resumen al terminar (st.resumen = { id, nombre, vol, sets, min, record }). El Coach AI NO se pide solo: botón «Solicitar Análisis AI 🧠».
function resumenSheetHTML() {
  const r = st.resumen, w = st.workouts.find((x) => x.id === r.id);
  return `<div class="sheet-back" data-act="sum-close"></div>
    <div class="sheet short ai-sheet" role="dialog" aria-modal="true" aria-label="Resumen del entreno">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><span style="width:36px"></span><h2>Entreno guardado</h2><button type="button" class="iconbtn" data-act="sum-close" aria-label="Cerrar">${I.back}</button></div>
      <div class="sum-pro ai-body">
        <span class="sum-lbl">${esc(r.nombre)}${r.record ? ' · ¡Nuevo récord!' : ''}</span>
        <div class="ai-stats"><span><b class="num">${nf(r.vol)}</b> kg movidos</span><span><b class="num">${r.sets}</b> ${r.sets === 1 ? 'serie' : 'series'}</span><span><b class="num">${esc(fmtDur(r.min))}</b></span></div>
        ${aiHTML(w)}
        <button type="button" class="btn ghost block" data-act="sum-close">Listo</button>
      </div>
    </div>`;
}
function limiteSheetHTML() {
  const rut = st.limite && st.limite.tipo === 'rutinas', que = rut ? 'rutinas' : 'ejercicios propios';
  return `<div class="sheet-back" data-act="lim-close"></div>
    <div class="sheet short limite" role="alertdialog" aria-modal="true" aria-label="Límite gratuito alcanzado">
      <div class="sheet-grab"></div>
      <div class="lim-body">
        <span class="lim-ico">${I.lock}</span>
        <span class="lim-count num">${LIM_FREE}/${LIM_FREE}</span>
        <p class="lim-t">Límite gratuito alcanzado (${LIM_FREE}/${LIM_FREE}). Desbloquea ${rut ? 'rutinas' : 'ejercicios'} ilimitad${rut ? 'as' : 'os'} con Cadencia PRO</p>
        <button type="button" class="btn block" data-act="lim-pro">Ver Cadencia PRO</button>
        <button type="button" class="btn ghost block" data-act="lim-close">Ahora no</button>
        <span class="small muted">Tus ${que} actuales se mantienen: puedes usarlos, editarlos o borrarlos.</span>
      </div>
    </div>`;
}
// Calentamiento Inteligente (Pro): eliges 1, 2 o 3 series; el peso sale del peso de trabajo (rellenado si lo hay, editable).
const CAL_TXT = { 1: 'Rápido', 2: 'Normal', 3: 'Completo' };
function calentarSheetHTML() {
  const c = st.calentar, x = st.live && st.live.ex[c.i];
  const opt = (n) => `<button type="button" class="cal-opt" data-act="cal-n" data-v="${n}" aria-label="${n} ${n === 1 ? 'serie' : 'series'} de calentamiento">
      <b class="num">${n}</b><span><b>${CAL_TXT[n]}</b><small class="muted">${E.CALENTAMIENTO[n].map(([p, r]) => `${r} reps al ${Math.round(p * 100)} %`).join(' · ')}</small></span></button>`;
  return `<div class="sheet-back" data-act="cal-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Calentamiento inteligente">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="cal-close" aria-label="Cerrar">${I.back}</button><h2>🔥 Calentamiento</h2><span style="width:36px"></span></div>
      <div class="sheet-list cal-sheet">
        <p class="small muted">${c.auto ? `Peso de trabajo de ${esc(x ? x.n : 'este ejercicio')} calculado con tus series. Puedes cambiarlo.` : `No tenemos peso de ${esc(x ? x.n : 'este ejercicio')}. ¿Con cuántos kilos vas a trabajar?`}</p>
        <label class="field"><span>Peso de trabajo (kg)</span><input class="input" data-calkg inputmode="decimal" value="${esc(c.kg)}" placeholder="Ej. 60" autocomplete="off"></label>
        <p class="cal-q">¿Cuántas series de calentamiento?</p>
        <div class="cal-opts">${[1, 2, 3].map(opt).join('')}</div>
        ${c.msg ? `<div class="msg" role="alert">${esc(c.msg)}</div>` : ''}
      </div>
    </div>`;
}
function modoSheetHTML() {
  const opt = (v, ico, t, sub) => `<button type="button" class="regopt" data-act="modo-pick" data-v="${v}">${ico}<span><b>${esc(t)}</b><small class="muted">${esc(sub)}</small></span></button>`;
  return `<div class="sheet-back" data-act="modo-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Cómo quieres entrenar">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="modo-close" aria-label="Cerrar">${I.back}</button><h2>¿Cómo quieres entrenar?</h2><span style="width:36px"></span></div>
      <div class="sheet-list regopts">
        ${opt('guiado', I.dumb, 'Acompañamiento de entrenamiento', 'Descanso entre series con aviso y vibración, y sugerencias de peso')}
        ${opt('simple', I.pencil, 'Simple registro', 'Rellena kilos y repeticiones de todo de golpe y guarda')}
      </div>
    </div>`;
}
function startLive(fecha, modo = 'guiado') {
  if (st.live) {
    st.liveMin = false; st.wk = null; render(); window.scrollTo(0, 0);
    if (st.live.fecha !== fecha) toast('Ya tienes un entrenamiento de fuerza en curso');
    return;
  }
  const dp = dayPlan(fecha), plan = dp && dp.t === 'fuerza' ? dp : null;
  st.live = { uid: st.user.uid, fecha, start: Date.now(), nombre: plan ? plan.nombre : 'Entrenamiento', foco: (plan && plan.foco) || '', custom: !plan && !liveOpciones().length, modo,
    ex: plan ? plan.ej.map((e) => liveEx(e.n, e.series, `${e.series} × ${e.reps}`)) : [], msg: '' };
  st.liveMin = false; st.wk = null; liveSave(); render(); window.scrollTo(0, 0);
}
// Una serie cuenta si la marcaste con ✓ o si escribiste algo en ella.
// Un calentamiento viene rellenado de antemano: con ✓ cuenta solo si lo marcaste (en «simple registro», que no tiene ✓, cuenta si lo dejas escrito).
const serieCuenta = (s) => (s.w && !livePlano(st.live) ? !!s.done : s.done || String(s.reps).trim() !== '' || String(s.kg).trim() !== '');
function liveTotals() {
  let vol = 0, sets = 0;
  for (const ex of st.live.ex) for (const s of ex.s) if (s.done && !s.w) { sets++; vol += (num(s.kg) || 0) * (num(s.reps) || 0) * (ex.uni ? 2 : 1); }
  return { vol: Math.round(vol), sets };
}
const liveIsToday = () => st.live && st.live.fecha === todayISO() && !st.live.edit;
// Modos sin temporizador: «simple registro» y editar un entreno ya guardado.
const livePlano = (L) => L.modo === 'simple' || !!L.edit;
// Guiado: si superas las repeticiones del objetivo → sube peso; si no llegas → baja. (Objetivos en segundos se ignoran.)
function sugerencia(ex, s) {
  if (!s.done || !ex.objReps || /\b(s|seg|min)\b/i.test(ex.objReps)) return '';
  const n = String(ex.objReps).match(/\d+/g), r = Math.round(num(s.reps));
  if (!n || !(r >= 1)) return '';
  return r > Number(n[n.length - 1]) ? '↑ Sube el peso' : r < Number(n[0]) ? '↓ Baja el peso' : '';
}

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

// Modo Bestia: RIR (0-5) y drop-set por serie. Sin Pro se ven atenuados y al tocarlos sale «Función Pro».
function bestiaHTML(e, i, j, s) {
  if (!esPro()) return `<div class="lxtra is-locked"><span class="rir-wrap"><span>RIR</span><input class="rir-in" value="" placeholder="–" readonly tabindex="-1" aria-disabled="true" data-act="live-lock" aria-label="RIR serie ${j + 1} (función Pro)"></span><button type="button" class="drop-btn" data-act="live-lock" aria-disabled="true" aria-label="Drop-set serie ${j + 1} (función Pro)">D</button></div>`;
  return `<div class="lxtra"><label class="rir-wrap"><span>RIR</span><input class="rir-in" data-lv="${i}.${j}.rir" inputmode="numeric" maxlength="1" value="${esc(s.rir)}" placeholder="0-5" aria-label="RIR serie ${j + 1} de ${esc(e.n)}"></label><button type="button" class="drop-btn" data-act="live-drop" data-v="${i}.${j}" aria-pressed="${!!s.dropset}" aria-label="Marcar serie ${j + 1} como drop-set">D</button></div>`;
}
function viewLive() {
  const L = st.live, t = liveTotals(), today = liveIsToday(), plano = livePlano(L), pro = esPro();
  const fmtKg = (v) => (v ? String(v).replace('.', ',') : '');
  const blocks = L.ex.map((e, i) => {
    const x = E.ejercicio(e.n), uniOk = E.puedeUnilateral(e.n), conPeso = !x || x.eq !== 'corporal';
    return `<section class="lex ${i > 0 && L.ex[i - 1].superset ? 'ss-next' : ''} ${e.superset ? 'ss-first' : ''}">
      ${i > 0 && L.ex[i - 1].superset ? '<span class="ss-tag">Superserie</span>' : ''}
      <div class="lex-head">${exThumb(x || { eq: 'corporal' })}
        <span class="lex-t"><b>${esc(e.n)}</b><span class="small muted">${x ? E.MUSCULOS[x.m] : ''}${e.obj ? ` · Objetivo ${esc(e.obj)}` : ''}</span>${esPro() ? `<span class="orm" data-orm="${i}" ${ormHTML(e) ? '' : 'hidden'}>${ormHTML(e)}</span>` : ''}</span>
        ${!L.edit && conPeso ? `<button type="button" class="warm-btn ${pro ? '' : 'is-locked'}" data-act="live-warm" data-v="${i}" aria-label="Calentamiento para ${esc(e.n)}${pro ? '' : ' (Cadencia Pro)'}">🔥 Calentar${pro ? '' : ' <span class="protag">Pro</span>'}</button>` : ''}
        <button type="button" class="iconbtn" data-act="live-swap" data-v="${i}" aria-label="Cambiar ${esc(e.n)}">${I.swap}</button>
        <button type="button" class="iconbtn" data-act="live-del" data-v="${i}" aria-label="Quitar ${esc(e.n)}">${I.trash}</button></div>
      ${uniOk ? `<div class="seg mini" role="group" aria-label="Lados"><button type="button" data-act="live-uni" data-v="${i}" data-u="0" aria-pressed="${!e.uni}">Ambos lados</button><button type="button" data-act="live-uni" data-v="${i}" data-u="1" aria-pressed="${!!e.uni}">Unilateral</button></div>` : ''}
      <div class="ltab ${plano ? 'simple' : ''}">
        <div class="lrow-h"><span>Serie</span><span>Anterior</span><span>kg</span><span>${e.uni ? 'Reps/lado' : 'Reps'}</span>${plano ? '' : '<span></span>'}</div>
        ${e.s.map((s, j) => { const wi = idxTrabajo(e, j), p = s.w ? null : e.prev[wi]; const sg = sugSerie(e, j); const phKg = sg ? (sg.kg ? fmtKg(sg.kg) : 'kg') : p && p.kg ? fmtKg(p.kg) : '–'; const phR = sg ? String(sg.reps) : p ? String(p.reps) : s.w ? '–' : e.objReps || '–'; const pc = sg ? ' ph-sug' : ''; const sug = plano || s.w ? '' : sugerencia(e, s); return `<div class="lset ${s.w ? 'is-w' : ''} ${!plano && s.done ? 'on' : ''}">
          ${s.w ? '<span class="num sn sn-w" title="Calentamiento" aria-label="Serie de calentamiento">W</span>' : `<span class="num sn">${wi + 1}</span>`}
          <span class="prev">${p ? `${p.kg ? fmtKg(p.kg) + ' × ' : ''}${p.reps}${p.uni ? ' /lado' : ''}` : '—'}</span>
          <input class="input${pc}" data-lv="${i}.${j}.kg" inputmode="decimal" value="${esc(s.kg)}" placeholder="${esc(phKg)}" aria-label="Kilos serie ${j + 1} de ${esc(e.n)}">
          <input class="input${pc}" data-lv="${i}.${j}.reps" inputmode="numeric" value="${esc(s.reps)}" placeholder="${esc(phR)}" aria-label="Repeticiones serie ${j + 1} de ${esc(e.n)}">
          ${plano ? '' : `<button type="button" class="chk" data-act="live-done" data-v="${i}.${j}" aria-pressed="${s.done}" aria-label="Marcar serie ${j + 1} como hecha">${I.check}</button>`}
        </div>${s.w ? '' : bestiaHTML(e, i, j, s)}${sug ? `<p class="lsug">${sug}</p>` : ''}`; }).join('')}
      </div>
      <div class="lex-foot"><button type="button" class="btn quiet small" data-act="live-set-add" data-v="${i}">${I.plus} Añadir serie</button>
        ${e.s.some((q) => q.w) ? `<button type="button" class="link" data-act="live-w-del" data-v="${i}">Quitar calentamiento</button>` : ''}
        ${e.s.length > 1 ? `<button type="button" class="link" data-act="live-set-del" data-v="${i}">Quitar la última</button>` : ''}</div>
      ${i < L.ex.length - 1 ? (pro
        ? `<button type="button" class="ss-btn" data-act="live-sup" data-v="${i}" aria-pressed="${!!e.superset}">${e.superset ? 'Superserie con ' + esc(L.ex[i + 1].n) : 'Enlazar con el siguiente: Superserie'}</button>`
        : `<button type="button" class="ss-btn is-locked" data-act="live-lock" aria-disabled="true">${I.lock} Superserie · Pro</button>`) : ''}
    </section>`;
  }).join('');
  return `<div class="screen live">
    <div class="live-top">
      <button type="button" class="ob-back" data-act="live-min" aria-label="Minimizar">${I.down}</button>
      ${liveTitleHTML(L)}
      <button type="button" class="btn small" data-act="live-fin">${plano ? 'Guardar' : 'Finalizar'}</button>
    </div>
    <div class="live-stats ${plano ? 'two' : ''}">
      ${plano ? '' : `<div><span>Duración</span><b class="num" id="live-dur">${today ? fmtClock(Date.now() - L.start) : 'Estimada'}</b></div>`}
      <div><span>Volumen</span><b class="num" id="live-vol">${nf(t.vol)} kg</b></div>
      <div><span>Series</span><b class="num" id="live-sets">${t.sets}</b></div>
    </div>
    <p class="small muted live-hint">${L.edit ? 'Corrige kilos, repeticiones o series y pulsa Guardar: se sobrescribe este entreno.' : L.modo === 'simple' ? 'Escribe kilos y repeticiones de cada serie y pulsa Guardar. Las series vacías no se apuntan.' : 'Los números grises son tu referencia (la última vez o el objetivo). Si marcas ✓ sin escribir, se apunta ese valor.'}</p>
    ${blocks || `<div class="empty"><b>Aún no hay ejercicios</b><span>Elige la sesión arriba o añade los que vayas a hacer.</span></div>`}
    <button type="button" class="btn block" data-act="live-lib">${I.plus} Añadir ejercicios</button>
    ${L.msg ? `<div class="msg" role="alert" id="live-msg">${esc(L.msg)}</div>` : ''}
    <button type="button" class="link center" data-act="live-discard">${L.edit ? 'Cancelar edición' : 'Descartar entrenamiento'}</button>
    ${plano ? '' : restHTML()}
  </div>`;
}
const liveBarHTML = () => `<button type="button" class="livebar" data-act="live-open"><span class="dot"></span><span><b>${esc(st.live.nombre)}</b><span class="small"><span id="live-bar-t">${liveIsToday() ? fmtClock(Date.now() - st.live.start) : 'En curso'}</span><span id="live-bar-rest"></span></span></span><span class="small">Volver</span></button>`;

/* ---------- descanso entre series ---------- */
// Al marcar una serie, cuenta atrás (90 s por defecto; si la ajustas, se recuerda para la próxima).
const REST_DEF = 90;
const restDur = () => { const v = Number(lsGet('cadencia-rest')); return v >= 15 && v <= 600 ? v : REST_DEF; };
let audioCtx = null;
function restStart() {
  const dur = restDur();
  st.rest = { end: Date.now() + dur * 1000, dur, done: false };
  // El sonido tiene que prepararse durante un toque (si no, el iPhone no lo deja sonar luego).
  try { const AC = window.AudioContext || window.webkitAudioContext; if (AC && !audioCtx) audioCtx = new AC(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { /* sin sonido */ }
}
function restAjustar(sec) {
  const R = st.rest; if (!R) return;
  const left = Math.max(0, R.end - Date.now()) / 1000, nl = Math.max(0, left + sec);
  R.dur = Math.max(15, Math.min(600, Math.round((R.dur + sec) / 15) * 15));
  lsSet('cadencia-rest', String(R.dur));
  R.end = Date.now() + nl * 1000;
  if (nl <= 0) restFin(); else restPaint();
}
function pitido() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); const t0 = audioCtx.currentTime + t; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18); o.start(t0); o.stop(t0 + 0.2); });
  } catch (e) { /* sin sonido */ }
}
function restFin() {
  const R = st.rest; if (!R || R.done) return;
  R.done = true; R.end = Date.now();
  pitido();
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* nada */ }
  toast('¡Descanso terminado! A por la siguiente serie');
  restPaint();
  setTimeout(() => { if (st.rest === R) { st.rest = null; restPaint(); } }, 6000);
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function restHTML() {
  const R = st.rest; if (!R) return '';
  const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
  return `<div class="restbar ${R.done ? 'fin' : ''}" id="restbar" role="timer" aria-live="off">
    <div class="rest-prog"><i id="rest-prog" style="width:${R.done ? 100 : Math.max(0, 100 - (left / R.dur) * 100).toFixed(1)}%"></i></div>
    <div class="rest-row">
      <span class="rest-t"><small>${R.done ? '¡Listo!' : 'Descanso'}</small><b class="num" id="rest-t">${R.done ? 'Siguiente serie' : mmss(left)}</b></span>
      ${R.done ? '' : `<button type="button" class="restbtn" data-act="rest-menos" aria-label="Quitar 30 segundos">−30s</button><button type="button" class="restbtn" data-act="rest-mas" aria-label="Añadir 30 segundos">+30s</button>`}
      <button type="button" class="restbtn skip" data-act="rest-saltar">${R.done ? 'Cerrar' : 'Saltar'}</button>
    </div>
  </div>`;
}
// Actualiza solo la barra de descanso (sin redibujar la pantalla, para no cerrar el teclado).
function restPaint() {
  const el = document.getElementById('restbar'), html = restHTML();
  if (el && html) {
    const R = st.rest, left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
    if (el.classList.contains('fin') !== R.done) { el.outerHTML = html; return; }
    const t = document.getElementById('rest-t'), p = document.getElementById('rest-prog');
    if (t) t.textContent = R.done ? 'Siguiente serie' : mmss(left);
    if (p) p.style.width = `${R.done ? 100 : Math.max(0, 100 - (left / R.dur) * 100).toFixed(1)}%`;
  } else if (el && !html) el.remove();
  else if (!el && html && st.live && !st.liveMin) { const host = document.querySelector('.screen.live'); if (host) host.insertAdjacentHTML('beforeend', html); }
  const lb = document.getElementById('live-bar-rest');
  if (lb) lb.textContent = st.rest && !st.rest.done ? ` · descanso ${mmss(Math.max(0, Math.ceil((st.rest.end - Date.now()) / 1000)))}` : '';
}
setInterval(() => {
  const R = st.rest;
  if (!R) return;
  if (!R.done && Date.now() >= R.end) restFin(); else if (!R.done) restPaint();
}, 250);

setInterval(() => {
  if (!st.live || !liveIsToday()) return;
  const t = fmtClock(Date.now() - st.live.start);
  const a = document.getElementById('live-dur'), b = document.getElementById('live-bar-t');
  if (a) a.textContent = t; if (b) b.textContent = t;
}, 1000);

// Peso de trabajo: la última serie con kilos de hoy; si no hay, la última serie de la última vez (historial).
function pesoObjetivo(ex) {
  for (let j = ex.s.length - 1; j >= 0; j--) { const q = ex.s[j]; if (!q.w && num(q.kg) > 0) return num(q.kg); }
  for (let j = ex.prev.length - 1; j >= 0; j--) if (num(ex.prev[j].kg) > 0) return num(ex.prev[j].kg);
  return 0;
}
function aplicarCalentamiento(i, kg, n = 3) {
  const ex = st.live.ex[i], w = E.calentamiento(kg, n);
  if (!w.length) return false;
  ex.s.unshift(...w.map((q) => ({ kg: String(q.kg).replace('.', ','), reps: String(q.reps), done: false, rir: '', dropset: false, w: true })));
  liveSave(); render();
  toast(`${w.length} ${w.length === 1 ? 'serie' : 'series'} de calentamiento para ${kgTxt(kg)} kg`);
  return true;
}

// Rellena una serie con la referencia (la última vez, o el objetivo) si está vacía.
function rellenarSerie(ex, j) {
  const s = ex.s[j], p = ex.prev[idxTrabajo(ex, j)], sg = sugSerie(ex, j);
  if (s.w) return !!String(s.reps).trim();
  if (sg) {
    if (!String(s.reps).trim()) s.reps = String(sg.reps);
    if (!String(s.kg).trim() && sg.kg) s.kg = String(sg.kg).replace('.', ',');
    return true;
  }
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
      if (!(reps >= 1 && reps <= 200) || !(kg >= 0 && kg <= 600)) return fail(`Revisa la serie ${s.w ? 'de calentamiento' : idxTrabajo(ex, j) + 1} de «${ex.n}»: repeticiones entre 1 y 200 y kilos entre 0 y 600.`);
      const q = { kg: Math.round(kg * 10) / 10, reps };
      if (s.w) { q.w = true; series.push(q); continue; } // calentamiento: se guarda marcado, no cuenta en estadísticas
      if (esPro()) { // Modo Bestia (solo Pro): rir, isDropSet e isSuperset
        if (String(s.rir).trim() !== '') q.rir = Math.max(0, Math.min(5, Math.round(num(s.rir)) || 0));
        if (s.dropset) q.isDropSet = true;
        if (ex.superset) q.isSuperset = true;
      }
      series.push(q);
    }
    if (series.length) ejs.push(ex.uni ? { n: ex.n, uni: true, series } : { n: ex.n, series });
  }
  if (!ejs.some((e) => E.trabajo(e.series).length)) return fail('Apunta al menos una serie (escribe los kilos o reps, o márcala con ✓) para guardar el entrenamiento.');
  const nSets = ejs.reduce((a, e) => a + E.trabajo(e.series).length, 0);
  const plano = livePlano(L);
  const min = L.edit ? L.orig.min : liveIsToday() && !plano ? Math.max(1, Math.min(600, Math.round((Date.now() - L.start) / 60000))) : Math.max(15, nSets * 3);
  // Al editar se sobrescribe el mismo documento (mismo id) conservando el resto de sus datos.
  const o = { ...(L.edit ? L.orig : {}), id: L.edit || 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: L.fecha, tipo: 'gym', nombre: L.nombre.trim().slice(0, 60), min, esf: L.edit ? L.orig.esf || 2 : 2, ejercicios: ejs };
  o.kcal = E.estimateKcal(o, currentKg());
  if (L.edit) AI_CAMPOS.forEach((k) => delete o[k]); // si cambian las series, el análisis guardado ya no vale
  toast('Guardando…');
  try {
    const resto = L.edit ? st.workouts.filter((w) => w.id !== L.edit) : st.workouts;
    const before = E.records(resto), after = E.records([...resto, o]);
    await api.saveWorkout(st.user.uid, o);
    st.workouts = await api.listWorkouts(st.user.uid);
    const editado = !!L.edit;
    // Pro: volumen total movido (peso × reps de todas las series; unilateral ×2, igual que el contador en vivo)
    const volTotal = Math.round(ejs.reduce((a, e) => a + E.trabajo(e.series).reduce((b, s) => b + s.kg * s.reps * (e.uni ? 2 : 1), 0), 0));
    const record = E.beatsRecord(before, after);
    st.live = null; st.liveMin = false; liveSave();
    st.tab = 'entreno'; lsSet('cadencia-tab', 'entreno');
    if (editado) st.wkHist = true; else { st.wkTab = 'semana'; lsSet('cadencia-wktab', 'semana'); }
    st.wkDia = o.fecha;
    if (esPro() && !editado) st.resumen = { id: o.id, nombre: o.nombre, vol: volTotal, sets: nSets, min, record };
    render(); window.scrollTo(0, 0);
    toast(editado ? 'Entreno actualizado' : record ? '¡Nuevo récord personal!' : `Entrenamiento guardado · ${nSets} series`);
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
// Con tipo (botón «Empezar» de la sesión de hoy) abre directamente; sin tipo pregunta qué vas a registrar.
function openRegistro(date, tipo) {
  if (!tipo) { st.regPick = { date: date || todayISO() }; return render(); }
  const t = resolveTipo(date, tipo);
  st.regPick = null;
  if (t === 'gym') return empezarFuerza(date || todayISO());
  st.wk = newWk(date, t); render(); window.scrollTo(0, 0);
}
function regSheetHTML() {
  const d = st.regPick.date, dp = dayPlan(d), hoy = d === todayISO();
  const fuerzaPlan = dp && dp.t === 'fuerza' ? dp : null;
  const cuando = hoy ? 'hoy' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' });
  const opt = (tipo, ico, t, sub) => `<button type="button" class="regopt" data-act="reg-pick" data-v="${tipo}">${ico}<span><b>${esc(t)}</b>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</span></button>`;
  const fuerzaT = st.live ? 'Fuerza (continuar el entreno en curso)' : fuerzaPlan ? `Fuerza (rutina de ${hoy ? 'hoy' : 'ese día'})` : 'Fuerza';
  const fuerzaS = st.live ? st.live.nombre : fuerzaPlan ? `${fuerzaPlan.nombre} · ${sesDuracion(fuerzaPlan)}` : 'Entreno en directo con series y kilos';
  const plan = dp && dp.t !== 'fuerza' ? `Tu rutina tenía ${dp.nombre || E.TIPOS[WK_DE[dp.t]] || 'sesión'} ${hoy ? 'hoy' : 'ese día'}.` : '';
  return `<div class="sheet-back" data-act="reg-close"></div>
    <div class="sheet short" role="dialog" aria-modal="true" aria-label="Qué vas a registrar">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button type="button" class="iconbtn" data-act="reg-close" aria-label="Cerrar">${I.back}</button><h2>¿Qué registras ${esc(cuando)}?</h2><span style="width:36px"></span></div>
      <div class="sheet-list regopts">
        ${opt('gym', I.dumb, fuerzaT, fuerzaS)}
        ${opt('bici', I.bike, 'Bici', dp && dp.t === 'bici' ? dp.nombre : 'Salida, rodillo o bici de spinning')}
        ${opt('cardio', I.heart, 'Cardio / Otro', 'Correr, nadar, pádel, caminar…')}
        ${plan ? `<p class="small muted">${esc(plan)}</p>` : ''}
      </div>
    </div>`;
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
    <div class="ob-top"><button type="button" class="ob-back" data-act="wk-cancel" aria-label="Volver">${I.back}</button><h1 class="form-title">${w.id ? 'Editar entreno' : 'Registrar entreno'}</h1></div>
    <div class="form-grid" style="padding-top:20px;flex:1;align-content:start">
      ${w.id ? `<p class="small muted">${esc(E.TIPOS[t] || 'Entreno')}</p>` : `<div class="seg" role="group" aria-label="Tipo de entreno">
        ${[['gym', 'Fuerza'], ['bici', 'Bici'], ['cardio', 'Cardio'], ['otro', 'Otro']].map(([v, l]) => `<button type="button" data-act="wk-tipo" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}
      </div>`}
      <div class="two">
        <label class="field"><span>Fecha</span><input class="input" type="date" data-wk="fecha" value="${esc(w.fecha)}" max="${todayISO()}"></label>
        <label class="field"><span>Duración (min)</span><input class="input" data-wk="min" inputmode="numeric" value="${esc(w.min)}" placeholder="60"></label>
      </div>
      <label class="field"><span>Nombre <span class="muted">(opcional)</span></span><input class="input" data-wk="nombre" maxlength="60" value="${esc(w.nombre)}" placeholder="${ph}"></label>
      ${t === 'bici' ? `<div class="two">
          <label class="field"><span>Distancia (km)</span><input class="input" data-wk="km" inputmode="decimal" value="${esc(w.km)}" placeholder="45"></label>
          <label class="field"><span>Desnivel (m)</span><input class="input" data-wk="elev" inputmode="numeric" value="${esc(w.elev)}" placeholder="600"></label>
        </div>
        <label class="field"><span>Pulso medio <span class="muted">(opcional)</span></span><input class="input" data-wk="pulso" inputmode="numeric" value="${esc(w.pulso)}" placeholder="140"></label>
        ${M.wkBiciHTML(w)}` : ''}
      ${t === 'cardio' ? `<label class="field"><span>Distancia (km) <span class="muted">(opcional)</span></span><input class="input" data-wk="km" inputmode="decimal" value="${esc(w.km)}" placeholder="6"></label>` : ''}
      <div class="field"><span>Esfuerzo</span>
        <div class="seg" role="group" aria-label="Esfuerzo">${[[1, 'Suave'], [2, 'Medio'], [3, 'Duro']].map(([v, l]) => `<button type="button" data-act="wk-esf" data-v="${v}" aria-pressed="${w.esf === v}">${l}</button>`).join('')}</div></div>
      <p class="small muted">Calorías estimadas: <b id="wk-kcal">${kc ? '≈ ' + nf(kc) + ' kcal' : '–'}</b></p>
      ${w.msg ? `<div class="msg" role="alert">${esc(w.msg)}</div>` : ''}
    </div>
    <div class="ob-foot"><button class="btn block" type="submit" ${w.saving ? 'disabled' : ''}>${w.saving ? '<span class="spinner"></span>' : w.id ? 'Guardar cambios' : 'Guardar entreno'}</button></div>
  </form>`;
}

async function wkSave() {
  const w = st.wk;
  const fail = (m) => { w.msg = m; render(); };
  const min = num(w.min);
  if (!(min >= 5 && min <= 1440)) return fail('Escribe la duración en minutos, entre 5 y 1440.');
  if (!w.fecha || w.fecha > todayISO()) return fail('Elige una fecha de hoy o anterior.');
  const o = { ...(w.orig || {}), id: w.id || 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: w.fecha, tipo: w.tipo, min: Math.round(min), esf: w.esf };
  if (!w.nombre.trim()) delete o.nombre;
  if (w.nombre.trim()) o.nombre = w.nombre.trim().slice(0, 60);
  const opt = (raw, lo, hi, msg) => { if (!String(raw).trim()) return null; const v = num(raw); if (!(v >= lo && v <= hi)) throw new Error(msg); return v; };
  try {
    if (w.tipo === 'bici' || w.tipo === 'cardio') { const km = opt(w.km, 0, 500, 'La distancia tiene que estar entre 0 y 500 km.'); if (km) o.km = Math.round(km * 10) / 10; }
    if (w.tipo === 'bici') {
      const el = opt(w.elev, 0, 10000, 'El desnivel tiene que estar entre 0 y 10.000 m.');
      const pu = opt(w.pulso, 40, 230, 'El pulso tiene que estar entre 40 y 230.');
      const np = opt(w.np || '', 50, 700, 'La potencia normalizada tiene que estar entre 50 y 700 W.');
      if (el) o.elev = Math.round(el);
      if (pu) o.pulso = Math.round(pu);
      if (np) o.np = Math.round(np);
      const bs = (st.profile.garaje && st.profile.garaje.bicis) || [];
      if (bs.length) o.bici = w.bici || bs[0].id;
    }
  } catch (e) { return fail(e.message); }
  o.kcal = E.estimateKcal(o, currentKg());
  w.saving = true; w.msg = ''; render();
  try {
    const before = E.records(st.workouts), after = E.records([...st.workouts, o]);
    await api.saveWorkout(st.user.uid, o);
    st.workouts = await api.listWorkouts(st.user.uid);
    const editado = !!w.id;
    st.wk = null; st.tab = 'entreno'; if (!editado) { st.wkTab = 'semana'; lsSet('cadencia-wktab', 'semana'); } lsSet('cadencia-tab', 'entreno');
    if (st.wkBack) { st.wkHist = true; st.wkBack = false; }
    render(); window.scrollTo(0, 0);
    toast(editado ? 'Entreno actualizado' : E.beatsRecord(before, after) ? '¡Nuevo récord personal!' : 'Entreno guardado');
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
    if (act === 'lib-m') {
      L.m = v; const l = document.getElementById('lib-list');
      document.querySelectorAll('.lchip').forEach((c) => { const on = c.dataset.v === v; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
      if (l) { l.innerHTML = libListHTML(); l.scrollTop = 0; } return;
    }
    if (act === 'lib-fav') {
      const n = b.dataset.n, f = favs(), nf2 = f.includes(n) ? f.filter((q) => q !== n) : [...f, n], l = document.getElementById('lib-list'), top = l ? l.scrollTop : 0;
      st.profile.ejFavs = nf2; api.saveProfile(st.user.uid, { ejFavs: nf2 }).catch((e) => toast(errorText(e)));
      if (l) { l.innerHTML = libListHTML(); l.scrollTop = top; } return;
    }
    if (act === 'lib-det') { L.det = b.dataset.n; return render(); }
    if (act === 'lib-det-close') { L.det = null; return render(); }
    if (act === 'lib-det-toggle') { const n = b.dataset.n; L.sel = L.sel.includes(n) ? L.sel.filter((x) => x !== n) : [...L.sel, n]; L.det = null; return render(); }
    if (act === 'lib-crear') { if (sobreLimite('ejercicios')) return avisoLimite('ejercicios'); L.crear = { n: L.q, m: L.rec[0] || 'pecho', eq: (L.equipo && L.equipo[0]) || 'mancuernas', msg: '' }; return render(); }
    if (act === 'lib-crear-cancel') { L.crear = null; return render(); }
    if (act === 'lib-crear-save') return libCrearSave();
    if (act === 'lib-add') return L.sel.length ? libApply(L.sel) : null;
    if (act === 'lib-pick') {
      const n = b.dataset.n;
      if (L.mode === 'swap') return libApply([n]);
      L.sel = L.sel.includes(n) ? L.sel.filter((x) => x !== n) : [...L.sel, n];
      const on = L.sel.includes(n);
      const card = b.parentNode; card.classList.toggle('on', on); const ck = card.querySelector('.lc-ck'); if (on && !ck) card.insertAdjacentHTML('beforeend', `<span class="lc-ck" aria-hidden="true">${I.check}</span>`); else if (!on && ck) ck.remove();
      const btn = document.getElementById('lib-addbtn'); if (btn) { btn.disabled = !L.sel.length; btn.textContent = libFootLabel(); }
      return;
    }
  }

  // asistente
  if (act === 'rw-start') return rwStart(b.dataset.rid);
  if (act === 'rut-new') return rwStart(null, true);
  if (act === 'rut-imp') { st.rutShare = { mode: 'import', msg: '', busy: false }; return render(); }
  if (act === 'rut-share-close') { st.rutShare = null; return render(); }
  if (act === 'rut-copy') { try { await navigator.clipboard.writeText(v); toast('Código copiado'); } catch (e) { toast(`Tu código es ${v}`); } return; }
  if (act === 'rut-share') {
    const list = rutinasList(), r = list.find((x) => x.id === st.rutSel) || rutinaOf();
    st.rutShare = { mode: 'share', code: '', nombre: r.nombre }; render();
    try {
      const code = await api.shareRutina(st.user.uid, r);
      if (r.shareCode !== code) await saveRutinas(list.map((x) => (x.id === r.id ? { ...x, shareCode: code } : x)), rutinaOf() && rutinaOf().id === r.id ? { ...r, shareCode: code } : null);
      st.rutShare = { mode: 'share', code, nombre: r.nombre };
    } catch (err) { st.rutShare = null; toast(errorText(err)); }
    return render();
  }
  if (act === 'rut-imp-go') {
    const S = st.rutShare, code = ((document.getElementById('rut-code') || {}).value || '').trim().toUpperCase();
    const fail = (m) => { S.busy = false; S.msg = m; render(); };
    if (!/^[A-Z0-9]{6}$/.test(code)) return fail('El código tiene 6 letras o números.');
    S.busy = true; S.msg = ''; render();
    try {
      const src = await api.getSharedRutina(code);
      if (!src || !Array.isArray(src.dias) || !Array.isArray(src.tipos) || !src.sesiones) return fail('No hay ninguna rutina con ese código.');
      const c = clone(src); delete c.shareCode; delete c.compartida;
      c.id = nidR(); c.userId = st.user.uid; c.nombre = String(c.nombre || 'Rutina importada').slice(0, 30);
      const list = rutinasList(), data = { rutinas: [...list, c] };
      if (sobreLimite('rutinas')) { S.busy = false; st.rutShare = null; return avisoLimite('rutinas'); }
      if (!rutinaOf()) data.rutina = c;
      if (c.tipos.includes('bici') && st.profile.ciclismo !== true) data.ciclismo = true;
      await api.saveProfile(st.user.uid, data); st.profile = { ...st.profile, ...data };
      st.rutShare = null; st.rutSel = c.id; st.re = null; st.wkTab = 'rutina'; toast(`Rutina «${c.nombre}» importada`);
    } catch (err) { return fail(errorText(err)); }
    return render();
  }
  if (act === 'rut-sel') { st.rutSel = st.rutSel === v ? null : v; st.re = null; return render(); }
  if (act === 'rut-mod') { st.rutMod = !st.rutMod; return render(); }
  if (act === 'rut-edit') { st.rutSel = v; st.re = null; render(); const el = document.getElementById('rut-' + v); if (el) el.scrollIntoView({ block: 'start' }); return; }
  if (act === 'rut-del-ask') { st.rutDelAsk = v; return render(); }
  if (act === 'rut-del-no') { st.rutDelAsk = null; return render(); }
  if (act === 'rut-del-yes') {
    const id = st.rutDelAsk; st.rutDelAsk = null;
    try {
      const list = rutinasList(), rest = list.filter((x) => x.id !== id), act0 = rutinaOf();
      const data = { rutinas: rest };
      if (act0 && act0.id === id) data.rutina = rest[0] || null;
      await api.saveProfile(st.user.uid, data); st.profile = { ...st.profile, ...data };
      if (st.rutSel === id) st.rutSel = null;
      if (!rest.length) st.rutMod = false;
      st.re = null; toast('Rutina borrada');
    } catch (err) { toast(errorText(err)); }
    return render();
  }
  if (act === 'rut-use' || act === 'rut-dup') {
    const list = rutinasList(), r = list.find((x) => x.id === st.rutSel) || rutinaOf();
    if (act === 'rut-dup' && sobreLimite('rutinas')) return avisoLimite('rutinas');
    try {
      if (act === 'rut-use') { await saveRutinas(list, r); st.rutSel = null; toast(`Ahora usas «${r.nombre}»`); }
      else if (act === 'rut-dup') { const c = { ...clone(r), id: nidR(), nombre: `${r.nombre || 'Rutina'} (copia)`.slice(0, 30) }; delete c.shareCode; await saveRutinas([...list, c]); st.rutSel = c.id; toast('Rutina duplicada'); }
    } catch (err) { toast(errorText(err)); }
    st.re = null; return render();
  }
  if (act === 'nov-bici') { st.tab = 'entreno'; lsSet('cadencia-tab', 'entreno'); rwStart(null, true); return render(); }
  if (o && act === 'rw-back') { if (o.step === 0) { st.rw = null; st.re = null; } else { o.step--; o.msg = ''; o.anim = 'back'; } render(); return window.scrollTo(0, 0); }
  if (o && act === 'rw-main') { if (o.main !== v) { o.main = v; o.modo = ''; o.division = ''; o.eq = []; o.donde = []; } render(); return rwAuto(); }
  if (o && act === 'rw-exp') { o.exp = v; render(); return rwAuto(); }
  // Selección múltiple: no avanza sola; «Siguiente» se activa con al menos un sitio marcado.
  if (o && act === 'rw-donde') { o.donde = o.donde.includes(v) ? o.donde.filter((x) => x !== v) : [...o.donde, v]; o.eq = eqDeDonde(o.donde); return render(); }
  if (o && act === 'rw-eq') {
    if (v === 'ninguno') o.eq = o.eq.includes(v) ? [] : [v];
    else { const rest = o.eq.filter((x) => x !== 'ninguno'); o.eq = rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v]; }
    return render();
  }
  if (o && act === 'rw-n') { o.n = Number(v); if (!o.flex && o.dias.length > o.n) o.dias = o.dias.slice(0, o.n); render(); return rwAuto(); }
  if (o && act === 'rw-dia') { const d = Number(v); o.flex = false; o.dias = o.dias.includes(d) ? o.dias.filter((x) => x !== d) : [...o.dias, d].sort((a, c) => a - c); return render(); }
  if (o && act === 'rw-flex') { o.flex = !o.flex; if (o.flex) o.dias = []; return render(); }
  if (o && act === 'rw-modo') { o.modo = v; render(); return rwAuto(); }
  if (o && act === 'rw-div') { o.division = v; render(); if (v !== 'deporte') rwAuto(); return; }
  if (o && act === 'rw-dep') { o.deporte = v; return render(); }
  if (o && act === 'rw-dep-otro') { o.otro = v; return render(); }

  if (re && act === 're-copy-open') { re.copy = re.copy === Number(v) ? null : Number(v); return render(); }
  if (re && act === 're-copy') {
    const r = rutinasList().find((x) => x.id === b.dataset.rid), src = r && r.sesiones[b.dataset.d];
    if (src) { re.draft.sesiones[Number(v)] = clone(src); re.dirty = true; re.copy = null; re.alt = null; re.ses = null; render(); toast('Día copiado'); }
    return;
  }
  if (re && act === 're-mix') { re.mix = !re.mix; return render(); }
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
    else if (act === 're-ses') { const s = R.sesiones[Number(v)], x = E.sesionPorId(b.dataset.id); s.ses = x.id; s.nombre = x.n; s.min = x.min; s.km = x.km || ''; re.ses = null; touch(); }
    else if (act === 're-save') {
      try { const err = await saveRutina(R, re.rid); if (err) { re.msg = err; return render(); } st.re = null; render(); toast('Rutina guardada'); } catch (err) { re.msg = errorText(err); render(); }
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
    if (act === 'live-set-add') { const ex = Lv.ex[Number(v)], last = ex.s[ex.s.length - 1] || { kg: '' }; ex.s.push({ kg: last.kg, reps: '', done: false, rir: '', dropset: false }); liveSave(); return render(); }
    if (act === 'live-set-del') { const ex = Lv.ex[Number(v)]; if (ex.s.length > 1) ex.s.pop(); liveSave(); return render(); }
    if (act === 'live-done') {
      const [i, j] = v.split('.').map(Number), ex = Lv.ex[i], s = ex.s[j];
      if (!s.done && !rellenarSerie(ex, j)) { toast('Escribe las repeticiones de la serie'); return; }
      s.done = !s.done; Lv.msg = '';
      if (s.done) restStart(); else if (st.rest) st.rest = null;
      liveSave(); return render();
    }
    if (act === 'live-lock') { toast('Función Pro'); return; }
    if (act === 'live-warm') {
      if (!esPro()) return abrirSuscripcion();
      const ex = Lv.ex[Number(v)];
      if (ex.s.some((q) => q.w)) { toast('Este ejercicio ya tiene calentamiento'); return; }
      const kg = pesoObjetivo(ex);
      st.calentar = { i: Number(v), kg: kg ? String(kg).replace('.', ',') : '', auto: !!kg, msg: '' }; render();
      if (!kg) { const el = document.querySelector('[data-calkg]'); if (el) el.focus(); }
      return;
    }
    if (act === 'live-w-del') { const ex = Lv.ex[Number(v)]; ex.s = ex.s.filter((q) => !q.w); if (!ex.s.length) ex.s.push({ kg: '', reps: '', done: false, rir: '', dropset: false }); liveSave(); return render(); }
    if (act === 'live-drop') { if (!esPro()) { toast('Función Pro'); return; } const [i, j] = v.split('.').map(Number), q = Lv.ex[i].s[j]; q.dropset = !q.dropset; liveSave(); return render(); }
    if (act === 'live-sup') { if (!esPro()) { toast('Función Pro'); return; } const ex = Lv.ex[Number(v)]; if (Number(v) < Lv.ex.length - 1) ex.superset = !ex.superset; liveSave(); return render(); }
    if (act === 'live-uni') { Lv.ex[Number(v)].uni = b.dataset.u === '1'; liveSave(); return render(); }
    if (act === 'live-fin') { st.rest = null; return liveFinish(); }
    if (act === 'live-discard') {
      if (!window.confirm(Lv.edit ? '¿Salir sin guardar los cambios?' : '¿Descartar este entrenamiento? Se perderán las series apuntadas.')) return;
      st.live = null; st.liveMin = false; st.rest = null; liveSave(); render(); toast(Lv.edit ? 'Edición cancelada' : 'Entrenamiento descartado'); return;
    }
  }

  // descanso
  if (act === 'rest-mas' || act === 'rest-menos') { restAjustar(act === 'rest-mas' ? 30 : -30); return; }
  if (act === 'rest-saltar') { st.rest = null; restPaint(); return; }

  // modo de entreno de fuerza
  if (act === 'sum-close') { st.resumen = null; return render(); }
  if (act === 'lim-close') { st.limite = null; return render(); }
  if (act === 'lim-pro') return abrirSuscripcion();
  if (act === 'cal-close') { st.calentar = null; return render(); }
  if (act === 'cal-n' && st.calentar) {
    const c = st.calentar, kg = num(c.kg), n = Number(v);
    if (!(kg > 0 && kg <= 600)) { c.msg = 'Escribe un peso de trabajo entre 1 y 600 kg.'; render(); const el = document.querySelector('[data-calkg]'); if (el) el.focus(); return; }
    st.calentar = null; return void aplicarCalentamiento(c.i, kg, n);
  }
  if (act === 'modo-close') { st.modoSel = null; return render(); }
  if (act === 'modo-pick' && st.modoSel) { const f = st.modoSel.fecha; st.modoSel = null; st.regPick = null; return startLive(f, v); }

  // qué registrar
  if (act === 'reg-close') { st.regPick = null; return render(); }
  if (act === 'reg-pick' && st.regPick) { const d = st.regPick.date; st.regPick = null; return openRegistro(d, v); }

  // registro
  if (act === 'wk-mover') {
    if (!esPro()) return abrirSuscripcion();
    const inf = moverInfo(v);
    if (st.salvBusy || !inf || !inf.ok) return;
    const hoy = todayISO(), lista = [...E.salvLista(st.profile), { de: v, a: hoy }].slice(-E.SALV_MAX);
    st.salvBusy = true;
    try { await api.saveProfile(st.user.uid, { salvavidas: lista }); st.profile.salvavidas = lista; }
    catch (e) { toast(errorText(e)); return; }
    finally { st.salvBusy = false; }
    const dp = dayPlan(hoy);
    st.wkDia = hoy; render(); toast(`Entreno movido a hoy: ${dp ? dp.nombre : 'entrenar'}`); return;
  }
  if (act === 'ai-pedir') { if (!esPro()) { st.resumen = null; return abrirSuscripcion(); } return void pedirCoach(v); }
  if (act === 'wk-dia') { st.wkDia = b.dataset.date; return render(); }
  if (act === 'wktab') { st.wkTab = v; lsSet('cadencia-wktab', v); render(); }
  else if (act === 'wk-new') openRegistro(b.dataset.date, b.dataset.tipo);
  else if (act === 'wk-cancel') { st.wk = null; if (st.wkBack) { st.wkHist = true; st.wkBack = false; } render(); }
  else if (act === 'wk-hist') { st.wkHist = true; st.wkMod = false; render(); }
  else if (act === 'wk-hist-close') { st.wkHist = false; st.wkMod = false; render(); }
  else if (act === 'wk-mod') { st.wkMod = !st.wkMod; render(); }
  else if (act === 'wk-edit') {
    const x = st.workouts.find((q) => q.id === v); if (!x) return;
    if (x.tipo === 'gym' && (x.ejercicios || []).length) {
      if (st.live) { toast('Termina o descarta el entrenamiento en curso antes de editar otro'); return; }
      st.live = { uid: st.user.uid, fecha: x.fecha, start: Date.now(), edit: x.id, orig: x, modo: 'edit', nombre: x.nombre || 'Entrenamiento', foco: '', custom: true, msg: '',
        ex: x.ejercicios.map((e) => ({ n: e.n, m: (E.ejercicio(e.n) || {}).m || '', obj: '', objReps: '', uni: !!e.uni, prev: [], superset: e.series.some((q) => q.isSuperset), s: e.series.map((q) => ({ w: !!q.w, kg: q.kg ? String(q.kg).replace('.', ',') : '', reps: String(q.reps), done: true, rir: q.rir != null ? String(q.rir) : '', dropset: !!q.isDropSet })) })) };
      st.liveMin = false; st.wkHist = false; st.wkMod = false; liveSave(); render(); window.scrollTo(0, 0); return;
    }
    st.wk = { orig: x, id: x.id, fecha: x.fecha, tipo: x.tipo, nombre: x.nombre || '', min: String(x.min || ''), km: x.km ? String(x.km) : '', elev: x.elev ? String(x.elev) : '', pulso: x.pulso ? String(x.pulso) : '', np: x.np ? String(x.np) : '', bici: x.bici, esf: x.esf || 2, msg: '', saving: false };
    st.wkHist = false; st.wkMod = false; st.wkBack = true; render(); window.scrollTo(0, 0);
  }
  else if (act === 'wk-del-ask') { st.wkDel = v; render(); }
  else if (act === 'wk-del-no') { st.wkDel = null; render(); }
  else if (act === 'wk-del-yes') {
    const id = st.wkDel; st.wkDel = null;
    try { await api.deleteWorkout(st.user.uid, id); st.workouts = await api.listWorkouts(st.user.uid); if (!st.workouts.length) st.wkMod = false; render(); toast('Entreno borrado'); } catch (err) { toast(errorText(err)); }
  }
  else if (act === 'wk-tipo' && w) {
    if (w.tipo === v) return;
    if (v === 'gym') return empezarFuerza(w.fecha);
    const nw = newWk(w.fecha, v); nw.esf = w.esf; if (!nw.min) nw.min = w.min; st.wk = nw; render();
  }
  else if (act === 'wk-esf' && w) { w.esf = Number(v); render(); }

});

root.addEventListener('input', (e) => {
  const t = e.target;
  if (st.lib && t.dataset.libq != null) { st.lib.q = t.value; const l = document.getElementById('lib-list'); if (l) { l.innerHTML = libListHTML(); l.scrollTop = 0; } return; }
  if (st.lib && st.lib.crear && t.dataset.libc) { st.lib.crear[t.dataset.libc] = t.value; return; }
  if (st.rw && t.dataset.rw) { st.rw[t.dataset.rw] = t.value; const nb = document.querySelector('[data-rwnext]'); if (nb) nb.disabled = !rwCanNext(); const chs = document.querySelectorAll('[data-act=rw-dep-otro]'); chs.forEach((c) => c.classList.toggle('on', c.dataset.v === t.value)); return; }
  if (st.calentar && t.dataset.calkg != null) { st.calentar.kg = t.value; return; }
  if (st.live && t.dataset.livename != null) { st.live.nombre = t.value; st.live.custom = true; liveSave(); return; }
  if (st.live && t.dataset.lv) {
    const [i, j, k] = t.dataset.lv.split('.');
    if (k === 'rir') { if (!esPro()) return; t.value = t.value.replace(/[^0-5]/g, '').slice(-1); }
    st.live.ex[Number(i)].s[Number(j)][k] = t.value; liveSave();
    const tt = liveTotals(), vEl = document.getElementById('live-vol'); if (vEl) vEl.textContent = `${nf(tt.vol)} kg`;
    const oEl = esPro() && root.querySelector(`[data-orm="${i}"]`);
    if (oEl) { const h = ormHTML(st.live.ex[Number(i)]); oEl.textContent = h; oEl.hidden = !h; }
    return;
  }
  if (st.re && t.dataset.re) {
    const p = t.dataset.re.split('.'), s = st.re.draft.sesiones[Number(p[0])];
    if (p[1] === 'ej') {
      const ex = s.ej[Number(p[2])]; ex[p[3]] = t.value;
      if (p[2] === '0' && (p[3] === 'series' || p[3] === 'reps')) st.re.ref = { series: ex.series, reps: ex.reps };
    } else s[p[1]] = t.value;
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

root.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.rutname != null) {
    const list = rutinasList(), r = list.find((x) => x.id === st.rutSel) || rutinaOf(), n = t.value.trim().slice(0, 30);
    if (!n) { toast('Ponle un nombre a la rutina'); return render(); }
    const nr = { ...r, nombre: n };
    try { await saveRutinas(list.map((x) => (x.id === r.id ? nr : x)), r.id === rutinaOf().id ? nr : null); toast('Nombre guardado'); } catch (err) { toast(errorText(err)); }
    return render();
  }
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

// ── Recuperación muscular y mapa de la semana (Forma física) ──
const recColor = (p) => (p >= 100 ? '#3DDC84' : p >= 50 ? '#FFB020' : '#FF453A');
function recuperacionHTML() {
  const ws = (st.workouts || []).filter((w) => w.tipo === 'gym' || w.tipo === 'bici');
  const pro = esPro();
  // Sin Pro NO se calcula nada real: todo 100 % fresco (verde) y sin semana, para que el blur no deje deducir la fatiga.
  const rec = pro ? E.recuperacion(ws, new Date()) : {}, sem = pro ? E.semana(ws, todayISO()) : {};
  const tarjetas = E.MUSC_GRUPOS.map((g) => {
    const pct = pro ? E.recGrupo(rec, g) : 100, c = recColor(pct), fills = {};
    g.m.forEach((k) => { fills[k] = [c, 0.95]; });
    return `<div class="rcv-card">${figura(fills, g.side, g.n)}<b>${g.n}</b><span class="rcv-pill" style="background:${c}">${pct}%</span></div>`;
  }).join('');
  const heat = {};
  Object.entries(sem).forEach(([k, v]) => { heat[k] = ['#F2BE1A', (0.25 + 0.75 * v).toFixed(2)]; });
  const hay = pro && Object.keys(heat).length;
  const cuerpo = `<div class="rcv-row">${tarjetas}</div>
    <div class="rcv-leg"><i style="background:#3DDC84"></i>Listo <i style="background:#FFB020"></i>Descansando <i style="background:#FF453A"></i>Fatigado</div>
    <h2>Esta semana</h2><p class="rcv-sub">Mira qué músculos entrenaste</p>
    <div class="rcv-week">${figura(heat, 'front', 'Frente')}${figura(heat, 'back', 'Espalda')}</div>
    <p class="rcv-sub rcv-note">${hay ? 'Cuanto más intenso el amarillo, más volumen.' : 'Aún no has entrenado esta semana.'}</p>`;
  // Muro de cristal: sin Pro se ve borroso y un candado encima abre la suscripción.
  const muro = `<div class="pro-wall">
      <div class="pro-blur-overlay" aria-hidden="true" inert>${cuerpo}</div>
      <button type="button" class="pro-lock" data-act="pro-open" data-v="recuperacion" aria-label="Desbloquea tu mapa de fatiga con Pro">${I.lock}<b>Desbloquea tu mapa de fatiga con Pro</b></button>
    </div>`;
  return `<section class="rcv"><h2>Recuperación muscular</h2><p class="rcv-sub">Mira qué músculos están listos para entrenar</p>
    ${esPro() ? cuerpo : muro}</section>`;
}
  return { regSheetHTML, rutinaOf, rutinasList, dayPlan, homeTraining, viewEntreno, viewRutWizard, viewLive, liveBarHTML, viewWkForm, libSheetHTML, wkSave, rwNext, openRegistro, wkHistSheetHTML, wkDelSheetHTML, rutDelSheetHTML, rachaActual, fuegoHTML, modoSheetHTML, resumenSheetHTML, limiteSheetHTML, calentarSheetHTML, recuperacionHTML, rutShareSheetHTML };
}
