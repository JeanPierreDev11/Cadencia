# Mapa de fatiga 3D (prueba, sin conectar a la app)
- `cuerpo.glb`: modelo del usuario reducido (solo forma + mapa de relieve 1024, 437 KB). El original (7 MB) lo tiene el usuario.
- `zonas.png`: mapa de zonas musculares en la UV del modelo (2048, 8 bits). Valor = `músculo*2 + lado` con músculos en el orden de `NAMES` de `seg.py` (none, ne, sh, ch, bi, fo, ab, abd, qu, ad, ca, tp, mb, la, lb, tr, gl, ha: las mismas claves que `BODY` en `js/entreno-ui.js`).
- `seg.py` genera `zonas.png` desde el GLB original (reglas anatómicas sobre coordenadas); `build.py` genera `cuerpo.glb`. `load.py` lee el GLB. Ajustar `label()` para mover los bordes.
- `demo-main.js` / `demo-index.html`: visor three.js que colorea cada zona por % de fatiga leyendo `zonas.png` en el shader.
