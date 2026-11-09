// Secciones Nutrición, Rutas, Taller y Progreso.
// Los cálculos (calorías, carga de entreno, nutrición en ruta, ropa, presión de ruedas, % graso)
// vienen de la librería de la app «Bilbao Ride» (js/br.js); aquí está la parte visual y los datos de cada persona.
import { FOODS, FOODS_BY_ID, prepOf, prepVals, prepKcal100, normTxt as normFood } from './alimentos.js';

const BR = globalThis.BR || {};
const N = BR.nutrition, T = BR.training, RF = BR.routeFuel, RT = BR.routes, BD = BR.body, GS = BR.groupsets;

export const MEALS = ['Desayuno', 'Comida', 'Merienda', 'Cena', 'Otros'];
const BILBAO = { lat: 43.263, lon: -2.935 };

const svg = (d, w = 24) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICO = {
  food: svg('<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2.2 1.6-2.2 6.4 0 8v10"/>'),
  ruta: svg('<path d="M3 20l6-11 4 7 3-4 5 8z"/>'),
  llave: svg('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z"/>'),
  prog: svg('<path d="M4 21h16M7 21v-8M12 21V5M17 21v-5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  pin: svg('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>', 18),
  warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', 16),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', 18),
  bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', 22),
};

/* Novedades: cambia NOV_V cada vez que publiques algo nuevo para que salga la nota en Inicio. */
const NOV_V = '2026-11-09b';

/* Objetivos de entreno: [id, grupo, texto, unidad, periodo (sem | mes | reto), ejemplo] */
const META_T = [
  ['bici_km_sem', 'Bici', '{v} km de bici a la semana', 'km', 'sem', 100],
  ['bici_desn_sem', 'Bici', '{v} m de desnivel a la semana', 'm', 'sem', 1500],
  ['bici_km_mes', 'Bici', '{v} km de bici al mes', 'km', 'mes', 400],
  ['bici_salida', 'Bici', 'Una salida de {v} km', 'km', 'reto', 100],
  ['cardio_min_sem', 'Cardio', '{v} min de cardio a la semana', 'min', 'sem', 120],
  ['cardio_km_sem', 'Cardio', '{v} km de cardio a la semana', 'km', 'sem', 20],
  ['cardio_km_mes', 'Cardio', '{v} km de cardio al mes', 'km', 'mes', 80],
  ['cardio_dist', 'Cardio', 'Una sesión de cardio de {v} km', 'km', 'reto', 10],
  ['fuerza_kg', 'Pesos', '{v} kg en {ej}', 'kg', 'reto', 100],
  ['fuerza_ses_sem', 'Pesos', '{v} sesiones de fuerza a la semana', 'sesiones', 'sem', 3],
  ['sesiones_sem', 'General', '{v} entrenos a la semana', 'entrenos', 'sem', 4],
  ['min_sem', 'General', '{v} min de entreno a la semana', 'min', 'sem', 240],
];
const metaDef = (id) => META_T.find((x) => x[0] === id) || META_T[0];
const META_G = ['Bici', 'Cardio', 'Pesos', 'General'];

/* Tiempo de muestra si no hay conexión con el servicio meteorológico (de la app original). */
const PRESETS = [
  ['sirimiri', 'Sirimiri', { t: 11, hum: 94, rain: 0.15, wind: 8 }],
  ['lluvia', 'Lluvia', { t: 9, hum: 96, rain: 1.2, wind: 14 }],
  ['nublado', 'Nublado', { t: 15, hum: 80, rain: 0, wind: 10 }],
  ['soleado', 'Soleado', { t: 22, hum: 55, rain: 0, wind: 8 }],
  ['calor', 'Calor', { t: 30, hum: 50, rain: 0, wind: 6 }],
  ['frio', 'Frío', { t: 4, hum: 75, rain: 0, wind: 10 }],
  ['sur', 'Viento sur', { t: 20, hum: 45, rain: 0, wind: 35 }],
];

/* Taller */
const BIKE_TIPOS = [['carretera', 'Carretera'], ['gravel', 'Gravel'], ['mtb', 'Montaña'], ['urbana', 'Urbana'], ['rodillo', 'Rodillo']];
const COMP = [
  // [id, nombre, grupo, cambiar cada (km) por defecto]
  ['cadena', 'Cadena', 'Transmisión', 3000], ['cassette', 'Cassette', 'Transmisión', 9000], ['platos', 'Platos y bielas', 'Transmisión', 20000],
  ['cambio', 'Cambio trasero', 'Transmisión', 0], ['desviador', 'Desviador', 'Transmisión', 0], ['mandos', 'Mandos', 'Transmisión', 0],
  ['ruedas', 'Ruedas', 'Ruedas', 0], ['cubiertas', 'Cubiertas', 'Ruedas', 4000], ['camaras', 'Cámaras o tubeless', 'Ruedas', 0],
  ['pastillas', 'Pastillas o zapatas', 'Frenos', 2500], ['discos', 'Discos de freno', 'Frenos', 15000], ['frenos', 'Pinzas de freno', 'Frenos', 0],
  ['sillin', 'Sillín', 'Contacto', 0], ['manillar', 'Manillar y potencia', 'Contacto', 0], ['cinta', 'Cinta o puños', 'Contacto', 5000], ['pedales', 'Pedales y calas', 'Contacto', 8000],
  ['potenciometro', 'Potenciómetro', 'Electrónica', 0], ['gps', 'Ciclocomputador', 'Electrónica', 0], ['luces', 'Luces', 'Electrónica', 0],
  ['otro', 'Otro', 'Otros', 0],
];
const compDef = (id) => COMP.find((c) => c[0] === id) || COMP[COMP.length - 1];
const METAS = [['subir', 'Subir mejor'], ['ligera', 'Más ligera'], ['rapida', 'Más rápida'], ['comoda', 'Más cómoda'], ['frenada', 'Frenar mejor'], ['datos', 'Datos y potencia']];
// Ideas de mejora por objetivo, con rangos de precio orientativos (€) del mercado.
const IDEAS = {
  subir: [['Cassette con piñón más grande (p. ej. 11-34)', 40, 90], ['Bielas compactas 50/34 si llevas 53/39 o 52/36', 90, 220], ['Ruedas más ligeras', 450, 1200]],
  ligera: [['Cubiertas y cámaras ligeras (TPU)', 60, 140], ['Ruedas de gama media-alta (300–500 g menos)', 450, 1200], ['Sillín y tija de carbono', 120, 350]],
  rapida: [['Cubiertas de gama alta (menos resistencia a la rodadura)', 70, 130], ['Pasar a tubeless', 40, 110], ['Ruedas de perfil medio (35–50 mm)', 600, 1500]],
  comoda: [['Cubiertas más anchas a menos presión (si caben en tu cuadro)', 60, 120], ['Sillín a tu medida (anchura de isquiones)', 60, 160], ['Estudio biomecánico', 90, 200], ['Cinta de manillar gruesa', 20, 40]],
  frenada: [['Pastillas de mejor compuesto', 15, 40], ['Discos de 160 mm', 40, 100], ['Frenos de disco hidráulicos', 250, 600]],
  datos: [['Banda de pulso', 30, 80], ['Ciclocomputador GPS', 150, 400], ['Potenciómetro (biela o pedal)', 300, 750]],
};

export function crearSecciones(ctx) {
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] }); // el acceso a datos se crea al arrancar
  const { st, render, toast, esc, num, nf, todayISO, fmtDate, lsGet, lsSet, I, E, errorText, currentKg, rutinaOf, viewPeso } = ctx;
  const r1 = (x) => Math.round(x * 10) / 10;
  const eur = (n) => nf(n, 0) + ' €';
  const sgn = (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + nf(Math.abs(n), d);
  const uid = () => st.user.uid;
  const P = () => st.profile || {};
  const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const dayName = (d) => fmtDate(d, { weekday: 'short' }).replace('.', '');
  const pbar = (frac, cls = '') => `<div class="pbar ${cls}"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%"></i></div>`;
  const stat = (label, val, unit, hint, cls = '') => `<section class="stat ${cls}"><span class="label">${label}</span><span class="val num">${val}${unit ? `<em>${unit}</em>` : ''}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</section>`;
  const seg = (act, opts, cur, label) => `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const bul = (arr, cls = '') => (arr && arr.length ? `<ul class="bul ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const head = (t, sub, avatar = false) => {
    const name = P().nombre || st.user.name || '';
    return `<header class="hello"><div><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${avatar ? `<button class="avatar" data-act="tab" data-v="perfil" aria-label="Tu perfil">${esc((name || '?').trim().charAt(0).toUpperCase())}</button>` : ''}</header>`;
  };

  /* ================================================================ */
  /* Pestañas                                                          */
  /* ================================================================ */
  function tieneBici() {
    const r = rutinaOf();
    return !!(r && (r.tipos || []).includes('bici')) || (P().objetivos || []).includes('rendimiento');
  }
  function tabs() {
    const t = [{ id: 'inicio', t: 'Inicio', ico: I.home }, { id: 'entreno', t: 'Entreno', ico: I.pulse }, { id: 'nutricion', t: 'Nutrición', ico: ICO.food }];
    if (tieneBici()) t.push({ id: 'rutas', t: 'Rutas', ico: ICO.ruta }, { id: 'taller', t: 'Taller', ico: ICO.llave });
    t.push({ id: 'progreso', t: 'Progreso', ico: ICO.prog });
    return t;
  }
  function tabActual() {
    let t = st.tab;
    if (t === 'peso') t = 'progreso';
    if ((t === 'rutas' || t === 'taller') && !tieneBici()) t = 'inicio';
    if (!['inicio', 'entreno', 'nutricion', 'rutas', 'taller', 'progreso', 'perfil'].includes(t)) t = 'inicio';
    return t;
  }

  /* ================================================================ */
  /* Datos                                                             */
  /* ================================================================ */
  async function cargar(u) {
    st.dias = {};
    try {
      const list = await api.listDias(u, E.addDays(todayISO(), -90));
      list.forEach((d) => { st.dias[d.fecha] = d; });
    } catch (e) { /* sin comidas: no impide entrar */ }
    try { const g = JSON.parse(lsGet('cadencia-geo') || 'null'); if (g && g.lat) st.geo = { ...g, status: 'ok' }; } catch (e) { /* nada */ }
  }
  async function saveProfile(data) {
    Object.assign(st.profile, data);
    try { await api.saveProfile(uid(), data); } catch (e) { toast(errorText(e)); }
  }

  /* ================================================================ */
  /* Nutrición                                                         */
  /* ================================================================ */
  const dia = (d) => (st.dias && st.dias[d]) || { fecha: d, items: [] };
  const totales = (d) => dia(d).items.reduce((a, x) => ({ k: a.k + (x.k || 0), p: a.p + (x.p || 0), c: a.c + (x.c || 0), f: a.f + (x.f || 0), n: a.n + 1 }), { k: 0, p: 0, c: 0, f: 0, n: 0 });
  function exDia(d) {
    const kg = currentKg() || 70;
    let gross = 0, net = 0;
    const items = st.workouts.filter((w) => w.fecha === d);
    items.forEach((w) => { const k = w.kcal || E.estimateKcal(w, kg); gross += k; net += Math.max(0, k - (kg * (w.min || 0)) / 60); });
    return { gross: Math.round(gross), net: Math.round(net), items };
  }
  const grasaReciente = () => { const lim = E.addDays(todayISO(), -60); const w = st.weights.slice().reverse().find((x) => x.grasa != null && x.fecha >= lim); return w ? w.grasa : null; };
  // Plan base del día sin entrenar: el ejercicio se suma después, día a día, para no contarlo dos veces.
  function plan() {
    const p = P(), kg = currentKg();
    if (!N || !p.edad || !p.alturaCm || !kg) return null;
    const n = p.nutri || {}, goals = p.objetivos || [];
    let goal = p.pesoObjetivo || null;
    if (!goal && !goals.includes('perder')) goal = kg; // sin objetivo de peso y sin querer perder grasa: mantenimiento
    const inp = { sex: p.sexo === 'mujer' ? 'female' : 'male', age: p.edad, heightCm: p.alturaCm, weightKg: kg, bodyFatPct: grasaReciente(), goalWeightKg: goal, neat: n.neat || 'light', weeklyRideHours: 0, weeklyRunHours: 0, weeklyGymSessions: 0, ratePctPerWeek: n.rate || 0.5 };
    const tdee = N.formulaTDEE(inp), pl = N.buildPlan(inp, tdee);
    let surplus = 0;
    if (pl.mode !== 'deficit' && goals.includes('musculo') && (!p.pesoObjetivo || p.pesoObjetivo > kg + 0.05)) surplus = Math.round((tdee * 0.08) / 10) * 10;
    const warnings = (pl.warnings || []).map((w) => w.replace(/ Puedes cambiar el suelo en «Suelo de calorías»\./, '')).filter((w) => !/^Pon un peso objetivo/.test(w));
    return { inp, pl, tdee: Math.round(tdee), surplus, base: Math.round(pl.targetKcal + surplus), warnings };
  }
  function objetivoDia(d) {
    const PL = plan();
    if (!PL) return null;
    const n = P().nutri || {}, eat = n.eat != null ? n.eat : 0.8, ex = exDia(d), add = Math.round(ex.net * eat), m = PL.pl.macros;
    return { PL, target: PL.base + add, add, eat, ex, macros: { p: Math.round(m.proteinG), f: Math.round(m.fatG), c: Math.round(m.carbsG + (PL.surplus + add) / 4) } };
  }
  const mealNow = () => { const h = new Date().getHours(); return h < 11 ? 0 : h < 16 ? 1 : h < 19 ? 2 : 3; };

  function viewNutricion() {
    const t = todayISO(), d = st.nDate || t, tot = totales(d), od = objetivoDia(d), it = dia(d).items;
    const label = d === t ? 'Hoy' : d === E.addDays(t, -1) ? 'Ayer' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' });
    let h = head('Nutrición', 'Lo que comes, sumado solo.');
    const eaten = Math.round(tot.k), left = od ? od.target - eaten : 0;
    const macro = (n, v, obj) => `<div class="macro"><span>${n}</span><b class="num">${nf(v)}<em> / ${obj != null ? nf(obj) : '–'} g</em></b>${obj ? pbar(v / obj, v > obj * 1.1 ? 'over' : '') : ''}</div>`;
    h += `<section class="card accent-card">
      <div class="daynav">
        <button type="button" class="iconbtn" data-act="n-dia" data-v="-1" aria-label="Día anterior">${I.back}</button>
        <label class="daypick"><b>${esc(label)}</b><input type="date" data-ndate value="${d}" max="${t}" aria-label="Elegir día"></label>
        <button type="button" class="iconbtn flip" data-act="n-dia" data-v="1" aria-label="Día siguiente" ${d >= t ? 'disabled' : ''}>${I.back}</button>
      </div>
      <div class="kcalrow">
        <div><div class="big num">${nf(eaten)}</div><span class="muted">kcal${od ? ` de ${nf(od.target)}` : ''}</span></div>
        ${od ? `<div class="right"><b class="num ${left < 0 ? 'bad' : ''}">${nf(Math.abs(left))}</b><span class="muted">${left >= 0 ? 'te quedan' : 'te pasas'}</span></div>` : ''}
      </div>
      ${od ? pbar(eaten / od.target, eaten > od.target * 1.05 ? 'over' : '') : ''}
      <div class="macros">${macro('Proteína', tot.p, od && od.macros.p)}${macro('Hidratos', tot.c, od && od.macros.c)}${macro('Grasa', tot.f, od && od.macros.f)}</div>
      ${od ? `<p class="small muted">Objetivo = ${nf(od.PL.tdee)} de gasto sin entrenar${od.PL.pl.dailyDeficit ? ` − ${nf(od.PL.pl.dailyDeficit)} de déficit` : ''}${od.PL.surplus ? ` + ${nf(od.PL.surplus)} para ganar músculo` : ''}${od.add ? ` + <b>${nf(od.add)} de ejercicio</b>` : ''}.</p>`
        : `<p class="small">Completa edad y estatura en tu <button class="link" data-act="tab" data-v="perfil">perfil</button> para calcular tu objetivo.</p>`}
    </section>`;

    // Comidas
    const prev = dia(E.addDays(d, -1)).items;
    h += `<section class="card"><div class="card-head"><h2>Lo que has comido</h2></div>
      ${MEALS.map((name, i) => {
        const arr = it.filter((x) => x.m === i), k = arr.reduce((a, x) => a + x.k, 0);
        return `<div class="meal">
          <div class="meal-h"><b>${name}</b><span class="muted small">${arr.length ? nf(k) + ' kcal' : ''}</span><button type="button" class="chipbtn chip" data-act="n-add" data-v="${i}">${I.plus} Añadir</button></div>
          ${arr.map((x) => `<div class="fitem"><span>${esc(x.n)}<small class="muted">${x.g ? nf(x.g) + ' g · ' : ''}P ${nf(x.p, 0)} · H ${nf(x.c, 0)} · G ${nf(x.f, 0)}</small></span><b class="num">${nf(x.k)}</b><button class="iconbtn" data-act="n-del" data-v="${esc(x.id)}" aria-label="Quitar ${esc(x.n)}">${I.trash}</button></div>`).join('')}
        </div>`;
      }).join('')}
      ${!it.length && prev.length ? `<button class="btn ghost small" data-act="n-copiar">Copiar lo de ${d === t ? 'ayer' : 'el día anterior'} (${prev.length})</button>` : ''}
    </section>`;

    // Ejercicio del día
    if (od && od.ex.items.length) {
      h += `<section class="card"><h2>Ejercicio del día</h2>
        <p>${od.ex.items.map((w) => esc(w.nombre || E.TIPOS[w.tipo] || 'Entreno')).join(' · ')}: <b>${nf(od.ex.gross)} kcal</b> quemadas.</p>
        <p class="small muted">Por encima del reposo son ${nf(od.ex.net)} kcal; se suman ${nf(od.add)} (${Math.round(od.eat * 100)} %) a lo que puedes comer.</p></section>`;
    }

    // Últimos 7 días
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const x = E.addDays(t, -i), l = totales(x), w = st.weights.find((y) => y.fecha === x);
      rows.push(`<button type="button" data-act="n-ir" data-v="${x}" class="${x === d ? 'on' : ''}"><span>${i === 0 ? 'Hoy' : esc(dayName(x) + ' ' + fmtDate(x))}</span><span class="num">${l.n ? nf(l.k) : '–'}</span><span class="num">${w ? nf(w.kg, 1) : '–'}</span><span class="num">${l.n ? nf(l.p) + ' g' : '–'}</span></button>`);
    }
    h += `<section class="card"><h2>Últimos 7 días</h2><div class="tbl7"><div class="th"><span>Día</span><span>kcal</span><span>Peso</span><span>Proteína</span></div>${rows.join('')}</div></section>`;
    h += planCard();
    return h;
  }

  function planCard() {
    const PL = plan(), n = P().nutri || {};
    if (!PL) return '';
    const pl = PL.pl;
    const modo = pl.mode === 'deficit' ? `Déficit de ${nf(pl.dailyDeficit)} kcal al día: unos ${nf(pl.rateKgPerWeek, 2)} kg menos por semana.` : PL.surplus ? `Superávit ligero de ${nf(PL.surplus)} kcal para ganar músculo con poca grasa.` : 'Mantenimiento: comer lo que gastas.';
    return `<details class="card plan"${st.nPlanOpen ? ' open' : ''}>
      <summary><h2>Tu plan de calorías</h2></summary>
      <p>${modo}${pl.weeksToGoal ? ` Llegarías a ${nf(P().pesoObjetivo, 1)} kg en unas <b>${nf(pl.weeksToGoal)} semanas</b>.` : ''}</p>
      ${bul(PL.warnings, 'warn')}
      <div class="stats">${stat('Metabolismo basal', nf(pl.bmr), 'kcal', esc(pl.bmrMethod || ''))}${stat('Gasto sin entrenar', nf(PL.tdee), 'kcal', 'basal × actividad diaria')}</div>
      <div class="field"><span>Actividad diaria, sin contar entrenos</span>${seg('n-neat', [['sedentary', 'Sentada'], ['light', 'Ligera'], ['active', 'Activa']], n.neat || 'light', 'Actividad diaria')}<small>${esc((N.NEAT_LABEL || {})[n.neat || 'light'] || '')}</small></div>
      ${pl.mode === 'deficit' ? `<div class="field"><span>Ritmo de pérdida</span>${seg('n-rate', [[0.5, 'Prudente'], [0.75, 'Medio'], [1, 'Rápido']], n.rate || 0.5, 'Ritmo de pérdida')}<small>${nf((n.rate || 0.5), 2)} % de tu peso por semana. Más rápido cuesta músculo y rendimiento.</small></div>` : ''}
      <div class="field"><span>Cuánto del ejercicio sumo a tu objetivo</span>${seg('n-eat', [[1, '100 %'], [0.8, '80 %'], [0.6, '60 %']], n.eat != null ? n.eat : 0.8, 'Ejercicio sumado')}<small>Las estimaciones de calorías suelen pasarse un 10–30 %. Si pierdes peso más despacio de lo previsto, baja a 60 %.</small></div>
      ${grasaReciente() != null ? `<p class="small muted">Usamos tu % de grasa (${nf(grasaReciente(), 1)} %) para afinar el ritmo y la proteína.</p>` : ''}
    </details>`;
  }

  /* ----- hoja «Añadir alimento» ----- */
  const misAlim = () => (P().misAlimentos || []).map((f) => ({ ...f, s: normFood(f.n), mine: true }));
  const offCache = {};
  const asFood = (id) => FOODS_BY_ID[id] || misAlim().find((f) => f.id === id) || offCache[id] || null;
  const tokMatch = (s, tk) => s.includes(tk) || (tk.length > 3 && s.includes(tk.replace(/e?s$/, '')));
  function searchFoods(q) {
    const toks = normFood(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const t0 = toks[0].replace(/e?s$/, '');
    return [...misAlim(), ...FOODS].filter((f) => toks.every((tk) => tokMatch(f.s, tk)))
      .map((f) => ({ f, r: f.s.startsWith(t0) ? 0 : f.s.includes(' ' + t0) ? 1 : 2 }))
      .sort((a, b) => a.r - b.r || a.f.n.length - b.f.n.length).map((x) => x.f);
  }
  function recientes() {
    const cnt = {};
    Object.values(st.dias || {}).forEach((d) => (d.items || []).forEach((x) => { if (x.fid) cnt[x.fid] = (cnt[x.fid] || 0) + 1; }));
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(asFood).filter(Boolean).slice(0, 10);
  }
  const foodRow = (f) => `<button type="button" class="frow" data-act="n-pick" data-v="${esc(f.id)}"><span><b>${esc(f.n)}${f.mine ? ' <span class="tag">Marca</span>' : ''}</b><small>${nf(f.k)} kcal · P ${nf(f.p, 1)} · H ${nf(f.c, 1)} · G ${nf(f.f, 1)} <span class="muted">por 100 g</span></small></span>${I.plus}</button>`;
  function foodResults() {
    const F = st.food, q = F.q.trim();
    if (!q) {
      const rec = recientes();
      return `${rec.length ? `<div class="lgroup">Tus habituales</div>${rec.map(foodRow).join('')}` : '<p class="muted small" style="padding:6px 2px">Escribe qué has comido y pon el peso: calculamos calorías y macros.</p>'}
        <div class="lgroup">Explorar</div><div class="chips">${['pollo', 'arroz', 'pasta', 'huevo', 'yogur', 'plátano', 'pan', 'tortilla', 'bocadillo', 'pizza'].map((c) => `<button type="button" class="chip chipbtn" data-act="n-q" data-v="${c}">${c}</button>`).join('')}</div>
        <button type="button" class="btn ghost small" style="margin-top:8px" data-act="n-quick">Apuntar calorías a mano</button>`;
    }
    const all = searchFoods(q), res = all.slice(0, 30), O = F.off && F.off.q === q ? F.off : null;
    const off = !O ? `<button type="button" class="btn ${res.length ? 'ghost ' : ''}small" style="margin-top:8px" data-act="n-off">Buscar «${esc(q)}» en productos de marca</button>`
      : O.loading ? '<p class="muted small" style="padding:8px 2px">Buscando productos de marca…</p>'
      : O.err ? `<p class="small" style="padding:8px 2px">${esc(O.err)}</p>`
      : O.list.length ? `<div class="lgroup">Productos de marca</div>${O.list.map(foodRow).join('')}<p class="small muted">Datos de <a href="https://es.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, una base abierta: compáralos con la etiqueta.</p>`
      : '<p class="small muted" style="padding:8px 2px">No hay productos de marca con ese nombre.</p>';
    return `${res.map(foodRow).join('') || `<p class="muted" style="padding:6px 2px">No está en la tabla de alimentos.</p>`}
      ${all.length > res.length ? `<p class="small muted">Hay ${all.length - res.length} más: afina la búsqueda.</p>` : ''}
      ${off}
      <button type="button" class="btn ghost small" style="margin-top:8px" data-act="n-quick">¿No está? Apúntalo a mano</button>`;
  }
  function foodChoice(food) {
    const F = st.food, unit = food.u, mode = unit ? F.mode : 'g', gp = prepOf(food);
    const amt = num(F.amt), grams = amt > 0 ? (mode === 'u' ? amt * unit.g : amt) : 0;
    const pm = gp ? gp.find((x) => x.id === F.prep) || gp[0] : null;
    const oilOver = pm && pm.o > 0 && String(F.oil || '').trim() ? num(F.oil) : undefined;
    const v = pm ? prepVals(food, pm, grams, oilOver) : { k: Math.round((food.k * grams) / 100), p: r1((food.p * grams) / 100), c: r1((food.c * grams) / 100), f: r1((food.f * grams) / 100) };
    return { unit, mode, gp, pm, grams, v };
  }
  const calcHTML = (c) => `<div class="fcalc"><div><b class="num">${nf(c.v.k)}</b><span>kcal</span></div><div><b class="num">${nf(c.v.p, 1)}</b><span>prot.</span></div><div><b class="num">${nf(c.v.c, 1)}</b><span>hidr.</span></div><div><b class="num">${nf(c.v.f, 1)}</b><span>grasa</span></div></div>`;
  function foodSheet() {
    const F = st.food, food = F.sel ? asFood(F.sel) : null;
    let body;
    if (F.quick) {
      const Q = F.quick;
      body = `<div class="sheet-list form-grid">
        <label class="field"><span>Qué es</span><input class="input" data-fqk="n" maxlength="60" value="${esc(Q.n)}" placeholder="Ej. Menú del día"></label>
        <div class="two"><label class="field"><span>Calorías</span><input class="input" data-fqk="k" inputmode="numeric" value="${esc(Q.k)}" placeholder="650"></label>
        <label class="field"><span>Proteína (g)</span><input class="input" data-fqk="p" inputmode="decimal" value="${esc(Q.p)}" placeholder="Opcional"></label>
        <label class="field"><span>Hidratos (g)</span><input class="input" data-fqk="c" inputmode="decimal" value="${esc(Q.c)}" placeholder="Opcional"></label>
        <label class="field"><span>Grasa (g)</span><input class="input" data-fqk="f" inputmode="decimal" value="${esc(Q.f)}" placeholder="Opcional"></label></div>
        <p class="small muted">Útil para comidas fuera de casa o productos con etiqueta: copia las calorías de la ración que has tomado.</p>
      </div>
      <div class="sheet-foot"><button class="btn block" data-act="n-addquick">Añadir a ${MEALS[F.meal].toLowerCase()}</button></div>`;
    } else if (food) {
      const c = foodChoice(food), extra = c.pm ? prepKcal100(c.pm) : 0;
      body = `<div class="sheet-list form-grid">
        <div><b class="fsel-n">${esc(food.n)}</b><p class="small muted">Por 100 g: ${nf(food.k)} kcal · P ${nf(food.p, 1)} · H ${nf(food.c, 1)} · G ${nf(food.f, 1)}</p></div>
        ${c.unit ? `<div class="field"><span>Medir en</span>${seg('n-mode', [['g', 'Gramos'], ['u', esc(c.unit.n) + ' (≈' + nf(c.unit.g) + ' g)']], c.mode, 'Medir en')}</div>` : ''}
        <label class="field"><span>${c.mode === 'u' ? 'Cuántas unidades' : 'Cuántos gramos'}</span><input class="input" data-famt inputmode="decimal" value="${esc(F.amt)}" placeholder="${c.mode === 'u' ? '1' : '150'}"></label>
        <div id="food-calc">${calcHTML(c)}</div>
        ${c.gp ? `<div class="field"><span>Cómo lo preparas</span><div class="chiprow">${c.gp.map((m) => `<button type="button" class="chip chipbtn ${m.id === c.pm.id ? 'on' : ''}" data-act="n-prep" data-v="${m.id}">${esc(m.n)}</button>`).join('')}</div><small>${esc(c.pm.d)}${extra > 0 ? ` <b>+${nf(extra)} kcal por 100 g.</b>` : ''}</small></div>` : ''}
        ${c.pm && c.pm.o > 0 ? `<label class="field"><span>Aceite que usas en total (g) <span class="muted">(opcional)</span></span><input class="input" data-foil inputmode="decimal" value="${esc(F.oil || '')}" placeholder="Lo habitual: ${c.grams ? nf((c.pm.o * c.grams) / 100, 1) : nf(c.pm.o, 0) + ' por 100 g'}"><small>1 cucharada sopera ≈ 13 g.</small></label>` : ''}
      </div>
      <div class="sheet-foot"><button class="btn block" id="food-add" data-act="n-addfood" ${c.grams > 0 ? '' : 'disabled'}>Añadir a ${MEALS[F.meal].toLowerCase()}</button></div>`;
    } else {
      body = `<input class="input" type="search" data-fq value="${esc(F.q)}" placeholder="Busca: pollo, arroz, yogur…" autocomplete="off" enterkeyhint="search" aria-label="Buscar alimento">
        <div class="sheet-list" id="food-res">${foodResults()}</div>`;
    }
    const back = food || F.quick;
    return `<div class="sheet-back" data-act="n-close"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Añadir alimento">
        <div class="sheet-grab"></div>
        <div class="sheet-head"><button type="button" class="iconbtn" data-act="${back ? 'n-unpick' : 'n-close'}" aria-label="${back ? 'Volver' : 'Cerrar'}">${back ? I.back : ICO.close}</button><h2>${back ? (F.quick ? 'A mano' : 'Cantidad') : 'Añadir alimento'}</h2><span style="width:36px"></span></div>
        <div class="chiprow">${MEALS.map((m, i) => `<button type="button" class="chip chipbtn ${F.meal === i ? 'on' : ''}" data-act="n-meal" data-v="${i}">${m}</button>`).join('')}</div>
        ${body}
      </div>`;
  }
  function offFood(p) {
    const n = String(p.product_name_es || p.product_name || '').trim(), nu = p.nutriments || {};
    let k = num(nu['energy-kcal_100g']);
    if (!(k >= 0)) { const kj = num(nu.energy_100g); if (kj > 0) k = kj / 4.184; }
    if (!n || !(k >= 0) || k > 950 || !p.code) return null;
    const brand = String(p.brands || '').split(',')[0].trim();
    const name = (brand && !normFood(n).includes(normFood(brand)) ? `${n} · ${brand}` : n).slice(0, 70);
    const sv = num(p.serving_quantity), g = (x) => { const v = num(x); return v >= 0 && v <= 100 ? r1(v) : 0; };
    return { id: 'o:' + p.code, n: name, k: Math.round(k), p: g(nu.proteins_100g), c: g(nu.carbohydrates_100g), f: g(nu.fat_100g), u: sv > 0 && sv < 1000 ? { n: 'ración', g: Math.round(sv) } : null, s: normFood(name), mine: true };
  }
  const refreshRes = () => { const r = document.getElementById('food-res'); if (r) r.innerHTML = foodResults(); };
  async function buscarOFF() {
    const F = st.food, q = F.q.trim();
    if (!q) return;
    F.off = { q, loading: true, list: [] }; refreshRes();
    let res;
    try {
      const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 15000);
      const u = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=code,product_name,product_name_es,brands,nutriments,serving_quantity`;
      const r = await fetch(u, { signal: ctrl.signal });
      clearTimeout(tm);
      if (!r.ok) throw new Error('off');
      const list = ((await r.json()).products || []).map(offFood).filter(Boolean);
      list.forEach((f) => { offCache[f.id] = f; });
      res = { q, list };
    } catch (e) {
      res = { q, list: [], err: 'No se ha podido buscar ahora (sin conexión o servicio ocupado). Prueba en un momento o apúntalo a mano.' };
    }
    if (st.food && st.food.off && st.food.off.q === q) { st.food.off = res; refreshRes(); }
  }
  // Los productos de marca que usas se guardan en «tus alimentos» para encontrarlos siempre.
  function recordarAlimento(food) {
    if (!food.mine || misAlim().some((x) => x.id === food.id)) return;
    const { id, n, k, p, c, f, u } = food;
    saveProfile({ misAlimentos: [{ id, n, k, p, c, f, u: u || null }, ...(P().misAlimentos || [])].slice(0, 200) });
  }
  async function guardarDia(d, items) {
    st.dias[d] = { fecha: d, items };
    render();
    try { await api.saveDia(uid(), d, { items }); } catch (e) { toast(errorText(e)); }
  }
  function addItem(x) {
    const d = st.nDate || todayISO(), items = [...dia(d).items, { id: nid('f'), m: st.food.meal, ...x }];
    st.food = null;
    guardarDia(d, items);
    toast(`${x.n.length > 26 ? x.n.slice(0, 25) + '…' : x.n} · ${nf(x.k)} kcal`);
  }

  /* ================================================================ */
  /* Forma: carga de entreno (CTL, ATL, TSB)                           */
  /* ================================================================ */
  function atleta() {
    const a = P().atleta || {}, edad = P().edad || 35;
    return { sex: P().sexo === 'mujer' ? 'female' : 'male', hrMax: a.fcMax || Math.round(208 - 0.7 * edad), hrRest: a.fcRep || 60, ftp: a.ftp || null, est: !a.fcMax };
  }
  function pmcData() {
    if (!T || !st.workouts.length) return null;
    const ath = atleta(), daily = {};
    for (const w of st.workouts) {
      if (!w.min) continue;
      const type = w.tipo === 'bici' ? 'ride' : w.tipo === 'cardio' ? 'run' : 'gym';
      const l = T.activityLoad({ type, durationSec: w.min * 60, avgHr: w.pulso || undefined, np: w.np || undefined, rpe: { 1: 3, 2: 5, 3: 8 }[w.esf] || 5 }, ath);
      daily[w.fecha] = (daily[w.fecha] || 0) + (l.tss || 0);
    }
    const dates = Object.keys(daily).sort();
    if (!dates.length) return null;
    const pts = T.pmc(daily, dates[0], todayISO());
    return { daily, pts, last: pts[pts.length - 1] };
  }
  const tsbCls = (v) => (v < -30 ? 'bad' : v < -10 ? 'warn' : 'ok');

  /* ================================================================ */
  /* Rutas y tiempo                                                    */
  /* ================================================================ */
  const distKm = (a, b) => { const R = 6371, rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const cerca = () => st.geo && st.geo.status === 'ok' && st.geo.km <= 60;
  function locate() {
    if (!navigator.geolocation) { st.geo = { status: 'err', msg: 'Este dispositivo no permite saber tu ubicación.' }; render(); return; }
    st.geo = { status: 'busy' }; render();
    navigator.geolocation.getCurrentPosition((pos) => {
      const g = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      g.km = Math.round(distKm(g, BILBAO));
      st.geo = { ...g, status: 'ok' };
      lsSet('cadencia-geo', JSON.stringify(g));
      loadWx(true); render();
    }, () => { st.geo = { status: 'err', msg: 'No has dado permiso de ubicación. Usamos Bilbao.' }; render(); }, { timeout: 12000, maximumAge: 3600e3 });
  }
  const localHourKey = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; };
  async function loadWx(force) {
    if (st.wxLoading) return;
    if (!force && st.wx && Date.now() - st.wx.at < 30 * 60e3) return;
    st.wxLoading = true;
    const c = cerca() ? st.geo : BILBAO;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lon.toFixed(3)}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto&forecast_days=3`;
      const r = await fetch(u);
      if (!r.ok) throw new Error('wx');
      const H = (await r.json()).hourly, now = localHourKey();
      const hours = H.time.map((t, i) => ({ time: t, t: H.temperature_2m[i], app: H.apparent_temperature[i], hum: H.relative_humidity_2m[i], rain: H.precipitation[i], wind: H.wind_speed_10m[i] })).filter((x) => x.time >= now).slice(0, 48);
      if (!hours.length) throw new Error('wx');
      st.wx = { at: Date.now(), hours, aqui: cerca() };
      st.wxErr = null;
    } catch (e) {
      st.wxErr = 'No hemos podido consultar el tiempo ahora. Elige el que más se parezca.';
    }
    st.wxLoading = false;
    if (st.view === 'main' && !st.food && !st.tl && !document.activeElement.matches('input,textarea')) render();
  }
  function wxNow() {
    if (st.wxPreset) { const pr = PRESETS.find((x) => x[0] === st.wxPreset); if (pr) return { ...pr[2], app: null, label: pr[1], src: 'preset' }; }
    if (st.wx && st.wx.hours.length) { const h = st.wx.hours[Math.min(st.wxIdx || 0, st.wx.hours.length - 1)]; return { ...h, label: RF.weatherLabel(h.rain, h.hum), src: 'api' }; }
    return { ...PRESETS[2][2], app: null, label: 'nublado', src: 'def' };
  }
  const horaTxt = (time) => { const d = time.slice(0, 10), t = todayISO(); return `${d === t ? 'Hoy' : d === E.addDays(t, 1) ? 'Mañana' : fmtDate(d, { weekday: 'long' })} ${time.slice(11, 16)}`; };
  function rankedRoutes() {
    const w = wxNow(), pm = pmcData();
    return RT.rankRoutes({ tsb: pm ? pm.last.tsb : 0, wet: w.rain >= 0.05, windKmh: w.wind, tempC: w.t });
  }
  const KIND = (k) => (RT.KIND_LABEL || {})[k] || k;

  function viewRutas() {
    if (!RT || !RF) return head('Rutas') + '<section class="card"><p>No se han podido cargar las rutas.</p></section>';
    if (!st.wx && !st.wxLoading && !st.wxErr) setTimeout(() => loadWx(), 0);
    const w = wxNow(), ranked = rankedRoutes(), pm = pmcData();
    const selId = st.ruta && ranked.some((x) => x.route.id === st.ruta) ? st.ruta : ranked[0].route.id;
    const sel = ranked.find((x) => x.route.id === selId).route;
    let h = head('Rutas', 'Bilbao y alrededores');

    // Ubicación
    const g = st.geo;
    let loc;
    if (!g) loc = `<p>Las rutas son de <b>Bilbao</b>. Pronto habrá más zonas.</p><button class="btn ghost small" data-act="r-geo">${ICO.pin} Usar mi ubicación</button>`;
    else if (g.status === 'busy') loc = '<p class="muted">Buscando tu ubicación…</p>';
    else if (g.status === 'err') loc = `<p>${esc(g.msg)}</p><button class="btn ghost small" data-act="r-geo">Volver a intentar</button>`;
    else if (g.km <= 60) loc = `<p>${ICO.pin} Estás a ${nf(g.km)} km de Bilbao: el tiempo es el de tu zona.</p>`;
    else loc = `<p>${ICO.pin} Estás a ${nf(g.km)} km de Bilbao. <b>De momento solo hay rutas por Bilbao</b>; te las enseñamos con el tiempo de allí para cuando vayas.</p>`;
    h += `<section class="card loc">${loc}</section>`;

    // Tiempo
    const hrs = st.wx ? st.wx.hours : [];
    h += `<section class="card"><div class="card-head"><h2>Tiempo para la salida</h2>${st.wxLoading ? '<span class="spinner dark"></span>' : ''}</div>
      <div class="wxnow"><b class="num">${nf(w.t)}°</b><div><span class="wxl">${esc(w.label)}</span><span class="muted small">${w.app != null ? `Sensación ${nf(w.app)}° · ` : ''}Humedad ${nf(w.hum)} % · Viento ${nf(w.wind)} km/h${w.rain > 0 ? ` · ${nf(w.rain, 1)} mm/h` : ''}</span></div></div>
      ${hrs.length && !st.wxPreset ? `<label class="field"><span>Hora de salida</span><select class="input" data-wxh>${hrs.map((x, i) => `<option value="${i}" ${i === (st.wxIdx || 0) ? 'selected' : ''}>${esc(horaTxt(x.time))} · ${nf(x.t)}° · ${esc(RF.weatherLabel(x.rain, x.hum))}</option>`).join('')}</select></label>` : ''}
      ${st.wxErr && !st.wxPreset ? `<p class="small">${esc(st.wxErr)}</p>` : ''}
      <details class="comp"${st.wxPreset || st.wxErr ? ' open' : ''}><summary>${st.wxPreset ? 'Tiempo elegido a mano' : 'Elegir el tiempo a mano'}</summary>
        <div class="chips">${PRESETS.map(([id, l, v]) => `<button type="button" class="chip chipbtn ${st.wxPreset === id ? 'on' : ''}" data-act="r-preset" data-v="${id}">${l} · ${v.t}°</button>`).join('')}${st.wxPreset && hrs.length ? '<button type="button" class="chip chipbtn more" data-act="r-preset" data-v="">Usar la previsión</button>' : ''}</div></details>
      ${st.wx ? '<p class="small muted">Previsión: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.</p>' : ''}
    </section>`;

    // Lista de rutas
    h += `<section class="card"><div class="card-head"><h2>Elige la salida</h2></div>
      <p class="small muted">Ordenadas según tu frescura${pm ? ` (${sgn(Math.round(pm.last.tsb))})` : ''} y el tiempo.</p>
      <div class="routes">${ranked.map((x, i) => `<button type="button" class="route ${x.route.id === selId ? 'on' : ''}" data-act="r-ruta" data-v="${x.route.id}">
        <span class="route-t"><b>${esc(x.route.name)}</b>${i === 0 ? '<span class="tag ok">Mejor hoy</span>' : ''}</span>
        <span class="muted small">${esc(KIND(x.route.kind))} · ${nf(x.route.km)} km · ${nf(x.route.climbM)} m+ · cota ${nf(x.route.maxAltM)} m</span>
        ${x.why.length ? `<span class="small why">${esc(x.why.join(' · '))}</span>` : ''}
      </button>`).join('')}</div>
      <p class="small muted">Km y desnivel orientativos: ajusta con tu ruta real.</p></section>`;

    // Plan de la ruta elegida
    const kg = currentKg() || 70, zona = st.zona || 'Z2';
    const PLd = plan();
    const inp = { distanceKm: sel.km, climbM: sel.climbM, maxAltM: sel.maxAltM, tempC: w.t, apparentC: w.app != null ? w.app : undefined, humidityPct: w.hum, precipMmH: w.rain, windKmh: w.wind, intensity: zona, weightKg: kg, saltySweater: false, gutTrained: false, inDeficit: !!(PLd && PLd.pl.mode === 'deficit'), bottleMl: 750 };
    const f = RF.fuelPlan(inp), cl = RF.clothingAdvice(inp);
    h += `<section class="card accent-card"><h2>${esc(sel.name)}</h2>
      <p>${esc(sel.description || '')}</p>
      <div class="field"><span>Intensidad</span>${seg('r-zona', [['Z2', 'Z2 base'], ['Z3', 'Z3 tempo'], ['Z4', 'Z4 umbral']], zona, 'Intensidad')}</div>
      <p class="muted small">≈ ${esc(RF.formatH(f.durationH))} · ≈ ${nf(f.kcal)} kcal gastadas</p>
      <div class="stats s3">${stat('Hidratos', nf(f.carbsGPerH), 'g/h', nf(f.carbsTotalG) + ' g en total')}${stat('Líquido', nf(f.fluidLPerH, 2), 'L/h', nf(f.fluidTotalL, 1) + ' L en total')}${stat('Sodio', nf(f.sodiumMgPerH), 'mg/h', nf(f.sodiumTotalMg) + ' mg en total')}</div>
      <p>De los hidratos, <b>${nf(f.fromDrinkGPerH)} g/h</b> en el bidón y el resto en unos <b>${nf(f.gelsPerH, 1)} geles por hora</b> (de 25 g). Llevas ${nf(f.bottles, 1)} bidones de 750 ml${f.refills > 0 ? `, con ${f.refills} ${f.refills === 1 ? 'parada' : 'paradas'} para rellenar` : ''}.</p>
      ${bul(f.notes)}
    </section>
    <section class="card"><h2>Qué ponerte</h2>${bul(cl.items)}${cl.bike && cl.bike.length ? bul(cl.bike) : ''}</section>`;

    // Presión de ruedas con la bici del taller
    const b = biciActiva();
    if (!b || ['carretera', 'gravel', 'urbana'].includes(b.tipo)) {
      const bikeKg = b && b.pesoKg ? b.pesoKg : 9.5, width = b && b.cubiertaMm ? b.cubiertaMm : 28, sys = kg + bikeKg + 1.5;
      const tp = RF.tirePressure({ systemKg: sys, widthMm: width, tubeless: !!(b && b.tubeless), wet: w.rain >= 0.05, rough: false });
      h += `<section class="card"><h2>Presión de ruedas</h2>
        <div class="stats">${stat('Delantera', nf(tp.frontBar, 1), 'bar', nf(tp.frontPsi) + ' psi')}${stat('Trasera', nf(tp.rearBar, 1), 'bar', nf(tp.rearPsi) + ' psi')}</div>
        <p class="small muted">${b ? `Con tu ${esc(b.nombre)}: ${nf(bikeKg, 1)} kg, cubiertas de ${nf(width)} mm${b.tubeless ? ' tubeless' : ''}` : `Suponiendo una bici de ${nf(bikeKg, 1)} kg y cubiertas de ${width} mm. <button class="link" data-act="tab" data-v="taller">Añade tu bici en el Taller</button>`} y ${nf(kg, 1)} kg tuyos.</p>
        ${bul(tp.notes)}</section>`;
    }

    h += `<details class="card"><summary><h2>Puertos de la zona</h2></summary><div class="list">${RT.CLIMBS.map((c) => `<div class="row"><span><b>${esc(c.name)}</b><br><span class="muted small">${esc(c.side || '')}</span></span><span class="small nowrap">${[c.lengthKm != null ? nf(c.lengthKm, 1) + ' km' : '', c.avgPct != null ? nf(c.avgPct, 1) + ' %' : '', c.summitM != null ? nf(c.summitM) + ' m' : ''].filter(Boolean).join(' · ')}</span></div>`).join('')}</div></details>`;
    return h;
  }

  /* ================================================================ */
  /* Taller                                                            */
  /* ================================================================ */
  const garaje = () => { const g = P().garaje || {}; return { bicis: g.bicis || [], mejora: { presupuesto: 0, metas: [], deseos: [], ...(g.mejora || {}) } }; };
  const biciActiva = () => { const g = garaje(); return g.bicis.find((b) => b.id === st.biciSel) || g.bicis[0] || null; };
  const rodadasDe = (b) => { const first = garaje().bicis[0]; return st.workouts.filter((w) => w.tipo === 'bici' && (w.bici ? w.bici === b.id : first && first.id === b.id)); };
  const kmBici = (b) => (b.kmPrevios || 0) + rodadasDe(b).reduce((a, w) => a + (w.km || 0), 0);
  const kmComp = (b, c) => (c.kmIni || 0) + rodadasDe(b).filter((w) => w.fecha >= (c.desde || '0000')).reduce((a, w) => a + (w.km || 0), 0);
  async function saveGaraje(g) { await saveProfile({ garaje: g }); render(); }

  function viewTaller() {
    const g = garaje(), b = biciActiva();
    let h = head('Taller', 'Tu bici, sus piezas y qué mejorar');
    if (!b) {
      return h + `<section class="card tl-empty"><button class="addbig" data-act="tl-bici"><span class="addbig-c">${I.plusBig}</span><b>Añadir mi bici</b></button>
        <p class="muted" style="text-align:center">Apunta sus componentes y te avisamos cuando toque cambiar cadena, cubiertas o pastillas según los km que hagas.</p></section>`;
    }
    if (g.bicis.length > 1) h += `<div class="chiprow">${g.bicis.map((x) => `<button type="button" class="chip chipbtn ${x.id === b.id ? 'on' : ''}" data-act="tl-sel" data-v="${esc(x.id)}">${esc(x.nombre)}</button>`).join('')}<button type="button" class="chip chipbtn more" data-act="tl-bici">${I.plus} Otra bici</button></div>`;
    const tipo = (BIKE_TIPOS.find((x) => x[0] === b.tipo) || ['', 'Bici'])[1];
    const comps = b.comps || [];
    const avisos = comps.map((c) => ({ c, km: kmComp(b, c) })).filter((x) => x.c.cadaKm && x.km >= x.c.cadaKm * 0.9);
    h += `<section class="card bike">
      <div class="card-head"><div><b class="bike-n">${esc(b.nombre)}</b><p class="muted small">${esc([tipo, b.marcaModelo, b.anio].filter(Boolean).join(' · '))}</p></div><button class="link" data-act="tl-bici" data-v="${esc(b.id)}">Editar</button></div>
      <div class="stats s3">${stat('Recorrido', nf(kmBici(b)), 'km', `${rodadasDe(b).length} salidas en la app`)}${stat('Peso', b.pesoKg ? nf(b.pesoKg, 1) : '–', b.pesoKg ? 'kg' : '', '')}${stat('Cubiertas', b.cubiertaMm ? nf(b.cubiertaMm) : '–', b.cubiertaMm ? 'mm' : '', b.tubeless ? 'tubeless' : b.cubiertaMm ? 'con cámara' : '')}</div>
      ${g.bicis.length === 1 ? `<button type="button" class="link" data-act="tl-bici">${I.plus} Añadir otra bici</button>` : ''}
    </section>`;
    if (avisos.length) h += `<section class="card warn-card"><h2>${ICO.warn} Toca revisar</h2>${avisos.map((x) => `<p><b>${esc(compDef(x.c.cat)[1])}${x.c.nombre ? ' · ' + esc(x.c.nombre) : ''}</b>: ${nf(x.km)} de ${nf(x.c.cadaKm)} km. ${x.km >= x.c.cadaKm ? 'Ya ha cumplido su vida útil.' : 'Le queda poco.'}</p>`).join('')}</section>`;

    // Componentes por grupo
    const grupos = [...new Set(COMP.map((c) => c[2]))];
    h += `<section class="card"><div class="card-head"><h2>Componentes</h2><button class="chip chipbtn" data-act="tl-comp">${I.plus} Añadir</button></div>
      ${comps.length ? grupos.map((gr) => {
        const arr = comps.filter((c) => compDef(c.cat)[2] === gr);
        if (!arr.length) return '';
        return `<div class="lgroup">${gr}</div>${arr.map((c) => {
          const km = kmComp(b, c), frac = c.cadaKm ? km / c.cadaKm : 0;
          return `<button type="button" class="comp-row" data-act="tl-comp" data-v="${esc(c.id)}">
            <span class="comp-t"><b>${esc(compDef(c.cat)[1])}</b><span class="muted small">${esc(c.nombre || 'Sin marca')}</span></span>
            <span class="comp-k"><b class="num">${nf(km)} km</b>${c.cadaKm ? `<span class="small muted">de ${nf(c.cadaKm)}</span>` : ''}</span>
            ${c.cadaKm ? pbar(frac, frac >= 1 ? 'over' : frac >= 0.9 ? 'warn' : '') : ''}
          </button>`;
        }).join('')}`;
      }).join('') : '<div class="empty"><b>Sin componentes todavía</b><span>Empieza por la cadena, las cubiertas y las pastillas: son lo que más se gasta.</span></div>'}
    </section>`;

    // Mejoras
    const M = g.mejora, pres = M.presupuesto || 0;
    const deseos = M.deseos || [], gastado = deseos.reduce((a, x) => a + (x.precio || 0), 0);
    h += `<section class="card"><h2>Mejorar la bici</h2>
      <label class="field"><span>Presupuesto</span><div class="eurin"><input class="input" data-presu inputmode="numeric" value="${pres ? esc(String(pres)) : ''}" placeholder="Ej. 500"><span>€</span></div></label>
      <div class="field"><span>Qué quieres conseguir</span><div class="chips">${METAS.map(([id, l]) => `<button type="button" class="chip chipbtn ${M.metas.includes(id) ? 'on' : ''}" data-act="tl-meta" data-v="${id}">${l}</button>`).join('')}</div></div>
      ${ideasHTML(b, M, pres)}
      <div class="lgroup">Tu lista de compra</div>
      ${deseos.length ? `<div class="list">${deseos.map((x) => `<div class="row"><span>${esc(x.n)}</span><span style="display:flex;align-items:center;gap:6px"><b class="nowrap">${x.precio ? eur(x.precio) : '–'}</b><button class="iconbtn" data-act="tl-deseo-del" data-v="${esc(x.id)}" aria-label="Quitar ${esc(x.n)}">${I.trash}</button></span></div>`).join('')}</div>
        ${pres ? `<div class="budget"><span>${eur(gastado)} de ${eur(pres)}</span><b class="${gastado > pres ? 'bad' : ''}">${gastado > pres ? `Te pasas ${eur(gastado - pres)}` : `Quedan ${eur(pres - gastado)}`}</b></div>${pbar(gastado / pres, gastado > pres ? 'over' : '')}` : ''}` : '<p class="small muted">Apunta las piezas que te interesan con su precio y verás cuánto te queda.</p>'}
      <form class="quick" data-form="deseo" novalidate><input class="input" name="n" maxlength="60" placeholder="Pieza" aria-label="Pieza"><input class="input eur" name="precio" inputmode="decimal" placeholder="€" aria-label="Precio en euros"><button class="btn small" type="submit">${I.plus}</button></form>
    </section>
    <section class="card ai-card"><h2>${ICO.spark} Recomendación con IA</h2>
      <p>Muy pronto: la IA leerá tus componentes, tus kilómetros y tu presupuesto, y te propondrá piezas concretas compatibles con tu bici y dónde comprarlas.</p>
      <button class="btn block" disabled>Próximamente</button></section>`;
    return h;
  }
  function ideasHTML(b, M, pres) {
    const out = [];
    // Primero lo gastado: es la mejora que más se nota.
    (b.comps || []).forEach((c) => { const km = kmComp(b, c); if (c.cadaKm && km >= c.cadaKm) out.push(`<li><b>Cambia ${esc(compDef(c.cat)[1].toLowerCase())}</b>: lleva ${nf(km)} km. Una pieza gastada resta más que cualquier mejora.</li>`); });
    const metas = M.metas.length ? M.metas : [];
    metas.forEach((m) => (IDEAS[m] || []).forEach(([t, lo, hi]) => {
      if (pres && lo > pres) return;
      out.push(`<li>${esc(t)} <span class="muted nowrap">· ${eur(lo)}–${eur(hi)}</span></li>`);
    }));
    let gs = '';
    if (GS && pres >= 300 && ['carretera', 'gravel'].includes(b.tipo) && (metas.includes('subir') || metas.includes('ligera') || metas.includes('rapida'))) {
      const list = GS.GROUPSETS.map((x) => ({ x, t: x.parts.reduce((a, p) => a + (p.priceEUR || 0), 0) })).filter((y) => y.t > 100 && y.t <= pres && y.x.parts.length > 2).sort((a, c) => c.t - a.t).slice(0, 3);
      if (list.length) gs = `<div class="lgroup">Grupos de cambio que entran</div><ul class="bul">${list.map((y) => `<li>${esc(y.x.name)} <span class="muted nowrap">· ≈ ${eur(Math.round(y.t))}</span></li>`).join('')}</ul><p class="small muted">Comprueba antes el cuerpo de tu buje trasero y el tipo de frenos.</p>`;
    }
    if (!metas.length && !out.length) return '<p class="small muted">Elige qué quieres conseguir y te damos ideas con precios orientativos.</p>';
    return `${out.length ? `<div class="lgroup">Ideas${pres ? ' para tu presupuesto' : ''}</div><ul class="bul">${out.join('')}</ul>` : `<p class="small muted">Con ${eur(pres)} no entra ninguna de estas ideas: sube el presupuesto o elige otro objetivo.</p>`}${gs}`;
  }

  /* ----- hoja de bici o componente ----- */
  function tlSheet() {
    const S = st.tl, d = S.d;
    let body, title;
    if (S.kind === 'bici') {
      title = S.id ? 'Editar bici' : 'Nueva bici';
      body = `<label class="field"><span>Nombre</span><input class="input" data-tf="nombre" maxlength="40" value="${esc(d.nombre)}" placeholder="Ej. La de carretera"></label>
        <div class="field"><span>Tipo</span><div class="chips">${BIKE_TIPOS.map(([v, l]) => `<button type="button" class="chip chipbtn ${d.tipo === v ? 'on' : ''}" data-act="tl-set" data-k="tipo" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="two"><label class="field"><span>Marca y modelo</span><input class="input" data-tf="marcaModelo" maxlength="60" value="${esc(d.marcaModelo)}" placeholder="Ej. Orbea Avant"></label>
        <label class="field"><span>Año</span><input class="input" data-tf="anio" inputmode="numeric" maxlength="4" value="${esc(d.anio)}" placeholder="2023"></label>
        <label class="field"><span>Peso (kg)</span><input class="input" data-tf="pesoKg" inputmode="decimal" value="${esc(d.pesoKg)}" placeholder="9,5"></label>
        <label class="field"><span>Ancho cubierta (mm)</span><input class="input" data-tf="cubiertaMm" inputmode="numeric" value="${esc(d.cubiertaMm)}" placeholder="28"></label></div>
        <div class="field"><span>Ruedas</span>${seg('tl-set" data-k="tubeless', [['0', 'Con cámara'], ['1', 'Tubeless']], d.tubeless ? '1' : '0', 'Ruedas')}</div>
        <label class="field"><span>Km que ya tenía <span class="muted">(opcional)</span></span><input class="input" data-tf="kmPrevios" inputmode="numeric" value="${esc(d.kmPrevios)}" placeholder="0"><small>Las salidas que registres en Entreno se suman solas.</small></label>`;
    } else {
      const def = compDef(d.cat);
      title = S.id ? 'Editar componente' : 'Nuevo componente';
      body = `<label class="field"><span>Pieza</span><select class="input" data-tfs="cat">${[...new Set(COMP.map((c) => c[2]))].map((gr) => `<optgroup label="${gr}">${COMP.filter((c) => c[2] === gr).map((c) => `<option value="${c[0]}" ${d.cat === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="field"><span>Marca y modelo <span class="muted">(opcional)</span></span><input class="input" data-tf="nombre" maxlength="60" value="${esc(d.nombre)}" placeholder="Ej. Shimano 105 HG601"></label>
        <div class="two"><label class="field"><span>Montada el</span><input class="input" type="date" data-tf="desde" value="${esc(d.desde)}" max="${todayISO()}"></label>
        <label class="field"><span>Km que ya tenía</span><input class="input" data-tf="kmIni" inputmode="numeric" value="${esc(d.kmIni)}" placeholder="0"></label>
        <label class="field"><span>Cambiar cada (km)</span><input class="input" data-tf="cadaKm" inputmode="numeric" value="${esc(d.cadaKm)}" placeholder="${def[3] ? nf(def[3]) : 'Opcional'}"></label>
        <label class="field"><span>Precio (€)</span><input class="input" data-tf="precio" inputmode="decimal" value="${esc(d.precio)}" placeholder="Opcional"></label></div>
        ${def[3] ? `<p class="small muted">Referencia: ${esc(def[1].toLowerCase())} cada ${nf(def[3])} km aprox. Depende del uso, la lluvia y el mantenimiento.</p>` : ''}
        ${S.id ? '<button type="button" class="btn ghost small" data-act="tl-renew">La he cambiado hoy</button>' : ''}`;
    }
    return `<div class="sheet-back" data-act="tl-close"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="sheet-grab"></div>
        <div class="sheet-head"><button type="button" class="iconbtn" data-act="tl-close" aria-label="Cerrar">${ICO.close}</button><h2>${title}</h2>${S.id ? `<button type="button" class="iconbtn" data-act="tl-del" aria-label="Borrar">${I.trash}</button>` : '<span style="width:36px"></span>'}</div>
        <div class="sheet-list form-grid">${body}${S.msg ? `<div class="msg" role="alert">${esc(S.msg)}</div>` : ''}</div>
        <div class="sheet-foot"><button class="btn block" data-act="tl-save">Guardar</button></div>
      </div>`;
  }
  function tlOpen(kind, id) {
    const b = biciActiva();
    if (kind === 'bici') {
      const x = id ? garaje().bicis.find((y) => y.id === id) : null;
      st.tl = { kind, id: x ? x.id : null, d: x ? { ...x, anio: x.anio || '', pesoKg: x.pesoKg ? nf(x.pesoKg, 1) : '', cubiertaMm: x.cubiertaMm || '', kmPrevios: x.kmPrevios || '', marcaModelo: x.marcaModelo || '' } : { nombre: '', tipo: 'carretera', marcaModelo: '', anio: '', pesoKg: '', cubiertaMm: '', tubeless: false, kmPrevios: '' } };
    } else {
      const c = id && b ? (b.comps || []).find((y) => y.id === id) : null;
      st.tl = { kind, id: c ? c.id : null, d: c ? { ...c, nombre: c.nombre || '', kmIni: c.kmIni || '', cadaKm: c.cadaKm || '', precio: c.precio || '' } : { cat: 'cadena', nombre: '', desde: todayISO(), kmIni: '', cadaKm: '', precio: '' } };
    }
    render();
  }
  async function tlSave() {
    const S = st.tl, d = S.d, g = garaje();
    const fail = (m) => { S.msg = m; render(); };
    const opt = (raw, lo, hi) => { const s = String(raw == null ? '' : raw).trim(); if (!s) return null; const v = num(s); return v >= lo && v <= hi ? v : NaN; };
    if (S.kind === 'bici') {
      if (!String(d.nombre).trim()) return fail('Ponle un nombre a la bici.');
      const peso = opt(d.pesoKg, 3, 40), mm = opt(d.cubiertaMm, 18, 120), anio = opt(d.anio, 1950, 2100), kmp = opt(d.kmPrevios, 0, 500000);
      if (Number.isNaN(peso)) return fail('El peso tiene que estar entre 3 y 40 kg.');
      if (Number.isNaN(mm)) return fail('El ancho de cubierta tiene que estar entre 18 y 120 mm.');
      if (Number.isNaN(anio)) return fail('Revisa el año.');
      if (Number.isNaN(kmp)) return fail('Revisa los km que ya tenía.');
      const o = { id: S.id || nid('b'), nombre: String(d.nombre).trim().slice(0, 40), tipo: d.tipo, marcaModelo: String(d.marcaModelo || '').trim().slice(0, 60), tubeless: !!d.tubeless, comps: d.comps || [] };
      if (peso) o.pesoKg = r1(peso); if (mm) o.cubiertaMm = Math.round(mm); if (anio) o.anio = Math.round(anio); if (kmp) o.kmPrevios = Math.round(kmp);
      g.bicis = S.id ? g.bicis.map((x) => (x.id === S.id ? o : x)) : [...g.bicis, o];
      st.biciSel = o.id;
    } else {
      const b = biciActiva();
      const kmi = opt(d.kmIni, 0, 200000), cada = opt(d.cadaKm, 50, 200000), precio = opt(d.precio, 0, 20000);
      if ([kmi, cada, precio].some(Number.isNaN)) return fail('Revisa los números: km entre 0 y 200.000, precio hasta 20.000 €.');
      if (!d.desde || d.desde > todayISO()) return fail('Elige una fecha de hoy o anterior.');
      const def = compDef(d.cat);
      const o = { id: S.id || nid('c'), cat: d.cat, desde: d.desde };
      if (String(d.nombre).trim()) o.nombre = String(d.nombre).trim().slice(0, 60);
      if (kmi) o.kmIni = Math.round(kmi);
      o.cadaKm = cada ? Math.round(cada) : def[3] || 0;
      if (!o.cadaKm) delete o.cadaKm;
      if (precio) o.precio = r1(precio);
      const comps = b.comps || [];
      b.comps = S.id ? comps.map((x) => (x.id === S.id ? o : x)) : [...comps, o];
      g.bicis = g.bicis.map((x) => (x.id === b.id ? b : x));
    }
    st.tl = null;
    await saveGaraje(g);
    toast('Guardado');
  }

  /* ================================================================ */
  /* Progreso                                                          */
  /* ================================================================ */
  function lineas(series, label) {
    const all = series.flatMap((s) => s.pts);
    if (all.length < 2) return '';
    const W = 340, H = 160, Pd = { l: 30, r: 8, t: 10, b: 22 };
    const ts = all.map((p) => new Date(p[0]).getTime()), t0 = Math.min(...ts), t1 = Math.max(...ts);
    let lo = Math.min(0, ...all.map((p) => p[1])), hi = Math.max(...all.map((p) => p[1]));
    if (hi - lo < 10) hi = lo + 10;
    const x = (d) => Pd.l + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - Pd.l - Pd.r);
    const y = (v) => Pd.t + (1 - (v - lo) / (hi - lo)) * (H - Pd.t - Pd.b);
    const ticks = [lo, (lo + hi) / 2, hi];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      ${ticks.map((tk) => `<line class="gl" x1="${Pd.l}" x2="${W - Pd.r}" y1="${y(tk)}" y2="${y(tk)}"/><text x="${Pd.l - 6}" y="${y(tk) + 4}" text-anchor="end">${nf(tk)}</text>`).join('')}
      ${series.map((s) => `<path class="${s.cls}" d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ')}"/>`).join('')}
      <text x="${Pd.l}" y="${H - 4}">${fmtDate(new Date(t0).toISOString().slice(0, 10))}</text><text x="${W - Pd.r}" y="${H - 4}" text-anchor="end">${fmtDate(new Date(t1).toISOString().slice(0, 10))}</text>
    </svg><div class="legend">${series.map((s) => `<span><i class="${s.cls}"></i>${s.name}</span>`).join('')}</div>`;
  }
  function viewProgreso() {
    const sub = st.progSub || 'peso';
    let h = head('Progreso', 'Peso, cuerpo y forma', true);
    h += seg('p-sub', [['peso', 'Peso'], ['cuerpo', 'Cuerpo'], ['forma', 'Forma']], sub, 'Qué ver');
    if (sub === 'cuerpo') return h + subCuerpo();
    if (sub === 'forma') return h + subForma();
    return h + viewPeso(true);
  }
  function subCuerpo() {
    const p = P(), sex = p.sexo === 'mujer' ? 'female' : 'male', B = st.body || (st.body = {});
    const kg = currentKg(), sites = BD.SKINFOLD_SITES[sex];
    const res = (v, k) => (v == null || !isFinite(v) ? '' : `<div class="bfres"><div><b class="num">${nf(v, 1)} %</b><span class="muted small">${k}${kg ? ` · ${nf(BD.composition(kg, v).fatKg, 1)} kg de grasa, ${nf(BD.composition(kg, v).leanKg, 1)} kg magros` : ''}</span></div><button class="btn small" data-act="b-save" data-v="${r1(v)}">Guardar</button></div>`);
    const navy = p.alturaCm && num(B.cuello) > 0 && num(B.cintura) > 0 && (sex === 'male' || num(B.cadera) > 0) ? BD.navyBodyFat(sex, p.alturaCm, num(B.cuello), num(B.cintura), num(B.cadera) || 0) : null;
    const sk = p.edad && num(B.s1) > 0 && num(B.s2) > 0 && num(B.s3) > 0 ? BD.skinfoldBodyFat(sex, p.edad, num(B.s1), num(B.s2), num(B.s3)) : null;
    const fld = (k, l, u) => `<label class="field"><span>${l} (${u})</span><input class="input" data-body="${k}" inputmode="decimal" value="${esc(B[k] || '')}"></label>`;
    const hist = st.weights.filter((w) => w.grasa != null).slice(-8).reverse();
    return `<section class="card"><h2>% de grasa con cinta métrica</h2>
        <p class="small muted">Método de la Marina de EE. UU. Mide por la mañana, sin apretar la cinta.</p>
        <div class="two">${fld('cuello', 'Cuello', 'cm')}${fld('cintura', 'Cintura, a la altura del ombligo', 'cm')}${sex === 'female' ? fld('cadera', 'Cadera', 'cm') : ''}</div>
        <div id="b-navy">${res(navy, 'Con cinta')}</div></section>
      <section class="card"><h2>% de grasa con plicómetro</h2>
        <p class="small muted">Jackson-Pollock de 3 pliegues, lado derecho, en milímetros.</p>
        <div class="two">${fld('s1', sites[0], 'mm')}${fld('s2', sites[1], 'mm')}${fld('s3', sites[2], 'mm')}</div>
        <div id="b-sk">${res(sk, 'Con pliegues')}</div></section>
      <section class="card"><h2>Historial de % de grasa</h2>
        ${hist.length ? `<div class="list">${hist.map((w) => `<div class="row"><span>${esc(fmtDate(w.fecha, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><b>${nf(w.grasa, 1)} %</b></div>`).join('')}</div>` : '<p class="small muted">Cuando guardes una medida aparecerá aquí y en la gráfica de Peso → Grasa.</p>'}
      </section>`;
  }
  function subForma() {
    const pm = pmcData(), a = atleta(), A = P().atleta || {};
    let h = '';
    if (!pm) h += '<section class="card"><div class="empty"><b>Aún no hay entrenos</b><span>Registra tus salidas y sesiones en Entreno y aquí verás tu forma, tu fatiga y tu frescura.</span></div></section>';
    else {
      const L = pm.last, fs = T.formState(L.tsb), from = E.addDays(todayISO(), -90), pts = pm.pts.filter((x) => x.date >= from);
      h += `<div class="stats s3">${stat('Forma', nf(L.ctl), '', 'media 6 semanas')}${stat('Fatiga', nf(L.atl), '', 'media 7 días')}${stat('Frescura', sgn(Math.round(L.tsb)), '', esc(fs.label), 'tsb-' + tsbCls(L.tsb))}</div>
        <section class="card"><h2>${esc(fs.label)}</h2><p>${esc(fs.advice)}</p>
          ${lineas([{ name: 'Forma', cls: 's1', pts: pts.map((x) => [x.date, x.ctl]) }, { name: 'Fatiga', cls: 's2', pts: pts.map((x) => [x.date, x.atl]) }], 'Forma y fatiga de los últimos 90 días')}</section>`;
      const weeks = [], mon = E.mondayOf(todayISO());
      for (let i = 7; i >= 0; i--) { const s = E.addDays(mon, -7 * i), e = E.addDays(s, 6); let v = 0; Object.keys(pm.daily).forEach((d) => { if (d >= s && d <= e) v += pm.daily[d]; }); weeks.push({ s, v: Math.round(v) }); }
      const mx = Math.max(1, ...weeks.map((x) => x.v));
      h += `<section class="card"><h2>Carga semanal</h2><div class="vbars">${weeks.map((x, i) => `<div class="${i === weeks.length - 1 ? 'cur' : ''}"><span class="num">${x.v || ''}</span><i style="height:${Math.max(2, (x.v / mx) * 100)}%"></i><small>${esc(fmtDate(x.s))}</small></div>`).join('')}</div>
        <p class="small muted">Puntos de carga (TSS) por semana. Súbela poco a poco: no más de un 10 % por semana.</p></section>`;
    }
    h += `<details class="card"${st.athOpen ? ' open' : ''}><summary><h2>Tus datos de entreno</h2></summary>
      <form class="form-grid" data-form="atleta" novalidate>
        <div class="two"><label class="field"><span>FC máxima</span><input class="input" name="fcMax" inputmode="numeric" value="${esc(A.fcMax || '')}" placeholder="${a.hrMax}"></label>
        <label class="field"><span>FC en reposo</span><input class="input" name="fcRep" inputmode="numeric" value="${esc(A.fcRep || '')}" placeholder="60"></label>
        <label class="field"><span>FTP (vatios)</span><input class="input" name="ftp" inputmode="numeric" value="${esc(A.ftp || '')}" placeholder="Opcional"></label></div>
        <p class="small muted">${a.est ? `Sin tu FC máxima usamos ${a.hrMax} (estimada por tu edad). ` : ''}Con pulso o potencia en tus salidas, la carga se calcula mejor; sin ellos, por duración y esfuerzo.</p>
        <button class="btn" type="submit">Guardar</button>
      </form></details>`;
    return h;
  }

  /* ================================================================ */
  /* Inicio                                                            */
  /* ================================================================ */
  function homeCards() {
    const t = todayISO(), tot = totales(t), od = objetivoDia(t);
    let h = `<section class="card"><div class="card-head"><h2>Comida de hoy</h2><button class="link" data-act="tab" data-v="nutricion">Abrir</button></div>
      <div class="kcalrow"><div><div class="big num">${nf(Math.round(tot.k))}</div><span class="muted">kcal${od ? ` de ${nf(od.target)}` : ''}</span></div>
      <button class="btn small" data-act="n-hoy">${I.plus} Apuntar</button></div>
      ${od ? pbar(tot.k / od.target, tot.k > od.target * 1.05 ? 'over' : '') : ''}
      ${od ? `<p class="small muted">Proteína ${nf(tot.p)} de ${nf(od.macros.p)} g</p>` : ''}</section>`;
    const ms = metas().slice(0, 3);
    if (ms.length) h += `<section class="card"><div class="card-head"><h2>Tus objetivos</h2><button class="link" data-act="nov-wk" data-v="objetivos">Ver</button></div>${ms.map((m) => metaCard(m, true)).join('')}</section>`;
    const pm = pmcData();
    if (pm) {
      const fs = T.formState(pm.last.tsb);
      h += `<section class="card"><div class="card-head"><h2>Tu forma</h2><button class="link" data-act="p-forma">Ver</button></div>
        <p><span class="tag tsb-${tsbCls(pm.last.tsb)}">${esc(fs.label)}</span> <span class="muted small">frescura ${sgn(Math.round(pm.last.tsb))}</span></p><p class="small">${esc(fs.advice)}</p></section>`;
    }
    if (tieneBici() && RT) {
      if (!st.wx && !st.wxLoading && !st.wxErr) setTimeout(() => loadWx(), 0);
      const w = wxNow(), r = rankedRoutes()[0];
      h += `<section class="card"><div class="card-head"><h2>Salida recomendada</h2><button class="link" data-act="r-ver" data-v="${r.route.id}">Ver</button></div>
        <p><b>${esc(r.route.name)}</b> <span class="muted">· ${nf(r.route.km)} km · ${nf(r.route.climbM)} m+</span></p>
        <p class="small muted">${w.src === 'api' ? esc(horaTxt(st.wx.hours[Math.min(st.wxIdx || 0, st.wx.hours.length - 1)].time)) + ': ' : ''}${nf(w.t)}°, ${esc(w.label)}, viento ${nf(w.wind)} km/h${r.why.length ? ' · ' + esc(r.why.join(' · ')) : ''}</p></section>`;
    }
    return h;
  }

  /* ================================================================ */
  /* Registro de bici: elegir bici y potencia                          */
  /* ================================================================ */
  function wkBiciHTML(w) {
    const bs = garaje().bicis;
    return `${bs.length > 1 ? `<label class="field"><span>Bici</span><select class="input" data-wk="bici">${bs.map((b, i) => `<option value="${esc(b.id)}" ${(w.bici || bs[0].id) === b.id ? 'selected' : ''}>${esc(b.nombre)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Potencia normalizada (W) <span class="muted">(opcional)</span></span><input class="input" data-wk="np" inputmode="numeric" value="${esc(w.np || '')}" placeholder="Si tienes potenciómetro"></label>`;
  }

  /* ================================================================ */
  /* Eventos                                                           */
  /* ================================================================ */
  async function click(act, v, b) {
    switch (act) {
      // Nutrición
      case 'n-dia': { const t = todayISO(), d = st.nDate || t; st.nDate = v === '0' ? t : E.addDays(d, Number(v)); if (st.nDate > t) st.nDate = t; render(); return true; }
      case 'n-ir': st.nDate = v; render(); window.scrollTo(0, 0); return true;
      case 'n-add': st.food = { meal: Number(v), q: '', sel: null, mode: 'g', amt: '', prep: null, oil: '' }; render(); focusSheet(); return true;
      case 'n-hoy': st.tab = 'nutricion'; lsSet('cadencia-tab', 'nutricion'); st.nDate = todayISO(); st.food = { meal: mealNow(), q: '', sel: null, mode: 'g', amt: '', prep: null, oil: '' }; render(); focusSheet(); return true;
      case 'n-close': st.food = null; render(); return true;
      case 'n-unpick': st.food.sel = null; st.food.quick = null; st.food.amt = ''; st.food.prep = null; st.food.oil = ''; render(); focusSheet(); return true;
      case 'n-meal': st.food.meal = Number(v); render(); return true;
      case 'n-q': st.food.q = v; render(); return true;
      case 'n-pick': { const f = asFood(v); st.food.sel = v; st.food.mode = f && f.u ? 'u' : 'g'; st.food.amt = ''; st.food.prep = null; st.food.oil = ''; render(); const i = document.querySelector('[data-famt]'); if (i) i.focus({ preventScroll: true }); return true; }
      case 'n-prep': st.food.prep = v; render(); return true;
      case 'n-mode': st.food.mode = v; st.food.amt = ''; render(); return true;
      case 'n-quick': st.food.quick = { n: st.food.q.trim(), k: '', p: '', c: '', f: '' }; render(); return true;
      case 'n-addfood': {
        const food = asFood(st.food.sel); if (!food) return true;
        const c = foodChoice(food); if (!(c.grams > 0)) return true;
        if (c.grams > 3000) { toast('Revisa la cantidad'); return true; }
        const n = food.n + (c.pm && c.gp && c.pm.id !== c.gp[0].id ? ' · ' + c.pm.n.toLowerCase() : '');
        recordarAlimento(food);
        addItem({ n, g: Math.round(c.grams), k: c.v.k, p: c.v.p, c: c.v.c, f: c.v.f, fid: food.id, ...(c.pm ? { prep: c.pm.id } : {}) });
        return true;
      }
      case 'n-addquick': {
        const Q = st.food.quick, k = num(Q.k);
        if (!(k > 0 && k <= 5000)) { toast('Escribe las calorías (entre 1 y 5.000)'); return true; }
        const g = (x) => { const n = num(x); return n >= 0 && n < 500 ? r1(n) : 0; };
        addItem({ n: Q.n.trim().slice(0, 60) || 'Calorías a mano', k: Math.round(k), p: g(Q.p), c: g(Q.c), f: g(Q.f) });
        return true;
      }
      case 'n-del': { const d = st.nDate || todayISO(); guardarDia(d, dia(d).items.filter((x) => x.id !== v)); return true; }
      case 'n-copiar': { const d = st.nDate || todayISO(); const prev = dia(E.addDays(d, -1)).items.map((x) => ({ ...x, id: nid('f') })); guardarDia(d, prev); toast(`${prev.length} alimentos copiados`); return true; }
      case 'n-neat': case 'n-rate': case 'n-eat': {
        const key = { 'n-neat': 'neat', 'n-rate': 'rate', 'n-eat': 'eat' }[act];
        st.nPlanOpen = true;
        await saveProfile({ nutri: { ...(P().nutri || {}), [key]: key === 'neat' ? v : Number(v) } });
        render(); return true;
      }
      // Rutas
      case 'r-geo': locate(); return true;
      case 'r-preset': st.wxPreset = v || null; render(); return true;
      case 'r-ruta': st.ruta = v; render(); return true;
      case 'r-zona': st.zona = v; render(); return true;
      case 'r-ver': st.ruta = v; st.tab = 'rutas'; lsSet('cadencia-tab', 'rutas'); render(); window.scrollTo(0, 0); return true;
      // Taller
      case 'tl-bici': tlOpen('bici', v); return true;
      case 'tl-comp': tlOpen('comp', v); return true;
      case 'tl-sel': st.biciSel = v; render(); return true;
      case 'tl-close': st.tl = null; render(); return true;
      case 'tl-set': { const k = b.dataset.k; st.tl.d[k] = k === 'tubeless' ? v === '1' : v; render(); return true; }
      case 'tl-save': await tlSave(); return true;
      case 'tl-renew': { const d = st.tl.d; d.desde = todayISO(); d.kmIni = ''; render(); toast('Contador a cero: pulsa Guardar'); return true; }
      case 'tl-del': {
        const S = st.tl, g = garaje();
        if (!S.confirm) { S.confirm = true; S.msg = 'Pulsa otra vez la papelera para borrar.'; render(); return true; }
        if (S.kind === 'bici') { g.bicis = g.bicis.filter((x) => x.id !== S.id); st.biciSel = null; }
        else { const bb = biciActiva(); bb.comps = (bb.comps || []).filter((x) => x.id !== S.id); g.bicis = g.bicis.map((x) => (x.id === bb.id ? bb : x)); }
        st.tl = null; await saveGaraje(g); toast('Borrado'); return true;
      }
      case 'tl-meta': { const g = garaje(), m = g.mejora.metas; g.mejora.metas = m.includes(v) ? m.filter((x) => x !== v) : [...m, v]; await saveGaraje(g); return true; }
      case 'tl-deseo-del': { const g = garaje(); g.mejora.deseos = g.mejora.deseos.filter((x) => x.id !== v); await saveGaraje(g); return true; }
      // Progreso
      case 'p-sub': st.progSub = v; render(); return true;
      case 'p-forma': st.progSub = 'forma'; st.tab = 'progreso'; lsSet('cadencia-tab', 'progreso'); render(); window.scrollTo(0, 0); return true;
      case 'b-save': {
        const pct = Number(v), t = todayISO(), hoy = st.weights.find((w) => w.fecha === t), kg = hoy ? hoy.kg : currentKg();
        try {
          await api.addWeight(uid(), t, kg, { grasa: pct });
          st.weights = await api.listWeights(uid());
          render(); toast(`${nf(pct, 1)} % de grasa guardado`);
        } catch (e) { toast(errorText(e)); }
        return true;
      }
      case 'n-off': buscarOFF(); return true;
      // Novedades
      case 'nov-open': st.novOpen = true; render(); { const n = document.getElementById('novedades'); if (n) n.scrollIntoView({ block: 'start' }); } return true;
      case 'nov-ok': st.novOpen = false; if (novNueva()) await saveProfile({ novVista: NOV_V }); render(); return true;
      case 'nov-wk': st.tab = 'entreno'; st.wkTab = v; lsSet('cadencia-tab', 'entreno'); lsSet('cadencia-wktab', v); render(); window.scrollTo(0, 0); return true;
      // Objetivos
      case 'meta-new': st.meta = { d: { g: 'Bici', tipo: 'bici_km_sem', valor: '', ej: '', hasta: '' } }; if (!tieneBici()) { st.meta.d.g = 'General'; st.meta.d.tipo = 'sesiones_sem'; } render(); return true;
      case 'meta-edit': { const m = metas().find((x) => x.id === v); if (!m) return true; st.meta = { id: m.id, creado: m.creado, d: { g: metaDef(m.tipo)[1], tipo: m.tipo, valor: nf(m.valor, m.valor % 1 ? 1 : 0), ej: m.ej || '', hasta: m.hasta || '' } }; render(); return true; }
      case 'meta-close': st.meta = null; render(); return true;
      case 'meta-g': st.meta.d.g = v; st.meta.d.tipo = META_T.find((x) => x[1] === v)[0]; st.meta.msg = ''; render(); return true;
      case 'meta-tipo': st.meta.d.tipo = v; st.meta.msg = ''; render(); return true;
      case 'meta-save': await metaSave(); return true;
      case 'meta-del': {
        const S = st.meta;
        if (!S.confirm) { S.confirm = true; S.msg = 'Pulsa otra vez la papelera para borrar este objetivo.'; render(); return true; }
        st.meta = null; await saveProfile({ metas: metas().filter((x) => x.id !== S.id) }); render(); toast('Objetivo borrado'); return true;
      }
      default: return false;
    }
  }
  function focusSheet() { const i = document.querySelector('.sheet [data-fq]'); if (i && window.matchMedia('(pointer:fine)').matches) i.focus({ preventScroll: true }); }

  function input(t) {
    const F = st.food;
    if (F && t.dataset.fq != null) { F.q = t.value; const r = document.getElementById('food-res'); if (r) { r.innerHTML = foodResults(); r.scrollTop = 0; } return true; }
    if (F && t.dataset.famt != null || F && t.dataset.foil != null) {
      if (t.dataset.famt != null) F.amt = t.value; else F.oil = t.value;
      const food = asFood(F.sel); if (!food) return true;
      const c = foodChoice(food), el = document.getElementById('food-calc'), btn = document.getElementById('food-add');
      if (el) el.innerHTML = calcHTML(c);
      if (btn) btn.disabled = !(c.grams > 0);
      return true;
    }
    if (F && F.quick && t.dataset.fqk) { F.quick[t.dataset.fqk] = t.value; return true; }
    if (st.tl && t.dataset.tf) { st.tl.d[t.dataset.tf] = t.value; return true; }
    if (st.meta && t.dataset.mf) { st.meta.d[t.dataset.mf] = t.value; return true; }
    if (t.dataset.body) {
      const B = st.body || (st.body = {}); B[t.dataset.body] = t.value;
      // Recalcular sin redibujar toda la pantalla (para no perder el teclado).
      const keep = document.activeElement === t;
      const html = subCuerpo(), tmp = document.createElement('div'); tmp.innerHTML = html;
      ['b-navy', 'b-sk'].forEach((id) => { const a = document.getElementById(id), n = tmp.querySelector('#' + id); if (a && n) a.innerHTML = n.innerHTML; });
      if (keep) t.focus();
      return true;
    }
    return false;
  }
  async function change(t) {
    if (t.dataset.ndate != null) { if (t.value && t.value <= todayISO()) { st.nDate = t.value; render(); } return true; }
    if (t.dataset.wxh != null) { st.wxIdx = Number(t.value); render(); return true; }
    if (st.tl && t.dataset.tfs) { st.tl.d[t.dataset.tfs] = t.value; st.tl.d.cadaKm = ''; render(); return true; }
    if (t.dataset.presu != null) {
      const v = String(t.value).trim() ? num(t.value) : 0;
      if (!(v >= 0 && v <= 50000)) { toast('Escribe un presupuesto entre 0 y 50.000 €'); return true; }
      const g = garaje(); g.mejora.presupuesto = Math.round(v); await saveGaraje(g); return true;
    }
    return false;
  }
  async function submit(kind, f) {
    if (kind === 'deseo') {
      const n = f.n.value.trim(), pr = String(f.precio.value).trim() ? num(f.precio.value) : 0;
      if (!n) { toast('Escribe qué pieza es'); return true; }
      if (!(pr >= 0 && pr <= 20000)) { toast('Revisa el precio'); return true; }
      const g = garaje(); g.mejora.deseos = [...g.mejora.deseos, { id: nid('d'), n: n.slice(0, 60), precio: r1(pr) }];
      await saveGaraje(g); return true;
    }
    if (kind === 'atleta') {
      const o = {}, chk = (k, lo, hi, msg) => { const s = String(f[k].value).trim(); if (!s) return true; const v = num(s); if (!(v >= lo && v <= hi)) { toast(msg); return false; } o[k] = Math.round(v); return true; };
      if (!chk('fcMax', 120, 230, 'FC máxima entre 120 y 230') || !chk('fcRep', 30, 110, 'FC en reposo entre 30 y 110') || !chk('ftp', 50, 600, 'FTP entre 50 y 600 W')) return true;
      if (o.fcRep && o.fcMax && o.fcRep >= o.fcMax) { toast('La FC en reposo tiene que ser menor que la máxima'); return true; }
      st.athOpen = true;
      await saveProfile({ atleta: o }); render(); toast('Datos guardados'); return true;
    }
    return false;
  }
  /* ================================================================ */
  /* Novedades                                                         */
  /* ================================================================ */
  function novItems() {
    const bici = tieneBici();
    return [
      { t: 'Mis rutinas', d: 'Guarda varias rutinas, ponles nombre y cambia entre ellas cuando quieras.', como: 'Entreno → Rutinas.', act: 'nov-wk', v: 'rutina', btn: 'Ver mis rutinas' },
      { t: 'Objetivos de bici, cardio y pesos', d: 'Ponte metas como km de bici a la semana, minutos de cardio, entrenos por semana o kilos en un ejercicio, y mira cuánto te falta.', como: 'Entreno → Objetivos → Nuevo.', act: 'nov-wk', v: 'objetivos', btn: 'Crear un objetivo' },
      { t: 'Taller y Rutas para ciclistas', d: 'Guarda tu bici y sus piezas, recibe avisos cuando toque cambiar cadena o cubiertas, pon un presupuesto para mejorarla y elige ruta por Bilbao según el tiempo.', como: bici ? 'Ya los tienes: pestañas Rutas y Taller, abajo.' : 'Aparecen cuando tu rutina incluye bici: Entreno → Rutinas → Cambiar días o tipos → marca Bici.', act: bici ? 'tab' : 'nov-bici', v: 'taller', btn: bici ? 'Ir al Taller' : 'Añadir bici a mi rutina' },
      { t: 'Nutrición', d: 'Apunta lo que comes con más de 550 alimentos (queso de Burgos incluido), productos de marca y cómo los preparas. Tu objetivo de calorías sube los días que entrenas.', como: 'Pestaña Nutrición → «Añadir» en cada comida.', act: 'tab', v: 'nutricion', btn: 'Apuntar comida' },
      { t: 'Grasa, músculo, agua y hueso', d: 'Además del peso, apunta tu composición corporal para ver cómo cambias por dentro.', como: 'Inicio → «Añadir grasa, músculo, agua y hueso», o Progreso → Peso.', act: 'peso-sheet', v: '', btn: 'Apuntar ahora' },
      { t: 'Peso objetivo si tienes músculo', d: 'Ya no te limitamos al IMC. Con tu % de grasa calculamos tu peso ideal según tu músculo.', como: 'Perfil → Peso objetivo.', act: 'tab', v: 'perfil', btn: 'Revisar mi objetivo' },
      { t: 'Progreso', d: 'Calcula tu % de grasa con cinta métrica o plicómetro, y mira tu forma, fatiga y frescura.', como: 'Pestaña Progreso → Cuerpo o Forma.', act: 'tab', v: 'progreso', btn: 'Ver progreso' },
    ];
  }
  const novNueva = () => P().novVista !== NOV_V;
  const novBell = () => `<button type="button" class="iconbtn bell" data-act="nov-open" aria-label="Novedades${novNueva() ? ' (hay nuevas)' : ''}">${ICO.bell}${novNueva() ? '<i></i>' : ''}</button>`;
  function novedadesHTML() {
    if (!novNueva() && !st.novOpen) return '';
    return `<section class="card nov" id="novedades">
      <div class="card-head"><h2>${ICO.spark} Novedades</h2><button class="iconbtn" data-act="nov-ok" aria-label="Cerrar">${ICO.close}</button></div>
      <p class="small muted">Lo nuevo en Cadencia y dónde encontrarlo.</p>
      <div class="nov-list">${novItems().map((x, i) => `<details class="nov-i"${i === 0 ? ' open' : ''}><summary>${esc(x.t)}</summary>
        <p>${esc(x.d)}</p><p class="small"><b>Cómo:</b> ${esc(x.como)}</p>
        <button class="btn small" data-act="${x.act}" data-v="${x.v}">${esc(x.btn)}</button></details>`).join('')}</div>
      <button class="btn ghost block" data-act="nov-ok">Entendido</button>
    </section>`;
  }

  /* ================================================================ */
  /* Objetivos de entreno                                              */
  /* ================================================================ */
  const metas = () => P().metas || [];
  const metaTitulo = (m) => metaDef(m.tipo)[2].replace('{v}', nf(m.valor, m.valor % 1 ? 1 : 0)).replace('{ej}', m.ej || 'un ejercicio');
  const kmOf = (w) => w.km || 0;
  function metaSuma(tipo, ws) {
    const bici = ws.filter((w) => w.tipo === 'bici'), cardio = ws.filter((w) => w.tipo === 'cardio');
    const sum = (arr, f) => arr.reduce((a, w) => a + (f(w) || 0), 0);
    switch (tipo) {
      case 'bici_km_sem': case 'bici_km_mes': return sum(bici, kmOf);
      case 'bici_desn_sem': return sum(bici, (w) => w.elev);
      case 'cardio_min_sem': return sum(cardio, (w) => w.min);
      case 'cardio_km_sem': case 'cardio_km_mes': return sum(cardio, kmOf);
      case 'fuerza_ses_sem': return ws.filter((w) => w.tipo === 'gym').length;
      case 'sesiones_sem': return ws.length;
      case 'min_sem': return sum(ws, (w) => w.min);
      default: return 0;
    }
  }
  function mejorKg(ej) {
    const key = normFood(ej || ''); let best = 0, fecha = null;
    if (!key) return { best, fecha };
    st.workouts.forEach((w) => (w.ejercicios || []).forEach((x) => {
      if (normFood(x.n) !== key) return;
      (x.series || []).forEach((sr) => { const kg = num(sr.kg); if (kg > best && num(sr.reps) >= 1) { best = kg; fecha = w.fecha; } });
    }));
    return { best, fecha };
  }
  function metaProgreso(m) {
    const d = metaDef(m.tipo), t = todayISO(), ws = st.workouts;
    if (d[4] === 'sem') {
      const mon = E.mondayOf(t), en = (a, b) => ws.filter((w) => w.fecha >= a && w.fecha <= b);
      const cur = metaSuma(m.tipo, en(mon, E.addDays(mon, 6)));
      const hist = [];
      for (let i = 7; i >= 1; i--) { const a = E.addDays(mon, -7 * i); hist.push({ a, ok: metaSuma(m.tipo, en(a, E.addDays(a, 6))) >= m.valor }); }
      const left = 6 - E.weekdayIdx(t);
      return { cur, sub: cur >= m.valor ? '¡Conseguido esta semana!' : `Esta semana · ${left ? `quedan ${left} ${left === 1 ? 'día' : 'días'}` : 'último día'}`, hist };
    }
    if (d[4] === 'mes') {
      const ym = t.slice(0, 7), cur = metaSuma(m.tipo, ws.filter((w) => w.fecha.startsWith(ym)));
      const fin = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate(), left = fin - Number(t.slice(8, 10));
      return { cur, sub: cur >= m.valor ? '¡Conseguido este mes!' : `${fmtDate(t, { month: 'long' })} · ${left ? `quedan ${left} días` : 'último día'}` };
    }
    let cur = 0, fecha = null;
    if (m.tipo === 'fuerza_kg') ({ best: cur, fecha } = mejorKg(m.ej));
    else ws.filter((w) => w.tipo === (m.tipo === 'bici_salida' ? 'bici' : 'cardio')).forEach((w) => { if ((w.km || 0) > cur) { cur = w.km; fecha = w.fecha; } });
    let sub = cur ? `Tu mejor marca: ${nf(cur, cur % 1 ? 1 : 0)} ${d[3]} (${fmtDate(fecha)})` : 'Aún sin registros';
    if (m.hasta) { const dd = Math.round((new Date(m.hasta + 'T12:00') - new Date(t + 'T12:00')) / 864e5); sub += dd >= 0 ? ` · ${dd ? `faltan ${dd} días` : 'el plazo acaba hoy'}` : ' · plazo terminado'; }
    return { cur, sub: cur >= m.valor ? `¡Conseguido! ${sub}` : sub };
  }
  function metaCard(m, mini = false) {
    const d = metaDef(m.tipo), pr = metaProgreso(m), done = pr.cur >= m.valor;
    if (mini) return `<div class="meta-mini"><span>${esc(metaTitulo(m))}</span><b class="num">${nf(pr.cur, pr.cur % 1 ? 1 : 0)}/${nf(m.valor)}</b>${pbar(pr.cur / m.valor, done ? 'done' : '')}</div>`;
    return `<button type="button" class="meta ${done ? 'done' : ''}" data-act="meta-edit" data-v="${esc(m.id)}">
      <span class="meta-h"><span class="tag">${d[1]}</span>${done ? '<span class="tag ok">Conseguido</span>' : ''}</span>
      <b class="meta-t">${esc(metaTitulo(m))}</b>
      <span class="meta-v"><b class="num">${nf(pr.cur, pr.cur % 1 ? 1 : 0)}</b> de ${nf(m.valor)} ${d[3]}</span>
      ${pbar(pr.cur / m.valor, done ? 'done' : '')}
      <small class="muted">${esc(pr.sub)}</small>
      ${pr.hist ? `<span class="wkdots" aria-label="Semanas anteriores">${pr.hist.map((h) => `<i class="${h.ok ? 'ok' : ''}" title="Semana del ${esc(fmtDate(h.a))}"></i>`).join('')}<small class="muted">últimas 7 semanas</small></span>` : ''}
    </button>`;
  }
  function viewObjetivos() {
    const ms = metas();
    if (!ms.length) return `<section class="card tl-empty"><button class="addbig" data-act="meta-new"><span class="addbig-c">${I.plusBig}</span><b>Añadir objetivo</b></button>
      <p class="muted" style="text-align:center">Ponte metas de bici, cardio o pesos: km a la semana, minutos de cardio, entrenos o kilos en un ejercicio. Se van completando solas con lo que registras.</p></section>`;
    return `<div class="metas">${ms.map((m) => metaCard(m)).join('')}</div>
      <button class="btn ghost block" data-act="meta-new">${I.plus} Nuevo objetivo</button>`;
  }
  function ejerciciosConocidos() {
    const set = new Set();
    st.workouts.forEach((w) => (w.ejercicios || []).forEach((x) => set.add(x.n)));
    const r = rutinaOf(); if (r) Object.values(r.sesiones || {}).forEach((s) => (s.ej || []).forEach((x) => set.add(x.n)));
    (E.TODOS_EJERCICIOS || []).forEach((n) => set.add(n));
    return [...set];
  }
  function metaSheet() {
    const S = st.meta, d = S.d, def = metaDef(d.tipo);
    const tipos = META_T.filter((x) => x[1] === d.g);
    return `<div class="sheet-back" data-act="meta-close"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Objetivo">
        <div class="sheet-grab"></div>
        <div class="sheet-head"><button type="button" class="iconbtn" data-act="meta-close" aria-label="Cerrar">${ICO.close}</button><h2>${S.id ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>${S.id ? `<button type="button" class="iconbtn" data-act="meta-del" aria-label="Borrar">${I.trash}</button>` : '<span style="width:36px"></span>'}</div>
        <div class="sheet-list form-grid">
          ${seg('meta-g', META_G.map((g) => [g, g]), d.g, 'Tipo de objetivo')}
          <div class="choices tight">${tipos.map((x) => `<button type="button" class="choice" data-act="meta-tipo" data-v="${x[0]}" aria-pressed="${d.tipo === x[0]}"><span class="t">${esc(x[2].replace('{v}', '…').replace('{ej}', 'un ejercicio'))}</span><span class="tick">${d.tipo === x[0] ? I.check : ''}</span></button>`).join('')}</div>
          ${d.tipo === 'fuerza_kg' ? `<label class="field"><span>Ejercicio</span><input class="input" data-mf="ej" list="meta-ej" value="${esc(d.ej || '')}" placeholder="Ej. Press de banca con barra" autocomplete="off"><datalist id="meta-ej">${ejerciciosConocidos().map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>` : ''}
          <label class="field"><span>Meta (${def[3]})</span><input class="input" data-mf="valor" inputmode="decimal" value="${esc(d.valor)}" placeholder="Ej. ${nf(def[5])}"></label>
          ${def[4] === 'reto' ? `<label class="field"><span>Fecha límite <span class="muted">(opcional)</span></span><input class="input" type="date" data-mf="hasta" value="${esc(d.hasta || '')}" min="${todayISO()}"></label>` : ''}
          ${def[4] === 'sem' ? '<p class="small muted">Cuenta de lunes a domingo con lo que registres en Entreno.</p>' : def[4] === 'mes' ? '<p class="small muted">Cuenta desde el día 1 de cada mes.</p>' : d.tipo === 'fuerza_kg' ? '<p class="small muted">Cuenta el mayor peso que levantes en una serie de ese ejercicio.</p>' : '<p class="small muted">Cuenta tu sesión más larga.</p>'}
          ${S.msg ? `<div class="msg" role="alert">${esc(S.msg)}</div>` : ''}
        </div>
        <div class="sheet-foot"><button class="btn block" data-act="meta-save">Guardar objetivo</button></div>
      </div>`;
  }
  async function metaSave() {
    const S = st.meta, d = S.d, def = metaDef(d.tipo), v = num(d.valor);
    const fail = (m) => { S.msg = m; render(); };
    const lim = { km: 20000, m: 100000, min: 10000, kg: 500, sesiones: 14, entrenos: 21 }[def[3]] || 100000;
    if (!(v > 0 && v <= lim)) return fail(`Escribe la meta en ${def[3]} (un número mayor que 0).`);
    if (d.tipo === 'fuerza_kg' && !String(d.ej || '').trim()) return fail('Elige el ejercicio.');
    const o = { id: S.id || nid('m'), tipo: d.tipo, valor: r1(v), creado: S.creado || todayISO() };
    if (d.tipo === 'fuerza_kg') o.ej = String(d.ej).trim().slice(0, 60);
    if (def[4] === 'reto' && d.hasta) o.hasta = d.hasta;
    const list = S.id ? metas().map((x) => (x.id === S.id ? o : x)) : [...metas(), o];
    st.meta = null;
    await saveProfile({ metas: list });
    render(); toast('Objetivo guardado');
  }

  function sheet() { return st.food ? foodSheet() : st.tl ? tlSheet() : st.meta ? metaSheet() : ''; }
  function view(tab) {
    if (tab === 'nutricion') return viewNutricion();
    if (tab === 'rutas') return viewRutas();
    if (tab === 'taller') return viewTaller();
    if (tab === 'progreso') return viewProgreso();
    return '';
  }

  return { tabs, tabActual, tieneBici, cargar, view, sheet, homeCards, wkBiciHTML, click, input, change, submit, novBell, novedadesHTML, viewObjetivos };
}
