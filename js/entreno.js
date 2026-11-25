import { IMG_CUR, EXTRA, IMGDB, DBX, VIEJOS } from './ejercicios.js';
import { CICLISMO } from './config.js';
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
// Series hechas y kilos movidos de un entreno de fuerza (kg × reps; ×2 con carga «por lado»; unilateral = Izquierda + Derecha, ver volumenSerie).
// Las series de calentamiento (w: true) se guardan en el historial pero NO cuentan en series, volumen, récords, 1RM ni fatiga.
export const trabajo = (series) => (series || []).filter((s) => !(s && s.w));
// Los bloques de cardio (ejercicio con tipo 'cardio') no son series de fuerza: no cuentan en series ni volumen.
const deFuerza = (w) => (w.ejercicios || []).filter((e) => !exCardio(e));
export const seriesDe = (w) => deFuerza(w).reduce((a, e) => a + trabajo(e.series).length, 0);
// ---- Cómo se apunta el peso (43) ----
// `uni` (Ambos lados | Unilateral) solo decide la ESTRUCTURA: Ambos lados = una fila por serie; Unilateral = dos filas por serie, Izquierda (kg, reps) y Derecha (kgD, repsD).
// `carga` ('total' | 'por_lado') dice QUÉ es el kg que se escribe: 'total' = todo el peso movido; 'por_lado' = el de un lado (una mancuerna, un brazo de la máquina…).
// Volumen: Ambos lados + total → kg × reps; Ambos lados + por_lado → kg × 2 × reps; Unilateral → cada lado por separado (I + D), sin importar la carga.
// Mancuernas de DOS a la vez → 'por_lado' por defecto; el resto (barra, máquinas, poleas…) → 'total'. Los ejercicios de UNA sola mancuerna (goblet, pullover, un brazo…) → 'total'.
const UNA_MANCUERNA = /mancuerna(?!s)|\ba una (mano|pierna)\b|goblet|concentrad/i;
export const dosMancuernas = (n) => { const x = ejercicio(n); return !!x && x.eq === 'mancuernas' && !UNA_MANCUERNA.test(x.n); };
export const cargaDefecto = (n) => (dosMancuernas(n) ? 'por_lado' : 'total');
// Clave estable de un ejercicio para guardar su preferencia de carga en el perfil (`cargaEj`): nombre oficial sin tildes ni signos.
export const claveEj = (n) => normTxt(canon(n)).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
// Carga con la que se apuntó un ejercicio guardado: la suya si la tiene; si no (entrenos anteriores), la de por defecto de ese ejercicio.
export const cargaDe = (e) => (e && (e.carga === 'por_lado' || e.carga === 'total') ? e.carga : cargaDefecto(e && e.n));
const hayD = (v) => v != null && String(v).trim() !== '';
// Lados de una serie: [Izquierda] o, si lleva Derecha, [Izquierda, Derecha]. Lo que falte en la Derecha se toma de la Izquierda (series unilaterales antiguas: «por lado», mismo peso y reps).
export const ladosSerie = (s, parse = Number) => {
  const I = { kg: parse(s.kg) || 0, reps: parse(s.reps) || 0 };
  return [I, { kg: hayD(s.kgD) ? parse(s.kgD) || 0 : I.kg, reps: hayD(s.repsD) ? parse(s.repsD) || 0 : I.reps }];
};
// Volumen de UNA serie de un ejercicio e = { n, uni, carga } (parse convierte textos con coma en el entreno en vivo).
export function volumenSerie(s, e, parse = Number) {
  const [I, D] = ladosSerie(s, parse);
  if (e && e.uni) return I.kg * I.reps + D.kg * D.reps;
  return I.kg * I.reps * (cargaDe(e) === 'por_lado' ? 2 : 1);
}
// Series «planas» para récords y 1RM: en unilateral cuentan los dos lados.
const seriesLados = (e) => trabajo(e.series).flatMap((s) => (e.uni ? ladosSerie(s) : [{ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }]));
export const volumenDe = (w) => deFuerza(w).reduce((a, e) => a + trabajo(e.series).reduce((b, s) => b + volumenSerie(s, e), 0), 0);
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

/* ---------- mover entreno a otro día de la semana (Pro; sustituye al «salvavidas de racha») ---------- */
// Lista guardada en el perfil (campo `salvavidas`, se mantiene el nombre por compatibilidad):
// [{ de: 'AAAA-MM-DD' (día original de la sesión), a: 'AAAA-MM-DD' (día al que se movió) }].
// Ese «de» pasa a contar como descanso (no rompe la racha) y «a» hereda la sesión. Se guardan como mucho SALV_MAX.
// Una sesión ya movida se puede volver a mover: se sustituye su entrada (sigue habiendo una sola por sesión, con el «de» original).
export const SALV_MAX = 60;
export const salvLista = (p) => (Array.isArray(p && p.salvavidas) ? p.salvavidas.filter((x) => x && typeof x.de === 'string' && typeof x.a === 'string') : []);
// ¿Se puede mover la sesión del día `dia` y a qué días? plan(iso) → sesión prevista YA con los movimientos aplicados; hechos = Set de fechas con entreno.
// Origen: un día de ESTA semana con sesión prevista y sin entreno (perdido, de hoy o futuro). Destino: un día de esta semana desde hoy, de descanso y sin entreno.
// null → no hay nada que mover (no se muestra el botón). { ok: true, destinos: [iso…] } → se puede. { ok: false, msg } → se explica por qué no.
export function moverDestinos(dia, hoy, plan, hechos) {
  if (mondayOf(dia) !== mondayOf(hoy) || !plan(dia) || hechos.has(dia)) return null;
  const lun = mondayOf(hoy), destinos = [];
  for (let i = 0; i < 7; i++) { const d = addDays(lun, i); if (d >= hoy && d !== dia && !plan(d) && !hechos.has(d)) destinos.push(d); }
  return destinos.length ? { ok: true, destinos } : { ok: false, msg: 'No te quedan días de descanso libres en esta semana.' };
}
// Lista nueva tras mover la sesión del día `dia` al día `destino`. Si `dia` ya era un destino de otra entrada, se reubica esa (el «de» original no cambia);
// si se devuelve a su día original, la entrada desaparece.
export function aplicarMover(lista, dia, destino) {
  const e = lista.find((x) => x.a === dia), resto = e ? lista.filter((x) => x !== e) : lista, de = e ? e.de : dia;
  return (destino === de ? resto : [...resto, { de, a: destino }]).slice(-SALV_MAX);
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
        const e = map.get(key) || { key, n: ej.n.trim(), veces: 0, best: null, last: '', orm: null };
        e.veces++;
        if (w.fecha > e.last) { e.last = w.fecha; e.carga = cargaDe(ej); e.uni = !!ej.uni; } // cómo se apuntó la última vez (para leer el 1RM: total, c/u o por lado)
        for (const s of seriesLados(ej)) {
          const reps = s.reps || 0, kg = s.kg || 0;
          if (!reps) continue;
          const score = kg > 0 ? kg * (1 + reps / 30) : reps; // orden de la «mejor serie» (Epley; también decide los PR): no es el 1RM que se enseña
          if (!e.best || score > e.best.score) e.best = { kg, reps, score, fecha: w.fecha };
          // 1RM estimado: la MISMA fórmula y rango que el entreno en vivo (orm1, Brzycki, 1–12 reps). En unilateral cuenta cada lado; el kg es el escrito (por lado si la carga es por lado).
          const v = orm1(kg, reps);
          if (v != null && (!e.orm || v > e.orm.v)) e.orm = { v, kg, reps, fecha: w.fecha };
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
export function mejor1RM(series, parse = Number, uni = false) {
  let best = null;
  for (const s of trabajo(series)) for (const l of (uni ? ladosSerie(s, parse) : [{ kg: parse(s.kg), reps: parse(s.reps) }])) { const v = orm1(l.kg, l.reps); if (v != null && (best == null || v > best)) best = v; }
  return best;
}
// Calculadora de discos: qué discos poner en CADA lado de la barra para llegar a `pesoTotal` (kg) con una barra de `barraKg` (0 = máquina o sin barra)
// y los discos `disponibles` (kg, sin límite de unidades). Si el peso no es exacto, da el más cercano alcanzable (a igual distancia, el de abajo).
// → { porLado: [{ kg, n }] (de más pesado a más ligero), pesoPorLado, pesoReal (barra + 2 × lado), diferencia (real − pedido), menorQueBarra }.
export function calcularDiscos(pesoTotal, barraKg = 20, disponibles = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const U = 0.05, u = (x) => Math.round(x / U); // todo en unidades de 50 g (1,25 kg = 25) para no arrastrar errores de coma flotante
  const r2 = (x) => Math.round(x * 100) / 100;
  const total = Math.max(0, Number(pesoTotal) || 0), barra = Math.max(0, Number(barraKg) || 0);
  const discos = [...new Set((disponibles || []).map(Number).filter((d) => d > 0 && d <= 100).map((d) => u(d)))].sort((a, b) => b - a);
  if (total < barra) return { porLado: [], pesoPorLado: 0, pesoReal: barra, diferencia: r2(barra - total), menorQueBarra: true };
  const obj = u((total - barra) / 2), tope = obj + (discos[0] || 0);
  // Mínimo número de discos para cada peso por lado alcanzable (0..tope); `de` guarda el último disco puesto para reconstruir.
  const min = new Array(tope + 1).fill(Infinity), de = new Array(tope + 1).fill(0);
  min[0] = 0;
  for (let s = 1; s <= tope; s++) for (const d of discos) if (d <= s && min[s - d] + 1 < min[s]) { min[s] = min[s - d] + 1; de[s] = d; }
  let mejor = 0;
  for (let s = 0; s <= tope; s++) if (min[s] < Infinity && Math.abs(s - obj) < Math.abs(mejor - obj)) mejor = s;
  const cuenta = new Map();
  for (let s = mejor; s > 0; s -= de[s]) cuenta.set(de[s], (cuenta.get(de[s]) || 0) + 1);
  const porLado = [...cuenta].sort((a, b) => b[0] - a[0]).map(([d, n]) => ({ kg: r2(d * U), n }));
  const pesoPorLado = r2(mejor * U), pesoReal = r2(barra + 2 * pesoPorLado);
  return { porLado, pesoPorLado, pesoReal, diferencia: r2(pesoReal - total), menorQueBarra: false };
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
    for (const s of seriesLados(e)) { const v = e1rmSerie(s.kg, s.reps); if (v > (m.get(k) || 0)) m.set(k, v); }
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
  if (todas) {
    // Biblioteca (botón «Cambiar»): mismo movimiento primero y después el mismo grupo muscular. Dentro de cada bloque van antes los que
    // comparten más músculos principales (y secundarios) con el original, los de su mismo equipo y los que puedes hacer con tu material.
    const px = musculosDet(x), nComp = (a, b) => a.filter((k) => b.includes(k)).length;
    const puntos = (y) => { const my = musculosDet(y); return nComp(my.p, px.p) * 20 + nComp(my.s, px.s) * 3 + (y.eq === x.eq ? 8 : 0) + tieneEq(y, equipo) * 6 + (y.base ? 2 : 0); };
    const ordP = (l) => l.map((y) => [puntos(y), y]).sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n)).map((o) => o[1]);
    const resto = libres.filter((y) => y.m === x.m && !mismo.includes(y));
    return [...ordP(mismo), ...ordP(resto)].map((y) => y.n);
  }
  const ord = (l) => l.sort((a, b) => tieneEq(b, equipo) - tieneEq(a, equipo) || (b.base ? 1 : 0) - (a.base ? 1 : 0));
  return ord(mismo).map((y) => y.n);
}

// Ejercicios que se miden en tiempo o por lado.
const REPS_FIJAS = {
  'Plancha': '30-45 s', 'Plancha lateral': '30 s por lado', 'Dead bug': '10 por lado', 'Bird dog': '10 por lado', 'Pallof press': '10 por lado',
  'Pallof press con banda': '10 por lado', 'Leñador en polea': '10 por lado', 'Mountain climbers': '30 s', 'Russian twist': '20',
  'Zancadas': '10 por pierna', 'Zancadas caminando': '10 por pierna', 'Zancada inversa': '10 por pierna', 'Zancadas con barra': '8 por pierna',
  'Zancadas con peso corporal': '12 por pierna', 'Sentadilla búlgara': '8-10 por pierna', 'Step-up al cajón': '10 por pierna',
  'Peso muerto a una pierna': '8 por pierna', 'Gemelos a una pierna': '12 por pierna', 'Hip thrust a una pierna': '10 por pierna',
  'Paseo del granjero': '40 m', 'Abducción en máquina': '12-15', 'Abducción con banda': '15-20', 'Patada de glúteo en polea': '12-15 por pierna', 'Puente de glúteo': '12-15', 'Jalón a una mano': '10 por brazo', 'Remo con mancuerna': '10 por brazo', 'Curl concentrado': '10 por brazo',
};
const REPS_OBJ = { fuerza: '8-12', grasa: '10-15', rend: '5-8', general: '8-12' };
const SERIES_EXP = { nuevo: 3, meses: 3, anio: 4, anios: 4, compite: 4 };
// Los accesorios (bíceps, tríceps, laterales, gemelos, core…) llevan una serie menos que los ejercicios principales según el nivel.
const SERIES_ACC = { nuevo: 2, meses: 3, anio: 3, anios: 3, compite: 3 };
export function nuevoEjercicio(n, kind, exp) {
  const x = ejercicio(n);
  if (tipoEjercicio(x) === 'cardio') return ejercicioCardio(n, x, kind, exp);
  const acc = !!(x && x.p && ACCESORIOS.has(x.p));
  const series = (acc ? SERIES_ACC[exp] : SERIES_EXP[exp]) || 3;
  return { n, m: x ? x.m : '', series, reps: REPS_FIJAS[n] || (exp === 'nuevo' ? '10-12' : REPS_OBJ[kind] || '8-12') };
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
  cicl: { n: CICLISMO ? 'Fuerza para ciclistas' : 'Pierna y core', p: ['rodilla', 'bisagra', 'unilateral', 'gluteo', 'gemelos', 'core', 'core'], m: ['cuadriceps', 'gluteo', 'femoral', 'gemelos', 'core'] },
  // Sesiones con énfasis en tren inferior (enfoque glúteo/pierna). Un hueco «patrón:Ejercicio|Alternativa» pide ese ejercicio concreto
  // (si el material y el nivel lo permiten) y, si no, cualquiera del patrón.
  gluIsq: { n: 'Glúteo e isquios', p: ['gluteo:Hip thrust|Hip thrust con mancuerna|Puente de glúteo', 'bisagra:Peso muerto rumano|Peso muerto con mancuernas', 'femoral:Curl femoral tumbado|Curl femoral sentado|Curl femoral con fitball', 'unilateral:Zancada inversa|Zancadas con peso corporal', 'gluteo:Abducción en máquina|Abducción con banda', 'gemelos:Elevación de gemelos de pie|Gemelos con mancuernas', 'core:Plancha'], m: ['gluteo', 'femoral', 'gemelos', 'core'] },
  cuadGlu: { n: 'Cuádriceps y glúteo', p: ['rodilla:Sentadilla con barra|Sentadilla goblet|Prensa de piernas', 'unilateral:Sentadilla búlgara|Zancadas|Zancadas con peso corporal', 'rodilla:Prensa de piernas|Hack squat|Sentadilla con peso corporal', 'gluteo:Hip thrust a una pierna|Patada de glúteo en polea|Puente de glúteo', 'cuad_iso:Extensión de cuádriceps', 'gluteo:Patada de glúteo en polea|Abducción con banda|Abducción en máquina', 'gemelos:Gemelos en prensa|Elevación de gemelos de pie'], m: ['cuadriceps', 'gluteo', 'gemelos'] },
  lowerFull: { n: 'Pierna completa', p: ['rodilla:Prensa de piernas|Sentadilla goblet', 'bisagra:Peso muerto rumano|Peso muerto con mancuernas', 'gluteo:Hip thrust|Hip thrust con mancuerna|Puente de glúteo', 'unilateral:Step-up al cajón|Zancadas caminando|Zancadas con peso corporal', 'femoral', 'gluteo:Abducción con banda|Patada de glúteo en polea|Abducción en máquina', 'core:Dead bug|Plancha lateral'], m: ['cuadriceps', 'femoral', 'gluteo', 'core'] },
  // Torso ligero y equilibrado: tonifica sin sobrecargar la parte superior.
  torsoL: { n: 'Torso · Tonificación', p: ['tiron_v:Jalón al pecho|Dominadas asistidas', 'empuje_h:Press con mancuernas|Press de pecho en máquina|Flexiones', 'tiron_h:Remo en polea baja|Remo en máquina|Remo con mancuerna', 'elev_lat:Elevaciones laterales', 'triceps:Extensión con cuerda|Extensión de tríceps en polea', 'biceps:Curl de bíceps con mancuernas|Curl martillo'], m: ['espalda', 'pecho', 'hombro', 'triceps', 'biceps'] },
  // Cuerpo completo con énfasis en glúteo/pierna (para 1-2 días de fuerza a la semana).
  fullG: { n: 'Cuerpo completo · Glúteo', p: ['gluteo:Hip thrust|Hip thrust con mancuerna|Puente de glúteo', 'rodilla:Prensa de piernas|Sentadilla goblet|Sentadilla con peso corporal', 'tiron_v:Jalón al pecho|Dominadas asistidas', 'empuje_h:Press con mancuernas|Press de pecho en máquina|Flexiones', 'bisagra:Peso muerto rumano|Peso muerto con mancuernas', 'elev_lat:Elevaciones laterales', 'core:Plancha'], m: ['gluteo', 'cuadriceps', 'espalda', 'pecho', 'femoral', 'core'] },
  fullG2: { n: 'Cuerpo completo · Pierna', p: ['bisagra:Peso muerto rumano|Peso muerto con mancuernas', 'unilateral:Sentadilla búlgara|Zancadas|Zancadas con peso corporal', 'tiron_h:Remo en polea baja|Remo en máquina|Remo con mancuerna', 'empuje_v:Press de hombro en máquina|Press con mancuernas sentado', 'gluteo:Abducción en máquina|Patada de glúteo en polea|Abducción con banda', 'femoral', 'core:Dead bug|Plancha lateral'], m: ['femoral', 'cuadriceps', 'gluteo', 'espalda', 'hombro', 'core'] },
};
// Enfoque de la semana: 'inferior' (glúteo y pierna), 'superior' (pecho, espalda, hombros, brazos) o 'equilibrado'.
// cfg.prio = lo que eligió la persona ('inferior' | 'torso' | 'brazos' | 'equilibrado'); sin elegir, manda el sexo: la mujer parte del enfoque glúteo/pierna.
export function enfoqueDe(cfg = {}) {
  if (cfg.prio === 'inferior') return 'inferior';
  if (cfg.prio === 'torso' || cfg.prio === 'brazos') return 'superior';
  if (cfg.prio === 'equilibrado') return 'equilibrado';
  return cfg.sexo === 'mujer' ? 'inferior' : 'equilibrado';
}
// Orden de sesiones de fuerza de la semana. ctx = { enfoque, prio } (solo se usa con split «auto»).
// Regla: el tren inferior nunca se queda en frecuencia 1 si hay 4 o más días de fuerza, y con enfoque glúteo/pierna llega a 2-3.
export function splitOrden(split, nF, kind, ctx = {}) {
  if (split === 'ppl') return ['push', 'pull', 'legs'];
  if (split === 'tp') return ['torso', 'pierna'];
  if (split === 'full') return ['full', 'fullB', 'fullC'];
  if (split === 'weider') return ['pecho', 'espalda', 'legs', 'hombro', 'brazos'];
  if (split === 'cicl') return ['cicl', 'fullB'];
  if (split === 'dep') return ['pierna', 'fullB', 'torso'];
  if (kind === 'rend') return ['cicl', 'fullB', 'torso'];
  const enf = ctx.enfoque || 'equilibrado';
  if (enf === 'inferior') {
    if (nF <= 1) return ['fullG'];
    if (nF === 2) return ['fullG', 'fullG2']; // 2 días: pierna/glúteo 2 veces, con torso en cada uno
    if (nF === 3) return ['gluIsq', 'torsoL', 'cuadGlu']; // pierna ×2, torso ×1
    if (nF === 4) return ['gluIsq', 'torsoL', 'cuadGlu', 'torsoL']; // pierna ×2, torso ×2
    return ['gluIsq', 'torsoL', 'cuadGlu', 'torsoL', 'lowerFull', 'hombro']; // 5-6+: pierna ×3, torso ×2-3
  }
  if (enf === 'superior') {
    const extra = ctx.prio === 'brazos' ? 'brazos' : 'torso';
    if (nF <= 2) return ['full', 'fullB'];
    if (nF === 3) return ['push', 'pull', 'legs'];
    if (nF === 4) return ['push', 'pull', 'pierna', extra];
    if (nF === 5) return ['push', 'pull', 'legs', 'torso', extra === 'torso' ? 'hombro' : extra];
    return ['push', 'pull', 'legs', 'push', 'pull', 'pierna'];
  }
  if (nF <= 2) return ['full', 'fullB'];
  if (nF === 3) return kind === 'fuerza' ? ['push', 'pull', 'legs'] : ['full', 'fullB', 'fullC'];
  if (nF === 4) return ['torso', 'pierna'];
  if (nF === 5) return ['push', 'pull', 'legs', 'torso', 'pierna']; // pierna ×2 (antes quedaba en ×1)
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
// Ejercicios de técnica exigente: a quien empieza se le ofrecen al final (primero máquinas y variantes guiadas).
const COMPLEJOS = new Set(['Sentadilla con barra', 'Sentadilla frontal', 'Peso muerto convencional', 'Peso muerto sumo', 'Peso muerto con barra hexagonal', 'Buenos días', 'Remo Pendlay',
  'Zancadas con barra', 'Press militar', 'Dominadas', 'Dominadas supinas', 'Fondos en paralelas', 'Curl nórdico', 'Sissy squat', 'Press landmine', 'Swing con kettlebell', 'Press declinado', 'Sentadilla búlgara']);
// Preferencias por patrón para quien empieza (la primera disponible con su material).
const PREF_NUEVO = {
  tiron_v: ['Jalón al pecho', 'Dominadas asistidas'], empuje_h: ['Press de pecho en máquina', 'Press con mancuernas', 'Flexiones'], empuje_v: ['Press de hombro en máquina', 'Press con mancuernas sentado'],
  rodilla: ['Prensa de piernas', 'Sentadilla goblet', 'Sentadilla con peso corporal'], tiron_h: ['Remo en polea baja', 'Remo en máquina', 'Remo con mancuerna'], bisagra: ['Peso muerto rumano', 'Peso muerto con mancuernas'],
  unilateral: ['Zancadas con peso corporal', 'Zancada inversa', 'Step-up al cajón'], core: ['Plancha', 'Dead bug'], femoral: ['Curl femoral tumbado', 'Curl femoral sentado'],
};
// Accesorios (menos series que los ejercicios principales).
const ACCESORIOS = new Set(['biceps', 'triceps', 'elev_lat', 'gemelos', 'core', 'aperturas', 'posterior', 'antebrazo']);
// slot = «patron» o «patron:Ejercicio preferido|Alternativa». simple = nivel principiante (evita lo técnico).
function elegir(slot, usados, equipo, evitar = [], eqPrevio = null, simple = false) {
  const [p, pref] = String(slot).split(':');
  const c = BIBLIOTECA.filter((x) => x.p === p && !usados.includes(x.n) && tieneEq(x, equipo));
  if (!c.length) return null;
  const sinRepetir = c.filter((x) => !evitar.includes(x.n));
  let base = sinRepetir.length ? sinRepetir : c;
  if (simple) base = [...base.filter((x) => !COMPLEJOS.has(x.n)), ...base.filter((x) => COMPLEJOS.has(x.n))];
  const prefs = pref ? pref.split('|') : simple ? PREF_NUEVO[p] || [] : [];
  for (const n of prefs) {
    const x = base.find((y) => y.n === n);
    if (x && !(simple && COMPLEJOS.has(n))) return x;
  }
  return (eqPrevio && base.find((x) => x.eq !== eqPrevio)) || base[0];
}
/* ---------- duración de la sesión (Fase B paso 4, (73)) ---------- */
// Minutos por sesión (los mismos de `minutosSesion` del cuestionario; 90 = 90 o más). Sin dato o con un valor raro: 60 (comportamiento de siempre).
export const MINUTOS = [15, 30, 45, 60, 90];
export const minutosDe = (m) => (MINUTOS.includes(Number(m)) ? Number(m) : 60);
// Volumen por duración. `n` = ejercicios de fuerza por sesión; `max` = tope de series (null = las de siempre: 3-4 principales y 2-3 accesorios por nivel);
// `acc` = series de los accesorios. A 60 min manda el nivel (como antes: principiante 4, unos meses 5, intermedio/avanzado 6, compite 7);
// por debajo nunca pasa de lo que tendría a 60 (un principiante no hace más ejercicios en 45 min que en 60). A 90: 8 (7 si empieza).
export function volumenSesion(minutos, exp) {
  const m = minutosDe(minutos), base = { nuevo: 4, meses: 5, compite: 7 }[exp] || 6;
  if (m === 15) return { minutos: m, n: Math.min(3, base), max: 3, acc: 2, basicos: true };
  if (m === 30) return { minutos: m, n: Math.min(4, base), max: 3, acc: null, basicos: true };
  if (m === 45) return { minutos: m, n: Math.min(5, base), max: 3, acc: null, basicos: false };
  if (m === 90) return { minutos: m, n: exp === 'nuevo' || exp === 'meses' ? 7 : 8, max: null, acc: null, basicos: false };
  return { minutos: m, n: base, max: null, acc: null, basicos: false };
}
const esAccesorio = (slot) => ACCESORIOS.has(String(slot).split(':')[0]);
// cfg: { exp, equipo (ya expandido), minutos }
// evitar: ejercicios de una sesión anterior con el mismo enfoque, para que los días repetidos tengan variantes.
// Con 15-30 min se eligen primero los básicos del día (patrones multiarticulares) y después los accesorios; con 90 min, si los huecos del día
// no llegan, se da una segunda vuelta a los mismos patrones con otras variantes (nunca el mismo ejercicio dos veces en la sesión).
export function sesionFuerza(key, kind, cfg = {}, evitar = [], repite = evitar.length > 0) {
  const def = SES_FUERZA[key];
  const vol = volumenSesion(cfg.minutos, cfg.exp), max = vol.n;
  const simple = cfg.exp === 'nuevo' || cfg.exp === 'meses';
  const orden = vol.basicos ? [...def.p.filter((x) => !esAccesorio(x)), ...def.p.filter(esAccesorio)] : [...def.p];
  const slots = vol.minutos === 90 && max > orden.length ? [...orden, ...orden] : orden; // a 60 min o menos, los huecos de siempre
  const usados = [], ej = [], eqPorPatron = {};
  for (const slot of slots) {
    if (ej.length >= max) break;
    const p = String(slot).split(':')[0];
    const x = elegir(slot, usados, cfg.equipo, evitar, eqPorPatron[p], simple);
    if (!x) continue;
    usados.push(x.n); eqPorPatron[p] = x.eq;
    const e = nuevoEjercicio(x.n, kind, cfg.exp);
    if (vol.max) e.series = Math.min(e.series, ACCESORIOS.has(x.p) && vol.acc ? vol.acc : vol.max);
    ej.push(e);
  }
  return { t: 'fuerza', nombre: repite && !/ [ABC]$/.test(def.n) ? def.n + ' B' : def.n, foco: key, ej };
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
// Pone a una sesión de cardio sus parámetros concretos (máquina, tiempo, velocidad, pendiente o resistencia y por qué) según tu nivel y objetivo.
// El tiempo pasa a ser el de la pauta y se quitan los km de la biblioteca (ya no cuadrarían con ese tiempo).
export function aplicarGuia(o, ctx = {}) {
  const g = o.t === 'cardio' && o.ses ? guiaDeSesion(o.ses, ctx) : null;
  if (!g) { delete o.guia; return o; }
  o.guia = g.guia; o.min = g.min; delete o.km;
  return o;
}
// Ajusta tiempo y km de una sesión de bici o cardio a tu experiencia (múltiplos de 5 min y de 1 km).
function escalarSesion(o, exp) {
  const f = ESCALA_EXP[exp] || 1;
  if (o.min) o.min = Math.max(20, Math.round((o.min * f) / 5) * 5);
  if (o.km) o.km = Math.max(2, Math.round(o.km * f));
  return o;
}

/* ---------- pautas concretas de cardio (máquina, tiempo, velocidad, pendiente/resistencia y por qué) ---------- */
// Nivel → tramo: 0 = empieza (nuevo / meses), 1 = intermedio (1 año), 2 = avanzado (varios años / compite). Sin nivel conocido se parte del 0.
const tramoDe = (exp) => (exp === 'compite' || exp === 'anios' ? 2 : exp === 'anio' ? 1 : 0);
// Por qué ese ritmo, según el objetivo del plan. «base» = esfuerzo continuo y suave; «int» = intervalos.
const POR_BASE = {
  grasa: 'Ritmo de zona 2 (puedes hablar sin ahogarte): gastas grasa y cuidas el corazón sin fatigar las piernas ni frenar tu recuperación muscular.',
  fuerza: 'Esfuerzo suave que cuida tu corazón y ayuda a recuperar entre sesiones de fuerza, sin quitarle energía a tu entrenamiento de pesas.',
  rend: 'Base aeróbica con poca fatiga: mejora tu resistencia sin comprometer las sesiones de calidad.',
  general: 'Ritmo cómodo y constante: mejora tu salud cardiovascular y tu resistencia sin acumular fatiga.',
};
const POR_INT = {
  grasa: 'Los intervalos gastan más en menos tiempo y ayudan a conservar músculo; las pausas suaves evitan que llegues agotado a la siguiente serie.',
  fuerza: 'Intervalos cortos para mejorar tu capacidad cardiovascular; mantenlos en pocos días para no restar recuperación muscular.',
  rend: 'Los intervalos suben tu velocidad y tu umbral; respeta las pausas suaves para llegar fresco a la siguiente serie.',
  general: 'Alternar esfuerzo y descanso mejora tu resistencia en poco tiempo y se hace más llevadero que un ritmo fuerte constante.',
};
const nfs = (v) => String(v).replace('.', ',');
// Cada pauta: maq (qué máquina o actividad), min (minutos por defecto por tramo), items ([etiqueta, valor] por tramo) y plan (valores numéricos para la cinta).
const PAUTAS = {
  caminata: { maq: 'Cinta inclinada', int: false, min: [20, 25, 30], plan: { vel: [5.2, 5.8, 6.2], inc: [9, 11, 12] }, fin: [15, 20, 20],
    items: (t) => [['Tiempo', ['15-20', '20-30', '25-35'][t] + ' min'], ['Velocidad', ['5,0-5,5', '5,5-6,0', '6,0-6,5'][t] + ' km/h'], ['Pendiente', ['8-10', '10-12', '12-15'][t] + ' %']] },
  correr: { maq: 'Cinta o calle · carrera suave', int: false, min: [20, 30, 35], plan: { vel: [7, 8, 9.5], inc: [1, 1, 1] }, fin: [15, 20, 20],
    items: (t) => [['Tiempo', ['15-20', '25-30', '30-40'][t] + ' min'], ['Velocidad', ['6,5-7,5', '7,5-9,0', '8,5-10,5'][t] + ' km/h'], ['Pendiente', '1 % (en cinta)']] },
  eliptica: { maq: 'Elíptica', int: false, min: [20, 30, 35], fin: [15, 20, 20],
    items: (t) => [['Tiempo', ['15-20', '25-30', '30-40'][t] + ' min'], ['Cadencia', ['50-55', '55-65', '60-70'][t] + ' zancadas/min'], ['Resistencia', ['nivel 3-4', 'nivel 5-6', 'nivel 6-8'][t] + ' (de 10)']] },
  bici: { maq: 'Bicicleta estática', int: false, min: [20, 30, 40], fin: [15, 20, 20],
    items: (t) => [['Tiempo', ['15-20', '25-30', '30-45'][t] + ' min'], ['Cadencia', ['70-80', '75-90', '80-95'][t] + ' pedaladas/min'], ['Resistencia', ['nivel 3-4', 'nivel 4-6', 'nivel 5-7'][t] + ' (de 10)']] },
  remo: { maq: 'Remo (máquina)', int: false, min: [15, 25, 30], fin: [10, 15, 15],
    items: (t) => [['Tiempo', ['10-15', '20-25', '25-30'][t] + ' min'], ['Cadencia', ['18-20', '20-24', '22-26'][t] + ' paladas/min'], ['Resistencia', ['nivel 3-4', 'nivel 4-5', 'nivel 5-6'][t] + ' (de 10)']] },
  aire: { maq: 'Caminata rápida al aire libre', int: false, min: [20, 30, 40], fin: [15, 20, 20],
    items: (t) => [['Tiempo', ['15-20', '25-30', '30-40'][t] + ' min'], ['Ritmo', ['5,0-5,5', '5,5-6,0', '6,0-6,5'][t] + ' km/h (paso rápido)'], ['Terreno', 'llano o con alguna cuesta suave']] },
  recup: { maq: 'Trote suave (cinta o calle)', int: false, min: [25, 30, 30],
    items: (t) => [['Tiempo', ['20-25', '25-30', '25-30'][t] + ' min'], ['Velocidad', ['6,0-7,0', '6,5-7,5', '7,0-8,0'][t] + ' km/h'], ['Pendiente', '1 % (en cinta)']] },
  largo: { maq: 'Rodaje largo (cinta o calle)', int: false, min: [45, 70, 85],
    items: (t) => [['Tiempo', ['40-50', '60-70', '75-90'][t] + ' min'], ['Velocidad', ['6,5-7,5', '7,0-8,5', '8,0-9,5'][t] + ' km/h'], ['Pendiente', '1 % (en cinta)']] },
  series: { maq: 'Series de carrera (cinta o pista)', int: true, min: [30, 40, 45],
    items: (t) => [['Calentamiento', '10 min a 6,0 km/h'], ['Series', ['5 × 1 min a 8,0-9,0', '6 × 2 min a 10-11', '8 × 2 min a 11-13'][t] + ' km/h'], ['Recuperación', '1-2 min andando a 5,5-6,5 km/h']] },
  tempo: { maq: 'Tempo run (cinta o calle)', int: true, min: [35, 45, 50],
    items: (t) => [['Calentamiento', '10 min a 6,5 km/h'], ['Bloque', ['2 × 8 min a 8,0-9,0', '20 min a 10-11', '25 min a 11-12,5'][t] + ' km/h'], ['Vuelta a la calma', '5-10 min a 6,0 km/h']] },
  cuestas: { maq: 'Cuestas (cinta o calle)', int: true, min: [30, 45, 45],
    items: (t) => [['Calentamiento', '10 min a 6,0 km/h'], ['Subidas', ['5 × 30 s', '8 × 45 s', '10 × 60 s'][t] + ' al ' + ['5-6', '7-8', '8-10'][t] + ' %'], ['Bajada', 'andando 90 s a 4,5 km/h (0 %)']] },
  'hiit-remo': { maq: 'Intervalos de remo', int: true, min: [25, 30, 35],
    items: (t) => [['Calentamiento', '5 min suave (18 paladas/min)'], ['Series', ['6 × 40 s', '8 × 1 min', '10 × 1 min'][t] + ' a 24-28 paladas/min'], ['Recuperación', '1 min suave (16-18 paladas/min)']] },
  'hiit-eliptica': { maq: 'Intervalos en elíptica', int: true, min: [25, 35, 40],
    items: (t) => [['Calentamiento', '5 min suave'], ['Series', ['6 × 40 s', '8 × 1 min', '10 × 1 min'][t] + ' con resistencia ' + ['5-6', '6-7', '7-8'][t]], ['Recuperación', '1 min suave (resistencia 3)']] },
  comba: { maq: 'Comba', int: true, min: [20, 25, 25],
    items: (t) => [['Trabajo', ['8', '10', '12'][t] + ' × 1 min de comba'], ['Descanso', '1 min entre series'], ['Ritmo', 'saltos pequeños, sin llegar a ahogarte']] },
};
// Sesiones de la biblioteca de cardio (SES_CARDIO) → pauta.
const PAUTA_DE_SESION = { 'c-caminata': 'caminata', 'c-correr': 'correr', 'c-eliptica': 'eliptica', 'c-remo': 'remo', 'c-series': 'series', 'c-hiit-remo': 'hiit-remo', 'c-hiit-eliptica': 'hiit-eliptica',
  'c-largo': 'largo', 'c-tempo-run': 'tempo', 'c-cuestas': 'cuestas', 'c-recup-run': 'recup', 'c-comba': 'comba' };
// Devuelve { guia: { maq, items, por }, min, plan: { vel, inc } } o null. clave = id de pauta; ctx = { exp, kind, fin } (fin = al final de una sesión de fuerza: más corto).
export function guiaCardio(clave, ctx = {}) {
  const P = PAUTAS[clave];
  if (!P) return null;
  const t = tramoDe(ctx.exp), kind = POR_BASE[ctx.kind] ? ctx.kind : 'general';
  const min = ctx.fin && P.fin ? P.fin[t] : P.min[t];
  // items = [{ k: etiqueta, v: valor }] (Firestore no admite arrays dentro de arrays)
  const items = P.items(t).map(([a, b]) => ({ k: a, v: ctx.fin && a === 'Tiempo' && P.fin ? `${P.fin[t] - 5}-${P.fin[t]} min` : b }));
  const plan = P.plan ? { vel: P.plan.vel[t], inc: P.plan.inc[t] } : {};
  return { guia: { maq: P.maq, items, por: (P.int ? POR_INT : POR_BASE)[kind] }, min, plan };
}
export const guiaDeSesion = (id, ctx) => (PAUTA_DE_SESION[id] ? guiaCardio(PAUTA_DE_SESION[id], ctx) : null);
// Pauta para un ejercicio de cardio de la biblioteca (cinta, bici, elíptica, remo, aire libre…).
export function guiaEjercicio(n, ctx = {}) {
  const x = ejercicio(n), cm = x && x.cm ? x.cm : modoCardio(n), nom = String(n);
  let clave;
  if (cm === 'cinta') {
    // «Caminadora / Cinta de correr» es genérica: caminata inclinada si buscas grasa o empiezas; carrera suave solo con nivel y otro objetivo.
    const generica = /caminadora/i.test(nom), nov = ['nuevo', 'meses'].includes(ctx.exp) || !ctx.exp;
    clave = generica ? (ctx.kind === 'grasa' || nov ? 'caminata' : 'correr') : /correr|carrera/i.test(nom) ? 'correr' : 'caminata';
  }
  else if (cm === 'estatica') clave = /el[ií]ptica/i.test(nom) ? 'eliptica' : /remo/i.test(nom) ? 'remo' : /bici/i.test(nom) ? 'bici' : /escalad/i.test(nom) ? 'eliptica' : 'bici';
  else clave = /correr|carrera|trote/i.test(nom) ? 'correr' : 'aire';
  const g = guiaCardio(clave, ctx);
  if (g && clave === 'correr' && cm === 'aire') { g.guia.maq = 'Carrera suave al aire libre'; g.guia.items = g.guia.items.map((q) => (q.k === 'Pendiente' ? { k: 'Terreno', v: 'llano o con cuestas suaves' } : q)); }
  return g;
}
// Bloque de cardio dentro de una rutina de fuerza (o añadido desde la biblioteca): con minutos, pauta y, en la cinta, el intervalo ya rellenado.
function ejercicioCardio(n, x, kind, exp, fin = false) {
  const g = guiaEjercicio(n, { exp, kind, fin });
  const min = g ? g.min : 20;
  const base = { n, m: 'cardio', series: 1, reps: `${min} min` };
  if (x && x.cm === 'cinta') base.intervalos = [{ tiempo: min, velocidad: g && g.plan.vel ? g.plan.vel : '', inclinacion: g && g.plan.inc != null ? g.plan.inc : '' }];
  if (g) base.guia = g.guia;
  return base;
}
// Cardio al final de una sesión de fuerza: cinta si hay máquinas (o gimnasio completo); si no, caminata rápida al aire libre.
export function cardioFinal(kind, cfg = {}) {
  const maquinas = !cfg.equipo || cfg.equipo.includes('maquina');
  const n = maquinas ? CINTA : 'Correr al aire libre';
  const x = ejercicio(n);
  if (maquinas) return ejercicioCardio(n, x, kind, cfg.exp, true);
  const g = guiaCardio('aire', { exp: cfg.exp, kind, fin: true });
  return { n, m: 'cardio', series: 1, reps: `${g.min} min`, int: 'caminata', guia: g.guia };
}
const SESION_INFERIOR = new Set(['gluIsq', 'cuadGlu', 'lowerFull', 'legs', 'pierna', 'cicl', 'fullG2']);

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
  rend: CICLISMO ? 'Prioriza la calidad en bici o cardio (intervalos y fondo) y fuerza específica para tener más potencia.' : 'Prioriza la calidad en cardio (intervalos y fondo) y fuerza específica para tener más potencia.',
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
  if (t === 'fuerza') return sesionFuerza(splitOrden(cfg.split, 1, kind, { enfoque: enfoqueDe(cfg), prio: cfg.prio })[0], kind, cfg);
  if (t === 'bici') return sesionLib('bici', BICI_ORDEN[kind][1]);
  if (t === 'cardio') return aplicarGuia(sesionLib('cardio', CARDIO_ORDEN[kind][0]), { exp: cfg.exp, kind });
  return sesionVacia('otro', otro);
}

// cfg = { tipos: ['fuerza','bici',...], dias: [0,2,4], otro: 'Pádel', split, exp, equipo, sexo, prio, minutos (15|30|45|60|90; 60 por defecto) }
// Lee el perfil: sexo y prioridad deciden el enfoque (glúteo/pierna, torso o equilibrado) y por tanto cuántos días de pierna y de torso;
// el nivel decide ejercicios, series y complejidad; los objetivos, el tipo de plan y el cardio.
export function proponerRutina(cfg, goals) {
  const kind = planKind(goals), minutos = minutosDe(cfg.minutos);
  cfg = { ...cfg, minutos };
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, kind);
  const nB = seq.filter((t) => t === 'bici').length;
  const bici = BICI_ORDEN[kind].slice(0, nB).sort((a, b) => (sesionPorId(a).cat === 'fondo') - (sesionPorId(b).cat === 'fondo'));
  const cardio = cfg.run ? RUN_ORDEN : CARDIO_ORDEN[kind];
  const nF = seq.filter((t) => t === 'fuerza').length;
  const enfoque = enfoqueDe(cfg);
  const fOrd = splitOrden(cfg.split, nF, kind, { enfoque, prio: cfg.prio });
  let fi = 0, bi = 0, ci = 0;
  const previas = {}, vistas = {};
  const sesiones = {};
  const dFuerza = [];
  dias.forEach((d, i) => {
    const t = seq[i];
    if (t === 'fuerza') {
      const key = fOrd[fi++ % fOrd.length];
      const grupo = SESION_INFERIOR.has(key) ? 'inferior' : key; // los días de pierna comparten lo ya elegido: así no repiten los mismos ejercicios
      const ses = sesionFuerza(key, kind, cfg, previas[grupo] || [], vistas[key] > 0);
      vistas[key] = (vistas[key] || 0) + 1;
      previas[grupo] = [...(previas[grupo] || []), ...ses.ej.map((e) => e.n)];
      sesiones[d] = ses; dFuerza.push(d);
    }
    else if (t === 'bici') sesiones[d] = cfg.escalar ? escalarSesion(sesionLib('bici', bici[bi++ % bici.length]), cfg.exp) : sesionLib('bici', bici[bi++ % bici.length]);
    else if (t === 'cardio') {
      const o = sesionLib('cardio', cardio[ci++ % cardio.length]);
      sesiones[d] = guiaDeSesion(o.ses, { exp: cfg.exp, kind }) ? aplicarGuia(o, { exp: cfg.exp, kind }) : cfg.escalar ? escalarSesion(o, cfg.exp) : o;
    }
    else sesiones[d] = sesionVacia('otro', cfg.otro);
  });
  // Rutina solo de fuerza: añade cardio al final de algunas sesiones (con máquina, tiempo, velocidad y pendiente) si el objetivo es perder grasa
  // o si empiezas (1 sesión). Primero las sesiones que no son de pierna, para no cargar las piernas antes de entrenarlas.
  // Con 15 o 30 min por sesión no hay tiempo para el cardio final: no se añade (73).
  if (cfg.tipos.length === 1 && cfg.tipos[0] === 'fuerza' && dFuerza.length && minutos > 30) {
    const nCardio = Math.min(dFuerza.length, kind === 'grasa' ? (dFuerza.length >= 5 ? 3 : 2) : cfg.exp === 'nuevo' && kind !== 'rend' ? 1 : 0);
    const orden = [...dFuerza.filter((d) => !SESION_INFERIOR.has(sesiones[d].foco)), ...dFuerza.filter((d) => SESION_INFERIOR.has(sesiones[d].foco)).reverse()];
    orden.slice(0, nCardio).forEach((d) => sesiones[d].ej.push(cardioFinal(kind, cfg)));
  }
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propuesta', split: cfg.split || 'auto', exp: cfg.exp || '', equipo: cfg.equipo || null, prio: cfg.prio || '', minutos, sesiones };
}
export function rutinaVacia(cfg, goals) {
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const seq = repartir(cfg.tipos, dias.length, planKind(goals));
  const sesiones = {};
  dias.forEach((d, i) => { sesiones[d] = sesionVacia(seq[i], cfg.otro); });
  return { tipos: cfg.tipos, otro: cfg.otro || '', dias, modo: 'propia', split: cfg.split || 'auto', exp: cfg.exp || '', equipo: cfg.equipo || null, minutos: minutosDe(cfg.minutos), sesiones };
}

/* ================================================================== */
/* (76) Exportar e importar entrenos en CSV (Hevy, Strong y Cadencia) */
/* Todo puro: sin pantalla, sin Firebase. Lo prueban las pruebas de Node. */
/* ================================================================== */
export const CSV_COLUMNAS = ['fecha', 'rutina', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rir', 'carga', 'notas'];
const LB_KG = 0.45359237;

// Lector CSV (RFC 4180): comillas dobles, comillas escapadas (""), comas y saltos de línea dentro de comillas, BOM y CRLF.
// El separador se elige mirando la primera línea (coma, punto y coma o tabulador).
export function leerCSV(texto) {
  let t = String(texto == null ? '' : texto);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const linea1 = t.slice(0, Math.max(0, t.indexOf('\n')) || t.length);
  const cuenta = (c) => linea1.split(c).length - 1;
  const sep = [',', ';', '\t'].reduce((a, c) => (cuenta(c) > cuenta(a) ? c : a), ',');
  const filas = [];
  let fila = [], campo = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"' && campo === '') q = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  return filas;
}

// Un campo de CSV: entre comillas solo si hace falta.
const csvCampo = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const numCSV = (v) => (v == null || v === '' || !isFinite(Number(v)) ? '' : String(Math.round(Number(v) * 100) / 100));

// Historial → CSV de Cadencia (una fila por serie; números con punto, que es lo que leen Hevy, Strong y las hojas de cálculo en cualquier idioma).
// Unilateral: dos filas por serie con carga «izquierda» y «derecha». Cardio: tipo «cardio» y sus datos en notas («min=30; km=5»).
// Los entrenos que no son de fuerza (bici, cardio, otro) salen en una fila con ejercicio vacío y tipo = su tipo.
export function entrenosACSV(entrenos) {
  const out = [CSV_COLUMNAS.join(',')];
  const fila = (...c) => out.push(c.map(csvCampo).join(','));
  const ws = [...(entrenos || [])].filter((w) => w && w.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  for (const w of ws) {
    const nombre = w.nombre || TIPOS[w.tipo] || '';
    if (w.tipo !== 'gym') {
      const d = ['min', 'km', 'elev', 'pulso'].filter((k) => Number(w[k]) > 0).map((k) => `${k}=${numCSV(w[k])}`).join('; ');
      fila(w.fecha, nombre, '', '', w.tipo || 'otro', '', '', '', '', d);
      continue;
    }
    if (Number(w.min) > 0 && !(w.ejercicios || []).length) { fila(w.fecha, nombre, '', '', 'gym', '', '', '', '', `min=${numCSV(w.min)}`); continue; }
    for (const e of w.ejercicios || []) {
      const series = e.series || [];
      if (exCardio(e)) {
        series.forEach((s, j) => {
          const d = Object.keys(s || {}).filter((k) => k !== 'completada' && s[k] != null && s[k] !== '').map((k) => `${k}=${typeof s[k] === 'number' ? numCSV(s[k]) : String(s[k]).replace(/[;=]/g, ' ')}`).join('; ');
          fila(w.fecha, nombre, e.n, j + 1, 'cardio', '', '', '', '', d);
        });
        continue;
      }
      let n = 0;
      for (const s of series) {
        if (!s) continue;
        const tipo = s.w ? 'calentamiento' : s.isDropSet ? 'drop' : 'normal';
        const num = s.w ? '' : ++n;
        const rir = !s.w && s.rir != null && s.rir !== '' ? numCSV(s.rir) : '';
        const notas = s.isSuperset ? 'superserie' : '';
        if (e.uni && !s.w) {
          const [I, D] = ladosSerie(s);
          fila(w.fecha, nombre, e.n, num, tipo, numCSV(I.kg), numCSV(I.reps), rir, 'izquierda', notas);
          fila(w.fecha, nombre, e.n, num, tipo, numCSV((D || I).kg), numCSV((D || I).reps), rir, 'derecha', notas);
        } else fila(w.fecha, nombre, e.n, num, tipo, numCSV(s.kg), numCSV(s.reps), rir, s.w ? '' : cargaDe(e), notas);
      }
    }
  }
  return out.join('\r\n') + '\r\n';
}

// ---- Nombres en inglés (Hevy / Strong) → catálogo de Cadencia ----
// Clave = nombre en minúsculas sin tildes; «|equipo» = lo que va entre paréntesis («Bench Press (Barbell)» → «bench press|barbell»).
// Se busca primero con equipo y luego sin él. El destino tiene que existir en el catálogo (si no, se deja el nombre original).
const EQ_EN = { barbell: 'barbell', dumbbell: 'dumbbell', dumbbells: 'dumbbell', cable: 'cable', machine: 'machine', 'smith machine': 'smith', bodyweight: 'bodyweight', kettlebell: 'kettlebell', band: 'band', 'ez bar': 'ez' };
const NOMBRES_EN = {
  'bench press|barbell': 'Press banca', 'bench press': 'Press banca', 'bench press|dumbbell': 'Press con mancuernas', 'dumbbell bench press': 'Press con mancuernas',
  'bench press|smith': 'Press banca en multipower', 'chest press|machine': 'Press de pecho en máquina', 'chest press': 'Press de pecho en máquina',
  'incline bench press|barbell': 'Press inclinado con barra', 'incline bench press': 'Press inclinado con barra', 'incline bench press|dumbbell': 'Press inclinado con mancuernas', 'incline dumbbell press': 'Press inclinado con mancuernas',
  'decline bench press|barbell': 'Press declinado', 'decline bench press': 'Press declinado',
  'chest fly|dumbbell': 'Aperturas con mancuernas', 'dumbbell fly': 'Aperturas con mancuernas', 'chest fly': 'Aperturas con mancuernas', 'cable crossover': 'Cruce de poleas', 'cable fly crossovers': 'Cruce de poleas', 'cable fly': 'Cruce de poleas',
  'butterfly|pec deck': 'Contractora (pec deck)', 'pec deck': 'Contractora (pec deck)', 'chest fly|machine': 'Contractora (pec deck)',
  'push up': 'Flexiones', 'push-up': 'Flexiones', 'push ups': 'Flexiones', 'chest dip': 'Fondos en paralelas', 'triceps dip': 'Fondos en paralelas', 'dips': 'Fondos en paralelas', 'dip': 'Fondos en paralelas',
  'squat|barbell': 'Sentadilla con barra', 'squat': 'Sentadilla con barra', 'back squat': 'Sentadilla con barra', 'full squat': 'Sentadilla con barra', 'front squat|barbell': 'Sentadilla frontal', 'front squat': 'Sentadilla frontal',
  'goblet squat': 'Sentadilla goblet', 'hack squat|machine': 'Hack squat', 'hack squat': 'Hack squat', 'bulgarian split squat': 'Sentadilla búlgara', 'lunge|dumbbell': 'Zancadas', 'lunge': 'Zancadas', 'walking lunge': 'Zancadas',
  'leg press|machine': 'Prensa de piernas', 'leg press': 'Prensa de piernas', 'leg extension|machine': 'Extensión de cuádriceps', 'leg extension': 'Extensión de cuádriceps',
  'lying leg curl|machine': 'Curl femoral tumbado', 'lying leg curl': 'Curl femoral tumbado', 'leg curl': 'Curl femoral tumbado', 'seated leg curl|machine': 'Curl femoral sentado', 'seated leg curl': 'Curl femoral sentado',
  'deadlift|barbell': 'Peso muerto convencional', 'deadlift': 'Peso muerto convencional', 'conventional deadlift': 'Peso muerto convencional', 'sumo deadlift': 'Peso muerto sumo', 'sumo deadlift|barbell': 'Peso muerto sumo',
  'romanian deadlift|barbell': 'Peso muerto rumano', 'romanian deadlift': 'Peso muerto rumano', 'deadlift|dumbbell': 'Peso muerto con mancuernas', 'good morning|barbell': 'Buenos días', 'good morning': 'Buenos días',
  'hip thrust|barbell': 'Hip thrust', 'hip thrust': 'Hip thrust', 'glute bridge': 'Puente de glúteo', 'hip abduction|machine': 'Abducción en máquina', 'hip abduction': 'Abducción en máquina',
  'standing calf raise': 'Elevación de gemelos de pie', 'calf raise': 'Elevación de gemelos de pie', 'standing calf raise|machine': 'Elevación de gemelos de pie', 'seated calf raise': 'Elevación de gemelos sentado',
  'overhead press|barbell': 'Press militar', 'overhead press': 'Press militar', 'strict military press': 'Press militar', 'military press': 'Press militar', 'shoulder press|dumbbell': 'Press de hombros con mancuernas',
  'overhead press|dumbbell': 'Press de hombros con mancuernas', 'seated shoulder press|dumbbell': 'Press de hombros con mancuernas', 'shoulder press|machine': 'Press de hombro en máquina', 'arnold press|dumbbell': 'Press Arnold', 'arnold press': 'Press Arnold',
  'lateral raise|dumbbell': 'Elevaciones laterales', 'lateral raise': 'Elevaciones laterales', 'lateral raise|cable': 'Elevaciones laterales en polea', 'lateral raise|machine': 'Elevaciones laterales en máquina',
  'front raise|dumbbell': 'Elevaciones frontales', 'front raise': 'Elevaciones frontales', 'rear delt reverse fly|dumbbell': 'Pájaros con mancuernas', 'reverse fly|dumbbell': 'Pájaros con mancuernas', 'face pull': 'Face pull', 'face pull|cable': 'Face pull',
  'shrug|dumbbell': 'Encogimientos con mancuernas', 'dumbbell shrug': 'Encogimientos con mancuernas',
  'lat pulldown|cable': 'Jalón al pecho', 'lat pulldown': 'Jalón al pecho', 'lat pulldown|machine': 'Jalón al pecho', 'pull up': 'Dominadas', 'pull-up': 'Dominadas', 'pull ups': 'Dominadas', 'chin up': 'Dominadas supinas', 'chin-up': 'Dominadas supinas',
  'bent over row|barbell': 'Remo con barra', 'barbell row': 'Remo con barra', 'bent over row': 'Remo con barra', 'pendlay row|barbell': 'Remo Pendlay', 'pendlay row': 'Remo Pendlay', 't bar row': 'Remo T', 't-bar row': 'Remo T',
  'dumbbell row': 'Remo con mancuerna', 'bent over one arm row|dumbbell': 'Remo con mancuerna', 'single arm row|dumbbell': 'Remo con mancuerna', 'seated cable row': 'Remo en polea baja', 'seated row|cable': 'Remo en polea baja', 'seated cable row - v grip|cable': 'Remo en polea baja',
  'inverted row': 'Remo invertido', 'straight arm pulldown|cable': 'Jalón con brazos rectos con cuerda',
  'bicep curl|barbell': 'Curl con barra', 'barbell curl': 'Curl con barra', 'bicep curl|dumbbell': 'Curl de bíceps con mancuernas', 'dumbbell curl': 'Curl de bíceps con mancuernas', 'bicep curl|cable': 'Curl en polea',
  'hammer curl|dumbbell': 'Curl martillo', 'hammer curl': 'Curl martillo', 'preacher curl|barbell': 'Curl predicador', 'preacher curl': 'Curl predicador', 'concentration curl': 'Curl concentrado',
  'triceps pushdown': 'Extensión de tríceps en polea', 'triceps pushdown|cable': 'Extensión de tríceps en polea', 'tricep pushdown': 'Extensión de tríceps en polea', 'triceps rope pushdown': 'Extensión de tríceps en polea',
  'skullcrusher|barbell': 'Press francés', 'skullcrusher': 'Press francés', 'lying triceps extension': 'Press francés', 'triceps kickback|dumbbell': 'Patada de tríceps', 'triceps kickback': 'Patada de tríceps',
  'plank': 'Plancha', 'crunch': 'Crunch abdominal', 'hanging leg raise': 'Elevación de piernas colgado', 'russian twist': 'Russian twist', 'ab wheel': 'Rueda abdominal', 'kettlebell swing': 'Swing con kettlebell',
  'treadmill': CINTA, 'running (treadmill)': CINTA, 'running|treadmill': CINTA, 'running': 'Correr al aire libre', 'outdoor run': 'Correr al aire libre', 'cycling (indoor)': 'Bicicleta estática', 'cycling|indoor': 'Bicicleta estática', 'stationary bike': 'Bicicleta estática', 'spinning': 'Bicicleta estática',
};
// Nombre importado → nombre del catálogo si hay equivalencia clara; si no, el original tal cual (recortado a 80 caracteres).
export function nombreCatalogo(n) {
  const orig = String(n || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!orig) return '';
  const propio = ejercicio(orig);
  if (propio) return propio.n;
  const k = normTxt(orig).replace(/\s+/g, ' ');
  const m = k.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const base = m ? m[1].trim() : k, eq = m ? (EQ_EN[m[2].trim()] || m[2].trim()) : '';
  for (const clave of [eq ? base + '|' + eq : '', k, base]) {
    const destino = clave && NOMBRES_EN[clave];
    const x = destino && ejercicio(destino);
    if (x) return x.n;
  }
  return orig;
}

// ---- Fechas y números de los distintos formatos ----
const MESES = { jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12 };
const fechaOK = (y, m, d) => { const f = new Date(Date.UTC(y, m - 1, d)); return y >= 1990 && y <= 2100 && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; };
// Devuelve { fecha: 'YYYY-MM-DD', ms } (ms = minutos del día × 60000, para calcular duraciones) o null. La hora se toma tal cual viene (sin zonas horarias).
export function leerFechaCSV(v) {
  const s = String(v || '').trim();
  let y, mo, d, hh = 0, mi = 0, ss = 0, r;
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) [, y, mo, d, hh = 0, mi = 0, ss = 0] = r;
  else if ((r = s.match(/^(\d{1,2})\s+([A-Za-zé.]{3,5})\.?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) { [, d, mo, y, hh = 0, mi = 0, ss = 0] = r; mo = MESES[normTxt(mo).replace('.', '')]; }
  else if ((r = s.match(/^([A-Za-z]{3,5})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) { [, mo, d, y, hh = 0, mi = 0, ss = 0] = r; mo = MESES[normTxt(mo)]; }
  else if ((r = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) [, d, mo, y, hh = 0, mi = 0, ss = 0] = r;
  else return null;
  y = Number(y); mo = Number(mo); d = Number(d);
  if (!mo || !fechaOK(y, mo, d)) return null;
  return { fecha: `${y}-${pad(mo)}-${pad(d)}`, ms: Date.UTC(y, mo - 1, d, Number(hh), Number(mi), Number(ss)) };
}
// Número con punto o coma decimal («82,5», «82.5»); vacío o basura = NaN.
const numero = (v) => { const s = String(v == null ? '' : v).trim().replace(/\s/g, ''); if (!s) return NaN; const t = /,\d{1,3}$/.test(s) && !/\.\d/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); const n = Number(t); return isFinite(n) ? n : NaN; };
// Duración de Strong: «1h 5m», «45m», «30s» o segundos sueltos.
const duracionMin = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) / 60;
  const h = s.match(/(\d+)\s*h/), m = s.match(/(\d+)\s*m(?!s)/), sg = s.match(/(\d+)\s*s/);
  return h || m || sg ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) + (sg ? +sg[1] / 60 : 0) : NaN;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Huella corta y estable (FNV-1a) para que el id de un entreno importado sea siempre el mismo: importar dos veces sobrescribe en lugar de duplicar.
const huella = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
// Clave de duplicado: fecha + nombre de la rutina + número de ejercicios.
export const claveDuplicado = (w) => `${w.fecha}|${normTxt(w.nombre || '')}|${(w.ejercicios || []).length}`;

// ---- Detección del formato por la cabecera ----
const cab = (h) => normTxt(h).replace(/["']/g, '').trim();
function detectarFormato(cabs) {
  const tiene = (...ks) => ks.every((k) => cabs.includes(k));
  if (tiene('fecha', 'rutina', 'ejercicio', 'kg', 'reps')) return 'cadencia';
  if (tiene('title', 'start_time', 'exercise_title', 'set_index') && (cabs.includes('weight_kg') || cabs.includes('weight_lbs'))) return 'hevy';
  if (tiene('date', 'workout name', 'exercise name', 'set order', 'reps') && cabs.some((c) => /^weight\b/.test(c))) return 'strong';
  return null;
}

// Serie de fuerza normalizada al esquema de la app ({kg, reps, rir?, isDropSet?, w?}), o null si no vale (sin reps, fuera de rango).
function serieFuerza(kg, reps, { w = false, drop = false, rpe = NaN, rir = NaN, fallo = false } = {}) {
  const r = Math.round(reps), k = isFinite(kg) ? kg : 0;
  if (!(r >= 1 && r <= 200) || !(k >= 0 && k <= 600)) return null;
  const s = { kg: Math.round(k * 10) / 10, reps: r };
  if (w) { s.w = true; return s; }
  if (isFinite(rir)) s.rir = clamp(Math.round(rir), 0, 5);
  else if (isFinite(rpe) && rpe > 0) s.rir = clamp(Math.round(10 - rpe), 0, 5);
  else if (fallo) s.rir = 0;
  if (drop) s.isDropSet = true;
  return s;
}
// Bloque de cardio con los campos del modo del ejercicio (cinta: tiempo/velocidad; aire: km/min; estática: min).
function serieCardio(nombre, min, km) {
  const cm = modoCardio(nombre), m = isFinite(min) && min > 0 ? Math.round(clamp(min, 0.5, 600) * 10) / 10 : 0, d = isFinite(km) && km > 0 ? Math.round(clamp(km, 0.1, 200) * 10) / 10 : 0;
  if (!m && !d) return null;
  if (cm === 'cinta') { if (!m) return null; const s = { tiempo: m, completada: true }; if (d) s.velocidad = Math.round(clamp(d / (m / 60), 0.5, 30) * 10) / 10; return s; }
  if (cm === 'estatica') return m ? { min: m } : null;
  const s = {}; if (d) s.km = d; if (m) s.min = m; return s;
}

/**
 * Lee un CSV de Hevy, Strong o Cadencia y devuelve los entrenos NUEVOS listos para guardar (esquema de users/{uid}/entrenos).
 * @param {string} textoCSV contenido del archivo
 * @param {Array} entrenosExistentes entrenos que ya tiene la cuenta (para no duplicar)
 * @param {{lbs?: boolean, kg?: number}} opciones lbs = el Weight de Strong viene en libras; kg = peso de la persona (kcal estimadas)
 * @returns {{formato, entrenos, duplicados, series, desde, hasta, omitidas, error}}
 */
export function parsearCSVEntrenos(textoCSV, entrenosExistentes = [], opciones = {}) {
  const vacio = (error) => ({ formato: null, entrenos: [], duplicados: 0, series: 0, desde: '', hasta: '', omitidas: 0, error });
  const filas = leerCSV(textoCSV);
  if (!filas.length) return vacio('El archivo está vacío.');
  const cabs = filas[0].map(cab), formato = detectarFormato(cabs);
  if (!formato) return vacio('No reconocemos el formato. Usa un CSV exportado de Hevy, Strong o Cadencia.');
  const col = (...ks) => { for (const k of ks) { const i = cabs.indexOf(k); if (i >= 0) return i; } return -1; };
  const val = (f, i) => (i >= 0 && f[i] != null ? String(f[i]).trim() : '');
  const datos = filas.slice(1);
  if (!datos.length) return vacio('El archivo solo tiene la cabecera: no hay entrenos que importar.');

  const grupos = new Map(); // clave de sesión → { fecha, nombre, ms0, ms1, min, ejs: [{n, filas: []}] }
  let omitidas = 0;
  const grupo = (clave, fecha, nombre) => {
    if (!grupos.has(clave)) grupos.set(clave, { fecha, nombre, ms0: NaN, ms1: NaN, min: NaN, ejs: [] });
    return grupos.get(clave);
  };
  const ejDe = (g, n) => { const u = g.ejs[g.ejs.length - 1]; if (u && u.orig === n) return u; const e = { orig: n, filas: [] }; g.ejs.push(e); return e; };

  if (formato === 'hevy') {
    const c = { t: col('title'), ini: col('start_time'), fin: col('end_time'), ej: col('exercise_title'), tipo: col('set_type'), kg: col('weight_kg'), lb: col('weight_lbs'), reps: col('reps'), rpe: col('rpe'), km: col('distance_km'), mi: col('distance_miles'), seg: col('duration_seconds') };
    for (const f of datos) {
      const ini = leerFechaCSV(val(f, c.ini)), n = val(f, c.ej);
      if (!ini || !n) { omitidas++; continue; }
      const g = grupo(val(f, c.t) + '|' + val(f, c.ini), ini.fecha, val(f, c.t) || 'Entrenamiento');
      g.ms0 = ini.ms; const fin = leerFechaCSV(val(f, c.fin)); if (fin) g.ms1 = fin.ms;
      const kgLb = numero(val(f, c.lb)), kg = c.kg >= 0 ? numero(val(f, c.kg)) : kgLb * LB_KG;
      const tipo = normTxt(val(f, c.tipo));
      ejDe(g, n).filas.push({ kg, reps: numero(val(f, c.reps)), rpe: numero(val(f, c.rpe)), w: tipo === 'warmup', drop: tipo === 'dropset', fallo: tipo === 'failure',
        km: c.km >= 0 ? numero(val(f, c.km)) : numero(val(f, c.mi)) * 1.609344, min: numero(val(f, c.seg)) / 60 });
    }
  } else if (formato === 'strong') {
    const iPeso = cabs.findIndex((h) => /^weight\b/.test(h)), iUnidad = col('weight unit', 'unit');
    const lbsCab = iPeso >= 0 && /lb/.test(cabs[iPeso]);
    const c = { fecha: col('date'), nom: col('workout name'), dur: col('duration', 'duration (sec)', 'workout duration'), ej: col('exercise name'), ord: col('set order'), reps: col('reps'), rpe: col('rpe'), km: col('distance', 'distance (km)'), seg: col('seconds', 'duration (sec)') };
    for (const f of datos) {
      const fe = leerFechaCSV(val(f, c.fecha)), n = val(f, c.ej);
      if (!fe || !n) { omitidas++; continue; }
      const g = grupo(val(f, c.fecha) + '|' + val(f, c.nom), fe.fecha, val(f, c.nom) || 'Entrenamiento');
      if (!isFinite(g.min)) g.min = duracionMin(val(f, c.dur));
      const enLb = lbsCab || /lb/i.test(val(f, iUnidad)) || (opciones.lbs === true && !/kg/i.test(val(f, iUnidad)));
      const ord = val(f, c.ord).toUpperCase();
      ejDe(g, n).filas.push({ kg: numero(val(f, iPeso)) * (enLb ? LB_KG : 1), reps: numero(val(f, c.reps)), rpe: numero(val(f, c.rpe)), w: ord === 'W', drop: ord === 'D', fallo: ord === 'F',
        km: numero(val(f, c.km)), min: numero(val(f, c.seg)) / 60 });
    }
  } else {
    const c = { fecha: col('fecha'), rut: col('rutina'), ej: col('ejercicio'), serie: col('serie'), tipo: col('tipo'), kg: col('kg'), reps: col('reps'), rir: col('rir'), carga: col('carga'), notas: col('notas') };
    for (const f of datos) {
      const fe = leerFechaCSV(val(f, c.fecha));
      if (!fe) { omitidas++; continue; }
      const tipo = normTxt(val(f, c.tipo)), n = val(f, c.ej), notas = val(f, c.notas);
      const g = grupo(fe.fecha + '|' + val(f, c.rut), fe.fecha, val(f, c.rut) || 'Entrenamiento');
      const kv = Object.fromEntries(notas.split(';').map((p) => p.split('=').map((x) => x.trim())).filter((p) => p.length === 2 && p[0]));
      if (!n) { // entreno sin ejercicios (bici, cardio, otro o fuerza sin series): sus datos van en notas
        g.tipo = ['bici', 'cardio', 'otro', 'gym'].includes(tipo) ? tipo : 'otro';
        for (const k of ['min', 'km', 'elev', 'pulso']) { const v = numero(kv[k]); if (v > 0) g[k] = v; }
        continue;
      }
      ejDe(g, n).filas.push({ kg: numero(val(f, c.kg)), reps: numero(val(f, c.reps)), rir: numero(val(f, c.rir)), w: tipo === 'calentamiento', drop: tipo === 'drop', cardio: tipo === 'cardio',
        kv, serie: val(f, c.serie), lado: normTxt(val(f, c.carga)), carga: normTxt(val(f, c.carga)), super: /superserie/i.test(notas) });
    }
  }

  // Grupos → entrenos con el esquema de la app
  const nuevos = [], vistos = new Set((entrenosExistentes || []).filter((w) => w && w.fecha).map(claveDuplicado));
  let duplicados = 0, series = 0;
  for (const g of grupos.values()) {
    const ejercicios = [];
    for (const e of g.ejs) {
      const n = nombreCatalogo(e.orig), cardio = e.filas.some((x) => x.cardio) || exCardio({ n }) || (e.filas.length > 0 && e.filas.every((x) => !(x.reps > 0)) && e.filas.some((x) => x.km > 0));
      if (cardio) {
        const ss = [];
        for (const x of e.filas) {
          let s = null;
          if (x.kv) { s = {}; for (const [k, v] of Object.entries(x.kv)) { const nv = numero(v); if (k === 'int') s.int = v; else if (isFinite(nv) && nv > 0) s[k] = Math.round(nv * 10) / 10; } if (modoCardio(n) === 'cinta' && cv(s, 'tiempo') > 0) s.completada = true; if (!Object.keys(s).length) s = null; }
          else s = serieCardio(n, x.min, x.km);
          if (s) ss.push(s); else omitidas++;
        }
        if (ss.length) ejercicios.push({ n, tipo: 'cardio', series: ss });
        continue;
      }
      const uni = e.filas.some((x) => x.lado === 'izquierda' || x.lado === 'derecha');
      const ss = [];
      if (uni) { // Cadencia unilateral: filas «izquierda»/«derecha» con el mismo número de serie
        const porSerie = new Map();
        for (const x of e.filas) {
          if (x.w) { const s = serieFuerza(x.kg, x.reps, { w: true }); if (s) ss.push(s); else omitidas++; continue; }
          const k = x.serie || String(porSerie.size + 1);
          if (!porSerie.has(k)) porSerie.set(k, {});
          porSerie.get(k)[x.lado === 'derecha' ? 'D' : 'I'] = x;
        }
        for (const { I, D } of porSerie.values()) {
          const a = I || D, s = serieFuerza(a.kg, a.reps, { drop: a.drop, rir: a.rir });
          if (!s) { omitidas++; continue; }
          const d = D && serieFuerza(D.kg, D.reps);
          s.kgD = d ? d.kg : s.kg; s.repsD = d ? d.reps : s.reps;
          if (a.super) s.isSuperset = true;
          ss.push(s);
        }
      } else {
        for (const x of e.filas) {
          const s = serieFuerza(x.kg, x.reps, x);
          if (!s) { omitidas++; continue; }
          if (x.super && !s.w) s.isSuperset = true;
          ss.push(s);
        }
      }
      if (!ss.length) continue;
      const cargaCSV = e.filas.map((x) => x.carga).find((v) => v === 'total' || v === 'por_lado');
      ejercicios.push(uni ? { n, carga: cargaCSV || cargaDefecto(n), uni: true, series: ss } : { n, carga: cargaCSV || cargaDefecto(n), series: ss });
    }
    const tipo = g.tipo && g.tipo !== 'gym' && !ejercicios.length ? g.tipo : 'gym';
    if (tipo === 'gym' && !ejercicios.length && !(g.min > 0)) continue; // sesión sin ninguna serie válida
    const nSeries = ejercicios.reduce((a, e) => a + e.series.length, 0);
    let min = isFinite(g.ms0) && isFinite(g.ms1) && g.ms1 > g.ms0 ? (g.ms1 - g.ms0) / 60000 : g.min;
    if (!(min >= 1)) min = clamp(Math.round(nSeries * 2.5), 10, 180); // sin duración en el archivo: estimada por el número de series
    const w = { id: '', fecha: g.fecha, tipo, nombre: String(g.nombre || 'Entrenamiento').trim().slice(0, 60) || 'Entrenamiento', min: Math.round(clamp(min, 1, 600)), esf: 2, importado: formato };
    if (tipo === 'gym') w.ejercicios = ejercicios;
    else for (const k of ['km', 'elev', 'pulso']) if (g[k] > 0) w[k] = Math.round(g[k] * 10) / 10;
    const clave = claveDuplicado(w);
    if (vistos.has(clave)) { duplicados++; continue; }
    vistos.add(clave);
    w.id = 'wi' + huella(formato + '|' + clave);
    const kc = estimateKcal(w, Number(opciones.kg) || 0);
    if (kc > 0) w.kcal = kc;
    series += nSeries;
    nuevos.push(w);
  }
  nuevos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!nuevos.length && !duplicados) return { ...vacio('No hemos encontrado series válidas en el archivo (cada serie necesita repeticiones).'), formato, omitidas };
  return { formato, entrenos: nuevos, duplicados, series, desde: nuevos.length ? nuevos[0].fecha : '', hasta: nuevos.length ? nuevos[nuevos.length - 1].fecha : '', omitidas, error: null };
}

/* ---------- volumen semanal por músculo y progresión por ejercicio (77) ---------- */
// Series de trabajo realmente hechas: sin calentamiento y sin las marcadas como no completadas.
const seriesHechas = (e) => trabajo(e.series).filter((s) => s && s.done !== false);

// Suma a `o` las series efectivas por músculo de un entreno (principal 1, secundario 0,5): volumen semanal (77) y resumen mensual (78).
function sumarMusculos(o, w) {
  for (const e of w.ejercicios || []) {
    if (exCardio(e)) continue;
    const x = ejercicio(e.n), n = seriesHechas(e).length;
    if (!x || !n) continue;
    let { p, s } = musculosDet(x);
    if (!p.length && GRUPO_DET[x.m]) p = [GRUPO_DET[x.m]];
    for (const k of p) o[k] = (o[k] || 0) + n;
    for (const k of s) if (!p.includes(k)) o[k] = (o[k] || 0) + n / 2;
  }
}

// Series efectivas por músculo (las mismas claves que la fatiga y el cuerpo 3D, MUSC_DET): principal 1, secundario 0,5.
// modo 'semana' = lunes a domingo en curso frente a la semana anterior completa; '7d' = últimos 7 días frente a los 7 previos.
export function seriesSemanalesPorMusculo(entrenos, hoyISO, modo = 'semana') {
  const desde = modo === '7d' ? addDays(hoyISO, -6) : mondayOf(hoyISO), hasta = modo === '7d' ? hoyISO : addDays(desde, 6);
  const antes = addDays(desde, -7), act = {}, ant = {};
  for (const w of entrenos || []) {
    const o = w.fecha >= desde && w.fecha <= hasta ? act : w.fecha >= antes && w.fecha < desde ? ant : null;
    if (!o) continue;
    sumarMusculos(o, w);
  }
  return Object.keys(MUSC_DET).filter((k) => act[k] || ant[k])
    .map((k) => ({ musculo: k, etiqueta: MUSC_DET[k], series: act[k] || 0, seriesAnt: ant[k] || 0, delta: (act[k] || 0) - (ant[k] || 0) }))
    .sort((a, b) => b.series - a.series || b.seriesAnt - a.seriesAnt || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

export const RANGOS_PROG = { '1m': 30, '3m': 91, '6m': 182, todo: 0 }; // días que abarca cada rango (hoy incluido)
export const METRICAS_PROG = { orm1: 'orm1', peso: 'pesoMax', volumen: 'volumen' }; // métrica → campo del punto
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const r1 = (v) => Math.round(v * 10) / 10;
const coma = (v) => String(r1(v)).replace('.', ',');
// «80 kg × 8, 8, 7 · 85 kg × 5» (agrupa las series seguidas con el mismo peso). Sin peso: «10, 8 reps».
function textoSeries(series, sufijo) {
  const g = [];
  for (const s of series) { const u = g[g.length - 1]; if (u && u.kg === s.kg) u.reps.push(s.reps); else g.push({ kg: s.kg, reps: [s.reps] }); }
  return g.map((x) => (x.kg > 0 ? `${coma(x.kg)} kg${sufijo} × ${x.reps.join(', ')}` : `${x.reps.join(', ')} reps`)).join(' · ');
}

// Un punto por sesión (de la más antigua a la más reciente) y el resumen del rango para la métrica elegida.
// Peso y 1RM: el kg tal como se apuntó (por lado si la carga es por lado); en unilateral, el mayor de los dos lados.
// Volumen: volumenSerie (×2 con carga por lado; Izquierda + Derecha en unilateral).
export function progresionEjercicio(entrenos, nombreEjercicio, rango = 'todo', { hoy = toISO(new Date()), metrica = 'orm1' } = {}) {
  const clave = claveEj(nombreEjercicio), dias = RANGOS_PROG[rango] || 0, desde = dias ? addDays(hoy, 1 - dias) : '';
  const todos = [];
  for (const w of [...(entrenos || [])].reverse().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
    const filas = []; // { e, s, lados: [I] o [I, D] }
    for (const e of w.ejercicios || []) {
      if (exCardio(e) || claveEj(e.n) !== clave) continue;
      for (const s of seriesHechas(e)) {
        const lados = e.uni ? ladosSerie(s) : [{ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }];
        if (lados.some((l) => l.reps > 0)) filas.push({ e, s, lados });
      }
    }
    if (!filas.length) continue;
    const uni = filas.some((f) => f.e.uni), porLado = uni || filas.some((f) => cargaDe(f.e) === 'por_lado');
    const sufijo = !uni && porLado ? ' c/u' : '';
    let orm = null, pesoMax = 0, volumen = 0, mejor = null;
    for (const f of filas) {
      volumen += volumenSerie(f.s, f.e);
      for (const l of f.lados) {
        if (!(l.reps > 0)) continue;
        pesoMax = Math.max(pesoMax, l.kg);
        const v = orm1(l.kg, l.reps);
        if (v != null && (orm == null || v > orm)) orm = v;
        const score = l.kg > 0 ? l.kg * (1 + l.reps / 30) : l.reps; // misma «mejor serie» que Récords
        if (!mejor || score > mejor.score) mejor = { ...l, score };
      }
    }
    const lado = (i) => textoSeries(filas.map((f) => f.lados[i] || f.lados[0]).filter((l) => l.reps > 0), '');
    let detalle = textoSeries(filas.map((f) => f.lados[0]), sufijo);
    if (uni) { const I = lado(0), D = lado(1); detalle = I === D ? `${I} (cada lado)` : `Izq. ${I} / Der. ${D}`; }
    const [anio, mes, dia] = w.fecha.split('-').map(Number);
    todos.push({
      fecha: w.fecha, fechaCorta: `${dia} ${MES_CORTO[mes - 1]}${anio === Number(hoy.slice(0, 4)) ? '' : ` ${anio}`}`,
      orm1: orm == null ? null : r1(orm), pesoMax: r1(pesoMax), volumen: r1(volumen),
      mejorSerieTexto: mejor.kg > 0 ? `${coma(mejor.kg)} kg${uni ? ' por lado' : sufijo} × ${mejor.reps}` : `${mejor.reps} reps`,
      detalleSeries: detalle, uni, porLado,
    });
  }
  const puntos = todos.filter((p) => p.fecha >= desde);
  const campo = METRICAS_PROG[metrica] || 'orm1';
  const conValor = puntos.filter((p) => p[campo] > 0);
  const max = (k) => puntos.reduce((a, p) => (p[k] > 0 && (a == null || p[k] > a) ? p[k] : a), null);
  const ini = conValor[0], fin = conValor[conValor.length - 1];
  const deltaAbs = conValor.length > 1 ? r1(fin[campo] - ini[campo]) : null;
  return {
    puntos, total: todos.length,
    porLado: todos.some((p) => p.porLado), cargaMixta: todos.some((p) => p.porLado) && todos.some((p) => !p.porLado),
    conDatos: Object.keys(METRICAS_PROG).filter((m) => todos.some((p) => p[METRICAS_PROG[m]] > 0)),
    resumen: {
      mejorOrm1: max('orm1'), mejorPeso: max('pesoMax'), mejorVolumen: max('volumen'),
      ultimoValor: fin ? fin[campo] : null, ultimaFecha: fin ? fin.fecha : null,
      deltaAbs, deltaPct: deltaAbs == null ? null : r1((deltaAbs / ini[campo]) * 100),
    },
  };
}

/* ---------- racha semanal y resumen mensual (78) ---------- */
// Semanas naturales de lunes a domingo en la hora local del dispositivo. Cuenta cualquier sesión guardada
// (fuerza, cardio, bici u otro) y cada día una sola vez.
const objetivoSemanal = (v) => clamp(Number(v) || 4, 1, 7);
// Lunes de cada semana con actividad → días distintos entrenados (sin fechas posteriores a `hastaISO`).
function diasPorSemana(entrenos, hastaISO) {
  const sem = new Map();
  for (const f of new Set((entrenos || []).map((w) => w.fecha))) {
    if (!f || f > hastaISO) continue;
    const l = mondayOf(f);
    sem.set(l, (sem.get(l) || 0) + 1);
  }
  return sem;
}

// La semana en curso suma en cuanto llega al objetivo; mientras no llega, no rompe nada.
export function calcularRachaSemanal(entrenos, objetivoDias = 4, hoyISO = toISO(new Date())) {
  const objetivo = objetivoSemanal(objetivoDias), sem = diasPorSemana(entrenos, hoyISO), actual = mondayOf(hoyISO);
  const cumple = (l) => (sem.get(l) || 0) >= objetivo;
  const diasActual = sem.get(actual) || 0, actualCumplida = diasActual >= objetivo;
  let rachaActual = actualCumplida ? 1 : 0;
  for (let l = addDays(actual, -7); cumple(l); l = addDays(l, -7)) rachaActual++;
  let mejorRacha = 0, seguidas = 0;
  for (let l = [...sem.keys()].sort()[0]; l && l <= actual; l = addDays(l, 7)) {
    seguidas = cumple(l) ? seguidas + 1 : 0;
    mejorRacha = Math.max(mejorRacha, seguidas);
  }
  return { rachaActual, mejorRacha, diasActual, objetivo, actualCumplida, faltanDias: Math.max(0, objetivo - diasActual) };
}

export const mesAnterior = (mesYYYYMM) => addDays(`${mesYYYYMM}-01`, -1).slice(0, 7);

// Meses con entrenos, del más reciente al más antiguo. Si hay algún dato, el actual y el anterior salen siempre.
export function mesesDisponibles(entrenos, hoyISO = toISO(new Date())) {
  const hoyMes = hoyISO.slice(0, 7);
  const meses = new Set((entrenos || []).map((w) => String(w.fecha || '').slice(0, 7)).filter((m) => m.length === 7 && m <= hoyMes));
  if (meses.size) { meses.add(hoyMes); meses.add(mesAnterior(hoyMes)); }
  return [...meses].sort().reverse();
}

// Cifras de un mes ('2026-11'). Las semanas son las mismas de la racha (lunes a domingo) y cada una pertenece
// al mes en el que cae su jueves; la semana en curso solo se cuenta si ya está cumplida.
export function resumenMensual(entrenos, pesos = [], mesYYYYMM, objetivoDias = 4, hoyISO = toISO(new Date())) {
  const delMes = (x) => String(x.fecha || '').slice(0, 7) === mesYYYYMM;
  const lista = (entrenos || []).filter(delMes);
  let seriesEfectivas = 0, volumen = 0, minutos = 0;
  const musc = {}, ejs = new Map();
  for (const w of lista) {
    sumarMusculos(musc, w);
    let nSeries = 0, minCardio = 0;
    for (const e of w.ejercicios || []) {
      if (exCardio(e)) { for (const s of e.series || []) if (s.done !== false) minCardio += Number(cv(s, 'min')) || 0; continue; }
      const hechas = seriesHechas(e);
      nSeries += hechas.length;
      for (const s of hechas) {
        volumen += volumenSerie(s, e);
        for (const l of e.uni ? ladosSerie(s) : [{ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }]) {
          if (!(l.reps > 0)) continue;
          const clave = claveEj(e.n), ant = ejs.get(clave);
          const conPeso = l.kg > 0, valor = conPeso ? l.kg * (1 + l.reps / 30) : l.reps; // misma «mejor serie» que Récords
          if (ant && (ant.conPeso > conPeso || (ant.conPeso === conPeso && ant.valor >= valor))) continue;
          const sufijo = e.uni ? ' por lado' : cargaDe(e) === 'por_lado' ? ' c/u' : '';
          ejs.set(clave, { nombre: canon(e.n), conPeso, valor, kg: l.kg, reps: l.reps, texto: conPeso ? `${coma(l.kg)} kg${sufijo} × ${l.reps}` : `${l.reps} reps` });
        }
      }
    }
    seriesEfectivas += nSeries;
    // Sin duración guardada: los minutos de cardio más 3 por serie de fuerza.
    minutos += Number(w.min) > 0 ? Number(w.min) : minCardio + nSeries * 3;
  }

  const objetivo = objetivoSemanal(objetivoDias), sem = diasPorSemana(entrenos, hoyISO);
  let semanasCumplidas = 0, semanasTotales = 0;
  for (let l = mondayOf(`${mesYYYYMM}-01`); l <= hoyISO && addDays(l, 3).slice(0, 7) <= mesYYYYMM; l = addDays(l, 7)) {
    if (addDays(l, 3).slice(0, 7) < mesYYYYMM) continue;
    const ok = (sem.get(l) || 0) >= objetivo;
    if (!ok && addDays(l, 6) >= hoyISO) continue;
    semanasTotales++;
    if (ok) semanasCumplidas++;
  }

  const ps = (pesos || []).filter((x) => delMes(x) && Number(x.kg) > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  let pesoDelta = null;
  if (ps.length > 1) {
    const d = r1(Number(ps[ps.length - 1].kg) - Number(ps[0].kg));
    pesoDelta = `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1).replace('.', ',')} kg`;
  }

  return {
    mes: mesYYYYMM,
    totalEntrenos: lista.length,
    diasUnicos: new Set(lista.map((w) => w.fecha)).size,
    seriesEfectivas,
    volumenKg: Math.round(volumen),
    minutosTotales: Math.round(minutos),
    semanasCumplidas,
    semanasTotales,
    topMusculos: Object.entries(musc).filter(([k]) => MUSC_DET[k])
      .map(([k, series]) => ({ musculo: k, etiqueta: MUSC_DET[k], series }))
      .sort((a, b) => b.series - a.series || a.etiqueta.localeCompare(b.etiqueta, 'es')).slice(0, 3),
    topEjercicios: [...ejs.values()]
      .sort((a, b) => b.conPeso - a.conPeso || b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 3)
      .map(({ nombre, kg, reps, texto }) => ({ nombre, kg, reps, texto })),
    pesoDelta,
  };
}
