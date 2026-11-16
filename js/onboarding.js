// Cuestionario inicial (rediseño 2026-11-15). Aquí viven los textos, los cálculos y el HTML de cada pantalla.
// No guarda estado: app.js tiene `st.ob` y llama a estas funciones. Pantallas (en orden):
//   perfil → donde → material (siempre; con Gimnasio sale su lista pre-marcada) → dias → tiempo → peso (actual + qué quiere lograr) → meta (peso objetivo)
//   → ritmo (con la fecha en vivo) → obstaculos → plan → psicologia → firma
import { esc, nf, num, I } from './util.js';

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
// «¿Cuánto tiempo tienes para entrenar?» (minutos por sesión; 90 = 90 o más).
export const TIEMPOS = [[15, 'Express'], [30, 'Eficiente'], [45, 'En serio'], [60, 'Intenso'], [90, 'Obsesivo']];
export const tiempoTxt = (m) => `${m}${m >= 90 ? '+' : ''} min`;
// «¿Qué te impide alcanzar este objetivo?» (selección única). Los ids son los que se guardan en `obstaculo`.
export const OBSTACULOS = [
  { id: 'tiempo', t: 'Falta de tiempo', ico: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  { id: 'conocimiento', t: 'Falta de conocimiento', ico: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/>' },
  { id: 'motivacion', t: 'Motivación baja', ico: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>' },
  { id: 'lesiones', t: 'Lesiones o molestias físicas', ico: '<path d="M8.5 15.5l7-7M5 12a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 0l7 7a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5 0z"/>' },
  { id: 'equipamiento', t: 'Falta de equipamiento', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/><path d="M3 3l18 18"/>' },
];
// «¿Te sientes identificado?»: cuatro frases con Sí / No. Se guardan como booleanos en `psico` { [id]: true|false }.
export const PSICO = [
  { id: 'constancia', t: 'Me cuesta entrenar de forma constante sin fallar.' },
  { id: 'eleccion', t: 'No sé elegir los entrenamientos adecuados para mí.' },
  { id: 'eficiencia', t: 'A veces dudo si mi rutina es eficiente.' },
  { id: 'motivacion', t: 'Necesito motivación externa para seguir mi plan.' },
];
// Mismos ids que `RW_EXP` del asistente de rutinas (nuevo · anio · anios), para precargarlo.
export const EXPS = [
  { id: 'nuevo', t: 'Principiante', s: 'Menos de 6 meses' },
  { id: 'anio', t: 'Intermedio', s: 'Cerca de 1 año' },
  { id: 'anios', t: 'Avanzado', s: 'Varios años' },
];
export const FREQ = [[2, 'Para arrancar'], [3, 'Constante'], [4, 'Comprometido'], [5, 'Increíble'], [6, 'Sin excusas'], [7, 'Imparable']];
// Número de paso que se enseña («Paso 2 de 10»); «perfil» es la pantalla previa con tus datos. Si cambias `flujo`, cambia esto a la vez.
export const PASO = { donde: 1, material: 1, dias: 2, tiempo: 3, peso: 4, meta: 5, ritmo: 6, obstaculos: 7, plan: 8, psicologia: 9, firma: 10 };
export const PASOS = 10;
// Qué quiere lograr (paso 3). `obj` = objetivos que se guardan en el perfil (recomposición = perder grasa + ganar músculo).
export const METAS = [
  { id: 'perder', t: 'Perder grasa', s: 'Bajar peso sin perder fuerza', obj: ['perder'], ico: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: 'volumen', t: 'Ganar volumen', s: 'Más músculo y más fuerza', obj: ['musculo'], ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'recomp', t: 'Recomposición', s: 'Perder grasa y ganar músculo a la vez', obj: ['perder', 'musculo'], ico: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>' },
];
// Ritmo de progreso (paso 6, después del peso meta: la fecha en vivo necesita los dos pesos): lo elige la persona, de 0,25 a 1 kg por semana.
export const RITMO = { min: 0.25, max: 1, step: 0.05, def: 0.5 };
export const FIRMA_MS = 2000;

const svg = (p, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const tick = (on) => `<span class="tick">${on ? I.check : ''}</span>`;
const expDe = (id) => EXPS.find((e) => e.id === id);

/* ---------- lógica ---------- */
// `material` sale SIEMPRE (con solo Gimnasio también: lista de gimnasio pre-marcada). `meta` va ANTES de `ritmo` para poder calcular la fecha en vivo al deslizar.
export const flujo = (o) => ['perfil', 'donde', 'material', 'dias', 'tiempo', 'peso', 'meta', 'ritmo', 'obstaculos', 'plan', 'psicologia', 'firma'];

export function puedeSeguir(o) {
  switch (o.step) {
    case 'perfil': return !!(o.sexo && o.edad && o.nombre.trim() && o.apellidos.trim() && o.usuario && o.alturaCm && o.exp);
    case 'donde': return o.donde.length > 0;
    case 'material': return o.material.length > 0;
    case 'dias': return o.freq >= 2 && o.freq <= 7;
    case 'tiempo': return TIEMPOS.some(([m]) => m === o.tiempo);
    case 'obstaculos': return OBSTACULOS.some((x) => x.id === o.obstaculo);
    case 'psicologia': return PSICO.every((p) => typeof (o.psico || {})[p.id] === 'boolean');
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
export function perfilHTML(o, name) {
  return `<h1 class="ob-title">${name ? `${esc(name)}, cuéntanos` : 'Cuéntanos'} sobre ti</h1>
    <p class="ob-sub">Con esto calculamos cuánta energía gasta tu cuerpo y adaptamos tu plan.</p>
    <label class="field"><span>Nombre</span><input class="input" data-ob="nombre" value="${esc(o.nombre)}" maxlength="40" autocomplete="given-name" required></label>
    <label class="field"><span>Apellidos</span><input class="input" data-ob="apellidos" value="${esc(o.apellidos)}" maxlength="60" autocomplete="family-name" required></label>
    <label class="field"><span>Nombre de usuario</span><input class="input" data-ob="usuario" value="${esc(o.usuario)}" maxlength="20" autocapitalize="none" autocomplete="username" placeholder="ej. jean_ramirez" required><small>Letras, números, _ y -, sin espacios.</small></label>
    <div class="field"><span>Sexo</span>
      <div class="pair">
        <button type="button" class="choice" data-act="sex" data-v="hombre" aria-pressed="${o.sexo === 'hombre'}"><span class="ico">${I.male}</span>Hombre</button>
        <button type="button" class="choice" data-act="sex" data-v="mujer" aria-pressed="${o.sexo === 'mujer'}"><span class="ico">${I.female}</span>Mujer</button>
      </div>
    </div>
    <div class="ob-grid2">
      <label class="field"><span>Edad</span><div class="big-input sm"><input name="edad" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(o.edad)}" placeholder="30" data-ob="edad"><em>años</em></div></label>
      <label class="field"><span>Estatura</span><div class="big-input sm"><input name="alturaCm" inputmode="decimal" maxlength="4" value="${esc(o.alturaCm)}" placeholder="175" data-ob="alturaCm"><em>cm</em></div></label>
    </div>
    <div class="field"><span>Experiencia entrenando</span>
      <div class="exp3">${EXPS.map((e) => `<button type="button" class="choice" data-act="ob-exp" data-v="${e.id}" aria-pressed="${o.exp === e.id}">${e.t}<small>${e.s}</small></button>`).join('')}</div>
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

// «¿Cuánto tiempo tienes para entrenar?» (selección única, `data-act="ob-tiempo"`).
export function tiempoHTML(o) {
  return `<h1 class="ob-title">¿Cuánto tiempo tienes para entrenar?</h1>
    <p class="ob-sub">Por sesión. Ajustaremos el volumen de tu plan a ese tiempo.</p>
    <div class="choices tight">${TIEMPOS.map(([m, t]) => `<button type="button" class="choice freq" data-act="ob-tiempo" data-v="${m}" aria-pressed="${o.tiempo === m}">
      <span class="ico num min">${m >= 90 ? '90+' : m}</span><span class="t"><span>${tiempoTxt(m)} <small>(${t})</small></span></span>${tick(o.tiempo === m)}</button>`).join('')}</div>`;
}

// «¿Qué te impide alcanzar este objetivo?» (selección única, `data-act="ob-obst"`).
export function obstaculosHTML(o) {
  return `<h1 class="ob-title">¿Qué te impide alcanzar este objetivo?</h1>
    <p class="ob-sub">Elige el mayor obstáculo. Lo tendremos en cuenta en tu plan.</p>
    <div class="choices">${OBSTACULOS.map((x) => `<button type="button" class="choice" data-act="ob-obst" data-v="${x.id}" aria-pressed="${o.obstaculo === x.id}">
      <span class="ico">${svg(x.ico)}</span><span class="t">${x.t}</span>${tick(o.obstaculo === x.id)}</button>`).join('')}</div>`;
}

// «¿Te sientes identificado?»: cuatro frases en lista con Sí / No (`data-act="ob-psico"`, `data-k` = id de la frase, `data-v` = 1 | 0). Hay que contestar las cuatro.
export function psicologiaHTML(o) {
  const ps = o.psico || {};
  return `<h1 class="ob-title">¿Te sientes identificado?</h1>
    <p class="ob-sub">Responde con sinceridad: así Cadencia IA te acompaña mejor.</p>
    <div class="psico-list">${PSICO.map((p) => `<div class="psico-q" role="group" aria-label="${esc(p.t)}"><p>${esc(p.t)}</p>
      <div class="psico-btns">${[[1, 'Sí'], [0, 'No']].map(([v, l]) => `<button type="button" class="choice" data-act="ob-psico" data-k="${p.id}" data-v="${v}" aria-pressed="${ps[p.id] === (v === 1)}">${l}</button>`).join('')}</div></div>`).join('')}</div>`;
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

function graficaHTML(actual, meta, est) {
  const x0 = 26, x1 = 294, top = 30, bot = 100, baja = meta < actual, igual = !est;
  const y0 = igual ? 65 : baja ? top : bot, y1 = igual ? 65 : baja ? bot : top, mx = (x0 + x1) / 2;
  const d = `M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  const mes = (f) => `<line x1="${x0 + (x1 - x0) * f}" x2="${x0 + (x1 - x0) * f}" y1="112" y2="116" stroke="currentColor" opacity=".35"/>`;
  return `<svg viewBox="0 0 320 150" role="img" aria-label="Línea de tiempo de tu peso, de ${nf(actual, 1)} kg hoy a ${nf(meta, 1)} kg${est ? ` hacia el ${fechaLarga(est.fecha)}` : ''}">
    <line x1="${x0}" x2="${x1}" y1="114" y2="114" stroke="currentColor" opacity=".25"/>${mes(0.25)}${mes(0.5)}${mes(0.75)}
    <path class="ar" d="${d} L${x1} 114 L${x0} 114 Z"/>
    <path class="ln" d="${d}" pathLength="1"/>
    <circle class="dot" cx="${x0}" cy="${y0}" r="5"/><circle class="dot fin" cx="${x1}" cy="${y1}" r="7"/>
    <text x="${x0}" y="${y0 - 11}" text-anchor="start" class="v">${nf(actual, 1)} kg</text>
    <text x="${x1}" y="${y1 - 13}" text-anchor="end" class="v">${nf(meta, 1)} kg</text>
    <text x="${x0}" y="134" text-anchor="start">Hoy</text>
    <text x="${x1}" y="134" text-anchor="end">${est ? fechaCorta(est.fecha) : 'Meta'}</text></svg>`;
}

export function planHTML(o, p, hoyISO) {
  const est = estimarMeta(p.pesoKg, p.pesoObjetivo, hoyISO, o.ritmo), e = expDe(o.exp);
  const frase = est
    ? `A un ritmo de <b>${fmtRitmo(o.ritmo)} kg por semana</b>, estimamos que lograrás tu objetivo para el <b class="proy-fecha">${fechaLarga(est.fecha)}</b>.`
    : o.meta === 'recomp' ? 'Con Cadencia IA mantendrás tu peso mientras ganas músculo y pierdes grasa' : 'Con Cadencia IA mantendrás tu peso estable, con energía y constancia';
  return `<h1 class="ob-title">¡Tu plan está listo!</h1>
    <div class="summary">
      <dl>
        <dt>Sexo</dt><dd>${p.sexo === 'mujer' ? 'Mujer' : 'Hombre'}</dd>
        <dt>Experiencia</dt><dd>${e ? e.t : '–'}</dd>
        <dt>Peso actual</dt><dd>${nf(p.pesoKg, 1)} kg</dd>
        <dt>Peso meta</dt><dd>${nf(p.pesoObjetivo, 1)} kg</dd>
        <dt>Ritmo</dt><dd>${fmtRitmo(o.ritmo)} kg/semana</dd>
        <dt>Sesión</dt><dd>${o.tiempo ? tiempoTxt(o.tiempo) : '–'}</dd>
      </dl>
    </div>
    <section class="proy" aria-label="Proyección">
      <span class="plan-chip">${svg(I_SPARK, 14, 2.4)}Proyección Cadencia IA</span>
      <div class="proy-graf">${graficaHTML(p.pesoKg, p.pesoObjetivo, est)}</div>
      <p class="proy-txt">${frase}</p>
      ${est ? `<p class="small muted">Unas ${est.semanas} semanas. Es una estimación orientativa: cada cuerpo es distinto.</p>` : ''}
    </section>`;
}
const I_SPARK = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>';

const HUELLA = '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>';
export const FIRMA_TXT = 'Mantén pulsado para firmar';

export function firmaHTML(o, nombre) {
  const hecho = !!o.firmado;
  return `<h1 class="ob-title">Tu compromiso</h1>
    <p class="ob-sub">Firmarlo te ayuda a cumplirlo. Léelo y mantén pulsado.</p>
    <blockquote class="pact">
      <p>Prometo entrenar con Cadencia <b>${o.freq} veces a la semana</b>. Sin excusas.</p>
      <footer>${esc(nombre)}</footer>
    </blockquote>
    <div class="sign">
      <button type="button" class="sign-btn ${hecho ? 'done' : ''}" data-hold ${hecho ? 'disabled' : ''} aria-label="${FIRMA_TXT} durante 2 segundos">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="46"/><circle class="bar" cx="50" cy="50" r="46" pathLength="100" style="stroke-dashoffset:${hecho ? 0 : 100}"/></svg>
        <span class="sign-in">${hecho ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 64, 2.6) : svg(HUELLA, 64, 1.6)}<span class="sign-lbl" data-lbl="${FIRMA_TXT}">${hecho ? '¡Firmado!' : FIRMA_TXT}</span></span>
      </button>
      <p class="small muted">${hecho ? 'Guardando tu plan…' : 'Mantén el dedo 2 segundos. Si lo sueltas antes, se reinicia.'}</p>
    </div>`;
}

/* ---------- botón de firma: mantener pulsado 2 s ---------- */
// Se llama una sola vez al arrancar la app. Todo va por eventos de puntero (ratón, dedo y lápiz) y por teclado (barra espaciadora / Intro).
// El anillo se anima tocando el DOM directamente: si se llamara a render() a mitad se perdería el botón y la pulsación.
export function iniciarFirma(root, alFirmar) {
  let h = null; // pulsación en curso: { btn, t0, raf }
  const pinta = (b, p) => { const bar = b.querySelector('.bar'); if (bar) bar.style.strokeDashoffset = String(100 - p * 100); };
  const rotulo = (b, txt) => { const l = b.querySelector('.sign-lbl'); if (l) l.textContent = txt == null ? l.dataset.lbl : txt; };
  const parar = () => {
    if (!h) return;
    cancelAnimationFrame(h.raf);
    const b = h.btn; h = null;
    if (b.isConnected) { b.classList.remove('holding'); pinta(b, 0); rotulo(b); }
  };
  const tic = () => {
    if (!h) return;
    if (!h.btn.isConnected) return parar();
    const p = Math.min(1, (performance.now() - h.t0) / FIRMA_MS);
    pinta(h.btn, p);
    if (p < 1) { h.raf = requestAnimationFrame(tic); return; }
    const b = h.btn; h = null;
    b.classList.remove('holding'); b.classList.add('done'); rotulo(b, '¡Firmado!');
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* sin vibración */ }
    alFirmar();
  };
  const empezar = (b) => {
    if (h || b.disabled || b.classList.contains('done')) return false;
    h = { btn: b, t0: performance.now(), raf: 0 };
    b.classList.add('holding'); rotulo(b, 'Sigue pulsando…');
    h.raf = requestAnimationFrame(tic);
    return true;
  };
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-hold]');
    if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (empezar(b)) { try { b.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } }
  });
  root.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-hold]')) e.preventDefault(); });
  root.addEventListener('keydown', (e) => {
    const b = e.target.closest && e.target.closest('[data-hold]');
    if (b && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) empezar(b); }
  });
  root.addEventListener('keyup', (e) => { if (e.target.closest && e.target.closest('[data-hold]') && (e.key === ' ' || e.key === 'Enter')) parar(); });
  window.addEventListener('pointerup', parar);
  window.addEventListener('pointercancel', parar);
  window.addEventListener('blur', parar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
  // Si el dedo se sale del botón (más de 24 px), se cancela.
  window.addEventListener('pointermove', (e) => {
    if (!h) return;
    const r = h.btn.getBoundingClientRect(), m = 24;
    if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) parar();
  });
}
