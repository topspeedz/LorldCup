"""Keep the six existing upper stand positions clear until T97 updates the seat list."""
import ast
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t93-sealed.blend'
report = json.loads((OUT / 'geometry-changes.json').read_text())
skip = [s for s in report['new_seats'] if s['reserved'] and s['row'] >= 19]
assert len(skip) == 6
expected = {}
for s in skip:
    c, t = Vector(s['blender']), s['angle']
    expected.setdefault('Seats__seat', []).extend([c + Vector((0, 0, .39)), c + Vector((.22 * math.cos(t), .22 * math.sin(t), .76))])
    expected.setdefault('Fix_SeatBases__steel', []).append(c + Vector((0, 0, .16)))
    for side in (-1, 1):
        expected.setdefault('Seat_armrests__steel', []).append(c + Vector((side * .28 * math.cos(t - math.pi / 2), side * .28 * math.sin(t - math.pi / 2), .61)))
removed = {}
for name, centers in expected.items():
    ob = bpy.context.scene.objects[name]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    delete = []
    for i in range(0, len(ob.data.vertices) - 7, 8):
        center = sum((ob.matrix_world @ v.co for v in ob.data.vertices[i:i + 8]), Vector()) / 8
        if any((center - c).length < .001 for c in centers):
            delete.extend(bm.verts[j] for j in range(i, i + 8))
    assert len(delete) == len(centers) * 8, (name, len(delete), len(centers))
    bmesh.ops.delete(bm, geom=delete, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    removed[name] = len(centers)
by_id = {s['id']: s for s in report['new_seats'] if s['reserved']}
report['handoff_seats'] = [dict(old, screenFace='west', retained=True) if int(old['id'][-2:]) <= 3 else by_id[old['id']]
                           for old in report['protected_seats']]
report['new_seats'] = [s for s in report['new_seats'] if s not in skip]
report['preserved_upper_six'] = 'Existing 01-03 per side retain their seats and stand positions; 04-08 are recommended on the new column.'
report['removed_own_overlapping_parts'] = removed
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93-ready.blend'))
for node in ast.parse((ART / 't93-export.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'settings' for t in node.targets):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'T93 export settings', 'exec'))
path = OUT / 'arena-ready.glb'
assert not path.exists()
assert 'FINISHED' in bpy.ops.export_scene.gltf(filepath=str(path), **settings)
stages = json.loads((OUT / 'compression-stages.json').read_text())
stages.append({'stage': 'ready', 'bytes': path.stat().st_size, 'file': str(path)})
(OUT / 'compression-stages.json').write_text(json.dumps(stages, indent=2))
print('T93_READY', len(report['new_seats']), 'new chairs; preserved six original stand positions;', path.stat().st_size)
