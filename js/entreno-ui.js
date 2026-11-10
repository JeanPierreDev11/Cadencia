// Entreno: tarjeta de Inicio, pestaña Entreno (semana, historial, rutinas), asistente de rutinas,
// biblioteca de ejercicios, entrenamiento en directo y registro de bici, cardio y otros.
import { esc, num, nf, todayISO, fmtDate, lsSet, lsGet, toast, I } from './util.js';
import { errorText } from './data.js';
import * as E from './entreno.js';

export function crearEntreno(ctx) {
  const { st, root } = ctx;
  const render = () => ctx.render();
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] }); // el acceso a datos se crea al arrancar
  const M = new Proxy({}, { get: (_, k) => ctx.M[k] });
  const currentKg = () => ctx.currentKg();
  const goalById = (id) => ctx.goalById(id);

const fmtDur = (m) => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
const fmtClock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const RT = E.RTIPOS;
const WK_DE = { fuerza: 'gym', bici: 'bici', cardio: 'cardio', otro: 'otro' }; // tipo de rutina → tipo de entreno registrado
const clone = (o) => JSON.parse(JSON.stringify(o));
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
    <button class="btn small ghost" data-act="wk-new" data-date="${today}">${I.plus} Registrar</button>
  </section>`;
}

/* ---------- pestaña Entreno ---------- */
function viewEntreno() {
  if (!rutinaOf()) {
    return `<div class="wk-empty"><button type="button" class="addbig" data-act="rw-start"><span class="addbig-c">${I.plusBig}</span><span>Añadir rutina</span></button></div>`;
  }
  const today = todayISO(), mon = E.mondayOf(today), sun = E.addDays(mon, 6);
  const sub = ['semana', 'historial', 'rutina', 'objetivos'].includes(st.wkTab) ? st.wkTab : 'semana';
  const body = sub === 'historial' ? wkHistorial() : sub === 'rutina' ? wkRutina() : sub === 'objetivos' ? M.viewObjetivos() : wkSemana();
  return `<header class="hello"><div><h1>Entreno</h1><p>Semana del ${esc(fmtDate(mon))} al ${esc(fmtDate(sun))}</p></div>
      <button class="btn small" data-act="wk-new" data-date="${today}">${I.plus} Registrar</button></header>
    <div class="seg" role="group" aria-label="Secciones de entreno">
      ${[['semana', 'Semana'], ['historial', 'Historial'], ['rutina', 'Rutinas'], ['objetivos', 'Objetivos']].map(([v, t]) => `<button type="button" data-act="wktab" data-v="${v}" aria-pressed="${sub === v}">${t}</button>`).join('')}
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
    return `<button type="button" class="dc ${state} ${date === today ? 'now' : ''}" data-act="wk-new" data-date="${date}" ${date > today ? 'disabled' : ''} aria-label="${esc(label)}"><span>${E.DIAS[i]}</span><i>${did ? I.check : dp ? tipoIcon(dp.t) : ''}</i></button>`;
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

// rid: la rutina que estás editando; sin rid se crea una nueva (y pasa a ser la activa).
async function saveRutina(R, rid) {
  const res = normRutina(R);
  if (res.error) return res.error;
  const list = rutinasList(), act = rutinaOf(), id = rid || nidR(), prev = list.find((x) => x.id === id);
  const rut = { ...res.rutina, id, nombre: (prev && prev.nombre) || (list.length ? `Rutina ${list.length + 1}` : 'Mi rutina') };
  const data = { rutinas: prev ? list.map((x) => (x.id === id ? rut : x)) : [...list, rut] };
  if (!act || !rid || act.id === id) data.rutina = rut;
  await api.saveProfile(st.user.uid, data);
  st.profile = { ...st.profile, ...data };
  return '';
}
async function saveRutinas(list, activa) {
  const data = { rutinas: list };
  if (activa) data.rutina = activa;
  await api.saveProfile(st.user.uid, data);
  st.profile = { ...st.profile, ...data };
}

/* ---------- sección Rutina ---------- */
function wkRutina() {
  const list = rutinasList(), act = rutinaOf();
  const r = list.find((x) => x.id === st.rutSel) || act;
  if (!st.re || st.re.src !== 'tab' || st.re.rid !== r.id) { st.re = reNew(clone(r), 'tab'); st.re.rid = r.id; }
  const re = st.re, esActiva = r.id === act.id;
  const resumen = (x) => `${x.dias.map((d) => E.DIAS[d]).join(', ')} · ${x.tipos.map((t) => (t === 'otro' && x.otro ? x.otro : RT[t])).join(', ')}`;
  const split = r.tipos.includes('fuerza') && r.split && E.SPLITS[r.split] ? ` · ${E.SPLITS[r.split].t}` : '';
  return `<section class="card">
      <div class="card-head"><h2>Mis rutinas</h2><button class="chip chipbtn" data-act="rut-new">${I.plus} Nueva</button></div>
      <div class="rutlist">${list.map((x) => `<button type="button" class="rutrow ${x.id === r.id ? 'on' : ''}" data-act="rut-sel" data-v="${esc(x.id)}">
        <span><b>${esc(x.nombre || 'Rutina')}</b><small class="muted">${esc(resumen(x))}</small></span>${x.id === act.id ? '<span class="tag ok">En uso</span>' : ''}</button>`).join('')}</div>
    </section>
    <section class="card">
      <label class="field"><span>Nombre de la rutina</span><input class="input" data-rutname maxlength="30" value="${esc(r.nombre || '')}"></label>
      <p><b>${r.dias.map((d) => E.DIAS[d]).join(', ')}</b> · ${r.tipos.map((t) => (t === 'otro' && r.otro ? r.otro : RT[t])).join(', ')}${esc(split)}</p>
      <p class="small muted">${r.modo === 'propuesta' ? 'Propuesta de la app según tus objetivos.' : 'Rutina creada por ti.'} Toca «Cambiar» en un ejercicio o sesión para ver alternativas.</p>
      ${esActiva ? '' : `<button class="btn block" data-act="rut-use">Usar esta rutina</button>`}
      <div class="rut-acts">
        <button class="btn ghost small" data-act="rw-start" data-rid="${esc(r.id)}">Cambiar días o tipos</button>
        <button class="btn ghost small" data-act="rut-dup">Duplicar</button>
        ${esActiva ? '' : `<button class="btn ghost small danger" data-act="rut-del">${st.rutDel === r.id ? 'Pulsa otra vez para borrar' : 'Borrar'}</button>`}
      </div>
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

function rwStart(rid, nueva) {
  const r = nueva ? null : rutinasList().find((x) => x.id === rid) || rutinaOf();
  st.rw = r
    ? { rid: r.id, step: 0, tipos: [...r.tipos], otro: r.otro || '', n: r.dias.length, dias: [...r.dias], modo: r.modo || '', split: r.split || '', exp: r.exp || '', eq: r.eqSel && r.eqSel.length ? [...r.eqSel] : (r.tipos.includes('fuerza') ? ['gym'] : []), msg: '' }
    : { nueva: true, step: 0, tipos: [], otro: '', n: 0, dias: [], modo: '', split: '', exp: '', eq: [], msg: '' };
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
    ${restHTML()}
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
// Con tipo (botón «Empezar» de la sesión de hoy) abre directamente; sin tipo pregunta qué vas a registrar.
function openRegistro(date, tipo) {
  if (!tipo) { st.regPick = { date: date || todayISO() }; return render(); }
  const t = resolveTipo(date, tipo);
  st.regPick = null;
  if (t === 'gym') return startLive(date || todayISO());
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
        <label class="field"><span>Pulso medio <span class="muted">(opcional)</span></span><input class="input" data-wk="pulso" inputmode="numeric" value="${esc(w.pulso)}" placeholder="140"></label>
        ${M.wkBiciHTML(w)}` : ''}
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
  if (act === 'rw-start') return rwStart(b.dataset.rid);
  if (act === 'rut-new') return rwStart(null, true);
  if (act === 'rut-sel') { st.rutSel = v; st.rutDel = null; return render(); }
  if (act === 'rut-use' || act === 'rut-dup' || act === 'rut-del') {
    const list = rutinasList(), r = list.find((x) => x.id === st.rutSel) || rutinaOf();
    try {
      if (act === 'rut-use') { await saveRutinas(list, r); st.rutSel = null; toast(`Ahora usas «${r.nombre}»`); }
      else if (act === 'rut-dup') { const c = { ...clone(r), id: nidR(), nombre: `${r.nombre || 'Rutina'} (copia)`.slice(0, 30) }; await saveRutinas([...list, c]); st.rutSel = c.id; toast('Rutina duplicada'); }
      else if (st.rutDel !== r.id) { st.rutDel = r.id; }
      else { await saveRutinas(list.filter((x) => x.id !== r.id)); st.rutSel = null; st.rutDel = null; toast('Rutina borrada'); }
    } catch (err) { toast(errorText(err)); }
    st.re = null; return render();
  }
  if (act === 'nov-bici') { st.tab = 'entreno'; lsSet('cadencia-tab', 'entreno'); rwStart(); if (st.rw && !st.rw.tipos.includes('bici')) st.rw.tipos.push('bici'); return render(); }
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
    if (act === 'live-set-add') { const ex = Lv.ex[Number(v)], last = ex.s[ex.s.length - 1] || { kg: '' }; ex.s.push({ kg: last.kg, reps: '', done: false }); liveSave(); return render(); }
    if (act === 'live-set-del') { const ex = Lv.ex[Number(v)]; if (ex.s.length > 1) ex.s.pop(); liveSave(); return render(); }
    if (act === 'live-done') {
      const [i, j] = v.split('.').map(Number), ex = Lv.ex[i], s = ex.s[j];
      if (!s.done && !rellenarSerie(ex, j)) { toast('Escribe las repeticiones de la serie'); return; }
      s.done = !s.done; Lv.msg = '';
      if (s.done) restStart(); else if (st.rest) st.rest = null;
      liveSave(); return render();
    }
    if (act === 'live-uni') { Lv.ex[Number(v)].uni = b.dataset.u === '1'; liveSave(); return render(); }
    if (act === 'live-fin') { st.rest = null; return liveFinish(); }
    if (act === 'live-discard') {
      if (!window.confirm('¿Descartar este entrenamiento? Se perderán las series apuntadas.')) return;
      st.live = null; st.liveMin = false; st.rest = null; liveSave(); render(); toast('Entrenamiento descartado'); return;
    }
  }

  // descanso
  if (act === 'rest-mas' || act === 'rest-menos') { restAjustar(act === 'rest-mas' ? 30 : -30); return; }
  if (act === 'rest-saltar') { st.rest = null; restPaint(); return; }

  // qué registrar
  if (act === 'reg-close') { st.regPick = null; return render(); }
  if (act === 'reg-pick' && st.regPick) { const d = st.regPick.date; st.regPick = null; return openRegistro(d, v); }

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

root.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.rutname != null) {
    const list = rutinasList(), r = list.find((x) => x.id === st.rutSel) || rutinaOf(), n = t.value.trim().slice(0, 30);
    if (!n) { toast('Ponle un nombre a la rutina'); return render(); }
    const nr = { ...r, nombre: n };
    try { await saveRutinas(list.map((x) => (x.id === r.id ? nr : x)), r.id === rutinaOf().id ? nr : null); toast('Nombre guardado'); } catch (err) { toast(errorText(err)); }
    return render();
  }
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

  return { regSheetHTML, rutinaOf, rutinasList, dayPlan, homeTraining, viewEntreno, viewRutWizard, viewLive, liveBarHTML, viewWkForm, libSheetHTML, wkSave, rwNext, openRegistro };
}
