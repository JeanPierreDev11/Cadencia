// Pruebas del check-in semanal de calorías adaptativas (js/calorias.js). Uso: node scripts/prueba-checkin.mjs
import * as CAL from '../js/calorias.js';

let ok = 0, ko = 0;
const t = (nombre, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('FALLO:', nombre, extra); } };
const HOY = '2026-11-25';
const d = (n) => CAL.sumarDias(HOY, -n);
// Pesajes: dos por semana con la media pedida.
const pesos = (act, ant) => [{ fecha: d(1), kg: act }, { fecha: d(4), kg: act }, { fecha: d(8), kg: ant }, { fecha: d(11), kg: ant }];
const comidas = (kcal, n = 5) => Array.from({ length: n }, (_, i) => ({ fecha: d(i), kcal }));
const hombre = (extra = {}) => ({ sexo: 'hombre', edad: 30, alturaCm: 180, objetivos: ['perder'], ritmoKgSemana: 0.5, nutri: { actividad: 'moderado' }, ...extra });
const opt = { kg: 85, actividad: 'moderado' };

// 0) Retrocompatibilidad: sin ajuste el resultado es idéntico al de antes y trae tdeeBase/ajusteKcal.
{
  const a = CAL.calorias(hombre(), opt), b = CAL.calorias(hombre({ nutri: { actividad: 'moderado', ajusteKcal: 0 } }), opt);
  t('sin ajuste = ajuste 0', JSON.stringify(a) === JSON.stringify(b));
  t('tdeeBase = tdee sin ajuste', a.tdeeBase === a.tdee && a.ajusteKcal === 0);
  const c = CAL.calorias(hombre({ nutri: { actividad: 'moderado', ajusteKcal: -120 } }), opt);
  t('ajuste −120 baja el gasto y el objetivo', c.tdee === a.tdee - 120 && c.kcal === a.kcal - 120 && c.tdeeBase === a.tdeeBase && c.ajusteKcal === -120, JSON.stringify(c));
  const e = CAL.calorias(hombre({ nutri: { ajusteKcal: 9999 } }), opt);
  t('ajuste acotado a +500', e.ajusteKcal === 500);
  const f = CAL.calorias(hombre({ nutri: { ajusteKcal: 'basura' } }), opt);
  t('ajuste basura = 0', f.ajusteKcal === 0);
  const r = CAL.resumen(hombre({ nutri: { actividad: 'moderado', ajusteKcal: 50 } }), 85);
  t('resumen guarda tdeeBase y ajusteKcal', r.ajusteKcal === 50 && r.tdeeBase > 0 && !('aviso' in r));
}

// 1) Pierde más despacio de lo previsto comiendo en su objetivo → recorte acotado a −150.
{
  const p = hombre(), obj = CAL.calorias(p, opt).kcal;
  const r = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85.1), comidas7d: comidas(obj), hoyISO: HOY, ...opt });
  t('1 listo', r.estado === 'listo', JSON.stringify(r));
  t('1 recorte −150', r.paso === -150 && r.nuevoAjuste === -150 && r.diffKcal === -150, `paso ${r.paso} diff ${r.diffKcal}`);
  t('1 ritmo objetivo ≈ −0,5', Math.abs(r.ritmoObjKg + 0.5) < 0.01, r.ritmoObjKg);
  t('1 cambio semanal −0,1', Math.abs(r.cambioSemKg + 0.1) < 1e-9);
}

// 2) Pierde despacio pero come +300 por encima del objetivo → no recorta: su gasto real coincide con el calculado.
{
  const p = hombre(), c = CAL.calorias(p, opt);
  // Comiendo +300 la pérdida esperada es (déficit − 300) × 7 / 7700 por semana.
  const perdida = ((c.deficit - 300) * 7) / 7700;
  const r = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85 + perdida), comidas7d: comidas(c.kcal + 300), hoyISO: HOY, ...opt });
  t('2 listo y mantiene', r.estado === 'listo' && r.paso === 0 && r.diffKcal === 0 && r.motivo === 'alineado', JSON.stringify({ paso: r.paso, d: r.deltaTdee }));
  t('2 gasto real ≈ calculado', Math.abs(r.tdeeReal - c.tdee) < 2);
}

// 3) Volumen: gana más despacio de lo previsto → subida acotada a +150.
{
  const p = hombre({ objetivos: ['musculo'], ritmoKgSemana: 0.25 }), obj = CAL.calorias(p, opt);
  t('3 modo superávit', obj.modo === 'superavit');
  const r = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85.1), comidas7d: comidas(obj.kcal), hoyISO: HOY, ...opt });
  t('3 subida +150', r.estado === 'listo' && r.paso === 150 && r.diffKcal === 150, JSON.stringify({ paso: r.paso, diff: r.diffKcal }));
  t('3 ritmo objetivo +0,25', Math.abs(r.ritmoObjKg - 0.25) < 0.01);
  // Con ajuste previo +450 solo puede subir 50 (tope +500).
  const p2 = hombre({ objetivos: ['musculo'], ritmoKgSemana: 0.25, nutri: { actividad: 'moderado', ajusteKcal: 450 } });
  const r2 = CAL.evaluarCheckin({ perfil: p2, pesos: pesos(85, 85.1), comidas7d: comidas(CAL.calorias(p2, opt).kcal), hoyISO: HOY, ...opt });
  t('3 tope +500', r2.nuevoAjuste === 500 && r2.diffKcal === 50, JSON.stringify({ n: r2.nuevoAjuste, d: r2.diffKcal }));
  const p3 = hombre({ objetivos: ['musculo'], ritmoKgSemana: 0.25, nutri: { actividad: 'moderado', ajusteKcal: 500 } });
  const r3 = CAL.evaluarCheckin({ perfil: p3, pesos: pesos(85, 85.1), comidas7d: comidas(CAL.calorias(p3, opt).kcal), hoyISO: HOY, ...opt });
  t('3 ya en el tope → mantener', r3.diffKcal === 0 && r3.motivo === 'tope' && r3.nuevoAjuste === 500);
}

// 4) Suelo de seguridad (mujer en 1200) y zona muerta.
{
  const p = { sexo: 'mujer', edad: 45, alturaCm: 155, objetivos: ['perder'], ritmoKgSemana: 1, nutri: { actividad: 'sedentario' } }, o = { kg: 58, actividad: 'sedentario' };
  const c = CAL.calorias(p, o);
  t('4 en el suelo 1200', c.kcal === 1200, c.kcal);
  const r = CAL.evaluarCheckin({ perfil: p, pesos: pesos(58, 58.05), comidas7d: comidas(1200), hoyISO: HOY, ...o });
  t('4 propone bajar pero el suelo lo impide', r.estado === 'listo' && r.paso < 0 && r.diffKcal === 0 && r.motivo === 'suelo' && r.planNuevo.kcal === 1200 && r.nuevoAjuste === 0, JSON.stringify({ paso: r.paso, m: r.motivo, k: r.planNuevo.kcal }));
  const ph = hombre({ sexo: 'hombre', edad: 60, alturaCm: 165, ritmoKgSemana: 1, nutri: { actividad: 'sedentario' } }), oh = { kg: 62, actividad: 'sedentario' };
  t('4 hombre en el suelo 1500', CAL.calorias(ph, oh).kcal === 1500);
  // Zona muerta: diferencia de gasto de ~60 kcal → paso 30 → mantener.
  const pz = hombre(), cz = CAL.calorias(pz, opt);
  const perdida = (cz.deficit * 7) / 7700 - (60 * 7) / 7700; // pierde algo menos: gasto real 60 kcal por debajo
  const rz = CAL.evaluarCheckin({ perfil: pz, pesos: pesos(85, 85 + perdida), comidas7d: comidas(cz.kcal), hoyISO: HOY, ...opt });
  t('4 zona muerta (< 40) → mantener', rz.paso === 0 && rz.diffKcal === 0 && rz.motivo === 'alineado', JSON.stringify({ paso: rz.paso, d: rz.deltaTdee }));
  // Justo por encima de la zona muerta: 100 kcal → paso −50.
  const p100 = (cz.deficit * 7) / 7700 - (100 * 7) / 7700;
  const r100 = CAL.evaluarCheckin({ perfil: pz, pesos: pesos(85, 85 + p100), comidas7d: comidas(cz.kcal), hoyISO: HOY, ...opt });
  t('4 paso −50 en múltiplos de 10', r100.paso === -50 && r100.diffKcal === -50, r100.paso);
}

// 5) Faltan datos: pesajes y días de comida (los de < 800 kcal no cuentan).
{
  const p = hombre();
  const r = CAL.evaluarCheckin({ perfil: p, pesos: [{ fecha: d(1), kg: 85 }, { fecha: d(9), kg: 85.2 }, { fecha: d(10), kg: 85.3 }], comidas7d: [...comidas(2200, 3), { fecha: d(3), kcal: 600 }, { fecha: d(4), kcal: 799 }], hoyISO: HOY });
  t('5 faltan datos', r.estado === 'faltan_datos' && r.pesajesAct === 1 && r.pesajesAnt === 2 && r.diasComida === 3, JSON.stringify(r));
  const r2 = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85.2), comidas7d: comidas(2200, 3), hoyISO: HOY });
  t('5 solo faltan comidas', r2.estado === 'faltan_datos' && r2.pesajesAct === 2 && r2.diasComida === 3);
  const r3 = CAL.evaluarCheckin({ perfil: p, pesos: [{ fecha: d(14), kg: 85 }, { fecha: d(20), kg: 85 }], comidas7d: [{ fecha: d(8), kcal: 2500 }], hoyISO: HOY });
  t('5 fuera de ventana no cuenta', r3.pesajesAct === 0 && r3.pesajesAnt === 0 && r3.diasComida === 0);
  const r4 = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85.2), comidas7d: [0, 1, 2, 3].map((i) => ({ fecha: d(i), items: [{ k: 500 }, { k: 400 }] })), hoyISO: HOY, ...opt });
  t('5 suma items (900 kcal = válido)', r4.estado === 'listo' && r4.diasComida === 4 && r4.mediaKcal === 900);
}

// 6) Check-in hecho hace 3 días → reciente; hace 7 → vuelve a evaluar.
{
  const p = hombre({ nutri: { actividad: 'moderado', ultimoCheckin: d(3), ajusteKcal: -80 } });
  const r = CAL.evaluarCheckin({ perfil: p, pesos: pesos(85, 85.1), comidas7d: comidas(2000), hoyISO: HOY });
  t('6 reciente', r.estado === 'reciente' && r.diasRestantes === 4 && r.proximoISO === CAL.sumarDias(HOY, 4) && r.ajusteActual === -80, JSON.stringify(r));
  const p7 = hombre({ nutri: { actividad: 'moderado', ultimoCheckin: d(7) } });
  t('6 a los 7 días ya no es reciente', CAL.evaluarCheckin({ perfil: p7, pesos: pesos(85, 85.1), comidas7d: comidas(2000), hoyISO: HOY, ...opt }).estado === 'listo');
}

// Historial: conserva el resto de nutri (actividad) y guarda los últimos 8.
{
  let n = { actividad: 'moderado', historialCheckin: Array.from({ length: 8 }, (_, i) => ({ fecha: d(80 - i * 7) })) };
  n = CAL.nutriTrasCheckin(n, { hoyISO: HOY, kcalAntes: 2000.4, kcalDespues: 1880, ajusteKcal: -120, mediaPeso: 85.04 });
  t('historial: actividad intacta', n.actividad === 'moderado' && n.ajusteKcal === -120 && n.ultimoCheckin === HOY);
  t('historial: 8 como máximo', n.historialCheckin.length === 8 && n.historialCheckin[7].fecha === HOY && n.historialCheckin[7].mediaPeso === 85);
}

console.log(`${ok} OK, ${ko} fallos`);
process.exit(ko ? 1 : 0);
