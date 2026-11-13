import bpy,json,traceback
from pathlib import Path
from mathutils import Vector
root=Path('D:/Blender/Blender/barclays-worlds-2026')
scene=bpy.data.scenes['Barclays • WORLDS 2026']
camera=bpy.data.objects['InteriorDetail_Overview']
camera.location=(-36,-31,1.5)
camera.rotation_euler=(Vector((0,0,3.4))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=26

def render_final():
    old=(scene.camera,scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath,scene.eevee.taa_render_samples,scene.render.image_settings.file_format)
    done=[]
    try:
        scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
        scene.eevee.taa_render_samples=64;scene.render.image_settings.file_format='PNG'
        for name,filename in [('InteriorDetail_Overview','interior-overview.png'),('InteriorDetail_Equipment','interior-equipment.png'),('InteriorDetail_Audience','interior-audience.png')]:
            scene.camera=bpy.data.objects[name];scene.render.filepath=str(root/'interior-detail'/filename)
            bpy.ops.render.render(write_still=True,scene=scene.name)
            done.append(filename)
            (root/'interior-detail/final-render-status.json').write_text(json.dumps({'done':done}),encoding='utf-8')
    except Exception:
        (root/'interior-detail/final-render-status.json').write_text(json.dumps({'done':done,'error':traceback.format_exc()}),encoding='utf-8')
    finally:
        scene.camera,scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath,scene.eevee.taa_render_samples,scene.render.image_settings.file_format=old
    return None
bpy.app.timers.register(render_final,first_interval=1)
print('Final review render scheduled')
