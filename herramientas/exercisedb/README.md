# GIF de ExerciseDB (RapidAPI)

Las imágenes de los ejercicios de la biblioteca salen de ExerciseDB (plan Pro de RapidAPI: GIF de 180 y 360 px).
Se descargan **una sola vez** y se sirven desde la propia app (`public/ejercicios/db/`), así no se gastan peticiones ni ancho de banda del plan cada vez que alguien abre un ejercicio.

## Piezas

| Archivo | Para qué |
|---|---|
| `orden.json` | Qué debe hacer el proceso: `{"accion": "catalogo"}` o `{"accion": "gifs"}`. Al cambiar este archivo en la rama `ejercicios-exercisedb` se lanza el proceso de GitHub. Cambia también `intento` para repetir la misma acción. |
| `descargar.mjs` | Hace las peticiones con la clave `RAPIDAPI_KEY` (secreto de GitHub). La clave solo va en la cabecera y nunca se escribe en ningún archivo. |
| `catalogo.json` | Lista completa de ExerciseDB (1.394 ejercicios: id, nombre en inglés, parte del cuerpo, músculo, secundarios, equipo). Sirve para elegir el id de cada ejercicio. |
| `emparejamiento.json` | **Lo que decide la app:** nombre del ejercicio en Cadencia → id de ExerciseDB. |
| `aplicar.mjs` | Copia `emparejamiento.json` a la línea `IMGDB` de `js/ejercicios.js` (`node herramientas/exercisedb/aplicar.mjs`). Falla si falta algún GIF. |
| `../../.github/workflows/exercisedb.yml` | El proceso de GitHub («Descargar ejercicios de ExerciseDB»). Guarda lo descargado en la misma rama. |

## Añadir ejercicios

1. Busca el id en `catalogo.json` (por ejemplo, `dumbbell lateral raise` → `0334`) y añade `"Nombre en la app": "id"` a `emparejamiento.json`. El nombre debe ser **exactamente** el de la biblioteca.
2. Pon `{"accion": "gifs", "intento": N+1}` en `orden.json`, haz commit y push a la rama. El proceso baja los GIF que falten (180 y 360 px de cada id) y los guarda en `public/ejercicios/db/`.
3. `git pull`, `node herramientas/exercisedb/aplicar.mjs`, compila y prueba.

## Cifras del plan (17-11-2026)

2.300 peticiones al mes (extra: 0,001 $), 120 por minuto, 10 GB de ancho de banda al mes. El catálogo completo cuesta 15 peticiones; cada ejercicio nuevo, 2 (una por resolución).

## Notas

- La lista de ExerciseDB ya **no trae `gifUrl`**: el GIF sale de `GET https://exercisedb.p.rapidapi.com/image?exerciseId=<id>&resolution=<180|360>` con la cabecera `x-rapidapi-key`. Una etiqueta `<img>` no puede mandar esa cabecera, por eso se descargan y se alojan aquí.
- Los GIF traen **fondo blanco**: en la app se ven como una lámina blanca con esquinas redondeadas (clase `.exdb`).
- Si un id no existe, el proceso falla y lo dice en el registro (Actions); no se guarda nada a medias.
