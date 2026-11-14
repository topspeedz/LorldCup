"""Open the concourse above the new ramps and check actual floor/head clearance."""
import ast
import json
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T75'
source = Path(bpy.data.filepath).resolve()
assert bpy.app.background and source in (ART / 'barclays-arena-t75.blend', ART / 'barclays-arena-t75-baked.blend')
strips_only = '--strips-only' in sys.argv
scene = bpy.data.scenes['Barclays • WORLDS 2026']; bpy.context.window.scene = scene
modified = set()
for node in ast.parse((ART / 't75-build.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.FunctionDef) and node.name in ('commit', 'cut_box'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 't75-build helpers', 'exec'))

targets = [] if strips_only else [scene.objects['Walk_Concourse__concrete']]
for name in ('Aisle_step_lights__cyan', 'AudienceDetail_Aisle_nosing', 'AudienceDetail_Aisle_guides'):
    targets.append(scene.objects[name])
for ob in scene.objects:
    if strips_only or not ob.name.startswith(('REF_RibbonProgram_0_', 'REF_RibbonBrand_0_')):
        continue
    points = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
    if min(p.x for p in points) < 3.5 and max(p.x for p in points) > -3.5:
        targets.append(ob)
for ob in targets:
    if ob.type != 'MESH':
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.convert(target='MESH')
    for side in (-1, 1):
        low, high = sorted((side * 18.8, side * 51))
        bottom = -11 if ob.name.startswith(('Aisle_', 'AudienceDetail_')) else -2
        cut_box(ob, (-3.45, low, bottom), (3.45, high, 1.2))
    if ob.get('bakedLighting'):
        assert ob.data.attributes.get('_LIGHTMAP_UV'), ob.name

trees = []
for ob in scene.objects:
    if ob.type != 'MESH' or not ob.data.polygons or not ob.name.startswith(('Walk_', 'Suites_floor', 'REF_RibbonProgram_0_')):
        continue
    trees.append((ob.name, BVHTree.FromPolygons([ob.matrix_world @ v.co for v in ob.data.vertices],
        [tuple(p.vertices) for p in ob.data.polygons])))
blocked = []
for side in (-1, 1):
    for step in range(1, 320):
        y = side * (51 - step * .1); z = -step * .1 * 10 / 32
        for x in (-2.7, 0, 2.7):
            for name, tree in trees:
                hit = tree.ray_cast(Vector((x, y, z + .02)), Vector((0, 0, 1)), 1.85)[0]
                if hit:
                    blocked.append(dict(name=name, at=[x, y, z], hit=list(hit)))
report = json.loads((OUT / 'geometry-changes.json').read_text())
report['modified'] = sorted(set(report['modified']) | modified)
report['head_clearance'] = dict(samples=1914, blocked=blocked)
(OUT / 'clearance-check.json').write_text(json.dumps(report['head_clearance'], indent=2))
assert not blocked, blocked[:8]
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('T75_RAMP_HEAD_CLEARANCE', json.dumps(report['head_clearance']), flush=True)
