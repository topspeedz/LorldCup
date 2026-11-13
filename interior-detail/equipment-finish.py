"""Executed supplemental finish pass; only four existing equipment modifier stacks."""
import bpy, bmesh, math, json
from pathlib import Path
root=Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve()==(root/'barclays-worlds-2026.blend').resolve()
records=[]
for name,width in [('Player_chair_back__blue',.045),('Player_chair__black',.035),('Monitor_housing__black',.007),('Player_PC__black',.012)]:
    obj=bpy.data.objects[name]
    assert not obj.modifiers.get('InteriorDetail rounded edges')
    obj.data.calc_loop_triangles();before=len(obj.data.loop_triangles)
    mod=obj.modifiers.new('InteriorDetail rounded edges','BEVEL')
    mod.width=width;mod.segments=3;mod.affect='EDGES';mod.limit_method='ANGLE';mod.harden_normals=True
    bpy.context.view_layer.update()
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());me=evaluated.to_mesh()
    me.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(me)
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
    assert all(math.isfinite(c) for v in bm.verts for c in v.co)
    records.append(dict(name=name,before=before,after=len(me.loop_triangles),width=width))
    bm.free();evaluated.to_mesh_clear()
(root/'interior-detail/equipment-finish.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
