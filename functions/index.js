// Cloud Function «ia» de Cadencia: una sola función para las dos funciones de IA.
//  - modo «plato»:  foto del plato → alimentos de la tabla de la app, gramos y forma de cocinado.
//  - modo «taller»: bici + presupuesto + objetivo → 3 componentes recomendados con precio orientativo.
//  - modo «estado»: cuántas consultas le quedan hoy (no gasta ninguna).
// Límites: 10 consultas al día por persona y un tope global diario para no gastar de más.
// La clave de la API de Claude se guarda como secreto (ANTHROPIC_API_KEY), nunca en el código ni en la app.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const functionsV1 = require('firebase-functions/v1');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');
const CATALOGO = require('./catalogo.json');

initializeApp();
const db = getFirestore();
const CLAVE = defineSecret('ANTHROPIC_API_KEY');
setGlobalOptions({ region: 'europe-west1', maxInstances: 3 });

const LIMITE_USUARIO = 10; // consultas de IA por persona y día (fotos + Taller)
const LIMITE_GLOBAL = 300; // consultas al día entre todas las personas (seguridad de gasto)
const MODELO_PLATO = 'claude-haiku-5-5'; // rápido y barato, ve imágenes
const MODELO_TALLER = 'claude-sonnet-5-5'; // más conocimiento de componentes y compatibilidades

const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const usoRef = (uid, dia) => db.doc(`iaUso/${uid}_${dia}`);
const globalRef = (dia) => db.doc(`iaGlobal/${dia}`);

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
  if (modo === 'estado') {
    const s = await usoRef(uid, dia).get();
    return { quedan: Math.max(0, LIMITE_USUARIO - ((s.exists && s.data().n) || 0)), limite: LIMITE_USUARIO };
  }
  if (modo !== 'plato' && modo !== 'taller') throw new HttpsError('invalid-argument', 'Petición no válida.');

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

// Al borrar una cuenta, borra también sus contadores de uso de la IA.
exports.limpiarIA = functionsV1.region('europe-west1').auth.user().onDelete(async (user) => {
  const q = await db.collection('iaUso').where('uid', '==', user.uid).get();
  const b = db.batch();
  q.docs.forEach((d) => b.delete(d.ref));
  if (q.size) await b.commit();
});
