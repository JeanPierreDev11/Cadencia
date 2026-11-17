import { IMG_CUR, EXTRA, IMGDB, DBX, VIEJOS } from './ejercicios.js';
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
  if (w.tipo !== 'gym') return Math.round((met * peso * w.min) / 60);
  // Fuerza con bloques de cardio dentro: esos minutos se cuentan con el MET del cardio y el resto con el de fuerza.
  const bloques = [];
  for (const e of w.ejercicios || []) if (exCardio(e)) for (const s of e.series || []) if (Number(cv(s, 'min')) > 0) bloques.push([metCardio(e, s), Number(cv(s, 'min'))]);
  let mc = bloques.reduce((a, b) => a + b[1], 0);
  const f = mc > w.min ? w.min / mc : 1; mc = Math.min(mc, w.min);
  const kc = bloques.reduce((a, [m, t]) => a + m * peso * t * f, 0) + met * peso * (w.min - mc);
  return Math.round(kc / 60);
}
// MET de un bloque de cardio: por velocidad si la hay; si no, por intensidad o nivel.
function metCardio(e, s) {
  let v = Number(cv(s, 'kmh')) || 0;
  const t = Number(cv(s, 'min')) || 0;
  if (!v && Number(s.km) > 0 && t > 0) v = Number(s.km) / (t / 60);
  if (v > 0) {
    const base = v < 6.5 ? 3.8 : v < 8.5 ? 8 : v < 11 ? 9.8 : 11.5;
    return base + Math.min(4, (Number(cv(s, 'inc')) || 0) * 0.3);
  }
  if (s.int) return { caminata: 3.8, trote: 7, correr: 9.8 }[s.int] || 7;
  if (Number(s.nivel) > 0) return 5 + Math.min(20, Number(s.nivel)) * 0.2;
  return 7;
}

/* ---------- estadísticas ---------- */
const inWeek = (w, monday) => w.fecha >= monday && w.fecha <= addDays(monday, 6);
// Series hechas y kilos movidos (kilos × repeticiones de cada serie; en los ejercicios a un lado, por los dos lados) de un entreno de fuerza.
// Las series de calentamiento (w: true) se guardan en el historial pero NO cuentan en series, volumen, récords, 1RM ni fatiga.
export const trabajo = (series) => (series || []).filter((s) => !(s && s.w));
// Los bloques de cardio (ejercicio con tipo 'cardio') no son series de fuerza: no cuentan en series ni volumen.
const deFuerza = (w) => (w.ejercicios || []).filter((e) => !exCardio(e));
export const seriesDe = (w) => deFuerza(w).reduce((a, e) => a + trabajo(e.series).length, 0);
export const volumenDe = (w) => deFuerza(w).reduce((a, e) => a + trabajo(e.series).reduce((b, s) => b + (Number(s.kg) || 0) * (Number(s.reps) || 0) * (e.uni ? 2 : 1), 0), 0);
export function weekStats(ws, monday) {
  const list = ws.filter((w) => inWeek(w, monday));
  const sum = (k, l = list) => l.reduce((a, w) => a + (w[k] || 0), 0);
  const bici = list.filter((w) => w.tipo === 'bici');
  return { n: list.length, min: sum('min'), km: sum('km', bici), elev: sum('elev', bici), kcal: sum('kcal'), sets: list.reduce((a, w) => a + seriesDe(w), 0), vol: Math.round(list.reduce((a, w) => a + volumenDe(w), 0)) };
}
// Totales de UN día (fecha ISO). Series y volumen salen de seriesDe/volumenDe, que ignoran el calentamiento (w:true).
export function dayStats(ws, fecha) {
  const list = ws.filter((w) => w.fecha === fecha);
  return { min: list.reduce((a, w) => a + (w.min || 0), 0), kcal: list.reduce((a, w) => a + (w.kcal || 0), 0), sets: list.reduce((a, w) => a + seriesDe(w), 0), vol: Math.round(list.reduce((a, w) => a + volumenDe(w), 0)) };
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
// Racha de días entrenados. Los días de descanso de la rutina no suman ni rompen: solo se reinicia si faltas un día con entreno programado.
// Hoy no rompe la racha si aún no has entrenado (todavía puedes hacerlo). Si no hay rutina, cuenta como programados todos los días.
// plan(iso) → true si ese día tocaba entrenar.
// `hueco` = días de descanso seguidos que no rompen la racha (por defecto 0). Sin rutina se calcula con la meta semanal: `huecoDeMeta`.
export function streakDays(ws, hoy, plan = () => true, hueco = 0) {
  const hechos = new Set(ws.map((w) => w.fecha));
  const primero = ws.reduce((m, w) => (m && m < w.fecha ? m : w.fecha), '');
  let n = 0, d = hoy, seguidos = 0;
  for (let i = 0; i < 1500 && primero && d >= primero; i++, d = addDays(d, -1)) {
    if (hechos.has(d)) { n++; seguidos = 0; }
    else if (d === hoy) continue;
    else if (plan(d) && ++seguidos > hueco) break;
  }
  return n;
}
// Descansos seguidos que permite una meta de `dias` entrenos por semana: 7 → 0, 6 → 1, 5 → 1, 4 → 1, 3 → 2, 2 → 3.
export const huecoDeMeta = (dias) => (dias >= 2 && dias <= 7 ? Math.ceil(7 / dias) - 1 : 0);

/* ---------- mover entreno a hoy (Pro; sustituye al «salvavidas de racha») ---------- */
// Lista guardada en el perfil (campo `salvavidas`, se mantiene el nombre por compatibilidad):
// [{ de: 'AAAA-MM-DD' (día cuya sesión se movió), a: 'AAAA-MM-DD' (día al que se movió) }].
// Ese «de» pasa a contar como descanso (no rompe la racha) y «a» hereda la sesión. Se guardan como mucho SALV_MAX.
export const SALV_MAX = 60;
export const salvLista = (p) => (Array.isArray(p && p.salvavidas) ? p.salvavidas.filter((x) => x && typeof x.de === 'string' && typeof x.a === 'string') : []);
// ¿Se puede mover la sesión del día `dia` a `hoy`? plan(iso) → sesión prevista YA con los movimientos aplicados; hechos = Set de fechas con entreno.
// null → no hay nada que mover (no se muestra el botón). { ok: true } → se puede. { ok: false, msg } → se explica por qué no.
export function moverAHoy(dia, hoy, plan, hechos, lista = []) {
  if (dia === hoy || mondayOf(dia) !== mondayOf(hoy) || !plan(dia) || hechos.has(dia)) return null;
  if (lista.some((x) => x.a === dia)) return { ok: false, msg: 'Esta sesión ya se movió una vez.' };
  if (hechos.has(hoy)) return { ok: false, msg: 'Hoy ya has entrenado: no se puede mover otra sesión a hoy.' };
  if (plan(hoy)) return { ok: false, msg: 'Hoy ya tienes una sesión prevista.' };
  return { ok: true };
}

/* ---------- récords ---------- */
// Récords: bici (km, desnivel, tiempo), fuerza (mejor serie por ejercicio, todos) y cardio (por ejercicio: más km, más minutos y más km/h).
export function records(ws) {
  const bici = { km: null, elev: null, min: null };
  const map = new Map(), car = new Map();
  for (const w of ws) {
    if (w.tipo === 'bici') {
      if (w.km > (bici.km ? bici.km.v : 0)) bici.km = { v: w.km, fecha: w.fecha };
      if (w.elev > (bici.elev ? bici.elev.v : 0)) bici.elev = { v: w.elev, fecha: w.fecha };
      if (w.min > (bici.min ? bici.min.v : 0)) bici.min = { v: w.min, fecha: w.fecha };
    } else if (w.tipo === 'gym') {
      for (const ej of w.ejercicios || []) {
        const key = String(ej.n || '').trim().toLowerCase();
        if (!key) continue;
        if (exCardio(ej)) {
          const nn = canon(ej.n), ck = nn.toLowerCase(); // «Cinta de correr» antiguo = «Caminadora / Cinta de correr»
          const c = car.get(ck) || { key: ck, n: nn, veces: 0, km: null, min: null, kmh: null };
          c.veces++;
          // km y minutos: suma de todos los bloques/intervalos de la sesión; km/h: el intervalo más rápido.
          const sr = ej.series || [], suma = (k) => Math.round(sr.reduce((a, q) => a + (Number(cv(q, k)) || 0), 0) * 10) / 10;
          const vals = { km: suma('km'), min: suma('min'), kmh: Math.max(0, ...sr.map((q) => Number(cv(q, 'kmh')) || 0)) };
          for (const k of ['km', 'min', 'kmh']) { const v = vals[k]; if (v > (c[k] ? c[k].v : 0)) c[k] = { v, fecha: w.fecha }; }
          car.set(ck, c);
          continue;
        }
        const e = map.get(key) || { key, n: ej.n.trim(), veces: 0, best: null, last: '' };
        e.veces++;
        if (w.fecha > e.last) e.last = w.fecha;
        for (const s of trabajo(ej.series)) {
          const reps = s.reps || 0, kg = s.kg || 0;
          if (!reps) continue;
          const score = kg > 0 ? kg * (1 + reps / 30) : reps; // 1RM estimado (Epley) o repeticiones
          if (!e.best || score > e.best.score) e.best = { kg, reps, score, fecha: w.fecha };
        }
        map.set(key, e);
      }
    }
  }
  const gym = [...map.values()].filter((e) => e.best).sort((a, b) => b.veces - a.veces || a.n.localeCompare(b.n));
  const cardio = [...car.values()].filter((c) => c.km || c.min || c.kmh).sort((a, b) => b.veces - a.veces || a.n.localeCompare(b.n));
  return { bici, gym, cardio };
}
function snapshot(r) {
  const o = { km: r.bici.km ? r.bici.km.v : 0, elev: r.bici.elev ? r.bici.elev.v : 0, min: r.bici.min ? r.bici.min.v : 0 };
  r.gym.forEach((e) => { o['g:' + e.key] = e.best.score; });
  (r.cardio || []).forEach((c) => { for (const k of ['km', 'min', 'kmh']) if (c[k]) o[`c:${c.key}:${k}`] = c[k].v; });
  return o;
}
// ¿El entreno nuevo mejora algún récord que ya existía?
export function beatsRecord(before, after) {
  const a = snapshot(before), b = snapshot(after);
  return Object.keys(b).some((k) => a[k] > 0 && b[k] > a[k] + 1e-9);
}
// Series de la última vez que hiciste ese ejercicio (ws ordenado de más reciente a más antiguo).
// Nombre «oficial» de un ejercicio (resuelve alias como «Cinta de correr» → «Caminadora / Cinta de correr»).
export const canon = (n) => { const x = ejercicio(n); return x ? x.n : String(n || '').trim(); };
export function lastSets(ws, name) {
  const key = canon(name).toLowerCase();
  if (!key) return null;
  for (const w of ws) {
    for (const ej of w.ejercicios || []) {
      if (canon(ej.n).toLowerCase() === key && trabajo(ej.series).length) return trabajo(ej.series);
    }
  }
  return null;
}

/* ---------- Pro: sobrecarga progresiva y 1RM ---------- */
// 1RM estimado (Brzycki): peso × 36 / (37 − reps). Solo es fiable hasta ~12 reps; fuera de 1–12 o sin peso → null.
export function orm1(kg, reps) {
  kg = Number(kg); reps = Math.round(Number(reps));
  if (!(kg > 0) || !(reps >= 1 && reps <= 12)) return null;
  return kg * (36 / (37 - reps));
}
// Mejor 1RM estimado entre las series (kg y reps escritos).
export function mejor1RM(series, parse = Number) {
  let best = null;
  for (const s of trabajo(series)) { const v = orm1(parse(s.kg), parse(s.reps)); if (v != null && (best == null || v > best)) best = v; }
  return best;
}
// Pro: Calentamiento Inteligente. Según cuántas series elijas (1, 2 o 3), porcentaje del peso de trabajo × repeticiones,
// redondeado a 2,5 kg (mínimo 2,5). Sin número → 3 series.
export const CALENTAMIENTO = {
  1: [[0.6, 8]],
  2: [[0.5, 10], [0.7, 6]],
  3: [[0.4, 12], [0.6, 8], [0.8, 4]],
};
export function calentamiento(kg, n = 3) {
  kg = Number(kg);
  const esq = CALENTAMIENTO[n] || CALENTAMIENTO[3];
  if (!(kg > 0)) return [];
  return esq.map(([p, reps]) => ({ kg: Math.max(2.5, Math.round((kg * p) / 2.5) * 2.5), reps }));
}
// Sugerencia para forzar sobrecarga a partir de la misma serie de la última sesión.
// Rango "8-12": si no llegaste al tope → mismo peso +1 rep; si lo alcanzaste → +2,5 kg y vuelta al mínimo del rango.
// Sin rango (ejercicio libre) → mismo peso +1 rep. Sin peso (corporal) → +1 rep. Objetivos en tiempo → sin sugerencia.
export function sugerirSerie(prev, objReps) {
  if (!prev) return null;
  const kg = Number(prev.kg) || 0, reps = Math.round(Number(prev.reps));
  if (!(reps >= 1) || /\b(s|seg|min)\b/i.test(String(objReps || ''))) return null;
  const n = String(objReps || '').match(/\d+/g), lo = n ? Number(n[0]) : 0, hi = n ? Number(n[n.length - 1]) : 0;
  if (kg > 0 && hi && reps >= hi) return { kg: Math.round((kg + 2.5) * 10) / 10, reps: Math.max(1, lo || reps) };
  return { kg, reps: reps + 1 };
}

/* ================================================================== */
/* Rutinas                                                             */
/* ================================================================== */
export const RTIPOS = { fuerza: 'Fuerza', bici: 'Bici', cardio: 'Cardio', otro: 'Otro' };

/* ---------- biblioteca de ejercicios ---------- */
export const MUSCULOS = {
  pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', antebrazo: 'Antebrazos',
  cuadriceps: 'Cuádriceps', femoral: 'Isquiotibiales', gluteo: 'Glúteos', gemelos: 'Gemelos', core: 'Core',
  aductores: 'Aductores', abductores: 'Abductores de la cadera', cardio: 'Cardio',
};
export const EQUIPOS = {
  barra: 'Barra', barraz: 'Barra Z', mancuernas: 'Mancuernas', kettlebell: 'Kettlebells', polea: 'Polea', maquina: 'Máquina',
  multipower: 'Multipower', corporal: 'Peso corporal', banda: 'Bandas elásticas', balon: 'Balón medicinal', fitball: 'Fitball',
  suspension: 'Correas de suspensión', trineo: 'Trineo', cuerdas: 'Cuerdas de batalla', otro: 'Otro',
};
// Músculos concretos (para el mapa del cuerpo)
export const MUSC_DET = {
  ch: 'Pecho', sh: 'Hombros', bi: 'Bíceps', tr: 'Tríceps', fo: 'Antebrazos', ab: 'Abdominales', qu: 'Cuádriceps', ha: 'Isquiotibiales',
  gl: 'Glúteos', ca: 'Gemelos', la: 'Dorsales', mb: 'Espalda media', lb: 'Lumbares', tp: 'Trapecios', ne: 'Cuello', ad: 'Aductores', abd: 'Abductores',
};
const GRUPO_DET = { pecho: 'ch', espalda: 'la', hombro: 'sh', biceps: 'bi', triceps: 'tr', antebrazo: 'fo', cuadriceps: 'qu', femoral: 'ha', gluteo: 'gl', gemelos: 'ca', core: 'ab', aductores: 'ad', abductores: 'abd' };
// nombre | músculo | patrón de movimiento (los del mismo patrón son alternativas entre sí) | equipo
const TABLA = `
Press banca|pecho|empuje_h|barra
Press con mancuernas|pecho|empuje_h|mancuernas
Press inclinado con barra|pecho|empuje_h|barra
Press inclinado con mancuernas|pecho|empuje_h|mancuernas
Press declinado|pecho|empuje_h|barra
Press de pecho en máquina|pecho|empuje_h|maquina
Press banca en multipower|pecho|empuje_h|multipower
Flexiones|pecho|empuje_h|corporal
Flexiones con pies elevados|pecho|empuje_h|corporal
Fondos en paralelas|pecho|empuje_h|corporal
Press de suelo con kettlebell|pecho|empuje_h|kettlebell
Aperturas con mancuernas|pecho|aperturas|mancuernas
Aperturas inclinadas con mancuernas|pecho|aperturas|mancuernas
Cruce de poleas|pecho|aperturas|polea
Cruce de poleas bajas|pecho|aperturas|polea
Contractora (pec deck)|pecho|aperturas|maquina
Aperturas con banda|pecho|aperturas|banda
Dominadas|espalda|tiron_v|corporal
Dominadas supinas|espalda|tiron_v|corporal
Dominadas asistidas|espalda|tiron_v|maquina
Jalón al pecho|espalda|tiron_v|polea
Jalón agarre estrecho|espalda|tiron_v|polea
Jalón con agarre neutro|espalda|tiron_v|polea
Jalón a una mano|espalda|tiron_v|polea
Pullover en polea|espalda|tiron_v|polea
Jalón con banda|espalda|tiron_v|banda
Remo con barra|espalda|tiron_h|barra
Remo con mancuerna|espalda|tiron_h|mancuernas
Remo en polea baja|espalda|tiron_h|polea
Remo en máquina|espalda|tiron_h|maquina
Remo T|espalda|tiron_h|barra
Remo Pendlay|espalda|tiron_h|barra
Remo con apoyo en el pecho|espalda|tiron_h|mancuernas
Remo invertido|espalda|tiron_h|corporal
Remo con kettlebell|espalda|tiron_h|kettlebell
Remo con banda|espalda|tiron_h|banda
Press militar|hombro|empuje_v|barra
Press con mancuernas sentado|hombro|empuje_v|mancuernas
Press Arnold|hombro|empuje_v|mancuernas
Press de hombro en máquina|hombro|empuje_v|maquina
Press de hombro en multipower|hombro|empuje_v|multipower
Press landmine|hombro|empuje_v|barra
Press con kettlebell|hombro|empuje_v|kettlebell
Flexiones en pica|hombro|empuje_v|corporal
Elevaciones laterales|hombro|elev_lat|mancuernas
Elevaciones laterales en polea|hombro|elev_lat|polea
Elevaciones laterales en máquina|hombro|elev_lat|maquina
Elevaciones laterales con banda|hombro|elev_lat|banda
Elevaciones frontales|hombro|elev_lat|mancuernas
Remo al mentón|hombro|elev_lat|barra
Face pull|hombro|posterior|polea
Pájaros con mancuernas|hombro|posterior|mancuernas
Contractora inversa|hombro|posterior|maquina
Aperturas posteriores con banda|hombro|posterior|banda
Curl con barra|biceps|biceps|barra
Curl con barra Z|biceps|biceps|barra
Curl de bíceps con mancuernas|biceps|biceps|mancuernas
Curl martillo|biceps|biceps|mancuernas
Curl inclinado con mancuernas|biceps|biceps|mancuernas
Curl concentrado|biceps|biceps|mancuernas
Curl en polea|biceps|biceps|polea
Curl predicador en máquina|biceps|biceps|maquina
Curl con banda|biceps|biceps|banda
Curl con kettlebell|biceps|biceps|kettlebell
Extensión de tríceps en polea|triceps|triceps|polea
Extensión con cuerda|triceps|triceps|polea
Press francés|triceps|triceps|barra
Extensión sobre la cabeza con mancuerna|triceps|triceps|mancuernas
Patada de tríceps|triceps|triceps|mancuernas
Press banca agarre estrecho|triceps|triceps|barra
Extensión de tríceps en máquina|triceps|triceps|maquina
Fondos en banco|triceps|triceps|corporal
Flexiones diamante|triceps|triceps|corporal
Extensión de tríceps con banda|triceps|triceps|banda
Sentadilla con barra|cuadriceps|rodilla|barra
Sentadilla frontal|cuadriceps|rodilla|barra
Sentadilla goblet|cuadriceps|rodilla|mancuernas
Sentadilla con kettlebell|cuadriceps|rodilla|kettlebell
Prensa de piernas|cuadriceps|rodilla|maquina
Hack squat|cuadriceps|rodilla|maquina
Sentadilla péndulo|cuadriceps|rodilla|maquina
Sentadilla en multipower|cuadriceps|rodilla|multipower
Sentadilla con peso corporal|cuadriceps|rodilla|corporal
Sentadilla con banda|cuadriceps|rodilla|banda
Extensión de cuádriceps|cuadriceps|cuad_iso|maquina
Sissy squat|cuadriceps|cuad_iso|corporal
Zancadas|cuadriceps|unilateral|mancuernas
Zancadas caminando|cuadriceps|unilateral|mancuernas
Zancada inversa|cuadriceps|unilateral|mancuernas
Sentadilla búlgara|cuadriceps|unilateral|mancuernas
Step-up al cajón|cuadriceps|unilateral|mancuernas
Zancadas con barra|cuadriceps|unilateral|barra
Zancadas con peso corporal|cuadriceps|unilateral|corporal
Peso muerto rumano|femoral|bisagra|barra
Peso muerto convencional|femoral|bisagra|barra
Peso muerto sumo|femoral|bisagra|barra
Peso muerto con barra hexagonal|femoral|bisagra|barra
Peso muerto con mancuernas|femoral|bisagra|mancuernas
Peso muerto a una pierna|femoral|bisagra|mancuernas
Buenos días|femoral|bisagra|barra
Swing con kettlebell|femoral|bisagra|kettlebell
Hiperextensiones|femoral|bisagra|corporal
Peso muerto con banda|femoral|bisagra|banda
Curl femoral tumbado|femoral|femoral|maquina
Curl femoral sentado|femoral|femoral|maquina
Curl nórdico|femoral|femoral|corporal
Curl femoral con fitball|femoral|femoral|corporal
Curl femoral con banda|femoral|femoral|banda
Hip thrust|gluteo|gluteo|barra
Hip thrust en máquina|gluteo|gluteo|maquina
Hip thrust con mancuerna|gluteo|gluteo|mancuernas
Puente de glúteo|gluteo|gluteo|corporal
Hip thrust a una pierna|gluteo|gluteo|corporal
Patada de glúteo en polea|gluteo|gluteo|polea
Abducción en máquina|gluteo|gluteo|maquina
Abducción con banda|gluteo|gluteo|banda
Elevación de gemelos de pie|gemelos|gemelos|maquina
Elevación de gemelos sentado|gemelos|gemelos|maquina
Gemelos en prensa|gemelos|gemelos|maquina
Gemelos con mancuernas|gemelos|gemelos|mancuernas
Gemelos a una pierna|gemelos|gemelos|corporal
Plancha|core|core|corporal
Plancha lateral|core|core|corporal
Dead bug|core|core|corporal
Bird dog|core|core|corporal
Rueda abdominal|core|core|corporal
Elevación de piernas colgado|core|core|corporal
Crunch abdominal|core|core|corporal
Russian twist|core|core|corporal
Mountain climbers|core|core|corporal
Crunch en polea|core|core|polea
Pallof press|core|core|polea
Leñador en polea|core|core|polea
Pallof press con banda|core|core|banda
Curl de muñeca|antebrazo|antebrazo|mancuernas
Curl inverso|antebrazo|antebrazo|barra
Paseo del granjero|antebrazo|antebrazo|mancuernas
`;
// Los ejercicios principales (con patrón de movimiento) y el resto de la base con imagen.
// Cada ejercicio tiene `tipo`: 'fuerza' (por defecto: kg × reps) o 'cardio' (bloques de tiempo, distancia, velocidad…).
export const BIBLIOTECA = TABLA.trim().split('\n').map((l) => {
  const [n, m, p, eq] = l.split('|'), c = IMG_CUR[n];
  return { n, m, p, eq, img: c ? c[0] : '', mu: c ? c[1] : GRUPO_DET[m], base: true, tipo: 'fuerza' };
});
const RESTO = EXTRA.map(([n, m, eq, img, mu, cat]) => ({ n, m, p: null, eq, img, mu, cat, tipo: 'fuerza' }))
// Ejercicios nuevos de ExerciseDB (js/ejercicios-db.js): sin imagen antigua; la animación sale de IMGDB. `en` = nombre en inglés para el buscador.
const NUEVOS_DB = DBX.map(([n, m, eq, mu, id, en, cm]) => (cm
  ? { n, m, p: null, eq, img: '', mu, en, tipo: 'cardio', cm, ...(cm === 'aire' ? { int: 'correr' } : {}) }
  : { n, m, p: null, eq, img: '', mu, en, tipo: 'fuerza' }));

/* ---------- cardio dentro del entreno ---------- */
// cm = cómo se apunta cada bloque. Cada campo: k (clave guardada), t (cabecera), im (teclado), ph (ejemplo), lo/hi (rango válido).
// «int» no es un número: es un selector de intensidad (INTENSIDADES).
export const INTENSIDADES = { caminata: 'Caminata', trote: 'Trote', correr: 'Correr' };
// u = unidad que se ve dentro de la casilla. La cinta trabaja por INTERVALOS (HIIT/LISS): cada fila = { tiempo, velocidad, inclinacion, completada }.
export const CARDIO_MODOS = {
  cinta: [{ k: 'tiempo', t: 'Min', u: 'min', im: 'decimal', ph: '10', lo: 0.5, hi: 600 }, { k: 'velocidad', t: 'Vel', u: 'km/h', im: 'decimal', step: '0.1', ph: '4,5', lo: 0.5, hi: 30 }, { k: 'inclinacion', t: 'Inc', u: '%', im: 'decimal', step: '0.5', ph: '5', lo: 0, hi: 30 }],
  aire: [{ k: 'km', t: 'km', u: 'km', im: 'decimal', ph: '5', lo: 0.1, hi: 200 }, { k: 'min', t: 'Min', u: 'min', im: 'decimal', ph: '30', lo: 1, hi: 600 }, { k: 'int', t: 'Ritmo' }],
  estatica: [{ k: 'min', t: 'Min', u: 'min', im: 'decimal', ph: '20', lo: 1, hi: 600 }, { k: 'nivel', t: 'Nivel', im: 'numeric', ph: '8', lo: 1, hi: 30 }],
};
// La cinta guardaba antes { min, kmh, inc } (15-11-2026, primera versión): cv() lee un campo con su nombre nuevo o el antiguo.
const CAMPO_ALIAS = { min: 'tiempo', tiempo: 'min', kmh: 'velocidad', velocidad: 'kmh', inc: 'inclinacion', inclinacion: 'inc' };
export const cv = (s, k) => { if (!s) return undefined; const v = s[k]; return v != null && v !== '' ? v : s[CAMPO_ALIAS[k]]; };
const CINTA = 'Caminadora / Cinta de correr';
const CARDIO = [
  { n: CINTA, eq: 'maquina', cm: 'cinta' },
  { n: 'Correr al aire libre', eq: 'corporal', cm: 'aire', int: 'correr' },
  { n: 'Bicicleta estática', eq: 'maquina', cm: 'estatica' },
].map((x) => ({ ...x, m: 'cardio', p: null, img: '', mu: '', base: true, tipo: 'cardio' }));
// Nombres antiguos o habituales que deben encontrar la cinta (los entrenos ya guardados con «Cinta de correr» siguen enlazados).
const ALIAS_EJ = { 'cinta de correr': CINTA, 'caminadora': CINTA, 'cinta': CINTA, 'treadmill': CINTA };
export const tipoEjercicio = (x) => (x && (x.tipo === 'cardio' || x.m === 'cardio') ? 'cardio' : 'fuerza');
// ¿Este ejercicio (de la biblioteca o ya guardado en un entreno) es de cardio? Los guardados llevan tipo: 'cardio'.
export const exCardio = (e) => !!e && (e.tipo === 'cardio' || tipoEjercicio(ejercicio(e.n)) === 'cardio');
// Modo de apunte del ejercicio de cardio (los propios de cardio se apuntan como «aire libre»).
export const modoCardio = (n) => { const x = ejercicio(n); return x && CARDIO_MODOS[x.cm] ? x.cm : 'aire'; };
// ¿Es la cinta (cardio por intervalos)?
export const esCinta = (e) => exCardio(e) && modoCardio(e.n) === 'cinta';

let PROPIOS = [];
let INDICE = null;
export const setPropios = (l) => { PROPIOS = (l || []).filter((x) => x && x.n).map((x) => ({ n: x.n, m: x.m || 'core', p: null, eq: x.eq || 'corporal', img: '', mu: GRUPO_DET[x.m] || '', propio: true, tipo: x.m === 'cardio' ? 'cardio' : 'fuerza', ...(x.m === 'cardio' ? { cm: 'aire', int: 'correr' } : {}) })); INDICE = null; };
export const todosEjercicios = () => [...PROPIOS, ...BIBLIOTECA, ...CARDIO, ...RESTO, ...NUEVOS_DB];

// ---------- Buscador: sin acentos ni mayúsculas, con erratas y también en inglés ----------
// El nombre en inglés sale del id de la imagen (p. ej. «Barbell_Deadlift»); estos son los que no tienen imagen y los apodos más comunes.
const ALIAS_EN = {
  'jalon con banda': 'band lat pulldown', 'remo pendlay': 'pendlay row', 'remo con banda': 'band row', 'press landmine': 'landmine press',
  'flexiones en pica': 'pike push up', 'elevaciones laterales en maquina': 'machine lateral raise', 'curl con banda': 'band curl',
  'curl con kettlebell': 'kettlebell curl', 'sentadilla pendulo': 'pendulum squat', 'peso muerto con banda': 'band deadlift',
  'hip thrust en maquina': 'machine hip thrust', 'hip thrust con mancuerna': 'dumbbell hip thrust', 'abduccion con banda': 'band hip abduction',
  'gemelos a una pierna': 'single leg calf raise', 'bird dog': 'bird dog', 'pallof press con banda': 'band pallof press',
};
const SINONIMOS = [[/flexion(es)? de biceps/g, 'curl biceps'], [/flexion(es)? de triceps/g, 'extension triceps'], [/deadlift/g, 'deadlift peso muerto'], [/pull ?ups?/g, 'pullup dominadas'], [/push ?ups?/g, 'pushup flexiones'], [/chin ?ups?/g, 'chinup dominadas'], [/lat pull ?down/g, 'pulldown jalon']];
const dist = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let mn = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < mn) mn = cur[j]; }
    if (mn > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};
const palabras = (t) => normTxt(t).replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter(Boolean);
export function textoEnIngles(x) {
  const k = normTxt(x.n);
  return ALIAS_EN[k] || x.en || (x.img ? String(x.img).replace(/[_-]+/g, ' ') : '');
}
// Devuelve los ejercicios que encajan con lo escrito, los más parecidos primero.
export function buscarEjercicios(items, q, extra = () => '') {
  let nq = normTxt(q).replace(/[^a-z0-9ñ ]+/g, ' ');
  for (const [re, to] of SINONIMOS) nq = nq.replace(re, to);
  const qs = nq.split(' ').filter(Boolean);
  if (!qs.length) return items;
  const out = [];
  for (const x of items) {
    const nombre = palabras(x.n), en = palabras(textoEnIngles(x)), otro = palabras(extra(x));
    const todas = [...nombre, ...en, ...otro];
    let score = 0, ok = true;
    for (const w of qs) {
      let best = 0;
      for (const t of todas) {
        if (t === w) best = Math.max(best, 100);
        else if (t.startsWith(w)) best = Math.max(best, 80);
        else if (w.length >= 3 && t.includes(w)) best = Math.max(best, 50);
        else if (w.length >= 4) { const m = w.length >= 7 ? 2 : 1; if (dist(w, t.slice(0, w.length + 1), m) <= m || dist(w, t, m) <= m) best = Math.max(best, 30); }
      }
      if (!best) { ok = false; break; }
      score += best;
    }
    if (!ok) continue;
    const nm = normTxt(x.n);
    if (nm === nq) score += 200; else if (nm.startsWith(nq)) score += 60;
    out.push([score, x]);
  }
  return out.sort((a, b) => b[0] - a[0]).map((o) => o[1]);
}
export const TODOS_EJERCICIOS = BIBLIOTECA.map((x) => x.n);
export const normTxt = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Ejercicios antiguos que se retiraron por estar repetidos en ExerciseDB (js/ejercicios-db.js): su nombre sigue enlazando con el nuevo.
const ALIAS_VIEJOS = Object.fromEntries(Object.entries(VIEJOS).map(([v, n]) => [normTxt(v), n]));
export const ejercicio = (n) => {
  if (!INDICE) { INDICE = new Map(); for (const x of todosEjercicios()) { const k = normTxt(x.n); if (!INDICE.has(k)) INDICE.set(k, x); } }
  const k = normTxt(n);
  const al = ALIAS_EJ[k] || ALIAS_VIEJOS[k];
  return INDICE.get(k) || (al ? INDICE.get(normTxt(al)) : null) || null;
};
// GIF de ExerciseDB del ejercicio (res 180 = miniaturas y tarjetas, 360 = ficha) o '' si aún no hay: entonces la tarjeta dibuja la figura propia.
export const imgDb = (x, res = 360) => { const id = x && IMGDB[x.n]; return id ? `/ejercicios/db/${id}-${res}.webp` : ''; };
// "ch,tr|sh" → { p: ['ch','tr'], s: ['sh'] }
export const musculosDet = (x) => { const [p = '', s = ''] = String((x && x.mu) || '').split('|'); return { p: p ? p.split(',') : [], s: s ? s.split(',') : [] }; };
// ── Recuperación muscular ──
// Grupos del carrusel → músculos del mapa. side: lado de la figura que mejor los muestra.
export const MUSC_GRUPOS = [
  { id: 'pecho', n: 'Pecho', m: ['ch'], side: 'front' },
  { id: 'espalda', n: 'Espalda', m: ['la', 'mb', 'lb', 'tp'], side: 'back' },
  { id: 'piernas', n: 'Piernas', m: ['qu', 'ha', 'gl', 'ca', 'ad', 'abd'], side: 'front' },
  { id: 'hombros', n: 'Hombros', m: ['sh'], side: 'front' },
  { id: 'brazos', n: 'Brazos', m: ['bi', 'tr', 'fo'], side: 'front' },
];
// Series efectivas por músculo de un entreno: principal 1/serie, secundario 0,5. La bici carga piernas por minutos.
export function seriesPorMusculo(w) {
  const o = {}, add = (k, v) => { o[k] = (o[k] || 0) + v; };
  for (const e of w.ejercicios || []) {
    if (exCardio(e)) { // cardio dentro del entreno: carga piernas por minutos, como la bici
      const mins = (e.series || []).reduce((a, s) => a + (Number(cv(s, 'min')) || 0), 0), v = Math.min(8, mins / 10);
      if (v > 0) { add('qu', v); add('gl', v / 2); add('ca', v); add('ha', v / 2); }
      continue;
    }
    const x = ejercicio(e.n), n = trabajo(e.series).length;
    if (!x || !n) continue;
    let { p, s } = musculosDet(x);
    if (!p.length && GRUPO_DET[x.m]) p = [GRUPO_DET[x.m]];
    p.forEach((k) => add(k, n)); s.forEach((k) => add(k, n / 2));
  }
  if (w.tipo === 'bici') { const v = Math.min(12, (Number(w.min) || 0) / 10); add('qu', v); add('gl', v); add('ca', v); add('ha', v / 2); }
  return o;
}
// ── Fatiga real por músculo ──
// No cuenta solo series: pesa cuánto te acercaste al fallo (RIR), cuánta carga usaste respecto a tu mejor marca de ese
// ejercicio y si hubo drop-sets. Sin RIR apuntado se supone un esfuerzo medio.
const ESF_RIR = [1, 0.85, 0.7, 0.55, 0.4]; // RIR 0, 1, 2, 3, 4 o más
export const esfuerzoSerie = (s) => {
  const r = s && s.rir != null && s.rir !== '' ? Math.round(Number(s.rir)) : null;
  const e = r == null || !(r >= 0) ? 0.65 : ESF_RIR[Math.min(4, r)];
  return s && s.isDropSet ? Math.min(1.15, e + 0.15) : e;
};
// 1RM estimado de una serie (Brzycki hasta 12 reps, Epley por encima).
const e1rmSerie = (kg, reps) => {
  kg = Number(kg); reps = Math.round(Number(reps));
  if (!(kg > 0) || !(reps >= 1)) return 0;
  return reps <= 12 ? kg * (36 / (37 - reps)) : kg * (1 + Math.min(reps, 30) / 30);
};
// Mejor 1RM estimado de cada ejercicio en todo el historial.
function mejoresE1RM(ws) {
  const m = new Map();
  for (const w of ws || []) for (const e of w.ejercicios || []) {
    if (exCardio(e)) continue;
    const k = canon(e.n).toLowerCase();
    for (const s of trabajo(e.series)) { const v = e1rmSerie(s.kg, s.reps); if (v > (m.get(k) || 0)) m.set(k, v); }
  }
  return m;
}
// Peso de la carga: 0,7 (≤50 % de tu mejor marca) → 1,3 (≥95 %). Sin peso (cuerpo) o sin marca → 1.
const factorCarga = (kg, mejor) => {
  kg = Number(kg);
  if (!(kg > 0) || !(mejor > 0)) return 1;
  return 0.7 + 0.6 * Math.max(0, Math.min(1, (Math.min(1, kg / mejor) - 0.5) / 0.45));
};
// Carga de un entreno por músculo: { k: { S (esfuerzo), n (series efectivas), rirS, rirN } }
function cargaEntreno(w, mejores) {
  const o = {}, get = (k) => (o[k] || (o[k] = { S: 0, n: 0, rirS: 0, rirN: 0 }));
  for (const e of w.ejercicios || []) {
    if (exCardio(e)) { // cardio dentro del entreno: carga piernas por minutos, más suave que la fuerza
      const v = Math.min(8, (e.series || []).reduce((a, s) => a + (Number(cv(s, 'min')) || 0), 0) / 10) * 0.6;
      if (v > 0) { get('qu').S += v; get('gl').S += v / 2; get('ca').S += v; get('ha').S += v / 2; }
      continue;
    }
    const x = ejercicio(e.n), series = trabajo(e.series);
    if (!x || !series.length) continue;
    let { p, s } = musculosDet(x);
    if (!p.length && GRUPO_DET[x.m]) p = [GRUPO_DET[x.m]];
    const mejor = mejores.get(canon(e.n).toLowerCase()) || 0;
    for (const q of series) {
      const f = esfuerzoSerie(q) * factorCarga(q.kg, mejor), tieneRir = q.rir != null && q.rir !== '';
      const dar = (k, peso) => { const c = get(k); c.S += f * peso; c.n += peso; if (tieneRir) { c.rirS += Number(q.rir) * peso; c.rirN += peso; } };
      p.forEach((k) => dar(k, 1)); s.forEach((k) => dar(k, 0.5));
    }
  }
  if (w.tipo === 'bici') { const v = Math.min(12, (Number(w.min) || 0) / 10) * 0.6; if (v > 0) { get('qu').S += v; get('gl').S += v; get('ca').S += v; get('ha').S += v / 2; } }
  return o;
}
// Análisis completo para el mapa del cuerpo.
//  rec[k]  → % de recuperación (0–100) de lo que aún no está al 100 %.
//  sem[k]  → 0‑1: esfuerzo acumulado en los últimos 7 días (≈10 de esfuerzo = máximo).
//  info[k] → { series (efectivas, 7 días), rir (medio de la última sesión o null), horas (para recuperarse del todo), fecha (último entreno) }
// Un entreno deja una fatiga inicial de 0‑100 % según su esfuerzo (F0 = 100·(1 − e^(−S/3,2))) que se va a 0 en 24‑72 h (más cuanto más fatiga);
// si hay varios entrenos recientes, la fatiga se combina. Hoy cuenta como «hace un momento»; otros días, las 12:00.
export function analisisMusculos(ws, ahora = new Date(), hoy = toISO(ahora)) {
  const mejores = mejoresE1RM(ws), desde = addDays(hoy, -6), resto = {}, tot = {}, info = {};
  for (const w of ws || []) {
    if (!w.fecha || w.fecha > hoy) continue;
    const h = w.fecha === hoy ? 0 : Math.max(0, (ahora - new Date(`${w.fecha}T12:00:00`)) / 36e5);
    for (const [k, c] of Object.entries(cargaEntreno(w, mejores))) {
      const i = info[k] || (info[k] = { series: 0, rir: null, horas: 0, fecha: '' });
      if (w.fecha >= desde) { tot[k] = (tot[k] || 0) + c.S; i.series += c.n; }
      if (w.fecha >= i.fecha) { i.fecha = w.fecha; i.rir = c.rirN ? c.rirS / c.rirN : null; }
      const F0 = 100 * (1 - Math.exp(-c.S / 3.2)), T = 24 + 48 * (F0 / 100);
      if (h < T && F0 > 0.5) { resto[k] = (resto[k] ?? 1) * (1 - (F0 * (1 - h / T)) / 100); i.horas = Math.max(i.horas, T - h); }
    }
  }
  const rec = {}, sem = {};
  for (const k of Object.keys(resto)) rec[k] = 100 * resto[k];
  for (const k of Object.keys(tot)) sem[k] = Math.min(1, tot[k] / 10);
  return { rec, sem, info };
}
// % de recuperación por músculo (solo los que aún no están al 100).
export const recuperacion = (ws, ahora = new Date()) => analisisMusculos(ws, ahora).rec;
// % de un grupo = el del músculo peor recuperado
export const recGrupo = (rec, g) => Math.round(Math.min(...g.m.map((k) => rec[k] ?? 100)));
// Intensidad 0‑1 por músculo con el esfuerzo de los últimos 7 días (hoy incluido).
export const semana = (ws, hoy) => analisisMusculos(ws, new Date(`${hoy}T12:00:00`), hoy).sem;
// ¿Tiene sentido hacerlo con un lado cada vez? (máquinas, poleas, mancuernas…; no barras ni los que ya son a una mano)
export function puedeUnilateral(n) {
  const x = ejercicio(n);
  if (!x || /una (mano|pierna)|altern|por lado|unilateral|búlgara|zancada|step-up|pistol/i.test(x.n)) return false;
  return ['maquina', 'polea', 'mancuernas', 'kettlebell', 'banda'].includes(x.eq);
}
const tieneEq = (x, eq) => (!eq || x.eq === 'corporal' || eq.includes(x.eq) ? 1 : 0);

// Alternativas: primero las del mismo movimiento, luego las del mismo músculo; antes las que puedes hacer con tu equipo.
export function alternativas(e, usados = [], equipo = null, todas = false) {
  const x = ejercicio(e.n);
  if (!x) return [];
  const u = new Set(usados.map(normTxt));
  const libres = todosEjercicios().filter((y) => normTxt(y.n) !== normTxt(e.n) && !u.has(normTxt(y.n)));
  // Mismo movimiento si lo conocemos; si no, los principales del mismo músculo.
  const mismo = x.p ? libres.filter((y) => y.p === x.p) : libres.filter((y) => y.m === x.m && y.base);
  const musculo = todas ? libres.filter((y) => y.m === x.m && !mismo.includes(y)) : [];
  const ord = (l) => l.sort((a, b) => tieneEq(b, equipo) - tieneEq(a, equipo) || (b.base ? 1 : 0) - (a.base ? 1 : 0));
  return [...ord(mismo), ...ord(musculo)].map((y) => y.n);
}

// Ejercicios que se miden en tiempo o por lado.
const REPS_FIJAS = {
  'Plancha': '30-45 s', 'Plancha lateral': '30 s por lado', 'Dead bug': '10 por lado', 'Bird dog': '10 por lado', 'Pallof press': '10 por lado',
  'Pallof press con banda': '10 por lado', 'Leñador en polea': '10 por lado', 'Mountain climbers': '30 s', 'Russian twist': '20',
  'Zancadas': '10 por pierna', 'Zancadas caminando': '10 por pierna', 'Zancada inversa': '10 por pierna', 'Zancadas con barra': '8 por pierna',
  'Zancadas con peso corporal': '12 por pierna', 'Sentadilla búlgara': '8-10 por pierna', 'Step-up al cajón': '10 por pierna',
  'Peso muerto a una pierna': '8 por pierna', 'Gemelos a una pierna': '12 por pierna', 'Hip thrust a una pierna': '10 por pierna',
  'Paseo del granjero': '40 m', 'Jalón a una mano': '10 por brazo', 'Remo con mancuerna': '10 por brazo', 'Curl concentrado': '10 por brazo',
};
const REPS_OBJ = { fuerza: '8-12', grasa: '10-15', rend: '5-8', general: '8-12' };
const SERIES_EXP = { nuevo: 3, meses: 3, anio: 4, anios: 4, compite: 4 };
export function nuevoEjercicio(n, kind, exp) {
  const x = ejercicio(n);
  if (tipoEjercicio(x) === 'cardio') return x.cm === 'cinta'
    ? { n, m: 'cardio', series: 1, reps: '20 min', intervalos: [{ tiempo: 20, velocidad: '', inclinacion: '' }] }
    : { n, m: 'cardio', series: 1, reps: '20 min' };
  return { n, m: x ? x.m : '', series: SERIES_EXP[exp] || 3, reps: REPS_FIJAS[n] || (exp === 'nuevo' ? '10-12' : REPS_OBJ[kind] || '8-12') };
}
// Al cambiar un ejercicio por otro, ajusta las repeticiones si uno se mide en tiempo o por lado.
export function repsPara(nuevo, actual, kind) {
  if (REPS_FIJAS[nuevo]) return REPS_FIJAS[nuevo];
  if (Object.values(REPS_FIJAS).includes(actual)) return REPS_OBJ[kind] || '8-12';
  return actual;
}

/* ---------- divisiones de fuerza ---------- */
export const SPLITS = {
  ppl: { t: 'Push · Pull · Legs', s: 'Empuje, tirón y pierna en días distintos' },
  tp: { t: 'Torso / Pierna', s: 'Alternas tren superior e inferior' },
  full: { t: 'Cuerpo completo', s: 'Todo el cuerpo en cada sesión' },
  weider: { t: 'Un músculo por día', s: 'Pecho, espalda, pierna, hombro y brazos (Weider)' },
  cicl: { t: 'Fuerza para ciclistas', s: 'Pierna, glúteo y core para pedalear con más fuerza' },
  dep: { t: 'Fuerza para deporte', s: 'Pierna, potencia y core para rendir en tu deporte' },
  auto: { t: 'No lo sé, elige tú', s: 'La app decide según tus días y objetivos' },
};
export const SES_FUERZA = {
  push: { n: 'Push · Empuje', p: ['empuje_h', 'empuje_v', 'empuje_h', 'elev_lat', 'triceps', 'aperturas', 'triceps'], m: ['pecho', 'hombro', 'triceps'] },
  pull: { n: 'Pull · Tirón', p: ['tiron_v', 'tiron_h', 'tiron_h', 'posterior', 'biceps', 'biceps', 'antebrazo'], m: ['espalda', 'biceps', 'hombro', 'antebrazo'] },
  legs: { n: 'Legs · Pierna', p: ['rodilla', 'bisagra', 'unilateral', 'cuad_iso', 'femoral', 'gemelos', 'core'], m: ['cuadriceps', 'femoral', 'gluteo', 'gemelos', 'core'] },
  torso: { n: 'Torso', p: ['empuje_h', 'tiron_h', 'empuje_v', 'tiron_v', 'biceps', 'triceps', 'elev_lat'], m: ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'] },
  pierna: { n: 'Pierna', p: ['rodilla', 'bisagra', 'unilateral', 'femoral', 'gluteo', 'gemelos', 'core'], m: ['cuadriceps', 'femoral', 'gluteo', 'gemelos', 'core'] },
  full: { n: 'Cuerpo completo A', p: ['rodilla', 'empuje_h', 'tiron_h', 'bisagra', 'elev_lat', 'core', 'biceps'], m: ['cuadriceps', 'pecho', 'espalda', 'femoral', 'hombro', 'core'] },
  fullB: { n: 'Cuerpo completo B', p: ['bisagra', 'empuje_v', 'tiron_v', 'unilateral', 'triceps', 'core', 'gemelos'], m: ['femoral', 'hombro', 'espalda', 'cuadriceps', 'triceps', 'core'] },
  fullC: { n: 'Cuerpo completo C', p: ['unilateral', 'empuje_h', 'tiron_v', 'gluteo', 'biceps', 'core', 'posterior'], m: ['cuadriceps', 'pecho', 'espalda', 'gluteo', 'biceps', 'core'] },
  pecho: { n: 'Pecho y tríceps', p: ['empuje_h', 'empuje_h', 'aperturas', 'empuje_h', 'aperturas', 'triceps', 'triceps'], m: ['pecho', 'triceps'] },
  espalda: { n: 'Espalda y bíceps', p: ['tiron_v', 'tiron_h', 'tiron_h', 'tiron_v', 'biceps', 'biceps', 'posterior'], m: ['espalda', 'biceps'] },
  hombro: { n: 'Hombro y core', p: ['empuje_v', 'elev_lat', 'elev_lat', 'posterior', 'empuje_v', 'core', 'core'], m: ['hombro', 'core'] },
  brazos: { n: 'Brazos', p: ['biceps', 'triceps', 'biceps', 'triceps', 'biceps', 'triceps', 'antebrazo'], m: ['biceps', 'triceps', 'antebrazo'] },
  cicl: { n: 'Fuerza para ciclistas', p: ['rodilla', 'bisagra', 'unilateral', 'gluteo', 'gemelos', 'core', 'core'], m: ['cuadriceps', 'gluteo', 'femoral', 'gemelos', 'core'] },
};
export function splitOrden(split, nF, kind) {
  if (split === 'ppl') return ['push', 'pull', 'legs'];
  if (split === 'tp') return ['torso', 'pierna'];
  if (split === 'full') return ['full', 'fullB', 'fullC'];
  if (split === 'weider') return ['pecho', 'espalda', 'legs', 'hombro', 'brazos'];
  if (split === 'cicl') return ['cicl', 'fullB'];
  if (split === 'dep') return ['pierna', 'fullB', 'torso'];
  if (kind === 'rend') return ['cicl', 'fullB', 'torso'];
  if (nF <= 2) return ['full', 'fullB'];
  if (nF === 3) return kind === 'fuerza' ? ['push', 'pull', 'legs'] : ['full', 'fullB', 'fullC'];
  if (nF === 4) return ['torso', 'pierna'];
  return ['push', 'pull', 'legs'];
}
// Equipo que eliges en el asistente → equipo de los ejercicios (null = gimnasio completo).
export function expandirEquipo(sel) {
  if (!sel || !sel.length || sel.includes('gym')) return null;
  const out = new Set();
  for (const s of sel) {
    if (s === 'maquina') { out.add('maquina'); out.add('polea'); out.add('multipower'); }
    else if (s !== 'ninguno') out.add(s);
  }
  return [...out];
}
function elegir(p, usados, equipo, evitar = [], eqPrevio = null) {
  const c = BIBLIOTECA.filter((x) => x.p === p && !usados.includes(x.n) && tieneEq(x, equipo));
  if (!c.length) return null;
  const sinRepetir = c.filter((x) => !evitar.includes(x.n));
  const base = sinRepetir.length ? sinRepetir : c;
  return (eqPrevio && base.find((x) => x.eq !== eqPrevio)) || base[0];
}
// cfg: { exp, equipo (ya expandido) }
// evitar: ejercicios de una sesión anterior con el mismo enfoque, para que los días repetidos tengan variantes.
export function sesionFuerza(key, kind, cfg = {}, evitar = []) {
  const def = SES_FUERZA[key];
  const max = { nuevo: 4, meses: 5 }[cfg.exp] || 6;
  const usados = [], ej = [], eqPorPatron = {};
  for (const p of def.p) {
    if (ej.length >= max) break;
    const x = elegir(p, usados, cfg.equipo, evitar, eqPorPatron[p]);
    if (!x) continue;
    usados.push(x.n); eqPorPatron[p] = x.eq;
    ej.push(nuevoEjercicio(x.n, kind, cfg.exp));
  }
  const rep = evitar.length > 0;
  return { t: 'fuerza', nombre: rep && !/ [ABC]$/.test(def.n) ? def.n + ' B' : def.n, foco: key, ej };
}
export const musculosDe = (foco) => (SES_FUERZA[foco] ? SES_FUERZA[foco].m : []);

/* ---------- sesiones de bici y cardio ---------- */
export const SES_BICI = [
  { id: 'b-int-sub', n: 'Intervalos en subida', d: 'Calienta 15 min. 5 × 4 min fuerte subiendo, con 3 min suaves entre medias. Vuelta a la calma 10 min.', min: 70, km: 28, cat: 'calidad' },
  { id: 'b-tempo', n: 'Tempo sostenido', d: 'Calienta 15 min. 2 × 20 min a ritmo exigente pero constante, con 5 min suaves entre bloques.', min: 75, km: 32, cat: 'calidad' },
  { id: 'b-sprint', n: 'Sprints cortos', d: 'Calienta 20 min. 8 × 30 s a tope con 4 min muy suaves. Termina suave.', min: 60, km: 25, cat: 'calidad' },
  { id: 'b-rodillo', n: 'Intervalos en rodillo', d: 'Calienta 10 min. 6 × 3 min fuerte con 2 min suaves. Ideal si llueve.', min: 50, cat: 'calidad' },
  { id: 'b-z2', n: 'Zona 2 constante', d: 'Ritmo en el que puedes hablar sin ahogarte. Mejor por terreno llano o con poca pendiente.', min: 75, km: 35, cat: 'base' },
  { id: 'b-cadencia', n: 'Técnica de cadencia', d: 'Rodaje suave con 6 × 2 min a cadencia alta (más de 100 pedaladas por minuto).', min: 60, km: 28, cat: 'base' },
  { id: 'b-recup', n: 'Recuperación', d: 'Muy suave, piernas sueltas. Si te cuesta hablar, vas demasiado rápido.', min: 45, km: 20, cat: 'base' },
  { id: 'b-fondo', n: 'Fondo largo', d: 'Salida larga a ritmo cómodo. Come algo cada 45 min y bebe a menudo.', min: 150, km: 90, cat: 'fondo' },
  { id: 'b-fondo-puertos', n: 'Fondo con puertos', d: 'Salida larga enlazando subidas a ritmo controlado, sin cebarte en ninguna.', min: 180, km: 85, cat: 'fondo' },
];
export const SES_CARDIO = [
  { id: 'c-correr', n: 'Carrera suave', d: 'Ritmo cómodo: puedes hablar mientras corres.', min: 40, km: 6, cat: 'base' },
  { id: 'c-eliptica', n: 'Elíptica continua', d: 'Ritmo moderado y constante.', min: 40, cat: 'base' },
  { id: 'c-remo', n: 'Remo continuo', d: 'Ritmo constante, espalda recta y empujando con las piernas.', min: 30, cat: 'base' },
  { id: 'c-caminata', n: 'Caminata en cuesta', d: 'Cinta inclinada al 8-12 % a paso rápido.', min: 45, cat: 'base' },
  { id: 'c-series', n: 'Series de carrera', d: 'Calienta 10 min. 6 × 2 min rápido con 2 min trotando.', min: 40, km: 5, cat: 'calidad' },
  { id: 'c-hiit-remo', n: 'Intervalos de remo', d: 'Calienta 5 min. 8 × 1 min fuerte con 1 min suave.', min: 30, cat: 'calidad' },
  { id: 'c-hiit-eliptica', n: 'Intervalos en elíptica', d: 'Calienta 5 min. 10 × 1 min fuerte con 1 min suave.', min: 35, cat: 'calidad' },
  { id: 'c-largo', n: 'Tirada larga', d: 'Rodaje largo a ritmo cómodo. Hidrátate y no te pases de ritmo: tienes que poder hablar.', min: 70, km: 12, cat: 'fondo' },
  { id: 'c-tempo-run', n: 'Tempo run', d: 'Calienta 10 min. 20 min a ritmo exigente pero constante. Vuelta a la calma 10 min.', min: 45, km: 8, cat: 'calidad' },
  { id: 'c-cuestas', n: 'Cuestas', d: 'Calienta 15 min. 8 × 45 s cuesta arriba fuerte, bajando trotando. Vuelta a la calma 10 min.', min: 45, km: 6, cat: 'calidad' },
  { id: 'c-recup-run', n: 'Trote de recuperación', d: 'Muy suave, en conversación. Piernas sueltas.', min: 30, km: 4, cat: 'base' },
  { id: 'c-comba', n: 'Comba por intervalos', d: '10 × 1 min de comba con 1 min de descanso.', min: 25, cat: 'calidad' },
];
const BICI_ORDEN = {
  rend: ['b-fondo', 'b-int-sub', 'b-tempo', 'b-recup', 'b-sprint', 'b-cadencia', 'b-z2'],
  grasa: ['b-fondo', 'b-z2', 'b-rodillo', 'b-cadencia', 'b-recup', 'b-tempo', 'b-z2'],
  fuerza: ['b-z2', 'b-recup', 'b-fondo', 'b-cadencia', 'b-z2', 'b-recup', 'b-z2'],
  general: ['b-fondo', 'b-z2', 'b-cadencia', 'b-tempo', 'b-recup', 'b-z2', 'b-z2'],
};
// Si lo que entrenas es correr, las sesiones de cardio son de carrera.
const RUN_ORDEN = ['c-correr', 'c-series', 'c-largo', 'c-recup-run', 'c-tempo-run', 'c-cuestas', 'c-correr'];
const ESCALA_EXP = { nuevo: 0.7, meses: 0.85, anio: 1, anios: 1.1, compite: 1.25 };
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
function sesionLib(t, id) { const s = sesionPorId(id); const o = { t, nombre: s.n, min: s.min, ses: s.id }; if (s.km) o.km = s.km; return o; }
// Ajusta tiempo y km de una sesión de bici o cardio a tu experiencia (múltiplos de 5 min y de 1 km).
function escalarSesion(o, exp) {
  const f = ESCALA_EXP[exp] || 1;
  if (o.min) o.min = Math.max(20, Math.round((o.min * f) / 5) * 5);
  if (o.km) o.km = Math.max(2, Math.round(o.km * f));
  return o;
}

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
  if (t === 'fuerza') return { t, nombre: 'Fuerza', ej: [] };
  if (t === 'bici' || t === 'cardio') return { t, nombre: RTIPOS[t], min: 60, ses: null };
  return { t: 'otro', nombre: otro || 'Otro', min: 60, det: '' };
}
export function sesionPorDefecto(t, kind, otro, cfg = {}) {
  if (t === 'fuerza') return sesionFuerza(splitOrden(cfg.split, 1, kind)[0], kind, cfg);
  if (t === 'bici') return sesionLib('bici', BICI_ORDEN[kind][1]);
  if (t === 'cardio') return sesionLib('cardio', CARDIO_ORDEN[kind][0]);
  return sesionVacia('otro', otro);
}

// cfg = { tipos: ['fuerza','bici',...], dias: [0,2,4], otro: 'Pádel', split, exp, equipo }
export function proponerRutina(cfg, goals) {
  const kind = planKind(goals);
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, kind);
  const nB = seq.filter((t) => t === 'bici').length;
  const bici = BICI_ORDEN[kind].slice(0, nB).sort((a, b) => (sesionPorId(a).cat === 'fondo') - (sesionPorId(b).cat === 'fondo'));
  const cardio = cfg.run ? RUN_ORDEN : CARDIO_ORDEN[kind];
  const nF = seq.filter((t) => t === 'fuerza').length;
  const fOrd = splitOrden(cfg.split, nF, kind);
  let fi = 0, bi = 0, ci = 0;
  const previas = {};
  const sesiones = {};
  dias.forEach((d, i) => {
    const t = seq[i];
    if (t === 'fuerza') {
      const key = fOrd[fi++ % fOrd.length];
      const ses = sesionFuerza(key, kind, cfg, previas[key] || []);
      previas[key] = [...(previas[key] || []), ...ses.ej.map((e) => e.n)];
      sesiones[d] = ses;
    }
    else if (t === 'bici') sesiones[d] = cfg.escalar ? escalarSesion(sesionLib('bici', bici[bi++ % bici.length]), cfg.exp) : sesionLib('bici', bici[bi++ % bici.length]);
    else if (t === 'cardio') sesiones[d] = cfg.escalar ? escalarSesion(sesionLib('cardio', cardio[ci++ % cardio.length]), cfg.exp) : sesionLib('cardio', cardio[ci++ % cardio.length]);
    else sesiones[d] = sesionVacia('otro', cfg.otro);
  });
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propuesta', split: cfg.split || 'auto', exp: cfg.exp || '', equipo: cfg.equipo || null, sesiones };
}
export function rutinaVacia(cfg, goals) {
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, planKind(goals));
  const sesiones = {};
  dias.forEach((d, i) => { sesiones[d] = sesionVacia(seq[i], cfg.otro); });
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propia', split: cfg.split || 'auto', exp: cfg.exp || '', equipo: cfg.equipo || null, sesiones };
}
