# Crea el modelo con esqueleto: public/models/<modelo>.glb + modelos/<modelo>-rig.json → modelos/<modelo>-rig.glb
# Uso (Blender como módulo de Python):  pip install bpy==5.3.0  y luego
#        python3 herramientas/ejercicios3d/rig/construir.py hombre-1
# Los pesos se calculan con el método de "calor" de Blender sobre una copia soldada de la malla (el glTF
# viene partido en las costuras de UV y el calor no cruza esas grietas) y luego se copian a la malla original.
# Ojo: no llames a este archivo inspect.py ni parecido (Blender importa módulos con esos nombres).
import bpy, bmesh, json, sys, os, mathutils
from mathutils.kdtree import KDTree

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
modelo = sys.argv[-1]
J = json.load(open(os.path.join(AQUI, '..', 'modelos', f'{modelo}-rig.json')))
B = lambda p: mathutils.Vector((p[0], -p[2], p[1]))  # glTF (y arriba) → Blender (z arriba)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(RAIZ, 'public', 'models', modelo + '.glb'))
cuerpo = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for img in bpy.data.images:  # texturas enormes (4K): se bajan a 2048 para que el modelo pese poco en el repositorio
    if img.size[0] > 2048: img.scale(2048, 2048)

# 1) armadura con las articulaciones del JSON
datos = bpy.data.armatures.new('esqueleto'); arm = bpy.data.objects.new('esqueleto', datos)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for b in J['bones']:
    e = datos.edit_bones.new(b['n']); e.head = B(J['joints'][b['h']]); e.tail = B(J['joints'][b['t']]); e.roll = 0; eb[b['n']] = e
for b in J['bones']:
    if b['p']:
        eb[b['n']].parent = eb[b['p']]; eb[b['n']].use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# 2) pesos por calor sobre una copia soldada
sold = cuerpo.copy(); sold.data = cuerpo.data.copy(); bpy.context.scene.collection.objects.link(sold)
bm = bmesh.new(); bm.from_mesh(sold.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(sold.data); bm.free()
for o in bpy.data.objects: o.select_set(False)
sold.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
grupos = {g.index: g.name for g in sold.vertex_groups}
sin = sum(1 for v in sold.data.vertices if not any(g.weight > 1e-4 for g in v.groups))
print('vértices sin peso:', sin, 'de', len(sold.data.vertices))

# 3) copiar pesos a la malla original (mismas posiciones)
kd = KDTree(len(sold.data.vertices))
for v in sold.data.vertices: kd.insert(v.co, v.index)
kd.balance()
for b in J['bones']: cuerpo.vertex_groups.new(name=b['n'])
for v in cuerpo.data.vertices:
    _, i, _ = kd.find(v.co)
    for g in sold.data.vertices[i].groups:
        if g.weight > 1e-4: cuerpo.vertex_groups[grupos[g.group]].add([v.index], g.weight, 'REPLACE')
bpy.data.objects.remove(sold)

# 2b) el calor reparte el peso del brazo por todo el pecho y la espalda (por eso al subir el brazo se
# estira el costado). Se recorta con la distancia al hueso del brazo: peso completo cerca, cero lejos.
def dist_segmento(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
for lado in ('R', 'L'):
    for hueso, ini, fin, radio in (('upper_arm', 'shoulder', 'elbow', 0.55), ('shoulder', 'clav', 'shoulder', 0.65)):
        g = cuerpo.vertex_groups.get(f'{hueso}.{lado}')
        a, b = B(J['joints'][f'{ini}.{lado}']), B(J['joints'][f'{fin}.{lado}'])
        r1 = (b - a).length * radio; r0 = r1 * 0.45
        for v in cuerpo.data.vertices:
            w = next((x.weight for x in v.groups if x.group == g.index), 0)
            if w <= 0: continue
            d = dist_segmento(v.co, a, b)
            k = 1.0 if d <= r0 else max(0.0, 1.0 - (d - r0) / (r1 - r0))
            k = k * k * (3 - 2 * k)  # suavizado
            if k < 1.0: g.add([v.index], w * k, 'REPLACE')
for o in bpy.data.objects: o.select_set(False)
cuerpo.select_set(True); bpy.context.view_layer.objects.active = cuerpo
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)  # three.js usa 4 influencias
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
cuerpo.parent = arm; m = cuerpo.modifiers.new('esqueleto', 'ARMATURE'); m.object = arm

dst = os.path.join(AQUI, '..', 'modelos', f'{modelo}-rig.glb')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_skins=True, export_animations=False, export_yup=True,
                          export_normals=True, export_texcoords=True, export_materials='EXPORT', export_def_bones=False,
                          export_image_format='WEBP', export_image_quality=80)
print('ok', os.path.relpath(dst, RAIZ))
