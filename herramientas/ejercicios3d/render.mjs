// Genera las imágenes de los ejercicios definidos en ejercicios/*.json para cada modelo.
// Uso:  node herramientas/ejercicios3d/render.mjs [id …]      (sin ids: todos menos los prueba-*)
// Opciones por variable de entorno: MODELOS=hombre-1,mujer-1  TAM=800x1000  FMT=webp|png  PLAYWRIGHT=<ruta a playwright>
// Necesita `npm ci` (three) y Playwright con Chromium. Las imágenes salen en herramientas/ejercicios3d/salida/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '../..');
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const puerto = srv.address().port;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(AQUI, 'ejercicios')).filter((f) => f.endsWith('.json') && !f.startsWith('prueba-')).map((f) => f.slice(0, -5));
const modelos = (process.env.MODELOS || 'hombre-1,mujer-1').split(',');
const [w, h] = (process.env.TAM || '800x1000').split('x').map(Number), fmt = process.env.FMT || 'webp';
const corto = { 'hombre-1': 'h', 'mujer-1': 'm' };
const nav = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
fs.mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
for (const id of ids) for (const m of modelos) {
  const p = await nav.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => console.log('ERROR', id, m, e.message));
  await p.goto(`http://localhost:${puerto}/herramientas/ejercicios3d/render.html?ej=${id}&m=${m}&w=${w}&h=${h}&fmt=${fmt}`);
  await p.waitForFunction('document.title==="ok"', null, { timeout: 300000 });
  const out = await p.evaluate(() => window.__out);
  for (const [fase, url] of Object.entries(out)) {
    const dst = path.join(AQUI, 'salida', `${id}-${corto[m] || m}-${fase}.${fmt}`);
    fs.writeFileSync(dst, Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', path.relative(RAIZ, dst), Math.round(fs.statSync(dst).size / 1024) + ' KB');
  }
  await p.close();
}
await nav.close(); srv.close();
