"""Read-only geometry survey and plan-view data for T75 location approval."""
import json
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == OUT / 'source.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
plan = []
rows = []
for ob in scene.objects:
    if ob.type != 'MESH':
        continue
    mesh = ob.data
    xyz = np.empty((len(mesh.vertices), 3), dtype=np.float32)
    mesh.vertices.foreach_get('co', xyz.ravel())
    matrix = np.array(ob.matrix_world)
    world = xyz @ matrix[:3, :3].T + matrix[:3, 3]
    centers = np.empty((len(mesh.polygons), 3), dtype=np.float32)
    sizes = np.empty(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get('center', centers.ravel())
    mesh.polygons.foreach_get('loop_total', sizes)
    heights = centers @ matrix[2, :3] + matrix[2, 3]
    rows.append(dict(name=ob.name, triangles=int(np.sum(sizes - 2)),
        above5_triangles=int(np.sum((sizes - 2)[heights > 5])),
        bounds=[world.min(axis=0).round(5).tolist(), world.max(axis=0).round(5).tolist()],
        materials=[m.name if m else None for m in mesh.materials],
        attributes=[a.name for a in mesh.attributes],
        baked=dict(ob['bakedLighting']) if 'bakedLighting' in ob else None))
    if ob.name.startswith(('Seats__', 'Seat_armrests')):
        category = 'seats'
    elif ob.name.startswith(('Walk_Tier', 'Fix_TierRisers', 'Fix_TierFascia', 'Fix_TierSoffits')):
        category = 'tiers'
    elif ob.name.startswith(('Walk_Entry', 'Collide_Ramp')):
        category = 'entry'
    elif ob.name.startswith(('Walk_Arena', 'Arena_floor', 'Walk_Concourse', 'Walk_Atrium')):
        category = 'floor'
    elif ob.name.startswith(('REF_CircularStage', 'REF_TrophyIsland', 'REF_Runway',
                             'REF_CenterStairs', 'REF_TeamRiser', 'REF_DeskBody', 'REF_DeskFace')):
        category = 'stage'
    else:
        continue
    normals = np.empty((len(mesh.polygons), 3), dtype=np.float32)
    mesh.polygons.foreach_get('normal', normals.ravel())
    up = normals @ np.linalg.inv(matrix[:3, :3])[:, 2]
    for index in np.flatnonzero(up > .3):
        face = mesh.polygons[int(index)]
        vertices = world[list(face.vertices)]
        plan.append([category, round(float(heights[index]), 4),
                     vertices[:, :2].round(4).tolist()])
assert any(row['name'] == 'Walk_EntryRamp__concrete' for row in rows)
assert any(face[0] == 'seats' for face in plan)
(OUT / 'source-survey.json').write_text(json.dumps(rows), encoding='utf-8')
(OUT / 'plan-geometry.json').write_text(json.dumps(plan), encoding='utf-8')
print('T75_READ_ONLY_SURVEY', json.dumps(dict(objects=len(rows), plan_faces=len(plan),
      triangles=sum(row['triangles'] for row in rows), saved_blend=False)), flush=True)
