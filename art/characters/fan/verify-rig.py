"""T30 contract checks; execute in the live Blender through MCP."""
import json
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
IDS = ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2')
PARENTS = dict(root=None, hips='root', spine='hips', chest='spine', neck='chest', head='neck')
for side in ('L', 'R'):
    for chain in [('chest', 'shoulder', 'upper_arm', 'forearm', 'hand'),
                  ('hips', 'thigh', 'shin', 'foot', 'toe')]:
        for parent, child in zip(chain, chain[1:]):
            PARENTS[child+'_'+side] = parent if parent in ('chest', 'hips') else parent+'_'+side
PARENTS['prop_R'] = 'hand_R'
rig = bpy.data.objects.get('FanRig')
assert rig and rig.type == 'ARMATURE', 'Missing shared FanRig'
assert set(rig.data.bones.keys()) == set(PARENTS), 'Bone names differ from the 23-bone contract'
assert all((b.parent.name if b.parent else None) == PARENTS[b.name] for b in rig.data.bones)
assert rig.data.bones['root'].head_local.length < 1e-7
assert all(p.matrix_basis.is_identity for p in rig.pose.bones), 'Checks require neutral bind pose'
layout = json.loads(bpy.data.objects[IDS[0]]['joint_layout'])
for bone, marker in [('hips', 'hips'), ('spine', 'spine'), ('chest', 'chest'),
                     ('neck', 'neck'), ('head', 'head'), ('upper_arm_L', 'shoulder_L'),
                     ('forearm_L', 'elbow_L'), ('hand_L', 'wrist_L'),
                     ('thigh_L', 'hip_L'), ('shin_L', 'knee_L'), ('foot_L', 'ankle_L')]:
    assert (rig.data.bones[bone].head_local-Vector(layout[marker])).length < 1e-6, bone
results, uniform_uvs = [], []
for ob in [rig] + [bpy.data.objects[n] for n in IDS]:
    assert ob.location.length < 1e-7 and all(abs(v) < 1e-7 for v in ob.rotation_euler), ob.name
    assert all(abs(v-1) < 1e-7 for v in ob.scale), ob.name
for name in IDS:
    ob = bpy.data.objects[name]
    assert ob.parent == rig
    mods = [m for m in ob.modifiers if m.type == 'ARMATURE']
    assert len(mods) == 1 and mods[0].object == rig and not mods[0].use_deform_preserve_volume
    me = ob.data
    me.calc_loop_triangles()
    assert len(me.loop_triangles) <= 15000 and len(me.materials) <= 3
    assert all(p.area > 1e-10 for p in me.polygons), (name, 'zero area')
    bm = bmesh.new()
    bm.from_mesh(me)
    nonmanifold = sum(not e.is_manifold for e in bm.edges)
    loose = sum(not v.link_faces for v in bm.verts)
    bm.free()
    assert nonmanifold == loose == 0, (name, nonmanifold, loose)
    for v in me.vertices:
        weights = [g.weight for g in v.groups if ob.vertex_groups[g.group].name in PARENTS]
        assert 1 <= len(weights) <= 4 and abs(sum(weights)-1) < 1e-5, (name, v.index, weights)
        assert min(weights) >= .0099
    assert len(me.uv_layers) == 1, (name, 'UV')
    assert 'Uniform' in me.materials
    uniform = me.materials.find('Uniform')
    polygons = [p for p in me.polygons if p.material_index == uniform]
    assert polygons
    uv = me.uv_layers.active.data
    coords = [tuple(uv[i].uv) for p in polygons for i in p.loop_indices]
    assert all(0 <= u <= 1 and 0 <= v <= 1 for u, v in coords)
    uniform_uvs.append(coords)
    assert any(abs(coords[0][axis]-c[axis]) > .5 for c in coords for axis in (0, 1)), 'Collapsed UV'
    height = max(v.co.z for v in me.vertices)
    assert 1.60 <= height <= 1.84 and abs(min(v.co.z for v in me.vertices)) < 1e-6
    results.append(dict(id=name, vertices=len(me.vertices), triangles=len(me.loop_triangles),
                        height=round(height, 4), materials=[m.name for m in me.materials],
                        max_influences=max(len(v.groups) for v in me.vertices),
                        nonmanifold_edges=nonmanifold, unweighted_vertices=0))
assert all(uv == uniform_uvs[0] for uv in uniform_uvs), 'Uniform UV layouts differ'
assert set(o.name for o in bpy.data.scenes['FanAssets'].objects if o.type == 'MESH') == set(IDS)
assert not bpy.data.actions, 'T30 must not include T35 animation clips'
out = dict(ok=True, stage='T30-rig', rig=rig.name, joints=len(PARENTS),
           parents=PARENTS, characters=results, shared_uniform_uv=True, clips=[])
(OUT/'rig-metrics.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps(out))
