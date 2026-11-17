// Copia emparejamiento.json (nombre del ejercicio en la app → id de ExerciseDB) a js/ejercicios.js (línea IMGDB).
// Uso: node herramientas/exercisedb/aplicar.mjs   (los GIF deben estar ya en public/ejercicios/db/)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const emp = JSON.parse(readFileSync(join(RAIZ, 'herramientas/exercisedb/emparejamiento.json'), 'utf8'));
const sinGif = Object.entries(emp).filter(([, id]) => !['180', '360'].every((r) => existsSync(join(RAIZ, `public/ejercicios/db/${id}-${r}.webp`))));
if (sinGif.length) { console.error('Faltan GIF para:', sinGif.map(([n, id]) => `${n} (${id})`).join(', ')); process.exit(1); }

const f = join(RAIZ, 'js/ejercicios.js'), src = readFileSync(f, 'utf8');
const linea = `export const IMGDB = ${JSON.stringify(emp)};`;
if (!/^export const IMGDB = .*;$/m.test(src)) { console.error('No encuentro la línea IMGDB en js/ejercicios.js'); process.exit(1); }
writeFileSync(f, src.replace(/^export const IMGDB = .*;$/m, () => linea));
console.log(`IMGDB actualizado: ${Object.keys(emp).length} ejercicios.`);
