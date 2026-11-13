import bpy,bmesh,ast,math,json,numpy as np
from math import sin,cos,pi
from mathutils import Vector
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026');OUT=ROOT/'reference-match';REF=Path('D:/Blender/Blender/references/barclays-center/references/Arena')
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026'];col=bpy.data.collections['ReferenceMatch'];root=bpy.data.objects['REF_StageOrigin'];S=-9.1
mats={m.name[4:]:m for m in bpy.data.materials if m.name.startswith('REF_')};batches={}
src=ast.parse((ROOT/'build_scene.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'add','box','beam'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
src=ast.parse((OUT/'build-stage.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'mesh_obj','art'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
image=bpy.data.images.load(str(REF/'월드 2026 GEN.G·BLG 아레나 톱뷰.png'),check_existing=True);image.pack()
for name in ['RearGoldArt','RearBlueArt']:
    m=bpy.data.materials.new('REF_'+name);m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');im=nt.nodes.new('ShaderNodeTexImage');im.image=image
    em.inputs['Strength'].default_value=1.1;nt.links.new(im.outputs['Color'],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs['Surface']);mats[name]=m
for side in [-1,1]:
    old=bpy.data.objects['REF_WingLED__'+('GoldWaves' if side<0 else 'BlueWaves')];old.data.materials[0]=mats['ScreenBlack']
    if side<0:
        corners=[(-10.3,8.355,S+.70),(-4.15,8.355,S+1.35),(-5.45,8.355,S+4.9),(-11.65,8.355,S+5.35)]
        pixels=[(483,262),(681,262),(608,173),(440,154)]
    else:
        corners=[(4.15,8.355,S+1.35),(10.3,8.355,S+.70),(11.65,8.355,S+5.35),(5.45,8.355,S+4.9)]
        pixels=[(998,262),(1179,262),(1242,154),(1064,173)]
    art('BackdropArtwork_'+str(side),corners,pixels,'RearGoldArt' if side<0 else 'RearBlueArt',32,16)

# Match the scoreboard-to-deck ratio; keep its lower clearance fixed.
prefixes=('REF_Jumbotron','REF_HeaderLight','REF_Scoreboard','REF_ScreenUndersideLamps')
for o in col.objects:
    if o.name.startswith(prefixes) and o.type=='MESH':
        for v in o.data.vertices:v.co.x*=1.15;v.co.y*=1.15
    if o.name.startswith('REF_WorldsHeader'):
        o.location.x*=1.15;o.location.y*=1.15;o.data.size=.88
    if o.name=='REF_GrandFinal':o.data.size=.68

vol=next(n for n in mats['Atmosphere'].node_tree.nodes if n.type=='VOLUME_SCATTER')
vol.inputs['Density'].default_value=.0015;vol.inputs['Anisotropy'].default_value=.35
for o in col.objects:
    if o.type!='LIGHT':continue
    if o.data.type=='AREA' and hasattr(o.data,'volume_factor'):o.data.volume_factor=0
    if o.name.startswith('REF_BowlWash'):o.data.energy=650
    if o.name.startswith('REF_OverheadBeam'):
        i=int(o.name.rsplit('_',1)[1]);side=-1 if o.location.x<0 else 1
        o.location.z=13.2+(i%2)*.7
        target=Vector((side*(5+(i%4)*2.1),-6+i*.8,S))
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();o.data.energy=20000
    if o.name.startswith('REF_TeamKey'):o.data.energy=2800;o.location.z=S+6
    if o.name.startswith('REF_WingUplight'):o.data.energy=260
    if o.name=='REF_TrophySpecial':o.data.energy=900
for n in scene.world.node_tree.nodes:
    if n.type=='BACKGROUND':n.inputs['Strength'].default_value=.018
for n in mats['Deck'].node_tree.nodes:
    if n.type=='MAP_RANGE':n.inputs['To Min'].default_value=.12;n.inputs['To Max'].default_value=.20
for o in col.objects:
    if o.name.startswith('REF_CircularStage'):
        for p in o.data.polygons:
            if len(p.vertices)>4:p.use_smooth=False

# Local rectangular production rig under the preserved roof structure.
for x in [-24,-18,-12,-6,0,6,12,18,24]:
    for z in [14.0,14.6]:beam('StageRigChords',(x,-16,z),(x,16,z),.045,'Steel',8)
    for y in range(-16,16,2):
        beam('StageRigDiagonals',(x,y,14),(x,y+2,14.6),.022,'Silver',6)
for y in [-16,-8,0,8,16]:beam('StageRigCrossbeams',(-24,y,14.3),(24,y,14.3),.055,'Steel',8)
for (name,ma),(v,f) in batches.items():
    ob=mesh_obj(name+'__'+ma,v,f,ma);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()

camera=bpy.data.objects['REF_Camera_Front'];camera.location=(0,-36,1.1);camera.data.lens=32;camera.rotation_euler=(Vector((0,0,-2.3))-camera.location).to_track_quat('-Z','Y').to_euler()
g=next(n for n in scene.compositing_node_group.nodes if n.type=='GLARE');g.inputs['Strength'].default_value=.20;g.inputs['Threshold'].default_value=2.5
print('Reference artwork, atmospheric contrast, scoreboard proportion and local rig refined')
