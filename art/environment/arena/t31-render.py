"""CPU-only, matched technical views; never save changes to either blend."""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
label = sys.argv[sys.argv.index('--')+1]
assert label in ('before','after') and bpy.app.background
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
keep = set(json.loads((ROOT/'web-lightmaps/floor-fix/visible-objects.json').read_text()))
for ob in scene.objects:
    if ob.name not in keep and not ob.name.startswith(('Fix_', 'Collide_Tier', 'Collide_Ramp')):
        ob.hide_render = True
    if ob.type == 'MESH' and any(a.name in ('cm_part','_CM_PART') for a in ob.data.attributes):
        ob.hide_render = True
# Technical geometry comparison uses identical v1 lighting in both files.
for node in scene.world.node_tree.nodes:
    if node.type == 'BACKGROUND':
        node.inputs['Strength'].default_value = .018
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 3
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 1
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.resolution_x = 640
scene.render.resolution_y = 400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.frame_set(1)
camera = bpy.data.objects.new('T31_ReviewCamera',bpy.data.cameras.new('T31_ReviewCamera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 28
camera.data.clip_start = .05
camera.data.clip_end = 500
fill = bpy.data.objects.new('T31_ReviewFill',bpy.data.lights.new('T31_ReviewFill','AREA'))
scene.collection.objects.link(fill)
fill.data.energy = 250
fill.data.shape = 'DISK'
fill.data.size = 4
views = [
    ('seats',(28.8,2,-9.2),(34,3,-9.1)),
    ('ramp',(-53,-8,-7),(-50,-2,-5.6)),
    ('equipment',(1.6,9.4,-7.9),(-.7,9.4,-8.4)),
    ('columns',(38,1,-8.7),(43.15,6.63,-7)),
]
if len(sys.argv) > sys.argv.index('--')+2:
    views = [v for v in views if v[0] == sys.argv[sys.argv.index('--')+2]]
print('T31_RENDER_SETTINGS',json.dumps(dict(engine='CYCLES',device='CPU',samples=8,
      view=scene.view_settings.view_transform,exposure=scene.view_settings.exposure)),flush=True)
for name,location,target in views:
    camera.location = location
    camera.rotation_euler = (Vector(target)-Vector(location)).to_track_quat('-Z','Y').to_euler()
    fill.location = Vector(location)+Vector((0,0,.65))
    fill.rotation_euler = (Vector(target)-fill.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(HERE/f't31-{label}-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('T31_RENDERED',scene.render.filepath,flush=True)
