# ExerciseDB (RapidAPI): ejercicios e imágenes

La biblioteca de Cadencia usa ExerciseDB (plan Pro de RapidAPI) para el **catálogo de ejercicios y sus animaciones**.
Todo se descarga **una sola vez** y se sirve desde la propia app (`public/ejercicios/db/`), así no se gastan peticiones ni ancho de banda del plan cada vez que alguien abre un ejercicio.
El mapa de fatiga muscular y «entrenado esta semana» siguen con nuestro modelo 3D propio.

## Piezas

| Archivo | Para qué |
|---|---|
| `orden.json` | Qué debe hacer el proceso: `catalogo` (lista de ejercicios), `gifs` (solo los de `emparejamiento.json`) o `todos` (todo el catálogo). Al cambiar este archivo en la rama `ejercicios-exercisedb` se lanza el proceso de GitHub; cambia `intento` para repetir la misma acción. |
| `descargar.mjs` | Hace las peticiones con la clave `RAPIDAPI_KEY` (secreto de GitHub). La clave solo va en la cabecera y nunca se escribe en ningún archivo. Salta lo que ya está descargado. |
| `procesar.py` | Convierte cada GIF (fondo blanco) en un WebP **con fondo transparente**: animado de 360 px (ficha) y un fotograma fijo de 180 px (listas). Así la figura toma el color de la tarjeta en modo claro y oscuro. |
| `catalogo.json` | Lista completa de ExerciseDB (1.394 ejercicios: id, nombre en inglés, parte del cuerpo, músculo, secundarios, equipo). |
| `nombres-es.json` | Nombre en español de cada ejercicio nuevo (id → nombre). |
| `emparejamiento.json` | Ejercicios **principales** de la app (los de la tabla `TABLA`), revisados a mano: nombre en Cadencia → id de ExerciseDB. |
| `emparejamiento-auto.json` | Resto de ejercicios que ya tenía la app y coinciden claramente con uno de ExerciseDB: nombre → id. |
| `duplicados.json` | Antiguos que son **el mismo ejercicio** que uno de ExerciseDB (revisados a mano, 17-11-2026). `principales`: siguen con su nombre y toman la imagen. `viejos`: se quitaron de `js/ejercicios.js` y su nombre queda como alias del nuevo (`VIEJOS` en `ejercicios-db.js` → `ALIAS_VIEJOS` en `entreno.js`), así el historial, las rutinas y los favoritos guardados con el nombre antiguo siguen enlazados. |
| `generar.mjs` | Crea `js/ejercicios-db.js` (`node herramientas/exercisedb/generar.mjs`): el mapa nombre → id y los ejercicios nuevos con grupo, equipo y músculos. |
| `fallos.json` | Ids que no se pudieron descargar en la última ejecución (si hay). |
| `../../.github/workflows/exercisedb.yml` | El proceso de GitHub («Descargar ejercicios de ExerciseDB»). Guarda lo descargado en la misma rama. |

## Cómo se ven en la app

- Los ejercicios con id en `IMGDB` (js/ejercicios-db.js) muestran `public/ejercicios/db/<id>-180.webp` en listas y miniaturas y `<id>-360.webp` (animado) en la ficha. Los demás dibujan la figura anatómica propia.
- Los ejercicios nuevos (`DBX`) entran en la biblioteca con su nombre en español; el buscador también entiende el nombre en inglés.
- Los nombres ya usados en entrenos y rutinas **no se cambian nunca** (el historial guarda el nombre).

## Rehacer o ampliar

1. Edita `nombres-es.json` / `emparejamiento*.json` si hace falta.
2. `node herramientas/exercisedb/generar.mjs` y compila.
3. Si hay ids nuevos sin imagen: pon `{"accion": "todos", "intento": N+1}` en `orden.json`, haz commit y push a la rama `ejercicios-exercisedb`; el proceso baja solo lo que falte.

## Cifras del plan (17-11-2026)

2.300 peticiones al mes (extra: 0,001 $), 120 por minuto, 10 GB de ancho de banda al mes. El catálogo cuesta 15 peticiones; cada ejercicio, 1 (se pide solo la resolución 360 y la de 180 se saca de ella). Bajar todo (1.394) gasta ~1.400 peticiones: no repetir sin necesidad.

## Notas

- La lista de ExerciseDB ya **no trae `gifUrl`**: la imagen sale de `GET https://exercisedb.p.rapidapi.com/image?exerciseId=<id>&resolution=360` con la cabecera `x-rapidapi-key`. Una etiqueta `<img>` no puede mandar esa cabecera, por eso se descargan y se alojan aquí. El plan llega como máximo a 360 px.
- El servidor de este asistente no alcanza rapidapi.com: la descarga corre siempre en GitHub Actions.
- Las imágenes llevan caché larga (`firebase.json`) y el service worker las guarda la primera vez que se ven.
