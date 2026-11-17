# Prepara el cuerpo hombre-2: quita el rig automático del GLB original (24 huesos, sin dedos), lo escala a 1,9 m y lo centra en y
# (como hombre-1) y lo deja en public/models/hombre-2.glb (ese archivo pesa 9 MB: no se sube al repo; solo hace falta para construir.py).
# Uso:  python3 -I herramientas/ejercicios3d/rig/preparar-hombre-2.py  (editar la ruta del original en la línea del import)
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/home/claude/rigged/user.glb')
cuerpo=bpy.data.objects['char1']
for o in list(bpy.data.objects):
    if o is not cuerpo: bpy.data.objects.remove(o)
for m in list(cuerpo.modifiers): cuerpo.modifiers.remove(m)
cuerpo.vertex_groups.clear(); cuerpo.parent=None
s=1.9/1.7
cuerpo.scale=(s,s,s); cuerpo.location=(0,0,-0.85*s*0)  # blender z = y glTF
bpy.context.view_layer.objects.active=cuerpo; cuerpo.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
cuerpo.location=(0,0,-0.95)
bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
bpy.ops.export_scene.gltf(filepath='/home/claude/cadencia/public/models/hombre-2.glb',export_format='GLB',export_materials='EXPORT',export_yup=True,export_normals=True,export_texcoords=True,export_tangents=True)
print('ok')
