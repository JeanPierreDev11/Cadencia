// Lógica del entrenamiento: solo cálculos y datos, sin pantalla.

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// Tipos de entreno registrado (gym = fuerza, se mantiene por compatibilidad con los datos guardados).
export const TIPOS = { bici: 'Bici', gym: 'Fuerza', cardio: 'Cardio', otro: 'Otro', descanso: 'Descanso' };

/* ---------- fechas (semana de lunes a domingo) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => new Date(iso + 'T12:00:00');
export const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const weekdayIdx = (iso) => (parse(iso).getDay() + 6) % 7; // 0 = lunes
export const mondayOf = (iso) => addDays(iso, -weekdayIdx(iso));

/* ---------- calorías ---------- */
// MET: múltiplo del gasto en reposo (Compendio de actividad física).
function metBici(min, km, esf) {
  if (km > 0 && min > 0) {
    const v = km / (min / 60);
    return v < 16 ? 5.8 : v < 19.3 ? 6.8 : v < 22.5 ? 8 : v < 25.7 ? 10 : v < 32.2 ? 12 : 15.8;
  }
  return { 1: 6, 2: 8, 3: 10 }[esf] || 8;
}
export function estimateKcal(w, kg) {
  const peso = kg > 0 ? kg : 70;
  if (!(w.min > 0)) return 0;
  const met = w.tipo === 'bici' ? metBici(w.min, w.km, w.esf)
    : w.tipo === 'cardio' ? { 1: 6, 2: 8, 3: 10 }[w.esf] || 8
    : w.tipo === 'otro' ? { 1: 4, 2: 6, 3: 8 }[w.esf] || 6
    : { 1: 3.5, 2: 5, 3: 6 }[w.esf] || 5;
  return Math.round((met * peso * w.min) / 60);
}

/* ---------- estadísticas ---------- */
const inWeek = (w, monday) => w.fecha >= monday && w.fecha <= addDays(monday, 6);
export function weekStats(ws, monday) {
  const list = ws.filter((w) => inWeek(w, monday));
  const sum = (k, l = list) => l.reduce((a, w) => a + (w[k] || 0), 0);
  const bici = list.filter((w) => w.tipo === 'bici');
  return { n: list.length, min: sum('min'), km: sum('km', bici), elev: sum('elev', bici), kcal: sum('kcal') };
}
export function weeksSeries(ws, mondayNow, count = 8) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = addDays(mondayNow, -7 * i);
    const s = weekStats(ws, m);
    out.push({ lunes: m, min: s.min, n: s.n });
  }
  return out;
}
// Semanas seguidas con al menos un entreno. La semana en curso no rompe la racha si aún no has entrenado.
export function streakWeeks(ws, mondayNow) {
  const has = (m) => ws.some((w) => inWeek(w, m));
  let m = mondayNow, n = 0;
  if (!has(m)) m = addDays(m, -7);
  while (has(m) && n < 520) { n++; m = addDays(m, -7); }
  return n;
}

/* ---------- récords ---------- */
export function records(ws) {
  const bici = { km: null, elev: null, min: null };
  const map = new Map();
  for (const w of ws) {
    if (w.tipo === 'bici') {
      if (w.km > (bici.km ? bici.km.v : 0)) bici.km = { v: w.km, fecha: w.fecha };
      if (w.elev > (bici.elev ? bici.elev.v : 0)) bici.elev = { v: w.elev, fecha: w.fecha };
      if (w.min > (bici.min ? bici.min.v : 0)) bici.min = { v: w.min, fecha: w.fecha };
    } else if (w.tipo === 'gym') {
      for (const ej of w.ejercicios || []) {
        const key = String(ej.n || '').trim().toLowerCase();
        if (!key) continue;
        const e = map.get(key) || { key, n: ej.n.trim(), veces: 0, best: null, last: '' };
        e.veces++;
        if (w.fecha > e.last) e.last = w.fecha;
        for (const s of ej.series || []) {
          const reps = s.reps || 0, kg = s.kg || 0;
          if (!reps) continue;
          const score = kg > 0 ? kg * (1 + reps / 30) : reps; // 1RM estimado (Epley) o repeticiones
          if (!e.best || score > e.best.score) e.best = { kg, reps, score, fecha: w.fecha };
        }
        map.set(key, e);
      }
    }
  }
  const gym = [...map.values()].filter((e) => e.best).sort((a, b) => b.veces - a.veces || a.n.localeCompare(b.n)).slice(0, 6);
  return { bici, gym };
}
function snapshot(r) {
  const o = { km: r.bici.km ? r.bici.km.v : 0, elev: r.bici.elev ? r.bici.elev.v : 0, min: r.bici.min ? r.bici.min.v : 0 };
  r.gym.forEach((e) => { o['g:' + e.key] = e.best.score; });
  return o;
}
// ¿El entreno nuevo mejora algún récord que ya existía?
export function beatsRecord(before, after) {
  const a = snapshot(before), b = snapshot(after);
  return Object.keys(b).some((k) => a[k] > 0 && b[k] > a[k] + 1e-9);
}
// Series de la última vez que hiciste ese ejercicio (ws ordenado de más reciente a más antiguo).
export function lastSets(ws, name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  for (const w of ws) {
    for (const ej of w.ejercicios || []) {
      if (String(ej.n || '').trim().toLowerCase() === key && (ej.series || []).length) return ej.series;
    }
  }
  return null;
}

/* ================================================================== */
/* Rutinas                                                             */
/* ================================================================== */
export const RTIPOS = { fuerza: 'Fuerza', bici: 'Bici', cardio: 'Cardio', otro: 'Otro' };

/* ---------- biblioteca de ejercicios: cada grupo trabaja lo mismo, así que sus ejercicios son alternativas entre sí ---------- */
export const GRUPOS = {
  rodilla: { n: 'Piernas: sentadilla', ej: ['Sentadilla con barra', 'Sentadilla goblet', 'Prensa de piernas', 'Sentadilla en multipower', 'Hack squat', 'Sentadilla frontal'] },
  bisagra: { n: 'Glúteo y cadera', ej: ['Peso muerto rumano', 'Hip thrust', 'Peso muerto convencional', 'Peso muerto con mancuernas', 'Puente de glúteo', 'Buenos días'] },
  unilateral: { n: 'Una pierna', ej: ['Zancadas', 'Sentadilla búlgara', 'Step-up al cajón', 'Zancada inversa', 'Peso muerto a una pierna'] },
  femoral: { n: 'Femoral', ej: ['Curl femoral tumbado', 'Curl femoral sentado', 'Curl nórdico', 'Curl femoral con fitball'] },
  gemelos: { n: 'Gemelos', ej: ['Elevación de gemelos de pie', 'Elevación de gemelos sentado', 'Gemelos en prensa', 'Gemelos a una pierna'] },
  empuje_h: { n: 'Pecho', ej: ['Press banca', 'Press con mancuernas', 'Flexiones', 'Press inclinado con mancuernas', 'Press de pecho en máquina', 'Fondos en paralelas'] },
  empuje_v: { n: 'Hombro', ej: ['Press militar', 'Press con mancuernas sentado', 'Press Arnold', 'Press de hombro en máquina', 'Elevaciones laterales'] },
  tiron_v: { n: 'Espalda: jalón', ej: ['Dominadas', 'Jalón al pecho', 'Dominadas asistidas', 'Jalón agarre estrecho', 'Pullover en polea'] },
  tiron_h: { n: 'Espalda: remo', ej: ['Remo con barra', 'Remo con mancuerna', 'Remo en polea baja', 'Remo en máquina', 'Remo invertido'] },
  brazos: { n: 'Brazos', ej: ['Curl de bíceps con mancuernas', 'Curl martillo', 'Extensión de tríceps en polea', 'Fondos en banco', 'Curl con barra', 'Press francés'] },
  core: { n: 'Core', ej: ['Plancha', 'Dead bug', 'Plancha lateral', 'Pallof press', 'Rueda abdominal', 'Elevación de piernas colgado'] },
};
export const TODOS_EJERCICIOS = Object.values(GRUPOS).flatMap((g) => g.ej);
// Ejercicios que se miden en tiempo o por lado.
const REPS_FIJAS = {
  'Plancha': '30-45 s', 'Plancha lateral': '30 s por lado', 'Dead bug': '10 por lado', 'Pallof press': '10 por lado',
  'Zancadas': '10 por pierna', 'Sentadilla búlgara': '8-10 por pierna', 'Step-up al cajón': '10 por pierna',
  'Zancada inversa': '10 por pierna', 'Peso muerto a una pierna': '8 por pierna', 'Gemelos a una pierna': '12 por pierna',
};
const SERIES = { fuerza: { s: 4, r: '8-12' }, grasa: { s: 3, r: '10-15' }, rend: { s: 3, r: '5-8' }, general: { s: 3, r: '8-12' } };

export function grupoDe(name) {
  const k = String(name || '').trim().toLowerCase();
  for (const [g, v] of Object.entries(GRUPOS)) if (v.ej.some((e) => e.toLowerCase() === k)) return g;
  return null;
}
// Alternativas a un ejercicio: los demás del mismo grupo que no estén ya en la sesión.
export function alternativas(e, usados = []) {
  const g = e.g || grupoDe(e.n);
  if (!g || !GRUPOS[g]) return [];
  const u = new Set(usados.map((x) => x.toLowerCase()));
  return GRUPOS[g].ej.filter((n) => n.toLowerCase() !== e.n.toLowerCase() && !u.has(n.toLowerCase()));
}
export function nuevoEjercicio(n, g, kind) {
  const sr = SERIES[kind] || SERIES.general;
  return { n, g: g || grupoDe(n) || '', series: sr.s, reps: REPS_FIJAS[n] || sr.r };
}
// Al cambiar un ejercicio por otro, ajusta las repeticiones si uno se mide en tiempo o por lado.
export function repsPara(nuevo, actual, kind) {
  if (REPS_FIJAS[nuevo]) return REPS_FIJAS[nuevo];
  if (Object.values(REPS_FIJAS).includes(actual)) return (SERIES[kind] || SERIES.general).r;
  return actual;
}

/* ---------- sesiones de fuerza ---------- */
const SES_FUERZA = {
  full: { n: 'Cuerpo completo', min: 55, g: ['rodilla', 'empuje_h', 'tiron_h', 'bisagra', 'core'] },
  fullB: { n: 'Cuerpo completo B', min: 55, g: ['bisagra', 'empuje_v', 'tiron_v', 'unilateral', 'core'] },
  inf: { n: 'Tren inferior', min: 60, g: ['rodilla', 'bisagra', 'unilateral', 'femoral', 'gemelos', 'core'] },
  sup: { n: 'Tren superior', min: 55, g: ['empuje_h', 'tiron_v', 'empuje_v', 'tiron_h', 'brazos'] },
  cicl: { n: 'Fuerza para ciclistas', min: 50, g: ['rodilla', 'bisagra', 'unilateral', 'gemelos', 'core', 'core'] },
};
const FUERZA_ORDEN = {
  rend: ['cicl', 'full', 'sup', 'inf'],
  fuerza: ['sup', 'inf', 'full', 'sup', 'inf', 'full', 'sup'],
  grasa: ['full', 'fullB', 'full', 'sup', 'inf', 'full', 'fullB'],
  general: ['full', 'fullB', 'full', 'sup', 'inf', 'full', 'fullB'],
};
function sesionFuerza(key, kind) {
  const def = SES_FUERZA[key];
  const used = [];
  const ej = def.g.map((g) => { const n = GRUPOS[g].ej.find((x) => !used.includes(x)); used.push(n); return nuevoEjercicio(n, g, kind); });
  return { t: 'fuerza', nombre: def.n, min: def.min, ej };
}

/* ---------- sesiones de bici y cardio ---------- */
export const SES_BICI = [
  { id: 'b-int-sub', n: 'Intervalos en subida', d: 'Calienta 15 min. 5 × 4 min fuerte subiendo, con 3 min suaves entre medias. Vuelta a la calma 10 min.', min: 70, cat: 'calidad' },
  { id: 'b-tempo', n: 'Tempo sostenido', d: 'Calienta 15 min. 2 × 20 min a ritmo exigente pero constante, con 5 min suaves entre bloques.', min: 75, cat: 'calidad' },
  { id: 'b-sprint', n: 'Sprints cortos', d: 'Calienta 20 min. 8 × 30 s a tope con 4 min muy suaves. Termina suave.', min: 60, cat: 'calidad' },
  { id: 'b-rodillo', n: 'Intervalos en rodillo', d: 'Calienta 10 min. 6 × 3 min fuerte con 2 min suaves. Ideal si llueve.', min: 50, cat: 'calidad' },
  { id: 'b-z2', n: 'Zona 2 constante', d: 'Ritmo en el que puedes hablar sin ahogarte. Mejor por terreno llano o con poca pendiente.', min: 75, cat: 'base' },
  { id: 'b-cadencia', n: 'Técnica de cadencia', d: 'Rodaje suave con 6 × 2 min a cadencia alta (más de 100 pedaladas por minuto).', min: 60, cat: 'base' },
  { id: 'b-recup', n: 'Recuperación', d: 'Muy suave, piernas sueltas. Si te cuesta hablar, vas demasiado rápido.', min: 45, cat: 'base' },
  { id: 'b-fondo', n: 'Fondo largo', d: 'Salida larga a ritmo cómodo. Come algo cada 45 min y bebe a menudo.', min: 150, cat: 'fondo' },
  { id: 'b-fondo-puertos', n: 'Fondo con puertos', d: 'Salida larga enlazando subidas a ritmo controlado, sin cebarte en ninguna.', min: 180, cat: 'fondo' },
];
export const SES_CARDIO = [
  { id: 'c-correr', n: 'Carrera suave', d: 'Ritmo cómodo: puedes hablar mientras corres.', min: 40, cat: 'base' },
  { id: 'c-eliptica', n: 'Elíptica continua', d: 'Ritmo moderado y constante.', min: 40, cat: 'base' },
  { id: 'c-remo', n: 'Remo continuo', d: 'Ritmo constante, espalda recta y empujando con las piernas.', min: 30, cat: 'base' },
  { id: 'c-caminata', n: 'Caminata en cuesta', d: 'Cinta inclinada al 8-12 % a paso rápido.', min: 45, cat: 'base' },
  { id: 'c-series', n: 'Series de carrera', d: 'Calienta 10 min. 6 × 2 min rápido con 2 min trotando.', min: 40, cat: 'calidad' },
  { id: 'c-hiit-remo', n: 'Intervalos de remo', d: 'Calienta 5 min. 8 × 1 min fuerte con 1 min suave.', min: 30, cat: 'calidad' },
  { id: 'c-hiit-eliptica', n: 'Intervalos en elíptica', d: 'Calienta 5 min. 10 × 1 min fuerte con 1 min suave.', min: 35, cat: 'calidad' },
  { id: 'c-comba', n: 'Comba por intervalos', d: '10 × 1 min de comba con 1 min de descanso.', min: 25, cat: 'calidad' },
];
const BICI_ORDEN = {
  rend: ['b-fondo', 'b-int-sub', 'b-tempo', 'b-recup', 'b-sprint', 'b-cadencia', 'b-z2'],
  grasa: ['b-fondo', 'b-z2', 'b-rodillo', 'b-cadencia', 'b-recup', 'b-tempo', 'b-z2'],
  fuerza: ['b-z2', 'b-recup', 'b-fondo', 'b-cadencia', 'b-z2', 'b-recup', 'b-z2'],
  general: ['b-fondo', 'b-z2', 'b-cadencia', 'b-tempo', 'b-recup', 'b-z2', 'b-z2'],
};
const CARDIO_ORDEN = {
  rend: ['c-correr', 'c-series', 'c-eliptica', 'c-hiit-remo', 'c-remo', 'c-comba', 'c-caminata'],
  grasa: ['c-correr', 'c-hiit-eliptica', 'c-caminata', 'c-series', 'c-remo', 'c-comba', 'c-eliptica'],
  fuerza: ['c-caminata', 'c-eliptica', 'c-remo', 'c-correr', 'c-caminata', 'c-eliptica', 'c-remo'],
  general: ['c-correr', 'c-eliptica', 'c-series', 'c-remo', 'c-caminata', 'c-hiit-remo', 'c-comba'],
};
export const sesionPorId = (id) => SES_BICI.find((s) => s.id === id) || SES_CARDIO.find((s) => s.id === id) || null;
// Todas las sesiones del mismo tipo menos la actual, primero las de la misma intensidad.
export function alternativasSesion(t, id) {
  const lib = t === 'bici' ? SES_BICI : SES_CARDIO;
  const cur = lib.find((s) => s.id === id);
  return lib.filter((s) => s.id !== id).sort((a, b) => (cur ? (b.cat === cur.cat) - (a.cat === cur.cat) : 0));
}
function sesionLib(t, id) { const s = sesionPorId(id); return { t, nombre: s.n, min: s.min, ses: s.id }; }

/* ---------- reparto de días según lo que entrenas y tus objetivos ---------- */
const PESOS = {
  fuerza: { fuerza: 3, grasa: 2, rend: 1, general: 1.2 },
  bici: { fuerza: 1, grasa: 2, rend: 3, general: 2 },
  cardio: { fuerza: 1, grasa: 2, rend: 1.5, general: 1.5 },
  otro: { fuerza: 0.8, grasa: 0.8, rend: 0.8, general: 0.8 },
};
export function repartir(tipos, n, kind) {
  const ts = tipos.filter((t) => PESOS[t]);
  if (!ts.length || n < 1) return [];
  const w = Object.fromEntries(ts.map((t) => [t, PESOS[t][kind] || 1]));
  const tot = ts.reduce((a, t) => a + w[t], 0);
  const c = Object.fromEntries(ts.map((t) => [t, 0]));
  let left = n;
  for (const t of [...ts].sort((a, b) => w[b] - w[a])) if (left > 0) { c[t]++; left--; } // al menos un día de cada cosa
  while (left > 0) {
    let best = ts[0], bd = -Infinity;
    for (const t of ts) { const d = (w[t] / tot) * n - c[t]; if (d > bd) { bd = d; best = t; } }
    c[best]++; left--;
  }
  // Intercalar para no repetir lo mismo dos días seguidos.
  const seq = []; let prev = null; const rem = { ...c };
  for (let i = 0; i < n; i++) {
    const cand = ts.filter((t) => rem[t] > 0).sort((a, b) => rem[b] - rem[a] || w[b] - w[a]);
    const pick = cand.find((t) => t !== prev) || cand[0];
    seq.push(pick); rem[pick]--; prev = pick;
  }
  // La salida larga de bici, el último día de la semana que entrenas.
  const lb = seq.lastIndexOf('bici');
  if (lb >= 0 && lb !== n - 1) [seq[lb], seq[n - 1]] = [seq[n - 1], seq[lb]];
  return seq;
}

export const KIND_TEXT = {
  rend: 'Prioriza la calidad en bici o cardio (intervalos y fondo) y fuerza específica para tener más potencia.',
  grasa: 'Combina fuerza para conservar músculo con resistencia suave y algún intervalo para gastar más.',
  fuerza: 'Más días de fuerza con buen volumen y resistencia suave para recuperar.',
  general: 'Una mezcla equilibrada de fuerza y resistencia.',
};
export function planKind(goals) {
  const g = new Set(goals || []);
  if (g.has('rendimiento') || g.has('prueba')) return 'rend';
  if (g.has('musculo')) return 'fuerza';
  if (g.has('perder')) return 'grasa';
  return 'general';
}
// Días por defecto según cuántos entrenas (0 = lunes).
export const DIAS_DEF = { 1: [5], 2: [1, 5], 3: [0, 2, 5], 4: [0, 2, 4, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

export function sesionVacia(t, otro) {
  if (t === 'fuerza') return { t, nombre: 'Fuerza', min: 60, ej: [] };
  if (t === 'bici' || t === 'cardio') return { t, nombre: RTIPOS[t], min: 60, ses: null };
  return { t: 'otro', nombre: otro || 'Otro', min: 60, det: '' };
}
export function sesionPorDefecto(t, kind, otro) {
  if (t === 'fuerza') return sesionFuerza(FUERZA_ORDEN[kind][0], kind);
  if (t === 'bici') return sesionLib('bici', BICI_ORDEN[kind][1]);
  if (t === 'cardio') return sesionLib('cardio', CARDIO_ORDEN[kind][0]);
  return sesionVacia('otro', otro);
}

// cfg = { tipos: ['fuerza','bici',...], dias: [0,2,4], otro: 'Pádel' }
export function proponerRutina(cfg, goals) {
  const kind = planKind(goals);
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, kind);
  const nB = seq.filter((t) => t === 'bici').length;
  const bici = BICI_ORDEN[kind].slice(0, nB).sort((a, b) => (sesionPorId(a).cat === 'fondo') - (sesionPorId(b).cat === 'fondo'));
  const cardio = CARDIO_ORDEN[kind];
  let fi = 0, bi = 0, ci = 0;
  const sesiones = {};
  dias.forEach((d, i) => {
    const t = seq[i];
    if (t === 'fuerza') sesiones[d] = sesionFuerza(FUERZA_ORDEN[kind][fi++ % FUERZA_ORDEN[kind].length], kind);
    else if (t === 'bici') sesiones[d] = sesionLib('bici', bici[bi++ % bici.length]);
    else if (t === 'cardio') sesiones[d] = sesionLib('cardio', cardio[ci++ % cardio.length]);
    else sesiones[d] = sesionVacia('otro', cfg.otro);
  });
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propuesta', sesiones };
}
export function rutinaVacia(cfg, goals) {
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, planKind(goals));
  const sesiones = {};
  dias.forEach((d, i) => { sesiones[d] = sesionVacia(seq[i], cfg.otro); });
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propia', sesiones };
}
