# Playwright (iPhone 13, modo prueba): racha semanal en Inicio, aviso de cierre de mes y hoja «Resumen mensual» (78).
# Requiere `npx vite --port 5173 --host 127.0.0.1` con FIREBASE_CONFIG = null en js/config.js.
import json, time, datetime as dt
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5173/'
EMAIL = 'ana@prueba.es'
HOY = dt.date.today()
LUNES = HOY - dt.timedelta(days=HOY.weekday())
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
PRIMERO = HOY.replace(day=1)
ANT = (PRIMERO - dt.timedelta(days=1)).replace(day=1)
titulo = lambda d: f'{MESES[d.month - 1]} {d.year}'.upper()
HECHOS = min(HOY.weekday() + 1, 2)  # días entrenados esta semana

def seed(theme, fechas, pesos):
    ejs = [{'n': 'Press banca', 'carga': 'total', 'series': [{'kg': 40, 'reps': 10, 'w': True}] + [{'kg': 80, 'reps': 8}] * 4},
           {'n': 'Sentadilla con barra', 'series': [{'kg': 100, 'reps': 5}] * 4},
           {'n': 'Remo con mancuerna', 'carga': 'total', 'uni': True, 'series': [{'kg': 30, 'reps': 10, 'kgD': 32, 'repsD': 8}] * 3},
           {'n': 'Press con mancuernas', 'carga': 'por_lado', 'series': [{'kg': 22.5, 'reps': 10}] * 3}]
    ws = {f'w{i}': {'id': f'w{i}', 'fecha': f.isoformat(), 'tipo': 'gym', 'nombre': 'Torso', 'min': 55, 'ejercicios': ejs} for i, f in enumerate(sorted(set(fechas)))}
    rut = {'id': 'r1', 'nombre': 'Mi rutina', 'tipos': ['fuerza'], 'dias': [0, 1, 3, 4], 'modo': 'propuesta', 'split': 'auto', 'exp': 'anio', 'equipo': None, 'eqSel': [], 'donde': ['gym'], 'flex': False, 'deporte': '',
           'sesiones': {str(i): {'t': 'fuerza', 'nombre': 'Torso', 'foco': 'push', 'ej': [{'n': 'Press banca', 'm': 'pecho', 'series': 3, 'reps': '8-12'}]} for i in (0, 1, 3, 4)}}
    st = {'session': EMAIL, 'users': {EMAIL: {'uid': 'u1', 'email': EMAIL, 'pass': 'x', 'profile': {
        'nombre': 'Ana', 'usuario': 'ana', 'sexo': 'mujer', 'edad': 30, 'alturaCm': 165, 'pesoKg': 62, 'objetivos': ['musculo'],
        'onboarded': True, 'onboardingCompletado': True, 'onboardingVersion': 2, 'isPro': False, 'proPlan': 'none', 'novVista': 99,
        'rutina': rut, 'rutinas': [rut]}, 'pesos': {d.isoformat(): {'fecha': d.isoformat(), 'kg': k} for d, k in pesos}, 'entrenos': ws}}}
    return f"if (!sessionStorage.getItem('s')) {{ localStorage.setItem('cadencia-local-v1', {json.dumps(json.dumps(st))}); localStorage.setItem('cadencia-tab', 'inicio'); localStorage.setItem('cadencia-wktab', 'semana'); sessionStorage.setItem('s', '1'); }} localStorage.setItem('cadencia-theme', '{theme}');"

# Tres semanas pasadas con 4 días, algunos de esta semana y varios del mes anterior.
FECHAS = [LUNES - dt.timedelta(weeks=s) + dt.timedelta(days=d) for s in (1, 2, 3) for d in (0, 1, 3, 4)]
FECHAS += [LUNES + dt.timedelta(days=d) for d in range(HECHOS)]
FECHAS += [ANT + dt.timedelta(days=d) for d in (2, 4, 9, 11)]
PESOS = [(ANT + dt.timedelta(days=1), 63.4), (ANT + dt.timedelta(days=24), 62.2)]

fallos, oks = [], 0
def check(nombre, cond, extra=''):
    global oks
    if cond: oks += 1
    else: fallos.append(f'{nombre} {extra}')

def abrir_app(b, theme, fechas, pesos):
    ctx = b.new_context(**p.devices['iPhone 13'])
    ctx.add_init_script(seed(theme, fechas, pesos))
    pg = ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.goto(URL); time.sleep(2.5)
    pg.evaluate("() => { const n = document.querySelector('[data-act=nov-ok]'); if (n) n.click(); }"); time.sleep(0.5)
    for _ in range(6):
        if pg.query_selector('.sheet-back[data-act="rec-ask-no"]'):
            pg.evaluate("() => document.querySelector('.sheet-back[data-act=\"rec-ask-no\"]').click()"); time.sleep(1.0); break
        time.sleep(0.5)
    pg.add_style_tag(content='.ib{display:none!important}')
    return ctx, pg, errores

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for theme in ['dark', 'light']:
        ctx, pg, errores = abrir_app(b, theme, FECHAS, PESOS)
        ancho = lambda donde: check(f'{theme}: scrollWidth {donde}', pg.evaluate('document.documentElement.scrollWidth') == 390, pg.evaluate('document.documentElement.scrollWidth'))
        def alto(sel):
            hs = [e.bounding_box()['height'] for e in pg.query_selector_all(sel)]
            check(f'{theme}: >= 44 px {sel}', bool(hs) and min(hs) >= 43.9, hs)
        titulo_hoja = lambda: pg.inner_text('.mes-nav h3').upper()
        visto = lambda: pg.evaluate("localStorage.getItem('cadencia-mes-visto-u1')")
        hoja = lambda: pg.query_selector('.mes-sheet')

        # Inicio: racha y aviso
        t = pg.inner_text('.sem-racha')
        semanas = pg.inner_text('.sem-racha b').lower()
        check(f'{theme}: 3 semanas seguidas', semanas.startswith('3 semanas seguidas') or semanas.startswith('4 semanas'), semanas)
        check(f'{theme}: progreso', f'{HECHOS} de 4 días esta semana' in t and 'Mejor:' in t, t)
        check(f'{theme}: 4 bloques', len(pg.query_selector_all('.sem-bar i')) == 4)
        check(f'{theme}: bloques iluminados', len(pg.query_selector_all('.sem-bar i.on')) == HECHOS)
        check(f'{theme}: verde de estado', pg.eval_on_selector('.sem-bar i.on', 'e => getComputedStyle(e).backgroundColor') == 'rgb(34, 197, 94)')
        check(f'{theme}: sin racha diaria en Inicio', pg.query_selector('.main .flame') is None)
        check(f'{theme}: aviso', f'Resumen de {MESES[ANT.month - 1]} disponible' in pg.inner_text('.mes-aviso'))
        alto('.sem-racha'); alto('.mes-aviso .btn'); ancho('inicio')
        pg.screenshot(path=f'/tmp/ini-{theme}.png')

        # Aviso → mes anterior
        pg.click('[data-act="mes-open-prev"]'); time.sleep(0.9)
        check(f'{theme}: abre el mes anterior', hoja() is not None and titulo_hoja() == titulo(ANT), titulo_hoja() if hoja() else '')
        check(f'{theme}: marcado visto', visto() == ANT.isoformat()[:7], visto())
        check(f'{theme}: noscroll', pg.evaluate("document.body.classList.contains('noscroll')"))
        cuerpo = pg.inner_text('.mes-body')
        for x in ['Entrenos', 'Series efectivas', 'Volumen total', 'Cambio de peso', '−1,2 kg', ' t', 'semanas cumplidas']:
            check(f'{theme}: resumen contiene {x!r}', x.lower() in cuerpo.lower(), cuerpo)
        check(f'{theme}: top 3 músculos', len(pg.query_selector_all('.mes-musc li')) == 3)
        check(f'{theme}: top 3 marcas', len(pg.query_selector_all('.mes-body .prog-lista li')) == 3)
        alto('.mes-nav .iconbtn'); alto('.mes-sheet .sheet-head .iconbtn'); ancho('hoja')
        pg.screenshot(path=f'/tmp/mes-{theme}.png')

        # Navegar
        pg.click('[data-act="mes-next"]'); time.sleep(0.5)
        check(f'{theme}: > va al actual', titulo_hoja() == titulo(HOY), titulo_hoja())
        check(f'{theme}: > desactivada en el actual', pg.query_selector('[data-act="mes-next"][disabled]') is not None)
        pg.click('[data-act="mes-prev"]'); time.sleep(0.5)
        check(f'{theme}: < vuelve', titulo_hoja() == titulo(ANT), titulo_hoja())

        def cerrar(como):
            if como == 'x': pg.click('.mes-sheet .iconbtn[data-act="mes-close"]')
            elif como == 'fondo': pg.mouse.click(195, 20)
            else: pg.keyboard.press('Escape')
            time.sleep(1.0)
            check(f'{theme}: cierra con {como}', hoja() is None and not pg.evaluate("document.body.classList.contains('noscroll')"))
        cerrar('x')
        check(f'{theme}: el aviso ya no sale', pg.query_selector('.mes-aviso') is None)
        pg.reload(); time.sleep(2.5); pg.add_style_tag(content='.ib{display:none!important}')
        if pg.query_selector('.sheet-back[data-act="rec-ask-no"]'):
            pg.evaluate("() => document.querySelector('.sheet-back[data-act=\"rec-ask-no\"]').click()"); time.sleep(1.0)
        check(f'{theme}: tampoco tras recargar', pg.query_selector('.mes-aviso') is None and pg.query_selector('.sem-racha') is not None)

        # Tarjeta (toque y teclado) → mes actual
        pg.click('.sem-racha'); time.sleep(0.9)
        check(f'{theme}: tarjeta abre el mes actual', hoja() is not None and titulo_hoja() == titulo(HOY))
        pg.screenshot(path=f'/tmp/mesact-{theme}.png')
        cerrar('fondo')
        pg.focus('.sem-racha'); pg.keyboard.press('Enter'); time.sleep(0.9)
        check(f'{theme}: abre con teclado', hoja() is not None)
        cerrar('escape')

        # Entreno › Récords
        pg.click('.tabbar [data-v="entreno"]'); time.sleep(0.5)
        pg.click('[data-act="wktab"][data-v="records"]'); time.sleep(0.6)
        alto('.mes-chip'); ancho('records')
        pg.screenshot(path=f'/tmp/rec-{theme}.png')
        pg.click('.mes-chip'); time.sleep(0.9)
        check(f'{theme}: abre desde Récords', hoja() is not None)
        cerrar('x')
        check(f'{theme}: 0 errores JS', not errores, errores)
        ctx.close()

        # Mes vacío y usuario nuevo
        ctx, pg, errores = abrir_app(b, theme, [], [])
        t = pg.inner_text('.sem-racha')
        check(f'{theme}: sin datos', '1.ª semana en marcha' in t.lower() and '0 de 4 días' in t and pg.query_selector('.mes-aviso') is None, t)
        pg.click('.sem-racha'); time.sleep(0.9)
        check(f'{theme}: estado vacío', pg.query_selector('.mes-sheet .prog-vacio') is not None)
        check(f'{theme}: flechas desactivadas', len(pg.query_selector_all('.mes-nav [disabled]')) == 2)
        pg.screenshot(path=f'/tmp/vacio-{theme}.png')
        check(f'{theme}: 0 errores JS (vacío)', not errores, errores)
        ctx.close()
    b.close()
print(f'{oks} comprobaciones correctas, {len(fallos)} fallos')
for f in fallos: print('FALLO', f)
raise SystemExit(1 if fallos else 0)
