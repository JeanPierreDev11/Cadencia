import assert from 'node:assert/strict';
import { calcularDiscos } from '../js/entreno.js';
const txt = (r) => r.porLado.map((d) => `${d.n}x${d.kg}`).join(' ');
// 1. Exacto con barra de 20 kg
let r = calcularDiscos(82.5, 20);
assert.equal(r.pesoPorLado, 31.25); assert.equal(r.pesoReal, 82.5); assert.equal(r.diferencia, 0); assert.equal(r.menorQueBarra, false);
assert.equal(txt(r), '1x25 1x5 1x1.25');
r = calcularDiscos(100, 20); assert.equal(txt(r), '1x25 1x15'); assert.equal(r.pesoReal, 100);
r = calcularDiscos(20, 20); assert.deepEqual(r.porLado, []); assert.equal(r.pesoReal, 20); assert.equal(r.diferencia, 0);
// 2. Sin barra (0 kg)
r = calcularDiscos(50, 0); assert.equal(r.pesoPorLado, 25); assert.equal(txt(r), '1x25'); assert.equal(r.pesoReal, 50);
r = calcularDiscos(0, 0); assert.deepEqual(r.porLado, []); assert.equal(r.pesoReal, 0);
// 3. Peso menor que la barra
r = calcularDiscos(15, 20); assert.equal(r.menorQueBarra, true); assert.deepEqual(r.porLado, []); assert.equal(r.pesoReal, 20); assert.equal(r.diferencia, 5);
// 4. No exacto: el más cercano (empate → el de abajo)
r = calcularDiscos(83, 20); assert.equal(r.pesoReal, 82.5); assert.equal(r.diferencia, -0.5);
r = calcularDiscos(83.75, 20, [25, 20, 15, 10, 5, 2.5]); // lado 31,875 → 30 o 32,5: 32,5 más cerca
assert.equal(r.pesoReal, 85); assert.equal(r.diferencia, 1.25);
r = calcularDiscos(81.25, 20, [25, 20, 15, 10, 5, 2.5]); // lado 30,625 → 30 (a 0,625) o 32,5 (a 1,875)
assert.equal(r.pesoReal, 80); assert.equal(r.diferencia, -1.25);
// 5. Desmarcando los discos de 25 kg
r = calcularDiscos(120, 20, [20, 15, 10, 5, 2.5, 1.25]); assert.equal(txt(r), '2x20 1x10'); assert.equal(r.pesoReal, 120);
assert.ok(r.porLado.every((d) => d.kg !== 25));
// Sin greedy: 30 por lado solo con 20 y 15 → 2 × 15
r = calcularDiscos(80, 20, [20, 15]); assert.equal(txt(r), '2x15'); assert.equal(r.diferencia, 0);
// Sin discos disponibles → solo la barra
r = calcularDiscos(60, 20, []); assert.equal(r.pesoReal, 20); assert.equal(r.diferencia, -40);
// Entradas basura
r = calcularDiscos('abc', 20); assert.equal(r.menorQueBarra, true);
console.log('calcularDiscos: todas las pruebas OK');
