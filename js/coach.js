// Coach AI post-entreno (Pro). Por ahora es una MAQUETA: devuelve una nota y un análisis de ejemplo.
// Más adelante, fetchAICoachRating llamará a una Cloud Function (p. ej. la función `ia` con modo 'coach')
// que hablará con OpenAI/Gemini. La pantalla ya espera esta forma de respuesta:
//   { nota: 8.5, titulo: 'Texto corto', analisis: 'Párrafo', consejos: ['…', '…'], demo: true }
// `demo: true` hace que la pantalla muestre la etiqueta «Ejemplo»; la respuesta real no debe llevarlo.

export const COACH_DEMO = true;

// Datos mínimos que se mandarán a la IA: sin uid, correo ni nombre.
export function datosParaCoach(o, extra = {}) {
  return {
    nombre: o.nombre, fecha: o.fecha, min: o.min,
    ejercicios: (o.ejercicios || []).map((e) => ({ n: e.n, uni: !!e.uni, series: (e.series || []).filter((s) => !s.w).map((s) => ({ kg: s.kg, reps: s.reps, rir: s.rir })) })),
    ...extra,
  };
}
export function perfilParaCoach(p = {}) {
  return { sexo: p.sexo || '', edad: p.edad || null, pesoKg: p.pesoKg || null, objetivos: p.objetivos || [] };
}

// Placeholder: aquí irá la llamada real (httpsCallable a Cloud Functions). Mantener la firma y la forma de la respuesta.
export async function fetchAICoachRating(datosEntreno, perfilUsuario) { // eslint-disable-line no-unused-vars
  await new Promise((r) => setTimeout(r, 900)); // simula la espera de la IA
  const ej = (datosEntreno && datosEntreno.ejercicios) || [];
  const top = ej.reduce((m, e) => (!m || e.series.length > m.series.length ? e : m), null);
  const n = top ? top.n : 'Press banca';
  return {
    nota: 8.5,
    titulo: 'Sesión sólida',
    analisis: `Buen volumen, pero para hipertrofia deberías subir de 4 repeticiones en ${n}.`,
    consejos: ['Mantén 1-2 repeticiones en reserva en las últimas series.', 'Descansa 90-120 s entre series de los ejercicios básicos.'],
    demo: COACH_DEMO,
  };
}
