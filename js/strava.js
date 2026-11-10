// Conexión con Strava (OAuth 2.0). La app solo guarda el «Client ID», que es público.
// El «Client Secret» y los tokens viven en el servidor (Cloud Function «strava»), nunca aquí.
// Pega aquí tu Client ID (un número) cuando crees la aplicación en developers.strava.com.
export const STRAVA_CLIENT_ID = '';
export const STRAVA_SCOPE = 'activity:read_all'; // leer tus actividades (incluidas las privadas)

const KEY = 'cadencia-strava-state';
// Strava te devuelve a esta dirección; su dominio es el «Authorization Callback Domain» de la aplicación de Strava.
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

// Dirección de la pantalla de permisos de Strava. «state» es un código al azar que comprobamos al volver (protege de enlaces falsos).
export function urlAutorizar() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  const state = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(KEY, JSON.stringify({ s: state, t: Date.now() })); } catch (e) { /* sin almacenamiento */ }
  const q = new URLSearchParams({ client_id: STRAVA_CLIENT_ID, redirect_uri: redirectUri(), response_type: 'code', approval_prompt: 'auto', scope: STRAVA_SCOPE, state });
  return 'https://www.strava.com/oauth/authorize?' + q.toString();
}

// Al volver de Strava la dirección trae ?code=…&state=…. Se lee una vez y se limpia la barra de direcciones.
export function leerRetorno() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return null;
  const ret = { code: p.get('code') || '', error: p.get('error') || '', scope: p.get('scope') || '', ok: false };
  let guardado = null; try { guardado = JSON.parse(localStorage.getItem(KEY) || 'null'); localStorage.removeItem(KEY); } catch (e) { /* nada */ }
  ret.ok = !!(guardado && guardado.s && guardado.s === p.get('state') && Date.now() - guardado.t < 30 * 60e3);
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* nada */ }
  return ret;
}
