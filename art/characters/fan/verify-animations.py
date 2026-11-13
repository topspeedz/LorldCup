"""T35 source acceptance: run inside Blender MCP before export."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
CLIPS = ('Idle', 'Walk', 'Run', 'Jump', 'Sit', 'Emote_CheerClap',
         'Emote_Heart', 'Emote_Angry', 'Emote_EggThrow')
assert set(bpy.data.actions.keys()) == set(CLIPS), ('Missing clips', list(bpy.data.actions.keys()))
assert bpy.context.scene.render.fps == 30
rig = bpy.data.objects['FanRig']
assert len(rig.data.bones) == 23
egg = bpy.data.objects['Prop_Egg']
assert egg.type == 'MESH' and egg.parent is None and not egg.modifiers
assert egg.animation_data is None and len(egg.data.materials) == 1
egg.data.calc_loop_triangles()
assert len(egg.data.loop_triangles) <= 300
assert all(abs(s-1) < 1e-6 for s in egg.scale)
assert not any(n.type == 'TEX_IMAGE' for n in egg.data.materials[0].node_tree.nodes)

rows = []
for name in CLIPS:
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    curves = action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
    for curve in curves:
        path = curve.data_path
        assert path.startswith('pose.bones[') and '"root"' not in path, (name, path)
        assert path.endswith('.rotation_quaternion') or path == 'pose.bones["hips"].location', (name, path)
    start, end = action.frame_range
    assert start == 0 and end > start, (name, start, end)
    samples = sorted(set([start, end, (start+end)/2, *json.loads(action['sample_frames'])]))
    frames = []
    for frame in samples:
        bpy.context.scene.frame_set(int(frame), subframe=frame-int(frame))
        bpy.context.view_layer.update()
        assert max(abs(rig.pose.bones['root'].matrix_basis[i][j]-Matrix.Identity(4)[i][j])
                   for i in range(4) for j in range(4)) < 1e-6
        scale_error = max(abs(v-1) for p in rig.pose.bones for v in p.matrix.to_scale())
        assert scale_error < 1e-5, (name, frame, 'bone scale', scale_error)
        dg = bpy.context.evaluated_depsgraph_get()
        bodies = []
        for char in ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'):
            ob = bpy.data.objects[char]
            ob.hide_set(False)
            ev = ob.evaluated_get(dg)
            mesh = ev.to_mesh()
            minimum = min(v.co.z for v in mesh.vertices)
            assert minimum >= -.02, (name, frame, char, 'floor penetration', minimum)
            assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
            mesh.calc_loop_triangles()
            assert all(t.area > 1e-12 for t in mesh.loop_triangles), (name, frame, char, 'collapsed triangle')
            bodies.append({'id': char, 'floor_m': round(minimum, 6)})
            ev.to_mesh_clear()
        frames.append({'frame': frame, 'scale_error': scale_error, 'bodies': bodies})
    bpy.context.scene.frame_set(0)
    first = {p.name: p.rotation_quaternion.copy() for p in rig.pose.bones}
    bpy.context.scene.frame_set(int(end), subframe=end-int(end))
    if action['loop']:
        error = max(min((p.rotation_quaternion-first[p.name]).magnitude,
                        (p.rotation_quaternion+first[p.name]).magnitude) for p in rig.pose.bones)
        assert error < 1e-6, (name, 'loop seam', error)
    if name == 'Jump':
        assert not any(abs(c.evaluate(f)) > 1e-6 for c in curves if c.data_path.endswith('.location')
                       for f in samples), 'Jump must leave height to the runtime'
    rows.append({'clip': name, 'frames': [start, end], 'samples': frames})

assert 0 < bpy.data.actions['Emote_EggThrow']['egg_release'] < bpy.data.actions['Emote_EggThrow'].frame_range[1]
assert 0 <= bpy.data.actions['Emote_EggThrow']['egg_scream'] <= bpy.data.actions['Emote_EggThrow']['egg_release']
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
bpy.context.scene.frame_set(0)
(OUT/'animation-metrics.json').write_text(json.dumps({'ok': True, 'clips': rows}, indent=2), encoding='utf-8')
print(json.dumps({'ok': True, 'clips': len(rows), 'sampled_poses': sum(len(r['samples']) for r in rows),
                  'bodies_per_pose': 4, 'egg_triangles': len(egg.data.loop_triangles)}))
