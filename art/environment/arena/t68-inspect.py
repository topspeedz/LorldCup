"""Read-only batch survey of the ledge and entrance geometry."""
import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
assert bpy.app.background
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
rows = []
for ob in scene.objects:
    if ob.type != 'MESH' or not any(key.lower() in ob.name.lower() for key in
        ('Tier', 'Ribbon', 'Suite', 'EntryRamp', 'Seats__', 'Seat_arm', 'Aisle', 'Concourse')):
        continue
    if ob.name.startswith(('REF_RibbonProgram_', 'REF_SuiteRibbon_')) and not ob.name.endswith(('_0', '_16', '_32', '_48')):
        continue
    points = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
    rows.append(dict(name=ob.name, vertices=len(ob.data.vertices), faces=len(ob.data.polygons),
        bounds=[[round(min(p[i] for p in points), 5), round(max(p[i] for p in points), 5)] for i in range(3)],
        matrix=[list(row) for row in ob.matrix_world],
        materials=[m.name if m else None for m in ob.data.materials],
        modifiers=[(m.name, m.type) for m in ob.modifiers],
        attrs=[a.name for a in ob.data.attributes], uv=[u.name for u in ob.data.uv_layers],
        baked=dict(ob['bakedLighting']) if 'bakedLighting' in ob else None, hidden=ob.hide_render))
report = dict(file=bpy.data.filepath, objects=len(scene.objects), rows=rows,
    export_properties=[p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties])
(ROOT/'temp/T68/source-survey.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('T68_SURVEY', json.dumps([dict(name=r['name'], bounds=r['bounds'], faces=r['faces'], baked=r['baked']) for r in rows]), flush=True)
