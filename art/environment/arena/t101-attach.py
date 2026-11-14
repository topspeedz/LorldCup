"""Rigidly attach existing arena text; preserve every glyph and support mesh."""
import ast
import hashlib
import json
import math
import shutil
import struct
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion
from mathutils.bvhtree import BVHTree

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T101'
scene = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()
CY = -.005370497703552246
SY = scene.objects['Walk_Tier0__concrete'].scale.y
C = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
labels = [o for o in scene.objects if o.type == 'FONT' and not o.name.startswith('EXR_')
          or o.name.startswith('Section_number') or o.name == 'Portal_sign']

def read_glb(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20+size]), data[28+size:]

old, _ = read_glb(ROOT / '_workspace/_run/2026-11-13-ux-motion-rooms/bak/T93/web/arena-v2.glb')
parents = {child: i for i, n in enumerate(old['nodes']) for child in n.get('children', [])}
worlds = {}
def world(i):
    if i not in worlds:
        n = old['nodes'][i]
        if 'matrix' in n:
            m = Matrix(np.array(n['matrix']).reshape(4,4).T.tolist())
        else:
            x,y,z,w = n.get('rotation', [0,0,0,1])
            m = Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])), Quaternion((w,x,y,z)), Vector(n.get('scale',[1,1,1])))
        worlds[i] = world(parents[i]) @ m if i in parents else m
    return worlds[i]
old_origins = {n['name']: (C.inverted() @ world(i)).translation for i,n in enumerate(old['nodes'])}

def points(ob):
    ev = ob.evaluated_get(dg)
    mesh = ev.to_mesh()
    vs = [ob.matrix_world @ v.co for v in mesh.vertices]
    fs = [list(p.vertices) for p in mesh.polygons]
    ev.to_mesh_clear()
    return vs, fs

supports = {}
prefixes = ('REF_RibbonProgram_', 'REF_SuiteRibbon_', 'Tier_ribbon__',
    'REF_GrandFinalFascia', 'REF_ScoreboardStructure', 'REF_Reused_Player_chair_back', 'Portal_header__')
for ob in scene.objects:
    if ob.type == 'MESH' and ob.name.startswith(prefixes):
        vs, fs = points(ob)
        supports[ob.name] = (vs,fs,BVHTree.FromPolygons(vs,fs))

def parallel(p, rx, ry, offset):
    q = Vector((p.x,p.y-CY))
    angle = math.atan2(q.y/ry,q.x/rx)
    normal = Vector((math.cos(angle)/rx,math.sin(angle)/ry)).normalized()
    extra = (q-Vector((rx*math.cos(angle),ry*math.sin(angle)))).dot(normal)
    nx,ny = 55.86,45.86*SY
    n = Vector((math.cos(angle)/nx,math.sin(angle)/ny)).normalized()
    q = Vector((nx*math.cos(angle),ny*math.sin(angle))) + n*(offset+extra)
    return Vector((q.x,q.y+CY,p.z))

rows = []
for ob in labels:
    before, _ = points(ob)
    center = sum((ob.matrix_world @ Vector(v) for v in ob.bound_box), Vector())/8
    original = old_origins[ob.name]
    anchor = original + center-ob.matrix_world.translation
    if ob.name.startswith('REF_RibbonBrand_0_'):
        anchor = parallel(anchor,60.6,45.6*SY,4.6)
        choices = [n for n in supports if n.startswith('REF_RibbonProgram_0_')]
    elif ob.name.startswith('REF_RibbonBrand_1_'):
        choices = [n for n in supports if n.startswith('REF_RibbonProgram_1_')]
    elif ob.name.startswith('REF_SuiteBrand_'):
        anchor = parallel(anchor,61,46*SY,5)
        choices = [n for n in supports if n.startswith('REF_SuiteRibbon_')]
    elif ob.name.startswith('Section_number'):
        choices = ([n for n in supports if n.startswith('REF_RibbonProgram_1_')]
                   if original.z > 10 else ['Tier_ribbon__blue'])
    elif ob.name.startswith('REF_ChairBrand_'):
        choices = ['REF_Reused_Player_chair_back__blue']
    elif ob.name.startswith('REF_WorldsHeader_'):
        choices = ['REF_ScoreboardStructure__Obsidian']
    elif ob.name == 'Portal_sign':
        choices = ['Portal_header__black']
    else:
        choices = ['REF_GrandFinalFascia__ScreenBlack']
    front = (ob.matrix_world.to_3x3().inverted().transposed() @ Vector((0,0,1))).normalized()
    old_tangent = Vector((-front.y,front.x,0)).normalized()
    width = max(p.dot(old_tangent) for p in before)-min(p.dot(old_tangent) for p in before)
    height = max(p.z for p in before)-min(p.z for p in before)
    options = []
    for name in choices:
        vs,fs,bvh = supports[name]
        if name.startswith(('Tier_ribbon__','REF_Reused_Player_chair_back','REF_ScoreboardStructure','Portal_header__')):
            patches = [[vs[i] for i in f] for f in fs]
        else:
            patches = [vs]
        for patch in patches:
            hit = bvh.find_nearest(sum(patch,Vector())/len(patch) if len(patches)>1 else anchor)
            if hit[0] is None or abs(hit[1].z) > .15:
                continue
            normal = hit[1].copy()
            if normal.dot(front) < 0:
                normal.negate()
            if normal.dot(front) < .5:
                continue
            tangent = Vector((-normal.y,normal.x,0)).normalized()
            lo,hi = min(p.dot(tangent) for p in patch),max(p.dot(tangent) for p in patch)
            low,high = min(p.z for p in patch),max(p.z for p in patch)
            if hi-lo < width+.012 or high-low < height+.012:
                continue
            along = min(max(anchor.dot(tangent),lo+width/2+.006),hi-width/2-.006)
            z = min(max(anchor.z,low+height/2+.006),high-height/2-.006)
            p = anchor + tangent*(along-anchor.dot(tangent))
            p.z = z
            if len(patches)>1:
                p -= normal*(p-patch[0]).dot(normal)
            else:
                p,face_normal,_,_ = bvh.find_nearest(p)
                if face_normal.dot(normal)<0: face_normal.negate()
                normal=face_normal
            rotate = front.rotation_difference(normal).to_matrix().to_4x4()
            matrix = Matrix.Translation(p) @ rotate @ Matrix.Translation(-center) @ ob.matrix_world
            moved = [p+rotate.to_3x3()@(v-center) for v in before]
            signed = [(v-bvh.find_nearest(v)[0]).dot(normal) for v in moved]
            offset = .008-min(signed)
            matrix.translation += normal*offset
            moved = [v+normal*offset for v in moved]
            distances = [bvh.find_nearest(v)[3] for v in moved]
            maximum = max(distances)
            if maximum > .035:
                continue
            options.append(((p-anchor).length,name,matrix,moved,min(distances),maximum))
    assert options, ('No complete supporting surface',ob.name,width,height)
    _,name,matrix,moved,dmin,dmax = min(options,key=lambda x:x[0])
    bvh = supports[name][2]
    rows.append({'name':ob.name,'surface':name,'preT93Origin':list(original),
        'beforeOrigin':list(ob.matrix_world.translation),'beforeCenter':list(center),
        'beforeDistance':min(supports[n][2].find_nearest(center)[3] for n in choices),
        'afterCenter':list(sum(moved,Vector())/len(moved)),
        'distanceMin':dmin,'distanceMax':dmax,'width':width,'height':height,
        'worldBefore':[list(r) for r in ob.matrix_world], 'worldAfter':[list(r) for r in matrix],
        'geometryHash':hashlib.sha256(np.array([list(v) for v in before],dtype=np.float32).tobytes()).hexdigest()})

(OUT/'attachment-plan.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('T101_PLAN',len(rows),'maximum distance',max(r['distanceMax'] for r in rows))
for prefix in ('REF_RibbonBrand_0_','REF_RibbonBrand_1_','REF_SuiteBrand_','Section_number','REF_ChairBrand_','REF_WorldsHeader_','REF_GrandFinal'):
    group=[r for r in rows if r['name'].startswith(prefix)]
    print(prefix,len(group),'before',round(min(r['beforeDistance'] for r in group),4),round(max(r['beforeDistance'] for r in group),4),'after max',round(max(r['distanceMax'] for r in group),6))

if globals().get('APPLY',False):
    assert Path(bpy.data.filepath).resolve()==ART/'barclays-arena-t93b.blend'
    target=ART/'barclays-arena-t101.blend'
    assert not target.exists()
    for node in ast.parse((ART/'t93b-openings.py').read_text(encoding='utf-8')).body:
        if isinstance(node,ast.FunctionDef) and node.name=='digest':
            exec(compile(ast.Module(body=[node],type_ignores=[]),'T93b mesh hash','exec'))
    meshes={o.name:digest(o) for o in scene.objects if o.type=='MESH' and o not in labels}
    files=[ART/'barclays-arena-t93b.blend',*sorted((ROOT/'web/lightmaps').glob('*')),ROOT/'web/config/seats.json']
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}
    (OUT/'backup').mkdir(exist_ok=True)
    assert not (OUT/'backup/arena-v2.glb').exists()
    shutil.copy2(ROOT/'web/arena-v2.glb',OUT/'backup/arena-v2.glb')
    glyphs={o.name:(o.data.name,list(o.scale),[m.name for m in o.data.materials],getattr(o.data,'body',None)) for o in labels}
    for row in rows:
        ob=scene.objects[row['name']]
        matrix=Matrix(row['worldAfter'])
        if ob.parent:
            ob.matrix_parent_inverse=ob.parent.matrix_world.inverted() @ matrix @ ob.matrix_basis.inverted()
        else:
            ob.matrix_world=matrix
    bpy.context.view_layer.update()
    assert meshes=={o.name:digest(o) for o in scene.objects if o.type=='MESH' and o not in labels}
    for ob in labels:
        saved=glyphs[ob.name]
        assert ob.data.name==saved[0] and [m.name for m in ob.data.materials]==saved[2]
        assert getattr(ob.data,'body',None)==saved[3]
        assert max(abs(a-b) for a,b in zip(ob.scale,saved[1]))<1e-6
        row=next(r for r in rows if r['name']==ob.name)
        assert max(abs(ob.matrix_world[i][j]-row['worldAfter'][i][j]) for i in range(4) for j in range(4))<.00005
    (OUT/'baseline.json').write_text(json.dumps({'files':hashes,'meshes':meshes,'glyphs':glyphs,'unchangedMeshCount':len(meshes)},indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    print('T101_SAVED',len(rows),'text transforms;',len(meshes),'protected mesh hashes unchanged')
