import json, sys, time, csv, io
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5173/'
EMAIL = 'ana@prueba.es'
HEVY = open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'hevy-prueba.csv'), encoding='utf-8').read()

def seed(theme):
    w = {
        'w1': {'id': 'w1', 'fecha': '2026-11-20', 'tipo': 'gym', 'nombre': 'Torso', 'min': 55, 'esf': 2, 'ejercicios': [
            {'n': 'Press banca', 'carga': 'total', 'series': [{'kg': 60, 'reps': 10, 'w': True}, {'kg': 80, 'reps': 8, 'rir': 2}]},
            {'n': 'Remo con mancuerna', 'carga': 'total', 'uni': True, 'series': [{'kg': 30, 'reps': 10, 'kgD': 28, 'repsD': 9}]}]},
    }
    st = {'session': EMAIL, 'users': {EMAIL: {'uid': 'u1', 'email': EMAIL, 'pass': 'x', 'profile': {
        'nombre': 'Ana', 'usuario': 'ana', 'sexo': 'mujer', 'edad': 30, 'alturaCm': 165, 'pesoKg': 62, 'objetivos': ['musculo'],
        'onboarded': True, 'onboardingCompletado': True, 'onboardingVersion': 2, 'isPro': False, 'proPlan': 'none', 'novVista': 99,
        'fcmTokens': ['tok-secreto'], 'stripeCustomerId': 'cus_x', 'rutinas': [{'id': 'r1', 'nombre': 'Mi rutina'}]},
        'pesos': {'2026-11-01': {'fecha': '2026-11-01', 'kg': 62.4}}, 'entrenos': w}}}
    return f"localStorage.setItem('cadencia-local-v1', {json.dumps(json.dumps(st))}); localStorage.setItem('cadencia-theme', '{theme}'); localStorage.setItem('cadencia-tab', 'perfil');"

fallos, oks = [], 0
def check(nombre, cond, extra=''):
    global oks
    if cond: oks += 1
    else: fallos.append(f'{nombre} {extra}')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for theme in ['dark', 'light']:
        ctx = b.new_context(**p.devices['iPhone 13'], accept_downloads=True)
        ctx.add_init_script(seed(theme))
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
        if not pg.query_selector('.tus-datos'):
            pg.evaluate("() => document.querySelector('.tabbar [data-act=\"tab\"][data-v=\"perfil\"]').click()"); time.sleep(0.8)
        sec = pg.query_selector('.tus-datos')
        check(f'{theme}: bloque Tus datos', sec is not None)
        btns = pg.query_selector_all('.tus-datos .datos-btn')
        check(f'{theme}: 3 acciones', len(btns) == 3, len(btns))
        for bt in btns:
            r = bt.bounding_box(); cs = bt.evaluate("e => { const c = getComputedStyle(e); return [c.borderTopLeftRadius, c.backgroundColor, c.borderTopColor] }")
            check(f'{theme}: alto >= 44', r['height'] >= 44, r['height'])
            check(f'{theme}: radio 2px', cs[0] == '2px', cs[0])
            check(f'{theme}: sin fondo amarillo', '242, 193, 22' not in cs[1], cs[1])
            check(f'{theme}: icono svg', bt.query_selector('svg') is not None)
        check(f'{theme}: scrollWidth perfil', pg.evaluate('document.documentElement.scrollWidth') == 390, pg.evaluate('document.documentElement.scrollWidth'))
        pg.screenshot(path=f'/tmp/perfil-{theme}.png', full_page=False) if False else None
        sec.scroll_into_view_if_needed(); pg.screenshot(path=f'/tmp/perfil-{theme}.png')

        # Exportar CSV
        with pg.expect_download() as d:
            pg.click('[data-act="datos-csv"]')
        dl = d.value
        check(f'{theme}: nombre CSV', dl.suggested_filename.startswith('cadencia-entrenos-') and dl.suggested_filename.endswith('.csv'), dl.suggested_filename)
        raw = open(dl.path(), 'rb').read()
        check(f'{theme}: BOM UTF-8', raw[:3] == b'\xef\xbb\xbf')
        txt = raw.decode('utf-8-sig')
        filas = list(csv.reader(io.StringIO(txt)))
        check(f'{theme}: cabecera CSV', filas[0] == ['fecha', 'rutina', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rir', 'carga', 'notas'], filas[0])
        check(f'{theme}: filas CSV', len(filas) == 1 + 2 + 2, len(filas))
        check(f'{theme}: fila calentamiento', ['2026-11-20', 'Torso', 'Press banca', '', 'calentamiento', '60', '10', '', '', ''] in filas, filas)
        time.sleep(0.6)
        # Exportar JSON
        with pg.expect_download() as d:
            pg.click('[data-act="datos-json"]')
        dl = d.value
        check(f'{theme}: nombre JSON', dl.suggested_filename.startswith('cadencia-backup-') and dl.suggested_filename.endswith('.json'), dl.suggested_filename)
        j = json.loads(open(dl.path(), encoding='utf-8').read())
        check(f'{theme}: JSON partes', j.get('app') == 'Cadencia' and len(j['entrenos']) == 1 and len(j['pesos']) == 1 and len(j['rutinas']) == 1, list(j.keys()))
        check(f'{theme}: JSON sin campos internos', 'fcmTokens' not in j['perfil'] and 'stripeCustomerId' not in j['perfil'] and 'rutinas' not in j['perfil'] and j['perfil'].get('nombre') == 'Ana')
        time.sleep(0.6)

        # Importar Hevy
        pg.click('[data-act="imp-open"]'); time.sleep(0.6)
        sh = pg.query_selector('.sheet.imp-sheet')
        check(f'{theme}: hoja importar', sh is not None)
        check(f'{theme}: texto compatible', 'Hevy' in sh.inner_text() and 'Strong' in sh.inner_text() and 'Cadencia' in sh.inner_text())
        check(f'{theme}: noscroll', pg.evaluate("document.body.classList.contains('noscroll')"))
        pg.screenshot(path=f'/tmp/imp-elegir-{theme}.png')
        # archivo inválido primero
        pg.set_input_files('input[data-imp-file]', files=[{'name': 'malo.csv', 'mimeType': 'text/csv', 'buffer': b'nombre,apellido\nAna,Lopez\n'}]); time.sleep(0.8)
        check(f'{theme}: mensaje formato invalido', 'No reconocemos el formato' in pg.inner_text('.imp-sheet'), pg.inner_text('.imp-sheet'))
        check(f'{theme}: sin botón importar con inválido', pg.query_selector('[data-act="imp-go"]') is None)
        pg.set_input_files('input[data-imp-file]', files=[{'name': 'hevy_workouts.csv', 'mimeType': 'text/csv', 'buffer': HEVY.encode('utf-8')}]); time.sleep(0.8)
        datos = [e.inner_text().replace('\n', ' ') for e in pg.query_selector_all('.imp-dato')]
        check(f'{theme}: 4 cifras de vista previa', len(datos) == 4, datos)
        check(f'{theme}: entrenos nuevos 2', datos and datos[0].startswith('2 entrenos nuevos'), datos)
        check(f'{theme}: series 10', len(datos) > 1 and datos[1].startswith('10 series'), datos)
        check(f'{theme}: rango fechas', len(datos) > 3 and '26 nov' in datos[3] and '28 nov 2024' in datos[3], datos)
        check(f'{theme}: duplicados 0', len(datos) > 2 and datos[2].startswith('0 duplicados'), datos)
        go = pg.query_selector('[data-act="imp-go"]')
        check(f'{theme}: botón Importar 2 entrenos', go is not None and go.inner_text().strip().lower() == 'importar 2 entrenos', go and go.inner_text())
        if go:
            cs = go.evaluate("e => { const c = getComputedStyle(e); return [c.backgroundColor, c.color, c.borderTopLeftRadius, e.getBoundingClientRect().height] }")
            check(f'{theme}: botón amarillo', cs[0] == 'rgb(242, 193, 22)' and cs[1] == 'rgb(0, 0, 0)', cs)
            check(f'{theme}: botón 2px y >= 44', cs[2] == '2px' and cs[3] >= 44, cs)
        check(f'{theme}: scrollWidth hoja', pg.evaluate('document.documentElement.scrollWidth') == 390)
        pg.screenshot(path=f'/tmp/imp-vista-{theme}.png')
        check(f'{theme}: banner de instalar oculto', pg.evaluate("() => { const b = document.querySelector('.ib'); return !b || getComputedStyle(b).visibility === 'hidden' }"))
        vis = pg.evaluate("async () => { document.querySelector('[data-act=imp-go]').click(); await new Promise((r) => setTimeout(r, 30)); const t = document.querySelector('#imp-prog'); return !!document.querySelector('.imp-barra') && !!t && t.textContent }")
        check(f'{theme}: progreso visible', bool(vis) and 'de 2 entrenos' in vis, vis)
        pg.wait_for_selector('.imp-ok', timeout=8000)
        pg.screenshot(path=f'/tmp/imp-hecho-{theme}.png')
        guard = pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('cadencia-local-v1')); return Object.values(s.users['ana@prueba.es'].entrenos) }")
        check(f'{theme}: 3 entrenos guardados', len(guard) == 3, len(guard))
        imp = [w for w in guard if w.get('importado') == 'hevy']
        check(f'{theme}: banca importada', any(e['n'] == 'Press banca' for w in imp for e in w.get('ejercicios', [])))
        check(f'{theme}: sin undefined', 'undefined' not in json.dumps(guard) and 'NaN' not in json.dumps(guard))
        pg.click('[data-act="imp-ver"]'); time.sleep(1.0)
        hist = pg.query_selector('.sheet[aria-label="Historial de entrenos"]')
        check(f'{theme}: historial abierto', hist is not None)
        ht = hist.inner_text() if hist else ''
        check(f'{theme}: importados en historial', 'Push, día A' in ht and 'Pierna' in ht and 'Torso' in ht, ht[:300])
        pg.screenshot(path=f'/tmp/historial-{theme}.png')
        # reimportar: duplicados
        pg.evaluate("() => document.querySelector('.sheet-back[data-act=\"wk-hist-close\"]').click()"); time.sleep(0.9)
        pg.evaluate("() => document.querySelector('.tabbar [data-act=\"tab\"][data-v=\"perfil\"]').click()"); time.sleep(0.8)
        pg.click('[data-act="imp-open"]'); time.sleep(0.6)
        pg.set_input_files('input[data-imp-file]', files=[{'name': 'hevy_workouts.csv', 'mimeType': 'text/csv', 'buffer': HEVY.encode('utf-8')}]); time.sleep(0.8)
        datos = [e.inner_text().replace('\n', ' ') for e in pg.query_selector_all('.imp-dato')]
        check(f'{theme}: reimportar = 0 nuevos y 2 duplicados', datos and datos[0].startswith('0 entrenos') and datos[2].startswith('2 duplicados'), datos)
        check(f'{theme}: sin botón importar al repetir', pg.query_selector('[data-act="imp-go"]') is None)
        pg.click('.imp-sheet .sheet-head [data-act="imp-close"]'); time.sleep(0.9)
        check(f'{theme}: hoja cerrada', pg.query_selector('.imp-sheet') is None and not pg.evaluate("document.body.classList.contains('noscroll')"))
        check(f'{theme}: 0 errores JS', not errores, errores)
        ctx.close()
    b.close()

print(f'{oks} correctas, {len(fallos)} fallos')
for f in fallos: print('FALLA:', f)
sys.exit(1 if fallos else 0)
