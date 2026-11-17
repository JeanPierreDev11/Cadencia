// Pautas de ejecución para la ficha del ejercicio. NO son instrucciones propias de cada ejercicio (la base de datos no las trae):
// son indicaciones generales por patrón de movimiento (los ejercicios de la tabla principal) o, si no hay patrón, por grupo muscular,
// más un consejo según el equipo. Si algún día hay texto real por ejercicio, basta con devolverlo desde `pautas`.

const POR_PATRON = {
  empuje_h: ['Escápulas juntas y hacia abajo; pies firmes en el suelo.', 'Baja controlado hasta rozar el pecho (o hasta que el codo quede a unos 45–60° del torso).', 'Empuja hacia arriba sin despegar la espalda del banco ni encoger los hombros.'],
  empuje_v: ['Abdomen y glúteos apretados para no arquear la zona lumbar.', 'Empuja en línea recta sobre la cabeza hasta casi estirar los codos.', 'Baja despacio hasta la altura de la barbilla o las orejas.'],
  tiron_h: ['Pecho abierto y espalda neutra; no te ayudes con balanceo.', 'Lleva los codos hacia atrás y junta las escápulas al final.', 'Vuelve despacio estirando los brazos sin soltar el tronco.'],
  tiron_v: ['Agarre firme y hombros lejos de las orejas desde el inicio.', 'Tira llevando los codos hacia abajo y hacia las costillas.', 'Sube/baja completo y controla la vuelta; evita el impulso.'],
  rodilla: ['Pies a la anchura de los hombros y rodillas en la dirección de los pies.', 'Baja con el pecho alto y el peso repartido por todo el pie.', 'Sube empujando el suelo sin que las rodillas se cierren hacia dentro.'],
  bisagra: ['Espalda neutra todo el recorrido; la cadera va hacia atrás, no hacia abajo.', 'Barra o peso pegados al cuerpo y rodillas ligeramente flexionadas.', 'Sube extendiendo la cadera y aprieta los glúteos al final, sin hiperextender la espalda.'],
  unilateral: ['Mantén la pelvis nivelada y el tronco estable.', 'Apoya todo el pie delantero; la rodilla sigue la línea del pie.', 'Haz las mismas repeticiones con cada pierna.'],
  elev_lat: ['Codos ligeramente flexionados y sin balancear el tronco.', 'Sube hasta la altura de los hombros, con el codo algo por encima de la muñeca.', 'Baja despacio; mejor menos peso y más control.'],
  aperturas: ['Codos ligeramente flexionados y fijos durante todo el movimiento.', 'Abre hasta notar estirado el pecho, sin pasarte de la línea del hombro.', 'Cierra juntando los brazos como si abrazaras un árbol.'],
  biceps: ['Codos pegados al cuerpo y sin balanceo.', 'Sube sin llevar los hombros hacia delante.', 'Baja lento hasta casi extender el brazo.'],
  triceps: ['Codos quietos y apuntando hacia delante (o hacia abajo, según el ejercicio).', 'Extiende del todo y aprieta el tríceps al final.', 'Vuelve controlado sin que los codos se abran.'],
  antebrazo: ['Apoya bien el antebrazo para que solo se mueva la muñeca.', 'Recorrido completo, sin tirones.', 'Ritmo lento, especialmente al bajar.'],
  gluteo: ['Empuja con los talones y aprieta el glúteo arriba.', 'Costillas abajo y zona lumbar neutra; no te arquees para subir más.', 'Pausa de un segundo arriba y baja controlado.'],
  femoral: ['Mantén la cadera estable y la espalda neutra.', 'Flexiona o tira usando el femoral, no el impulso.', 'Baja despacio, notando el estiramiento.'],
  cuad_iso: ['Ajusta el asiento para que la rodilla quede alineada con el eje de la máquina.', 'Extiende sin dar un golpe seco al final.', 'Baja controlado, sin soltar el peso de golpe.'],
  gemelos: ['Apoya la parte delantera del pie y sube lo más alto posible.', 'Pausa arriba y baja hasta estirar bien.', 'Recorrido completo y sin rebotes.'],
  core: ['Costillas hacia la pelvis y espalda baja pegada al suelo (o neutra).', 'Mueve con el abdomen, no con el cuello ni los brazos.', 'Respira sin aguantar el aire y controla la bajada.'],
  posterior: ['Hombros lejos de las orejas y cuello relajado.', 'Lleva los codos hacia atrás abriendo el pecho.', 'Pausa breve al final y vuelta controlada.'],
};

const POR_GRUPO = {
  pecho: POR_PATRON.empuje_h, espalda: POR_PATRON.tiron_h, hombro: POR_PATRON.empuje_v, biceps: POR_PATRON.biceps, triceps: POR_PATRON.triceps,
  antebrazo: POR_PATRON.antebrazo, cuadriceps: POR_PATRON.rodilla, femoral: POR_PATRON.femoral, gluteo: POR_PATRON.gluteo, gemelos: POR_PATRON.gemelos,
  core: POR_PATRON.core, aductores: POR_PATRON.unilateral, abductores: POR_PATRON.gluteo,
};

const POR_EQUIPO = {
  barra: 'Con barra: calienta con poco peso y usa topes de seguridad si trabajas pesado.',
  barraz: 'Con barra Z: agarra donde la muñeca esté más cómoda.',
  mancuernas: 'Con mancuernas: controla cada mano por separado y no uses impulso.',
  polea: 'En polea: mantén tensión constante y ajusta la altura antes de empezar.',
  maquina: 'En máquina: regula asiento y respaldo para que el eje coincida con tu articulación.',
  multipower: 'En multipower: coloca los pies para que la barra suba en línea con tu cuerpo.',
  corporal: 'Con tu peso corporal: si es muy fácil, frena la bajada; si es difícil, reduce el recorrido.',
  banda: 'Con banda: mantén la banda siempre algo tensa, también al volver.',
  kettlebell: 'Con kettlebell: agarre firme y movimiento controlado, sin balanceos bruscos.',
  suspension: 'En suspensión: cuanto más inclinado el cuerpo, más difícil; empieza fácil.',
};

// Devuelve { pasos: [texto], equipo: texto|'' } para una ficha de ejercicio (x = objeto de la biblioteca).
export function pautas(x) {
  if (!x) return { pasos: [], equipo: '' };
  if (x.tipo === 'cardio') return { pasos: ['Empieza suave unos minutos y sube la intensidad poco a poco.', 'Mantén una postura erguida y respira de forma regular.', 'Termina con un par de minutos tranquilos para recuperar.'], equipo: '' };
  return { pasos: POR_PATRON[x.p] || POR_GRUPO[x.m] || [], equipo: POR_EQUIPO[x.eq] || '' };
}
