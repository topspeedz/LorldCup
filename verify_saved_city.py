import bpy,json,contextlib,io
from pathlib import Path
ROOT=Path(r'D:/Blender/Blender/barclays-worlds-2026')
s=bpy.context.scene
assert s.name=='Barclays • WORLDS 2026',s.name
assert 'Walk_EntryRamp__concrete' in s.objects
assert len(s.objects)>=239,len(s.objects)
camera=s.objects['04_City_Exterior']
assert abs(camera.location.x+225)<.01,tuple(camera.location)
s.camera=camera;s.render.filepath=str(ROOT/'renders/city-exterior.png')
bpy.ops.render.render(write_still=True)
for ob in list(s.objects):
    if ob.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'web/arena.glb'),use_active_scene=True,export_format='GLB',export_cameras=False,export_lights=False,export_apply=True)
print(json.dumps({'verified_saved_scene':s.name,'objects':len(s.objects),'render_saved':True,'web_export_saved':True}))
