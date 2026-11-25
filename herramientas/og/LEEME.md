# Imagen Open Graph (`public/og-cadencia.png`, 1200×630)

Plantilla: `og.html` (fondo `#000000`, acento `#F2C116`, tipografía Archivo). Para regenerarla:

1. `npm i --no-save @fontsource-variable/archivo` en la raíz del repo (la plantilla carga la fuente de `node_modules`).
2. Abre `herramientas/og/og.html` en Chrome con la ventana a 1200×630 y haz una captura, o usa Playwright:
   `page.set_viewport_size({'width':1200,'height':630}); page.goto('file://…/herramientas/og/og.html'); page.screenshot(path='public/og-cadencia.png')`.
3. Comprueba que mide exactamente 1200×630.
