"""Prepare four-body pose sheets and motion strips; render with the T35 GPU lock."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
assert json.loads((ROOT/'_workspace/gpu-lock.json').read_text())['owner'] == 'T35'
assets = bpy.data.scenes['FanAssets']
rig = bpy.data.objects['FanRig']
IDS = ('fan_f1','fan_f2','fan_m1','fan_m2')
peaks = [('Idle',23),('Walk',0),('Run',2),('Jump',10.8),('Sit',24),
         ('Emote_CheerClap',32),('Emote_Heart',55),('Emote_Angry',26),('Emote_EggThrow',40)]
old = [s for s in bpy.data.scenes if s.name.startswith('T35-')]
print(json.dumps({'replace_review_scenes':[s.name for s in old]}))
for review in old:
    for ob in list(review.objects):
        data = ob.data
        kind = ob.type
        bpy.data.objects.remove(ob,do_unlink=True)
        if data.users == 0:
            {'MESH':bpy.data.meshes,'CAMERA':bpy.data.cameras,'LIGHT':bpy.data.lights}[kind].remove(data)
    bpy.data.scenes.remove(review)


def posed_mesh(char,name,frame):
    bpy.context.window.scene = assets
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    assets.frame_set(int(frame),subframe=frame-int(frame))
    ob = bpy.data.objects[char]
    ob.hide_set(False)
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(ob.evaluated_get(dg),depsgraph=dg,preserve_all_data_layers=True)


def review_scene(suffix,columns,rows):
    review = bpy.data.scenes.new('T35-'+suffix)
    review.render.engine = 'BLENDER_EEVEE'
    review.render.resolution_x, review.render.resolution_y = (1024,1120) if columns == 4 else (1280,1024)
    review.render.resolution_percentage = 100
    review.render.image_settings.file_format = 'PNG'
    review.render.filepath = str(OUT/('anim-'+suffix+'.png'))
    review.world = bpy.data.scenes['FanSheet'].world
    for original in bpy.data.scenes['FanSheet'].objects:
        if original.type == 'LIGHT':
            light = original.copy()
            review.collection.objects.link(light)
            light.location.x -= 2
    camera = bpy.data.objects.new(review.name+'-camera',bpy.data.cameras.new(review.name+'-camera'))
    review.collection.objects.link(camera)
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 10.2 if columns == 4 else 12.8
    target = Vector(((columns-1)*.95,0,1.1-(rows-1)*1.2))
    camera.location = target+Vector((0,-20,0))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    review.camera = camera
    return review


def instance(review,mesh,label,col,row,angle=0):
    ob = bpy.data.objects.new(label,mesh)
    review.collection.objects.link(ob)
    ob.location = (col*1.9,0,-row*2.4)
    ob.rotation_euler.z = angle
    return ob


reviews = []
for name,frame in peaks:
    suffix = name.lower().replace('_','-')
    review = review_scene(suffix,4,4)
    for col,char in enumerate(IDS):
        mesh = posed_mesh(char,name,frame)
        for row,angle in enumerate([0,-math.pi/2,math.pi,-.65]):
            ob = instance(review,mesh,f'{char}-{row}',col,row,angle)
    reviews.append(review)

for suffix,names,frames in [
    ('locomotion-strip',['Walk','Run','Jump','Sit'],[[0,3,6,9,12],[0,2,4,8,12],[0,4,10.8,17,21.6],[0,6,12,18,24]]),
    ('emote-strip',['Emote_CheerClap','Emote_Heart','Emote_Angry','Emote_EggThrow'],
     [[0,20,32,38,68],[0,16,34,76,91],[0,15,26,37,49],[0,30,35,40,46]])]:
    review = review_scene(suffix,5,4)
    for row,(name,sample_frames) in enumerate(zip(names,frames)):
        for col,frame in enumerate(sample_frames):
            mesh = posed_mesh('fan_f1',name,frame)
            angle = -.85 if suffix == 'locomotion-strip' else -.2
            instance(review,mesh,f'{name}-{frame}',col,row,angle)
            if name == 'Emote_EggThrow' and frame <= 40:
                egg = bpy.data.objects['Prop_Egg'].copy()
                egg.name = f'egg-preview-{frame}'
                review.collection.objects.link(egg)
                egg.location = rig.pose.bones['prop_R'].matrix @ Vector((0,0,-.055))
                from mathutils import Matrix
                egg.location = Matrix.Rotation(angle,3,'Z') @ egg.location + Vector((col*1.9,0,-row*2.4))
    reviews.append(review)

bpy.context.window.scene = assets
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
assets.frame_set(0)
for char in IDS:
    bpy.data.objects[char].hide_set(char != 'fan_f1')
    bpy.data.objects[char].hide_render = char != 'fan_f1'
queue = list(reviews)
rendered = []
(OUT/'animation-render-status.json').write_text(json.dumps({'ok':False,'rendered':[]}),encoding='utf-8')


def render_next():
    assert json.loads((ROOT/'_workspace/gpu-lock.json').read_text())['owner'] == 'T35'
    review = queue.pop(0)
    try:
        bpy.ops.render.render(write_still=True,scene=review.name)
        rendered.append(Path(review.render.filepath).name)
        (OUT/'animation-render-status.json').write_text(json.dumps({'ok':not queue,'rendered':rendered}),encoding='utf-8')
    except Exception as error:
        (OUT/'animation-render-status.json').write_text(json.dumps({'ok':False,'error':str(error),'rendered':rendered}),encoding='utf-8')
        return None
    return .1 if queue else None


bpy.app.timers.register(render_next,first_interval=.5)
print(json.dumps({'ok':True,'rendering':[s.name for s in reviews]}))
