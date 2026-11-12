// Compilación de Cadencia con Vite.
//   npm run dev     → servidor local con recarga (http://localhost:5173)
//   npm run build   → carpeta dist/ minificada y ofuscada, lista para Firebase Hosting
//
// - public/ (manifest.webmanifest e icons/) se copia tal cual a dist/.
// - sw.js (service worker) se genera en dist/ con la lista real de archivos y una versión nueva en cada build.
// - Todo nuestro JS se ofusca con javascript-obfuscator (menos js/vendor/zxing.js, que es una librería de terceros).
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import JavaScriptObfuscator from 'javascript-obfuscator';

// Ajustes de ofuscación: fuertes pero sin las opciones que ralentizan la app en el móvil
// (controlFlowFlattening / deadCodeInjection) ni las que suelen romper código (renameGlobals / selfDefending).
const OFUSCAR = {
  compact: true,
  target: 'browser',
  sourceMap: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  numbersToExpressions: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  splitStrings: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
};

function ofuscar() {
  return {
    name: 'cadencia-ofuscar',
    apply: 'build',
    renderChunk(code, chunk) {
      // zxing es una librería pública (MIT/Apache): no merece la pena ofuscarla y es muy grande.
      if (chunk.facadeModuleId && chunk.facadeModuleId.includes('/vendor/')) return null;
      const r = JavaScriptObfuscator.obfuscate(code, { ...OFUSCAR, sourceType: 'module' });
      return { code: r.getObfuscatedCode(), map: null };
    },
  };
}

// Genera dist/sw.js: rellena SHELL con todos los archivos del build y VERSION con una huella del contenido.
// Así cada publicación actualiza los móviles sola (ya no hay que subir «cadencia-vNN» a mano).
function serviceWorker() {
  return {
    name: 'cadencia-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const publicos = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const propios = Object.keys(bundle).filter((f) => !f.includes('zxing') && !f.endsWith('.map') && f !== 'index.html');
      const archivos = ['./', './index.html', ...[...propios, ...publicos].map((f) => './' + f)];
      const huella = createHash('sha256').update(archivos.join('|')).digest('hex').slice(0, 10);
      let sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
      sw = sw
        .replace("const VERSION = 'cadencia-dev';", `const VERSION = 'cadencia-${huella}';`)
        .replace("const SHELL = ['./', './index.html'];", `const SHELL = ${JSON.stringify(archivos)};`);
      if (!sw.includes(`cadencia-${huella}`)) this.error('sw.js: no encuentro las líneas VERSION/SHELL para rellenar');
      const min = JavaScriptObfuscator.obfuscate(sw, { ...OFUSCAR, sourceType: 'script', stringArray: false, numbersToExpressions: false });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: min.getObfuscatedCode() });
    },
  };
}

export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [ofuscar(), serviceWorker()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false, // sin mapas: así nadie puede reconstruir el código original desde el navegador
    minify: 'esbuild',
    cssMinify: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
  },
  esbuild: {
    legalComments: 'none',
  },
  server: { port: 5173 },
});
