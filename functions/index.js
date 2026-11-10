// Cloud Function «ia» de Cadencia: una sola función para las dos funciones de IA.
//  - modo «plato»:  foto del plato → alimentos de la tabla de la app, gramos y forma de cocinado.
//  - modo «taller»: bici + presupuesto + objetivo → 3 componentes recomendados con precio orientativo.
//  - modo «estado»: cuántas consultas le quedan hoy (no gasta ninguna).
// Límites: 10 consultas al día por persona y un tope global diario para no gastar de más.
// La clave de la API de Claude se guarda como secreto (ANTHROPIC_API_KEY), nunca en el código ni en la app.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const Stripe = require('stripe');
const Anthropic = require('@anthropic-ai/sdk');
const CATALOGO = require('./catalogo.json');

initializeApp();
const db = getFirestore();
const CLAVE = defineSecret('ANTHROPIC_API_KEY');
const STRIPE_CLAVE = defineSecret('STRIPE_SECRET_KEY'); // clave de la API de Stripe (restringida: solo leer Clientes)
const STRIPE_FIRMA = defineSecret('STRIPE_WEBHOOK_SECRET'); // secreto de firma del webhook (empieza por whsec_)
const STRAVA_ID = defineSecret('STRAVA_CLIENT_ID'); // datos de la aplicación creada en developers.strava.com
const STRAVA_SECRETO = defineSecret('STRAVA_CLIENT_SECRET'); // el «Client Secret» nunca sale del servidor
setGlobalOptions({ region: 'europe-west1', maxInstances: 3 });

const LIMITE_USUARIO = 10; // consultas de IA por persona y día (fotos + Taller)
const LIMITE_GLOBAL = 300; // consultas al día entre todas las personas (seguridad de gasto)
const MODELO_PLATO = 'claude-haiku-5-5'; // rápido y barato, ve imágenes
const MODELO_TALLER = 'claude-sonnet-5-5'; // más conocimiento de componentes y compatibilidades

const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const usoRef = (uid, dia) => db.doc(`iaUso/${uid}_${dia}`);
const globalRef = (dia) => db.doc(`iaGlobal/${dia}`);
const userRef = (uid) => db.doc(`users/${uid}`);
const esPro = async (uid) => { const d = await userRef(uid).get(); return d.exists && d.data().isPro === true; };

/* ------------------------------------------------------------------ */
/* Foto del plato                                                      */
/* ------------------------------------------------------------------ */
const catalogoTexto = () => {
  const grupos = Object.entries(CATALOGO.preparaciones).map(([g, arr]) => `${g}: ${arr.map(([id, n]) => `${id}=${n}`).join('; ')}`).join('\n');
  const lineas = CATALOGO.alimentos.map(([id, n, g, u]) => `${id} | ${n}${g ? ` | prep:${g}` : ''}${u ? ` | unidad:${u}` : ''}`).join('\n');
  return `FORMAS DE PREPARAR (por grupo, «id=nombre»):\n${grupos}\n\nTABLA DE ALIMENTOS («id | nombre | grupo de preparación | unidad»):\n${lineas}`;
};
const PROMPT_PLATO = `Eres un dietista-nutricionista que estima raciones a partir de fotos para una app española de nutrición (Cadencia).
Tu tarea: identificar cada alimento visible en la foto, estimar cuántos gramos hay y cómo está cocinado, y relacionarlo con la TABLA DE ALIMENTOS de la app.

Reglas:
- Usa el «id» de la tabla del alimento que mejor encaje. Si el nombre de la tabla dice «(crudo)» o «(cruda)», los gramos son del alimento en crudo: convierte lo que ves cocinado a su peso en crudo (por ejemplo, 150 g de pechuga a la plancha ≈ 200 g en crudo; 150 g de arroz cocido ≈ 50 g de arroz crudo). Si no lo dice, los gramos son tal y como se come.
- Si ese alimento tiene grupo de preparación, elige en «prep» el id de la forma de cocinar que se ve (por ejemplo «plancha», «frito», «horno»). Si no tiene grupo, deja «prep» vacío.
- Si un alimento no está en la tabla, deja «id» vacío y rellena el nombre y sus valores por 100 g tal como se come.
- Rellena siempre «kcal_100g», «proteina_100g», «hidratos_100g» y «grasa_100g» con tu estimación por 100 g tal como se come (sirve de respaldo).
- Cuenta el aceite o las salsas visibles solo a través de la forma de preparar; no los añadas aparte salvo que se vea una salsa servida aparte.
- Sé realista con las raciones de un plato normal en España. Si dudas entre dos tamaños, elige el intermedio y marca la confianza como «media» o «baja».
- Si la foto no muestra comida, devuelve la lista vacía y explícalo en «nota».
- Escribe los nombres y la nota en español de España. La nota, como mucho dos frases cortas.`;
const ESQUEMA_PLATO = {
  type: 'object',
  properties: {
    alimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id de la tabla o cadena vacía' },
          nombre: { type: 'string' },
          gramos: { type: 'number' },
          prep: { type: 'string', description: 'id de la forma de preparar o cadena vacía' },
          kcal_100g: { type: 'number' },
          proteina_100g: { type: 'number' },
          hidratos_100g: { type: 'number' },
          grasa_100g: { type: 'number' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
        required: ['id', 'nombre', 'gramos', 'prep', 'kcal_100g', 'proteina_100g', 'hidratos_100g', 'grasa_100g', 'confianza'],
        additionalProperties: false,
      },
    },
    nota: { type: 'string' },
  },
  required: ['alimentos', 'nota'],
  additionalProperties: false,
};

async function analizarPlato(client, data) {
  const img = String(data.imagen || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(img) || img.length < 2000) throw new HttpsError('invalid-argument', 'La foto no ha llegado bien. Vuelve a hacerla.');
  if (img.length > 2_000_000) throw new HttpsError('invalid-argument', 'La foto es demasiado grande.');
  const comida = String(data.comida || '').slice(0, 20);
  const r = await client.messages.create({
    model: MODELO_PLATO,
    max_tokens: 2000,
    system: [
      { type: 'text', text: PROMPT_PLATO },
      { type: 'text', text: catalogoTexto(), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
        { type: 'text', text: `Foto de mi ${comida ? comida.toLowerCase() : 'comida'}. Dime qué alimentos hay, cuántos gramos y cómo están cocinados.` },
      ],
    }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_PLATO } },
  });
  return leerJSON(r);
}

/* ------------------------------------------------------------------ */
/* Recomendación del Taller                                            */
/* ------------------------------------------------------------------ */
const PROMPT_TALLER = `Eres mecánico y asesor de una tienda de ciclismo en España. Recomiendas mejoras de componentes concretas, compatibles y con precios realistas del mercado español (euros, precio de venta habitual en tiendas online en 2026).

Reglas:
- Da exactamente 3 recomendaciones, ordenadas de más a menos impacto para el objetivo de la persona.
- Cada una tiene que caber en el presupuesto disponible, y si puedes, que las tres juntas también quepan. Indica en «resumen» si caben las tres juntas o cuáles combinar.
- Tienen que ser compatibles con la bici descrita: tipo de bici, frenos, número de velocidades, eje y cuerpo de buje, anchura máxima de cubierta, etc. Si te falta un dato para asegurar la compatibilidad, dilo en «compatibilidad» y explica qué comprobar.
- Si algún componente de su lista está gastado (km por encima de su vida útil), da prioridad a sustituirlo y dilo.
- Propón modelos de ejemplo reales y conocidos (marca y modelo), sin inventar referencias. Los precios son orientativos: da un rango mínimo-máximo en euros.
- Escribe en español de España, frases cortas y claras, sin jerga innecesaria.`;
const ESQUEMA_TALLER = {
  type: 'object',
  properties: {
    resumen: { type: 'string' },
    recomendaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pieza: { type: 'string', description: 'Qué cambiar, ej. «Ruedas de carbono de perfil medio»' },
          modelo_ejemplo: { type: 'string' },
          por_que: { type: 'string' },
          compatibilidad: { type: 'string' },
          precio_min: { type: 'number' },
          precio_max: { type: 'number' },
          mejora: { type: 'string', description: 'Mejora estimada, ej. «-450 g» o «subidas más cómodas»' },
        },
        required: ['pieza', 'modelo_ejemplo', 'por_que', 'compatibilidad', 'precio_min', 'precio_max', 'mejora'],
        additionalProperties: false,
      },
    },
    avisos: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumen', 'recomendaciones', 'avisos'],
  additionalProperties: false,
};

async function recomendarTaller(client, data) {
  const t = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const b = data.bici || {};
  const comps = Array.isArray(data.componentes) ? data.componentes.slice(0, 40) : [];
  const deseos = Array.isArray(data.deseos) ? data.deseos.slice(0, 20) : [];
  const pres = num(data.presupuesto);
  if (!(pres > 0)) throw new HttpsError('invalid-argument', 'Pon un presupuesto en el Taller para pedir la recomendación.');
  const texto = [
    `BICI: ${t(b.nombre, 40)} · tipo ${t(b.tipo, 20)}${b.marcaModelo ? ` · ${t(b.marcaModelo, 60)}` : ''}${num(b.anio) ? ` · año ${num(b.anio)}` : ''}${num(b.pesoKg) ? ` · ${num(b.pesoKg)} kg` : ''}${num(b.cubiertaMm) ? ` · cubiertas ${num(b.cubiertaMm)} mm` : ''}${b.tubeless ? ' · tubeless' : ''}${num(b.km) ? ` · ${Math.round(num(b.km))} km` : ''}`,
    `COMPONENTES: ${comps.length ? comps.map((c) => `${t(c.pieza, 40)}${c.nombre ? ` (${t(c.nombre, 60)})` : ''}${num(c.km) != null ? `, ${Math.round(num(c.km))} km` : ''}${num(c.cadaKm) ? ` de ${Math.round(num(c.cadaKm))}` : ''}`).join('; ') : 'no los ha apuntado'}`,
    `PRESUPUESTO: ${Math.round(pres)} €${num(data.gastado) ? ` (ya tiene en su lista de compra ${Math.round(num(data.gastado))} €: ${deseos.map((d) => t(d, 60)).join(', ')})` : ''}`,
    `OBJETIVOS: ${(Array.isArray(data.metas) ? data.metas.slice(0, 8).map((m) => t(m, 40)).join(', ') : '') || 'no indicados'}`,
    data.texto ? `LO QUE QUIERE, EN SUS PALABRAS: ${t(data.texto, 300)}` : '',
  ].filter(Boolean).join('\n');
  const r = await client.messages.create({
    model: MODELO_TALLER,
    max_tokens: 3000,
    system: PROMPT_TALLER,
    messages: [{ role: 'user', content: texto }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_TALLER } },
  });
  return leerJSON(r);
}

function leerJSON(r) {
  if (r.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'La IA no ha podido responder a esta petición.');
  const txt = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  try { return JSON.parse(txt); } catch (e) { throw new HttpsError('internal', 'La IA ha respondido algo que no entendemos. Prueba otra vez.'); }
}

/* ------------------------------------------------------------------ */
/* Función pública                                                     */
/* ------------------------------------------------------------------ */
exports.ia = onCall({ secrets: [CLAVE], timeoutSeconds: 90, memory: '512MiB', cpu: 1, concurrency: 10 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para usar la IA.');
  const uid = req.auth.uid, data = req.data || {}, modo = data.modo, dia = hoyMadrid();
  // La IA es de Cadencia Pro. Se comprueba aquí, en el servidor, antes de leer nada de la petición.
  const pro = await esPro(uid);
  if (modo === 'estado') {
    const s = await usoRef(uid, dia).get();
    return { quedan: Math.max(0, LIMITE_USUARIO - ((s.exists && s.data().n) || 0)), limite: LIMITE_USUARIO, pro };
  }
  if (modo === 'borrar') { // la app lo llama al borrar la cuenta: elimina los contadores de uso y los tokens de Strava de esta persona
    await db.doc(`stravaTokens/${uid}`).delete().catch(() => {});
    const q = await db.collection('iaUso').where('uid', '==', uid).get();
    const b = db.batch();
    q.docs.forEach((d) => b.delete(d.ref));
    if (q.size) await b.commit();
    return { ok: true };
  }
  if (modo !== 'plato' && modo !== 'taller') throw new HttpsError('invalid-argument', 'Petición no válida.');
  if (!pro) throw new HttpsError('permission-denied', 'Esta función es de Cadencia Pro.', { codigo: 'pro-requerido' });

  // Reserva una consulta (por persona y global) antes de llamar a la IA.
  let usadas = 0;
  await db.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(usoRef(uid, dia)), tx.get(globalRef(dia))]);
    usadas = (u.exists && u.data().n) || 0;
    const total = (g.exists && g.data().n) || 0;
    if (usadas >= LIMITE_USUARIO) throw new HttpsError('resource-exhausted', `Ya has usado tus ${LIMITE_USUARIO} consultas de IA de hoy. Mañana tendrás otras ${LIMITE_USUARIO}.`);
    if (total >= LIMITE_GLOBAL) throw new HttpsError('resource-exhausted', 'La IA ha llegado a su límite de hoy. Prueba mañana.');
    tx.set(usoRef(uid, dia), { uid, dia, n: usadas + 1, ultima: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(globalRef(dia), { n: total + 1 }, { merge: true });
  });

  try {
    const client = new Anthropic({ apiKey: CLAVE.value() });
    const res = modo === 'plato' ? await analizarPlato(client, data) : await recomendarTaller(client, data);
    return { ...res, quedan: Math.max(0, LIMITE_USUARIO - usadas - 1), limite: LIMITE_USUARIO };
  } catch (e) {
    // Si falla, devolvemos la consulta para no gastarla.
    const dec = FieldValue.increment(-1);
    await Promise.all([usoRef(uid, dia).set({ n: dec }, { merge: true }), globalRef(dia).set({ n: dec }, { merge: true })]).catch(() => {});
    if (e instanceof HttpsError) throw e;
    console.error('IA', modo, e && e.status, e && e.message);
    throw new HttpsError('unavailable', 'La IA no ha respondido. Prueba otra vez en un momento.');
  }
});

/* ------------------------------------------------------------------ */
/* Webhook de Stripe: activa o quita Cadencia Pro                      */
/* ------------------------------------------------------------------ */
// Pone isPro en el perfil. Solo el servidor puede cambiarlo (las reglas de Firestore lo impiden desde la app).
async function ponerPro(uid, valor, extra) {
  const ref = userRef(uid);
  if (!(await ref.get()).exists) { console.warn('Stripe: no existe users/' + uid); return false; }
  await ref.set({ isPro: valor, proActualizado: FieldValue.serverTimestamp(), ...(extra || {}) }, { merge: true });
  console.log('Stripe: isPro=' + valor + ' para ' + uid);
  return true;
}
const porEmail = async (email) => {
  if (!email) return null;
  try { return (await getAuth().getUserByEmail(String(email).trim().toLowerCase())).uid; } catch (e) { return null; }
};
// Devuelve los uid cuyo perfil guarda este cliente de Stripe (si no hay, busca por el email del cliente).
async function uidsDeCliente(stripe, customerId) {
  if (!customerId) return [];
  const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(5).get();
  if (q.size) return q.docs.map((d) => d.id);
  try {
    const c = await stripe.customers.retrieve(customerId);
    const uid = await porEmail(c && !c.deleted ? c.email : null);
    return uid ? [uid] : [];
  } catch (e) { console.error('Stripe: no se pudo leer el cliente', e && e.message); return []; }
}

async function procesarEvento(stripe, ev) {
  const o = ev.data.object;
  if (ev.type === 'checkout.session.completed') {
    if (o.mode !== 'subscription' || o.payment_status === 'unpaid') return;
    let uid = null;
    if (o.client_reference_id && (await userRef(o.client_reference_id).get()).exists) uid = o.client_reference_id;
    if (!uid) uid = await porEmail((o.customer_details && o.customer_details.email) || o.customer_email);
    if (!uid) { console.warn('Stripe: pago sin usuario asociado', o.id); return; }
    await ponerPro(uid, true, { stripeCustomerId: o.customer || null, stripeSubscriptionId: o.subscription || null });
    return;
  }
  if (ev.type === 'customer.subscription.deleted' || ev.type === 'customer.subscription.updated') {
    const activa = ev.type === 'customer.subscription.updated' && (o.status === 'active' || o.status === 'trialing');
    const caida = ev.type === 'customer.subscription.deleted' || ['canceled', 'unpaid', 'incomplete_expired'].includes(o.status);
    if (!activa && !caida) return; // past_due, incomplete…: no cambiamos nada
    for (const uid of await uidsDeCliente(stripe, o.customer)) {
      const d = (await userRef(uid).get()).data() || {};
      if (d.stripeSubscriptionId && d.stripeSubscriptionId !== o.id) continue; // es una suscripción antigua
      const fin = o.current_period_end || (o.items && o.items.data && o.items.data[0] && o.items.data[0].current_period_end) || null; // segundos
      await ponerPro(uid, activa, activa ? { stripeCustomerId: o.customer, stripeSubscriptionId: o.id, proRenueva: fin ? fin * 1000 : null, proCancela: !!(o.cancel_at_period_end || o.cancel_at) } : { proCancela: false });
    }
  }
}

exports.stripeWebhook = onRequest({ secrets: [STRIPE_CLAVE, STRIPE_FIRMA], memory: '256MiB', maxInstances: 2, timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Solo POST'); return; }
  const firma = String(STRIPE_FIRMA.value() || '').trim(); // por si al pegar el secreto se coló un espacio o un salto de línea
  if (!firma || firma === 'pendiente') { res.status(503).send('Webhook sin configurar'); return; }
  const stripe = new Stripe(String(STRIPE_CLAVE.value() || '').trim());
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], firma); } catch (e) {
    console.error('Stripe: firma no válida —', e && e.message, '| secreto: empieza por', firma.slice(0, 6), 'longitud', firma.length, '| cuerpo', req.rawBody ? req.rawBody.length + ' bytes' : 'vacío');
    res.status(400).send('Firma no válida'); return;
  }
  try { await procesarEvento(stripe, ev); } catch (e) { console.error('Stripe', ev.type, e && e.message); res.status(500).send('Error'); return; } // Stripe vuelve a intentarlo
  res.json({ received: true });
});

/* ------------------------------------------------------------------ */
/* Strava: conexión OAuth 2.0 y lectura de actividades                 */
/* ------------------------------------------------------------------ */
// Los tokens de Strava se guardan SOLO en stravaTokens/{uid}, una colección que las reglas de Firestore
// no dejan leer ni escribir desde la app: únicamente esta función (con permisos de servidor) la toca.
// En el perfil (users/{uid}.strava) solo queda un aviso «conectado» sin ningún secreto.
const STRAVA_API = 'https://www.strava.com';
const TIPOS_STRAVA = { Ride: 'bici', VirtualRide: 'bici', Run: 'cardio' };
const tokensRef = (uid) => db.doc(`stravaTokens/${uid}`);
const COOLDOWN_STRAVA_S = 20; // segundos entre sincronizaciones de una misma persona
const LIMITE_STRAVA_DIA = 600; // sincronizaciones al día entre todas las personas (Strava permite 2.000 peticiones/día)

async function pedirStrava(ruta, opciones) {
  const r = await fetch(STRAVA_API + ruta, { signal: AbortSignal.timeout(20000), ...opciones });
  let cuerpo = null; try { cuerpo = await r.json(); } catch (e) { /* sin cuerpo */ }
  return { ok: r.ok, status: r.status, cuerpo };
}
const formularioToken = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(obj).toString() });
function credencialesStrava() {
  const id = String(STRAVA_ID.value() || '').trim(), secreto = String(STRAVA_SECRETO.value() || '').trim();
  if (!id || !secreto || id === 'pendiente' || secreto === 'pendiente') throw new HttpsError('failed-precondition', 'Strava todavía no está configurado en el servidor.');
  return { id, secreto };
}
// Quita la conexión: borra los tokens y el aviso del perfil. Si `revocar`, también le dice a Strava que deje de dar acceso.
async function olvidarStrava(uid, revocar) {
  const t = await tokensRef(uid).get();
  if (revocar && t.exists) {
    try {
      const c = credencialesStrava();
      await fetch(STRAVA_API + '/oauth/revoke', { signal: AbortSignal.timeout(15000), method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${c.id}:${c.secreto}`).toString('base64') }, body: new URLSearchParams({ token: t.data().refresh_token, token_type_hint: 'refresh_token' }).toString() });
    } catch (e) { console.warn('Strava: no se pudo revocar', e && e.message); }
  }
  await tokensRef(uid).delete().catch(() => {});
  if ((await userRef(uid).get()).exists) await userRef(uid).update({ strava: FieldValue.delete() }).catch(() => {});
}
// Devuelve un access_token válido; si caducó (dura 6 horas) lo renueva con el refresh_token y guarda el nuevo par.
async function tokenStrava(uid) {
  const t = await tokensRef(uid).get();
  if (!t.exists) throw new HttpsError('failed-precondition', 'Strava no está conectado.', { codigo: 'strava-no-conectado' });
  const d = t.data();
  if (d.expires_at - 120 > Math.floor(Date.now() / 1000)) return d.access_token;
  const c = credencialesStrava();
  const r = await pedirStrava('/oauth/token', formularioToken({ client_id: c.id, client_secret: c.secreto, grant_type: 'refresh_token', refresh_token: d.refresh_token }));
  if (!r.ok || !r.cuerpo || !r.cuerpo.access_token) {
    if (r.status === 400 || r.status === 401) { await olvidarStrava(uid, false); throw new HttpsError('failed-precondition', 'Strava ha dejado de dar acceso. Vuelve a conectarlo desde el Perfil.', { codigo: 'strava-revocado' }); }
    throw new HttpsError('unavailable', 'Strava no responde ahora. Prueba en unos minutos.');
  }
  await tokensRef(uid).set({ access_token: r.cuerpo.access_token, refresh_token: r.cuerpo.refresh_token || d.refresh_token, expires_at: r.cuerpo.expires_at }, { merge: true });
  return r.cuerpo.access_token;
}
// Una actividad de Strava → campos que ya usa la app (el resto de campos se calculan en el móvil).
function normalizarActividad(a) {
  const tipo = TIPOS_STRAVA[a.type] || TIPOS_STRAVA[a.sport_type];
  if (!tipo) return null;
  const fecha = String(a.start_date_local || a.start_date || '').slice(0, 10);
  const min = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || min < 5 || min > 1440) return null;
  const o = { sid: String(a.id), fecha, tipo, min, nombre: String(a.name || '').slice(0, 60) };
  const km = Math.round((a.distance || 0) / 100) / 10;
  if (km > 0 && km <= 500) o.km = km;
  if (tipo === 'bici') {
    const el = Math.round(a.total_elevation_gain || 0), pu = Math.round(a.average_heartrate || 0), np = Math.round(a.weighted_average_watts || 0);
    if (el > 0 && el <= 10000) o.elev = el;
    if (pu >= 40 && pu <= 230) o.pulso = pu;
    if (np >= 50 && np <= 700) o.np = np;
  }
  return o;
}

exports.strava = onCall({ secrets: [STRAVA_ID, STRAVA_SECRETO], memory: '256MiB', timeoutSeconds: 60, concurrency: 10 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para usar Strava.');
  const uid = req.auth.uid, data = req.data || {}, modo = data.modo;

  if (modo === 'conectar') {
    const code = String(data.code || '').trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) throw new HttpsError('invalid-argument', 'El código de Strava no es válido.');
    const c = credencialesStrava();
    const r = await pedirStrava('/oauth/token', formularioToken({ client_id: c.id, client_secret: c.secreto, code, grant_type: 'authorization_code' }));
    if (!r.ok || !r.cuerpo || !r.cuerpo.access_token) throw new HttpsError('invalid-argument', 'Strava no ha aceptado la conexión. Vuelve a intentarlo.');
    const b = r.cuerpo;
    if (!/activity:read/.test(String(b.scope || data.scope || ''))) throw new HttpsError('permission-denied', 'Para importar tus salidas tienes que aceptar el permiso «ver tus actividades» en Strava.', { codigo: 'strava-permiso' });
    const nombre = b.athlete ? [b.athlete.firstname, b.athlete.lastname].filter(Boolean).join(' ').slice(0, 60) : '';
    await tokensRef(uid).set({ access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at, athleteId: b.athlete ? b.athlete.id : null, scope: String(b.scope || ''), conectado: FieldValue.serverTimestamp() });
    const perfil = { conectado: true, atleta: nombre, desde: Date.now() };
    await userRef(uid).set({ strava: perfil }, { merge: true });
    return { ok: true, strava: perfil };
  }

  if (modo === 'desconectar') { await olvidarStrava(uid, true); return { ok: true }; }

  if (modo === 'actividades') {
    const t0 = await tokensRef(uid).get();
    if (!t0.exists) throw new HttpsError('failed-precondition', 'Strava no está conectado.', { codigo: 'strava-no-conectado' });
    const ahora = Math.floor(Date.now() / 1000);
    if (t0.data().ultimaPeticion && ahora - t0.data().ultimaPeticion < COOLDOWN_STRAVA_S) throw new HttpsError('resource-exhausted', 'Acabas de sincronizar. Espera unos segundos.');
    const dia = hoyMadrid(), gref = db.doc(`stravaGlobal/${dia}`);
    const n = await db.runTransaction(async (tx) => { const g = await tx.get(gref); const v = ((g.exists && g.data().n) || 0) + 1; if (v <= LIMITE_STRAVA_DIA) tx.set(gref, { n: v }); return v; });
    if (n > LIMITE_STRAVA_DIA) throw new HttpsError('resource-exhausted', 'Hoy se han hecho demasiadas sincronizaciones con Strava. Prueba mañana.');
    await tokensRef(uid).set({ ultimaPeticion: ahora }, { merge: true });
    let desde = Number(data.desde); if (!Number.isFinite(desde) || desde < ahora - 400 * 86400) desde = ahora - 45 * 86400;
    const token = await tokenStrava(uid);
    const items = []; let total = 0;
    for (let pag = 1; pag <= 3; pag++) {
      const r = await pedirStrava(`/api/v3/athlete/activities?after=${Math.floor(desde)}&per_page=100&page=${pag}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { await olvidarStrava(uid, false); throw new HttpsError('failed-precondition', 'Strava ha dejado de dar acceso. Vuelve a conectarlo desde el Perfil.', { codigo: 'strava-revocado' }); }
      if (r.status === 429) throw new HttpsError('resource-exhausted', 'Strava pide esperar un poco. Prueba en unos minutos.');
      if (!r.ok || !Array.isArray(r.cuerpo)) throw new HttpsError('unavailable', 'Strava no responde ahora. Prueba en unos minutos.');
      total += r.cuerpo.length;
      r.cuerpo.forEach((a) => { const o = normalizarActividad(a); if (o) items.push(o); });
      if (r.cuerpo.length < 100) break;
    }
    items.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    return { items, total, omitidas: total - items.length };
  }
  throw new HttpsError('invalid-argument', 'Petición no válida.');
});

/* ------------------------------------------------------------------ */
/* Recordatorios push (cada hora)                                      */
/* ------------------------------------------------------------------ */
// Perfil → Recordatorios guarda en users/{uid}: recordatorios {peso|comidas|entreno: {on, h}}, recTz (zona horaria),
// recActivo (true si hay alguno activo) y fcmTokens (dispositivos). Cada hora en punto se busca a quien le toca ahora,
// en SU zona horaria, y se le manda un mensaje solo con datos; el service worker (sw.js) lo muestra.
// No se avisa si ese día ya está hecho (peso apuntado, comidas apuntadas o entreno registrado), ni dos veces el mismo día.
const TEXTOS_REC = {
  peso: [['Hora de pesarte', 'Súbete a la báscula y apunta tu peso: son diez segundos.'], ['Buenos días', 'Apunta tu peso de hoy para no perder el hilo de tu progreso.'], ['¿Te pesas hoy?', 'Mejor en ayunas y a la misma hora. Anótalo en Cadencia.']],
  comidas: [['Apunta tus comidas', 'Registra lo que has comido hoy para que tus calorías y macros cuenten.'], ['¿Qué has comido hoy?', 'Dos minutos ahora y tu día queda completo en Cadencia.'], ['Cierra tu día', 'Anota tus comidas de hoy antes de acabar el día.']],
  entreno: [['Hoy toca entrenar', 'Tu entreno de hoy te espera. ¡A por ello!'], ['Hora de moverse', 'Hoy tienes entreno. Ábrelo y empieza cuando quieras.'], ['No lo dejes para luego', 'Tu sesión de hoy está lista en Cadencia.']],
};
const DESTINO_REC = { peso: './?ir=peso', comidas: './?ir=comidas', entreno: './?ir=entreno' };
const TOKEN_MUERTO = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

// Fecha (AAAA-MM-DD), hora (0-23) y día de la semana (0 = lunes) en la zona horaria de la persona.
function horaLocal(zona, ahora) {
  let tz = zona;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch (e) { tz = 'Europe/Madrid'; }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(ahora).map((x) => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return { fecha, hora: Number(p.hour), semana: (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7 };
}

async function yaHecho(uid, k, fecha) {
  if (k === 'peso') return (await db.doc(`users/${uid}/pesos/${fecha}`).get()).exists;
  if (k === 'comidas') { const d = await db.doc(`users/${uid}/comidas/${fecha}`).get(); return d.exists && Array.isArray(d.data().items) && d.data().items.length > 0; }
  return !(await db.collection(`users/${uid}/entrenos`).where('fecha', '==', fecha).limit(1).get()).empty;
}

async function avisarUsuario(doc, ahora) {
  const d = doc.data(), uid = doc.id, rec = d.recordatorios || {};
  const loc = horaLocal(d.recTz, ahora);
  const tokens = (Array.isArray(d.fcmTokens) ? d.fcmTokens : []).filter((t) => typeof t === 'string' && t).slice(-10);
  if (!tokens.length) return 0;
  let enviados = 0;
  for (const k of ['peso', 'comidas', 'entreno']) {
    const r = rec[k];
    if (!r || r.on !== true || r.h !== loc.hora) continue;
    if (d.recEnviado && d.recEnviado[k] === loc.fecha) continue; // ya se mandó hoy (por si el cron se repite)
    if (k === 'entreno') { // solo los días de tu rutina (si la tienes)
      const dias = (await userRef(uid).get()).get('rutina.dias');
      if (Array.isArray(dias) && dias.length && !dias.includes(loc.semana)) continue;
    }
    if (await yaHecho(uid, k, loc.fecha)) continue;
    const [title, body] = TEXTOS_REC[k][Number(loc.fecha.slice(8)) % TEXTOS_REC[k].length];
    const res = await getMessaging().sendEach(tokens.map((token) => ({
      token,
      data: { title, body, url: DESTINO_REC[k], tag: `cadencia-${k}` },
      webpush: { headers: { TTL: '3600', Urgency: 'normal' } },
    })));
    const muertos = [];
    res.responses.forEach((x, i) => { if (!x.success && x.error && TOKEN_MUERTO.has(x.error.code)) muertos.push(tokens[i]); });
    if (muertos.length) await userRef(uid).update({ fcmTokens: FieldValue.arrayRemove(...muertos) });
    if (res.successCount > 0) { await userRef(uid).update({ [`recEnviado.${k}`]: loc.fecha }); enviados += 1; }
    else console.warn('recordatorio sin entregar', { uid, k, fallos: res.failureCount });
  }
  return enviados;
}

exports.recordatorios = onSchedule({ schedule: '0 * * * *', timeZone: 'Europe/Madrid', memory: '256MiB', timeoutSeconds: 300, maxInstances: 1, retryCount: 0 }, async () => {
  const ahora = new Date();
  const snap = await db.collection('users').where('recActivo', '==', true).select('recordatorios', 'recTz', 'fcmTokens', 'recEnviado').get();
  let enviados = 0, errores = 0;
  for (let i = 0; i < snap.docs.length; i += 20) { // de 20 en 20 para no saturar
    const r = await Promise.allSettled(snap.docs.slice(i, i + 20).map((doc) => avisarUsuario(doc, ahora)));
    r.forEach((x) => { if (x.status === 'fulfilled') enviados += x.value; else { errores += 1; console.error('recordatorio falló', x.reason && x.reason.message); } });
  }
  console.log(`recordatorios: ${snap.size} personas con avisos activos, ${enviados} enviados, ${errores} errores`);
});
