import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/concourse-reference')

def principled(name):
    return next(n for n in bpy.data.materials['CCR_'+name].node_tree.nodes if n.type=='BSDF_PRINCIPLED')

p=principled('Soft black powdercoat');p.inputs['Base Color'].default_value=(.004,.0045,.004,1);p.inputs['Metallic'].default_value=.22
fm=bpy.data.materials['CCR_Charcoal stone floor with 1200mm joints'];ns=fm.node_tree.nodes;lk=fm.node_tree.links
brick=next(n for n in ns if n.type=='TEX_BRICK')
brick.inputs['Color1'].default_value=(.047,.045,.041,1);brick.inputs['Color2'].default_value=(.039,.037,.034,1)
brick.inputs['Mortar'].default_value=(.02,.019,.017,1)
p=next(n for n in ns if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.265
b=next(n for n in ns if n.type=='BUMP');b.invert=True
fine=ns.new('ShaderNodeBump');fine.inputs['Strength'].default_value=.12;fine.inputs['Distance'].default_value=.002
lk.new(next(n for n in ns if n.type=='TEX_NOISE').outputs['Fac'],fine.inputs['Height'])
lk.new(b.outputs['Normal'],fine.inputs['Normal']);lk.new(fine.outputs['Normal'],p.inputs['Normal'])

gm=bpy.data.materials['CCR_Clear display glass'];ns=gm.node_tree.nodes;lk=gm.node_tree.links
p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.98,.99,1,1);p.inputs['Roughness'].default_value=.045
p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.45
lk.new(p.outputs[0],next(n for n in ns if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
gm.use_raytrace_refraction=True
for n in list(ns):
    if n.type in ['MIX_SHADER','BSDF_TRANSPARENT']:ns.remove(n)

im=bpy.data.images.load(str(ROOT/'wide-menu-atlas.png'),check_existing=True);im.pack()
for name,offset in [('Coffee menu image',.5),('Snack menu image',0)]:
    m=bpy.data.materials['CCR_'+name];ns=m.node_tree.nodes
    next(n for n in ns if n.type=='TEX_IMAGE').image=im
    next(n for n in ns if n.type=='VECT_MATH' and n.operation=='MULTIPLY').inputs[1].default_value=(.994,.494,1)
    next(n for n in ns if n.type=='VECT_MATH' and n.operation=='ADD').inputs[1].default_value=(.003,offset+.003,0)
    next(n for n in ns if n.type=='BSDF_PRINCIPLED').inputs['Roughness'].default_value=.65

for suffix,centers in [('',[1.9,5.7]),('_Compact',[-1.9,1.9])]:
    ob=bpy.data.objects['CCR_Menu monitor frames'+suffix]
    for v in ob.data.vertices:
        cx=min(centers,key=lambda x:abs(v.co.x-x))
        v.co.x=cx+(v.co.x-cx)*(2.18/1.34);v.co.y=.58+(v.co.y-2.32);v.co.z=2.45+(v.co.z-2.12)*(.74/1.10)
    ob.data.update()
    ob=bpy.data.objects['CCR_Menu images'+suffix]
    for v in ob.data.vertices:
        cx=min(centers,key=lambda x:abs(v.co.x-x))
        v.co.x=cx+(v.co.x-cx)*(2.1/1.27);v.co.y=.505;v.co.z=2.45+(v.co.z-2.12)*(.68/1.03)
    ob.data.update()
    for group in ['Popcorn kernels','Pastries','Hot dog buns','Hot dog sausages','Plant leaves']:
        ob=bpy.data.objects.get('CCR_'+group+suffix)
        if ob:
            for p in ob.data.polygons:p.use_smooth=True
    for group in ['Snack packets','Popcorn canopy']:
        ob=bpy.data.objects.get('CCR_'+group+suffix)
        if ob:
            mod=ob.modifiers.new('Soft formed corners','BEVEL');mod.width=.009;mod.segments=3

for name in ['Collide_Columns__concrete','Collide_LobbyColumns__steel']:
    for p in bpy.data.objects[name].data.polygons:p.use_smooth=abs(p.normal.z)<.1

for name,loc,target,lens in [
    ('OriginalView',(-68,7.8,1.72),(-81,11.4,1.85),24),
    ('ReverseView',(-89.3,7.7,1.72),(-75,11.2,1.8),24),
    ('CounterView',(-74.5,6.7,1.7),(-75.3,12.4,1.85),26)]:
    ob=bpy.data.objects['CCR_'+name];ob.location=loc;ob.data.lens=lens
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()

col=bpy.data.collections['CCR_Concourse']
data=bpy.data.cameras.new('CCR_ExitConnection');data.lens=25;data.clip_start=.05;data.clip_end=600
ob=bpy.data.objects.new(data.name,data);col.objects.link(ob);ob.location=(-58,0,.7)
ob.rotation_euler=(Vector((-80,0,1.65))-ob.location).to_track_quat('-Z','Y').to_euler()

review=bpy.data.scenes['Concourse Reference Review'];review.eevee.taa_render_samples=96
review.render.resolution_x=1440;review.render.resolution_y=960
review.camera=bpy.data.objects['CCR_ReverseView']
print('Concourse material, display, column and camera finishing complete')
