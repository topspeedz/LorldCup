"""Run inside Blender after opening fan.blend; T28 checks static blockouts only."""
import json
from pathlib import Path

import bpy
import bmesh

IDS = ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2')
missing = [name for name in IDS if name not in bpy.data.objects]
assert not missing, f'Missing blockouts: {missing}'
results = []
for name in IDS:
    ob = bpy.data.objects[name]
    assert ob.type == 'MESH', name
    assert tuple(ob.location) == (0, 0, 0), f'{name}: origin'
    assert all(abs(x) < 1e-7 for x in ob.rotation_euler), f'{name}: rotation'
    assert all(abs(x - 1) < 1e-7 for x in ob.scale), f'{name}: scale'
    me = ob.data
    me.calc_loop_triangles()
    z = [v.co.z for v in me.vertices]
    assert abs(min(z)) < .00001 and 1.60 <= max(z) <= 1.84, (name, min(z), max(z))
    assert len(me.loop_triangles) <= 15000, name
    assert len(me.materials) <= 3 and 'Uniform' in me.materials, name
    assert all(p.area > 1e-10 for p in me.polygons), f'{name}: zero area'
    bm = bmesh.new()
    bm.from_mesh(me)
    boundary = sum(not e.is_manifold for e in bm.edges)
    loose = sum(not v.link_faces for v in bm.verts)
    bm.free()
    assert boundary == loose == 0, (name, boundary, loose)
    assert ob['body_base'] == ('female' if '_f' in name else 'male'), name
    results.append(dict(id=name, vertices=len(me.vertices), triangles=len(me.loop_triangles),
                        height=round(max(z), 4), materials=[m.name for m in me.materials],
                        nonmanifold_edges=boundary, loose_vertices=loose,
                        hair=ob['hair_style'], body_base=ob['body_base']))
for left, right in [('fan_f1', 'fan_f2'), ('fan_m1', 'fan_m2')]:
    a, b = bpy.data.objects[left], bpy.data.objects[right]
    count = a['body_vertex_count']
    assert count == b['body_vertex_count']
    assert all((a.data.vertices[i].co-b.data.vertices[i].co).length < 1e-7
               for i in range(count)), f'{left}/{right}: body bases differ'
assert len({bpy.data.objects[n]['hair_style'] for n in IDS}) == 4
assert len({bpy.data.objects[n]['skin_srgb'] for n in IDS}) == 4
layouts = [json.loads(bpy.data.objects[n]['joint_layout']) for n in IDS]
assert all(layout == layouts[0] for layout in layouts), 'Joint positions differ'
assert json.loads(bpy.data.scenes['FanAssets']['joint_layout']) == layouts[0]
shoulder, elbow, wrist = (layouts[0][n] for n in ('shoulder_L', 'elbow_L', 'wrist_L'))
assert abs(abs(elbow[0]-shoulder[0])-abs(elbow[2]-shoulder[2])) < 1e-7, 'Upper arm A-pose'
assert abs(abs(wrist[0]-elbow[0])-abs(wrist[2]-elbow[2])) < 1e-7, 'Forearm A-pose'
sheet = bpy.data.scenes.get('FanSheet')
assert sheet and sheet.camera, 'Missing sheet scene/camera'
assert all(f'sheet-{n}-{view}' in sheet.objects for n in IDS for view in ('front', 'side'))
for name in IDS:
    for view in ('front', 'side'):
        assert sheet.objects[f'sheet-{name}-{view}'].data == bpy.data.objects[name].data
assert not any(o.type == 'ARMATURE' for o in bpy.data.scenes['FanAssets'].objects), 'T28 is static'
out = dict(ok=True, stage='T28-static-blockout', characters=results,
           shared_body_bases=2, shared_joint_layout=True, rigged=False, clips=[])
Path(bpy.data.filepath).with_name('blockout-metrics.json').write_text(
    json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps(out))
