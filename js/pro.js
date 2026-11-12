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
