import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
names=['CityGround__sidewalk','CityRoads__road','CityRoadMarkings__paint','CityCrosswalk__paint']
def stats(o):
    m=o.data; m.calc_loop_triangles(); bm=bmesh.new(); bm.from_mesh(m)
    p=[o.matrix_world@v.co for v in m.vertices]
    result=dict(vertices=len(m.vertices),faces=len(m.polygons),triangles=len(m.loop_triangles),bounds=[[min(v[i] for v in p),max(v[i] for v in p)] for i in range(3)],boundary=sum(e.is_boundary for e in bm.edges),nonmanifold=sum(not e.is_manifold for e in bm.edges),finite=all(math.isfinite(x) for v in p for x in v),bad_normals=sum(not all(math.isfinite(x) for x in f.normal) or f.normal.length<.99 for f in bm.faces),signed_volume=bm.calc_volume(signed=True),uv=[u.name for u in m.uv_layers],materials=[m.name for m in m.materials],modifiers=[(m.name,m.type) for m in o.modifiers]); bm.free(); return result
def signature(o):
    m=o.data
    return hashlib.sha256(repr(([(tuple(v.co)) for v in m.vertices],[tuple(p.vertices) for p in m.polygons],[(u.name,[tuple(x.uv) for x in u.data]) for u in m.uv_layers],[m.name for m in m.materials])).encode()).hexdigest()
protected=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Walk_')]
protected_before={o.name:signature(o) for o in protected}
before={n:stats(bpy.data.objects[n]) for n in names}
other_before={n:signature(bpy.data.objects[n]) for n in names[1:]}
o=bpy.data.objects[names[0]]; old=o.data
assert len(old.vertices)==8 and len(old.uv_layers)==0 and not o.modifiers
plaza=bpy.data.objects['Walk_Plaza']
inner=[plaza.matrix_world@v.co for v in list(plaza.data.vertices)[::2]]
assert len(inner)==256
# Match existing plaza edges exactly, adding collinear intersections for rectangular outer corners.
angles=[math.atan2(p.y,p.x)%(2*math.pi) for p in inner]
for x,y in [(-290,-250),(310,-250),(310,270),(-290,270)]:
    a=math.atan2(y,x)%(2*math.pi)
    for i in range(len(inner)):
        aa=angles[i]; bb=angles[(i+1)%len(inner)]
        if bb<aa: bb+=2*math.pi
        if aa<a<bb:
            p=inner[i]; q=inner[(i+1)%len(inner)]; d=q-p
            dx,dy=math.cos(a),math.sin(a)
            t=(p.y*dx-p.x*dy)/(d.x*dy-d.y*dx)
            inner.insert(i+1,p+t*d); angles.insert(i+1,a); break
v=[]; f=[]; z0,z1=before[names[0]]['bounds'][2]
for p in inner:
    scale=min((310 if p.x>=0 else -290)/p.x if abs(p.x)>1e-9 else float('inf'),(270 if p.y>=0 else -250)/p.y if abs(p.y)>1e-9 else float('inf'))
    v.extend([(p.x,p.y,z1),(p.x*scale,p.y*scale,z1),(p.x,p.y,z0),(p.x*scale,p.y*scale,z0)])
n=len(inner)
for i in range(n):
    a=4*i; b=4*((i+1)%n)
    f.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),(a,b,b+2,a+2),(a+1,a+3,b+3,b+1)])
mesh=bpy.data.meshes.new(old.name+'_arena_opening')
inv=o.matrix_world.inverted(); mesh.from_pydata([inv@Vector(p) for p in v],[],f)
for mat in old.materials: mesh.materials.append(mat)
bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free(); mesh.update()
# Validate before assigning the replacement mesh.
assert len(mesh.polygons)==1040
assert all(math.isfinite(x) for v in mesh.vertices for x in v.co)
o.data=mesh
bpy.context.view_layer.update()
after={n:stats(bpy.data.objects[n]) for n in names}
assert after[names[0]]['boundary']==after[names[0]]['nonmanifold']==after[names[0]]['bad_normals']==0
assert after[names[0]]['signed_volume']>0
assert after[names[0]]['bounds']==before[names[0]]['bounds']
assert all(signature(bpy.data.objects[n])==s for n,s in other_before.items())
assert all(signature(bpy.data.objects[n])==s for n,s in protected_before.items())
def hit(obj,x,y):
    inv=obj.matrix_world.inverted()
    return obj.ray_cast(inv@Vector((x,y,40)),(inv.to_3x3()@Vector((0,0,-1))).normalized(),distance=100)[0]
samples=[(0,0),(-12,0),(12,0),(0,12),(0,-12),(-50,15),(50,15),(0,43),(0,-43),(-80,20),(80,20),(0,68),(0,-68)]
rays=[dict(x=x,y=y,hits=[n for n in names if hit(bpy.data.objects[n],x,y)]) for x,y in samples]
assert all(not r['hits'] for r in rays)
external=[(-200,0),(200,0),(0,200),(0,-200),(-110,0),(100,0),(0,76),(0,-76)]
assert all(hit(o,x,y) for x,y in external)
entry=[]
for x in [-130,-100,-95,-80,-65,-63,-61,-59,-45,-30]:
    hits=[w.name for w in protected if w.name.startswith(('Walk_Plaza','Walk_Atrium','Walk_Entry')) and hit(w,x,0)]
    assert hits,(x,hits)
    entry.append(dict(x=x,y=0,walk_surface_hits=hits))
report=dict(affected=[names[0]],before=before,after=after,triangles_added=after[names[0]]['triangles']-before[names[0]]['triangles'],opening='Exact existing Walk_Plaza 256-segment ellipse footprint, radii 96 x 73; four collinear inner points align outer rectangle corners',vertical_ray_checks=rays,external_sidewalk_samples=external,entry_path_samples=entry,all_walk_meshes_unchanged=True,roads_and_paint_unchanged=True,limitations='No render, save, export or engine runtime test; coordinator must render and save integrated scene.')
assert report['triangles_added']<10000
(ROOT/'team-tasks/repair-1.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

