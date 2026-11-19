// Prueba REAL del Coach AI contra Gemini (la lanza el workflow «Probar Gemini»; necesita GEMINI_API_KEY en el entorno).
// Carga functions/index.js con módulos simulados y llama a geminiUna() con un entreno de ejemplo, en cada modelo y con distintos niveles de «pensar».
// Muestra HTTP/motivo, tiempo y si la respuesta es válida. No imprime la clave.
const Module = require('module'), path = require('path');
const ruta = path.resolve(__dirname, '../functions/index.js');
const nada = () => ({});
const mocks = {
  'firebase-functions/v2/https': { onCall: (o, h) => h, onRequest: (o, h) => h, HttpsError: class extends Error {} },
  'firebase-functions/v2': { setGlobalOptions() {} }, 'firebase-functions/params': { defineSecret: () => ({ value: () => process.env.GEMINI_API_KEY }) },
  'firebase-admin/app': { initializeApp() {} }, 'firebase-admin/firestore': { getFirestore: () => ({ doc: nada, collection: nada }), FieldValue: {} },
  'firebase-admin/auth': { getAuth: nada }, 'firebase-admin/messaging': { getMessaging: nada }, 'firebase-functions/v2/scheduler': { onSchedule: (o, h) => h },
  stripe: function () {}, '@anthropic-ai/sdk': function () {},
};
const orig = Module._load; Module._load = function (r, ...a) { return mocks[r] || orig.call(this, r, ...a); };
const m = new Module(ruta, null); m.filename = ruta; m.paths = Module._nodeModulePaths(path.dirname(ruta));
m._compile(require('fs').readFileSync(ruta, 'utf8') + '\nmodule.exports.__t = { geminiUna, limpiarCoach, MODELO_COACH, MODELO_COACH_RESPALDO };', ruta);
const { geminiUna, limpiarCoach, MODELO_COACH, MODELO_COACH_RESPALDO } = m.exports.__t;
const entrada = { perfil: { sexo: 'hombre', edad: 28, pesoKg: 80, objetivos: ['ganar músculo'], experiencia: 'intermedio (cerca de 1 año)', lugares: ['en gimnasio'], minutosSesion: 60, diasSemana: 4 },
  entreno: { fecha: '2026-11-19', nombre: 'Pull', min: 69, seriesTotales: 10, seriesPorHora: 8.7, ejercicios: [
    { n: 'Remo con barra', uni: false, objetivoRutina: '4 × 8-12', series: [{ kg: 60, reps: 10, rir: 2 }, { kg: 60, reps: 9, rir: 1 }, { kg: 60, reps: 8, rir: 1 }] },
    { n: 'Jalón al pecho', uni: false, objetivoRutina: '3 × 10-12', series: [{ kg: 55, reps: 12 }, { kg: 55, reps: 11 }, { kg: 55, reps: 10 }] },
    { n: 'Curl de bíceps', uni: false, series: [{ kg: 14, reps: 12 }, { kg: 14, reps: 10 }, { kg: 14, reps: 9 }, { kg: 14, reps: 8 }] }] }, sesionAnterior: null };
(async () => {
  let fallos = 0;
  const VER = process.env.VER_TEXTOS === '1';
  for (const modelo of [MODELO_COACH, MODELO_COACH_RESPALDO]) for (const pensar of ['low', 'medium']) {
    const t0 = Date.now();
    try { const r = limpiarCoach(await geminiUna(modelo, process.env.GEMINI_API_KEY, entrada, 60000, pensar));
      console.log(`${modelo} pensar=${pensar} → OK en ${Date.now() - t0} ms · nota ${r.nota} · ${r.paraLlegarAl10.length} puntos al 10 · ${r.consejos.length} consejos`);
      if (VER) console.log('   «' + r.titulo + '» ' + r.resumen + '\n   AL 10: ' + r.paraLlegarAl10.join(' | ') + '\n   CONSEJOS: ' + r.consejos.join(' | ')); }
    catch (e) { if (pensar === 'low' || pensar === null) fallos++; console.log(`${modelo} pensar=${pensar} → FALLO en ${Date.now() - t0} ms · ${e.status} · ${String(e.message).slice(0, 160)}`); }
  }
  process.exit(0);
})();
