// node scripts/prueba-pr.mjs — detección de récords personales (79).
import assert from 'node:assert/strict';
import * as E from '../js/entreno.js';

let n = 0, id = 0;
const t = (nombre, fn) => { fn(); n++; console.log('ok', nombre); };
const w = (fecha, ejercicios) => ({ id: 'w' + (++id), fecha, tipo: 'gym', ejercicios });
const s = (kg, reps, extra = {}) => ({ kg, reps, ...extra });
const banca = (series, extra = {}) => ({ n: 'Press banca', carga: 'total', series, ...extra });
const tipos = (prs) => prs.map((p) => p.tipo);

const base = w('2026-11-01', [banca([s(100, 3)])]);

t('1) mismo peso, más repeticiones → 1RM est.', () => {
  const hoy = w('2026-11-20', [banca([s(100, 6)])]);
  const prs = E.detectarNuevosPR(hoy, [base]);
  assert.deepEqual(tipos(prs), ['1RM est.']);
  assert.deepEqual([prs[0].ejercicio, prs[0].valorAnterior, prs[0].valorNuevo, prs[0].mejoraAbs, prs[0].serieTexto, prs[0].fecha],
    [E.canon('Press banca'), 105.9, 116.1, 10.2, '100 kg × 6', '2026-11-20']);
});

t('2) más peso → Peso máximo', () => {
  const prs = E.detectarNuevosPR(w('2026-11-20', [banca([s(102.5, 1)])]), [base]); // 1RM 102,5 < 105,9: solo peso
  assert.deepEqual(tipos(prs), ['Peso máximo']);
  assert.deepEqual([prs[0].valorNuevo, prs[0].valorAnterior, prs[0].mejoraAbs, prs[0].serieTexto], [102.5, 100, 2.5, '102,5 kg × 1']);
  assert.deepEqual(tipos(E.detectarNuevosPR(w('2026-11-20', [banca([s(105, 3)])]), [base])), ['1RM est.', 'Peso máximo']);
});

t('3) por lado y unilateral kgD/repsD: gana el mejor lado', () => {
  const nom = 'Press con mancuernas';
  const antes = w('2026-11-01', [{ n: nom, carga: 'por_lado', series: [s(20, 8)] }]);
  const prs = E.detectarNuevosPR(w('2026-11-20', [{ n: nom, carga: 'por_lado', series: [s(22.5, 8)] }]), [antes]);
  assert.deepEqual(tipos(prs), ['1RM est.', 'Peso máximo']);
  assert.ok(prs.every((p) => p.porLado && p.serieTexto === '22,5 kg por lado × 8'), JSON.stringify(prs));

  const remo = (series) => ({ n: 'Remo con mancuerna', carga: 'total', uni: true, series });
  const u = E.detectarNuevosPR(w('2026-11-20', [remo([s(30, 8, { kgD: 32.5, repsD: 9 })])]), [w('2026-11-01', [remo([s(30, 8)])])]);
  assert.deepEqual(tipos(u), ['1RM est.', 'Peso máximo']);
  assert.ok(u.every((p) => p.serieTexto === '32,5 kg por lado × 9'), JSON.stringify(u));
  assert.equal(u[1].mejoraAbs, 2.5);
});

t('4) primera vez sin historial → []', () => {
  const hoy = w('2026-11-20', [banca([s(100, 5)])]);
  assert.deepEqual(E.detectarNuevosPR(hoy, []), []);
  assert.deepEqual(E.detectarNuevosPR(hoy, [w('2026-11-01', [{ n: 'Sentadilla con barra', series: [s(60, 5)] }])]), []);
  // un historial solo de calentamiento o de series sin completar tampoco cuenta
  assert.deepEqual(E.detectarNuevosPR(hoy, [w('2026-11-01', [banca([s(40, 5, { w: true }), s(60, 5, { done: false })])])]), []);
});

t('5) mismo peso y repeticiones → []', () => {
  assert.deepEqual(E.detectarNuevosPR(w('2026-11-20', [banca([s(100, 3)])]), [base]), []);
});

t('el propio entreno no cuenta como historial (edición)', () => {
  const hoy = w('2026-11-20', [banca([s(105, 3)])]);
  assert.equal(E.detectarNuevosPR(hoy, [base, hoy, { ...hoy }]).length, 2);
});

t('calentamiento y series sin completar de hoy no dan récord', () => {
  assert.deepEqual(E.detectarNuevosPR(w('2026-11-20', [banca([s(140, 3, { w: true }), s(130, 3, { done: false }), s(100, 3)])]), [base]), []);
});

t('+0,4 kg de 1RM no llega; más de 12 reps no da 1RM; cardio fuera', () => {
  const a = w('2026-11-01', [banca([s(100, 1)])]);
  assert.deepEqual(tipos(E.detectarNuevosPR(w('2026-11-20', [banca([s(100.4, 1)])]), [a])), ['Peso máximo']);
  assert.deepEqual(E.detectarNuevosPR(w('2026-11-20', [banca([s(90, 15)])]), [a]), []);
  const c = (km) => ({ n: 'Caminadora / Cinta de correr', tipo: 'cardio', series: [{ tiempo: km, completada: true }] });
  assert.deepEqual(E.detectarNuevosPR(w('2026-11-20', [c(60)]), [w('2026-11-01', [c(20)])]), []);
});

t('cambiar de «por lado» a total no inventa un récord', () => {
  const a = w('2026-11-01', [{ n: 'Press con mancuernas', carga: 'por_lado', series: [s(20, 8)] }]);
  assert.deepEqual(E.detectarNuevosPR(w('2026-11-20', [{ n: 'Press con mancuernas', carga: 'total', series: [s(40, 8)] }]), [a]), []);
});

t('mejorMarca: la mejor serie de siempre, o null', () => {
  const m = E.mejorMarca([w('2026-11-20', [banca([s(90, 5)])]), base], 'press banca');
  assert.deepEqual([m.kg, m.reps, m.fecha, m.porLado, m.tipo], [100, 3, '2026-11-01', false, null]);
  assert.equal(E.mejorMarca([base], 'Dominadas'), null);
});

console.log(`${n} pruebas OK`);
