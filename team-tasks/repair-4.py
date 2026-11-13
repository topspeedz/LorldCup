import bpy
import bmesh
import collections
import json
import math
from pathlib import Path

ROOT = Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve() == (ROOT / 'barclays-worlds-2026.blend').resolve()
NAMES = ['Walk_Stage_steps__black', 'Walk_Stage_steps__ivory', 'Walk_Stage_steps__blue', 'Stage_LED__cyan']

def metrics(bm):
    bm.normal_update()
    return dict(vertices=len(bm.verts), edges=len(bm.edges), faces=len(bm.faces),
                triangles=sum(len(f.verts)-2 for f in bm.faces),
                boundary=sum(e.is_boundary for e in bm.edges),
                nonmanifold=sum(not e.is_manifold for e in bm.edges),
                inconsistent=sum(e.is_manifold and not e.is_contiguous for e in bm.edges),
                degenerate=sum(f.calc_area()<1e-10 for f in bm.faces),
                finite=all(math.isfinite(c) for v in bm.verts for c in v.co),
                signed_volume=bm.calc_volume(signed=True),
                bounds=[[min(v.co[i] for v in bm.verts) for i in range(3)],
                        [max(v.co[i] for v in bm.verts) for i in range(3)]])

def loop_records(bm):
    return {name: {(tuple(round(c,5) for c in l.vert.co), tuple(round(c,6) for c in l[layer].uv))
                   for f in bm.faces for l in f.loops}
            for name in bm.loops.layers.uv.keys()
            for layer in [bm.loops.layers.uv[name]]}

report = []
for name in NAMES:
    obj = bpy.data.objects[name]
    assert obj.data.users == 1
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before = metrics(bm)
    uv_before = loop_records(bm)
    slots = [m.name if m else None for m in obj.data.materials]
    groups = collections.defaultdict(list)
    for face in bm.faces:
        key = tuple(sorted(tuple(round(c,5) for c in v.co) for v in face.verts))
        groups[key].append(face)
    internal = {f for faces in groups.values() if len(faces)>1 for f in faces}
    degenerate = {f for f in bm.faces if f.calc_area()<1e-10}
    bmesh.ops.delete(bm, geom=list(internal | degenerate), context='FACES_ONLY')
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if e.is_wire], context='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    after = metrics(bm)
    assert after['finite'] and after['boundary']==after['nonmanifold']==after['inconsistent']==after['degenerate']==0
    assert after['signed_volume']>0 and abs(after['signed_volume']+before['signed_volume'])<1e-5
    assert before['bounds']==after['bounds']
    uv_after = loop_records(bm)
    assert uv_before.keys()==uv_after.keys()
    assert all(uv_after[k].issubset(uv_before[k]) for k in uv_after)
    # Only coincident internal partitions are removed; original visible-face UV values remain.
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    assert slots == [m.name if m else None for m in obj.data.materials]
    report.append(dict(name=name, before=before, after=after,
                       internal_faces_removed=len(internal), degenerate_faces_removed=len(degenerate),
                       material_slots=slots, uv_layers=list(uv_after), uv_values_retained=True,
                       modifiers=[m.name for m in obj.modifiers]))

assert sum(r['after']['triangles']-r['before']['triangles'] for r in report)<40000
(ROOT / 'team-tasks/repair-4.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))

# Second executed pass: close the existing thin finish surfaces without replacing their base meshes.
import bpy,bmesh,json,math
from pathlib import Path
root=Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve()==(root/'barclays-worlds-2026.blend').resolve()
path=root/'team-tasks/repair-4.json'
report=json.loads(path.read_text(encoding='utf-8'))
for name,thickness,offset in [('Walk_Stage__ivory',0.002,1.0),('Stage_inlay__blue',0.018,-1.0)]:
 o=bpy.data.objects[name]
 assert not o.modifiers
 b=bmesh.new();b.from_mesh(o.data)
 before=dict(vertices=len(b.verts),faces=len(b.faces),triangles=sum(len(f.verts)-2 for f in b.faces),boundary=sum(e.is_boundary for e in b.edges),bounds=[[min(v.co[i] for v in b.verts) for i in range(3)],[max(v.co[i] for v in b.verts) for i in range(3)]])
 b.free()
 m=o.modifiers.new('TA4 close exposed stage finish','SOLIDIFY')
 m.thickness=thickness;m.offset=offset;m.use_rim=True
 bpy.context.view_layer.update()
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
 b=bmesh.new();b.from_mesh(mesh);b.normal_update()
 after=dict(vertices=len(b.verts),faces=len(b.faces),triangles=sum(len(f.verts)-2 for f in b.faces),boundary=sum(e.is_boundary for e in b.edges),nonmanifold=sum(not e.is_manifold for e in b.edges),inconsistent=sum(e.is_manifold and not e.is_contiguous for e in b.edges),finite=all(math.isfinite(c) for v in b.verts for c in v.co),signed_volume=b.calc_volume(signed=True),bounds=[[min(v.co[i] for v in b.verts) for i in range(3)],[max(v.co[i] for v in b.verts) for i in range(3)]])
 assert after['boundary']==after['nonmanifold']==after['inconsistent']==0 and after['finite'] and after['signed_volume']>0
 b.free();ev.to_mesh_clear()
 report.append(dict(name=name,before=before,after=after,modifier=m.name,thickness=thickness,offset=offset,uv_layers=[u.name for u in o.data.uv_layers],material_slots=[mat.name for mat in o.data.materials],base_mesh_unchanged=True))
path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report[-2:]))
print('TOTAL_TRIANGLE_DELTA',sum(r['after']['triangles']-r['before']['triangles'] for r in report))
