// Descarga datos de ExerciseDB (RapidAPI) con la clave del secreto RAPIDAPI_KEY.
// Lo lanza el proceso de GitHub «Descargar ejercicios de ExerciseDB»; la acción sale de orden.json.
//
//   {"accion": "catalogo"}  → guarda la lista completa (sin GIF) en catalogo.json
//   {"accion": "gifs"}      → baja las imágenes de los ids de emparejamiento.json
//   {"accion": "todos"}     → baja las imágenes de TODOS los ids de catalogo.json (≈1.400 peticiones)
//
// La clave solo viaja en la cabecera de cada petición. Nunca se escribe en ningún fichero ni en el registro.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, mkdtempSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const HOST = 'exercisedb.p.rapidapi.com';
const CLAVE = process.env.RAPIDAPI_KEY;
const PAUSA_MS = 700;                  // límite del plan: 120 peticiones por minuto
let peticiones = 0;

if (!CLAVE) { console.error('Falta el secreto RAPIDAPI_KEY en GitHub (Settings › Secrets and variables › Actions).'); process.exit(1); }

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(ruta, intento = 1) {
  peticiones++;
  const r = await fetch(`https://${HOST}${ruta}`, { headers: { 'x-rapidapi-key': CLAVE, 'x-rapidapi-host': HOST } });
  if (r.status === 429 && intento < 5) { await dormir(5000 * intento); return pedir(ruta, intento + 1); }
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`HTTP ${r.status} en ${ruta.split('?')[0]}: ${txt}`);
  }
  return r;
}

async function catalogo() {
  const todos = [];
  const LIMITE = 100;                   // si el servidor da menos por página, se sigue igual
  for (let offset = 0; ; ) {
    const lote = await (await pedir(`/exercises?limit=${LIMITE}&offset=${offset}`)).json();
    if (!Array.isArray(lote) || !lote.length) break;
    for (const e of lote) {
      todos.push({
        id: String(e.id), name: e.name, bodyPart: e.bodyPart, target: e.target,
        secondaryMuscles: e.secondaryMuscles || [], equipment: e.equipment,
      });
    }
    offset += lote.length;
    if (offset % 500 < lote.length) console.log(`  ${offset} ejercicios…`);
    await dormir(PAUSA_MS);
  }
  const unicos = [...new Map(todos.map((e) => [e.id, e])).values()];
  writeFileSync(join(AQUI, 'catalogo.json'), JSON.stringify(unicos));
  console.log(`Catálogo: ${unicos.length} ejercicios (${peticiones} peticiones).`);
  if (unicos.length < 500) { console.error('Pocos ejercicios: revisa el plan o la clave.'); process.exit(1); }
}

// Baja el GIF de 360 px de cada id, le quita el fondo blanco (procesar.py) y guarda SOLO los WebP:
// public/ejercicios/db/<id>-360.webp (animado, transparente) y <id>-180.webp (primer fotograma, para listas).
async function bajar(ids) {
  const dir = join(RAIZ, 'public', 'ejercicios', 'db');
  mkdirSync(dir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'exdb-'));
  const fallos = [];
  let nuevos = 0, bytes = 0, hechos = 0;
  for (const id of ids) {
    const f360 = join(dir, `${id}-360.webp`), f180 = join(dir, `${id}-180.webp`);
    if (existsSync(f360) && existsSync(f180)) continue;
    try {
      const r = await pedir(`/image?exerciseId=${encodeURIComponent(id)}&resolution=360`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1000 || buf.subarray(0, 3).toString() !== 'GIF') throw new Error(`no es un GIF (${buf.length} bytes, ${r.headers.get('content-type')})`);
      const gif = join(tmp, `${id}.gif`);
      writeFileSync(gif, buf);
      execFileSync('python3', [join(AQUI, 'procesar.py'), gif, f360, f180], { stdio: 'pipe' });
      unlinkSync(gif);
      bytes += statSync(f360).size + statSync(f180).size; nuevos++;
    } catch (e) { fallos.push(`${id}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
    if (++hechos % 100 === 0) console.log(`  ${hechos} ejercicios… (${nuevos} nuevos, ${fallos.length} fallos, ${peticiones} peticiones)`);
    await dormir(PAUSA_MS);
  }
  console.log(`Imágenes nuevas: ${nuevos} (${(bytes / 1048576).toFixed(1)} MB), ${peticiones} peticiones, ${fallos.length} fallos.`);
  if (fallos.length) {
    writeFileSync(join(AQUI, 'fallos.json'), JSON.stringify(fallos, null, 1));
    console.error(fallos.slice(0, 30).join('\n'));
    if (fallos.length > Math.max(5, ids.length * 0.03)) process.exit(1);   // pocos fallos: se guarda lo hecho y se repite luego
  }
}

const gifs = () => bajar([...new Set(Object.values(JSON.parse(readFileSync(join(AQUI, 'emparejamiento.json'), 'utf8'))).map(String))]);
const todos = () => bajar(JSON.parse(readFileSync(join(AQUI, 'catalogo.json'), 'utf8')).map((e) => e.id));

const { accion } = JSON.parse(readFileSync(join(AQUI, 'orden.json'), 'utf8'));
if (accion === 'catalogo') await catalogo();
else if (accion === 'gifs') await gifs();
else if (accion === 'todos') await todos();
else { console.error(`Acción desconocida en orden.json: ${accion}`); process.exit(1); }
