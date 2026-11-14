"""Cut only the three ramp passages in T93's invisible rear-ring collider."""
import ast
import hashlib
import json
import shutil
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93b'
SOURCE = ART / 'barclays-arena-t93-ready.blend'
TARGET = ART / 'barclays-arena-t93b.blend'
assert Path(bpy.data.filepath).resolve() == SOURCE
assert not bpy.data.is_dirty and not TARGET.exists()
barrier = bpy.context.scene.objects['Collide_T93RearRing__barrier']
assert len(barrier.modifiers) == 0 and barrier.data.users == 1


def digest(ob):
    h = hashlib.sha256()
    h.update(np.array(ob.matrix_world, dtype=np.float64).tobytes())
    h.update(str([m.name if m else None for m in ob.data.materials]).encode())
    for collection, field, width, dtype in [(ob.data.vertices, 'co', 3, np.float32),
            (ob.data.edges, 'vertices', 2, np.int32), (ob.data.loops, 'vertex_index', 1, np.int32),
            (ob.data.polygons, 'loop_total', 1, np.int32),
            (ob.data.polygons, 'material_index', 1, np.int32)]:
        values = np.empty(len(collection) * width, dtype=dtype)
        collection.foreach_get(field, values)
        h.update(values.tobytes())
    for attribute in ob.data.attributes:
        if attribute.data_type not in ('FLOAT', 'FLOAT2', 'FLOAT_VECTOR'):
            continue
        width = {'FLOAT': 1, 'FLOAT2': 2, 'FLOAT_VECTOR': 3}[attribute.data_type]
        values = np.empty(len(attribute.data) * width, dtype=np.float32)
        attribute.data.foreach_get('value' if width == 1 else 'vector', values)
        h.update((attribute.name + attribute.domain).encode())
        h.update(values.tobytes())
    return h.hexdigest()


def clipped(points, low, high):
    for axis in range(3):
        for bound, direction in ((low[axis], 1), (high[axis], -1)):
            result = []
            for a, b in zip(points, points[1:] + points[:1]):
                da, db = direction * (a[axis] - bound), direction * (b[axis] - bound)
                if da >= 0:
                    result.append(a)
                if (da < 0) != (db < 0):
                    result.append(a + (b - a) * (da / (da - db)))
            points = result
    return points


def area(points):
    return sum((points[i] - points[0]).cross(points[i + 1] - points[0]).length / 2
               for i in range(1, len(points) - 1))


def overlap(low, high):
    polygons = [clipped([barrier.matrix_world @ barrier.data.vertices[i].co for i in face.vertices], low, high)
                for face in barrier.data.polygons]
    polygons = [p for p in polygons if area(p) > 1e-7]
    points = [p for polygon in polygons for p in polygon]
    runtime = [(p.x, p.z, -p.y) for p in points]
    return {'faces': len(polygons), 'area': sum(area(p) for p in polygons),
            'min': [min(p[i] for p in runtime) for i in range(3)] if points else None,
            'max': [max(p[i] for p in runtime) for i in range(3)] if points else None}


protected = {o.name: digest(o) for o in bpy.context.scene.objects if o.type == 'MESH' and o != barrier}
hash_file = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = [*ART.glob('barclays-arena-t93-*.blend'), *sorted((ROOT / 'web/lightmaps').glob('*'))]
baseline = {str(p.relative_to(ROOT)): hash_file(p) for p in files if p.is_file()}
(OUT / 'backup').mkdir(parents=True, exist_ok=True)
backup = OUT / 'backup/arena-v2.glb'
assert not backup.exists()
shutil.copy2(ROOT / 'web/arena-v2.glb', backup)
(OUT / 'baseline.json').write_text(json.dumps({'files': baseline, 'meshes': protected,
    'glbSha256': hash_file(backup)}, indent=2), encoding='utf-8')

modified = set()
for node in ast.parse((ART / 't75-build.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.FunctionDef) and node.name in ('commit', 'cut_box'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'T75 collision cutting helpers', 'exec'))

before_area = sum(p.area for p in barrier.data.polygons)
before_faces = len(barrier.data.polygons)
openings = []
for label, name, cross_axis in [('entry', 'Walk_EntryRamp__concrete', 1),
        ('A', 'Walk_RampA__concrete', 0), ('B', 'Walk_RampB__concrete', 0)]:
    walk = bpy.context.scene.objects[name]
    points = [walk.matrix_world @ Vector(p) for p in walk.bound_box]
    low = [min(p[i] for p in points) - .3 for i in range(3)]
    high = [max(p[i] for p in points) + .3 for i in range(3)]
    low[2], high[2] = -10.5, 7
    opening = {'label': label, 'walk': name, 'margin_m': .3,
        'walkRuntimeMin': [low[0] + .3, min(p.z for p in points), -high[1] + .3],
        'walkRuntimeMax': [high[0] - .3, max(p.z for p in points), -low[1] - .3],
        'cutRuntimeMin': [low[0], low[2], -high[1]],
        'cutRuntimeMax': [high[0], high[2], -low[1]],
        'overlapBefore': overlap(low, high)}
    assert opening['overlapBefore']['area'] > 0
    print('T93b_CUT', json.dumps(opening), flush=True)
    cut_box(barrier, low, high)
    opening['overlapAfter'] = overlap(low, high)
    assert opening['overlapAfter']['area'] < 1e-5
    openings.append(opening)

after_area = sum(p.area for p in barrier.data.polygons)
removed_area = sum(o['overlapBefore']['area'] for o in openings)
assert abs(before_area - after_area - removed_area) < .002
assert modified == {barrier.name}
assert protected == {o.name: digest(o) for o in bpy.context.scene.objects if o.type == 'MESH' and o != barrier}
assert baseline == {str(p.relative_to(ROOT)): hash_file(p) for p in files if p.is_file()}
report = {'source': str(SOURCE), 'target': str(TARGET), 'modified': sorted(modified),
    'protectedMeshCount': len(protected), 'protectedMeshDataUnchanged': True,
    'sourceAndLightmapFilesUnchanged': True, 'beforeFaces': before_faces,
    'afterFaces': len(barrier.data.polygons), 'beforeArea': before_area,
    'afterArea': after_area, 'removedArea': removed_area, 'openings': openings}
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
assert 'FINISHED' in bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
print('T93b_SAVED', json.dumps({k: v for k, v in report.items() if k != 'openings'}), flush=True)
