import bpy, math, bmesh, random
from mathutils import Vector

# Reflection plus Fresnel transparency keeps multiple display panes clear in Eevee.
gm=bpy.data.materials['CCR_Clear display glass'];ns=gm.node_tree.nodes;lk=gm.node_tree.links
p=next(n for n in ns if n.type=='BSDF_PRINCIPLED');p.inputs['Transmission Weight'].default_value=0
p.inputs['Base Color'].default_value=(1,1,1,1);p.inputs['Metallic'].default_value=1;p.inputs['Roughness'].default_value=.075
tr=ns.new('ShaderNodeBsdfTransparent');fr=ns.new('ShaderNodeFresnel');fr.inputs['IOR'].default_value=1.42
mix=ns.new('ShaderNodeMixShader');lk.new(fr.outputs[0],mix.inputs[0]);lk.new(tr.outputs[0],mix.inputs[1]);lk.new(p.outputs[0],mix.inputs[2])
lk.new(mix.outputs[0],next(n for n in ns if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
gm.surface_render_method=next(i.identifier for i in gm.bl_rna.properties['surface_render_method'].enum_items if i.identifier=='BLENDED')
gm.use_raytrace_refraction=False;gm.use_transparent_shadow=True
gm['implementation']='Thin architectural display glass: Fresnel reflection and clear transmission, no optical distortion.'

for d in bpy.data.lights:
    if not d.name.startswith('CCR_') or 'Cutaway' in d.name:continue
    d.use_custom_distance=True
    if 'Ceiling soft wash' in d.name:
        d.cutoff_distance=13;d.energy=360 if 'Compact' not in d.name else 160
    elif 'toe wash' in d.name:
        d.cutoff_distance=2.6;d.use_shadow=False;d.energy=9;d.color=(1,.46,.17)
    else:d.cutoff_distance=6;d.energy=80

amber=bpy.data.materials['CCR_3000K strip diffuser'].copy();amber.name='CCR_Amber joinery strip'
p=next(n for n in amber.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(1,.45,.16,1);p.inputs['Emission Color'].default_value=(1,.45,.16,1);p.inputs['Emission Strength'].default_value=2.5
for o in bpy.data.objects:
    if o.type=='MESH' and o.name.startswith(('CCR_Counter toe light','CCR_Counter upper light','CCR_Under fascia strip','CCR_Display warm strip','CCR_Popcorn lamp')):
        for i,m in enumerate(o.data.materials):
            if m.name=='CCR_3000K strip diffuser':o.data.materials[i]=amber

m=bpy.data.materials['CCR_Charcoal stone floor with 1200mm joints']
p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.21;p.inputs['Coat Weight'].default_value=.15;p.inputs['Coat Roughness'].default_value=.25
p=next(n for n in bpy.data.materials['CCR_Olive upholstered banquette'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.085,.10,.035,1)

# Elongated, upward-tilted foliage replaces the first pass's circular leaf profile.
ob=bpy.data.objects['CCR_Plant leaves'];bm=bmesh.new();bm.from_mesh(ob.data);remaining=set(bm.verts);rng=random.Random(29)
while remaining:
    first=next(iter(remaining));component={first};stack=[first]
    while stack:
        v=stack.pop()
        for e in v.link_edges:
            other=e.other_vert(v)
            if other not in component:component.add(other);stack.append(other)
    remaining-=component;center=sum((v.co for v in component),Vector())/len(component);angle=rng.random()*math.tau
    for v in component:
        d=v.co-center;dx=d.x*1.1;dy=d.y*2.0;dz=d.z*.65+dy*.48
        v.co=center+Vector((dx*math.cos(angle)-dy*math.sin(angle),dx*math.sin(angle)+dy*math.cos(angle),dz))
bm.to_mesh(ob.data);bm.free();ob.data.update()

cam=bpy.data.objects['CCR_ExitConnection'];cam.location=(-89,0,1.7);cam.data.lens=24
cam.rotation_euler=(Vector((-60,0,1.8))-cam.location).to_track_quat('-Z','Y').to_euler()

# Counter framing puts the existing structural column between the two shops.
cam=bpy.data.objects['CCR_CounterView'];cam.location=(-74.9,8.05,1.72);cam.data.lens=22
cam.rotation_euler=(Vector((-75.2,12.4,1.8))-cam.location).to_track_quat('-Z','Y').to_euler()
print('Clear display glass, contained light influence, amber joinery and final framing applied')
