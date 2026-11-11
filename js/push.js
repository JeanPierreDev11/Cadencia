// Recordatorios con notificaciones push (Firebase Cloud Messaging).
// - Al abrir la app por primera vez se pregunta si quieres recibir avisos y de qué tipo (ventana «¿Quieres recordatorios?»).
// - Perfil → «Recordatorios»: tres interruptores (peso, comidas, entreno) con sus horas. Al activar el primero se pide el
//   permiso del navegador, se obtiene el token del dispositivo y se guarda en users/{uid} junto con las preferencias.
// - Una Cloud Function programada («recordatorios», cada 30 min) manda el aviso a la hora elegida.

// Clave VAPID PÚBLICA (Firebase → Configuración del proyecto → Cloud Messaging → Certificados push web).
// Es pública (no es un secreto).
export const VAPID_KEY = 'BIQbephDWyUnJqKUDZFo8tQaHFNgPZfs92o4vz1_SWJqYL1nakTqI6pMMDO-og0nb2pWgsHRyAHeTlfoZI3G_lA';

// Valores por defecto. Las horas son minutos desde las 00:00 y los avisos salen cada 30 min (08:00, 14:30…).
export const DEF = { peso: { t: 480, f: 'semana', d: 0 }, comidas: { ts: [600, 870, 1260] }, entreno: { t: 1080 } };
export const FRECS = [['dia', 'Cada día'], ['semana', 'Cada semana'], ['quincena', 'Cada 2 semanas'], ['mes', 'Cada mes (el día 1)']];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const HHMM = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${t % 60 ? '30' : '00'}`;
const SLOTS = Array.from({ length: 48 }, (_, i) => i * 30);
const okT = (t) => Number.isInteger(t) && t >= 0 && t < 1440 && t % 30 === 0;
const TIPOS = [
  { k: 'peso', t: 'Recordarme pesarme', corto: 'Pesarme' },
  { k: 'comidas', t: 'Recordarme registrar mis comidas', corto: 'Registrar mis comidas' },
  { k: 'entreno', t: 'Recordarme mi entreno', corto: 'Mi entreno' },
];

// Pantalla a la que lleva cada aviso al tocarlo (el service worker abre ./?ir=…).
const DESTINOS = { peso: { tab: 'inicio', hoja: 'peso' }, comidas: { tab: 'nutricion' }, entreno: { tab: 'entreno' } };
export function leerIr() {
  try {
    const u = new URL(location.href), ir = u.searchParams.get('ir');
    if (ir === null) return null;
    u.searchParams.delete('ir');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    return DESTINOS[ir] || null;
  } catch (e) { return null; }
}

export function soportado() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}
const zona = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch (e) { return 'Europe/Madrid'; } };

export function crearRecordatorios(ctx) {
  const { st, render, toast, esc, lsGet, lsSet, errorText, I } = ctx;
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] });
  const uid = () => st.user.uid;
  const tokenKey = () => `cadencia-push-token-${uid()}`;
  const rec = () => (st.profile && st.profile.recordatorios) || {};
  const activo = (k) => !!(rec()[k] && rec()[k].on);
  const permiso = () => (soportado() ? Notification.permission : 'unsupported');

  // Preferencias de cada tipo, con los valores por defecto donde falte algo.
  function prefs(k) {
    const r = rec()[k] || {}, d = DEF[k];
    if (k === 'comidas') {
      const ts = Array.isArray(r.ts) ? r.ts.filter(okT).slice(0, 3) : null;
      return { on: !!r.on, ts: ts && ts.length ? ts : [...d.ts] };
    }
    const o = { on: !!r.on, t: okT(r.t) ? r.t : d.t };
    if (k === 'peso') { o.f = FRECS.some(([f]) => f === r.f) ? r.f : d.f; o.d = Number.isInteger(r.d) && r.d >= 0 && r.d <= 6 ? r.d : d.d; }
    return o;
  }
  const limpio = (k, o) => { const { on, ...resto } = o; return { on, ...resto }; };

  function resumen(k) {
    const p = prefs(k);
    if (k === 'peso') {
      const cuando = p.f === 'dia' ? 'Cada día' : p.f === 'mes' ? 'El día 1 de cada mes' : `${p.f === 'quincena' ? 'Cada 2 semanas' : 'Cada semana'}, el ${DIAS[p.d]}`;
      return `${cuando} a las ${HHMM(p.t)}.`;
    }
    if (k === 'comidas') return `A las ${p.ts.map(HHMM).join(', ').replace(/, ([^,]*)$/, ' y $1')}.`;
    return `Los días que te toca entrenar, a las ${HHMM(p.t)}.`;
  }
  const horaSel = (attr, t, extra = '') => `<select class="input" data-rec="${attr}" aria-label="Hora">${extra}${SLOTS.map((m) => `<option value="${m}" ${m === t ? 'selected' : ''}>${HHMM(m)}</option>`).join('')}</select>`;
  function ajustesHTML(k) {
    const p = prefs(k);
    if (k === 'peso') {
      return `<div class="small muted rec-h">
        <select class="input" data-rec="peso:f" aria-label="Frecuencia">${FRECS.map(([f, n]) => `<option value="${f}" ${p.f === f ? 'selected' : ''}>${n}</option>`).join('')}</select>
        ${p.f === 'semana' || p.f === 'quincena' ? `<select class="input" data-rec="peso:d" aria-label="Día de la semana">${DIAS.map((n, i) => `<option value="${i}" ${p.d === i ? 'selected' : ''}>el ${n}</option>`).join('')}</select>` : ''}
        a las ${horaSel('peso:t', p.t)}</div>`;
    }
    if (k === 'comidas') {
      return `<div class="small muted rec-h">Avisos a las ${[0, 1, 2].map((i) => horaSel(`comidas:ts:${i}`, p.ts[i] === undefined ? -1 : p.ts[i], '<option value="-1" ' + (p.ts[i] === undefined ? 'selected' : '') + '>No avisar</option>')).join('')}</div>`;
    }
    return `<div class="small muted rec-h">Los días que te toca entrenar, a las ${horaSel('entreno:t', p.t)}</div>`;
  }

  function nota() {
    if (!soportado()) return 'Tu navegador no permite notificaciones aquí. En iPhone, añade Cadencia a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.';
    if (permiso() === 'denied') return 'Las notificaciones están bloqueadas para Cadencia. Actívalas en los ajustes del navegador o del móvil y vuelve aquí.';
    return '';
  }

  function cardHTML() {
    const bloq = !soportado() || permiso() === 'denied';
    const n = nota();
    const filas = TIPOS.map(({ k, t }) => {
      const on = activo(k);
      return `<div class="rec-row">
        <div class="rec-t"><b id="rec-${k}">${esc(t)}</b>
          ${on ? ajustesHTML(k) : `<span class="small muted">${esc(resumen(k))}</span>`}
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-labelledby="rec-${k}" data-act="rec-toggle" data-v="${k}" ${st.recBusy ? 'disabled' : ''}${bloq && !on ? ' aria-disabled="true"' : ''}><i></i></button>
      </div>`;
    }).join('');
    return `<section class="card" id="rec-card">
      <div class="card-head"><h2>Recordatorios</h2>${st.recBusy ? '<span class="spinner"></span>' : ''}</div>
      ${filas}
      ${n ? `<p class="small muted rec-nota">${esc(n)}</p>` : '<p class="small muted rec-nota">Te avisamos solo si aún no lo has hecho. Puedes quitarlos cuando quieras.</p>'}
    </section>`;
  }

  // ----- guardar -----
  async function guardar(nuevo, extra = {}) {
    const hay = Object.values(nuevo).some((x) => x && x.on);
    const data = { recordatorios: nuevo, recActivo: hay, recTz: zona(), ...extra };
    Object.assign(st.profile, data);
    await api.saveProfile(uid(), data);
  }
  // Todas las preferencias (con defaults), para guardar un tipo concreto sin perder el resto.
  const todas = () => { const o = {}; for (const { k } of TIPOS) { if (rec()[k]) o[k] = limpio(k, prefs(k)); } return o; };

  // Pide permiso (si hace falta) y devuelve el token de este dispositivo. Devuelve null si no se puede.
  async function conseguirToken() {
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission(); // tiene que llamarse justo al tocar el botón
    if (p !== 'granted') {
      toast(p === 'denied' ? 'Has bloqueado las notificaciones. Actívalas en los ajustes del navegador o del móvil.' : 'Sin permiso no podemos avisarte. Prueba otra vez cuando quieras.');
      return null;
    }
    const token = await api.pushToken(VAPID_KEY);
    if (!token) throw new Error('Sin token');
    return token;
  }
  function errorActivar(e) {
    return /^(functions|messaging|push)\/|^local\//.test((e && e.code) || '') || (e && e.message === 'Sin token') ? 'No se han podido activar las notificaciones en este dispositivo. Prueba más tarde.' : errorText(e);
  }
  // Comprueba lo que hace falta antes de pedir permiso. Devuelve un texto de error o ''.
  function noSePuede() {
    if (!soportado()) return 'Este navegador no permite notificaciones. En iPhone, instala Cadencia en la pantalla de inicio.';
    if (!VAPID_KEY && api.mode !== 'local') return 'Los recordatorios aún no están configurados en el servidor.';
    if (permiso() === 'denied') return 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o del móvil.';
    return '';
  }
  const texto = (k, p) => (k === 'peso' ? `pesarte (${resumen('peso').replace(/\.$/, '').toLowerCase()})` : k === 'comidas' ? `apuntar tus comidas (${resumen('comidas').replace(/\.$/, '').toLowerCase()})` : `tu entreno, a las ${HHMM(p.t)}`);

  async function alternar(k) {
    if (st.recBusy) return;
    const ahora = !activo(k);
    if (ahora) { const m = noSePuede(); if (m) { toast(m); return; } }
    st.recBusy = true; render();
    try {
      if (ahora) {
        const token = await conseguirToken();
        if (!token) return;
        await api.saveToken(uid(), token);
        lsSet(tokenKey(), token);
        await guardar({ ...todas(), [k]: limpio(k, { ...prefs(k), on: true }) }, { recPreguntado: true });
        toast(`Te avisaremos para ${texto(k, prefs(k))}`);
      } else {
        const nuevo = { ...todas(), [k]: limpio(k, { ...prefs(k), on: false }) };
        await guardar(nuevo);
        if (!Object.values(nuevo).some((x) => x && x.on)) { // sin recordatorios, este dispositivo deja de recibir avisos
          const t = lsGet(tokenKey());
          try { if (t) await api.removeToken(uid(), t); await api.pushBorrarToken(); } catch (e) { /* no pasa nada */ }
          lsSet(tokenKey(), '');
        }
        toast('Recordatorio desactivado');
      }
    } catch (e) { toast(errorActivar(e)); } finally { st.recBusy = false; render(); }
  }

  // Cambios en los desplegables: «peso:f», «peso:d», «peso:t», «comidas:ts:0», «entreno:t».
  async function cambiar(el) {
    const [k, campo, i] = String(el.dataset.rec).split(':');
    const v = Number(el.value);
    if (!activo(k)) return;
    const p = prefs(k);
    if (k === 'peso' && campo === 'f') { if (!FRECS.some(([f]) => f === el.value)) return; p.f = el.value; }
    else if (k === 'peso' && campo === 'd') { if (!(v >= 0 && v <= 6)) return; p.d = v; }
    else if ((k === 'peso' || k === 'entreno') && campo === 't') { if (!okT(v)) return; p.t = v; }
    else if (k === 'comidas' && campo === 'ts') {
      const ts = [...p.ts]; ts[Number(i)] = v;
      const lista = [...new Set(ts.filter(okT))].sort((a, b) => a - b);
      if (!lista.length) { toast('Deja al menos una hora para las comidas, o desactiva el recordatorio.'); render(); return; }
      p.ts = lista;
    } else return;
    try { await guardar({ ...todas(), [k]: limpio(k, { ...p, on: true }) }); render(); } catch (e) { toast(errorText(e)); }
  }

  // ----- ventana de bienvenida: ¿quieres recordatorios? -----
  function preguntar() {
    if (!st.profile || st.profile.recPreguntado === true || st.profile.recActivo || !soportado() || permiso() === 'denied') return;
    if (!VAPID_KEY && api.mode !== 'local') return;
    setTimeout(() => {
      if (st.view !== 'main' || st.recAsk || st.pro || st.proWelcome || st.live || st.wk || st.rw || st.legal || st.del || st.pesoSheet) return;
      st.recAsk = { sel: { peso: true, comidas: true, entreno: true } }; render();
    }, 1200);
  }
  function askHTML() {
    const a = st.recAsk, desc = {
      peso: `Una vez a la semana (el lunes, a las ${HHMM(DEF.peso.t)}). Después eliges cada cuánto.`,
      comidas: `Te avisamos a las ${DEF.comidas.ts.map(HHMM).join(', ').replace(/, ([^,]*)$/, ' y $1')} si aún no las has apuntado.`,
      entreno: `Los días que te toca entrenar, a las ${HHMM(DEF.entreno.t)}.`,
    };
    const hay = Object.values(a.sel).some(Boolean);
    return `<div class="sheet-back" data-act="rec-ask-no"></div>
      <div class="sheet short paywall" role="dialog" aria-modal="true" aria-label="Recordatorios">
        <div class="sheet-grab"></div>
        <div class="sheet-list pw">
          <h3>¿Quieres recibir recordatorios?</h3>
          <p>Te avisamos en el móvil para que no se te pase nada. Elige cuáles quieres; después podrás cambiar las horas en Perfil.</p>
          <div class="choices">${TIPOS.map(({ k, corto }) => `<button type="button" class="choice" data-act="rec-ask-toggle" data-v="${k}" aria-pressed="${!!a.sel[k]}">
            <span class="t">${esc(corto)}<small>${esc(desc[k])}</small></span><span class="tick">${a.sel[k] ? I.check : ''}</span></button>`).join('')}</div>
          <button type="button" class="btn block" data-act="rec-ask-go" ${hay && !st.recBusy ? '' : 'disabled'}>${st.recBusy ? '<span class="spinner"></span> Activando…' : 'Activar avisos'}</button>
          <button type="button" class="btn ghost block" data-act="rec-ask-no" ${st.recBusy ? 'disabled' : ''}>Ahora no</button>
          <p class="small muted">Sin permiso del móvil no podemos avisarte. Puedes quitarlos cuando quieras desde Perfil.</p>
        </div>
      </div>`;
  }
  async function preguntaNo() {
    if (st.recBusy) return;
    st.recAsk = null; render();
    try { Object.assign(st.profile, { recPreguntado: true }); await api.saveProfile(uid(), { recPreguntado: true }); } catch (e) { /* se volverá a preguntar */ }
  }
  async function preguntaSi() {
    const a = st.recAsk; if (!a || st.recBusy) return;
    const elegidos = TIPOS.map((t) => t.k).filter((k) => a.sel[k]);
    if (!elegidos.length) return;
    const m = noSePuede(); if (m) { toast(m); st.recAsk = null; render(); return; }
    st.recBusy = true; render();
    try {
      const token = await conseguirToken();
      if (!token) { st.recAsk = null; await api.saveProfile(uid(), { recPreguntado: true }); st.profile.recPreguntado = true; return; }
      await api.saveToken(uid(), token); lsSet(tokenKey(), token);
      const nuevo = { ...todas() };
      for (const k of elegidos) nuevo[k] = limpio(k, { ...prefs(k), on: true });
      await guardar(nuevo, { recPreguntado: true });
      st.recAsk = null;
      toast(elegidos.length === 3 ? 'Recordatorios activados' : 'Recordatorio activado');
    } catch (e) { toast(errorActivar(e)); } finally { st.recBusy = false; render(); }
  }

  // Al abrir la app con recordatorios activos: renueva el token si cambió y actualiza la zona horaria.
  async function mantener() {
    if (!st.profile || !st.profile.recActivo || !soportado() || Notification.permission !== 'granted' || (!VAPID_KEY && api.mode !== 'local')) return;
    try {
      const token = await api.pushToken(VAPID_KEY);
      if (token && token !== lsGet(tokenKey())) { await api.saveToken(uid(), token); lsSet(tokenKey(), token); }
      if (st.profile.recTz !== zona()) { st.profile.recTz = zona(); await api.saveProfile(uid(), { recTz: zona() }); }
    } catch (e) { /* sin conexión o sin permiso: se reintenta en la próxima apertura */ }
  }

  // El permiso hay que pedirlo directamente desde el toque, así que esto no espera a nada antes.
  function click(act, v) {
    if (act === 'rec-toggle') { alternar(v); return true; }
    if (act === 'rec-ask-toggle') { if (st.recAsk && !st.recBusy) { st.recAsk.sel[v] = !st.recAsk.sel[v]; render(); } return true; }
    if (act === 'rec-ask-go') { preguntaSi(); return true; }
    if (act === 'rec-ask-no') { preguntaNo(); return true; }
    return false;
  }
  function change(el) {
    if (el && el.dataset && el.dataset.rec) { cambiar(el); return true; }
    return false;
  }
  return { cardHTML, askHTML, preguntar, click, change, mantener };
}
