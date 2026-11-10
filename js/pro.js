// Cadencia Pro: suscripción de 4,99 €/mes con Stripe. La IA (Foto con IA y Recomendación del Taller) es solo para Pro.
// Cuando crees el Payment Link en Stripe, pégalo entre las comillas de PRO_LINK (empieza por https://buy.stripe.com/).
export const PRO_LINK = '';
// Opcional: enlace del portal de clientes de Stripe, para que las personas Pro puedan cancelar o cambiar de tarjeta.
export const PORTAL_LINK = '';
export const PRO_PRECIO = '4,99 €/mes';

// Enlace de pago con el id y el email de la cuenta, para que el servidor sepa a quién activar Pro.
export function proUrl(user) {
  if (!PRO_LINK) return '#';
  const u = new URL(PRO_LINK);
  if (user && user.uid) u.searchParams.set('client_reference_id', user.uid);
  if (user && user.email) u.searchParams.set('prefilled_email', user.email);
  return u.toString();
}
