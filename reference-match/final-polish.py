import bpy,bmesh,ast,math,json,numpy as np
from math import sin,cos,pi
from mathutils import Vector
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026');OUT=ROOT/'reference-match';REF=Path('D:/Blender/Blender/references/barclays-center/references/Arena')
scene=bpy.data.scenes['Barclays • WORLDS 2026'];col=bpy.data.collections['ReferenceMatch'];root=bpy.data.objects['REF_StageOrigin'];S=-9.1
mats={m.name[4:]:m for m in bpy.data.materials if m.name.startswith('REF_')};batches={}
src=ast.parse((OUT/'build-stage.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'mesh_obj','art'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))

for o in col.objects:
    if o.name.startswith(('REF_GrandFinalFascia','REF_GrandFinalTrim','REF_GrandFinal')):o.location.z+=.9
    if o.name=='REF_WorldsCrest':o.location.z+=.7
    if o.type=='LIGHT' and o.name.startswith('REF_OverheadBeam'):
        i=int(o.name.rsplit('_',1)[1]);side=-1 if o.location.x<0 else 1
        if i<4:o.location=(side*(18+i*2),-15+i*.7,13.2);target=Vector((side*(3+i*2),-10-i*.8,S))
        else:o.location=(side*(19+(i-4)*1.5),4+(i-4)*2,13.2);target=Vector((side*13,2+(i-4)*1.5,S))
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();o.data.energy=24000
    if o.type=='LIGHT' and o.name.startswith('REF_TeamKey'):o.data.energy=1800
    if o.name.startswith('REF_RibbonBrand'):
        o.rotation_euler.z=math.atan2(-o.location.x,o.location.y);o.location.x*=.994;o.location.y*=.994;o.data.materials[0]=mats['White']
    if o.name.startswith('REF_FanLightsticks'):
        ma=o.data.materials[0].copy();ma.name='REF_Fan_'+o.data.materials[0].name
        p=next(n for n in ma.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Emission Strength'].default_value=2.2;o.data.materials[0]=ma
        for start in range(0,len(o.data.vertices),10):
            vs=[o.data.vertices[start+j] for j in range(10)];c=sum((v.co for v in vs),Vector())/10
            for v in vs:v.co=c+(v.co-c)*.62

# Matte-free crest alpha makes the photographed emblem float on actual black panel geometry.
nt=mats['Artwork_Crest'].node_tree;out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL');em=next(n for n in nt.nodes if n.type=='EMISSION');im=next(n for n in nt.nodes if n.type=='TEX_IMAGE')
mask=nt.nodes.new('ShaderNodeMath');mask.operation='GREATER_THAN';mask.inputs[1].default_value=.18
transparent=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader')
nt.links.new(im.outputs['Color'],mask.inputs[0]);nt.links.new(mask.outputs[0],mix.inputs[0]);nt.links.new(transparent.outputs[0],mix.inputs[1]);nt.links.new(em.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs['Surface'])
image=bpy.data.images.get('Final Arena.png')
for j in range(4):
    o=bpy.data.objects['REF_WorldsHeader_'+str(j)]
    tangent=Vector((cos(o.rotation_euler.z),sin(o.rotation_euler.z),0));normal=Vector((tangent.y,-tangent.x,0))
    center=o.location.copy()-tangent*3.8+normal*.02;o.location+=tangent*.6
    corners=[tuple(center-tangent*.40+Vector((0,0,-.42))),tuple(center+tangent*.40+Vector((0,0,-.42))),tuple(center+tangent*.40+Vector((0,0,.42))),tuple(center-tangent*.40+Vector((0,0,.42)))]
    art('HeaderCrest_'+str(j),corners,[(798,554),(884,554),(884,493),(798,493)],'Artwork_Crest',8,8)

# Full team ribbon graphics follow the existing bowl radius, inset toward the audience floor.
image=bpy.data.images.get('월드 2026 GEN.G·BLG 아레나 톱뷰.png')
for tier,rx,ry,z in [(0,45.64,55.64,-.01),(1,70.64,85.64,20.69)]:
    for j in range(64):
        a=2*pi*j/64;b=2*pi*(j+1)/64;mid=(a+b)/2;gold=cos(mid)<0
        corners=[(rx*cos(a),ry*sin(a),z+.02),(rx*cos(b),ry*sin(b),z+.02),(rx*cos(b),ry*sin(b),z+.55),(rx*cos(a),ry*sin(a),z+.55)]
        pixels=[(483,262),(681,262),(608,173),(440,154)] if gold else [(998,262),(1179,262),(1242,154),(1064,173)]
        art('RibbonProgram_'+str(tier)+'_'+str(j),corners,pixels,'RearGoldArt' if gold else 'RearBlueArt',8,2)

# Short physical transition joins the elevated runway to the original entry-ramp landing.
v=[(-1.5,-29,S+.2),(1.5,-29,S+.2),(1.5,-31,-9.375),(-1.5,-31,-9.375),(-1.5,-29,S+.08),(1.5,-29,S+.08),(1.5,-31,-9.495),(-1.5,-31,-9.495)]
f=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
ob=mesh_obj('RunwayTransition',v,f,'Deck');bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
c=bpy.data.objects['REF_Camera_Front'];c.location=(0,-37,-5.6);c.data.lens=30.5;c.rotation_euler=(Vector((0,0,.45))-c.location).to_track_quat('-Z','Y').to_euler()
print('Reference composition, ribbon artwork, crest masks and beam directions completed')
