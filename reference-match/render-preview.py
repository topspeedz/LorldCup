import bpy,json,traceback
from pathlib import Path
root=Path('D:/Blender/Blender/barclays-worlds-2026/reference-match');s=bpy.data.scenes['Barclays • WORLDS 2026']
n=next(n for n in bpy.data.node_groups['REF_EventBloom'].nodes if n.type=='GLARE')
n.inputs['Type'].default_value='Fog Glow';n.inputs['Threshold'].default_value=2;n.inputs['Strength'].default_value=.28;n.inputs['Size'].default_value=.30
def render():
    try:
        s.camera=bpy.data.objects['REF_Camera_Front'];s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.eevee.taa_render_samples=32
        s.render.image_settings.file_format='PNG';s.render.filepath=str(root/'preview-front.png')
        bpy.ops.render.render(write_still=True,scene=s.name)
        (root/'render-status.json').write_text(json.dumps({'done':'preview-front.png'}),encoding='utf-8')
    except Exception:
        (root/'render-status.json').write_text(json.dumps({'error':traceback.format_exc()}),encoding='utf-8')
    return None
bpy.app.timers.register(render,first_interval=1)
print('Preview scheduled')
