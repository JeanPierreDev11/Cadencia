// Descarga datos de ExerciseDB (RapidAPI) con la clave del secreto RAPIDAPI_KEY.
// Lo lanza el proceso de GitHub «Descargar ejercicios de ExerciseDB»; la acción sale de orden.json.
//
//   {"accion": "catalogo"}  → guarda la lista completa (sin GIF) en catalogo.json
//   {"accion": "gifs"}      → baja los GIF de los ids de emparejamiento.json
//
// La clave solo viaja en la cabecera de cada petición. Nunca se escribe en ningún fichero ni en el registro.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const HOST = 'exercisedb.p.rapidapi.com';
const CLAVE = process.env.RAPIDAPI_KEY;
const RESOLUCIONES = [180, 360];       // el plan Pro llega hasta 360
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

async function gifs() {
  const emp = JSON.parse(readFileSync(join(AQUI, 'emparejamiento.json'), 'utf8'));
  const ids = [...new Set(Object.values(emp).map(String))];
  const dir = join(RAIZ, 'public', 'ejercicios', 'db');
  mkdirSync(dir, { recursive: true });
  const fallos = [];
  let bytes = 0, nuevos = 0;
  for (const id of ids) {
    for (const res of RESOLUCIONES) {
      const fichero = join(dir, `${id}-${res}.gif`);
      if (existsSync(fichero) && statSync(fichero).size > 1000) continue;
      try {
        const r = await pedir(`/image?exerciseId=${encodeURIComponent(id)}&resolution=${res}`);
        const buf = Buffer.from(await r.arrayBuffer());
        const esGif = buf.length > 1000 && buf.subarray(0, 3).toString() === 'GIF';
        if (!esGif) throw new Error(`no es un GIF (${buf.length} bytes, ${r.headers.get('content-type')})`);
        writeFileSync(fichero, buf); bytes += buf.length; nuevos++;
      } catch (e) { fallos.push(`${id}@${res}: ${e.message}`); }
      await dormir(PAUSA_MS);
    }
  }
  console.log(`GIF nuevos: ${nuevos} (${(bytes / 1048576).toFixed(1)} MB), ${peticiones} peticiones, ${fallos.length} fallos.`);
  if (fallos.length) { console.error(fallos.join('\n')); process.exit(1); }
}

const { accion } = JSON.parse(readFileSync(join(AQUI, 'orden.json'), 'utf8'));
if (accion === 'catalogo') await catalogo();
else if (accion === 'gifs') await gifs();
else { console.error(`Acción desconocida en orden.json: ${accion}`); process.exit(1); }
