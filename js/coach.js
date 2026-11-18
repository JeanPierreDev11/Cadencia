// Coach AI post-entreno (Pro). Con Firebase llama a la Cloud Function «coach» (Gemini), que lee el entreno de Firestore,
// lo analiza y GUARDA el resultado en el propio documento (aiNota, aiTitulo, aiTexto, aiConsejos, aiDemo:false, aiFecha).
// En modo prueba (sin Firebase, api.local) devuelve un análisis de EJEMPLO (demo:true) que guarda la propia app.
// Forma de la respuesta: { nota: 8.5, titulo, analisis, consejos: ['…'], demo, guardado }.

// Datos mínimos del entreno: sin uid, correo ni nombre (solo los usa el ejemplo; el servidor lee Firestore).
export function datosParaCoach(o, extra = {}) {
  return {
    nombre: o.nombre, fecha: o.fecha, min: o.min,
    ejercicios: (o.ejercicios || []).map((e) => (e.tipo === 'cardio'
      ? { n: e.n, cardio: true, series: (e.series || []).map((s) => ({ ...s })) } // bloques de cardio: min, km, kmh, inc, nivel, int
      : { n: e.n, uni: !!e.uni, series: (e.series || []).filter((s) => !s.w).map((s) => ({ kg: s.kg, reps: s.reps, rir: s.rir })) })),
    ...extra,
  };
}

// Análisis de ejemplo para el modo prueba.
async function ejemploCoach(datos) {
  await new Promise((r) => setTimeout(r, 900)); // simula la espera de la IA
  const ej = ((datos && datos.ejercicios) || []).filter((e) => !e.cardio);
  const top = ej.reduce((m, e) => (!m || e.series.length > m.series.length ? e : m), null);
  const n = top ? top.n : 'Press banca';
  return {
    nota: 8.5,
    titulo: 'Sesión sólida',
    analisis: `Buen volumen, pero para hipertrofia deberías subir de 4 repeticiones en ${n}.`,
    consejos: ['Mantén 1-2 repeticiones en reserva en las últimas series.', 'Descansa 90-120 s entre series de los ejercicios básicos.'],
    demo: true,
  };
}

// Pide el análisis del entreno w. guardado:true → el servidor ya lo ha escrito en Firestore.
export async function analizarEntreno(api, w) {
  if (api.local) return { ...(await ejemploCoach(datosParaCoach(w))), guardado: false };
  return { ...(await api.coach(w.id)), demo: false, guardado: true };
}

// Diagnóstico de un fallo del Coach AI: lo imprime ENTERO en consola y devuelve un código discreto («Error 503», «Timeout»…) para el mensaje.
// Con Firebase la llamada es «callable»: el SDK ya no da el HTTP crudo, pero sí `code` (unavailable = 503…), `message` y `details`
// (el servidor mete en details.http el estado REAL de Google y en details.motivo timeout|red|vacio|json|interno).
const HTTP_DE_CODIGO = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'not-found': 404, 'failed-precondition': 412,
  'resource-exhausted': 429, internal: 500, unavailable: 503, 'deadline-exceeded': 504 };
export function diagnosticoCoach(e, id) {
  const code = String((e && e.code) || '').replace(/^functions\//, ''), d = (e && e.details && typeof e.details === 'object') ? e.details : {};
  const http = d.http || HTTP_DE_CODIGO[code] || null;
  console.error('[Coach AI] fallo', { entreno: id, code: (e && e.code) || null, http, mensaje: e && e.message, details: e && e.details, stack: e && e.stack });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sin conexión';
  if (d.http) return `Error ${d.http}`; // estado real de Google
  if (d.motivo === 'timeout' || code === 'deadline-exceeded') return 'Timeout';
  if (d.motivo) return `Error ${d.motivo}`; // json | vacio | red | interno
  return http ? `Error ${http}` : 'Error';
}
