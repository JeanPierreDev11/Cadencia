# Playwright (iPhone 13, modo prueba): récords personales y tarjeta 9:16 (79).
# Requiere `npx vite --port 5173 --host 127.0.0.1` con FIREBASE_CONFIG = null en js/config.js.
import json, time, base64, datetime as dt
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5173/'
EMAIL = 'ana@prueba.es'
HOY = dt.date.today()

def seed(theme, pro, vivo):
    ws = {}
    def w(i, dias, ejs):
        ws[i] = {'id': i, 'fecha': (HOY - dt.timedelta(days=dias)).isoformat(), 'tipo': 'gym', 'nombre': 'Torso', 'min': 55, 'ejercicios': ejs}
    def ej(n, kg, reps, **x):
        return {'n': n, 'carga': 'total', 'series': [{'kg': kg, 'reps': reps}], **x}
    w('a', 14, [ej('Press banca', 100, 5), ej('Sentadilla con barra', 120, 5)])
    w('b', 7, [ej('Press banca', 100, 6)])
    rut = {'id': 'r1', 'nombre': 'Mi rutina', 'tipos': ['fuerza'], 'dias': [0, 1, 2, 3, 4, 5, 6], 'modo': 'propuesta', 'split': 'auto', 'exp': 'anio', 'equipo': None, 'eqSel': [], 'donde': ['gym'], 'flex': False, 'deporte': '',
           'sesiones': {str(i): {'t': 'fuerza', 'nombre': 'Torso', 'foco': 'push', 'ej': [{'n': 'Press banca', 'm': 'pecho', 'series': 3, 'reps': '8-12'}]} for i in range(7)}}
    st = {'session': EMAIL, 'users': {EMAIL: {'uid': 'u1', 'email': EMAIL, 'pass': 'x', 'profile': {
        'nombre': 'Ana', 'usuario': 'ana', 'sexo': 'mujer', 'edad': 30, 'alturaCm': 165, 'pesoKg': 62, 'objetivos': ['musculo'],
        'onboarded': True, 'onboardingCompletado': True, 'onboardingVersion': 2, 'isPro': pro, 'proPlan': 'anual' if pro else 'none', 'novVista': 99,
        'rutina': rut, 'rutinas': [rut]}, 'pesos': {}, 'entrenos': ws}}}
    js = f"if (!sessionStorage.getItem('s')) {{ localStorage.setItem('cadencia-local-v1', {json.dumps(json.dumps(st))}); sessionStorage.setItem('s', '1');"
    if vivo:
        def lx(n, kg, reps):
            return {'n': n, 'm': 'pecho', 'obj': '', 'objReps': '', 'uni': False, 'superset': False, 'prev': [], 's': [{'kg': kg, 'reps': reps, 'done': False, 'rir': '', 'dropset': False}]}
        live = {'uid': 'u1', 'fecha': HOY.isoformat(), 'start': int(time.time() * 1000) - 1800000, 'nombre': 'Torso', 'foco': '', 'custom': True, 'modo': 'guiado', 'msg': '',
                'ex': [lx('Press banca', '102,5', '6'), lx('Sentadilla con barra', '122,5', '5')]}
        js += f" localStorage.setItem('cadencia-live', {json.dumps(json.dumps(live))});"
    return js + f" }} localStorage.setItem('cadencia-theme', '{theme}'); localStorage.setItem('cadencia-tab', 'entreno'); localStorage.setItem('cadencia-wktab', 'records');"

fallos, oks = [], 0
def check(nombre, cond, extra=''):
    global oks
    if cond: oks += 1
    else: fallos.append(f'{nombre} {extra}')

# Píxeles de la vista previa: [colores distintos, píxeles amarillos, alfa de la esquina]
PIX = """() => { const c = document.querySelector('canvas[data-cp-pr]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const col = new Set(); let am = 0; for (let i = 0; i < d.length; i += 4) { if (d[i+3] > 200) { col.add((d[i]>>4)*256 + (d[i+1]>>4)*16 + (d[i+2]>>4)); if (Math.abs(d[i]-242) < 12 && Math.abs(d[i+1]-193) < 12 && d[i+2] < 50) am++; } }
  return [col.size, am, d[3], c.width, c.height]; }"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def abrir(theme, pro, vivo):
        ctx = b.new_context(**p.devices['iPhone 13'], accept_downloads=True)
        ctx.add_init_script(seed(theme, pro, vivo))
        pg = ctx.new_page()
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.goto(URL); time.sleep(2.5)
        pg.evaluate("() => { for (const s of ['nov-ok', 'pro-welcome-close']) { const n = document.querySelector('[data-act=' + s + ']'); if (n) n.click(); } }"); time.sleep(0.5)
        for _ in range(6):
            if pg.query_selector('.sheet-back[data-act="rec-ask-no"]'):
                pg.evaluate("() => document.querySelector('.sheet-back[data-act=\"rec-ask-no\"]').click()"); time.sleep(1.0); break
            time.sleep(0.5)
        pg.add_style_tag(content='.ib{display:none!important}')
        return ctx, pg, errores
    def ancho(pg, donde): check(f'scrollWidth {donde}', pg.evaluate('document.documentElement.scrollWidth') == 390, pg.evaluate('document.documentElement.scrollWidth'))
    def tactil(pg, sel, donde):
        cajas = [e.bounding_box() for e in pg.query_selector_all(sel)]
        check(f'>= 44 px {donde} {sel}', cajas and all(c['height'] >= 43.9 and c['width'] >= 43.9 for c in cajas), cajas[:3])
    def entera(pg, donde): # la tarjeta y los botones caben sin desplazar la hoja
        m = pg.eval_on_selector('.cp-sheet .cp-body', 'e => [e.scrollHeight, e.clientHeight]')
        check(f'{donde}: tarjeta entera a la vista', m[0] <= m[1] + 1, m)
    def png(pg, destino):
        with pg.expect_download() as d: pg.click('.cp-sheet [data-act="cp-guardar"]')
        d.value.save_as(destino)
        return d.value.suggested_filename

    def terminar(pg):
        pg.click('[data-act="live-open"]'); time.sleep(1.0)
        n = len(pg.query_selector_all('[data-act="live-done"]'))
        for i in range(n):
            pg.evaluate("(i) => document.querySelectorAll('[data-act=live-done]')[i].click()", i); time.sleep(0.3)
        pg.evaluate("() => document.querySelector('[data-act=live-fin]').click()"); time.sleep(0.8)
        pg.click('[data-act="fin-ok"]'); time.sleep(2.0)

    for theme in ['dark', 'light']:
        # 1 · Récords → tarjeta
        ctx, pg, errores = abrir(theme, False, False)
        for _ in range(2):
            for h in pg.query_selector_all('.rec-head[aria-expanded="false"]'): h.click(); time.sleep(0.2)
        check(f'{theme}: botón compartir por fila', len(pg.query_selector_all('.rec-share')) >= 1 and not pg.query_selector('button button'))
        tactil(pg, '.rec-acc.open .rec-share', theme); ancho(pg, f'{theme} records')
        pg.screenshot(path=f'/tmp/pr-records-{theme}.png')
        pg.click('.rec-share[data-n="press banca" i]'); time.sleep(1.5)
        check(f'{theme}: hoja de récord', pg.query_selector('.cp-sheet.cp-pr canvas[data-cp-pr]') is not None and pg.query_selector('.cp-modos') is None)
        alt = pg.get_attribute('canvas[data-cp-pr]', 'aria-label')
        check(f'{theme}: textos', 'RÉCORD PERSONAL. ' in alt and 'NUEVO' not in alt and '100 KG × 6' in alt and 'Mejor marca registrada' in alt, alt)
        px = pg.evaluate(PIX)
        check(f'{theme}: canvas 9:16 dibujado (oscuro)', px[0] > 8 and px[1] > 200 and px[2] == 255 and abs(px[4] / px[3] - 16 / 9) < .01, px)
        tactil(pg, '.cp-sheet .cp-pr-fondos button, .cp-sheet .cp-act, .cp-sheet .sheet-head .iconbtn', theme); ancho(pg, f'{theme} tarjeta')
        pg.screenshot(path=f'/tmp/pr-hoja-{theme}.png')
        entera(pg, theme)
        nombre = png(pg, f'/tmp/pr-oscuro-{theme}.png'); time.sleep(0.5)
        check(f'{theme}: nombre del PNG', nombre.startswith('cadencia-record-') and nombre.endswith('.png'), nombre)
        pg.click('.cp-sheet [data-act="cp-bg"][data-v="transparente"]'); time.sleep(0.8)
        px = pg.evaluate(PIX)
        check(f'{theme}: canvas transparente dibujado', px[1] > 200 and px[2] == 0, px)
        check(f'{theme}: cuadrícula detrás', 'gradient' in pg.eval_on_selector('.cp-pr .cp-frame', 'e => getComputedStyle(e).backgroundImage'))
        pg.screenshot(path=f'/tmp/pr-hoja-trans-{theme}.png')
        png(pg, f'/tmp/pr-trans-{theme}.png'); time.sleep(0.5)
        pg.click('.cp-sheet [data-act="cp-bg"][data-v="oscuro"]'); time.sleep(0.6)
        check(f'{theme}: vuelve a oscuro', pg.evaluate(PIX)[2] == 255)
        pg.keyboard.press('Escape'); time.sleep(1.0)
        check(f'{theme}: cierra con Escape', pg.query_selector('.cp-sheet') is None and not pg.evaluate("document.body.classList.contains('noscroll')"))
        # desde la progresión: cerrar la tarjeta vuelve a la progresión
        pg.click('.rec-prog[data-n="press banca" i]'); time.sleep(0.8)
        tactil(pg, '.prog-share', theme)
        pg.screenshot(path=f'/tmp/pr-prog-{theme}.png')
        pg.click('.prog-share'); time.sleep(1.0)
        check(f'{theme}: tarjeta desde progresión', pg.query_selector('canvas[data-cp-pr]') is not None)
        pg.keyboard.press('Escape'); time.sleep(1.0)
        check(f'{theme}: Escape vuelve a la progresión', pg.query_selector('.cp-sheet') is None and pg.query_selector('.prog-sheet') is not None)
        check(f'{theme}: 0 errores (récords)', not errores, errores); ctx.close()

        # 2 · Terminar entreno (gratis): se abre en «Récord (PR)»
        ctx, pg, errores = abrir(theme, False, True)
        terminar(pg)
        check(f'{theme}: gratis abre en Récord (PR)', pg.query_selector('.cp-modos [data-v="pr"][aria-pressed="true"]') is not None and pg.query_selector('canvas[data-cp-pr]') is not None)
        chips = [e.inner_text() for e in pg.query_selector_all('.cp-prs button')]
        check(f'{theme}: selector con los dos ejercicios', len(chips) == 2, chips)
        alt = lambda: pg.get_attribute('canvas[data-cp-pr]', 'aria-label')
        a0 = alt()
        check(f'{theme}: nuevo récord con delta', 'NUEVO RÉCORD PERSONAL' in a0 and '102,5 KG × 6' in a0 and '+2,5 kg vs. marca anterior' in a0, a0)
        tactil(pg, '.cp-prs button, .cp-modos button', theme); ancho(pg, f'{theme} fin')
        pg.screenshot(path=f'/tmp/pr-fin-{theme}.png')
        entera(pg, theme)
        png(pg, f'/tmp/pr-nuevo-{theme}.png'); time.sleep(0.5)
        pg.click('.cp-prs [data-v="1"]'); time.sleep(0.6)
        check(f'{theme}: alterna ejercicio', alt() != a0 and '122,5 KG × 5' in alt(), alt())
        pg.click('.cp-modos [data-v="entreno"]'); time.sleep(1.5)
        check(f'{theme}: pestaña Entreno', len(pg.query_selector_all('canvas[data-cp]')) == 4 and pg.query_selector('canvas[data-cp-pr]') is None)
        pg.screenshot(path=f'/tmp/pr-tab-entreno-{theme}.png')
        pg.click('.cp-modos [data-v="pr"]'); time.sleep(0.8)
        check(f'{theme}: vuelve a PR', pg.query_selector('canvas[data-cp-pr]') is not None)
        check(f'{theme}: 0 errores (gratis)', not errores, errores); ctx.close()

        # 3 · Terminar entreno (Pro): bloque en «Entreno guardado»
        ctx, pg, errores = abrir(theme, True, True)
        terminar(pg)
        bloque = pg.query_selector('.sum-pr')
        check(f'{theme}: bloque de récords Pro', bloque is not None and 'Has batido 2 récords personales' in bloque.inner_text(), bloque and bloque.inner_text())
        tactil(pg, '.sum-pr button', theme); ancho(pg, f'{theme} resumen')
        pg.screenshot(path=f'/tmp/pr-resumen-{theme}.png')
        pg.click('[data-act="pr-share-last"]'); time.sleep(1.2)
        check(f'{theme}: Pro abre la tarjeta', pg.query_selector('canvas[data-cp-pr]') is not None and len(pg.query_selector_all('.cp-prs button')) == 2)
        pg.click('.cp-sheet .cp-foot button'); time.sleep(1.2)
        check(f'{theme}: al cerrar vuelve al resumen', pg.query_selector('.cp-sheet') is None and pg.query_selector('.sum-pr') is not None)
        check(f'{theme}: 0 errores (Pro)', not errores, errores); ctx.close()
    b.close()

print(f'{oks} correctas, {len(fallos)} fallos')
for f in fallos: print(' -', f)
