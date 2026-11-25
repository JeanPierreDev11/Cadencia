// node scripts/prueba-progreso.mjs — series semanales por músculo y progresión por ejercicio (77).
import assert from 'node:assert/strict';
import * as E from '../js/entreno.js';

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log('ok', nombre); };
const w = (fecha, ejercicios, extra = {}) => ({ id: 'w' + fecha + Math.random(), fecha, tipo: 'gym', ejercicios, ...extra });
const s = (kg, reps, extra = {}) => ({ kg, reps, ...extra });
const HOY = '2026-11-25'; // miércoles: semana 23–29, anterior 16–22

const banca = (series, extra = {}) => ({ n: 'Press banca', carga: 'total', series, ...extra });
const { p, s: sec } = E.musculosDet(E.ejercicio('Press banca'));
assert.ok(p.length && sec.length, 'press banca tiene principal y secundarios en el catálogo');
const de = (lista, k) => lista.find((f) => f.musculo === k);

t('excluye calentamiento, done:false y cardio; principal 1 y secundario 0,5', () => {
  const r = E.seriesSemanalesPorMusculo([w('2026-11-24', [
    banca([s(40, 10, { w: true }), s(80, 8), s(80, 8, { done: true }), s(80, 8), s(80, 8, { done: false })]),
    { n: 'Caminadora / Cinta de correr', tipo: 'cardio', series: [{ tiempo: 30, completada: true }] },
  ])], HOY);
  for (const k of p) assert.equal(de(r, k).series, 3);
  for (const k of sec) assert.equal(de(r, k).series, 1.5);
  assert.equal(r.length, new Set([...p, ...sec]).size, 'el cardio no añade músculos');
  assert.equal(de(r, p[0]).etiqueta, E.MUSC_DET[p[0]]);
  assert.ok(r.every((f, i) => !i || r[i - 1].series >= f.series), 'ordenado de mayor a menor');
});

t('delta semanal: semana en curso frente a la anterior completa', () => {
  const ws = [w('2026-11-23', [banca([s(80, 8), s(80, 8)])]), w('2026-11-29', [banca([s(80, 8)])]),
    w('2026-11-16', [banca([s(80, 8)])]), w('2026-11-22', [banca([s(80, 8), s(80, 8), s(80, 8), s(80, 8)])]),
    w('2026-11-15', [banca([s(80, 8)])])];
  const f = de(E.seriesSemanalesPorMusculo(ws, HOY), p[0]);
  assert.deepEqual([f.series, f.seriesAnt, f.delta], [3, 5, -2]);
});

t("ventana '7d': 19–25 frente a 12–18", () => {
  const ws = [w('2026-11-19', [banca([s(80, 8)])]), w('2026-11-25', [banca([s(80, 8)])]),
    w('2026-11-18', [banca([s(80, 8)])]), w('2026-11-12', [banca([s(80, 8)])]), w('2026-11-11', [banca([s(80, 8)])]), w('2026-11-26', [banca([s(80, 8)])])];
  const f = de(E.seriesSemanalesPorMusculo(ws, HOY, '7d'), p[0]);
  assert.deepEqual([f.series, f.seriesAnt, f.delta], [2, 2, 0]);
});

t('músculo sin series este periodo pero sí en el anterior sigue en la lista', () => {
  const f = de(E.seriesSemanalesPorMusculo([w('2026-11-17', [banca([s(80, 8)])])], HOY), p[0]);
  assert.deepEqual([f.series, f.delta], [0, -1]);
  assert.deepEqual(E.seriesSemanalesPorMusculo([], HOY), []);
});

const opt = { hoy: HOY };
t('progresión bilateral total: puntos cronológicos, 1RM, peso, volumen y resumen', () => {
  const ws = [w('2026-11-20', [banca([s(40, 10, { w: true }), s(85, 5), s(80, 8), s(80, 8, { done: false })])]),
    w('2026-11-10', [banca([s(80, 8), s(80, 8), s(80, 7)])])];
  const r = E.progresionEjercicio(ws, 'press BANCA', 'todo', opt);
  assert.deepEqual(r.puntos.map((x) => x.fecha), ['2026-11-10', '2026-11-20']);
  const [a, b] = r.puntos;
  assert.equal(a.pesoMax, 80); assert.equal(a.volumen, 80 * 23); assert.equal(a.detalleSeries, '80 kg × 8, 8, 7'); assert.equal(a.fechaCorta, '10 nov');
  assert.equal(a.orm1, Math.round(E.orm1(80, 8) * 10) / 10);
  assert.equal(b.pesoMax, 85); assert.equal(b.volumen, 85 * 5 + 80 * 8); assert.equal(b.detalleSeries, '85 kg × 5 · 80 kg × 8');
  assert.equal(b.mejorSerieTexto, '80 kg × 8');
  assert.equal(r.porLado, false);
  assert.equal(r.resumen.mejorPeso, 85); assert.equal(r.resumen.mejorVolumen, 1840);
  const peso = E.progresionEjercicio(ws, 'Press banca', 'todo', { hoy: HOY, metrica: 'peso' }).resumen;
  assert.deepEqual([peso.ultimoValor, peso.deltaAbs, peso.deltaPct], [85, 5, 6.3]);
});

t('por_lado: peso registrado, volumen ×2 y coma decimal', () => {
  const r = E.progresionEjercicio([w(HOY, [{ n: 'Press con mancuernas', carga: 'por_lado', series: [s(22.5, 10), s(22.5, 9)] }])], 'Press con mancuernas', 'todo', opt);
  const [a] = r.puntos;
  assert.equal(a.pesoMax, 22.5); assert.equal(a.volumen, 22.5 * 2 * 19); assert.equal(a.porLado, true);
  assert.equal(a.detalleSeries, '22,5 kg c/u × 10, 9'); assert.equal(r.porLado, true);
});

t('unilateral: mayor de los dos lados para 1RM y peso, suma para volumen', () => {
  const r = E.progresionEjercicio([w(HOY, [{ n: 'Remo con mancuerna', uni: true, carga: 'total', series: [s(30, 10, { kgD: 32, repsD: 8 }), s(30, 10, { kgD: '', repsD: null })] }])], 'Remo con mancuerna', 'todo', opt);
  const [a] = r.puntos;
  assert.equal(a.pesoMax, 32);
  assert.equal(a.orm1, Math.round(Math.max(E.orm1(30, 10), E.orm1(32, 8)) * 10) / 10);
  assert.equal(a.volumen, 300 + 256 + 300 + 300);
  assert.equal(a.detalleSeries, 'Izq. 30 kg × 10, 10 / Der. 32 kg × 8 · 30 kg × 10');
});

t('rangos 1m, 3m y todo', () => {
  const ws = ['2025-12-01', '2026-08-27', '2026-10-26', '2026-10-27', HOY].map((f) => w(f, [banca([s(80, 8)])]));
  const fechas = (rg) => E.progresionEjercicio(ws, 'Press banca', rg, opt).puntos.map((x) => x.fecha);
  assert.deepEqual(fechas('1m'), ['2026-10-27', HOY]);
  assert.deepEqual(fechas('3m'), ['2026-08-27', '2026-10-26', '2026-10-27', HOY]);
  assert.equal(fechas('todo').length, 5);
  const r = E.progresionEjercicio(ws, 'Press banca', '1m', opt);
  assert.equal(r.total, 5);
  assert.equal(r.puntos[0].fechaCorta, '27 oct');
  assert.equal(E.progresionEjercicio(ws, 'Press banca', 'todo', opt).puntos[0].fechaCorta, '1 dic 2025');
});

t('peso corporal, más de 12 reps y ejercicio sin datos', () => {
  const r = E.progresionEjercicio([w(HOY, [{ n: 'Dominadas', series: [s(0, 10), s(0, 8)] }])], 'Dominadas', 'todo', opt);
  assert.deepEqual([r.puntos[0].orm1, r.puntos[0].pesoMax, r.puntos[0].detalleSeries], [null, 0, '10, 8 reps']);
  assert.deepEqual(r.conDatos, []);
  assert.equal(r.resumen.ultimoValor, null);
  assert.equal(E.progresionEjercicio([], 'Press banca', 'todo', opt).total, 0);
});

console.log(`\n${n} pruebas OK`);
