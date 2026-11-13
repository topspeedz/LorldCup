"""Export the shared fan rig and four bodies, using the T04 Draco contract."""
import json
from pathlib import Path

import bpy

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
assert Path(bpy.data.filepath).resolve() == (OUT/'fan-rigged.blend').resolve()
scene = bpy.data.scenes['FanAssets']
bpy.context.window.scene = scene
names = ['FanRig', 'fan_f1', 'fan_f2', 'fan_m1', 'fan_m2']
for ob in scene.objects:
    ob.hide_set(False)
    ob.hide_render = False
    ob.select_set(ob.name in names)
bpy.context.view_layer.objects.active = bpy.data.objects['FanRig']
bpy.context.view_layer.update()
target = ROOT/'web/assets/characters/fan.glb'
target.parent.mkdir(parents=True, exist_ok=True)
print(json.dumps({'export_objects':names,'target':str(target)}))
bpy.ops.export_scene.gltf(
    filepath=str(target), export_format='GLB', use_selection=True,
    use_active_scene=True, export_yup=True, export_animations=False,
    export_apply=False, export_skins=True, export_def_bones=False,
    export_influence_nb=4, export_all_influences=False,
    export_armature_object_remove=False, export_leaf_bone=False,
    export_cameras=False, export_lights=False, export_extras=False,
    export_texcoords=True, export_normals=True, export_vertex_color='MATERIAL',
    export_image_format='AUTO', export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_draco_position_quantization=20,
    export_draco_normal_quantization=12, export_draco_texcoord_quantization=16,
    export_draco_color_quantization=24, export_draco_generic_quantization=24)
for name in names[1:]:
    bpy.data.objects[name].hide_set(name != 'fan_f1')
    bpy.data.objects[name].hide_render = name != 'fan_f1'
versions = bpy.context.preferences.filepaths.save_version
try:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fan-rigged.blend'))
finally:
    bpy.context.preferences.filepaths.save_version = versions
print(json.dumps({'glb_bytes':target.stat().st_size,'saved':bpy.data.filepath}))
