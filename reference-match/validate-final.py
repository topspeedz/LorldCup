"""Read-only checks of the reconstructed collection; no scene or mesh edits."""
import bpy, bmesh, json, math
from pathlib import Path

ROOT = Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve() == (ROOT / 'barclays-worlds-2026.blend').resolve()
scene = bpy.data.scenes['Barclays • WORLDS 2026']
col = bpy.data.collections['ReferenceMatch']
dg = bpy.context.evaluated_depsgraph_get()
records = []
for ob in sorted(col.objects, key=lambda o: o.name):
    if ob.type != 'MESH':
        continue
    me = ob.data
    me.calc_loop_triangles()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    rec = dict(name=ob.name, vertices=len(me.vertices), faces=len(me.polygons),
               triangles=len(me.loop_triangles), boundary_edges=sum(e.is_boundary for e in bm.edges),
               nonmanifold_edges=sum(not e.is_manifold for e in bm.edges),
               inconsistent_winding=sum(e.is_manifold and not e.is_contiguous for e in bm.edges),
               degenerate_faces=sum(f.calc_area() < 1e-12 for f in bm.faces),
               finite=all(math.isfinite(c) for v in me.vertices for c in v.co),
               uv_layers=[u.name for u in me.uv_layers],
               finite_uvs=all(math.isfinite(c) for u in me.uv_layers for loop in u.data for c in loop.uv),
               materials=[m.name if m else None for m in me.materials],
               invalid_material_indices=sum(p.material_index >= len(me.materials) for p in me.polygons),
               bounds_local=[[min(v.co[i] for v in me.vertices), max(v.co[i] for v in me.vertices)] for i in range(3)],
               modifiers=[dict(name=m.name, type=m.type) for m in ob.modifiers])
    rec['signed_volume'] = bm.calc_volume(signed=True) if rec['nonmanifold_edges'] == 0 else None
    bm.free()
    evaluated = ob.evaluated_get(dg)
    em = evaluated.to_mesh()
    em.calc_loop_triangles()
    rec['evaluated_triangles'] = len(em.loop_triangles)
    rec['evaluated_finite'] = all(math.isfinite(c) for v in em.vertices for c in v.co)
    ebm = bmesh.new()
    ebm.from_mesh(em)
    rec['evaluated_nonmanifold_edges'] = sum(not e.is_manifold for e in ebm.edges)
    rec['evaluated_inconsistent_winding'] = sum(e.is_manifold and not e.is_contiguous for e in ebm.edges)
    ebm.free()
    evaluated.to_mesh_clear()
    records.append(rec)

text_triangles = 0
for ob in col.objects:
    if ob.type == 'FONT':
        evaluated = ob.evaluated_get(dg)
        em = evaluated.to_mesh()
        em.calc_loop_triangles()
        text_triangles += len(em.loop_triangles)
        evaluated.to_mesh_clear()

images = {n.image for ob in col.objects for m in getattr(ob.data, 'materials', []) if m and m.use_nodes
          for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
report = dict(filepath=bpy.data.filepath, scene=scene.name, engine=scene.render.engine,
              active_camera=scene.camera.name, mesh_count=len(records),
              triangles=sum(r['triangles'] for r in records),
              evaluated_mesh_triangles=sum(r['evaluated_triangles'] for r in records),
              evaluated_text_triangles=text_triangles,
              text_objects=sum(o.type == 'FONT' for o in col.objects),
              light_objects=sum(o.type == 'LIGHT' for o in col.objects),
              cameras={o.name:dict(location=list(o.location),rotation=list(o.rotation_euler),lens=o.data.lens)
                       for o in col.objects if o.type == 'CAMERA'},
              hidden_new_objects=[o.name for o in col.objects if o.hide_render],
              archived_objects=len(bpy.data.collections['ReferenceMatch_PreviousStage'].objects),
              images=[dict(name=i.name, size=list(i.size), packed=bool(i.packed_file)) for i in sorted(images,key=lambda i:i.name)],
              meshes=records)
open_prefixes = ('REF_BackdropArtwork_', 'REF_DeskFace_', 'REF_HeaderCrest_', 'REF_Jumbotron_',
                 'REF_PedestalCrest', 'REF_PlayerJersey_', 'REF_RibbonProgram_', 'REF_SuiteRibbon_', 'REF_WorldsCrest')
failures = [r['name'] for r in records if not r['finite'] or not r['evaluated_finite'] or not r['finite_uvs']
            or r['inconsistent_winding'] or r['evaluated_inconsistent_winding'] or r['degenerate_faces'] or r['invalid_material_indices']
            or (r['signed_volume'] is not None and r['signed_volume'] <= 0)
            or ((r['nonmanifold_edges'] or r['evaluated_nonmanifold_edges']) and not r['name'].startswith(open_prefixes))]
report['intentional_open_surfaces'] = sum(r['nonmanifold_edges'] > 0 for r in records)
report['closed_solid_meshes'] = sum(r['nonmanifold_edges'] == 0 for r in records)
report['check_failures'] = failures
(ROOT / 'reference-match/final-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k != 'meshes'}))
assert not failures, failures
