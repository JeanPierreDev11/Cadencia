// Textos legales de Cadencia: Términos y Condiciones de Uso, Política de Privacidad y Aviso de Salud y Uso de IA.
// Adaptados a la normativa de la UE/España (RGPD, LOPDGDD, LSSI-CE). Se muestran en un único modal con tres pestañas (legalSheetHTML en app.js).
// Si cambias el texto de forma importante, sube LEGAL_V: queda guardada la versión que aceptó cada persona.
import { CICLISMO } from './config.js';
export const LEGAL_V = '2026-11-23';
// Correo de contacto, soporte y ejercicio de derechos (RGPD). Es el mismo que usa «Correo de soporte» en Perfil.
export const CONTACTO = 'soporte@cadenciafit.app';
// Identificación del titular del servicio (obligatoria por el art. 10 de la LSSI-CE). RELLENAR antes del lanzamiento: se ve tal cual en «Términos» y «Privacidad».
export const TITULAR = { nombre: '[PON_AQUI_TU_NOMBRE_O_RAZON_SOCIAL]', nif: '[PON_AQUI_TU_NIF]', domicilio: '[PON_AQUI_TU_DOMICILIO]' };

export const LEGAL_TABS = [
  { id: 'terminos', t: 'Términos' },
  { id: 'privacidad', t: 'Privacidad' },
  { id: 'salud', t: 'Salud e IA' },
];
export const LEGAL_TITULOS = { terminos: 'Términos y Condiciones de Uso', privacidad: 'Política de Privacidad', salud: 'Aviso de Salud y Uso de IA' };
export const legalTab = (id) => (LEGAL_TITULOS[id] ? id : 'terminos');

const fecha = () => LEGAL_V.split('-').reverse().join('/');
const mail = `<a href="mailto:${CONTACTO}">${CONTACTO}</a>`;
const tab = (id, txt) => `<button type="button" class="link" data-act="legal-tab" data-v="${id}">${txt}</button>`;
const titular = () => `<b>${TITULAR.nombre}</b> (NIF ${TITULAR.nif}), con domicilio en ${TITULAR.domicilio}. Correo de contacto: ${mail}.`;

function terminos() {
  return `
    <p class="small muted">Versión del ${fecha()}. Al crear tu cuenta o usar Cadencia aceptas estas condiciones. Si no estás de acuerdo con ellas, no uses la app.</p>

    <h3>1. Quiénes somos</h3>
    <p>Cadencia es una aplicación web (PWA) para organizar tus entrenos, tu nutrición y tu progreso físico. Titular del servicio: ${titular()}</p>

    <h3>2. Tu cuenta</h3>
    <ul class="bul">
      <li>Necesitas tener al menos <b>14 años</b>. Si eres menor de 18, no puedes contratar Cadencia Pro sin el permiso de tus padres o tutores.</li>
      <li>Los datos que nos des deben ser ciertos. La cuenta es personal: no la compartas y protege tu contraseña. Eres responsable de lo que ocurra desde ella.</li>
    </ul>

    <h3>3. Uso permitido</h3>
    <p>Cadencia es para tu uso personal y no comercial. Está prohibido:</p>
    <ul class="bul">
      <li>El uso <b>automatizado o abusivo</b>: bots, scraping, scripts, peticiones masivas o cualquier acceso que no sea desde la propia app.</li>
      <li>Saltarte los límites diarios de las funciones de IA, por ejemplo creando varias cuentas, o intentar eludir las medidas de seguridad.</li>
      <li>Copiar, revender, descompilar o hacer ingeniería inversa de la app, o usarla para fines ilícitos.</li>
    </ul>
    <p>Si detectamos un uso así, podemos limitar o suspender la cuenta.</p>

    <h3>4. Cuenta gratuita y Cadencia Pro</h3>
    <ul class="bul">
      <li><b>Cuenta gratuita:</b> registro de peso, entrenos y comidas, hasta 3 rutinas y 3 ejercicios propios, 1 análisis de plato con IA al día y hasta 3 ajustes de rutina con IA al día.</li>
      <li><b>Cadencia Pro:</b> quita el límite de rutinas y ejercicios propios, e incluye el Coach AI y el Taller IA, hasta 10 consultas de IA al día (foto del plato y Taller), 10 análisis del Coach AI al día y 10 ajustes de rutina al día, además de otras funciones avanzadas.</li>
      <li>Los límites diarios se cuentan por persona y por día, y se reinician cada día. Podemos ajustarlos para mantener el servicio estable; los vigentes son los que ves en la app.</li>
      <li><b>Precios:</b> Mensual 4,99 €, Anual 39,99 € y Para Siempre 89,99 € (pago único). Los precios vigentes se muestran siempre antes de pagar. El pago lo gestiona Stripe.</li>
      <li><b>Suscripciones:</b> los planes Mensual y Anual se renuevan solos cada periodo hasta que los canceles. Puedes cancelar cuando quieras en <b>Perfil → Administrar suscripción</b>: mantienes Pro hasta el final del periodo ya pagado. Borrar la cuenta no cancela la suscripción: cancélala antes.</li>
      <li><b>Para Siempre:</b> pago único que da acceso a Cadencia Pro mientras Cadencia se siga ofreciendo.</li>
      <li><b>Desistimiento y reembolsos:</b> si eres consumidor en la UE tienes 14 días para desistir de un contrato a distancia, salvo cuando el servicio digital ya se haya empezado a prestar con tu consentimiento expreso y hayas aceptado perder ese derecho. Para cualquier duda o petición de reembolso escribe a ${mail}.</li>
      <li><b>Códigos de invitación:</b> el Pro que se consigue con códigos de amigo es un regalo de duración limitada, no tiene valor económico y no se puede canjear por dinero.</li>
    </ul>

    <h3>5. Funciones con IA y contenido orientativo</h3>
    <p>Las rutinas, estimaciones y valoraciones de Cadencia son orientativas y no son consejo médico, nutricional ni deportivo profesional. Lee el ${tab('salud', 'Aviso de Salud y Uso de IA')}: forma parte de estas condiciones.</p>

    <h3>6. Propiedad intelectual</h3>
    <ul class="bul">
      <li>La app, su diseño, su marca y su código son del titular. Te damos una licencia personal, no exclusiva y revocable para usarla; no se te cede ningún otro derecho.</li>
      <li>Tus datos siguen siendo tuyos. Nos permites tratarlos solo para prestarte el servicio, como explica la Política de Privacidad.</li>
      <li>Las ilustraciones de ejercicios se usan bajo licencia de su proveedor (ExerciseDB). Los datos de productos de marca vienen de Open Food Facts (licencia ODbL) y los rellena una comunidad: pueden tener errores, compáralos con la etiqueta.</li>
    </ul>

    <h3>7. Disponibilidad y responsabilidad</h3>
    <ul class="bul">
      <li>Cadencia se ofrece «tal cual». Intentamos que funcione bien, pero no garantizamos que esté siempre disponible ni libre de errores, ni que los servicios de terceros en los que se apoya (Google, Stripe, proveedores de IA) funcionen sin interrupciones.</li>
      <li>Tú decides cómo usas la información de la app y eres responsable de tu entreno y de tu salud. En la medida que permite la ley, y sin afectar a los derechos que como consumidor no se pueden limitar, no respondemos de daños derivados de seguir las estimaciones de la app.</li>
    </ul>

    <h3>8. Cambios y baja</h3>
    <ul class="bul">
      <li>Podemos cambiar estas condiciones. Si el cambio es importante, te lo avisaremos en la app antes de que se aplique.</li>
      <li>Puedes dejar de usar Cadencia y borrar tu cuenta cuando quieras (<b>Perfil → Eliminar cuenta</b>).</li>
    </ul>

    <h3>9. Ley aplicable</h3>
    <p>Estas condiciones se rigen por la ley española. Si eres consumidor, puedes acudir a los tribunales de tu domicilio. Para cualquier reclamación, escríbenos primero a ${mail}.</p>`;
}

function privacidad() {
  return `
    <p class="small muted">Versión del ${fecha()}. En corto: tus datos son tuyos, solo los usamos para que la app te funcione y puedes borrarlos cuando quieras.</p>

    <h3>1. Responsable del tratamiento</h3>
    <p>${titular()}</p>

    <h3>2. Qué datos recogemos</h3>
    <ul class="bul">
      <li><b>Cuenta:</b> tu email, nombre, apellidos y nombre de usuario. Si entras con Google o Apple, el nombre y el email que ese proveedor comparta. Tu contraseña la gestiona Firebase Authentication: nosotros no la vemos.</li>
      <li><b>Perfil físico:</b> sexo, edad o fecha de nacimiento, estatura, peso, peso objetivo y objetivos; tu composición corporal si la apuntas (grasa, músculo, agua, hueso y desglose por zonas); y las respuestas del cuestionario inicial (experiencia, material, días y tiempo disponibles, obstáculos).</li>
      <li><b>Tu actividad:</b> rutinas, registros de entrenamiento (ejercicios, series, pesos, repeticiones, RIR y notas del Coach AI), nutrición (comidas, calorías y macros) e hidratación (agua que apuntas).</li>
      <li><b>Foto de perfil (opcional):</b> se guarda en Firebase Storage. La foto de un plato que analizas con IA <b>no se guarda</b> en Cadencia.</li>
      <li><b>Datos técnicos:</b> si activas los recordatorios, un identificador de tu dispositivo (token de notificaciones), tus horas elegidas y tu zona horaria; si eres Pro, los identificadores de cliente y suscripción de Stripe (nunca tu tarjeta); y las preferencias que la app guarda en tu móvil.</li>
      ${CICLISMO ? '<li><b>Ciclismo y Strava (opcional):</b> datos de tus bicis, las rutas GPX que guardes y, si lo conectas, tus actividades de Strava.</li>' : ''}
    </ul>
    <p>Tu peso, composición corporal, objetivos y datos de entrenamiento y nutrición son <b>datos de salud</b>, una categoría especial del RGPD. Solo los tratamos con tu <b>consentimiento expreso</b>, que das al crear la cuenta y puedes retirar cuando quieras borrando tu cuenta.</p>

    <h3>3. Para qué los usamos</h3>
    <ul class="bul">
      <li><b>Prestarte el servicio:</b> personalizar tus rutinas, calcular métricas, calorías, macros e hidratación, y sincronizar tus datos en la nube para que los veas en cualquier dispositivo. (Base legal: ejecución del contrato y tu consentimiento.)</li>
      <li><b>Funciones con IA:</b> generar recomendaciones cuando tú las pides. (Base legal: tu consentimiento al usarlas.)</li>
      <li><b>Pagos de Cadencia Pro:</b> gestionar tu suscripción y cumplir con obligaciones legales de facturación.</li>
      <li><b>Seguridad y límites diarios:</b> evitar abusos y proteger el servicio. (Base legal: interés legítimo.)</li>
      <li><b>Recordatorios:</b> avisarte solo si los activas. (Base legal: tu consentimiento.)</li>
    </ul>
    <p>No vendemos tus datos, no los cedemos a anunciantes y no los usamos para publicidad. Las recomendaciones de IA no producen efectos legales sobre ti.</p>

    <h3>4. Qué proveedores tratan tus datos</h3>
    <ul class="bul">
      <li><b>Firebase / Google Cloud (Google):</b> alojamiento de la app, inicio de sesión, base de datos, almacenamiento de la foto, funciones del servidor y avisos. Los datos se guardan en servidores de la Unión Europea (las funciones se ejecutan en Bélgica), con conexión cifrada y reglas que impiden que otra persona lea tus datos.</li>
      <li><b>APIs de IA:</b> <b>Anthropic (Claude)</b> analiza la foto del plato y atiende el Taller IA; <b>Google (Gemini)</b> genera el Coach AI y los ajustes de rutina. A Gemini le enviamos un resumen de tu entreno o de tu rutina junto con datos de tu perfil sin identificadores (sexo, edad, peso, objetivos, experiencia, material y tiempo disponible), y el texto que escribas al pedir un cambio. <b>No enviamos tu nombre, email ni usuario.</b> No escribas datos personales en esos mensajes. Con el servicio gratuito de la API de Gemini, Google puede usar esas entradas para mejorar sus productos, según sus condiciones.</li>
      <li><b>Stripe:</b> cobra y gestiona las suscripciones. Recibe tu email y tus datos de pago; Cadencia nunca ve ni guarda tu tarjeta.</li>
      <li><b>Google reCAPTCHA (Firebase App Check):</b> comprueba que las peticiones vienen de la app y no de un robot. Google puede tratar datos técnicos de tu navegador, como la dirección IP.</li>
      <li><b>Open Food Facts:</b> si buscas o escaneas un producto de marca, se envía el texto o el código de barras, sin ningún dato tuyo.</li>
      ${CICLISMO ? '<li><b>Strava, Open-Meteo y OpenStreetMap:</b> solo si usas esas funciones de ciclismo.</li>' : ''}
    </ul>
    <p>Estos proveedores actúan como encargados del tratamiento o proveedores independientes según su servicio. Algunos pueden tratar datos fuera del Espacio Económico Europeo, por ejemplo en EE. UU., con garantías como las cláusulas contractuales tipo o el Marco de Privacidad de Datos UE–EE. UU.</p>

    <h3>5. Cuánto tiempo los guardamos</h3>
    <p>Mientras tengas la cuenta. Al eliminarla desde <b>Perfil → Eliminar cuenta</b>, se borran al momento tu perfil, pesos, entrenos, comidas, rutas y foto. Pueden quedar solo registros técnicos mínimos sin datos de salud (por ejemplo, el marcador de que un código de invitación ya se usó) y los datos de facturación que Stripe deba conservar por ley.</p>

    <h3>6. Tus derechos</h3>
    <p>Puedes acceder a tus datos, rectificarlos, suprimirlos, limitar u oponerte a su tratamiento, llevártelos (portabilidad) y retirar tu consentimiento. Muchas cosas las haces desde la app: editar tus datos en Perfil, o <b>eliminar tu cuenta y todos tus datos</b> en Perfil → Eliminar cuenta.</p>
    <p><b>Para pedir la eliminación de tu cuenta y tus datos</b>, o ejercer cualquier otro derecho, escribe a ${mail}. Te responderemos en un máximo de un mes. Si no estás conforme, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>

    <h3>7. Almacenamiento en tu dispositivo</h3>
    <p>No usamos cookies de publicidad ni de analítica. Solo guardamos en tu móvil lo necesario para que la app funcione: tu sesión, preferencias (tema, pestaña abierta, tiempos de descanso), el entreno en curso y la copia de la propia app para abrirla más rápido. reCAPTCHA puede usar el almacenamiento técnico necesario para su función de seguridad.</p>

    <h3>8. Menores</h3>
    <p>Cadencia es para personas de 14 años o más. Si crees que un menor de esa edad se ha registrado, escríbenos y borraremos la cuenta.</p>

    <h3>9. Cambios</h3>
    <p>Si cambiamos esta política de forma importante, te lo avisaremos en la app. Los datos de salud y cómo se usan con IA se explican también en el ${tab('salud', 'Aviso de Salud y Uso de IA')}.</p>`;
}

function salud() {
  return `
    <div class="legal-warn" role="note">
      <b>Cadencia no es un servicio médico.</b> Las rutinas, las estimaciones de calorías, las recomendaciones de hidratación y las valoraciones del Coach AI son <b>orientativas</b>, se generan con algoritmos e inteligencia artificial y <b>no constituyen consejo médico, nutricional ni deportivo profesional</b>.
    </div>
    <p class="small muted">Versión del ${fecha()}.</p>

    <h3>Entrenas bajo tu responsabilidad</h3>
    <ul class="bul">
      <li>Todo lo que ves en Cadencia (planes de entreno, calorías y macros, peso objetivo, % de grasa, objetivo de agua, recuperación muscular y consejos del Coach AI) son <b>estimaciones</b> calculadas con fórmulas generales y modelos de IA, no una valoración de tu caso.</li>
      <li>No sustituye a un médico, dietista-nutricionista ni entrenador titulado, y no crea ninguna relación profesional contigo.</li>
      <li><b>Consulta a un profesional sanitario</b> antes de empezar un plan de entreno o una dieta, y siempre que tengas una lesión o una patología (por ejemplo cardiovascular, diabetes, hipertensión, problemas articulares o renales), estés embarazada o en lactancia, tomes medicación, hayas tenido problemas con la comida o seas menor de edad.</li>
      <li>Si notas dolor, mareo, falta de aire, dolor en el pecho o cualquier síntoma raro, <b>para y busca atención médica</b>. En una urgencia, llama al 112.</li>
    </ul>

    <h3>Sobre la inteligencia artificial</h3>
    <ul class="bul">
      <li>El Coach AI, los ajustes de rutina, el Taller IA y el análisis de platos usan modelos de IA (Anthropic y Google). <b>Pueden equivocarse</b>, dar respuestas imprecisas o poco adecuadas para ti, y no ven tu técnica ni tu estado de salud real.</li>
      <li>El análisis de una foto de comida es una estimación aproximada: las calorías y macros pueden desviarse mucho. Compáralas con la etiqueta cuando puedas.</li>
      <li>Las valoraciones dependen de lo que tú registras. Si los datos están incompletos o son incorrectos, el resultado también lo será.</li>
      <li>Contrasta lo que te recomiende la IA y usa tu criterio. Tú decides si lo aplicas.</li>
    </ul>

    <h3>Nutrición e hidratación</h3>
    <ul class="bul">
      <li>El objetivo de calorías usa una fórmula general y un ritmo que eliges tú. No es adecuado sin supervisión profesional si estás embarazada, en lactancia, tienes un trastorno de la conducta alimentaria o una enfermedad que afecte a tu alimentación.</li>
      <li>El objetivo de agua se calcula a partir de tu peso y de si entrenas. Si tu médico te ha indicado limitar los líquidos (por ejemplo por problemas de riñón o corazón), sigue sus indicaciones.</li>
      <li>Si crees que tienes una relación difícil con la comida o el ejercicio, pide ayuda a un profesional.</li>
    </ul>

    <h3>Tus datos y la IA</h3>
    <p>Las funciones de IA son opcionales y solo se usan cuando las pides. Qué datos se envían y a qué proveedores se explica en la ${tab('privacidad', 'Política de Privacidad')}.</p>`;
}

// Enlaces discretos a los tres documentos (pie de Perfil y de la bienvenida). Cada botón abre el modal en su pestaña (data-act="legal-open").
const abrir = (id, txt) => `<button type="button" data-act="legal-open" data-v="${id}">${txt}</button>`;
export const legalLinksHTML = (cls = '') => `<nav class="legal-links ${cls}" aria-label="Información legal">${abrir('terminos', 'Términos')}<span aria-hidden="true">·</span>${abrir('privacidad', 'Privacidad')}<span aria-hidden="true">·</span>${abrir('salud', 'Salud e IA')}</nav>`;
// Frase de aceptación con los tres documentos enlazados por su nombre completo (registro y acceso con Google/Apple).
const lk = (id, txt) => `<button type="button" class="link" data-act="legal-open" data-v="${id}">${txt}</button>`;
export const legalCheckHTML = () => `${lk('terminos', 'Términos y Condiciones de Uso')}, la ${lk('privacidad', 'Política de Privacidad')} y el ${lk('salud', 'Aviso de Salud y Uso de IA')}`;

export function legalDoc(id) {
  return id === 'privacidad' ? privacidad() : id === 'salud' ? salud() : terminos();
}
