// Pruebas de parsearCSVEntrenos y entrenosACSV (76). Ejecutar: node scripts/prueba-csv-entrenos.mjs
import * as E from '../js/entreno.js';

let ok = 0, mal = 0;
const t = (nombre, cond, extra = '') => { if (cond) ok++; else { mal++; console.log('FALLA:', nombre, extra); } };
const ord = (x) => (Array.isArray(x) ? x.map(ord) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ord(x[k])])) : x);
const eq = (nombre, a, b) => t(nombre, JSON.stringify(ord(a)) === JSON.stringify(ord(b)), `\n  obtenido: ${JSON.stringify(a)}\n  esperado: ${JSON.stringify(b)}`);

// ---------- 1. Hevy (muestra con el formato real de su exportación: comillas en todo, warmup, RPE, dropset y una coma dentro del nombre) ----------
const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Bench Press (Barbell)","","Agarre medio","0","warmup","40","10","","",""
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Bench Press (Barbell)","","","1","normal","80","8","","","8"
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Bench Press (Barbell)","","","2","normal","80","7","","","9.5"
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Bench Press (Barbell)","","","3","dropset","60","10","","",""
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Lateral Raise (Dumbbell)","","","0","normal","10","15","","","7"
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Lateral Raise (Dumbbell)","","","1","failure","10","12","","",""
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Cable Crunch ""Kneeling""","","","0","normal","35,5","12","","",""
"Push, día A","26 Nov 2024, 18:30","26 Nov 2024, 19:42","","Plank","","","0","normal","","","","60",""
"Pierna","28 Nov 2024, 07:05","28 Nov 2024, 08:10","Notas
en dos líneas","Squat (Barbell)","","","0","normal","100","5","","","8"
"Pierna","28 Nov 2024, 07:05","28 Nov 2024, 08:10","","Romanian Deadlift (Barbell)","","","0","normal","90","8","","",""
"Pierna","28 Nov 2024, 07:05","28 Nov 2024, 08:10","","Treadmill","","","0","normal","","","2","900",""
`;
const h = E.parsearCSVEntrenos(HEVY, []);
t('hevy: formato', h.formato === 'hevy', h.formato);
t('hevy: sin error', h.error === null, h.error);
t('hevy: 2 entrenos', h.entrenos.length === 2, h.entrenos.length);
const [p1, p2] = h.entrenos;
t('hevy: nombre con coma', p1.nombre === 'Push, día A', p1.nombre);
t('hevy: fecha ISO', p1.fecha === '2024-11-26' && p2.fecha === '2024-11-28');
t('hevy: duración de start/end', p1.min === 72 && p2.min === 65, `${p1.min} ${p2.min}`);
t('hevy: banca al catálogo', p1.ejercicios[0].n === 'Press banca', p1.ejercicios[0].n);
eq('hevy: series de banca', p1.ejercicios[0].series, [{ kg: 40, reps: 10, w: true }, { kg: 80, reps: 8, rir: 2 }, { kg: 80, reps: 7, rir: 1 }, { kg: 60, reps: 10, isDropSet: true }]);
t('hevy: carga total en barra', p1.ejercicios[0].carga === 'total');
t('hevy: laterales al catálogo y por lado', p1.ejercicios[1].n === 'Elevaciones laterales' && p1.ejercicios[1].carga === 'por_lado', JSON.stringify(p1.ejercicios[1]));
eq('hevy: fallo = RIR 0', p1.ejercicios[1].series[1], { kg: 10, reps: 12, rir: 0 });
t('hevy: comillas escapadas y nombre sin equivalencia se conserva', p1.ejercicios[2].n === 'Cable Crunch "Kneeling"', p1.ejercicios[2].n);
eq('hevy: coma decimal en kg', p1.ejercicios[2].series[0], { kg: 35.5, reps: 12 });
t('hevy: plancha sin reps no se guarda', p1.ejercicios.length === 3 && h.omitidas === 1, `${p1.ejercicios.length} ${h.omitidas}`);
t('hevy: sentadilla y rumano', p2.ejercicios[0].n === 'Sentadilla con barra' && p2.ejercicios[1].n === 'Peso muerto rumano');
t('hevy: cinta como cardio', p2.ejercicios[2].tipo === 'cardio' && p2.ejercicios[2].n === 'Caminadora / Cinta de correr', JSON.stringify(p2.ejercicios[2]));
eq('hevy: bloque de cinta', p2.ejercicios[2].series[0], { tiempo: 15, completada: true, velocidad: 8 });
t('hevy: series totales', h.series === 4 + 2 + 1 + 1 + 1 + 1, h.series);
t('hevy: rango de fechas', h.desde === '2024-11-26' && h.hasta === '2024-11-28');
t('hevy: id estable', /^wi[0-9a-z]+$/.test(p1.id) && E.parsearCSVEntrenos(HEVY, []).entrenos[0].id === p1.id);
t('hevy: tipo gym e importado', p1.tipo === 'gym' && p1.importado === 'hevy' && p1.esf === 2);
t('hevy: kcal estimadas', p1.kcal > 0);
t('hevy: sin undefined ni NaN', !/undefined|NaN|null/.test(JSON.stringify(h.entrenos)));
t('hevy: volumen calculable', Math.round(E.volumenDe(p1)) > 0);

// Hevy con libras
const HEVY_LB = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
Upper,"5 Jan 2025, 10:00","5 Jan 2025, 11:00",,Deadlift (Barbell),,,0,normal,225,5,,,
`;
const hl = E.parsearCSVEntrenos(HEVY_LB, []);
t('hevy lbs: convierte a kg', hl.entrenos[0].ejercicios[0].series[0].kg === 102.1 && hl.entrenos[0].ejercicios[0].n === 'Peso muerto convencional', JSON.stringify(hl.entrenos[0]));

// ---------- 2. Strong ----------
const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2023-01-15 08:30:00,"Pull Day",1h 5m,"Lat Pulldown (Cable)",W,30,12,0,0,"",,
2023-01-15 08:30:00,"Pull Day",1h 5m,"Lat Pulldown (Cable)",1,55,10,0,0,"",,8
2023-01-15 08:30:00,"Pull Day",1h 5m,"Lat Pulldown (Cable)",2,55,9,0,0,"",,
2023-01-15 08:30:00,"Pull Day",1h 5m,"Bent Over Row (Barbell)",1,60,8,0,0,"",,
2023-01-15 08:30:00,"Pull Day",1h 5m,"Bicep Curl (Dumbbell)",1,14,10,0,0,"",,
2023-01-17 19:00:00,"Legs",45m,"Leg Press",1,140,12,0,0,"",,
2023-01-17 19:00:00,"Legs",45m,"Leg Press",D,100,15,0,0,"",,
`;
const s = E.parsearCSVEntrenos(STRONG, []);
t('strong: formato', s.formato === 'strong', s.formato);
t('strong: 2 entrenos', s.entrenos.length === 2, s.entrenos.length);
t('strong: duración «1h 5m» y «45m»', s.entrenos[0].min === 65 && s.entrenos[1].min === 45, `${s.entrenos[0].min} ${s.entrenos[1].min}`);
t('strong: jalón al pecho', s.entrenos[0].ejercicios[0].n === 'Jalón al pecho');
eq('strong: W calentamiento, RPE 8 = RIR 2', s.entrenos[0].ejercicios[0].series, [{ kg: 30, reps: 12, w: true }, { kg: 55, reps: 10, rir: 2 }, { kg: 55, reps: 9 }]);
t('strong: remo y curl', s.entrenos[0].ejercicios[1].n === 'Remo con barra' && s.entrenos[0].ejercicios[2].n === 'Curl de bíceps con mancuernas');
t('strong: D = drop set', s.entrenos[1].ejercicios[0].series[1].isDropSet === true);
t('strong: series totales', s.series === 3 + 1 + 1 + 2, s.series);
const sLb = E.parsearCSVEntrenos(STRONG.replace('Weight,', 'Weight (lbs),'), []);
t('strong: cabecera en lbs convierte', sLb.entrenos[0].ejercicios[0].series[1].kg === 24.9, JSON.stringify(sLb.entrenos[0].ejercicios[0].series[1]));
const sOp = E.parsearCSVEntrenos(STRONG, [], { lbs: true });
t('strong: opción lbs convierte', sOp.entrenos[0].ejercicios[1].series[0].kg === 27.2, JSON.stringify(sOp.entrenos[0].ejercicios[1].series[0]));
const sPC = E.parsearCSVEntrenos(STRONG.replace(/,/g, ';'), []);
t('strong: separador punto y coma', sPC.entrenos.length === 2 && sPC.series === s.series);

// ---------- 3. Cadencia: exportar → importar (ida y vuelta) ----------
const historial = [
  { id: 'a1', fecha: '2026-11-20', tipo: 'gym', nombre: 'Torso', min: 60, esf: 2, ejercicios: [
    { n: 'Press banca', carga: 'total', series: [{ kg: 50, reps: 10, w: true }, { kg: 82.5, reps: 8, rir: 2 }, { kg: 82.5, reps: 7, rir: 1, isDropSet: true }] },
    { n: 'Curl de bíceps con mancuernas', carga: 'por_lado', series: [{ kg: 14, reps: 10, isSuperset: true }] },
    { n: 'Remo con mancuerna', carga: 'total', uni: true, series: [{ kg: 30, reps: 10, kgD: 28, repsD: 9, rir: 1 }, { kg: 30, reps: 10, kgD: 30, repsD: 10 }] },
    { n: 'Caminadora / Cinta de correr', tipo: 'cardio', series: [{ tiempo: 10, velocidad: 6.5, inclinacion: 3, completada: true }] },
  ] },
  { id: 'a2', fecha: '2026-11-22', tipo: 'bici', nombre: 'Rodaje', min: 90, km: 42.5, esf: 2 },
];
const csv = E.entrenosACSV(historial);
const lineas = csv.trim().split('\r\n');
t('cadencia: cabecera', lineas[0] === 'fecha,rutina,ejercicio,serie,tipo,kg,reps,rir,carga,notas', lineas[0]);
t('cadencia: filas (3 + 1 + 4 + 1 + 1)', lineas.length === 1 + 10, lineas.length);
t('cadencia: fila de unilateral', lineas.includes('2026-11-20,Torso,Remo con mancuerna,1,normal,28,9,1,derecha,'), lineas.join('\n'));
t('cadencia: fila de cardio', lineas.some((l) => l.includes(',cardio,') && l.includes('tiempo=10; velocidad=6.5; inclinacion=3')));
const c = E.parsearCSVEntrenos('﻿' + csv, []);
t('cadencia: formato', c.formato === 'cadencia', c.formato + ' ' + c.error);
t('cadencia: 2 entrenos', c.entrenos.length === 2, c.entrenos.length);
const [c1, c2] = c.entrenos;
eq('cadencia: banca idéntica', c1.ejercicios[0], historial[0].ejercicios[0]);
eq('cadencia: superserie y por lado', c1.ejercicios[1], historial[0].ejercicios[1]);
eq('cadencia: unilateral', c1.ejercicios[2], historial[0].ejercicios[2]);
eq('cadencia: cardio', c1.ejercicios[3], historial[0].ejercicios[3]);
t('cadencia: bici', c2.tipo === 'bici' && c2.km === 42.5 && c2.min === 90 && !('ejercicios' in c2), JSON.stringify(c2));
t('cadencia: volumen igual', Math.round(E.volumenDe(c1)) === Math.round(E.volumenDe(historial[0])));
const comillas = E.entrenosACSV([{ id: 'x', fecha: '2026-01-02', tipo: 'gym', nombre: 'Día "duro", A', min: 30, ejercicios: [{ n: 'Press banca', series: [{ kg: 60, reps: 5 }] }] }]);
t('cadencia: comillas y coma en el nombre', E.parsearCSVEntrenos(comillas, []).entrenos[0].nombre === 'Día "duro", A');

// ---------- 4. Duplicados ----------
const d1 = E.parsearCSVEntrenos(HEVY, h.entrenos);
t('duplicados: todo omitido', d1.entrenos.length === 0 && d1.duplicados === 2 && d1.error === null, JSON.stringify({ n: d1.entrenos.length, d: d1.duplicados, e: d1.error }));
const d2 = E.parsearCSVEntrenos(HEVY, [{ fecha: '2024-11-26', nombre: 'push, DÍA a', ejercicios: [{}, {}, {}] }]);
t('duplicados: compara sin mayúsculas ni tildes', d2.entrenos.length === 1 && d2.duplicados === 1);
const d3 = E.parsearCSVEntrenos(HEVY, [{ fecha: '2024-11-26', nombre: 'Push, día A', ejercicios: [{}, {}] }]);
t('duplicados: distinto número de ejercicios no es duplicado', d3.entrenos.length === 2 && d3.duplicados === 0);
const d4 = E.parsearCSVEntrenos(csv, c.entrenos);
t('duplicados: cadencia dos veces', d4.entrenos.length === 0 && d4.duplicados === 2);

// ---------- 5. Archivos vacíos o inválidos ----------
t('vacío', E.parsearCSVEntrenos('', []).error === 'El archivo está vacío.');
t('solo BOM y saltos', !!E.parsearCSVEntrenos('﻿\r\n\r\n', []).error);
t('solo cabecera', /solo tiene la cabecera/.test(E.parsearCSVEntrenos('fecha,rutina,ejercicio,serie,tipo,kg,reps,rir,carga,notas\n', []).error || ''));
const inv = E.parsearCSVEntrenos('nombre,apellido\nAna,López\n', []);
t('formato desconocido', inv.formato === null && /No reconocemos el formato/.test(inv.error) && inv.entrenos.length === 0);
t('texto basura', !!E.parsearCSVEntrenos('hola que tal', []).error);
const sinSeries = E.parsearCSVEntrenos(HEVY.split('\n')[0] + '\n"X","1 Feb 2025, 10:00","","","Plank","","","0","normal","","","","60",""\n', []);
t('sin series válidas', /series válidas/.test(sinSeries.error || '') && sinSeries.entrenos.length === 0, JSON.stringify(sinSeries));
const fechaMala = E.parsearCSVEntrenos('fecha,rutina,ejercicio,serie,tipo,kg,reps,rir,carga,notas\n2026-02-31,A,Press banca,1,normal,50,5,,,\n', []);
t('fecha imposible = fila omitida', !!fechaMala.error && fechaMala.omitidas === 1);
t('null no rompe', !!E.parsearCSVEntrenos(null).error);

// ---------- 6. Utilidades ----------
t('nombreCatalogo: Overhead Press', E.nombreCatalogo('Overhead Press (Barbell)') === 'Press militar');
t('nombreCatalogo: nombre en español se conserva', E.nombreCatalogo('press banca') === 'Press banca');
t('nombreCatalogo: desconocido se conserva', E.nombreCatalogo('Zercher Squat Variante') === 'Zercher Squat Variante');
t('leerFechaCSV: dd/mm/aaaa', E.leerFechaCSV('05/03/2025').fecha === '2025-03-05');
t('leerFechaCSV: «Jan 5, 2025»', E.leerFechaCSV('Jan 5, 2025 10:00').fecha === '2025-01-05');

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
