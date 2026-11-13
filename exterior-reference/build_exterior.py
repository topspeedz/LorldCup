"""Photo-derived exterior only; local X is facade width, local Y points into arena."""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/exterior-reference')
scene=bpy.context.scene
rng=random.Random(1126)
assert 'EXR_Architecture' not in bpy.data.collections, 'Already built; do not duplicate'
col=bpy.data.collections.new('EXR_Architecture');scene.collection.children.link(col)
archive=bpy.data.collections.new('EXR_PreviousExterior');scene.collection.children.link(archive)
archive.hide_render=True;archive.hide_viewport=True
prefixes=('Corten_panels','Oculus_','Upper_corten_skin','Roof__green','Roof_seams__','Barclays_sign')
replaced=[]
for ob in list(scene.objects):
    if ob.name.startswith(prefixes) and not any(c.hide_render for c in ob.users_collection):
        replaced.append(ob.name)
        for c in list(ob.users_collection):c.objects.unlink(ob)
        archive.objects.link(ob)
def signature(ob):
    h=hashlib.sha256(str((ob.type,tuple(tuple(r) for r in ob.matrix_world),ob.hide_render)).encode())
    if ob.type=='MESH':
        import array
        a=array.array('f',[0])* (len(ob.data.vertices)*3);ob.data.vertices.foreach_get('co',a);h.update(a.tobytes())
        h.update(str((len(ob.data.polygons),[m.name if m else None for m in ob.data.materials])).encode())
    return h.hexdigest()
preserved={o.name:signature(o) for o in scene.objects if o.name not in replaced}
(ROOT/'preserved-before.json').write_text(json.dumps(preserved))
mats=[]; batches={}
def mat(name,c,metal=0,rough=.5,emission=0):
    m=bpy.data.materials.new('EXR_'+name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*c,1);mats.append(m);return len(mats)-1
rust=[]
for i in range(9):
    idx=mat('Weathered steel %02d'%i,(.16+i*.013,.042+i*.0048,.016+i*.0025),.28,.73);rust.append(idx)
    m=mats[idx];ns=m.node_tree.nodes;lk=m.node_tree.links;p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    tex=ns.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=3.8;tex.inputs['Detail'].default_value=4
    coord=ns.new('ShaderNodeTexCoord');lk.new(coord.outputs['Object'],tex.inputs['Vector'])
    ramp=ns.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[1].position=.82
    base=p.inputs['Base Color'].default_value[:3]
    ramp.color_ramp.elements[0].color=(*(v*.48 for v in base),1);ramp.color_ramp.elements[1].color=(*(v*1.4 for v in base),1)
    lk.new(tex.outputs['Fac'],ramp.inputs[0]);lk.new(ramp.outputs['Color'],p.inputs['Base Color'])
    fine=ns.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=125;fine.inputs['Detail'].default_value=2
    lk.new(coord.outputs['Object'],fine.inputs['Vector']);b=ns.new('ShaderNodeBump');b.inputs['Strength'].default_value=.25;b.inputs['Distance'].default_value=.012
    lk.new(fine.outputs['Fac'],b.inputs['Height']);lk.new(b.outputs['Normal'],p.inputs['Normal'])
dark=mat('Panel recesses',(.023,.015,.011),.35,.78)
steel=mat('Glazing bronze mullions',(.06,.065,.058),.75,.32)
glass=mat('Blue grey architectural glass',(.12,.22,.25),.65,.16)
warm=mat('Recessed warm light',(.95,.59,.33),.1,.3,2.5)
pink=mat('Soft rose panel light',(.85,.46,.43),0,.4,1.7)
cyan=mat('Barclays turquoise',(.018,.48,.67),.3,.3,.28)
white=mat('Sign white face',(.82,.89,.87),.35,.34,.15)
led=mat('Unbranded oculus LED',(.075,.26,.32),.1,.42,.8)
green=mat('Sedum roof',(.11,.15,.028),0,.94)
m=mats[green];ns=m.node_tree.nodes;lk=m.node_tree.links;p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
n=ns.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=75;n.inputs['Detail'].default_value=3
r=ns.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(.024,.045,.012,1);r.color_ramp.elements[1].color=(.24,.27,.055,1)
lk.new(n.outputs['Fac'],r.inputs[0]);lk.new(r.outputs[0],p.inputs['Base Color'])
b=ns.new('ShaderNodeBump');b.inputs['Strength'].default_value=.45;b.inputs['Distance'].default_value=.08;lk.new(n.outputs['Fac'],b.inputs['Height']);lk.new(b.outputs[0],p.inputs['Normal'])
def world(p):return (p[1],-p[0],p[2])
def add(group,points,faces,mi):
    vs,fs,ms=batches.setdefault(group,([],[],[]));k=len(vs);vs.extend(world(p) for p in points);fs.extend(tuple(k+i for i in f) for f in faces);ms.extend([mi]*len(faces))
cube=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def slab(group,points,mi,thick=.055):
    normal=(Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0])).normalized()
    add(group,points+[tuple(Vector(p)-normal*thick) for p in points],cube,mi)
def box(group,p,size,mi):
    x,y,z=p;a,b,c=[v/2 for v in size]
    add(group,[(x+u*a,y+v*b,z+w*c) for u,v,w in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],cube,mi)
def body(t,z,offset=0):
    # Existing arena footprint and interior clearance remain fixed.
    swell=1.0+1.6*sin((z-8)/32*pi)
    return ((74.5+swell+offset)*cos(t),(98+swell+offset)*sin(t),z)
def wave(t):return 2.1*sin(t+.65)+1.4*cos(2*t-.4)
N=352
for i in range(N):
    a=2*pi*i/N;b=2*pi*(i+1)/N;t=(a+b)/2
    for band,lo,hi,rows in [(0,8.4,18.8,13),(1,23.5,38.5,19)]:
        if band==0 and sin(t)<-.62:continue
        for j in range(rows):
            def pt(tt,f,off=0):return body(tt,lo+(hi-lo)*f+wave(tt),off)
            u=j/rows;v=(j+.86)/rows
            # Folded, projecting lower edge leaves a genuine recessed horizontal slot.
            pts=[pt(a+.00035,u,.19),pt(b-.00035,u,.19),pt(b-.00035,v,-.07),pt(a+.00035,v,-.07)]
            slab('Folded corten facade',pts,rng.choice(rust),.07)
            if (i*7+j*13)%19<3:
                slab('Panel slot lights',[pt(a+.001,u-.035,-.12),pt(b-.001,u-.035,-.12),pt(b-.001,u-.011,-.12),pt(a+.001,u-.011,-.12)],pink,.025)
        slab('Dark rainscreen backing',[pt(a,0,-.22),pt(b,0,-.22),pt(b,1,-.22),pt(a,1,-.22)],dark,.06)
    slab('Continuous glass belt',[body(a,18.8+wave(a)),body(b,18.8+wave(b)),body(b,23.5+wave(b)),body(a,23.5+wave(a))],glass,.06)
    if i%2==0:
        slab('Belt vertical mullions',[body(a,18.8+wave(a),.1),body(a+.0012,18.8+wave(a),.1),body(a+.0012,23.5+wave(a),.1),body(a,23.5+wave(a),.1)],steel,.06)
    if i%4==0:
        slab('Belt light fixtures',[body(a+.003,19.6+wave(a),.12),body(a+.0043,19.6+wave(a),.12),body(a+.0043,22.5+wave(a),.12),body(a+.003,22.5+wave(a),.12)],warm,.025)
# Broad asymmetrical canopy, with a real sky opening and a diving left return.
def outer(t):
    x=66*math.copysign(abs(cos(t))**.62,cos(t));y=-104+26*math.copysign(abs(sin(t))**.70,sin(t))
    drop=25*math.exp(-((math.atan2(sin(t-pi),cos(t-pi)))/.40)**2)
    return Vector((x,y,29.4-drop+.7*sin(t)))
def inner(t):
    x=-8+43*cos(t);y=-109+15*sin(t)
    return Vector((x,y,25.6+.065*x-.35*(y+109)))
def canopy(t,u,lower=False):
    p=outer(t).lerp(inner(t),u)
    if lower:p.z-=6.2*(1-u)+3.0*u
    return tuple(p)
CN=256;CR=12
for i in range(CN):
    a=2*pi*i/CN;b=2*pi*(i+1)/CN
    for lower in (False,True):
        for j in range(CR):
            u=(j+.008)/CR;v=(j+.992)/CR
            slab('Canopy soffit panels' if lower else 'Canopy upper panels',[canopy(a+.0002,u,lower),canopy(b-.0002,u,lower),canopy(b-.0002,v,lower),canopy(a+.0002,v,lower)],rng.choice(rust),.07)
    for j in range(8):
        def edge(t,f):return tuple(Vector(canopy(t,0,True)).lerp(Vector(canopy(t,0)),f))
        u=(j+.08)/8;v=(j+.91)/8
        slab('Canopy fascia louvers',[edge(a+.0002,u),edge(b-.0002,u),edge(b-.0002,v),edge(a+.0002,v)],rng.choice(rust),.14)
    slab('Canopy fascia backing',[canopy(a,.004,True),canopy(b,.004,True),canopy(b,.004),canopy(a,.004)],dark,.04)
    # All opening walls follow the same contour; no filled disk crosses the oculus.
    slab('Oculus inner LED ribbon',[canopy(a,1,True),canopy(b,1,True),canopy(b,1),canopy(a,1)],led,.09)
    if i%4==0:
        p=Vector(canopy(a,.55,True));box('Canopy recessed downlights',p,(.24,.24,.03),warm)
# Recessed curtain wall behind the canopy; leave central existing entry route open.
for i in range(48):
    x=-59.5+i*2.5;y=-88+3*(abs(x)/60)**2
    for row in range(7):
        if row==0 and abs(x)<6:continue
        box('Entrance glazing',(x,y,1.5+row*3),(2.42,.12,2.92),glass)
    if abs(x)>6:box('Entrance mullions',(x-1.25,y-.12,10.5),(.065,.14,21),steel)
    for z in [3,6,9,12,15,18,21]:box('Entrance transoms',(x,y-.13,z),(2.5,.14,.065),steel)
# Shallow planted roof above the untouched structural ceiling.
for j in range(24):
    u=j/24;v=(j+1)/24
    for i in range(192):
        a=2*pi*i/192;b=2*pi*(i+1)/192
        def roof(t,r):return (73*r*cos(t),97*r*sin(t),37.4+6.2*(1-r*r)+wave(t)*r*r)
        if j==0:add('Sedum roof',[roof(a,u),roof(b,v),roof(a,v)],[(0,1,2)],green)
        else:slab('Sedum roof',[roof(a,u),roof(b,u),roof(b,v),roof(a,v)],green,.08)
for x in range(-68,69,5):
    half=97*math.sqrt(max(0,1-(x/73)**2))
    for j in range(60):
        y=-half+2*half*j/60;yy=-half+2*half*(j+1)/60
        def rp(xx,y):
            r2=(xx/73)**2+(y/97)**2;t=math.atan2(y/97,xx/73)
            return (xx,y,37.48+6.2*(1-r2)+wave(t)*r2)
        slab('Roof standing seams',[rp(x-.045,y),rp(x+.045,y),rp(x+.045,yy),rp(x-.045,yy)],steel,.06)
# Use batched meshes so thousands of individual folded panels stay manageable.
for name,(vs,fs,ms) in batches.items():
    me=bpy.data.meshes.new('EXR_'+name);me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new('EXR_'+name,me);col.objects.link(ob)
    for m in mats:me.materials.append(m)
    for p,idx in zip(me.polygons,ms):p.material_index=idx
    uv=me.uv_layers.new(name='Architectural metres')
    for poly in me.polygons:
        axis=max(range(3),key=lambda k:abs(poly.normal[k]));axes=[k for k in range(3) if k!=axis]
        for li in poly.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]],co[axes[1]])
def lettering(name,body,loc,size,mi,width=None):
    cu=bpy.data.curves.new('EXR_'+name,'FONT');cu.body=body;cu.size=size;cu.extrude=.055;cu.bevel_depth=.012;cu.resolution_u=8
    ob=bpy.data.objects.new('EXR_'+name,cu);col.objects.link(ob);ob.location=world(loc);ob.rotation_euler=(pi/2,0,-pi/2);cu.materials.append(mats[mi])
    bpy.context.view_layer.update()
    if width:ob.scale.x=width/(max(v[0] for v in ob.bound_box)-min(v[0] for v in ob.bound_box))
    return ob
lettering('BARCLAYS CENTER','BARCLAYS CENTER',(-18,-130.35,24.0),6.1,cyan,73)
# The bird and shield are architectural signage, independent of event branding.
def badge(name,coords,y,mi):
    me=bpy.data.meshes.new(name);me.from_pydata([world((x,y,z)) for x,z in coords],[],[tuple(range(len(coords)))]);me.update()
    ob=bpy.data.objects.new('EXR_'+name,me);col.objects.link(ob);me.materials.append(mats[mi])
badge('Turquoise shield',[(-30,29.2),(-23.6,29.2),(-24.1,24.2),(-26.7,23.3),(-29.5,24.2)],-130.4,cyan)
badge('Eagle sign',[(-26.8,24.2),(-29.2,26.2),(-29.1,28.2),(-27.8,27.5),(-28.0,28.7),(-26.8,28.2),(-26.2,28.8),(-25.2,28.4),(-25.7,27.3),(-24.2,28),(-24.5,26.3),(-26,25),(-26.1,26.1)],-130.48,white)
def camera(name,loc,target,lens):
    ca=bpy.data.cameras.new('EXR_'+name);ob=bpy.data.objects.new('EXR_'+name,ca);col.objects.link(ob);ob.location=world(loc);ob.rotation_euler=(Vector(world(target))-ob.location).to_track_quat('-Z','Y').to_euler();ca.lens=lens;ca.clip_end=2000;return ob
camera('Front', (4,-250,7), (0,-107,18), 30)
camera('ThreeQuarter',(-157,-229,36), (0,-55,19),45)
camera('Aerial',(-198,-267,145),(0,-20,18),45)
camera('PanelDetail',(-94,-48,31),(-71,-17,27),60)
camera('Oculus',(-8,-144,4),(-4,-106,20),24)
assert all(signature(bpy.data.objects[n])==s for n,s in preserved.items()),'Existing objects changed'
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')
assert tris<500000,tris
report={'replaced_exterior_objects':replaced,'preserved_objects':len(preserved),'new_mesh_triangles':tris,'new_objects':len(col.objects),'source':'Nine supplied photographs; geometry inferred, not surveyed','materials':'New exterior-only Principled materials; procedural weathering requires baking for web','interior_unchanged':True}
(ROOT/'build-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
