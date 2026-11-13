"""Export only the T30 skeleton, its nine actions, and the unskinned egg."""
import json
from pathlib import Path

import bpy
from mathutils import Matrix

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
assert Path(bpy.data.filepath).resolve() == (OUT/'fan-anim.blend').resolve()
scene = bpy.data.scenes['FanAssets']
bpy.context.window.scene = scene
rig = bpy.data.objects['FanRig']
rig.animation_data.action = None
for p in rig.pose.bones:
    p.matrix_basis = Matrix.Identity(4)
for ob in scene.objects:
    ob.hide_set(False)
    ob.select_set(ob.name in ('FanRig','Prop_Egg'))
bpy.context.view_layer.objects.active = rig
bpy.context.view_layer.update()
print(json.dumps({'export_objects':['FanRig','Prop_Egg'], 'body_meshes_exported':False}))
bpy.ops.export_scene.gltf(
    filepath=str(ROOT/'web/assets/characters/fan-anim.glb'), export_format='GLB',
    use_selection=True, use_active_scene=True, export_yup=True, export_apply=False,
    export_animations=True, export_animation_mode='ACTIONS', export_merge_animation='ACTION',
    export_anim_single_armature=True, export_force_sampling=False, export_frame_range=False,
    export_current_frame=False, export_rest_position_armature=True,
    export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
    export_skins=True, export_def_bones=False, export_armature_object_remove=False,
    export_leaf_bone=False, export_cameras=False, export_lights=False, export_extras=False,
    export_texcoords=False, export_normals=True, export_vertex_color='NONE',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=20, export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=16, export_draco_color_quantization=24,
    export_draco_generic_quantization=24)
for char in ('fan_f1','fan_f2','fan_m1','fan_m2'):
    bpy.data.objects[char].hide_set(char != 'fan_f1')
    bpy.data.objects[char].hide_render = char != 'fan_f1'
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
scene.frame_set(0)
versions = bpy.context.preferences.filepaths.save_version
try:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fan-anim.blend'))
finally:
    bpy.context.preferences.filepaths.save_version = versions
print(json.dumps({'bytes':(ROOT/'web/assets/characters/fan-anim.glb').stat().st_size, 'saved':bpy.data.filepath}))
