// Coach AI post-entreno (Pro). Con Firebase llama a la Cloud Function «coach» (Gemini), que lee el entreno de Firestore,
// lo analiza y GUARDA el resultado en el propio documento (aiNota, aiTitulo, aiTexto, aiConsejos, aiDemo:false, aiFecha).
// En modo prueba (sin Firebase, api.local) devuelve un análisis de EJEMPLO (demo:true) que guarda la propia app.
// Forma de la respuesta: { nota: 8.5, titulo, analisis, consejos: ['…'], demo, guardado }.

// Datos mínimos del entreno: sin uid, correo ni nombre (solo los usa el ejemplo; el servidor lee Firestore).
export function datosParaCoach(o, extra = {}) {
  return {
    nombre: o.nombre, fecha: o.fecha, min: o.min,
    ejercicios: (o.ejercicios || []).map((e) => ({ n: e.n, uni: !!e.uni, series: (e.series || []).filter((s) => !s.w).map((s) => ({ kg: s.kg, reps: s.reps, rir: s.rir })) })),
    ...extra,
  };
}

// Análisis de ejemplo para el modo prueba.
async function ejemploCoach(datos) {
  await new Promise((r) => setTimeout(r, 900)); // simula la espera de la IA
  const ej = (datos && datos.ejercicios) || [];
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
