// Trazados ORIENTATIVOS de las 6 rutas de Bilbao, para dibujarlas en el mapa.
// Son puntos de paso aproximados (no un track real): sirven para ver por dónde va cada salida.
// Cuando tengas el GPX real de una ruta, súbelo con «Subir ruta GPX» y se dibuja exacto.
const P = {
  ria: [ // Bilbao → Getxo por la margen derecha de la ría (ida y vuelta por el mismo sitio)
    [43.2630, -2.9350], [43.2655, -2.9420], [43.2700, -2.9490], [43.2760, -2.9560], [43.2850, -2.9640], [43.2950, -2.9700],
    [43.3030, -2.9740], [43.3100, -2.9830], [43.3170, -2.9950], [43.3235, -3.0070], [43.3265, -3.0170], [43.3330, -3.0190],
    [43.3410, -3.0150], [43.3470, -3.0140],
  ],
  'uribe-kosta': [ // Getxo → costa de Sopela y Plentzia → vuelta por el interior
    [43.2630, -2.9350], [43.2760, -2.9560], [43.2950, -2.9700], [43.3100, -2.9830], [43.3235, -3.0070], [43.3330, -3.0190],
    [43.3470, -3.0140], [43.3600, -3.0180], [43.3700, -3.0150], [43.3735, -3.0090], [43.3780, -3.0000], [43.3800, -2.9860],
    [43.3870, -2.9740], [43.3960, -2.9580], [43.4045, -2.9470], [43.4120, -2.9400], [43.3900, -2.9330], [43.3560, -2.9300],
    [43.3300, -2.9500], [43.3040, -2.9560], [43.2850, -2.9440], [43.2630, -2.9350],
  ],
  'vivero-unbe': [ // Rompepiernas al nordeste de Bilbao: Derio, Larrabetzu, Unbe, Mungia y vuelta por El Vivero
    [43.2630, -2.9350], [43.2800, -2.9200], [43.2990, -2.8800], [43.2900, -2.8450], [43.2800, -2.8200], [43.2950, -2.8030],
    [43.3050, -2.8050], [43.3300, -2.8000], [43.3550, -2.8500], [43.3500, -2.8900], [43.3250, -2.9300], [43.3000, -2.9400],
    [43.2630, -2.9350],
  ],
  sollube: [ // Bilbao → Mungia → puerto de Sollube → Bakio → vuelta por Gatika
    [43.2630, -2.9350], [43.2800, -2.9200], [43.2990, -2.8800], [43.3300, -2.8650], [43.3550, -2.8500], [43.3700, -2.8350],
    [43.3870, -2.8130], [43.4100, -2.8100], [43.4290, -2.8110], [43.4100, -2.8450], [43.3800, -2.8650], [43.3690, -2.8910],
    [43.3400, -2.9050], [43.3000, -2.9300], [43.2630, -2.9350],
  ],
  oiz: [ // Bilbao → Galdakao → Amorebieta → Iurreta → cima de Oiz → vuelta por Durango
    [43.2630, -2.9350], [43.2400, -2.8800], [43.2290, -2.8430], [43.2200, -2.7800], [43.2150, -2.7320], [43.1950, -2.6800],
    [43.1700, -2.6250], [43.1750, -2.6000], [43.1830, -2.5820], [43.1780, -2.6050], [43.1690, -2.6330], [43.1950, -2.6900],
    [43.2150, -2.7350], [43.2290, -2.8430], [43.2400, -2.8800], [43.2630, -2.9350],
  ],
  'urkiola-barazar': [ // Bilbao → Barazar → Durango → Urkiola → vuelta por Amorebieta
    [43.2630, -2.9350], [43.2400, -2.9000], [43.2110, -2.8860], [43.1900, -2.8300], [43.1700, -2.7650], [43.1700, -2.7000],
    [43.1700, -2.6350], [43.1350, -2.6350], [43.0990, -2.6400], [43.1250, -2.6000], [43.1550, -2.5900], [43.1700, -2.6350],
    [43.2000, -2.6900], [43.2150, -2.7350], [43.2290, -2.8430], [43.2630, -2.9350],
  ],
};

// Suaviza los puntos de paso con una curva (Catmull-Rom) para que la línea no se vea tan quebrada.
function suavizar(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function trazado(id) { return P[id] ? suavizar(P[id]) : null; }
// Rutas que vuelven por el mismo camino (se avisa en el mapa).
export const IDA_Y_VUELTA = new Set(['ria']);
