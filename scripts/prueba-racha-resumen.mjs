// node scripts/prueba-racha-resumen.mjs — racha semanal y resumen mensual (78).
import assert from 'node:assert/strict';
import * as E from '../js/entreno.js';

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log('ok', nombre); };
const w = (fecha, ejercicios = [], extra = {}) => ({ id: 'w' + fecha + Math.random(), fecha, tipo: 'gym', ejercicios, ...extra });
const s = (kg, reps, extra = {}) => ({ kg, reps, ...extra });
const HOY = '2026-11-25'; // miércoles; lunes de la semana = 23
const semana = (lunes, dias) => Array.from({ length: dias }, (_, i) => w(E.addDays(lunes, i)));
const previas = [...semana('2026-11-02', 5), ...semana('2026-11-09', 5), ...semana('2026-11-16', 5)];
const racha = (ws, obj = 5, hoy = HOY) => E.calcularRachaSemanal(ws, obj, hoy);

t('1) semana en curso incompleta (2/5) no rompe la racha de 3', () => {
  const r = racha([...previas, ...semana('2026-11-23', 2)]);
  assert.deepEqual(r, { rachaActual: 3, mejorRacha: 3, diasActual: 2, objetivo: 5, actualCumplida: false, faltanDias: 3 });
});
t('2) semana en curso completada (5/5) suma al momento', () => {
  const r = racha([...previas, ...semana('2026-11-23', 5)], 5, '2026-11-27');
  assert.equal(r.rachaActual, 4); assert.equal(r.actualCumplida, true); assert.equal(r.faltanDias, 0); assert.equal(r.mejorRacha, 4);
});
t('3) una semana pasada incompleta corta la actual y conserva la mejor', () => {
  const r = racha([...semana('2026-10-19', 5), ...semana('2026-10-26', 5), ...semana('2026-11-02', 5), ...semana('2026-11-09', 4), ...semana('2026-11-16', 5)]);
  assert.equal(r.rachaActual, 1); assert.equal(r.mejorRacha, 3);
});
t('4) varios entrenos el mismo día cuentan como un día', () => {
  const r = racha([w('2026-11-23'), w('2026-11-23'), w('2026-11-23'), w('2026-11-24')]);
  assert.equal(r.diasActual, 2);
});
t('objetivo acotado a 1–7, sin datos y domingo como fin de semana', () => {
  assert.equal(racha([], 0).objetivo, 4); assert.equal(racha([], 12).objetivo, 7); assert.equal(racha([], -2).objetivo, 1);
  assert.deepEqual([racha([]).rachaActual, racha([]).mejorRacha], [0, 0]);
  assert.equal(racha([w('2026-11-22')], 1).rachaActual, 1);
  assert.equal(racha([w('2026-11-22')], 1).diasActual, 0);
});

const banca = (series, extra = {}) => ({ n: 'Press banca', carga: 'total', series, ...extra });
const nov = [
  w('2026-11-03', [banca([s(40, 10, { w: true }), s(80, 8), s(80, 8), s(100, 1, { done: false })]),
    { n: 'Caminadora / Cinta de correr', tipo: 'cardio', series: [{ tiempo: 20, completada: true }] }], { min: 50 }),
  w('2026-11-03', [{ n: 'Press con mancuernas', carga: 'por_lado', series: [s(22.5, 10)] }], { min: 10 }),
  w('2026-11-05', [{ n: 'Remo con mancuerna', carga: 'total', uni: true, series: [s(30, 10, { kgD: 32, repsD: 8 })] },
    { n: 'Sentadilla con barra', series: [s(120, 5), s(120, 5), s(120, 5)] }]),
];
const pesos = [{ fecha: '2026-11-20', kg: 78.8 }, { fecha: '2026-10-31', kg: 90 }, { fecha: '2026-11-01', kg: 80 }];
const res = (mes = '2026-11', ws = [...nov, w('2026-10-30', [banca([s(200, 1)])])], p = pesos) => E.resumenMensual(ws, p, mes, 2, HOY);

t('resumen: sesiones, días, series sin calentamiento ni cardio, minutos', () => {
  const r = res();
  assert.deepEqual([r.totalEntrenos, r.diasUnicos, r.seriesEfectivas], [3, 2, 7]);
  assert.equal(r.minutosTotales, 50 + 10 + 4 * 3);
});
t('resumen: volumen con carga por lado y unilateral', () => {
  assert.equal(res().volumenKg, 80 * 16 + 22.5 * 2 * 10 + (30 * 10 + 32 * 8) + 120 * 15);
});
t('resumen: top 3 músculos igual que el Paso 2', () => {
  const m = res().topMusculos, todos = {};
  for (const f of ['2026-11-03', '2026-11-05']) for (const x of E.seriesSemanalesPorMusculo(nov.filter((q) => q.fecha === f), f)) todos[x.musculo] = (todos[x.musculo] || 0) + x.series;
  assert.equal(m.length, 3);
  assert.deepEqual(m.map((x) => x.series), Object.values(todos).sort((a, b) => b - a).slice(0, 3));
  for (const x of m) { assert.equal(x.series, todos[x.musculo]); assert.equal(x.etiqueta, E.MUSC_DET[x.musculo]); }
});
t('resumen: top 3 ejercicios con su mejor serie en formato español', () => {
  const r = res().topEjercicios;
  assert.deepEqual(r.map((x) => x.texto), ['120 kg × 5', '80 kg × 8', '32 kg por lado × 8']);
  const solo = E.resumenMensual([nov[1]], [], '2026-11', 4, HOY).topEjercicios[0];
  assert.equal(solo.texto, '22,5 kg c/u × 10');
});
t('resumen: delta de peso (null con menos de 2)', () => {
  assert.equal(res().pesoDelta, '−1,2 kg');
  assert.equal(res('2026-11', nov, [{ fecha: '2026-11-01', kg: 80 }, { fecha: '2026-11-30', kg: 80.8 }]).pesoDelta, '+0,8 kg');
  assert.equal(res('2026-10').pesoDelta, null);
});
t('resumen: semanas por su jueves; la semana en curso solo si está cumplida', () => {
  const r = res(); // jueves de noviembre: 5, 12, 19 y 26 (esta última en curso)
  assert.deepEqual([r.semanasCumplidas, r.semanasTotales], [1, 3]);
  const c = E.resumenMensual([w('2026-11-23'), w('2026-11-24')], [], '2026-11', 2, HOY);
  assert.deepEqual([c.semanasCumplidas, c.semanasTotales], [1, 4]);
});
t('resumen: mes vacío sin errores', () => {
  const r = E.resumenMensual([], [], '2026-09', 4, HOY);
  assert.deepEqual([r.totalEntrenos, r.volumenKg, r.minutosTotales, r.topMusculos, r.topEjercicios, r.pesoDelta], [0, 0, 0, [], [], null]);
});
t('meses disponibles: descendentes, con el actual y el anterior si hay datos', () => {
  assert.deepEqual(E.mesesDisponibles([w('2026-08-02'), w('2026-06-01'), w('2026-08-30')], HOY), ['2026-11', '2026-10', '2026-08', '2026-06']);
  assert.deepEqual(E.mesesDisponibles([], HOY), []);
  assert.equal(E.mesAnterior('2027-01'), '2026-12');
});
console.log(`${n} pruebas correctas`);
