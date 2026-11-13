import bpy,json,traceback
from pathlib import Path
root=Path('D:/Blender/Blender/barclays-worlds-2026/reference-match');s=bpy.data.scenes['Barclays • WORLDS 2026']
def render_views():
    done=[];hidden=[]
    try:
        s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=100;s.eevee.taa_render_samples=128
        s.render.image_settings.file_format='PNG'
        for name in ['Front','East','Rear','Top']:
            if name=='Top':
                prefixes=('REF_Jumbotron','REF_Header','REF_WorldsHeader','REF_Scoreboard','REF_ScreenUnderside','REF_StageRig','REF_Atmosphere')
                for o in bpy.data.collections['ReferenceMatch'].objects:
                    if o.name.startswith(prefixes):hidden.append((o,o.hide_render));o.hide_render=True
            s.camera=bpy.data.objects['REF_Camera_'+name];s.render.filepath=str(root/('final-'+name.lower()+'.png'))
            bpy.ops.render.render(write_still=True,scene=s.name);done.append(name)
            (root/'final-render-status.json').write_text(json.dumps({'done':done}),encoding='utf-8')
            for o,value in hidden:o.hide_render=value
            hidden=[]
    except Exception:
        (root/'final-render-status.json').write_text(json.dumps({'done':done,'error':traceback.format_exc()}),encoding='utf-8')
    finally:
        for o,value in hidden:o.hide_render=value
        s.camera=bpy.data.objects['REF_Camera_Front']
    return None
bpy.app.timers.register(render_views,first_interval=1)
print('Four review renders scheduled; Top is a temporary scoreboard/rig cutaway')
