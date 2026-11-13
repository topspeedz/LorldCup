import bpy, bmesh, math, json
from mathutils import Vector
from pathlib import Path

ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
OUT=ROOT/'interior-detail'
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026']
assert not bpy.data.materials.get('AudienceDetail_GEN.G')
body_objects=sorted([o for o in scene.objects if o.name.startswith('Audience_torsos__')],key=lambda o:o.name)
head_objects=sorted([o for o in scene.objects if o.name.startswith('Audience_heads__')],key=lambda o:o.name)

def stats(me):
    me.calc_loop_triangles()
    return dict(vertices=len(me.vertices),faces=len(me.polygons),triangles=len(me.loop_triangles),
                bounds=[[min(v.co[i] for v in me.vertices) for i in range(3)], [max(v.co[i] for v in me.vertices) for i in range(3)]])

before={o.name:stats(o.data) for o in body_objects+head_objects}
old_count=sum(len(o.data.vertices)//8 for o in body_objects)
assert old_count==sum(len(o.data.vertices)//12 for o in head_objects)
materials={}
def mat(name,color,texture=None):
    m=bpy.data.materials.new('AudienceDetail_'+name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.72
    m.diffuse_color=(*color,1)
    if texture:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/texture));tex.image.pack()
        uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='AudienceJerseyUV'
        m.node_tree.links.new(uv.outputs['UV'],tex.inputs['Vector'])
        m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    materials[name]=m
mat('GEN.G',(.02,.025,.035),'audience-jersey-geng.png')
mat('BLG',(.85,.9,.92),'audience-jersey-blg.png')
for n,c in [('Black',(.012,.018,.028)),('White',(.8,.86,.9)),('Gold',(.65,.43,.1)),('Cyan',(.015,.6,.7)),('Pink',(.65,.04,.3)),('Skin0',(.62,.36,.22)),('Skin1',(.35,.17,.09)),('Skin2',(.78,.52,.35)),('Hair0',(.015,.009,.006)),('Hair1',(.1,.045,.018))]:mat(n,c)

class Batch:
    def __init__(self):self.v=[];self.f=[];self.m=[];self.uv=[]
    def add(self,v,f,material,uv=None):
        off=len(self.v);self.v.extend(v);self.f.extend([tuple(off+i for i in face) for face in f])
        self.m.extend(material if isinstance(material,list) else [material]*len(f))
        self.uv.extend(uv or [[(0,0)]*len(face) for face in f])
    def tube(self,a,b,r1,r2,material,n=4):
        a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
        if u.length<.01:u=axis.cross(Vector((0,1,0)))
        u.normalize();w=axis.cross(u)
        vs=[tuple(p+r*(u*math.cos(2*math.pi*j/n)+w*math.sin(2*math.pi*j/n))) for p,r in [(a,r1),(b,r2)] for j in range(n)]
        fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
        self.add(vs,fs,material)

pending=[];counts={'GEN.G':0,'BLG':0};centers=[]
for obj in body_objects:
    batch=Batch();me=obj.data
    for idx in range(0,len(me.vertices),8):
        co=[me.vertices[idx+j].co.copy() for j in range(8)]
        center=sum(co,Vector())/8;z=center.z-.79
        right=(co[1]-co[0]).normalized();front=Vector((right.y,-right.x,0))
        # The original local +Y points away from the stage; front is local -Y.
        def pos(x,y,h):return tuple(Vector((center.x,center.y,z+h))+right*x+front*y)
        serial=len(centers);centers.append([center.x,center.y,z])
        team='GEN.G' if (serial*7+int(center.x))%2==0 else 'BLG';counts[team]+=1
        base='Black' if team=='GEN.G' else 'White';trim='Gold' if team=='GEN.G' else 'Cyan'
        vs=[pos(rx*math.cos(2*math.pi*j/6),ry*math.sin(2*math.pi*j/6),h) for rx,ry,h in [(.145,.1,.53),(.205,.115,1.025)] for j in range(6)]
        fs=[tuple(range(5,-1,-1)),tuple(range(6,12))]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)]
        mats=[base,trim]+[trim,team,trim,base,base,base]
        uvs=[[(0,0)]*len(f) for f in fs];uvs[3]=[(1,0),(0,0),(0,1),(1,1)]
        batch.add(vs,fs,mats,uvs)
        for side in [-1,1]:
            batch.tube(pos(side*.205,.005,.98),pos(side*.16,.24,.64),.068,.052,base,4)
            batch.tube(pos(side*.085,.01,.55),pos(side*.085,.29,.37),.08,.07,'Black',3)
        # One in 24 fans holds a small light stick within their own seat envelope.
        if serial%24==0:batch.tube(pos(.16,.24,.65),pos(.17,.24,.98),.012,.012,'Cyan',3)
    pending.append((obj,batch))

for obj in head_objects:
    batch=Batch();me=obj.data
    for idx in range(0,len(me.vertices),12):
        co=[me.vertices[idx+j].co.copy() for j in range(12)]
        center=sum(co,Vector())/12;z=center.z-1.18
        # Infer ellipse angle using the original stage-facing radial orientation.
        t=math.atan2(center.y/46 if z>0 else center.y/21,center.x/61 if z>0 else center.x/31)
        front=Vector((-math.cos(t),-math.sin(t),0));right=Vector((math.sin(t),-math.cos(t),0))
        def hp(x,y,h):return tuple(Vector((center.x,center.y,z+h))+right*x+front*y)
        vs=[hp(0,0,1.035)]+[hp(.105*math.cos(j*math.pi/3),.11*math.sin(j*math.pi/3),h) for h in [1.115,1.255] for j in range(6)]+[hp(0,0,1.335)]
        fs=[(0,(j+1)%6+1,j+1) for j in range(6)]+[(j+1,(j+1)%6+1,(j+1)%6+7,j+7) for j in range(6)]+[(j+7,(j+1)%6+7,13) for j in range(6)]
        skin='Skin'+str((idx//12)%3);hair='Hair'+str((idx//12)%2)
        batch.add(vs,fs,[skin]*6+[skin]*3+[hair]*3+[hair]*6)
    pending.append((obj,batch))

report=[];total=0
for obj,batch in pending:
    me=bpy.data.meshes.new(obj.data.name+'_character')
    me.from_pydata(batch.v,[],batch.f);me.update()
    oldslots=list(obj.data.materials)
    for m in oldslots:me.materials.append(m)
    for m in materials.values():me.materials.append(m)
    lookup={m.name:i for i,m in enumerate(me.materials)}
    uv=me.uv_layers.new(name='AudienceJerseyUV')
    for p,matname,coords in zip(me.polygons,batch.m,batch.uv):
        p.material_index=lookup[materials[matname].name];p.use_smooth=True
        for li,xy in zip(p.loop_indices,coords):uv.data[li].uv=xy
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.normal_update()
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
    assert all(math.isfinite(c) for v in bm.verts for c in v.co)
    assert all(f.calc_area()>1e-10 for f in bm.faces)
    bm.to_mesh(me);bm.free();me.update()
    result=stats(me);total+=result['triangles']
    report.append(dict(name=obj.name,before=before[obj.name],after=result,boundary_edges=0,nonmanifold_edges=0,finite=True,original_material_slots=[m.name for m in oldslots],uv='AudienceJerseyUV'))
    batch.mesh=me

delta=total-sum(r['triangles'] for r in before.values())
assert delta<=700000,(delta,total)
assert old_count==sum(counts.values())
# Commit only the owned audience meshes after every replacement passed validation.
for obj,batch in pending:obj.data=batch.mesh
result=dict(spectator_count=old_count,teams=counts,triangle_delta=delta,total_audience_triangles=total,objects=report,notes=['All original spectator XY centers retained','Uniforms are reference-inspired GEN.G and BLG designs, not official kit reproductions','No cameras, lighting, other geometry, saves or renders changed'])
(OUT/'audience-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='objects'}))

# Second executed pass: seating fixtures and compact sleeve hand terminations.
import bpy,bmesh,math,json
from mathutils import Vector
from pathlib import Path
root=Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve()==(root/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026']
assert not bpy.data.objects.get('AudienceDetail_Aisle_supports')
batches={}
def abeam(name,a,b,r,material,n=6):
 v,f=batches.setdefault((name,material),([],[]));off=len(v)
 a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
 if u.length<.01:u=axis.cross(Vector((0,1,0)))
 u.normalize();w=axis.cross(u)
 v.extend(tuple(p+r*(u*math.cos(2*math.pi*j/n)+w*math.sin(2*math.pi*j/n))) for p in (a,b) for j in range(n))
 fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
 f.extend(tuple(off+j for j in face) for face in fs)
def abox(name,c,size,material,ang=0):
 v,f=batches.setdefault((name,material),([],[]));off=len(v)
 x,y,z=c;a,b,h=[s/2 for s in size]
 v.extend((x+u*math.cos(ang)-w*math.sin(ang),y+u*math.sin(ang)+w*math.cos(ang),z+q) for u,w,q in [(-a,-b,-h),(a,-b,-h),(a,b,-h),(-a,b,-h),(-a,-b,h),(a,-b,h),(a,b,h),(-a,b,h)])
 f.extend(tuple(off+j for j in face) for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
for tier,rx,ry,z,rise in [(0,31,21,-9.9,.43),(1,61,46,6.2,.63)]:
 for sector in range(16):
  if tier==0 and sector==8:continue
  t=sector*math.pi/8
  for row in range(0,22,3):
   x,y=(rx+row*1.08)*math.cos(t),(ry+row*1.08)*math.sin(t);h=z+row*rise
   abeam('AudienceDetail_Aisle_supports',(x,y,h+.02),(x,y,h+1),.025,'silver')
   abox('AudienceDetail_Aisle_mounts',(x,y,h+.025),(.15,.15,.04),'steel',t)
  for row in range(23):
   if row%5==0:continue
   x,y=(rx+row*1.08+.1)*math.cos(t),(ry+row*1.08+.1)*math.sin(t);h=z+row*rise
   abox('AudienceDetail_Aisle_nosing',(x,y,h+.018),(.65,.12,.025),'black',t)
   abox('AudienceDetail_Aisle_guides',(x,y,h+.035),(.5,.028,.012),'whiteLED',t)
 for sector in range(32):
  t=(sector+.5)*math.pi/16
  r1,r2=rx+22*1.08+.91,ry+22*1.08+.91
  p=Vector((r1*math.cos(t),r2*math.sin(t),z+23*rise+.29))
  tangent=Vector((-r1*math.sin(t),r2*math.cos(t),0)).normalized()
  for j in range(3):
   q=p+tangent*(j*.24-.24)
   abeam('AudienceDetail_Ribbon_chevrons',q-tangent*.1-Vector((0,0,.17)),q+tangent*.1+Vector((0,0,.17)),.018,'cyan',4)
report_path=root/'interior-detail/audience-report.json'
report=json.loads(report_path.read_text(encoding='utf-8'));details=[]
for (name,material),(vs,fs) in batches.items():
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.materials.append(bpy.data.materials[material])
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
 assert all(math.isfinite(c) for v in bm.verts for c in v.co)
 bm.to_mesh(me);bm.free();me.update();me.calc_loop_triangles()
 o=bpy.data.objects.new(name,me);scene.collection.objects.link(o)
 details.append(dict(name=name,triangles=len(me.loop_triangles),finite=True,boundary=0,nonmanifold=0))
# Flesh-coloured endcaps give the low-poly sleeves a hand termination without extra geometry.
for o in [o for o in scene.objects if o.name.startswith('Audience_torsos__')]:
 mats={m.name:i for i,m in enumerate(o.data.materials)}
 skin=mats['AudienceDetail_Skin0'];cursor=0
 while cursor<len(o.data.polygons):
  # Each person has 8 torso faces, two 6-face arms, and two 5-face thighs, plus occasional 5-face stick.
  o.data.polygons[cursor+9].material_index=skin
  o.data.polygons[cursor+20].material_index=skin
  cursor+=30
  if cursor<len(o.data.polygons) and len(o.data.polygons[cursor].vertices)==3:
   cursor+=5
report['seating_details']=details
report['triangle_delta']+=sum(d['triangles'] for d in details)
assert report['triangle_delta']<=700000,report['triangle_delta']
report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(dict(seating_details=details,total_triangle_delta=report['triangle_delta'])))
