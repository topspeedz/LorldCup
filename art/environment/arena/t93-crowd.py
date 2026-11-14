"""Duplicate one existing seated spectator with the same seven crowd-motion attributes."""
import json
import math
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t93.blend'
scene = bpy.context.scene
report = json.loads((OUT / 'geometry-changes.json').read_text())
template = json.loads((OUT / 'crowd-template.json').read_text())
origin = Vector(template['origin'])
world_origin = Vector(template['world'])
row = (world_origin.z + 9.9) / .43
source_angle = math.atan2(world_origin.y / (21 + row * 1.08), world_origin.x / (31 + row * 1.08))
targets = [s for i, s in enumerate(report['new_seats']) if not s['reserved'] and i % 3 != 0]
names = ['_CM_ORIGIN', '_CM_RIGHT', '_CM_FRONT', '_CM_PART', '_CM_SIDE', '_CM_SEED', '_CM_STYLE']
modified = []
copied_parts = set()
for ob in list(scene.objects):
    if ob.type != 'MESH' or '_CM_ORIGIN' not in ob.data.attributes:
        continue
    me = ob.data
    values = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.attributes['_CM_ORIGIN'].data.foreach_get('vector', values)
    ids = set(np.flatnonzero(np.max(np.abs(values.reshape(-1, 3) - np.array(origin)), axis=1) < .0001))
    if not ids:
        continue
    copied_parts.update(round(me.attributes['_CM_PART'].data[i].value) for i in ids)
    polys = [p for p in me.polygons if all(v in ids for v in p.vertices)]
    bm = bmesh.new()
    bm.from_mesh(me)
    attrs = {name: bm.verts.layers.float_vector[name] if name in names[:3] else bm.verts.layers.float[name] for name in names}
    uv_layers = {uv.name: bm.loops.layers.uv[uv.name] for uv in me.uv_layers}
    inv = ob.matrix_world.inverted()
    for serial, target in enumerate(targets):
        rotation = Matrix.Rotation(target['angle'] - source_angle, 3, 'Z')
        center = Vector(target['blender'])
        new = {}
        for index in ids:
            p = ob.matrix_world @ me.vertices[index].co
            v = bm.verts.new(inv @ (center + rotation @ (p - world_origin)))
            new[index] = v
            for name, layer in attrs.items():
                value = me.attributes[name].data[index]
                if name == '_CM_ORIGIN':
                    v[layer] = inv @ center
                elif name in names[1:3]:
                    v[layer] = inv.to_3x3() @ rotation @ ob.matrix_world.to_3x3() @ value.vector
                else:
                    v[layer] = (value.value + serial * .61803398875) % 1 if name == '_CM_SEED' else value.value
        for poly in polys:
            face = bm.faces.new([new[v] for v in poly.vertices])
            face.material_index = poly.material_index
            face.smooth = poly.use_smooth
            for loop, li in zip(face.loops, poly.loop_indices):
                for name, layer in uv_layers.items():
                    loop[layer].uv = me.uv_layers[name].data[li].uv
    bm.to_mesh(me)
    bm.free()
    me.update()
    modified.append(ob.name)
clear_zones = json.loads((ROOT / 'web/config/crowd.json').read_text())['clearZones']
hidden = []
for target in targets:
    p = target['position']
    matches = [i for i, box in enumerate(clear_zones) if all(box['min'][j] <= p[j] <= box['max'][j] for j in range(3))]
    if matches:
        hidden.append({'id': target['id'], 'position': p, 'clearZoneIndices': matches})
report['crowd'] = {'new_origins': len(targets), 'meshes': modified, 'existing_clear_zone_matches': hidden}
report['modified'] = sorted(set(report['modified'] + modified))
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
assert set(range(6)) <= copied_parts, 'Preserve the existing body, head, arms and legs'
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93-crowd.blend'))
print('T93_CROWD', len(targets), 'origins;', len(hidden), 'need T97 clear-zone adjustment')
