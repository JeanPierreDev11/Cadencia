// Calorías objetivo: TMB (Mifflin-St Jeor) × nivel de actividad = TDEE, y ajuste según el objetivo. Solo cálculo, sin pantalla.
export const NIVELES = {
  sedentario: { f: 1.2, t: 'Sedentaria', d: 'Poco o ningún ejercicio' },
  ligero: { f: 1.375, t: 'Ligera', d: 'Ejercicio 1–3 días a la semana' },
  moderado: { f: 1.55, t: 'Moderada', d: 'Ejercicio 3–5 días a la semana' },
  activo: { f: 1.725, t: 'Activa', d: 'Ejercicio 6–7 días a la semana' },
  muy_activo: { f: 1.9, t: 'Muy activa', d: 'Ejercicio 2 veces al día' },
};
// Nivel según los días de entreno de la rutina (el «muy activo» solo se elige a mano).
export const nivelPorDias = (n) => (n >= 6 ? 'activo' : n >= 4 ? 'moderado' : n >= 1 ? 'ligero' : 'sedentario');

// Edad en años: de la fecha de nacimiento si existe (así no se queda vieja), si no la guardada.
export function edadDe(p, hoy = new Date()) {
  if (p && p.fechaNac) {
    const n = new Date(`${p.fechaNac}T00:00:00`);
    if (!isNaN(n)) return hoy.getFullYear() - n.getFullYear() - (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate()) ? 1 : 0);
  }
  return p && p.edad ? Number(p.edad) : NaN;
}

// Mifflin-St Jeor. Siempre esta fórmula (no Katch-McArdle): hombres +5, mujeres −161.
export function tmb({ sexo, pesoKg, alturaCm, ...r }) {
  const edad = edadDe(r);
  if (!(pesoKg > 0 && alturaCm > 0 && edad > 0)) return NaN;
  return 10 * pesoKg + 6.25 * alturaCm - 5 * edad + (sexo === 'mujer' ? -161 : 5);
}

// p: perfil (sexo, alturaCm, edad/fechaNac, objetivos, pesoObjetivo). kg: peso actual.
// dias: días de entreno por semana de la rutina activa. actividad: 'auto' o una clave de NIVELES.
export function calorias(p, { kg, dias = 0, actividad = 'auto' } = {}) {
  const base = tmb({ ...p, pesoKg: kg });
  if (!(base > 0)) return null;
  const nivel = NIVELES[actividad] ? actividad : nivelPorDias(dias), factor = NIVELES[nivel].f;
  const tdee = base * factor, goals = p.objetivos || [], meta = p.pesoObjetivo > 0 ? p.pesoObjetivo : null;
  const perder = goals.includes('perder'), musculo = goals.includes('musculo'), aviso = [];
  // Perder y ganar músculo a la vez: manda el peso objetivo; sin él, recomposición (mantener).
  let modo = 'mantenimiento';
  if (perder && musculo) modo = meta ? (kg > meta + 0.05 ? 'deficit' : kg < meta - 0.05 ? 'superavit' : 'mantenimiento') : 'mantenimiento';
  else if (perder) modo = 'deficit';
  else if (musculo) modo = 'superavit';
  // Con ritmo elegido: déficit/superávit diario = kg por semana × 7700 / 7. Sin él (cuentas antiguas): −20 % / +15 % del gasto.
  const rit = ritmoDePerfil(p), diario = rit ? (rit * KCAL_KG) / 7 : 0;
  let kcal = modo === 'deficit' ? (rit ? tdee - diario : tdee * 0.8) : modo === 'superavit' ? (rit ? tdee + diario : tdee * 1.15) : tdee;
  if (modo === 'deficit') { // suelo habitual de seguridad, que nunca pasa del gasto
    const suelo = Math.min(tdee, sexoSuelo(p.sexo));
    if (kcal < suelo) {
      kcal = suelo;
      aviso.push(rit ? `Con ${String(rit).replace('.', ',')} kg por semana comerías menos de ${Math.round(suelo)} kcal, un mínimo razonable: lo he subido a ese suelo y tu ritmo real será de unos ${String(Math.round(((tdee - suelo) * 7 / KCAL_KG) * 100) / 100).replace('.', ',')} kg por semana.` : `Tu objetivo quedaba por debajo de ${Math.round(suelo)} kcal, un mínimo razonable: lo he subido a ese suelo.`);
    }
    if (meta && kg <= meta + 0.05) aviso.push('Ya has llegado a tu peso objetivo: cambia tu objetivo a mantener peso si quieres dejar el déficit.');
  }
  if (modo === 'superavit' && rit && rit > 0.5) aviso.push('Con un ritmo tan alto, buena parte de lo que ganes será grasa y no músculo: para ganar músculo limpio suele bastar con 0,25–0,5 kg por semana.');
  kcal = Math.round(kcal);
  const prot = Math.min((modo === 'deficit' ? 2 : 1.8) * kg, 0.35 * kcal / 4), fat = Math.min(Math.max(0.8 * kg, 0.22 * kcal / 9), 0.35 * kcal / 9);
  return {
    tmb: Math.round(base), nivel, factor, tdee: Math.round(tdee), modo, kcal, ritmo: modo === 'mantenimiento' ? null : rit,
    deficit: modo === 'deficit' ? Math.round(tdee) - kcal : 0, superavit: modo === 'superavit' ? kcal - Math.round(tdee) : 0,
    protG: Math.round(prot), fatG: Math.round(fat), carbG: Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4)), aviso,
  };
}
const sexoSuelo = (sexo) => (sexo === 'mujer' ? 1200 : 1500);
// Ritmo que eligió la persona (kg/semana, 0,25–1), o null si no hay uno válido (cuentas sin cuestionario nuevo).
export const ritmoDePerfil = (p) => { const r = Number(p && p.ritmoKgSemana); return r >= 0.25 && r <= 1 ? r : null; };
const KCAL_KG = 7700; // kcal de un kilo de peso corporal (misma cifra en todo el plan)

// Lo que se guarda en el perfil (perfil.calorias) para tenerlo siempre al día en la base de datos.
export function resumen(p, kg) {
  const c = calorias(p, { kg, dias: ((p.rutina && p.rutina.dias) || []).length, actividad: (p.nutri && p.nutri.actividad) || 'auto' });
  if (!c) return null;
  const { aviso, ...r } = c;
  return { ...r, actualizado: Date.now() };
}
