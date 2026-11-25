// Cuestionario inicial (rediseño 2026-11-15; directo desde la Fase B paso 4, 2026-11-25 (73)). Aquí viven los textos, los cálculos y el HTML de cada pantalla.
// No guarda estado: app.js tiene `st.ob` y llama a estas funciones. Pantallas (en orden):
//   basicos (nombre, apellidos y sexo) → medidas (edad y estatura) → exp → donde → material (siempre; con Gimnasio sale su lista pre-marcada) → dias → tiempo
//   → peso (actual + qué quiere lograr) → meta (peso objetivo) → ritmo (con la fecha en vivo) → obstaculos → plan → registro (solo si el cuestionario se hizo SIN cuenta: `o.anon`)
// Sin pantallas de relleno ni esperas artificiales: (73) retiró psicologia, historia, carga (4,5 s) y firma (pausa de 5,6 s + mantener pulsado 2 s).
// Los pasos antiguos guardados en `cadencia-ob-anon` se recolocan con `pasoVigente`.
import { esc, nf, num, I } from './util.js';
import { legalLinksHTML, legalCheckHTML } from './legal.js';
import { betaTagHTML, BETA_AVISO_REGISTRO } from './pro.js';
import { APPLE_LOGIN, APOYO_URL } from './config.js';

/* ---------- datos ---------- */
// Los ids de «dónde» son los mismos que usa el asistente de rutinas (gym, casa, parque), así lo guardado le sirve de punto de partida.
export const DONDE = [
  { id: 'casa', t: 'Casa', s: 'Con el material que tengas', ico: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
  { id: 'gym', t: 'Gimnasio', s: 'Máquinas, poleas y peso libre', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'parque', t: 'Calistenia', s: 'Barras, paralelas y tu peso', ico: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-1.5 5 1.5M8.5 21l3.5-7 3.5 7"/>' },
];
// `eq` = id equivalente del asistente de rutinas (null si no tiene: dominadas, banco, anillas y paralelas son de peso corporal).
export const MATERIAL = [
  { id: 'mancuernas', t: 'Mancuernas', eq: 'mancuernas', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'dominadas', t: 'Barra de dominadas', eq: null, ico: '<path d="M3 4h18M6 4v3M18 4v3"/><circle cx="12" cy="9" r="1.7"/><path d="M12 11v5M9 21l3-5 3 5"/>' },
  { id: 'banda', t: 'Bandas elásticas', eq: 'banda', ico: '<path d="M4 17c4-9 12-9 16 0"/><path d="M4 12c4-7 12-7 16 0"/>' },
  { id: 'kettlebell', t: 'Kettlebells', eq: 'kettlebell', ico: '<circle cx="12" cy="14.5" r="6"/><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0"/>' },
  { id: 'barra', t: 'Barra con discos', eq: 'barra', ico: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>' },
  { id: 'banco', t: 'Banco', eq: null, ico: '<path d="M3 13h18M5 13v5M19 13v5M7 13v-3h10v3"/>' },
  { id: 'suspension', t: 'Anillas o TRX', eq: null, ico: '<path d="M9 3v8M15 3v8"/><circle cx="9" cy="14.5" r="3"/><circle cx="15" cy="14.5" r="3"/>' },
  { id: 'paralelas', t: 'Paralelas o fondos', eq: null, ico: '<path d="M6 8h12M6 14h12M8 8v12M16 8v12"/>' },
  { id: 'ninguno', t: 'Solo mi cuerpo', eq: null, ico: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-1.5 5 1.5M8.5 21l3.5-7 3.5 7"/>' },
];
// Material de GIMNASIO (Fase 1, 2026-11-15). Salen TODOS pre-marcados cuando eliges «Gimnasio»: la persona desmarca lo que no haya. Ids con prefijo `g_` para no chocar con los de casa.
// `eq` = id equivalente del asistente de rutinas (maquina · mancuernas · barra · kettlebell); null = no cambia el equipo del asistente.
export const MATERIAL_GYM = [
  { id: 'g_maquinas', t: 'Máquinas guiadas', eq: 'maquina', ico: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M12 9v7M9 16h6"/>' },
  { id: 'g_poleas', t: 'Poleas y cables', eq: 'maquina', ico: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V16M8 21h8M12 16l-3 5M12 16l3 5"/>' },
  { id: 'g_barras', t: 'Barras y discos', eq: 'barra', ico: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>' },
  { id: 'g_mancuernas', t: 'Mancuernas', eq: 'mancuernas', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'g_rack', t: 'Rack o jaula de sentadillas', eq: null, ico: '<path d="M5 3v18M19 3v18M5 8h14M5 14h14"/>' },
  { id: 'g_banco', t: 'Bancos', eq: null, ico: '<path d="M3 13h18M5 13v5M19 13v5M7 13v-3h10v3"/>' },
  { id: 'g_dominadas', t: 'Dominadas y paralelas', eq: null, ico: '<path d="M3 4h18M6 4v3M18 4v3"/><circle cx="12" cy="9" r="1.7"/><path d="M12 11v5M9 21l3-5 3 5"/>' },
  { id: 'g_kettlebell', t: 'Kettlebells', eq: 'kettlebell', ico: '<circle cx="12" cy="14.5" r="6"/><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0"/>' },
  { id: 'g_cardio', t: 'Cardio (cintas y bicis)', eq: null, ico: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v5l3 3M12 12l-3 3v5M9 9l-3 2"/>' },
];
export const MATERIAL_TODOS = [...MATERIAL, ...MATERIAL_GYM];
export const esGym = (id) => MATERIAL_GYM.some((m) => m.id === id);
// «¿Cuánto dura tu sesión ideal?» (minutos por sesión; 90 = 90 o más).
export const TIEMPOS = [[15, 'Relámpago'], [30, 'Directo al grano'], [45, 'Equilibrado'], [60, 'Entreno completo'], [90, 'Modo Bestia']];
export const tiempoTxt = (m) => `${m}${m >= 90 ? '+' : ''} min`;
// Chips compactos de minutos por sesión (15 · 30 · 45 · 60 · 90). Los usa el asistente de rutinas (`rw-min`) y Perfil › Detalles (`pf-min`).
export function minutosSegHTML(sel, act, titulo, ayuda = '') {
  const m = TIEMPOS.some(([x]) => x === Number(sel)) ? Number(sel) : 60;
  return `<div class="min-blk" role="group" aria-label="${esc(titulo)}">
    <span class="min-t">${esc(titulo)} · <b>${m}${m >= 90 ? '+' : ''} min</b></span>
    <div class="min-seg">${TIEMPOS.map(([x]) => `<button type="button" data-act="${act}" data-v="${x}" aria-pressed="${m === x}" aria-label="${x}${x >= 90 ? ' o más' : ''} minutos">${x}${x >= 90 ? '+' : ''}</button>`).join('')}</div>
    ${ayuda ? `<small class="muted">${esc(ayuda)}</small>` : ''}
  </div>`;
}
// «¿Cuál es tu mayor enemigo al entrenar?» (selección única). Los ids son los que se guardan en `obstaculo` (no cambian: el servidor los lee).
export const OBSTACULOS = [
  { id: 'tiempo', t: 'Falta de tiempo libre', ico: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  { id: 'conocimiento', t: 'No saber qué rutinas seguir', ico: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/>' },
  { id: 'motivacion', t: 'Me desmotivo rápido', ico: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>' },
  { id: 'lesiones', t: 'Molestias articulares o lesiones', ico: '<path d="M8.5 15.5l7-7M5 12a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 0l7 7a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5 0z"/>' },
  { id: 'equipamiento', t: 'Poco material a mano', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/><path d="M3 3l18 18"/>' },
];
// «¿Te suena alguna de estas situaciones?» (pantalla retirada en (73)). Se conserva la lista para leer y respetar el `psico` de cuentas antiguas
// (booleanos por frase; el Coach AI los sigue leyendo si existen). Las cuentas nuevas no lo rellenan.
export const PSICO = [
  { id: 'constancia', t: 'Empiezo con motivación pero siempre acabo dejándolo.' },
  { id: 'eleccion', t: 'Llego a entrenar y no tengo claro qué ejercicios hacer.' },
  { id: 'eficiencia', t: 'Siento que me esfuerzo mucho para los resultados que veo.' },
  { id: 'motivacion', t: 'Me cuesta arrancar si no tengo a alguien empujándome.' },
];
// Mismos ids que `RW_EXP` del asistente de rutinas (nuevo · anio · anios), para precargarlo.
export const EXPS = [
  { id: 'nuevo', t: 'Principiante', s: 'Menos de 6 meses' },
  { id: 'anio', t: 'Intermedio', s: 'Cerca de 1 año' },
  { id: 'anios', t: 'Avanzado', s: 'Varios años' },
];
export const FREQ = [[2, 'Para arrancar'], [3, 'Constante'], [4, 'Comprometido'], [5, 'Increíble'], [6, 'Sin excusas'], [7, 'Imparable']];
// Número de paso que se enseña («Paso 2 de 11»). Si cambias `flujo`, cambia esto a la vez. `donde` y `material` comparten número (es la misma pregunta en dos pantallas);
// `registro` no tiene número («Último paso»).
export const PASO = { basicos: 1, medidas: 2, exp: 3, donde: 4, material: 4, dias: 5, tiempo: 6, peso: 7, meta: 8, ritmo: 9, obstaculos: 10, plan: 11 };
export const PASOS = 11;
// Versión del cuestionario (se guarda en `onboardingVersion` al firmar). Quien lo firmó con una versión MENOR lo repite una vez (puerta en app.js: `onboardingHecho`).
// Súbela SOLO cuando las preguntas nuevas importen de verdad: obliga a TODAS las cuentas a repetirlo. 1 = sin campo (15-11) · 2 = Fase 1 (16-11).
export const VERSION = 2;
// Qué quiere lograr (paso 3). `obj` = objetivos que se guardan en el perfil (recomposición = perder grasa + ganar músculo).
export const METAS = [
  { id: 'perder', t: 'Perder grasa', s: 'Bajar peso sin perder fuerza', obj: ['perder'], ico: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: 'volumen', t: 'Ganar volumen', s: 'Más músculo y más fuerza', obj: ['musculo'], ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'recomp', t: 'Recomposición', s: 'Perder grasa y ganar músculo a la vez', obj: ['perder', 'musculo'], ico: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>' },
];
// Ritmo de progreso (paso 6, después del peso meta: la fecha en vivo necesita los dos pesos): lo elige la persona, de 0,25 a 1 kg por semana.
export const RITMO = { min: 0.25, max: 1, step: 0.05, def: 0.5 };

const svg = (p, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const tick = (on) => `<span class="tick">${on ? I.check : ''}</span>`;
const expDe = (id) => EXPS.find((e) => e.id === id);

/* ---------- lógica ---------- */
// `material` sale SIEMPRE (con solo Gimnasio también: lista de gimnasio pre-marcada). `meta` va ANTES de `ritmo` para poder calcular la fecha en vivo al deslizar.
export const flujo = (o) => ['basicos', 'medidas', 'exp', 'donde', 'material', 'dias', 'tiempo', 'peso', 'meta', 'ritmo', 'obstaculos', 'plan', ...(o && o.anon ? ['registro'] : [])];
// Pasos de versiones anteriores (un avance a medias guardado en `cadencia-ob-anon`) → paso vigente más cercano. Lo desconocido vuelve al principio.
const PASO_ANTIGUO = { nombre: 'basicos', sexo: 'basicos', edad: 'medidas', altura: 'medidas', psicologia: 'plan', historia: 'plan', carga: 'plan', firma: 'plan' };
export const pasoVigente = (step, o) => { const f = flujo(o); return f.includes(step) ? step : PASO_ANTIGUO[step] || f[0]; };

export function puedeSeguir(o) {
  switch (o.step) {
    case 'basicos': return !!(o.nombre.trim() && o.apellidos.trim() && o.sexo);
    case 'medidas': return !!(String(o.edad).trim() && String(o.alturaCm).trim());
    case 'exp': return !!o.exp;
    case 'donde': return o.donde.length > 0;
    case 'material': return o.material.length > 0;
    case 'dias': return o.freq >= 2 && o.freq <= 7;
    case 'tiempo': return TIEMPOS.some(([m]) => m === o.tiempo);
    case 'obstaculos': return OBSTACULOS.some((x) => x.id === o.obstaculo);
    case 'peso': return !!(o.pesoKg && o.meta);
    case 'ritmo': return o.ritmo >= RITMO.min && o.ritmo <= RITMO.max;
    case 'meta': return !!o.pesoObjetivo;
    default: return true;
  }
}

// Objetivos de perfil según lo que elige en el paso 3 (perder → ['perder'], volumen → ['musculo'], recomposición → los dos).
export const objetivosDe = (meta) => { const m = METAS.find((x) => x.id === meta); return m ? [...m.obj] : ['mantener']; };
// Ritmo válido (0,25–1 kg/semana, de 0,05 en 0,05) a partir de lo que llegue del slider.
export const ritmoDe = (v) => { const n = Math.round(parseFloat(v) * 20) / 20; return n >= RITMO.min && n <= RITMO.max ? Math.round(n * 100) / 100 : RITMO.def; };
export const fmtRitmo = (r) => String(Math.round(r * 100) / 100).replace('.', ',');
// Etiqueta dinámica del ritmo: < 0,4 conservador · 0,4–0,65 moderado · más, agresivo.
export function ritmoInfo(r) {
  return r < 0.4 ? { nivel: 'ok', t: 'Conservador.', s: 'Lento pero muy sostenible.' }
    : r < 0.65 ? { nivel: 'ok', t: 'Moderado.', s: 'El equilibrio perfecto.' }
      : { nivel: 'mid', t: 'Agresivo.', s: 'Requiere disciplina estricta.' };
}

// Material para el asistente de rutinas: sale de lo MARCADO (gimnasio y casa/parque); sin nada → solo peso corporal.
// Con Gimnasio y todo marcado da maquina + mancuernas + barra + kettlebell, como antes el gimnasio completo.
export function eqDesde(donde, material) {
  const eq = new Set();
  material.forEach((id) => {
    const m = MATERIAL_TODOS.find((x) => x.id === id);
    if (!m || !m.eq) return;
    if (esGym(id) && !donde.includes('gym')) return; // por si queda material de gimnasio de una elección anterior
    eq.add(m.eq);
  });
  if (!eq.size) eq.add('ninguno');
  return [...eq];
}
// Marcar/desmarcar un material. El de gimnasio es independiente; «Solo mi cuerpo» es excluyente solo entre el material de casa/parque.
export function alternaMaterial(sel, id) {
  const on = sel.includes(id);
  if (esGym(id)) return on ? sel.filter((x) => x !== id) : [...sel, id];
  if (id === 'ninguno') return on ? sel.filter((x) => x !== 'ninguno') : [...sel.filter(esGym), 'ninguno'];
  return on ? sel.filter((x) => x !== id) : [...sel.filter((x) => x !== 'ninguno'), id];
}
// Al entrar en la pantalla de material: quita lo que ya no corresponde a los sitios elegidos y, la PRIMERA vez que hay Gimnasio, lo marca TODO
// (la persona desmarca lo que no tenga). `gymInit` evita volver a marcar lo que ya desmarcó. Devuelve { material, gymInit }.
export function materialInicial(o) {
  const gym = o.donde.includes('gym'), casa = o.donde.some((d) => d === 'casa' || d === 'parque');
  let m = o.material.filter((id) => (esGym(id) ? gym : casa)), init = gym ? !!o.gymInit : false;
  if (gym && !init) { m = [...new Set([...m, ...MATERIAL_GYM.map((x) => x.id)])]; init = true; }
  return { material: m, gymInit: init };
}

// Termómetro: % de cambio respecto al peso actual. < 10 verde · 10–15 naranja · > 15 rojo (se compara con 1 decimal).
export function termometro(actual, meta) {
  if (!(actual > 0) || !(meta > 0)) return null;
  const dif = meta - actual, pct = Math.round((Math.abs(dif) / actual) * 1000) / 10, gana = dif > 0;
  if (Math.abs(dif) < 0.05) return { nivel: 'none', pct: 0, dif: 0, txt: 'Mantener tu peso también es una gran meta' };
  const nivel = pct < 10 ? 'ok' : pct <= 15 ? 'mid' : 'high';
  const txt = nivel === 'ok' ? 'Fácil de lograr. Un buen primer objetivo'
    : nivel === 'mid' ? `Objetivo realista. Tasa de ${gana ? 'ganancia' : 'pérdida'} saludable`
      : 'Objetivo ambicioso. Requerirá tiempo y constancia';
  return { nivel, pct, dif, txt };
}

// Fecha orientativa (mockup de «Proyección IA»): semanas = |meta − actual| / ritmo elegido por la persona (kg por semana), redondeado hacia arriba, mínimo 1.
export function estimarMeta(actual, meta, hoyISO, ritmo) {
  const dif = Math.abs(meta - actual);
  if (!(actual > 0) || !(meta > 0) || !(ritmo > 0) || dif < 0.5) return null;
  const sem = Math.max(1, Math.ceil(dif / ritmo));
  const fecha = new Date(`${hoyISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + sem * 7);
  return { semanas: sem, fecha };
}

// Recomposición corporal (perder grasa y ganar músculo a la vez): a qué peso debería quedar la persona.
// Masa magra actual (con su % de grasa; si no lo ha medido, se estima con la fórmula de Deurenberg a partir del IMC, la edad y el sexo)
// + una ganancia razonable de músculo (3 % de la masa magra) y un % de grasa «en forma» (15 % hombres, 24 % mujeres) → peso objetivo.
// Si ya está en ese % de grasa, el objetivo es mantener el peso (solo gana músculo). Devuelve null si faltan datos.
export const RECOMP_MUSCULO = 0.03, RECOMP_GRASA = { hombre: 0.15, mujer: 0.24 };
export function pesoRecomp({ kg, alturaCm, sexo, edad, grasaPct }) {
  if (!(kg >= 30 && kg <= 300) || !(alturaCm >= 120 && alturaCm <= 230)) return null;
  const mujer = sexo === 'mujer', medido = grasaPct > 2 && grasaPct < 60;
  let bf;
  if (medido) bf = grasaPct / 100;
  else {
    if (!(edad >= 14 && edad <= 100)) return null;
    const imc = kg / ((alturaCm / 100) ** 2);
    bf = Math.min(0.5, Math.max(0.05, (1.2 * imc + 0.23 * edad - 10.8 * (mujer ? 0 : 1) - 5.4) / 100));
  }
  const meta = RECOMP_GRASA[mujer ? 'mujer' : 'hombre'], magra = kg * (1 - bf), musculo = magra * RECOMP_MUSCULO;
  const r = (v) => Math.round(v * 2) / 2;
  const yaEnForma = bf <= meta + 0.01;
  const objetivo = yaEnForma ? r(kg) : Math.min(r(kg), r((magra + musculo) / (1 - meta)));
  const grasaBaja = yaEnForma ? 0 : Math.max(0, kg * bf - (objetivo - (magra + musculo)));
  return { objetivo, bfActual: Math.round(bf * 1000) / 10, bfMeta: Math.round(meta * 100), musculo: Math.round(musculo * 10) / 10, grasa: Math.round(grasaBaja * 10) / 10, yaEnForma, medido };
}
// Tarjeta de recomposición (la usan el cuestionario y Perfil › Detalles personales). `act` = data-act del botón «Usar».
export function recompCardHTML(r, act) {
  const txt = r.yaEnForma
    ? `Ya estás en un % de grasa bueno (${nf(r.bfActual, 0)} %): mantén tu peso y gana unos <b>${nf(r.musculo, 1)} kg</b> de músculo.`
    : `Perderás unos <b>${nf(r.grasa, 1)} kg</b> de grasa y ganarás unos <b>${nf(r.musculo, 1)} kg</b> de músculo, hasta un ${nf(r.bfMeta, 0)} % de grasa.`;
  return `<div class="recomp" id="recomp"><p class="small"><b>Recomposición corporal</b> · peso estimado: <b>${nf(r.objetivo, 1)} kg</b>. ${txt}
    <span class="muted">${r.medido ? 'Calculado con tu % de grasa.' : 'Estimado sin medir tu grasa: añádela al registrar tu peso para afinarlo.'}</span></p>
    <button type="button" class="btn ghost small" data-act="${act}" data-v="${r.objetivo}">Usar ${nf(r.objetivo, 1)} kg como objetivo</button></div>`;
}
const fechaLarga = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (d) => d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '');

/* ---------- pantallas ---------- */
// «Tus datos» en dos pantallas: nombre, apellidos y sexo (`basicos`); edad y estatura (`medidas`).
export function basicosHTML(o) {
  return `<h1 class="ob-title">Tus datos</h1>
    <p class="ob-sub">Tu nombre personaliza el plan; el sexo sirve para calcular tu gasto de energía.</p>
    <label class="field"><span>Nombre</span><input class="input" data-ob="nombre" value="${esc(o.nombre)}" maxlength="40" autocomplete="given-name" required></label>
    <label class="field"><span>Apellidos</span><input class="input" data-ob="apellidos" value="${esc(o.apellidos)}" maxlength="60" autocomplete="family-name" required></label>
    <div class="field" role="group" aria-labelledby="ob-sexo-l"><span id="ob-sexo-l">Sexo</span>
      <div class="pair">
        <button type="button" class="choice" data-act="sex" data-v="hombre" aria-pressed="${o.sexo === 'hombre'}"><span class="ico">${I.male}</span>Hombre</button>
        <button type="button" class="choice" data-act="sex" data-v="mujer" aria-pressed="${o.sexo === 'mujer'}"><span class="ico">${I.female}</span>Mujer</button>
      </div>
    </div>`;
}
export function medidasHTML(o) {
  return `<h1 class="ob-title">Edad y estatura</h1>
    <p class="ob-sub">Con tu peso, las usamos para calcular tus calorías.</p>
    <div class="ob-medidas">
      <label class="field"><span>Edad</span><div class="big-input"><input name="edad" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(o.edad)}" placeholder="30" data-ob="edad" autofocus><em>años</em></div></label>
      <label class="field"><span>Estatura</span><div class="big-input"><input name="alturaCm" inputmode="decimal" maxlength="4" value="${esc(o.alturaCm)}" placeholder="175" data-ob="alturaCm"><em>cm</em></div></label>
    </div>`;
}
export function expHTML(o) {
  return `<h1 class="ob-title">¿Cuánta experiencia tienes entrenando?</h1>
    <div class="exp3">${EXPS.map((e) => `<button type="button" class="choice" data-act="ob-exp" data-v="${e.id}" aria-pressed="${o.exp === e.id}">${e.t}<small>${e.s}</small></button>`).join('')}</div>`;
}

// Primera pantalla de quien NO tiene sesión: el cuestionario empieza sin cuenta (los botones los gestiona app.js).
// (74) Dos versiones: en la PWA instalada (`opts.pwa`) la bienvenida compacta de siempre; en el navegador, la portada pública (`portadaHTML`).
// `opts.ref` = hay un código de invitación guardado (?ref=): se avisa de los 7 días de PRO.
// Apoyo voluntario (75): enlace discreto del pie; abre la hoja informativa de app.js (no va a Ko-fi directo). Oculto si APOYO_URL está vacía.
const apoyoLinkHTML = (cls = '') => (String(APOYO_URL || '').trim() ? `<button type="button" class="apoyo-link ${cls}" data-act="apoyo-open">Apoyar el proyecto</button>` : '');
const REF_AVISO = '<p class="lp-ref" role="status"><b>Invitación aplicada</b> · Al registrarte tendrás 7 días de Cadencia PRO gratis.</p>';
export function bienvenidaHTML(hero, hayAvance, opts = {}) {
  if (!opts.pwa) return portadaHTML(hayAvance, opts);
  return `<div class="screen bv">
    <div class="auth-hero">${hero}</div>
    <div class="bv-body">
      ${betaTagHTML()}
      ${opts.ref ? REF_AVISO : ''}
      <h1 class="ob-title">Construye tu mejor versión</h1>
      <p class="ob-sub">Responde unas preguntas y te preparamos un plan hecho para ti.</p>
    </div>
    <div class="bv-foot">
      <button type="button" class="btn block" data-act="ob-empezar">${hayAvance ? 'SEGUIR DONDE LO DEJÉ' : 'EMPEZAR'}</button>
      <button type="button" class="link bv-in" data-act="auth-ingresar">¿Ya tienes cuenta? Iniciar sesión</button>
      ${legalLinksHTML()}
      ${apoyoLinkHTML('bv-apoyo')}
    </div>
  </div>`;
}

/* ---------- portada pública (cadenciafit.app sin sesión, en el navegador) (74) ---------- */
// Oscura a propósito también en modo claro (como .exview/.rnv): `.lp` redefine las variables del tema por dentro.
// Textos honestos: beta gratuita sin pagos (PAGOS_ACTIVOS = false), sin cifras ni testimonios, sin Apple ni ciclismo.
const LP_MARCA = '<svg class="lp-mark" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor"><path d="M12 8H56V22H28V42H56V56H12Z" transform="translate(6.8 0) skewX(-12)"/></svg>';
const LP_FUNCIONES = [
  ['plates', 'Registro sin fricción', 'Peso total o por lado con mancuernas, series unilaterales I/D, RIR, notas fijas por ejercicio, descanso automático y calculadora de discos.'],
  ['barcode', 'Nutrición y escáner gratis', 'Escáner de códigos de barras siempre gratis, análisis de platos con foto e IA, hidratación y un check-in semanal que ajusta tus calorías con tu peso real.'],
  ['body', 'Mapa de fatiga en 3D', 'Un cuerpo interactivo calcula la recuperación de cada grupo muscular a partir de tus series, tu carga y tu RIR.'],
  ['brain', 'Coach AI y ajuste de rutinas', 'Cambia tu rutina escribiendo lo que quieres y revisa la propuesta antes de guardarla. El Coach AI analiza cada entreno con tus métricas reales.'],
  ['share', 'Compartir sin ruido', 'Tarjetas limpias para Stories, también con fondo transparente. Y cero anuncios.'],
];
const LP_GRATIS = [
  'Registro de entrenos completo, con descanso automático y calculadora de discos',
  'Hasta 3 rutinas y 3 ejercicios propios',
  '3 ajustes de rutina con IA al día',
  'Escáner de códigos de barras sin límite',
  '1 análisis de plato con foto al día',
  'Hidratación, check-in semanal y tarjetas para compartir',
];
const LP_PRO = [
  'Coach AI: análisis de cada entreno',
  'Mapa de fatiga completo',
  'RIR y drop sets en el entreno en vivo',
  '10 ajustes de rutina con IA al día',
  'Rutinas y ejercicios propios sin límite, y más análisis de platos',
];
const lpLista = (l) => `<ul class="lp-list">${l.map((t) => `<li>${I.check}<span>${t}</span></li>`).join('')}</ul>`;
function portadaHTML(hayAvance, opts) {
  const cta = hayAvance ? 'Seguir donde lo dejé' : 'Empezar gratis';
  return `<div class="lp">
    <header class="lp-top"><div class="lp-in lp-bar">
      <span class="lp-brand">${LP_MARCA}<span>Cadencia</span></span>
      <button type="button" class="lp-login" data-act="auth-ingresar">Iniciar sesión</button>
    </div></header>
    <main class="lp-in">
      <section class="lp-hero" aria-labelledby="lp-h1">
        ${betaTagHTML('lp-beta')}
        ${opts.ref ? REF_AVISO : ''}
        <h1 class="lp-h1" id="lp-h1">Entreno, nutrición y datos reales. Sin ruido.</h1>
        <p class="lp-sub">Registra tu fuerza en segundos, escanea códigos de barras gratis, ajusta tu nutrición con tus datos y sigue tu recuperación con el mapa de fatiga en 3D y el Coach AI.</p>
        <div class="lp-cta">
          <button type="button" class="btn block lp-btn" data-act="ob-empezar">${cta}</button>
          <p class="lp-nota">Sin anuncios · Gratis en iPhone, Android y ordenador</p>
        </div>
      </section>
      <section class="lp-sec" aria-labelledby="lp-f">
        <h2 class="lp-h2" id="lp-f">Diseñada para entrenar de verdad</h2>
        <ul class="lp-grid">${LP_FUNCIONES.map(([ico, t, d]) => `<li class="lp-card"><span class="lp-ico">${I[ico]}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ul>
      </section>
      <section class="lp-sec lp-betab" aria-labelledby="lp-b">
        <h2 class="lp-h2" id="lp-b">Beta abierta</h2>
        <p class="lp-txt">Cadencia está en beta abierta: no hay pagos ni datos de tarjeta. Esto es lo que tienes hoy y lo que forma parte de Cadencia PRO.</p>
        <div class="lp-cols">
          <div class="lp-col"><h3>Gratis hoy</h3>${lpLista(LP_GRATIS)}</div>
          <div class="lp-col lp-col-pro"><h3><span class="lp-pro">Pro</span> Cadencia PRO</h3>${lpLista(LP_PRO)}
            <p class="lp-txt">Hoy PRO no se vende. Puedes probarlo 7 días con el código de invitación de un amigo o apuntarte a la lista prioritaria desde tu perfil.</p></div>
        </div>
      </section>
      <section class="lp-end" aria-labelledby="lp-e">
        <h2 class="lp-h2" id="lp-e">Tu plan, en unos minutos</h2>
        <p class="lp-txt">Responde 11 preguntas sobre tu nivel, tu material y tu objetivo. Calculamos tus calorías y la fecha estimada para llegar a tu meta.</p>
        <button type="button" class="btn block lp-btn" data-act="ob-empezar">${hayAvance ? 'Seguir donde lo dejé' : 'Crear mi plan gratis'}</button>
        <button type="button" class="link lp-in-link" data-act="auth-ingresar">¿Ya tienes cuenta? Iniciar sesión</button>
      </section>
    </main>
    <footer class="lp-foot"><div class="lp-in lp-foot-in">
      <span class="lp-brand sm">${LP_MARCA}<span>Cadencia</span></span>
      <span class="lp-meta"><span class="lp-web">@cadenciafit.app</span>${apoyoLinkHTML('lp-apoyo')}</span>
      ${legalLinksHTML('lp-legal')}
    </div></footer>
  </div>`;
}

// Último paso (cuestionario sin cuenta): crear la cuenta guarda TODO lo respondido. `o.regEmail` despliega el formulario de email.
export function registroHTML(o) {
  const ocupado = !!o.saving;
  return `<h1 class="ob-title">Regístrate para guardar tu plan personalizado</h1>
    <p class="ob-sub">No compartimos tus datos.</p>
    ${betaTagHTML('beta-r')}
    <p class="small muted beta-nota">${BETA_AVISO_REGISTRO}</p>
    <label class="check"><input type="checkbox" data-ob="acepto" ${o.acepto ? 'checked' : ''}><span>Acepto los ${legalCheckHTML()}</span></label>
    <div class="reg-btns">
      <button type="button" class="btn block" data-act="reg-google" ${ocupado ? 'disabled' : ''}>Continuar con Google</button>
      ${APPLE_LOGIN ? `<button type="button" class="btn block" data-act="reg-apple" ${ocupado ? 'disabled' : ''}>Continuar con Apple</button>` : ''}
      ${o.regEmail ? `<div class="reg-email">
        <label class="field"><span>Email</span><input class="input" type="email" data-ob="regEmailV" value="${esc(o.regEmailV || '')}" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="tu@email.com"></label>
        <label class="field"><span>Contraseña</span><div class="pass-wrap"><input class="input" type="password" data-ob="regPass" value="${esc(o.regPass || '')}" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres"><button type="button" data-act="peek">Ver</button></div></label>
        <button type="submit" class="btn block" ${ocupado ? 'disabled' : ''}>${ocupado ? '<span class="spinner"></span>' : 'Crear cuenta'}</button>
      </div>` : `<button type="button" class="btn block quiet" data-act="reg-email" ${ocupado ? 'disabled' : ''}>Continuar con Email</button>`}
    </div>`;
}

export function dondeHTML(o) {
  return `<h1 class="ob-title">¿Qué equipamiento tienes?</h1>
    <p class="ob-sub">Elige todos los sitios donde entrenas. Te propondremos ejercicios con eso.</p>
    <div class="choices">${DONDE.map((d) => `<button type="button" class="choice" data-act="ob-donde" data-v="${d.id}" aria-pressed="${o.donde.includes(d.id)}">
      <span class="ico">${svg(d.ico)}</span><span class="t">${d.t}<small>${d.s}</small></span>${tick(o.donde.includes(d.id))}</button>`).join('')}</div>`;
}

export function materialHTML(o) {
  const gym = o.donde.includes('gym'), casa = o.donde.some((d) => d === 'casa' || d === 'parque');
  const lista = (arr) => `<div class="choices tight">${arr.map((m) => `<button type="button" class="choice" data-act="ob-mat" data-v="${m.id}" aria-pressed="${o.material.includes(m.id)}">
      <span class="ico">${svg(m.ico, 20)}</span><span class="t">${m.t}</span>${tick(o.material.includes(m.id))}</button>`).join('')}</div>`;
  const sub = gym && casa ? 'Desmarca lo que no haya en tu gimnasio y marca lo que tengas en casa o en el parque.'
    : gym ? 'Desmarca lo que no haya en tu gimnasio.' : 'Marca todo lo que puedas usar en casa o en el parque.';
  return `<h1 class="ob-title">¿Qué material tienes?</h1>
    <p class="ob-sub">${sub}</p>
    ${gym ? `${casa ? '<h2 class="ob-q sm">En tu gimnasio</h2>' : ''}${lista(MATERIAL_GYM)}` : ''}
    ${casa ? `${gym ? '<h2 class="ob-q sm">En casa o en el parque</h2>' : ''}${lista(MATERIAL)}` : ''}`;
}

export function diasHTML(o) {
  return `<h1 class="ob-title">¿Cuántos días a la semana quieres entrenar?</h1>
    <p class="ob-sub">Será tu compromiso semanal y marcará cómo cuenta tu racha.</p>
    <div class="choices tight">${FREQ.map(([n, t]) => `<button type="button" class="choice freq" data-act="ob-dias" data-v="${n}" aria-pressed="${o.freq === n}">
      <span class="ico num">${n}</span><span class="t">${n} días<small>${t}</small></span>${tick(o.freq === n)}</button>`).join('')}</div>`;
}

// «¿Cuánto dura tu sesión ideal?» (selección única, `data-act="ob-tiempo"`).
export function tiempoHTML(o) {
  return `<h1 class="ob-title">¿Cuánto dura tu sesión ideal?</h1>
    <p class="ob-sub">Por sesión. Ajustaremos el volumen de tu plan a ese tiempo.</p>
    <div class="choices tight">${TIEMPOS.map(([m, t]) => `<button type="button" class="choice freq" data-act="ob-tiempo" data-v="${m}" aria-pressed="${o.tiempo === m}">
      <span class="ico num min">${m >= 90 ? '90+' : m}</span><span class="t"><span>${tiempoTxt(m)} <small>(${t})</small></span></span>${tick(o.tiempo === m)}</button>`).join('')}</div>`;
}

// «¿Cuál es tu mayor enemigo al entrenar?» (selección única, `data-act="ob-obst"`).
export function obstaculosHTML(o) {
  return `<h1 class="ob-title">¿Cuál es tu mayor enemigo al entrenar?</h1>
    <p class="ob-sub">Elige el que más te frena. Lo tendremos en cuenta en tu plan.</p>
    <div class="choices">${OBSTACULOS.map((x) => `<button type="button" class="choice" data-act="ob-obst" data-v="${x.id}" aria-pressed="${o.obstaculo === x.id}">
      <span class="ico">${svg(x.ico)}</span><span class="t">${x.t}</span>${tick(o.obstaculo === x.id)}</button>`).join('')}</div>`;
}

// Cajita del termómetro (se repinta sola al escribir: ver `ob-term` en app.js).
export function termometroHTML(actual, meta) {
  const t = termometro(actual, meta);
  if (!t) return '<div class="term-box none"><small>Escribe tu peso actual y tu peso objetivo para ver cuánto cambio supone.</small></div>';
  const cab = t.nivel === 'none' ? 'Sin cambio de peso' : `${t.dif < 0 ? 'Perder' : 'Ganar'} ${nf(Math.abs(t.dif), 1)} kg · ${nf(t.pct, 1)} % de tu peso`;
  const pos = Math.min(100, (t.pct / 25) * 100);
  return `<div class="term-wrap" style="--p:${pos}"><i class="term-pin"></i><div class="term-bar" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="term-scale" aria-hidden="true"><span>0 %</span><span>10 %</span><span>15 %</span><span>25 %+</span></div></div>
    <div class="term-box ${t.nivel}"><small>${cab}</small><b>${esc(t.txt)}</b></div>`;
}

// Paso 3: peso actual + qué quiere lograr.
export function pesoHTML(o) {
  return `<h1 class="ob-title">¿Cuál es tu peso actual?</h1>
    <label class="field"><span class="sr-only">Peso actual</span><div class="big-input"><input name="pesoKg" inputmode="decimal" maxlength="5" value="${esc(o.pesoKg)}" placeholder="72,5" data-ob="pesoKg" autofocus><em>kg</em></div></label>
    <small class="muted">Será el primer registro de tu historial de peso.</small>
    <h2 class="ob-q">¿Qué quieres lograr?</h2>
    <div class="choices">${METAS.map((m) => `<button type="button" class="choice" data-act="ob-meta" data-v="${m.id}" aria-pressed="${o.meta === m.id}">
      <span class="ico">${svg(m.ico)}</span><span class="t">${m.t}<small>${m.s}</small></span>${tick(o.meta === m.id)}</button>`).join('')}</div>`;
}

// Paso 4: ritmo. Los textos y el valor se repintan solos al mover el slider (app.js, sin render()).
export function ritmoInfoHTML(r) {
  const i = ritmoInfo(r);
  return `<div class="term-box ${i.nivel}"><small>≈ ${nf(r * 4.345, 1)} kg al mes</small><b>${i.t} ${i.s}</b></div>`;
}
export const ritmoPct = (r) => Math.round(((r - RITMO.min) / (RITMO.max - RITMO.min)) * 100);
// Fecha en vivo bajo el slider: «Llegarás a tu objetivo el [fecha]». Se repinta al deslizar (app.js, listener `input`, sin render()). Lee `o.ritmo`, `o.pesoKg` y `o.pesoObjetivo`.
export function ritmoFechaHTML(o, hoyISO) {
  const est = estimarMeta(num(o.pesoKg), num(o.pesoObjetivo), hoyISO, o.ritmo);
  if (!est) return o.meta === 'recomp' ? 'Mantendrás tu peso mientras ganas músculo y pierdes grasa.' : 'Mantendrás tu peso estable.';
  return `Llegarás a tu objetivo el <b>${fechaLarga(est.fecha)}</b>`;
}
export function ritmoHTML(o, hoyISO) {
  const verbo = o.meta === 'volumen' ? 'ganar' : 'perder';
  return `<h1 class="ob-title">¿A qué ritmo quieres avanzar?</h1>
    <p class="ob-sub">Elige cuántos kilos quieres ${verbo} cada semana. Más rápido exige más disciplina.</p>
    <div class="ritmo">
      <div class="ritmo-val"><b class="num" id="ob-ritmo-v">${fmtRitmo(o.ritmo)}</b><span>kg / semana</span></div>
      <input type="range" class="ritmo-rng" data-ob="ritmo" min="${RITMO.min}" max="${RITMO.max}" step="${RITMO.step}" value="${o.ritmo}" style="--p:${ritmoPct(o.ritmo)}%" aria-label="Ritmo en kilos por semana">
      <div class="ritmo-ticks" aria-hidden="true"><span>0,25</span><span>0,5</span><span>0,75</span><span>1</span></div>
      <p class="ritmo-fecha" id="ob-ritmo-fecha">${ritmoFechaHTML(o, hoyISO)}</p>
      <div id="ob-ritmo-txt" aria-live="polite">${ritmoInfoHTML(o.ritmo)}</div>
    </div>`;
}

// Paso 5: peso meta (campo + termómetro de siempre). Con «Recomposición» se estima a qué peso debería quedar (sin recomendaciones de IMC).
export const recompDe = (o) => pesoRecomp({ kg: num(o.pesoKg), alturaCm: num(o.alturaCm), sexo: o.sexo, edad: num(o.edad), grasaPct: null });
export function metaHTML(o) {
  const r = o.meta === 'recomp' ? recompDe(o) : null;
  return `<h1 class="ob-title">¿Cuál es tu peso meta?</h1>
    <p class="ob-sub">Hoy pesas ${nf(num(o.pesoKg), 1)} kg. Compáralo con tu meta y mira si es realista.</p>
    <label class="field"><span class="sr-only">Peso meta</span><div class="big-input"><input name="pesoObjetivo" inputmode="decimal" maxlength="5" value="${esc(o.pesoObjetivo)}" placeholder="68" data-ob="pesoObjetivo" autofocus><em>kg</em></div></label>
    ${r ? recompCardHTML(r, 'ob-recomp-usar') : ''}
    <div class="term" id="ob-term" aria-live="polite">${termometroHTML(num(o.pesoKg), num(o.pesoObjetivo))}</div>`;
}

// Proyección: línea de tu peso de hoy a tu meta según el ritmo elegido. Sin comparaciones inventadas.
function graficaHTML(actual, meta, est) {
  const x0 = 26, x1 = 294, top = 36, bot = 96, axis = 118, baja = meta < actual, igual = !est;
  const y0 = igual ? 66 : baja ? top : bot, y1 = igual ? 66 : baja ? bot : top, mx = (x0 + x1) / 2;
  const d = `M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  const mes = (f) => `<line x1="${x0 + (x1 - x0) * f}" x2="${x0 + (x1 - x0) * f}" y1="${axis - 2}" y2="${axis + 2}" stroke="currentColor" opacity=".35"/>`;
  return `<svg viewBox="0 0 320 150" role="img" aria-label="Proyección de tu peso: de ${nf(actual, 1)} kg hoy a ${nf(meta, 1)} kg${est ? ` hacia el ${fechaLarga(est.fecha)}` : ''}">
    <line x1="${x0}" x2="${x1}" y1="${axis}" y2="${axis}" stroke="currentColor" opacity=".25"/>${mes(0.25)}${mes(0.5)}${mes(0.75)}
    <path class="ar" d="${d} L${x1} ${axis} L${x0} ${axis} Z"/>
    <path class="ln" d="${d}" pathLength="1"/>
    <circle class="dot" cx="${x0}" cy="${y0}" r="5"/><circle class="dot fin" cx="${x1}" cy="${y1}" r="7"/>
    <text x="${x0}" y="${y0 - 11}" text-anchor="start" class="v">${nf(actual, 1)} kg</text>
    <text x="${x1}" y="${y1 - 13}" text-anchor="end" class="v">${nf(meta, 1)} kg</text>
    <text x="${x0}" y="138" text-anchor="start">Hoy</text>
    <text x="${x1}" y="138" text-anchor="end">${est ? fechaCorta(est.fecha) : 'Meta'}</text></svg>`;
}

export function planHTML(o, p, hoyISO) {
  const est = estimarMeta(p.pesoKg, p.pesoObjetivo, hoyISO, o.ritmo), e = expDe(o.exp);
  const frase = est
    ? `A <b>${fmtRitmo(o.ritmo)} kg por semana</b>, llegarías a tu meta hacia el <b class="proy-fecha">${fechaLarga(est.fecha)}</b>.`
    : o.meta === 'recomp' ? 'Objetivo: mantener tu peso mientras ganas músculo y pierdes grasa.' : 'Objetivo: mantener tu peso.';
  return `<h1 class="ob-title">Tu plan</h1>
    <div class="summary">
      <dl>
        <dt>Sexo</dt><dd>${p.sexo === 'mujer' ? 'Mujer' : 'Hombre'}</dd>
        <dt>Experiencia</dt><dd>${e ? e.t : '–'}</dd>
        <dt>Peso actual</dt><dd>${nf(p.pesoKg, 1)} kg</dd>
        <dt>Peso meta</dt><dd>${nf(p.pesoObjetivo, 1)} kg</dd>
        <dt>Ritmo</dt><dd>${fmtRitmo(o.ritmo)} kg/semana</dd>
        <dt>Entreno</dt><dd>${o.freq ? `${o.freq} días · ` : ''}${o.tiempo ? tiempoTxt(o.tiempo) : '–'}</dd>
      </dl>
    </div>
    <section class="proy" aria-label="Proyección">
      <span class="plan-chip">${svg(I_SPARK, 14, 2.4)}Proyección</span>
      <div class="proy-graf">${graficaHTML(p.pesoKg, p.pesoObjetivo, est)}</div>
      <p class="proy-txt">${frase}</p>
      ${est ? `<p class="small muted">Unas ${est.semanas} semanas al ritmo que has elegido. Es una estimación: el check-in semanal de Nutrición ajusta tus calorías con tus datos reales.</p>` : ''}
    </section>`;
}
const I_SPARK = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>';
