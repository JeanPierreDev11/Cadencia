// Cadencia Pro: suscripción de 4,99 €/mes con Stripe. La IA (Escanear alimento y Recomendación del Taller) es solo para Pro.
// Cuando crees el Payment Link en Stripe, pégalo entre las comillas de PRO_LINK (empieza por https://buy.stripe.com/).
export const PRO_LINK = 'https://buy.stripe.com/test_bJecN58thc0s1Vx1U74sE00'; // MODO PRUEBA: cambiar por el enlace real (https://buy.stripe.com/...) al pasar a cobrar de verdad
// Opcional: enlace del portal de clientes de Stripe, para que las personas Pro puedan cancelar o cambiar de tarjeta.
export const PORTAL_LINK = 'https://billing.stripe.com/p/login/test_bJecN58thc0s1Vx1U74sE00'; // MODO PRUEBA: cambiar por el del modo real
// Un Payment Link de Stripe por plan (MODO PRUEBA: cambiar por los enlaces reales al pasar a cobrar de verdad).
export const PLAN_LINKS = {
  mensual: 'https://buy.stripe.com/test_bJecN58thc0s1Vx1U74sE00',
  anual: 'https://buy.stripe.com/test_aFa3cv6l99Sk9nZ0Q34sE01',
  siempre: 'https://buy.stripe.com/test_9B600jfVJ2pS43F6an4sE02',
};
export const PRO_PRECIO = '4,99 €/mes';
// Beta abierta / Acceso Fundador: mientras PAGOS_ACTIVOS sea false NO se ofrece ninguna pasarela de Stripe y Cadencia PRO se
// presenta como «lista prioritaria» (campo interesPro del perfil). Al activar los cobros reales: poner true y cambiar los enlaces de arriba.
export const PAGOS_ACTIVOS = false;
export const BETA_TXT = 'BETA ABIERTA · ACCESO ANTICIPADO';
export const betaTagHTML = (cls = '') => `<span class="beta-tag${cls ? ` ${cls}` : ''}">${BETA_TXT}</span>`;
export const BETA_AVISO_REGISTRO = 'Acceso gratuito para los primeros usuarios durante la beta.';
export const LISTA_PRO_OK = 'Te hemos apuntado. Te avisaremos antes que a nadie cuando activemos Cadencia PRO.';
export const VENTAJAS_BETA = [
  ['Más ajustes de rutina con IA', 'Hasta 10 al día en lugar de 3.'],
  ['Análisis ampliado del Coach AI', 'Valoración de cada entreno con puntos concretos para mejorar.'],
  ['Funciones avanzadas', 'Mapa de fatiga, Modo Bestia, calentamiento inteligente, rutinas y ejercicios propios sin límite y más análisis de platos al día.'],
];
export const ventajasBetaHTML = (ico) => `<ul class="pw-list">${VENTAJAS_BETA.map(([t, d]) => `<li><span class="pw-li-i">${ico}</span><span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ul>`;
// Botón de la lista prioritaria o, una vez apuntado, la confirmación. `busy` = guardando.
export const listaProHTML = (p, busy) => (p && p.interesPro === true)
  ? `<div class="lista-ok" role="status"><b>En la lista prioritaria PRO</b><span>${LISTA_PRO_OK}</span></div>`
  : `<button type="button" class="btn block" data-act="pro-lista"${busy ? ' disabled' : ''}>${busy ? '<span class="spinner"></span>' : 'Unirme a la lista prioritaria PRO'}</button>`;

// Enlace de pago con el id y el email de la cuenta, para que el servidor sepa a quién activar Pro.
export function proUrl(user) {
  if (!PRO_LINK) return '#';
  const u = new URL(PRO_LINK);
  if (user && user.uid) u.searchParams.set('client_reference_id', user.uid);
  if (user && user.email) u.searchParams.set('prefilled_email', user.email);
  return u.toString();
}

// Enlace de pago del plan elegido, con el uid y el email para que el servidor sepa a quién activar Pro.
export function planUrl(plan, user) {
  const l = PLAN_LINKS[plan]; if (!l) return '';
  const u = new URL(l);
  if (user && user.uid) u.searchParams.set('client_reference_id', user.uid);
  if (user && user.email) u.searchParams.set('prefilled_email', user.email);
  return u.toString();
}
