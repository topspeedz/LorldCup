import bpy,math
from mathutils import Vector
from pathlib import Path
s=bpy.context.scene
v=[];f=[]
# Continue the weathered-steel skin over the upper fascia instead of leaving the backing exposed.
for row in range(5):
    for i in range(256):
        ts=[2*math.pi*(i+.02)/256,2*math.pi*(i+.98)/256];base=26.0+row*.78;k=len(v)
        for z in [base,base+.70]:
            for t in ts:v.append((95.6*math.cos(t),72.6*math.sin(t),z))
        f.append((k,k+1,k+3,k+2))
me=bpy.data.meshes.new('Upper_corten_skin');me.from_pydata(v,[],f);me.update()
o=bpy.data.objects.new('Upper_corten_skin',me);s.collection.objects.link(o)
for i in range(8):me.materials.append(bpy.data.materials['corten'+str(i)])
for p in me.polygons:p.material_index=(p.index*7)%8
ma=bpy.data.materials.new('Blue_light_haze');ma.use_nodes=True
bs=next(n for n in ma.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.055,.25,1,1);bs.inputs['Alpha'].default_value=.025
bs.inputs['Emission Color'].default_value=(.055,.25,1,1);bs.inputs['Emission Strength'].default_value=2
methods=[i.identifier for i in ma.bl_rna.properties['surface_render_method'].enum_items]
ma.surface_render_method=next((i for i in methods if 'DITHER' in i),methods[0])
v=[];f=[]
for i in range(16):
    t=i*2*math.pi/16;a=Vector((27*math.cos(t),23*math.sin(t),21.9));b=Vector((7*math.cos(t+.7),7*math.sin(t+.7),-7.5))
    axis=(b-a).normalized();u=axis.cross(Vector((0,0,1))).normalized();w=axis.cross(u);k=len(v)
    for p,r in [(a,.09),(b,1.5)]:
        for j in range(12):v.append(tuple(p+r*(u*math.cos(j*math.pi/6)+w*math.sin(j*math.pi/6))))
    for j in range(12):f.append((k+j,k+(j+1)%12,k+(j+1)%12+12,k+j+12))
me=bpy.data.meshes.new('Stage_light_beams');me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new('Stage_light_beams',me);s.collection.objects.link(o);me.materials.append(ma)
print('Upper facade panels and blue stage beams added')
