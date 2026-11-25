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
  // Ajuste adaptativo del check-in semanal (nutri.ajusteKcal, −500…500): corrige el gasto calculado con el real.
  // Sin ajuste el gasto queda exactamente como antes (sin redondear aquí), así nada cambia para quien no lo usa.
  const ajusteKcal = ajusteDe(p), tdeeBase = base * factor;
  const tdee = ajusteKcal ? Math.max(1200, Math.round(tdeeBase + ajusteKcal)) : tdeeBase, goals = p.objetivos || [], meta = p.pesoObjetivo > 0 ? p.pesoObjetivo : null;
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
    tmb: Math.round(base), nivel, factor, tdee: Math.round(tdee), tdeeBase: Math.round(tdeeBase), ajusteKcal, modo, kcal, ritmo: modo === 'mantenimiento' ? null : rit,
    deficit: modo === 'deficit' ? Math.round(tdee) - kcal : 0, superavit: modo === 'superavit' ? kcal - Math.round(tdee) : 0,
    protG: Math.round(prot), fatG: Math.round(fat), carbG: Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4)), aviso,
  };
}
const sexoSuelo = (sexo) => (sexo === 'mujer' ? 1200 : 1500);
// Ritmo que eligió la persona (kg/semana, 0,25–1), o null si no hay uno válido (cuentas sin cuestionario nuevo).
export const ritmoDePerfil = (p) => { const r = Number(p && p.ritmoKgSemana); return r >= 0.25 && r <= 1 ? r : null; };
const KCAL_KG = 7700; // kcal de un kilo de peso corporal (misma cifra en todo el plan)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const AJUSTE_MAX = 500;
// Ajuste adaptativo guardado (kcal sobre el gasto calculado), acotado a ±500. Sin dato o basura = 0.
export const ajusteDe = (p) => { const a = Math.round(Number(p && p.nutri && p.nutri.ajusteKcal) || 0); return clamp(a, -AJUSTE_MAX, AJUSTE_MAX); };

// Lo que se guarda en el perfil (perfil.calorias) para tenerlo siempre al día en la base de datos.
export function resumen(p, kg) {
  const c = calorias(p, { kg, dias: ((p.rutina && p.rutina.dias) || []).length, actividad: (p.nutri && p.nutri.actividad) || 'auto' });
  if (!c) return null;
  const { aviso, ...r } = c;
  return { ...r, actualizado: Date.now() };
}

/* ------------------------------------------------------------------ */
/* Check-in semanal de calorías adaptativas (puro, sin pantalla).        */
/* ------------------------------------------------------------------ */
// Ventanas: peso de esta semana (hoy-6..hoy) y de la anterior (hoy-13..hoy-7), ≥ 2 pesajes en cada una;
// comidas de los últimos 7 días, contando solo días con ≥ 800 kcal registradas (un día a medias distorsiona), ≥ 4 días.
export const CHECKIN = { DIAS: 7, MIN_PESAJES: 2, MIN_DIAS_COMIDA: 4, KCAL_DIA_MIN: 800, PASO_MAX: 150, ZONA_MUERTA: 40, FACTOR: 0.5, HISTORIAL: 8 };
const isoMs = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export const sumarDias = (iso, n) => new Date(isoMs(iso) + n * 864e5).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((isoMs(b) - isoMs(a)) / 864e5); // b − a
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const kcalDia = (d) => { if (!d) return 0; if (Number.isFinite(Number(d.kcal))) return Number(d.kcal); return (d.items || []).reduce((s, x) => s + (Number(x && x.k) || 0), 0); };

// perfil: users/{uid}; pesos: [{fecha, kg}]; comidas7d: [{fecha, kcal}] o [{fecha, items:[{k}]}]; hoyISO: 'AAAA-MM-DD'.
// Opcionales: dias y actividad (como los usa la pantalla) y kg = peso con el que se calculan los planes (por defecto la media de esta semana).
export function evaluarCheckin({ perfil, pesos = [], comidas7d = [], hoyISO, dias, actividad, kg } = {}) {
  const p = perfil || {}, n = p.nutri || {}, C = CHECKIN, ajusteActual = ajusteDe(p);
  const ult = n.ultimoCheckin && Number.isFinite(isoMs(n.ultimoCheckin)) ? String(n.ultimoCheckin).slice(0, 10) : null;
  if (ult) {
    const pasados = diasEntre(ult, hoyISO);
    if (pasados >= 0 && pasados < C.DIAS) return { estado: 'reciente', diasRestantes: C.DIAS - pasados, proximoISO: sumarDias(ult, C.DIAS), ultimoISO: ult, ajusteActual };
  }
  const enVentana = (f, desde, hasta) => { const d = diasEntre(f, hoyISO); return d >= desde && d <= hasta; };
  const kgDe = (w) => Number(w && w.kg);
  const pesoAct = pesos.filter((w) => w && enVentana(w.fecha, 0, 6) && kgDe(w) > 0).map(kgDe);
  const pesoAnt = pesos.filter((w) => w && enVentana(w.fecha, 7, 13) && kgDe(w) > 0).map(kgDe);
  const vistos = new Set(), kcalOk = [];
  for (const d of comidas7d) {
    if (!d || !enVentana(d.fecha, 0, 6) || vistos.has(d.fecha)) continue;
    vistos.add(d.fecha);
    const k = kcalDia(d);
    if (k >= C.KCAL_DIA_MIN) kcalOk.push(k);
  }
  const pesajesAct = pesoAct.length, pesajesAnt = pesoAnt.length, diasComida = kcalOk.length;
  if (pesajesAct < C.MIN_PESAJES || pesajesAnt < C.MIN_PESAJES || diasComida < C.MIN_DIAS_COMIDA) {
    return { estado: 'faltan_datos', pesajesAct, pesajesAnt, diasComida, ajusteActual, min: { pesajes: C.MIN_PESAJES, dias: C.MIN_DIAS_COMIDA } };
  }
  const mediaPesoAct = media(pesoAct), mediaPesoAnt = media(pesoAnt), cambioSemKg = mediaPesoAct - mediaPesoAnt, mediaKcal = media(kcalOk);
  // Balance: lo que comes menos lo que has acumulado (o perdido) en el cuerpo, por día = tu gasto real.
  const tdeeReal = mediaKcal - (cambioSemKg * KCAL_KG) / 7;
  const kgPlan = kg > 0 ? kg : mediaPesoAct;
  const opt = { kg: kgPlan, dias: dias != null ? dias : ((p.rutina && p.rutina.dias) || []).length, actividad: actividad || n.actividad || 'auto' };
  const planActual = calorias(p, opt);
  if (!planActual) return { estado: 'faltan_datos', pesajesAct, pesajesAnt, diasComida, ajusteActual, perfilIncompleto: true, min: { pesajes: C.MIN_PESAJES, dias: C.MIN_DIAS_COMIDA } };
  const ritmoObjKg = planActual.modo === 'deficit' ? -(planActual.deficit * 7) / KCAL_KG : planActual.modo === 'superavit' ? (planActual.superavit * 7) / KCAL_KG : 0;
  const deltaTdee = tdeeReal - planActual.tdee;
  const pasoBruto = Math.round(clamp(deltaTdee * C.FACTOR, -C.PASO_MAX, C.PASO_MAX) / 10) * 10;
  const paso = Math.abs(pasoBruto) < C.ZONA_MUERTA ? 0 : pasoBruto;
  const nuevoAjuste = clamp(ajusteActual + paso, -AJUSTE_MAX, AJUSTE_MAX);
  const planNuevo = calorias({ ...p, nutri: { ...n, ajusteKcal: nuevoAjuste } }, opt);
  const diffKcal = planNuevo.kcal - planActual.kcal;
  // Por qué no cambia nada: ritmo alineado (zona muerta), suelo de seguridad o tope de ±500 kcal.
  const motivo = diffKcal !== 0 ? 'ajuste' : paso === 0 ? 'alineado' : nuevoAjuste === ajusteActual ? 'tope' : 'suelo';
  return { estado: 'listo', mediaPesoAct, mediaPesoAnt, cambioSemKg, ritmoObjKg, mediaKcal, diasComida, pesajesAct, pesajesAnt, tdeeReal, deltaTdee, paso, planActual, planNuevo, ajusteActual, nuevoAjuste: diffKcal === 0 ? ajusteActual : nuevoAjuste, ajusteCalculado: nuevoAjuste, diffKcal, motivo };
}

// Entrada del historial (users/{uid}.nutri.historialCheckin, últimos 8).
export function nutriTrasCheckin(nutri, { hoyISO, kcalAntes, kcalDespues, ajusteKcal, mediaPeso }) {
  const n = nutri || {}, prev = Array.isArray(n.historialCheckin) ? n.historialCheckin : [];
  const entrada = { fecha: hoyISO, kcalAntes: Math.round(kcalAntes), kcalDespues: Math.round(kcalDespues), ajusteKcal: Math.round(ajusteKcal), mediaPeso: Math.round(mediaPeso * 10) / 10 };
  return { ...n, ajusteKcal: Math.round(ajusteKcal), ultimoCheckin: hoyISO, historialCheckin: [...prev, entrada].slice(-CHECKIN.HISTORIAL) };
}
