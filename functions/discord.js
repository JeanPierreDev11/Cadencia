'use strict';
// Aviso de feedback a un canal privado de Discord (registro (65)). Lógica pura, sin Firebase: la usa el trigger `feedbackDiscord` de index.js.
// La URL del webhook es un SECRETO (DISCORD_FEEDBACK_WEBHOOK_URL en Secret Manager): nunca se escribe en el repo, en el cliente ni en los registros.

const COLOR = 0xF2C116; // --brand-yellow
const PREGUNTAS = [ // mismas claves y textos que PE_PREG de js/entreno-ui.js y que las reglas de firestore.rules
  ['interfaz', '¿Has entendido con claridad la interfaz?'],
  ['comodidad', '¿Te ha resultado cómodo usarlo durante el entreno?'],
  ['ia', '¿Te ha aportado algo útil la IA (al ajustar rutinas o analizar la sesión)?'],
  ['registro', '¿Has podido anotar tus series, pesos y sensaciones sin que te frene el ritmo?'],
  ['volver', '¿Te gustaría volver a usar la app en tu próximo entrenamiento?'],
];
// Solo se envía a un webhook real de Discord (si el secreto vale «pendiente» o algo raro, no se hace ninguna petición).
const WEBHOOK_OK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const corta = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// Límites de Discord: título 256, descripción 4096, nombre de campo 256, valor de campo 1024, content 2000, 25 campos, 6000 en total.
const respuesta = (v) => (v === true ? '✅ Sí' : v === false ? '❌ No' : '➖ Sin responder');

// Datos del usuario que se envían: solo el identificador corto y el nombre de usuario de la app. NO se envía el correo.
const quien = (uid, perfil) => {
  const u = perfil && (perfil.usuario || perfil.nombre);
  const id = String(uid || '').slice(0, 8) || 'sin-uid';
  return u ? `@${corta(u, 40)} · \`${id}\`` : `\`${id}\``;
};

// doc = datos del documento de `feedback`; perfil = datos de users/{uid} (o null). Devuelve el cuerpo JSON del webhook.
function armarMensaje(doc, perfil) {
  doc = doc || {};
  const usuario = quien(doc.uid, perfil);
  let embed, resumen;
  if (doc.tipo === 'post_entreno') {
    const r = doc.respuestas || {}, e = doc.explicaciones || {};
    const hechas = PREGUNTAS.filter(([k]) => r[k] === true || r[k] === false).length;
    const fields = PREGUNTAS.map(([k, txt]) => {
      const nota = corta(e[k], 200);
      return { name: corta(txt, 256), value: corta(respuesta(r[k]) + (nota ? `\n> ${nota.replace(/\n+/g, ' ')}` : ''), 1024) };
    });
    embed = { title: 'Cuestionario post-entreno', description: `${usuario}\n${hechas} de ${PREGUNTAS.length} preguntas contestadas`, fields };
    resumen = `Post-entreno · ${hechas}/${PREGUNTAS.length} respuestas`;
  } else if (typeof doc.mensaje === 'string') {
    const p = Number.isInteger(doc.puntuacion) && doc.puntuacion >= 1 && doc.puntuacion <= 5 ? `${doc.puntuacion}/5` : 'Sin nota';
    embed = { title: 'Sugerencia o fallo (Perfil)', description: corta(doc.mensaje, 3800), fields: [{ name: 'Usuario', value: usuario, inline: true }, { name: 'Valoración', value: p, inline: true }] };
    resumen = `Sugerencia o fallo · ${p}`;
  } else {
    embed = { title: 'Feedback de tipo desconocido', description: `${usuario}\nTipo: ${corta(doc.tipo || 'sin tipo', 60)}` };
    resumen = 'Feedback de tipo desconocido';
  }
  embed.color = COLOR;
  embed.footer = { text: 'Cadencia · beta' };
  embed.timestamp = new Date().toISOString();
  return {
    username: 'Cadencia feedback',
    content: corta(`Nuevo feedback: ${resumen}`, 300), // es lo que se ve en la notificación del móvil
    allowed_mentions: { parse: [] }, // un texto con @everyone o @here escrito por un usuario no avisa a nadie
    embeds: [embed],
  };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Envía el cuerpo al webhook. NUNCA lanza: devuelve { ok, motivo }. Hasta `intentos` intentos con 8 s cada uno; respeta Retry-After de Discord (429)
// y reintenta 5xx y fallos de red; no reintenta 4xx (webhook borrado, cuerpo inválido). No escribe nunca la URL.
async function enviar(url, cuerpo, { fetchImpl = globalThis.fetch, intentos = 3, ms = 8000, pausa = espera } = {}) {
  if (typeof url !== 'string' || !WEBHOOK_OK.test(url.trim())) return { ok: false, motivo: 'sin-webhook' };
  const destino = url.trim() + '?wait=true';
  let motivo = 'desconocido';
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetchImpl(destino, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(ms) });
      if (res.ok) return { ok: true, motivo: `http-${res.status}` };
      motivo = `http-${res.status}`;
      if (res.status === 429) {
        let seg = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        if (!(seg > 0)) { try { seg = Number((await res.json()).retry_after); } catch (_) { seg = 0; } }
        if (i < intentos) await pausa(Math.min(Math.max(seg, 1), 10) * 1000);
        continue;
      }
      if (res.status >= 500) { if (i < intentos) await pausa(1500 * i); continue; }
      return { ok: false, motivo }; // 4xx distinto de 429: no tiene sentido repetir
    } catch (e) {
      motivo = e && e.name === 'TimeoutError' ? 'timeout' : 'red';
      if (i < intentos) await pausa(1500 * i);
    }
  }
  return { ok: false, motivo };
}

module.exports = { armarMensaje, enviar, PREGUNTAS, WEBHOOK_OK };
