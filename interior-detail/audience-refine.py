import bpy,bmesh,math,json,ast
from mathutils import Vector
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026');OUT=ROOT/'interior-detail'
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
source=ast.parse((OUT/'audience-detail.py').read_text(encoding='utf-8'))
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.ClassDef) and n.name=='Batch' or isinstance(n,ast.FunctionDef) and n.name=='stats'],type_ignores=[]),'helpers','exec'))
materials={m.name.removeprefix('AudienceDetail_'):m for m in bpy.data.materials if m.name.startswith('AudienceDetail_')}
for i in range(3):
    if 'Face'+str(i) in materials:continue
    m=bpy.data.materials.new('AudienceDetail_Face'+str(i));m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.73
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/f'audience-face-{i}.png'));tex.image.pack()
    uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='AudienceJerseyUV'
    m.node_tree.links.new(uv.outputs['UV'],tex.inputs['Vector']);m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    materials['Face'+str(i)]=m
scene=bpy.data.scenes['Barclays • WORLDS 2026'];pending=[];serial=0;orient={}
for obj in sorted([o for o in scene.objects if o.name.startswith('Audience_torsos__')],key=lambda o:o.name):
    batch=Batch();me=bpy.data.meshes[obj.name]
    assert len(me.vertices)%8==0
    for idx in range(0,len(me.vertices),8):
        co=[me.vertices[idx+j].co.copy() for j in range(8)];c=sum(co,Vector())/8;z=c.z-.79
        right=(co[1]-co[0]).normalized();front=Vector((right.y,-right.x,0))
        orient[(round(c.x,3),round(c.y,3))]=(right.copy(),front.copy())
        def pos(x,y,h):return tuple(Vector((c.x,c.y,z+h))+right*x+front*y)
        team='GEN.G' if (serial*7+int(c.x))%2==0 else 'BLG'
        base='Black' if team=='GEN.G' else 'White';trim='Gold' if team=='GEN.G' else 'Cyan'
        vs=[pos(rx*math.cos(j*math.pi/3),ry*math.sin(j*math.pi/3),h) for rx,ry,h in [(.145,.1,.53),(.205,.12,.94),(.125,.09,1.05)] for j in range(6)]
        fs=[tuple(range(5,-1,-1)),tuple(range(12,18))]+[(k*6+j,k*6+(j+1)%6,(k+1)*6+(j+1)%6,(k+1)*6+j) for k in range(2) for j in range(6)]
        mats=[base,trim]+[trim,team,trim,base,base,base]+[base,team,base,base,base,base]
        uvs=[[(0,0)]*len(f) for f in fs]
        uvs[3]=[(1,0),(0,0),(0,.82),(1,.82)];uvs[9]=[(1,.82),(0,.82),(0,1),(1,1)]
        batch.add(vs,fs,mats,uvs)
        for side in [-1,1]:
            batch.tube(pos(side*.195,.005,.965),pos(side*.16,.24,.64),.066,.052,[base,'Skin'+str(serial%3)]+[base]*4,4)
            batch.tube(pos(side*.085,.01,.55),pos(side*.085,.29,.37),.08,.07,'Black',3)
        if serial%24==0:batch.tube(pos(.16,.24,.65),pos(.17,.24,.98),.012,.012,'Cyan',3)
        serial+=1
    pending.append((obj,batch))
assert serial==12392
from mathutils.kdtree import KDTree
keys=list(orient);tree=KDTree(len(keys))
for i,key in enumerate(keys):tree.insert((key[0],key[1],0),i)
tree.balance()
for obj in sorted([o for o in scene.objects if o.name.startswith('Audience_heads__')],key=lambda o:o.name):
    batch=Batch();me=bpy.data.meshes[obj.name]
    for idx in range(0,len(me.vertices),12):
        co=[me.vertices[idx+j].co.copy() for j in range(12)];c=sum(co,Vector())/12;z=c.z-1.18
        nearest,oi,dist=tree.find((c.x,c.y,0));assert dist<.002
        right,front=orient[keys[oi]]
        def pos(x,y,h):return tuple(Vector((c.x,c.y,z+h))+right*x+front*y)
        rings=[(.043,.044,1.015),(.075,.082,1.105),(.106,.108,1.225),(.062,.065,1.32)]
        vs=[pos(rx*math.cos(j*math.pi/4),ry*math.sin(j*math.pi/4),h) for rx,ry,h in rings for j in range(8)]
        fs=[tuple(range(7,-1,-1)),tuple(range(24,32))]+[(k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j) for k in range(3) for j in range(8)]
        skin='Skin'+str((idx//12)%3);face='Face'+str((idx//12)%3);hair='Hair'+str((idx//12)%2)
        mats=[skin,hair];uvs=[[(0,0)]*8,[(0,0)]*8]
        for k in range(3):
            for j in range(8):
                mats.append(face if k>=1 and j<4 else hair if k==2 else skin)
                v0=max(0,(rings[k][2]-1.105)/.215);v1=max(0,(rings[k+1][2]-1.105)/.215)
                uvs.append([(1-j/4,v0),(1-(j+1)/4,v0),(1-(j+1)/4,v1),(1-j/4,v1)])
        batch.add(vs,fs,mats,uvs)
    pending.append((obj,batch))
report=json.loads((OUT/'audience-report.json').read_text(encoding='utf-8'));total=0
for obj,batch in pending:
    me=bpy.data.meshes.new(obj.name+'_rounded');me.from_pydata(batch.v,[],batch.f);me.update()
    for m in obj.data.materials:me.materials.append(m)
    for m in materials.values():
        if m.name not in me.materials:me.materials.append(m)
    lookup={m.name:i for i,m in enumerate(me.materials)};uv=me.uv_layers.new(name='AudienceJerseyUV')
    for p,name,coords in zip(me.polygons,batch.m,batch.uv):
        p.material_index=lookup[materials[name].name];p.use_smooth=True
        for li,xy in zip(p.loop_indices,coords):uv.data[li].uv=xy
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.normal_update()
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
    assert all(math.isfinite(c) for v in bm.verts for c in v.co)
    assert all(f.calc_area()>1e-10 for f in bm.faces)
    bm.to_mesh(me);bm.free();me.update();result=stats(me);total+=result['triangles'];batch.mesh=me
    next(r for r in report['objects'] if r['name']==obj.name)['after']=result
delta=total-sum(r['before']['triangles'] for r in report['objects'])+sum(r['triangles'] for r in report['seating_details'])
assert delta<=1300000,delta
for obj,batch in pending:obj.data=batch.mesh
report['triangle_delta']=delta;report['total_audience_triangles']=total
report['head_refinement']='8-sided four-ring heads, integrated necks, rounded crowns, three packed face atlases with eyes/brows/nose/mouth; shoulders use three rounded contour rings'
report['budget']=1300000
(OUT/'audience-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(dict(triangle_delta=delta,total_audience_triangles=total,characters=serial)))
