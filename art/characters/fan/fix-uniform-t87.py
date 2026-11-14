"""T87: keep the front artwork; move the back/sleeve UVs off the team-colour border."""
import hashlib
import json
from pathlib import Path

import bpy

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
assert Path(bpy.data.filepath).resolve() == (OUT/'fan-female-t66.blend').resolve()
assert (ROOT/'_workspace/_run/2026-11-13-ux-motion-rooms/bak/T87/fan.glb').exists()
assert not (OUT/'fan-uniform-t87.blend').exists()
rows = []
for name in ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'):
    mesh = bpy.data.objects[name].data
    uv = mesh.uv_layers.active.data
    patch = [p for p in mesh.polygons if mesh.materials[p.material_index].name == 'Uniform'
             and all(.0249 <= uv[i].uv.x <= .1251 and .2999 <= uv[i].uv.y <= .6501 for i in p.loop_indices)]
    assert len(patch) == 106, (name, len(patch))
    changed = {i for p in patch for i in p.loop_indices}
    unchanged = {i: tuple(point.uv) for i, point in enumerate(uv) if i not in changed}
    geometry = repr([(tuple(v.co), [(g.group, g.weight) for g in v.groups]) for v in mesh.vertices])
    for i in changed:
        u, v = uv[i].uv
        # Both original team PNGs have plain cloth at pixels x=102..154, y=287..307.
        uv[i].uv = (.20 + (u - .025), .40 + (v - .30) * .04 / .35)
    assert all(tuple(uv[i].uv) == value for i, value in unchanged.items())
    assert geometry == repr([(tuple(v.co), [(g.group, g.weight) for g in v.groups]) for v in mesh.vertices])
    rows.append({'name': name, 'changed_faces': len(patch), 'changed_loops': len(changed),
                 'front_and_other_uvs_preserved': True, 'geometry_and_weights_preserved': True,
                 'geometry_sha256': hashlib.sha256(geometry.encode()).hexdigest()})

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fan-uniform-t87.blend'))
# Keep the established export settings; export to a candidate before replacing the backed-up web asset.
code = (OUT/'export-fan.py').read_text(encoding='utf-8')
code = code.replace("OUT/'fan-rigged.blend'", "OUT/'fan-uniform-t87.blend'")
code = code.replace("ROOT/'web/assets/characters/fan.glb'", "ROOT/'temp/T87/fan-candidate.glb'")
exec(compile(code, str(OUT/'export-fan.py'), 'exec'))
(ROOT/'temp/T87/source-check.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
print(json.dumps(rows))
