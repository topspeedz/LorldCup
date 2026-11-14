"""Read-only ratios and bounds for the paired exterior LOD nodes."""
import json
import bpy

scene = bpy.data.scenes['Barclays • WORLDS 2026']
count = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
print('T75_LOD_COUNTS', json.dumps([dict(name=ob.name, original=count(scene.objects[ob.name[:-7]]),
    reduced=count(ob), ratio=count(ob)/count(scene.objects[ob.name[:-7]]))
    for ob in scene.objects if ob.name.endswith('__lod10')]), flush=True)
