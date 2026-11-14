"""Identify entrance-side panels from rays; no saved changes."""
import json
from pathlib import Path
import bpy
from mathutils import Vector

scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
dg = bpy.context.evaluated_depsgraph_get()
rows = []
for x in (-61, -59, -57, -55):
    for y in (4.3, 6, 8):
        start = Vector((x, y, .9))
        for _ in range(3):
            hit, point, normal, face, ob, _ = scene.ray_cast(dg, start, Vector((0, 0, -1)), distance=12)
            if not hit:
                break
            rows.append(dict(x=x, y=y, object=ob.name, point=list(point), normal=list(normal), face=face))
            start = point - Vector((0, 0, .01))
print('T75_PANEL_RAYS', json.dumps(rows), flush=True)
import math
origin = Vector((-62, 0, 2)); forward = Vector((8, 0, -3)).normalized()
right = Vector((0, -1, 0)); up = right.cross(forward)
hits = []
for u in (-.9, -.7, -.5, .5, .7, .9):
    for v in (-.15, -.4, -.65):
        direction = (forward + right * u * 1.5 * math.tan(math.radians(34)) + up * v * math.tan(math.radians(34))).normalized()
        hit, point, normal, face, ob, _ = scene.ray_cast(dg, origin, direction, distance=20)
        if hit:
            hits.append(dict(u=u, v=v, object=ob.name, point=list(point), normal=list(normal), face=face))
print('T75_VIEW_PANEL_RAYS', json.dumps(hits), flush=True)
print('T75_BM_FROM_MESH_DOC', __import__('bmesh').types.BMesh.from_mesh.__doc__, flush=True)
