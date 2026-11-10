// Recordatorios con notificaciones push (Firebase Cloud Messaging).
// Perfil → «Recordatorios»: tres interruptores (peso, comidas, entreno). Al activar el primero se pide el permiso
// del navegador, se obtiene el token del dispositivo y se guarda en users/{uid} junto con las preferencias.
// Una Cloud Function programada («recordatorios», cada hora) manda el aviso a la hora elegida.

// Clave VAPID PÚBLICA (Firebase → Configuración del proyecto → Cloud Messaging → Certificados push web).
// Es pública (no es un secreto): se pega aquí tal cual, empieza por «B».
export const VAPID_KEY = '';

export const RECS = [
  { k: 'peso', t: 'Recordarme pesarme por la mañana', h: 8, plazo: 'cada día' },
  { k: 'comidas', t: 'Recordarme registrar mis comidas', h: 21, plazo: 'cada día' },
  { k: 'entreno', t: 'Recordarme mi entreno', h: 18, plazo: 'los días que te toca entrenar' },
];
const HH = (h) => String(h).padStart(2, '0') + ':00';

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
  const { st, render, toast, esc, lsGet, lsSet, errorText } = ctx;
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] });
  const uid = () => st.user.uid;
  const tokenKey = () => `cadencia-push-token-${uid()}`;
  const rec = () => (st.profile && st.profile.recordatorios) || {};
  const activo = (k) => !!(rec()[k] && rec()[k].on);
  const hora = (k) => { const h = rec()[k] && rec()[k].h; return Number.isInteger(h) && h >= 0 && h <= 23 ? h : RECS.find((r) => r.k === k).h; };
  const permiso = () => (soportado() ? Notification.permission : 'unsupported');

  function nota() {
    if (!soportado()) return 'Tu navegador no permite notificaciones aquí. En iPhone, añade Cadencia a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.';
    if (permiso() === 'denied') return 'Las notificaciones están bloqueadas para Cadencia. Actívalas en los ajustes del navegador o del móvil y vuelve aquí.';
    return '';
  }

  function cardHTML() {
    const bloq = !soportado() || permiso() === 'denied';
    const n = nota();
    const filas = RECS.map((r) => {
      const on = activo(r.k);
      return `<div class="rec-row">
        <div class="rec-t"><b id="rec-${r.k}">${esc(r.t)}</b>
          <span class="small muted">${on ? '' : `Se pone en marcha a las ${HH(hora(r.k))}, ${esc(r.plazo)}.`}</span>
          ${on ? `<label class="small muted rec-h">Aviso ${esc(r.plazo)} a las <select class="input" data-rec-hora="${r.k}" aria-label="Hora del recordatorio">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === hora(r.k) ? 'selected' : ''}>${HH(h)}</option>`).join('')}</select></label>` : ''}
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-labelledby="rec-${r.k}" data-act="rec-toggle" data-v="${r.k}" ${st.recBusy ? 'disabled' : ''}${bloq && !on ? ' aria-disabled="true"' : ''}><i></i></button>
      </div>`;
    }).join('');
    return `<section class="card" id="rec-card">
      <div class="card-head"><h2>Recordatorios</h2>${st.recBusy ? '<span class="spinner"></span>' : ''}</div>
      ${filas}
      ${n ? `<p class="small muted rec-nota">${esc(n)}</p>` : '<p class="small muted rec-nota">Te avisamos solo si aún no lo has hecho ese día. Puedes quitarlos cuando quieras.</p>'}
    </section>`;
  }

  async function guardar(nuevo, extra = {}) {
    const hay = Object.values(nuevo).some((x) => x && x.on);
    const data = { recordatorios: nuevo, recActivo: hay, recTz: zona(), ...extra };
    Object.assign(st.profile, data);
    await api.saveProfile(uid(), data);
  }

  // Pide permiso (si hace falta) y devuelve el token de este dispositivo. Devuelve null si no se puede.
  async function conseguirToken() {
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission(); // tiene que llamarse justo al tocar el interruptor
    if (p !== 'granted') {
      toast(p === 'denied' ? 'Has bloqueado las notificaciones. Actívalas en los ajustes del navegador o del móvil.' : 'Sin permiso no podemos avisarte. Prueba otra vez cuando quieras.');
      return null;
    }
    const token = await api.pushToken(VAPID_KEY);
    if (!token) throw new Error('Sin token');
    return token;
  }

  async function alternar(k) {
    if (st.recBusy) return;
    const ahora = !activo(k);
    if (ahora) {
      if (!soportado()) { toast('Este navegador no permite notificaciones. En iPhone, instala Cadencia en la pantalla de inicio.'); return; }
      if (!VAPID_KEY && api.mode !== 'local') { toast('Los recordatorios aún no están configurados en el servidor.'); return; }
      if (permiso() === 'denied') { toast('Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o del móvil.'); return; }
    }
    st.recBusy = true; render();
    try {
      const nuevo = { ...rec(), [k]: { on: ahora, h: hora(k) } };
      if (ahora) {
        const token = await conseguirToken();
        if (!token) return;
        await api.saveToken(uid(), token);
        lsSet(tokenKey(), token);
        await guardar(nuevo);
        toast(k === 'entreno' ? `Recordatorio activado · tus días de entreno a las ${HH(hora(k))}` : `Recordatorio activado · cada día a las ${HH(hora(k))}`);
      } else {
        const queda = Object.values(nuevo).some((x) => x && x.on);
        await guardar(nuevo);
        if (!queda) { // sin recordatorios, este dispositivo deja de recibir avisos
          const t = lsGet(tokenKey());
          try { if (t) await api.removeToken(uid(), t); await api.pushBorrarToken(); } catch (e) { /* no pasa nada */ }
          lsSet(tokenKey(), '');
        }
        toast('Recordatorio desactivado');
      }
    } catch (e) {
      toast(/^(functions|messaging|push)\/|^local\//.test(e && e.code || '') || (e && e.message === 'Sin token') ? 'No se han podido activar las notificaciones en este dispositivo. Prueba más tarde.' : errorText(e));
    } finally { st.recBusy = false; render(); }
  }

  async function cambiarHora(k, h) {
    h = Number(h);
    if (!activo(k) || !Number.isInteger(h) || h < 0 || h > 23) return;
    try { await guardar({ ...rec(), [k]: { on: true, h } }); toast(`Aviso a las ${HH(h)}`); render(); } catch (e) { toast(errorText(e)); }
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
    return false;
  }
  function change(el) {
    if (el && el.dataset && el.dataset.recHora) { cambiarHora(el.dataset.recHora, el.value); return true; }
    return false;
  }
  return { cardHTML, click, change, mantener };
}
