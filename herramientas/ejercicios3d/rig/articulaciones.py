# Genera el esqueleto ajustado a un modelo: rig/cfg-<modelo>.json → modelos/<modelo>-rig.json
# Uso:  python3 herramientas/ejercicios3d/rig/articulaciones.py hombre-1
# El cfg tiene las articulaciones medidas sobre la malla (coordenadas glTF: x derecha, y arriba, z delante).
# Si un lado .L no está, se refleja el .R. Si el cfg trae "hand", los dedos se detectan solos con
# cortes horizontales de la malla (sirve para manos con dedos separados, como hombre-1).
import json, sys, os
import numpy as np
import trimesh

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))

HUESOS = [
    ('hips', 'pelvis', 'spine_a', None), ('spine', 'spine_a', 'spine_b', 'hips'), ('chest', 'spine_b', 'chest_top', 'spine'),
    ('upper_chest', 'chest_top', 'neck_base', 'chest'), ('neck', 'neck_base', 'head_base', 'upper_chest'), ('head', 'head_base', 'head_top', 'neck'),
    ('shoulder.R', 'clav.R', 'shoulder.R', 'upper_chest'), ('upper_arm.R', 'shoulder.R', 'elbow.R', 'shoulder.R'),
    ('forearm.R', 'elbow.R', 'wrist.R', 'upper_arm.R'), ('hand.R', 'wrist.R', 'f_middle_mcp.R', 'forearm.R'),
    ('thumb.01.R', 'thumb_cmc.R', 'thumb_mcp.R', 'hand.R'), ('thumb.02.R', 'thumb_mcp.R', 'thumb_ip.R', 'thumb.01.R'), ('thumb.03.R', 'thumb_ip.R', 'thumb_tip.R', 'thumb.02.R'),
    ('thigh.R', 'hip.R', 'knee.R', 'hips'), ('shin.R', 'knee.R', 'ankle.R', 'thigh.R'), ('foot.R', 'ankle.R', 'ball.R', 'shin.R'), ('toe.R', 'ball.R', 'toe.R', 'foot.R'),
]
for f in ['index', 'middle', 'ring', 'pinky']:
    HUESOS += [(f'f_{f}.01.R', f'f_{f}_mcp.R', f'f_{f}_pip.R', 'hand.R'), (f'f_{f}.02.R', f'f_{f}_pip.R', f'f_{f}_dip.R', f'f_{f}.01.R'),
               (f'f_{f}.03.R', f'f_{f}_dip.R', f'f_{f}_tip.R', f'f_{f}.02.R')]


def todos_los_huesos():
    out = []
    for n, h, t, p in HUESOS:
        if n.endswith('.R'):
            out.append((n, h, t, p))
            out.append((n[:-2] + '.L', h.replace('.R', '.L'), t.replace('.R', '.L'), p.replace('.R', '.L') if p else p))
        else:
            out.append((n, h, t, p))
    return out


def malla_soldada(modelo):
    m = trimesh.load(os.path.join(RAIZ, 'public', 'models', modelo + '.glb'), force='mesh', process=False)
    m.merge_vertices(merge_tex=True, merge_norm=True)
    return m


def dedos(m, xmin, ysplit, mcp_y, wrist):
    """Sigue cada dedo con cortes horizontales desde donde se separan; devuelve MCP/PIP/DIP/punta."""
    P = m.vertices
    pistas = []
    for y in np.arange(ysplit, -0.25, -0.005):
        s = m.section(plane_origin=[0, y, 0], plane_normal=[0, 1, 0])
        if s is None:
            break
        L = [e.mean(0) for e in s.discrete if e.mean(0)[0] > xmin]
        if not L:
            break
        if not pistas:
            L.sort(key=lambda c: c[2]); pistas = [[c] for c in L]; continue
        for c in L:
            k = min(range(len(pistas)), key=lambda i: np.linalg.norm(pistas[i][-1][[0, 2]] - c[[0, 2]]))
            if np.linalg.norm(pistas[k][-1][[0, 2]] - c[[0, 2]]) < 0.02:
                pistas[k].append(c)
    res = []
    for t in pistas:
        t = np.array(t)
        cerca = P[(np.abs(P[:, 2] - t[-1][2]) < 0.012) & (np.abs(P[:, 0] - t[-1][0]) < 0.02) & (P[:, 1] < t[-1][1] + 0.003)]
        punta = cerca[cerca[:, 1].argmin()] if len(cerca) else t[-1]
        mcp = np.array([wrist[0] + (t[0][0] - wrist[0]) * 0.75, mcp_y, t[0][2]])
        poli = np.vstack([mcp, t, punta]); cum = np.r_[0, np.cumsum(np.linalg.norm(np.diff(poli, axis=0), axis=1))]
        en = lambda f: np.array([np.interp(f * cum[-1], cum, poli[:, i]) for i in range(3)])
        res.append(dict(z=t[0][2], mcp=mcp, pip=en(.45), dip=en(.74), tip=punta))
    res.sort(key=lambda f: f['z'], reverse=True)  # el índice es el más adelantado
    return res


def main(modelo):
    cfg = json.load(open(os.path.join(AQUI, f'cfg-{modelo}.json')))
    J = dict(cfg['joints'])
    if cfg.get('hand'):
        F = dedos(malla_soldada(modelo), **cfg['hand'])
        if len(F) != 4:
            sys.exit(f'Se esperaban 4 dedos y salieron {len(F)}: ajusta "hand" en el cfg o pon los dedos a mano')
        for f, nm in zip(F, ['index', 'middle', 'ring', 'pinky']):
            for k in ['mcp', 'pip', 'dip', 'tip']:
                J[f'f_{nm}_{k}.R'] = [round(float(v), 4) for v in f[k]]
    for k in list(J):
        if k.endswith('.R') and k[:-2] + '.L' not in J:
            J[k[:-2] + '.L'] = [-J[k][0], J[k][1], J[k][2]]
    out = {'model': modelo, 'joints': J, 'bones': [dict(n=n, h=h, t=t, p=p) for n, h, t, p in todos_los_huesos()]}
    falta = sorted({b[k] for b in out['bones'] for k in 'ht'} - set(J))
    if falta:
        sys.exit('Faltan articulaciones en el cfg: ' + ', '.join(falta))
    dst = os.path.join(AQUI, '..', 'modelos', f'{modelo}-rig.json')
    json.dump(out, open(dst, 'w'), indent=1)
    print('ok', os.path.relpath(dst, RAIZ), len(J), 'articulaciones,', len(out['bones']), 'huesos')


if __name__ == '__main__':
    main(sys.argv[1])
