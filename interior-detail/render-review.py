import bpy, json, traceback
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
scene=bpy.data.scenes['Barclays • WORLDS 2026']
specs=[('InteriorDetail_Overview',(-31,-27,-.1),(0,0,3.8),28,'interior-overview.png'),
       ('InteriorDetail_Equipment',(-10,-12,-4.1),(0,-6.3,-6.6),42,'interior-equipment.png'),
       ('InteriorDetail_Audience',(26,-12,-7.0),(33,-13,-6.9),52,'interior-audience.png')]
for name,loc,target,lens,filename in specs:
    assert not bpy.data.objects.get(name)
    data=bpy.data.cameras.new(name);data.lens=lens;data.clip_start=.05;data.clip_end=1000
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()

def render_reviews():
    old=(scene.camera,scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath,scene.eevee.taa_render_samples,scene.render.image_settings.file_format)
    state=[]
    try:
        scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
        scene.eevee.taa_render_samples=32;scene.render.image_settings.file_format='PNG'
        for name,loc,target,lens,filename in specs:
            scene.camera=bpy.data.objects[name];scene.render.filepath=str(ROOT/'interior-detail'/filename)
            bpy.ops.render.render(write_still=True,scene=scene.name)
            state.append(filename)
            (ROOT/'interior-detail/render-status.json').write_text(json.dumps({'done':state}),encoding='utf-8')
    except Exception:
        (ROOT/'interior-detail/render-status.json').write_text(json.dumps({'done':state,'error':traceback.format_exc()}),encoding='utf-8')
    finally:
        scene.camera,scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath,scene.eevee.taa_render_samples,scene.render.image_settings.file_format=old
    return None
bpy.app.timers.register(render_reviews,first_interval=1)
print('Scheduled three review renders')
