import bpy, json, sys, traceback
from pathlib import Path

ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/concourse-reference')
scene=bpy.data.scenes['Concourse Reference Review']
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['OriginalView','CounterView']
state={'done':[],'status':'running'}
try:
    for view in args:
        scene=bpy.data.scenes['Concourse Cutaway Review' if view=='CutawayView' else 'Concourse Reference Review']
        hidden=[]
        if view=='CutawayView':
            for name in ['Ceiling','Ceiling edge trim','Ceiling light housings','Ceiling light diffusers']:
                ob=bpy.data.objects['CCR_'+name];hidden.append((ob,ob.hide_render));ob.hide_render=True
        scene.camera=bpy.data.objects['CCR_'+view]
        scene.render.filepath=str(ROOT/(view+'.png'))
        bpy.ops.render.render(write_still=True,scene=scene.name)
        for ob,old in hidden:ob.hide_render=old
        state['done'].append(view)
        (ROOT/'render-status.json').write_text(json.dumps(state),encoding='utf-8')
    state['status']='complete'
except Exception:
    state['status']='failed';state['error']=traceback.format_exc()
    raise
finally:
    (ROOT/'render-status.json').write_text(json.dumps(state),encoding='utf-8')
