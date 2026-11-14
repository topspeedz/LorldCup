"""Measure removed chair bounds in the untouched T68 source for the T83 handoff."""
import collections
import json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == OUT / 'source.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
changes = json.loads((OUT / 'geometry-changes.json').read_text())
key = lambda p: tuple(round(v, 4) for v in p)
convert = lambda p: [round(p[0], 5), round(p[2], 5), round(-p[1], 5)]
targets = {key(row['center']): row['zone'] for row in changes['removed_chairs']}
points = collections.defaultdict(list)
parts = []
for name in ('Seats__seat', 'Seats__seat2'):
    ob = scene.objects[name]
    for first in range(0, len(ob.data.vertices), 8):
        vertices = [ob.matrix_world @ v.co for v in ob.data.vertices[first:first + 8]]
        center = sum(vertices, Vector()) / 8
        if key(center) not in targets:
            continue
        zone = targets[key(center)]
        vertices = [convert(p) for p in vertices]
        points[zone].extend(vertices)
        parts.append(dict(zone=zone, center=convert(center),
            min=[min(p[i] for p in vertices) for i in range(3)],
            max=[max(p[i] for p in vertices) for i in range(3)]))
assert len(parts) == len(changes['removed_chairs'])
zones = [dict(zone=zone, min=[min(p[i] for p in vertices) for i in range(3)],
    max=[max(p[i] for p in vertices) for i in range(3)],
    chairParts=sum(p['zone'] == zone for p in parts)) for zone, vertices in points.items()]
edges = [dict(zone=e['zone'], start=convert(e['start']), end=convert(e['end']))
    for e in changes['edge_segments_blender']]
people = [dict(zone=p['zone'], origin=convert(p['origin'])) for p in changes['removed_people']]
result = dict(coordinates='glTF / Three.js metres: X right, Y up, Z = -Blender Y',
    zones=zones, removedChairParts=parts, removedCrowdOrigins=people, edgeSegments=edges,
    protectedSeats=json.loads((ROOT / 'web/config/seats.json').read_text())['seats'],
    exteriorLodPairs=changes['lod_pairs'])
(OUT / 'runtime-handoff.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print('T75_HANDOFF', json.dumps(dict(zones=zones, edgeSegments=edges, crowdOrigins=len(people))), flush=True)
