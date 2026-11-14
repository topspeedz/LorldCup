"""Close slope undersides and validate the approved flat entrance infill before the one bake."""
import ast
import json
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t75.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
modified = set()
for node in ast.parse((ART / 't75-build.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.FunctionDef) and node.name in ('commit', 'make'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 't75-build helpers', 'exec'))

for label, side in (('A', 1), ('B', -1)):
    end = 51 - 9.8 * 32 / 10
    vertices = [(-3.383,side*51,-10),(-3.383,side*end,-10),(-3.383,side*51,-.2),
                (3.383,side*51,-10),(3.383,side*end,-10),(3.383,side*51,-.2)]
    ob = make(f'Collide_Ramp{label}Infill__concrete', 'concrete', vertices,
              [(0,2,1),(3,4,5),(0,1,4,3),(0,3,5,2),(2,5,4,1)])
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); commit(ob, bm)

# Extend only the flat patch's outer tip to overlap the measured concourse edge.
floor = scene.objects['Walk_Tier0__concrete']
for v in floor.data.vertices:
    p = floor.matrix_world @ v.co
    if abs(p.x + 55.5) < 1e-5 and abs(abs(p.y) - 5.2) < 1e-5 and abs(p.z) <= .201:
        p.y = 6.0 if p.y > 0 else -6.0
        v.co = floor.matrix_world.inverted() @ p
floor.data.update()

for ob in scene.objects:
    if ob.type != 'MESH' or not ob.name.startswith(('Walk_Ramp', 'Collide_RampAInfill', 'Collide_RampBInfill', 'Collide_EntryLowCurbs')):
        continue
    uv = ob.data.uv_layers.get('ShaderUV') or ob.data.uv_layers.new(name='ShaderUV')
    for poly in ob.data.polygons:
        normal = ob.matrix_world.to_3x3() @ poly.normal
        axes = [i for i in range(3) if i != max(range(3), key=lambda i: abs(normal[i]))]
        for loop in poly.loop_indices:
            point = ob.matrix_world @ ob.data.vertices[ob.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (point[axes[0]] / 2, point[axes[1]] / 2)

report = json.loads((OUT / 'geometry-changes.json').read_text())
report['entrance_black_regions'] = {'source_probe': 'temp/T75/panels-probe.log',
    'finding': 'Rays through the black wedges hit no panel; the source has floor gaps.',
    'fix': 'Two flat concourse-height patches outside the unchanged central ramp, plus 0.12 m edge curbs.'}
report['edge_segments_blender'] = [dict(zone='entry', start=[-58.9, side * 3.388, 0], end=[-55.5, side * 3.388, 0]) for side in (-1, 1)]
report['edge_segments_blender'] += [dict(zone='ramp-' + label, start=[side_x * 3.383, side_y * 51, 0],
    end=[side_x * 3.383, side_y * 19, -10]) for label, side_y in (('A', 1), ('B', -1)) for side_x in (-1, 1)]
report['added_nodes'] += ['Collide_RampAInfill__concrete', 'Collide_RampBInfill__concrete']
report['pending'] = ['complete clearance check', 'lightmap bake/export']
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t75.blend'))
print('T75_FLOOR_CLOSURE_SAVED', flush=True)
