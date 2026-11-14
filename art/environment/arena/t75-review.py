"""CPU views for the pre-bake geometry and paired inside-facing exterior LOD."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T75'
scene = bpy.data.scenes['Barclays • WORLDS 2026']; bpy.context.window.scene = scene
assert bpy.app.background
for ob in scene.objects:
    if ob.type == 'MESH' and ('_CM_PART' in ob.data.attributes or ob.name.endswith('__lod10')):
        ob.hide_render = True
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4
scene.cycles.use_denoising = True; scene.cycles.max_bounces = 3
scene.render.threads_mode = 'FIXED'; scene.render.threads = 6
scene.render.resolution_x = 640; scene.render.resolution_y = 400; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
camera = bpy.data.objects.new('T75_ReviewCamera', bpy.data.cameras.new('T75_ReviewCamera'))
scene.collection.objects.link(camera); scene.camera = camera; camera.data.lens = 24; camera.data.clip_end = 500
views = [('geometry-panels', (-62,0,2), (-52,0,-1.5)),
    ('geometry-ramp-a', (8,42,3), (0,31,-6)), ('geometry-ramp-b', (-8,-42,3), (0,-31,-6)),
    ('geometry-upper', (-54,0,5), (50,0,15)),
    ('exterior-original', (-72,5,2), (-91,20,10)),
    ('exterior-lod10', (-72,5,2), (-91,20,10)),
    ('exterior-profile-original', (-175,-120,40), (0,0,20)),
    ('exterior-profile-lod10', (-175,-120,40), (0,0,20))]
for name, location, target in views:
    if name.startswith('exterior'):
        for ob in scene.objects:
            if ob.name.endswith('__lod10'):
                ob.hide_render = not name.endswith('lod10'); scene.objects[ob.name[:-7]].hide_render = name.endswith('lod10')
    camera.location = location
    camera.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(OUT / (name + '.png'))
    bpy.ops.render.render(write_still=True)
    print('T75_CPU_REVIEW', name, flush=True)
