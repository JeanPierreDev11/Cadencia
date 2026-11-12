// Strava en la app: tarjeta «Integraciones» del Perfil, botón «Sincronizar Strava» de Entreno y la importación.
import { STRAVA_CLIENT_ID, urlAutorizar } from './strava.js';

export function crearStrava(ctx) {
  const { st, render, toast, esc, E, currentKg, todayISO, fmtDate, lsGet, lsSet, errorText } = ctx;
  const api = new Proxy({}, { get: (_, k) => ctx.api[k] });
  const uid = () => st.user.uid;
  const conectado = () => !!(st.profile && st.profile.strava && st.profile.strava.conectado);
  const ultimaKey = () => `cadencia-strava-ultima-${st.user ? st.user.uid : ''}`;

  // Los errores del servidor ya vienen escritos en español: se enseñan tal cual.
  function textoError(e) {
    const m = e && e.message;
    if (e && String(e.code || '').startsWith('functions/') && m && !/^(internal|unavailable|deadline-exceeded|unauthenticated)$/i.test(m)) return m;
    return errorText(e);
  }
  const revocado = (e) => !!(e && /dejado de dar acceso|no est[aá] conectado/i.test(e.message || ''));

  function integracionesHTML() {
    const s = st.profile && st.profile.strava;
    if (conectado()) {
      return `<section class="card" id="strava-card">
        <div class="card-head"><h2>Strava</h2><span class="tag ok">Conectado</span></div>
        <p>Strava${s.atleta ? ` · <b>${esc(s.atleta)}</b>` : ''}</p>
        <p class="small muted">Tus salidas de bici y tus carreras se importan al pulsar «Sincronizar Strava» en Entreno. Solo leemos tus actividades.</p>
        <button type="button" class="btn ghost block ${st.stravaDel ? 'danger' : ''}" data-act="strava-desconectar" ${st.stravaBusy ? 'disabled' : ''}>${st.stravaDel ? 'Confirmar: desconectar Strava' : 'Desconectar Strava'}</button>
        ${st.stravaDel ? '<p class="small muted">Se borra la conexión. Los entrenos que ya importaste se quedan.</p>' : ''}
      </section>`;
    }
    return `<section class="card" id="strava-card">
        <p>Trae tus salidas de bici y tus carreras desde Strava, sin teclear nada.</p>
        <button type="button" class="btn block strava" data-act="strava-conectar" ${st.stravaBusy ? 'disabled' : ''}>${st.stravaBusy ? '<span class="spinner"></span> Conectando…' : 'Conectar con Strava'}</button>
        <p class="small muted">Strava te pedirá permiso para ver tus actividades. Puedes desconectarlo cuando quieras. Compatible con Strava.</p>
      </section>`;
  }

  function syncBtnHTML() {
    if (!conectado()) return '';
    const ult = lsGet(ultimaKey());
    return `<div class="strava-row"><button type="button" class="btn block strava" data-act="strava-sync" ${st.stravaBusy ? 'disabled' : ''}>${st.stravaBusy ? '<span class="spinner"></span> Sincronizando…' : 'Sincronizar Strava'}</button>${ult ? `<p class="small muted">Última sincronización: ${esc(ult)}</p>` : ''}</div>`;
  }

  // ----- importación -----
  // Intensidad de 1 a 3 (como el selector manual): por pulso si hay pulso máximo, si no por potencia y FTP, si no «Medio».
  function esfuerzo(o) {
    const a = (st.profile && st.profile.atleta) || {};
    if (o.pulso && a.fcMax) { const r = o.pulso / a.fcMax; return r < 0.68 ? 1 : r < 0.82 ? 2 : 3; }
    if (o.np && a.ftp) { const r = o.np / a.ftp; return r < 0.75 ? 1 : r < 0.9 ? 2 : 3; }
    return 2;
  }
  // ¿Ya apuntaste esta salida a mano? Misma fecha y tipo, y duración o distancia casi iguales.
  const yaApuntada = (a) => st.workouts.some((w) => !String(w.id).startsWith('strava_') && w.fecha === a.fecha && w.tipo === a.tipo
    && ((w.km && a.km && Math.abs(w.km - a.km) <= Math.max(1, a.km * 0.1)) || (w.min && Math.abs(w.min - a.min) <= Math.max(5, a.min * 0.1))));
  function aEntreno(a) {
    const o = { id: 'strava_' + a.sid, fecha: a.fecha, tipo: a.tipo, min: a.min, esf: 2, fuente: 'strava' };
    if (a.nombre) o.nombre = a.nombre;
    if (a.km) o.km = a.km;
    if (a.tipo === 'bici') {
      if (a.elev) o.elev = a.elev;
      if (a.pulso) o.pulso = a.pulso;
      if (a.np) o.np = a.np;
      const bs = (st.profile.garaje && st.profile.garaje.bicis) || [];
      if (bs.length) o.bici = bs[0].id;
    }
    o.esf = esfuerzo(a);
    o.kcal = E.estimateKcal(o, currentKg());
    return o;
  }
  const epoch = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 1000);

  async function sincronizar() {
    if (st.stravaBusy || !conectado()) return;
    st.stravaBusy = true; render();
    try {
      const previos = st.workouts.filter((w) => String(w.id).startsWith('strava_')).map((w) => w.fecha).sort();
      const desde = epoch(E.addDays(previos.length ? previos[previos.length - 1] : todayISO(), previos.length ? -3 : -45));
      const r = await api.strava({ modo: 'actividades', desde });
      const tenidos = new Set(st.workouts.map((w) => w.id));
      let nuevas = 0, repetidas = 0;
      for (const a of r.items || []) {
        if (tenidos.has('strava_' + a.sid)) continue;
        if (yaApuntada(a)) { repetidas++; continue; }
        await api.saveWorkout(uid(), aEntreno(a)); nuevas++;
      }
      if (nuevas) st.workouts = await api.listWorkouts(uid());
      const d = new Date(); lsSet(ultimaKey(), `${fmtDate(todayISO(), { day: 'numeric', month: 'short' })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      toast(nuevas ? `Importadas ${nuevas} ${nuevas === 1 ? 'salida nueva' : 'salidas nuevas'} de Strava${repetidas ? ` (${repetidas === 1 ? '1 ya estaba apuntada' : repetidas + ' ya estaban apuntadas'})` : ''}` : repetidas ? `Sin novedades: ${repetidas === 1 ? '1 ya estaba apuntada' : repetidas + ' ya estaban apuntadas'} a mano` : 'Ya tienes todo al día: no hay salidas nuevas');
    } catch (e) {
      if (revocado(e)) { st.profile.strava = null; }
      toast(textoError(e));
    }
    st.stravaBusy = false; render();
  }

  // Al volver de Strava con el código temporal: lo mandamos al servidor, que lo cambia por los tokens con el Client Secret.
  async function vuelta(ret) {
    st.tab = 'perfil'; lsSet('cadencia-tab', 'perfil');
    if (ret.error) { toast('Has cancelado la conexión con Strava.'); render(); return; }
    if (!ret.ok) { toast('No hemos podido verificar la conexión con Strava. Vuelve a intentarlo.'); render(); return; }
    st.stravaBusy = true; render();
    try {
      const r = await api.strava({ modo: 'conectar', code: ret.code, scope: ret.scope });
      st.profile.strava = r.strava;
      st.tab = 'entreno'; lsSet('cadencia-tab', 'entreno');
      toast('¡Strava conectado! Pulsa «Sincronizar Strava» para traer tus salidas.');
    } catch (e) { toast(textoError(e)); }
    st.stravaBusy = false; render(); window.scrollTo(0, 0);
  }

  async function click(act) {
    if (act === 'strava-conectar') {
      if (!STRAVA_CLIENT_ID) { toast('Strava estará disponible muy pronto.'); return true; }
      location.href = urlAutorizar(); return true;
    }
    if (act === 'strava-sync') { sincronizar(); return true; }
    if (act === 'strava-desconectar') {
      if (!st.stravaDel) { st.stravaDel = true; render(); return true; }
      st.stravaBusy = true; render();
      try { await api.strava({ modo: 'desconectar' }); st.profile.strava = null; toast('Strava desconectado'); }
      catch (e) { toast(textoError(e)); }
      st.stravaBusy = false; st.stravaDel = false; render(); return true;
    }
    return false;
  }
  return { integracionesHTML, syncBtnHTML, click, vuelta, conectado };
}
