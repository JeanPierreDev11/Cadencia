# Ilustraciones 3D de ejercicios

Imágenes de cada ejercicio (inicio y final) hechas con los mismos cuerpos 3D de la app (`public/models/hombre-1.glb`, `mujer-1.glb`), ahora con **esqueleto** para poder ponerlos en cualquier postura y con el equipamiento dibujado (mancuernas, polea, máquinas…). Las zonas trabajadas salen resaltadas con la misma textura de zonas de la app.

Nada de esto se carga en la app: aquí solo se **generan** imágenes WebP (≈40 KB cada una) que luego se conectan en `IMG3D` (`js/ejercicios.js`).

## Piezas

| Archivo | Qué hace |
|---|---|
| `rig/cfg-<modelo>.json` | Articulaciones medidas sobre cada modelo (coordenadas glTF: x derecha, y arriba, z delante, metros). La mujer tiene lado izquierdo y derecho propios porque su modelo no es simétrico. |
| `rig/articulaciones.py` | cfg → `modelos/<modelo>-rig.json` (52 huesos: columna, cuello, cabeza, clavículas, brazos, manos con 5 dedos de 3 falanges, piernas, pies). Detecta los dedos solo si el cfg trae `hand`. |
| `rig/construir.py` | Con Blender como módulo de Python (`pip install bpy==5.3.0`): crea la armadura, calcula los pesos de piel (método de calor sobre la malla soldada) y exporta `modelos/<modelo>-rig.glb`. Después recorta el peso de brazo y clavícula por distancia al hueso (el calor lo reparte por todo el pecho y la espalda y al subir el brazo se estiraba el costado). Texturas > 2048 px se bajan a 2048 y se exportan en WebP. |
| `rig/preparar-hombre-2.py` | `hombre-2` es el cuerpo musculado nuevo (8.425 vértices, anatomía muy marcada). Viene de un GLB con rig automático de 24 huesos sin dedos: este script le quita ese rig, lo escala a 1,9 m y lo centra. Su cfg tiene lado izquierdo y derecho propios (brazo y pierna izquierdos echados hacia atrás, pie hacia fuera). |
| `poser.js` | Motor de poses. Las poses se escriben en **grados anatómicos** respecto a una postura neutra común (de pie, brazos colgando, palmas al muslo, dedos estirados), así que **el mismo ejercicio sirve para los dos modelos** aunque en reposo estén distintos. |
| `equipo.js` | Equipamiento procedural que se coloca solo a partir del cuerpo posado (agarre de las manos, hombros, codos). |
| `ejercicios/<id>.json` | Un ejercicio: zonas, cámara, equipo y fases. |
| `render.html` + `render.mjs` | Renderizado por lotes (Chromium sin pantalla) → `salida/<id>-<h|m>-<fase>.webp`. |

## Generar imágenes

```bash
npm ci                                   # three
node herramientas/ejercicios3d/render.mjs                 # todos los ejercicios
node herramientas/ejercicios3d/render.mjs elevacion-lateral-polea
# variables: MODELOS=hombre-1  TAM=800x1000  FMT=png  PLAYWRIGHT=<ruta a playwright si no está instalado en el proyecto>
```

## Escribir un ejercicio

```json
{ "id": "elevacion-lateral-mancuerna", "app": "Elevaciones laterales",
  "zonas": { "principales": ["sh"], "secundarias": ["tp"] },
  "camara": { "yaw": 28, "pitch": 5, "fov": 24 },
  "equipo": [ { "tipo": "mancuerna" } ],
  "fases": {
    "inicio": { "hombro": { "elev": 14, "plano": 22 }, "codo": { "flex": 14 }, "mano": "agarre" },
    "fin":    { "hombro": { "elev": 86, "plano": 22 }, "codo": { "flex": 14 }, "mano": "agarre" } } }
```

Cada articulación acepta un valor para los dos lados o `{ "R": …, "L": … }` (R = derecha del modelo).

| Clave | Campos (grados) | Notas |
|---|---|---|
| `hombro` | `elev` (0 colgando, 90 horizontal, 180 arriba), `plano` (0 lateral, 90 al frente, negativo detrás), `rot` (rotación del brazo), `mundo: true` | Con `mundo` la dirección es respecto al suelo (brazos colgando con el tronco inclinado). La clavícula acompaña sola al subir el brazo. |
| `codo` | `flex`, `pron` (pronación del antebrazo) | |
| `muneca` | `flex`, `desv` | |
| `mano` | `"agarre"`, `"abierta"`, `"relajada"`, `"apoyo"` o `{ mcp, pip, dip, pulgar, sep }` | `agarre` cierra el puño alrededor de un mango (mancuerna, polea, barra). |
| `pelvis` | `flex` | Bisagra de cadera: inclina todo el cuerpo desde la pelvis (peso muerto, remo). Acompáñalo con `cadera.flex` para que los muslos sigan verticales. |
| `cadera` | `flex`, `abd`, `rot` | |
| `rodilla` | `flex` | |
| `tobillo` | `flex` | |
| `tronco` | `flex`, `lat`, `rot` | Se reparte entre las tres vértebras. |
| `cuello` | `flex`, `lat`, `rot` | |
| `raiz` | `pos: [x,y,z]`, `rot: [x,y,z]`, `plantar`, `piesPlanos` | De pie se aplican solos `plantar` (los pies no se mueven del sitio) y `piesPlanos`. `rot: [90,0,0]` tumba boca abajo. |

Nivel del ejercicio: `"sentado": true` calcula la altura del asiento bajo los glúteos.

Equipo disponible: `mancuerna` (`manos: ["R","L"]`), `polea` (`mano`, `torre: [x,z]`, `alturaPolea`), `maquina-laterales`. Para otros (barra, banco, jalón, prensa…) se añade una función en `equipo.js` que coloque las piezas a partir de `c.agarre(lado)` y `c.estado.cab[hueso]` (posición de cada articulación ya posada).

`ejercicios/prueba-poses.json` es una hoja de pruebas (sentadilla, peso muerto, remo, press, curl, zancada, plancha) para comprobar que el esqueleto aguanta otros movimientos: `node herramientas/ejercicios3d/render.mjs prueba-poses`.

## Límites conocidos

- Las mallas son de baja resolución (~5.000 triángulos): en flexiones extremas (cadera > 100°, brazo por encima de la cabeza) se ven algunos pliegues en axila e ingle.
- La mano de `mujer-1` tiene los dedos casi unidos en la malla: el puño queda bien, pero posturas finas de dedos (señalar, abrir uno a uno) no.
- `hombre-2` aún **no tiene mapa de zonas** (`zonas-hombre-2.png`, depende de sus UV): se renderiza sin resaltar músculos. Para usarlo en la app hay que crearlo (p. ej. transfiriendo las zonas de `hombre-1` por cercanía) y subir su GLB de origen (9 MB) o su versión ligera.
- Si se cambia un modelo de `public/models`, hay que volver a medir el cfg y repetir `articulaciones.py` + `construir.py`.
