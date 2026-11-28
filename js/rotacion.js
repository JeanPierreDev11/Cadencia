// Ciclo semanal de rutinas (perfil `rotation`): { enabled, routineIds: [idSemana1, idSemana2, …], anchorMonday: 'YYYY-MM-DD' }.
// Módulo puro, sin estado ni imports de la app. Todo en hora local del dispositivo; las semanas se cuentan con Date.UTC para que el cambio de hora no desplace el lunes.
const SEMANA_MS = 604800000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Lunes (hora local) de la semana de `now`, como 'YYYY-MM-DD'.
export function lunesLocal(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
const utcDe = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
// Suma días a un 'YYYY-MM-DD' (sin pasar por la zona horaria).
export function sumarDias(iso, n) { const t = utcDe(iso); if (!isFinite(t)) return iso; const d = new Date(t + n * 86400000); return d.toISOString().slice(0, 10); }

// Ids del ciclo que siguen existiendo entre tus rutinas (sin vacíos).
export const idsValidos = (rotation, routines) => {
  const hay = new Set((routines || []).map((r) => r && r.id));
  return ((rotation && rotation.routineIds) || []).filter((id) => id && hay.has(id));
};

// Rutina que toca esta semana: { routine, weekIndex, totalWeeks } o null si el ciclo está apagado o no es válido.
export function getActiveRoutineFromRotation(rotation, routines, now = new Date()) {
  if (!rotation || rotation.enabled !== true) return null;
  const ids = idsValidos(rotation, routines), len = ids.length;
  const anchorUTC = utcDe(rotation.anchorMonday);
  if (len < 2 || !isFinite(anchorUTC)) return null;
  const m = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  const currentMondayUTC = Date.UTC(m.getFullYear(), m.getMonth(), m.getDate());
  const weeksDiff = Math.floor((currentMondayUTC - anchorUTC) / SEMANA_MS);
  const weekIndex = ((weeksDiff % len) + len) % len;
  const routine = routines.find((r) => r && r.id === ids[weekIndex]) || null;
  return routine ? { routine, weekIndex, totalWeeks: len } : null;
}

// Al borrar una rutina: la quita del ciclo y lo apaga si quedan menos de 2. Devuelve el `rotation` nuevo (o null si no había).
export function quitarDeRotacion(rotation, id) {
  if (!rotation) return null;
  const routineIds = (rotation.routineIds || []).filter((x) => x !== id);
  return { ...rotation, routineIds, enabled: rotation.enabled === true && routineIds.length >= 2 };
}
