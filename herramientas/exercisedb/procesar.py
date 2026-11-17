#!/usr/bin/env python3
"""Quita el fondo blanco de un GIF de ExerciseDB y lo guarda como WebP animado (fondo transparente)
más una imagen quieta pequeña (primer fotograma) para las listas.

Uso: procesar.py entrada.gif salida-360.webp salida-180.webp
Necesita: pillow, numpy, scipy.
"""
import sys
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage as ndi

BLANCO = 247      # canal >= BLANCO se considera fondo
MINIMO = 1500     # una mancha blanca interior (no pegada al borde) solo se quita si es muy grande; los brillos de la piel se conservan


def fotograma(rgb: np.ndarray) -> np.ndarray:
    """RGB (alto, ancho, 3) uint8 → RGBA con el fondo blanco transparente."""
    blanco = (rgb >= BLANCO).all(axis=2)
    etiquetas, n = ndi.label(blanco)
    if n:
        tam = ndi.sum(blanco, etiquetas, index=np.arange(1, n + 1))
        borde = np.unique(np.concatenate([etiquetas[0], etiquetas[-1], etiquetas[:, 0], etiquetas[:, -1]]))
        quitar = np.zeros(n + 1, bool)
        quitar[1:] = tam >= MINIMO
        quitar[borde[borde > 0]] = True
        fondo = quitar[etiquetas] & blanco
    else:
        fondo = blanco
    # borde suave: los píxeles casi blancos junto al fondo se vuelven semitransparentes
    lum = rgb.astype(np.float32).mean(axis=2)
    cerca = ndi.binary_dilation(fondo, iterations=2) & ~fondo
    a = np.ones(lum.shape, np.float32)
    a[fondo] = 0.0
    t = np.clip((250.0 - lum) / (250.0 - 200.0), 0.0, 1.0)
    a[cerca] = np.minimum(1.0, t[cerca])
    # quitar el tinte blanco del borde: color = (c - 255·(1-a)) / a
    rgbf = rgb.astype(np.float32)
    aa = np.maximum(a, 0.05)[..., None]
    sin = np.clip((rgbf - 255.0 * (1.0 - aa)) / aa, 0, 255)
    rgbf = np.where(cerca[..., None], sin, rgbf)
    return np.dstack([rgbf.astype(np.uint8), (a * 255).astype(np.uint8)])


def main(entrada, sal360, sal180):
    gif = Image.open(entrada)
    cuadros, tiempos = [], []
    for f in ImageSequence.Iterator(gif):
        rgb = np.asarray(f.convert("RGB"))
        cuadros.append(Image.fromarray(fotograma(rgb), "RGBA"))
        tiempos.append(f.info.get("duration", gif.info.get("duration", 100)) or 100)
    cuadros[0].save(sal360, save_all=True, append_images=cuadros[1:], duration=tiempos, loop=0,
                    quality=65, alpha_quality=80, method=6, lossless=False)
    cuadros[0].resize((180, 180), Image.LANCZOS).save(sal180, quality=75, alpha_quality=80, method=6)


if __name__ == "__main__":
    main(*sys.argv[1:4])
