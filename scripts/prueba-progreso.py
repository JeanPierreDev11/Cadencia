# Playwright (iPhone 13, modo prueba): series semanales por músculo y hoja de progresión (77).
# Requiere `npx vite --port 5173 --host 127.0.0.1` con FIREBASE_CONFIG = null en js/config.js.
import json, time, datetime as dt
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5173/'
EMAIL = 'ana@prueba.es'
HOY = dt.date.today()
LUNES = HOY - dt.timedelta(days=HOY.weekday())

def seed(theme):
    ws = {}
    def w(i, fecha, ejs):
        ws[i] = {'id': i, 'fecha': fecha.isoformat(), 'tipo': 'gym', 'nombre': 'Torso', 'min': 55, 'ejercicios': ejs}
    def banca(kg, reps):
        return {'n': 'Press banca', 'carga': 'total', 'series': [{'kg': 40, 'reps': 10, 'w': True}] + [{'kg': kg, 'reps': r} for r in reps] + [{'kg': kg, 'reps': 1, 'done': False}]}
    for k, (dias, kg) in enumerate([(200, 65), (150, 70), (80, 72.5), (45, 75), (21, 77.5), (7, 80)]):
        w(f'b{k}', LUNES - dt.timedelta(days=dias), [banca(kg, [8, 8, 7])])
    w('hoy', LUNES, [banca(82.5, [8, 7, 6]),
        {'n': 'Press con mancuernas', 'carga': 'por_lado', 'series': [{'kg': 22.5, 'reps': 10}, {'kg': 22.5, 'reps': 9}]},
        {'n': 'Remo con mancuerna', 'carga': 'total', 'uni': True, 'series': [{'kg': 30, 'reps': 10, 'kgD': 32, 'repsD': 8}]},
        {'n': 'Dominadas', 'series': [{'kg': 0, 'reps': 9}]}])
    rut = {'id': 'r1', 'nombre': 'Mi rutina', 'tipos': ['fuerza'], 'dias': [0, 1, 2, 3, 4, 5, 6], 'modo': 'propuesta', 'split': 'auto', 'exp': 'anio', 'equipo': None, 'eqSel': [], 'donde': ['gym'], 'flex': False, 'deporte': '',
           'sesiones': {str(i): {'t': 'fuerza', 'nombre': 'Torso', 'foco': 'push', 'ej': [{'n': 'Press banca', 'm': 'pecho', 'series': 3, 'reps': '8-12'}]} for i in range(7)}}
    st = {'session': EMAIL, 'users': {EMAIL: {'uid': 'u1', 'email': EMAIL, 'pass': 'x', 'profile': {
        'nombre': 'Ana', 'usuario': 'ana', 'sexo': 'mujer', 'edad': 30, 'alturaCm': 165, 'pesoKg': 62, 'objetivos': ['musculo'],
        'onboarded': True, 'onboardingCompletado': True, 'onboardingVersion': 2, 'isPro': False, 'proPlan': 'none', 'novVista': 99,
        'rutina': rut, 'rutinas': [rut]}, 'pesos': {}, 'entrenos': ws}}}
    return f"if (!sessionStorage.getItem('s')) {{ localStorage.setItem('cadencia-local-v1', {json.dumps(json.dumps(st))}); sessionStorage.setItem('s', '1'); }} localStorage.setItem('cadencia-theme', '{theme}'); localStorage.setItem('cadencia-tab', 'entreno'); localStorage.setItem('cadencia-wktab', 'semana');"

fallos, oks = [], 0
def check(nombre, cond, extra=''):
    global oks
    if cond: oks += 1
    else: fallos.append(f'{nombre} {extra}')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for theme in ['dark', 'light']:
        ctx = b.new_context(**p.devices['iPhone 13'])
        ctx.add_init_script(seed(theme))
        pg = ctx.new_page()
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        ancho = lambda donde: check(f'{theme}: scrollWidth {donde}', pg.evaluate('document.documentElement.scrollWidth') == 390, pg.evaluate('document.documentElement.scrollWidth'))
        alto = lambda sel: check(f'{theme}: >= 44 px {sel}', all(e.bounding_box()['height'] >= 43.9 for e in pg.query_selector_all(sel)) and pg.query_selector(sel) is not None, [e.bounding_box()['height'] for e in pg.query_selector_all(sel)][:4])
        pg.goto(URL); time.sleep(2.5)
        pg.evaluate("() => { const n = document.querySelector('[data-act=nov-ok]'); if (n) n.click(); }"); time.sleep(0.5)
        for _ in range(6):
            if pg.query_selector('.sheet-back[data-act="rec-ask-no"]'):
                pg.evaluate("() => document.querySelector('.sheet-back[data-act=\"rec-ask-no\"]').click()"); time.sleep(1.0); break
            time.sleep(0.5)
        pg.add_style_tag(content='.ib{display:none!important}')

        # Volumen semanal
        card = pg.query_selector('.vol-card')
        check(f'{theme}: bloque de series', card is not None)
        card.scroll_into_view_if_needed(); time.sleep(0.3)
        filas = lambda: {r.query_selector('.vol-n').inner_text(): (r.query_selector('.vol-v').inner_text(), r.query_selector('.vol-d').inner_text()) for r in pg.query_selector_all('.vol-row')}
        sem = filas()
        check(f'{theme}: Pecho esta semana', sem.get('Pecho') == ('5 series', '+2'), sem)
        check(f'{theme}: media serie con coma', any(',5' in v for v, _ in sem.values()), sem)
        alto('.vol-card .opc-fila button'); ancho('semana')
        pg.screenshot(path=f'/tmp/vol-{theme}.png')
        pg.click('[data-act="vol-modo"][data-v="7d"]'); time.sleep(0.4)
        siete = filas()
        check(f'{theme}: 7d pulsado', pg.get_attribute('[data-act="vol-modo"][data-v="7d"]', 'aria-pressed') == 'true')
        desde = HOY - dt.timedelta(days=6)
        esperado = 3 + 2 if LUNES >= desde else 0
        if LUNES - dt.timedelta(days=7) >= desde: esperado += 3
        check(f'{theme}: Pecho 7 días', siete.get('Pecho', ('', ''))[0] == f'{esperado} series', siete)
        pg.click('[data-act="vol-modo"][data-v="semana"]'); time.sleep(0.4)
        check(f'{theme}: vuelve a semana', filas() == sem)

        # Récords → progresión
        pg.click('[data-act="wktab"][data-v="records"]'); time.sleep(0.6)
        alto('.rec-acc.open .rec-prog'); ancho('records')
        pg.screenshot(path=f'/tmp/rec-{theme}.png')
        def abrir(nombre):
            for h in pg.query_selector_all('.rec-head[aria-expanded="false"]'): h.click(); time.sleep(0.15)
            for h in pg.query_selector_all('.rec-head[aria-expanded="false"]'): h.click(); time.sleep(0.15)
            pg.click(f'.rec-prog[data-n="{nombre}" i]'); time.sleep(0.8)
        def cerrar(como):
            if como == 'x': pg.click('.prog-sheet .iconbtn[data-act="prog-close"]')
            elif como == 'fondo': pg.mouse.click(195, 20)
            else: pg.keyboard.press('Escape')
            time.sleep(1.0)
            check(f'{theme}: cierra con {como}', pg.query_selector('.prog-sheet') is None and not pg.evaluate("document.body.classList.contains('noscroll')"))
        abrir('Press banca')
        check(f'{theme}: hoja abierta', pg.query_selector('.prog-sheet') is not None)
        check(f'{theme}: noscroll', pg.evaluate("document.body.classList.contains('noscroll')"))
        check(f'{theme}: SVG', pg.query_selector('.prog-svg .prog-ln') is not None)
        check(f'{theme}: 7 puntos', len(pg.query_selector_all('.prog-pt')) == 7, len(pg.query_selector_all('.prog-pt')))
        cs = pg.eval_on_selector('.prog-ln', 'e => { const c = getComputedStyle(e); return [c.stroke, c.strokeWidth] }')
        check(f'{theme}: línea amarilla 2px', cs == ['rgb(242, 193, 22)', '2px'], cs)
        alto('.prog-sheet .opc-fila button'); ancho('hoja')
        stats = lambda: pg.inner_text('.prog-stats').replace('\n', ' ')
        det = lambda: pg.inner_text('.prog-det').replace('\n', ' ')
        check(f'{theme}: métrica 1RM', pg.get_attribute('[data-act="prog-met"][data-v="orm1"]', 'aria-pressed') == 'true' and ',' in stats(), stats())
        pg.screenshot(path=f'/tmp/prog-{theme}.png')
        pg.click('[data-act="prog-met"][data-v="peso"]'); time.sleep(0.3)
        check(f'{theme}: peso máx.', '82,5 kg' in stats() and '+17,5 kg' in stats(), stats())
        antes = det()
        pt = pg.query_selector_all('.prog-pt')[-2].bounding_box()
        pg.touchscreen.tap(pt['x'] + pt['width'] / 2, pt['y'] + pt['height'] / 2); time.sleep(0.4)
        check(f'{theme}: detalle del punto', det() != antes and '80 kg × 8, 8, 7' in det(), det())
        check(f'{theme}: punto resaltado', pg.eval_on_selector_all('.prog-pt', 'l => l.findIndex((e) => e.classList.contains("on"))') == 5)
        pg.screenshot(path=f'/tmp/prog-punto-{theme}.png')
        pg.focus('.prog-graf'); pg.keyboard.press('ArrowLeft'); time.sleep(0.2)
        check(f'{theme}: flecha izquierda', '77,5 kg' in det(), det())
        pg.click('[data-act="prog-met"][data-v="volumen"]'); time.sleep(0.3)
        check(f'{theme}: volumen', f'{int(82.5 * 21)}' in stats().replace('.', '') or '1.732' in stats() or '1.733' in stats() or '1732' in stats() or '1733' in stats(), stats())
        pg.click('[data-act="prog-rango"][data-v="1m"]'); time.sleep(0.3)
        n1 = len(pg.query_selector_all('.prog-pt'))
        pg.click('[data-act="prog-rango"][data-v="3m"]'); time.sleep(0.3)
        n3 = len(pg.query_selector_all('.prog-pt'))
        pg.click('[data-act="prog-rango"][data-v="6m"]'); time.sleep(0.3)
        n6 = len(pg.query_selector_all('.prog-pt'))
        check(f'{theme}: rangos', 1 < n1 < n3 < n6 < 7, (n1, n3, n6))
        check(f'{theme}: sigue abierta y sin saltar', pg.query_selector('.prog-sheet') is not None and pg.query_selector('.prog-sheet.sheet-closing') is None)
        pg.evaluate("() => { document.querySelector('.prog-body').scrollTop = 9999 }"); time.sleep(0.3)
        pg.screenshot(path=f'/tmp/prog-lista-{theme}.png')
        cerrar('x')
        abrir('Press con mancuernas')
        txt = pg.inner_text('.prog-sheet')
        check(f'{theme}: 1 sola sesión', 'Tras la 2.ª sesión aparecerá la curva' in txt and pg.query_selector('.prog-svg') is None, txt)
        check(f'{theme}: por lado', 'por lado' in txt and '22,5 kg c/u × 10, 9' in txt, txt)
        pg.screenshot(path=f'/tmp/prog-una-{theme}.png')
        cerrar('fondo')
        abrir('Dominadas')
        check(f'{theme}: sin kilos', 'Sin datos para esta métrica' in pg.inner_text('.prog-sheet'), pg.inner_text('.prog-sheet'))
        cerrar('escape')

        # Desde la ficha del ejercicio, sobre un entreno en vivo
        pg.click('[data-act="wktab"][data-v="semana"]'); time.sleep(0.6)
        pg.click('.dia-card [data-act="wk-new"]'); time.sleep(1.0)
        pg.click('text=Acompañamiento de entrenamiento'); time.sleep(1.5)
        link = pg.query_selector('[data-act="ex-view"]')
        check(f'{theme}: hay acceso a la ficha', link is not None)
        if link:
            link.click(); time.sleep(0.8)
            check(f'{theme}: enlace Ver progresión', pg.query_selector('.exv-prog') is not None)
            alto('.exv-prog')
            pg.screenshot(path=f'/tmp/ficha-{theme}.png')
            pg.click('.exv-prog'); time.sleep(0.8)
            check(f'{theme}: ficha → progresión', pg.query_selector('.prog-sheet') is not None and pg.query_selector('.sheet.exview') is None)
            cerrar('x')
            check(f'{theme}: el entreno en vivo sigue', pg.query_selector('[data-act="ex-view"]') is not None)
        check(f'{theme}: 0 errores JS', not errores, errores)
        ctx.close()
    b.close()

print(f'{oks} correctas, {len(fallos)} fallos')
for f in fallos: print(' -', f)
