// Términos de uso, política de privacidad y aviso de salud de Cadencia.
// Si cambias el texto de forma importante, sube LEGAL_V: queda guardada la versión que aceptó cada persona.
export const LEGAL_V = '2026-11-10';
// Correo de contacto para consultas de privacidad (obligatorio por el RGPD antes de abrir la app al público).
export const CONTACTO = 'jeanpierreramirezcova@gmail.com';

export function legalHTML() {
  const contacto = CONTACTO
    ? `escribe a <a href="mailto:${CONTACTO}">${CONTACTO}</a>`
    : 'escríbenos al correo de contacto de Cadencia';
  return `
    <p class="small muted">Versión del ${LEGAL_V.split('-').reverse().join('/')}. Lo esencial, en corto: tus datos son tuyos, solo los usamos para que la app te funcione, y puedes borrarlos cuando quieras.</p>

    <h3>Aviso de salud</h3>
    <ul class="bul">
      <li>Las calorías, macros, planes de entreno, pesos objetivo, % de grasa y demás cifras de Cadencia son <b>estimaciones orientativas</b> calculadas con fórmulas generales.</li>
      <li><b>No son consejo médico ni sustituyen a un médico, nutricionista o entrenador.</b> Consulta a un profesional antes de empezar una dieta o un plan de entreno, sobre todo si tienes una enfermedad, una lesión, tomas medicación, estás embarazada o has tenido problemas con la comida.</li>
      <li>Si notas dolor, mareo o cualquier síntoma raro al entrenar, para y pide ayuda.</li>
    </ul>

    <h3>Privacidad</h3>
    <ul class="bul">
      <li><b>Qué guardamos:</b> tu nombre y email; tu sexo, edad, estatura, peso y composición corporal; tus objetivos, rutinas y entrenos (incluidos pulso y potencia si los apuntas); lo que comes; los datos de tus bicis, las rutas GPX que guardes y, si lo conectas, el aviso de que tienes Strava conectado. Algunos son <b>datos de salud</b>, y solo los tratamos porque das tu consentimiento expreso al crear la cuenta.</li>
      <li><b>Para qué:</b> únicamente para calcular y mostrarte tus métricas dentro de Cadencia. No los vendemos, no los compartimos con anunciantes y no los usamos para publicidad.</li>
      <li><b>Quién los ve:</b> solo tú. Se guardan en Firebase (Google Cloud), en servidores de la Unión Europea, con conexión cifrada y reglas que impiden que otra persona lea tus datos.</li>
      <li><b>Funciones con IA:</b> si usas «Foto con IA» o «Recomendación con IA», la foto del plato, o los datos de tu bici, tu presupuesto y tu objetivo, se envían a través de nuestro servidor a Anthropic (el proveedor de Claude) para generar la respuesta. Las fotos no se guardan en Cadencia. Son opcionales: si no las usas, no se envía nada. Cada persona tiene un límite diario de consultas.</li>
      <li><b>Pagos (Cadencia Pro):</b> la suscripción la gestiona Stripe. Stripe recibe tu email y los datos de pago; Cadencia nunca ve ni guarda tu tarjeta. En tu perfil solo guardamos si eres Pro y los identificadores de cliente y suscripción de Stripe.</li>
      <li><b>Strava (opcional):</b> si conectas tu cuenta, Strava nos da permiso para leer tus actividades. Guardamos, solo en el servidor, las claves de acceso que Strava nos entrega, y al sincronizar copiamos a tu cuenta las salidas de bici y de carrera (fecha, duración, distancia, desnivel y pulso). Puedes desconectarlo en <b>Perfil → Integraciones</b>: se borra la conexión y se le dice a Strava que deje de dar acceso. Los entrenos ya importados se quedan hasta que los borres. Cadencia no está afiliada a Strava ni la respalda.</li>
      <li><b>Recordatorios (opcional):</b> si activas los avisos, tu navegador nos da un identificador de tu dispositivo (token de notificaciones) que guardamos en tu cuenta junto con las horas elegidas y tu zona horaria. Se envían a través de Firebase Cloud Messaging (Google) solo para mandarte esos avisos. Para no avisarte de lo que ya has hecho, el servidor comprueba si hoy tienes peso, comidas o entreno apuntados. Puedes desactivarlos en Perfil → Recordatorios, o en los ajustes del navegador o del móvil.</li>
      <li><b>Servicios externos:</b> si usas tu ubicación en Rutas, se envían tus coordenadas a Open-Meteo para consultar el tiempo; si buscas o escaneas productos de marca, se envía el texto o el código de barras a Open Food Facts. El mapa de Rutas descarga la librería Leaflet (unpkg.com) y los trozos de mapa de OpenStreetMap, que ven tu dirección IP y la zona que miras, pero no tu nombre ni tu email. Los archivos GPX que subes se leen en tu móvil y no se envían a ningún servidor; solo guardamos en tu cuenta el recorrido simplificado, el nombre, los km y el desnivel de las rutas que decidas guardar. Ninguno recibe tu nombre ni tu email. La app se descarga desde GitHub Pages.</li>
      <li><b>En tu móvil</b> se guardan algunas preferencias (tema, pestaña abierta, entreno en curso, tiempo de descanso, última ubicación) para que la app funcione mejor. No usamos cookies de publicidad ni analítica.</li>
      <li><b>Cuánto tiempo:</b> mientras tengas la cuenta. Desde <b>Perfil → Privacidad y cuenta</b> puedes borrar tu cuenta y todos tus datos al momento y para siempre.</li>
      <li><b>Tus derechos:</b> puedes acceder a tus datos, corregirlos, llevártelos, retirar tu consentimiento o pedir que se borren; para lo que no puedas hacer desde la app, ${contacto}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</li>
      <li>Para usar Cadencia tienes que tener al menos 14 años.</li>
    </ul>

    <h3>Términos de uso</h3>
    <ul class="bul">
      <li>Cadencia se ofrece tal cual, para ayudarte a organizar tu entreno y tu alimentación. Intentamos que funcione bien, pero no garantizamos que esté siempre disponible ni libre de errores.</li>
      <li>Tú eres responsable de tu cuenta y de las decisiones que tomes sobre tu salud y tu entreno. Cadencia no responde de lesiones o daños derivados de seguir sus estimaciones.</li>
      <li>Los datos de productos de marca vienen de Open Food Facts (licencia ODbL) y los rellena una comunidad: pueden tener errores, compáralos con la etiqueta. Las fotos de ejercicios vienen de Free Exercise DB (dominio público).</li>
      <li><b>Cadencia Pro:</b> las funciones de IA (Foto con IA y Recomendación del Taller) son de pago, 4,99 €/mes, con renovación mensual. Puedes cancelar cuando quieras y seguirás con Pro hasta el final del periodo ya pagado. Borrar tu cuenta no cancela la suscripción: cancélala antes en Stripe. Todo lo demás de Cadencia es gratis.</li>
      <li>Podemos cambiar estos términos; si el cambio es importante, te lo avisaremos en la app.</li>
    </ul>`;
}
