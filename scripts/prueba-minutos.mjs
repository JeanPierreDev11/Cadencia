// Pruebas del volumen de fuerza según los minutos por sesión (js/entreno.js, Fase B paso 4 (73)). Uso: node scripts/prueba-minutos.mjs
import * as E from '../js/entreno.js';

let ok = 0, ko = 0;
const t = (nombre, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('FALLO:', nombre, extra); } };
const fuerza = (R) => R.dias.map((d) => R.sesiones[d]).filter((s) => s.t === 'fuerza');
const nEj = (s) => s.ej.filter((e) => !E.exCardio(e)).length;
const series = (s) => s.ej.filter((e) => !E.exCardio(e)).map((e) => e.series);
const rut = (extra, goals = ['musculo']) => E.proponerRutina({ tipos: ['fuerza'], dias: [0, 2, 4, 5], split: 'auto', exp: 'anio', equipo: null, sexo: 'hombre', ...extra }, goals);
const ESPERADO = { 15: 3, 30: 4, 45: 5, 60: 6, 90: 8 };

// 1) Intermedio, gimnasio completo: nº de ejercicios por sesión, en tren inferior prioritario y equilibrado.
for (const prio of ['inferior', 'equilibrado']) {
  let prev = 0;
  for (const m of E.MINUTOS) {
    const R = rut({ prio, minutos: m }), ses = fuerza(R), ns = ses.map(nEj);
    t(`${prio} ${m} min: ${ESPERADO[m]} ejercicios por sesión`, ns.every((n) => n === ESPERADO[m]), ns.join(','));
    t(`${prio} ${m} min: R.minutos`, R.minutos === m);
    t(`${prio} ${m} min: sin sesiones vacías`, ses.length === 4 && ses.every((s) => nEj(s) > 0));
    t(`${prio} ${m} min: sin ejercicios repetidos en una sesión`, ses.every((s) => new Set(s.ej.map((e) => e.n)).size === s.ej.length));
    const sMax = Math.max(...ses.flatMap(series)), sMin = Math.min(...ses.flatMap(series));
    if (m <= 45) t(`${prio} ${m} min: 3 series como máximo`, sMax <= 3, String(sMax));
    if (m === 15) t(`${prio} 15 min: 2-3 series`, sMin >= 2 && sMax <= 3);
    if (m >= 60) t(`${prio} ${m} min: 3-4 series`, sMin >= 3 && sMax <= 4, `${sMin}-${sMax}`);
    t(`${prio} ${m} min: escala (no baja al subir minutos)`, ns[0] >= prev);
    prev = ns[0];
  }
}

// 2) Sin minutos = 60 (comportamiento de siempre); valores raros también 60.
{
  const a = rut({ prio: 'equilibrado' }), b = rut({ prio: 'equilibrado', minutos: 60 }), c = rut({ prio: 'equilibrado', minutos: 37 });
  t('sin minutos = 60', JSON.stringify(a.sesiones) === JSON.stringify(b.sesiones) && a.minutos === 60);
  t('minutos raros = 60', JSON.stringify(c.sesiones) === JSON.stringify(b.sesiones) && c.minutos === 60);
  t('minutosDe', E.minutosDe('30') === 30 && E.minutosDe(null) === 60 && E.minutosDe(120) === 60);
}

// 3) 15 min: los 3 ejercicios son básicos del día (ningún accesorio si el día tiene básicos suficientes).
{
  const R = rut({ prio: 'equilibrado', minutos: 15 }), ACC = new Set(['biceps', 'triceps', 'elev_lat', 'gemelos', 'core', 'aperturas', 'posterior', 'antebrazo']);
  const acc = fuerza(R).flatMap((s) => s.ej.map((e) => E.ejercicio(e.n)).filter((x) => x && ACC.has(x.p)));
  t('15 min: solo básicos', acc.length === 0, acc.map((x) => x.n).join(', '));
}

// 4) Principiante: nunca más ejercicios en menos tiempo que a 60 min (a 60 min hace 4).
{
  const n = (m) => fuerza(rut({ exp: 'nuevo', prio: 'equilibrado', minutos: m })).map(nEj);
  t('principiante 15 = 3', n(15).every((x) => x === 3));
  t('principiante 30-60 = 4', [30, 45, 60].every((m) => n(m).every((x) => x === 4)));
  t('principiante 90 = 7', n(90).every((x) => x === 7), n(90).join(','));
}

// 5) Material limitado y todos los splits: nunca sesiones vacías.
{
  const eqs = [null, E.expandirEquipo(['mancuernas']), E.expandirEquipo(['ninguno']), E.expandirEquipo(['banda']), E.expandirEquipo(['maquina'])];
  let vacias = 0, casos = 0;
  for (const m of E.MINUTOS) for (const equipo of eqs) for (const prio of ['inferior', 'equilibrado', 'torso', 'brazos']) for (const dias of [[0], [0, 3], [0, 2, 4], [0, 1, 3, 5, 6], [0, 1, 2, 4, 5, 6]]) for (const exp of ['nuevo', 'anio', 'compite']) {
    const R = E.proponerRutina({ tipos: ['fuerza'], dias, split: 'auto', exp, equipo, prio, sexo: 'mujer', minutos: m }, ['perder']);
    for (const s of fuerza(R)) { casos++; if (!nEj(s)) vacias++; }
  }
  t(`material limitado: 0 sesiones vacías (${casos} sesiones)`, vacias === 0, String(vacias));
}

// 6) Cardio final (perder grasa): no se añade con 15-30 min; sí con 45 o más.
{
  const card = (m) => fuerza(rut({ prio: 'equilibrado', minutos: m }, ['perder'])).filter((s) => s.ej.some((e) => E.exCardio(e))).length;
  t('perder grasa 15 min: sin cardio final', card(15) === 0);
  t('perder grasa 30 min: sin cardio final', card(30) === 0);
  t('perder grasa 45 min: con cardio final', card(45) > 0);
  t('perder grasa 60 min: con cardio final', card(60) > 0);
}

// 7) Rutina vacía (personalizada) también guarda los minutos.
t('rutinaVacia guarda minutos', E.rutinaVacia({ tipos: ['fuerza'], dias: [0, 2], minutos: 45 }, ['musculo']).minutos === 45);

console.log(`${ok} OK, ${ko} fallos`);
process.exit(ko ? 1 : 0);
