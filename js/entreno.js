// Lógica del entrenamiento: solo cálculos, sin pantalla.

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const TIPOS = { bici: 'Bici', gym: 'Gimnasio', descanso: 'Descanso' };
export const EJERCICIOS_COMUNES = [
  'Sentadilla', 'Prensa de piernas', 'Peso muerto rumano', 'Zancadas', 'Hip thrust', 'Curl femoral',
  'Elevación de gemelos', 'Press banca', 'Press militar', 'Remo con barra', 'Jalón al pecho', 'Dominadas', 'Fondos', 'Plancha',
];

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
  const met = w.tipo === 'bici' ? metBici(w.min, w.km, w.esf) : { 1: 3.5, 2: 5, 3: 6 }[w.esf] || 5;
  return Math.round((met * peso * w.min) / 60);
}

/* ---------- estadísticas ---------- */
const inWeek = (w, monday) => w.fecha >= monday && w.fecha <= addDays(monday, 6);
export function weekStats(ws, monday) {
  const list = ws.filter((w) => inWeek(w, monday));
  const sum = (k) => list.reduce((a, w) => a + (w[k] || 0), 0);
  return { n: list.length, min: sum('min'), km: sum('km'), elev: sum('elev'), kcal: sum('kcal') };
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
    } else {
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

/* ---------- plan semanal propuesto ---------- */
const S = (t, foco, min) => ({ t, foco, min });
const SLOTS = { 3: [0, 2, 5], 4: [0, 2, 4, 6], 5: [0, 1, 3, 5, 6] }; // días de la semana (0 = lunes) donde se coloca cada sesión
const TEMPLATES = {
  rend: {
    3: [S('gym', 'Fuerza de piernas y core', 45), S('bici', 'Intervalos en subida', 60), S('bici', 'Fondo en zona 2', 120)],
    4: [S('gym', 'Fuerza de piernas y core', 45), S('bici', 'Intervalos en subida', 60), S('bici', 'Recuperación suave', 45), S('bici', 'Fondo en zona 2', 150)],
    5: [S('gym', 'Fuerza de piernas y core', 45), S('bici', 'Tempo sostenido', 60), S('bici', 'Intervalos en subida', 60), S('bici', 'Recuperación suave', 45), S('bici', 'Fondo en zona 2', 150)],
  },
  grasa: {
    3: [S('bici', 'Zona 2 constante', 60), S('gym', 'Cuerpo completo', 45), S('bici', 'Salida larga suave', 90)],
    4: [S('gym', 'Cuerpo completo', 45), S('bici', 'Zona 2 constante', 60), S('gym', 'Cuerpo completo', 45), S('bici', 'Salida larga suave', 100)],
    5: [S('gym', 'Tren inferior', 45), S('bici', 'Zona 2 constante', 60), S('gym', 'Tren superior', 45), S('bici', 'Intervalos cortos', 50), S('bici', 'Salida larga suave', 110)],
  },
  fuerza: {
    3: [S('gym', 'Tren superior', 55), S('gym', 'Tren inferior', 55), S('bici', 'Rodaje suave', 60)],
    4: [S('gym', 'Tren superior', 55), S('gym', 'Tren inferior', 55), S('gym', 'Cuerpo completo', 55), S('bici', 'Rodaje suave', 60)],
    5: [S('gym', 'Empuje', 55), S('gym', 'Tren inferior', 55), S('bici', 'Rodaje suave', 45), S('gym', 'Tirón y core', 55), S('bici', 'Paseo en zona 2', 75)],
  },
  general: {
    3: [S('bici', 'Rodaje suave', 60), S('gym', 'Cuerpo completo', 40), S('bici', 'Salida de fondo suave', 90)],
    4: [S('bici', 'Rodaje suave', 45), S('gym', 'Cuerpo completo', 40), S('bici', 'Intervalos suaves', 50), S('bici', 'Salida de fondo suave', 90)],
    5: [S('bici', 'Rodaje suave', 45), S('gym', 'Cuerpo completo', 40), S('bici', 'Intervalos suaves', 50), S('gym', 'Cuerpo completo', 40), S('bici', 'Salida de fondo suave', 100)],
  },
};
export const KIND_TEXT = {
  rend: 'Más bici de calidad (intervalos y fondo), con una sesión de fuerza a la semana.',
  grasa: 'Mucha bici en zona 2 y dos sesiones de fuerza para conservar músculo mientras pierdes grasa.',
  fuerza: 'Tres o cuatro sesiones de gimnasio y bici suave para recuperar.',
  general: 'Una mezcla equilibrada de bici suave, fondo y una sesión de gimnasio.',
};
export function planKind(goals) {
  const g = new Set(goals || []);
  if (g.has('rendimiento') || g.has('prueba')) return 'rend';
  if (g.has('musculo')) return 'fuerza';
  if (g.has('perder')) return 'grasa';
  return 'general';
}
export function proposePlan(goals, n = 4) {
  const k = planKind(goals);
  const sessions = TEMPLATES[k][n] || TEMPLATES[k][4];
  const slots = SLOTS[n] || SLOTS[4];
  const dias = Array.from({ length: 7 }, () => ({ t: 'descanso', foco: '', min: 0 }));
  sessions.forEach((s, i) => { dias[slots[i]] = { ...s }; });
  return dias;
}
