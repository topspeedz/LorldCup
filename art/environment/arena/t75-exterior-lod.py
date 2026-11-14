"""Decimate the large exterior wall/panel surfaces after joining sub-metre panel seams."""
import json
from pathlib import Path
import bmesh
import bpy

ART = Path(__file__).resolve().parent
OUT = ART.parents[2] / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t75.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
selected = {'EXR_Folded corten facade', 'EXR_Dark rainscreen backing', 'EXR_Continuous glass belt',
    'EXR_Canopy upper panels', 'EXR_Canopy soffit panels', 'EXR_Canopy fascia louvers',
    'EXR_Canopy fascia backing', 'EXR_Entrance glazing'}
count = lambda mesh: sum(len(p.vertices) - 2 for p in mesh.polygons)
rows = []
for copy in list(scene.objects):
    if not copy.name.endswith('__lod10'):
        continue
    name = copy.name[:-7]
    if name not in selected:
        bpy.data.objects.remove(copy, do_unlink=True)
        continue
    original = scene.objects[name]
    copy.data = original.data.copy(); copy.modifiers.clear()
    assert len(copy.data.vertices) % 8 == 0, name
    front = {}
    for poly in copy.data.polygons:
        block = poly.vertices[0] // 8
        assert all(v // 8 == block for v in poly.vertices), name
        if block not in front or poly.area > copy.data.polygons[front[block]].area:
            front[block] = poly.index
    assert len(front) == len(copy.data.vertices) // 8, name
    bm = bmesh.new(); bm.from_mesh(copy.data)
    bm.faces.ensure_lookup_table()
    keep = set(front.values())
    bmesh.ops.delete(bm, geom=[face for face in bm.faces if face.index not in keep], context='FACES')
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.35)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-6)
    bm.to_mesh(copy.data); bm.free()
    welded = count(copy.data)
    modifier = copy.modifiers.new('Ten percent exterior surface', 'DECIMATE')
    modifier.ratio = min(1, count(original.data) * .10 / welded)
    modifier.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    reduced = bpy.data.meshes.new_from_object(copy.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    copy.modifiers.clear(); copy.data = reduced
    row = dict(original=name, lod=copy.name, before=count(original.data), after=count(reduced), welded_triangles=welded)
    row['ratio'] = row['after'] / row['before']
    rows.append(row)
    assert .06 <= row['ratio'] <= .13, row
report = json.loads((OUT / 'geometry-changes.json').read_text())
report['lod_pairs'] = rows
report['added_nodes'] = [name for name in report['added_nodes'] if name in scene.objects]
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t75.blend'))
print('T75_EXTERIOR_LOD', json.dumps(rows), flush=True)
