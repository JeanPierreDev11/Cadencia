// Genera catalogo.json (la tabla de alimentos de la app) para que la IA elija entre ellos.
// Ejecutar desde esta carpeta tras cambiar js/alimentos.js:  node generar-catalogo.mjs
import { writeFileSync } from 'node:fs';
import { FOODS, PREP, prepOf } from '../js/alimentos.js';

const grupoDe = (f) => { const p = prepOf(f); return p ? Object.keys(PREP).find((g) => PREP[g] === p) : ''; };
const alimentos = FOODS.map((f) => [f.id, f.n, grupoDe(f), f.u ? `${f.u.n}=${f.u.g}g` : '']);
const preparaciones = Object.fromEntries(Object.entries(PREP).map(([g, arr]) => [g, arr.map((m) => [m.id, m.n])]));
writeFileSync(new URL('./catalogo.json', import.meta.url), JSON.stringify({ alimentos, preparaciones }));
console.log(`${alimentos.length} alimentos, ${Object.keys(preparaciones).length} grupos de preparación`);
