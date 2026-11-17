// Genera js/ejercicios-db.js a partir del catálogo de ExerciseDB, los nombres en español y los emparejamientos.
// Uso: node herramientas/exercisedb/generar.mjs
// No lo edites a mano: el archivo generado se rehace entero cada vez.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const leer = (f) => JSON.parse(readFileSync(join(AQUI, f), 'utf8'));
const catalogo = leer('catalogo.json');
const nombres = leer('nombres-es.json');
const principales = leer('emparejamiento.json');   // ejercicios principales de la app → id (revisados a mano)
const auto = leer('emparejamiento-auto.json');     // el resto de la app → id (parecido alto)
const dup = leer('duplicados.json');               // repetidos: «principales» toman la imagen; «viejos» se retiran y quedan como alias del nuevo

// Nombres que ya existen en la app (sin las entradas de ExerciseDB generadas antes)
const { BIBLIOTECA } = await import(join(RAIZ, 'js', 'entreno.js'));
const { EXTRA } = await import(join(RAIZ, 'js', 'ejercicios.js'));
const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const existentes = new Map();
for (const x of BIBLIOTECA) existentes.set(norm(x.n), x.n);
for (const x of EXTRA) existentes.set(norm(x[0]), x[0]);
for (const n of ['Caminadora / Cinta de correr', 'Correr al aire libre', 'Bicicleta estática']) existentes.set(norm(n), n);

const IMGDB = {};
const cubiertos = new Set();
for (const mapa of [auto, principales]) for (const [n, id] of Object.entries(mapa)) { IMGDB[n] = id; cubiertos.add(id); }
for (const [n, id] of Object.entries(dup.principales)) { IMGDB[n] = id; cubiertos.add(id); }

const GRUPO = { pectorals: 'pecho', lats: 'espalda', 'upper back': 'espalda', spine: 'espalda', traps: 'espalda', 'levator scapulae': 'espalda', delts: 'hombro', biceps: 'biceps', triceps: 'triceps', forearms: 'antebrazo', quads: 'cuadriceps', hamstrings: 'femoral', glutes: 'gluteo', calves: 'gemelos', abs: 'core', adductors: 'aductores', abductors: 'abductores', 'serratus anterior': 'pecho' };
const COD = { pectorals: 'ch', lats: 'la', 'upper back': 'mb', spine: 'lb', traps: 'tp', 'levator scapulae': 'ne', delts: 'sh', biceps: 'bi', triceps: 'tr', forearms: 'fo', quads: 'qu', hamstrings: 'ha', glutes: 'gl', calves: 'ca', abs: 'ab', adductors: 'ad', abductors: 'abd', 'serratus anterior': 'ch' };
const SEC = (s) => {
  const t = String(s).toLowerCase();
  if (/shoulder|delt|rotator/.test(t)) return 'sh';
  if (/hamstring/.test(t)) return 'ha';
  if (/forearm|wrist|grip|hands/.test(t)) return 'fo';
  if (/tricep/.test(t)) return 'tr';
  if (/bicep|brachialis/.test(t)) return 'bi';
  if (/calf|calves|soleus|gastrocnemius|ankle|feet|tibialis|peroneus|hallucis|digitorum|shins/.test(t)) return 'ca';
  if (/glute|piriformis|obturator|gemellus/.test(t)) return 'gl';
  if (/quad|hip flexor/.test(t)) return 'qu';
  if (/core|oblique|abs|abdominal/.test(t)) return 'ab';
  if (/chest|pector|serratus/.test(t)) return 'ch';
  if (/lower back|spine/.test(t)) return 'lb';
  if (/rhomboid|upper back|^back$/.test(t)) return 'mb';
  if (/trap/.test(t)) return 'tp';
  if (/lat/.test(t)) return 'la';
  if (/adductor|inner thigh|groin/.test(t)) return 'ad';
  if (/abductor/.test(t)) return 'abd';
  if (/sternocleido|scalene|longus|splenius|suboccipital|semispinalis|cervical|levator/.test(t)) return 'ne';
  return '';
};
const equipo = (e, nombre) => {
  const t = String(e).toLowerCase();
  if (/suspended|strap/.test(nombre)) return 'suspension';
  if (/^ez barbell/.test(t)) return 'barraz';
  if (/barbell|trap bar/.test(t)) return 'barra';
  if (/dumbbell/.test(t)) return 'mancuernas';
  if (/kettlebell/.test(t)) return 'kettlebell';
  if (/cable/.test(t)) return 'polea';
  if (/smith/.test(t)) return 'multipower';
  if (/resistance band|^band/.test(t)) return 'banda';
  if (/medicine ball/.test(t)) return 'balon';
  if (/stability ball|bosu/.test(t)) return 'fitball';
  if (/^rope/.test(t)) return 'cuerdas';
  if (/leverage|assisted|sled|hammer|elliptical|stationary|stepmill|ergometer|skierg/.test(t)) return 'maquina';
  if (/body weight|weighted/.test(t)) return 'corporal';
  return 'otro';
};
// Cardio: máquinas → «estatica» (tiempo y nivel), cinta → «cinta», correr → «aire»
const CARDIO = { '0684': 'cinta', '0685': 'aire', 4258: 'aire', 3656: 'aire', '3196': 'aire', '0798': 'estatica', 2138: 'estatica', 2140: 'estatica', 2141: 'estatica', 2311: 'estatica', 2331: 'estatica', 3666: 'cinta' };

const nuevos = [];
const usados = new Set();
let colisiones = 0, repetidos = 0, sinNombre = 0;
for (const e of catalogo) {
  if (cubiertos.has(e.id)) continue;
  const n = nombres[e.id];
  if (!n) { sinNombre++; continue; }
  const k = norm(n);
  if (existentes.has(k)) {            // el nombre ya existe en la app: le damos esta imagen si aún no tenía
    if (!IMGDB[existentes.get(k)]) IMGDB[existentes.get(k)] = e.id;
    colisiones++; continue;
  }
  if (usados.has(k)) { repetidos++; continue; } // mismo ejercicio grabado dos veces (hombre/mujer, otra vista)
  usados.add(k);
  const cm = CARDIO[e.id];
  let m = GRUPO[e.target], p = COD[e.target] || '';
  if (cm) { m = 'cardio'; p = ''; }
  else if (!m) {                       // «sistema cardiovascular»: según el nombre
    if (/box|punch/.test(e.name)) { m = 'hombro'; p = 'sh'; }
    else if (/jump|hop|skip|squat|lunge|step|knee|run|shuffle|jack/.test(e.name)) { m = 'cuadriceps'; p = 'qu'; }
    else { m = 'core'; p = 'ab'; }
  }
  const sec = [...new Set((e.secondaryMuscles || []).map(SEC).filter((c) => c && c !== p))];
  const mu = cm ? '' : p + (sec.length ? '|' + sec.join(',') : '');
  const fila = [n, m, equipo(e.equipment, e.name), mu, e.id, e.name];
  if (cm) fila.push(cm);
  nuevos.push(fila);
  IMGDB[n] = e.id;
}
nuevos.sort((a, b) => a[0].localeCompare(b[0], 'es'));
// Ejercicios antiguos repetidos: su nombre pasa a ser alias del nuevo (así el historial y las rutinas guardadas siguen enlazadas).
const VIEJOS = {};
for (const [viejo, id] of Object.entries(dup.viejos)) {
  const fila = nuevos.find((f) => f[4] === id);
  if (!fila) throw new Error(`duplicados.json: «${viejo}» apunta a ${id}, que no es un ejercicio nuevo`);
  VIEJOS[viejo] = fila[0];
  IMGDB[viejo] = id;
}

const claves = Object.keys(IMGDB).sort((a, b) => a.localeCompare(b, 'es'));
const imgdb = '{' + claves.map((k) => JSON.stringify(k) + ':' + JSON.stringify(IMGDB[k])).join(',') + '}';
const salida = `// GENERADO por herramientas/exercisedb/generar.mjs — no lo edites a mano.
// Ejercicios de ExerciseDB (RapidAPI). Las imágenes viven en public/ejercicios/db/<id>-180|360.webp.
// IMGDB: «nombre del ejercicio en la app» → id de ExerciseDB (los de la app que ya existían y los nuevos).
// DBX: ejercicios nuevos [nombre, grupo, equipo, músculos "principales|secundarios", id, nombre en inglés, (modo de cardio)].
export const IMGDB = ${imgdb};
export const DBX = ${JSON.stringify(nuevos)};
// VIEJOS: nombre antiguo (retirado de la biblioteca) → nombre del ejercicio nuevo que lo sustituye.
export const VIEJOS = ${JSON.stringify(VIEJOS)};
`;
writeFileSync(join(RAIZ, 'js', 'ejercicios-db.js'), salida);
console.log(`IMGDB: ${claves.length} · nuevos: ${nuevos.length} · nombre ya existente: ${colisiones} · viejos retirados: ${Object.keys(VIEJOS).length} · principales con imagen: ${Object.keys(dup.principales).length} · repetidos: ${repetidos} · sin nombre: ${sinNombre}`);
