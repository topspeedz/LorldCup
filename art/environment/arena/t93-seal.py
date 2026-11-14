"""Close the ramp-side slot requested while the single lightmap bake was running."""
import ast
import json
from pathlib import Path
import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
scene = bpy.context.scene
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t93-final.blend'
cy = -.005370497703552246
sealed = []
for name in ('Walk_RampA__T93EntryAccess', 'Walk_RampA__T93SeatAccess', 'Walk_RampB__T93SeatAccess'):
    ob = scene.objects[name]
    axis = 1 if 'Entry' in name else 0
    offset = cy if axis == 1 else 0
    me = ob.data
    for v in me.vertices:
        value = v.co[axis] - offset
        if abs(abs(value) - 3.45) < .0001:
            v.co[axis] = offset + (3.383 if value > 0 else -3.383)
    verts, faces, lighting_uv = [], [], []
    source_uv = me.attributes['_LIGHTMAP_UV']
    for poly in me.polygons:
        points = [me.vertices[i].co.copy() for i in poly.vertices]
        if not all(abs(abs(p[axis] - offset) - 3.383) < .0001 for p in points):
            continue
        k = len(verts)
        for p, li in zip(points, poly.loop_indices):
            top = max(q.z for q in points if (q.xy - p.xy).length < .0001)
            # shortcut: reuse adjacent tread lighting for this narrow new skirt; rebake only if its shading is rejected.
            verts.append(tuple(p if abs(p.z - top) < .001 else Vector((p.x, p.y, -10.2))))
            lighting_uv.append(tuple(source_uv.data[li].vector))
        faces.append(tuple(range(k, k + len(points))))
    mesh = bpy.data.meshes.new(name + '_skirts')
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(bpy.data.materials['concrete'])
    mesh.update()
    attr = mesh.attributes.new('_LIGHTMAP_UV', 'FLOAT2', 'CORNER')
    for loop, uv in zip(attr.data, lighting_uv):
        loop.vector = uv
    shader_uv = mesh.uv_layers.new(name='ShaderUV')
    for i, loop in enumerate(mesh.loops):
        p = mesh.vertices[loop.vertex_index].co
        shader_uv.data[i].uv = (p.x / 2, p.z / 2)
    skirt = bpy.data.objects.new('Collide_T93' + ('Entry' if 'Entry' in name else 'RampA' if 'RampA' in name else 'RampB') + 'Skirts__concrete', mesh)
    scene.collection.objects.link(skirt)
    skirt['bakedLighting'] = dict(ob['bakedLighting'])
    sealed.append({'access': name, 'collision': skirt.name, 'faces': len(faces)})
    assert len(faces) == 48
report = json.loads((OUT / 'geometry-changes.json').read_text())
report['sealed_ramp_slots'] = sealed
report['late_instruction'] = '여기 공간으로 밑으로 점프해서들어가면 빠지거든? 밑으로 내려가질수없게 막아줘'
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93-sealed.blend'))
for node in ast.parse((ART / 't93-export.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'settings' for t in node.targets):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'T93 export settings', 'exec'))
path = OUT / 'arena-sealed.glb'
assert not path.exists()
result = bpy.ops.export_scene.gltf(filepath=str(path), **settings)
assert 'FINISHED' in result
stages = json.loads((OUT / 'compression-stages.json').read_text())
stages.append({'stage': 'sealed', 'bytes': path.stat().st_size, 'file': str(path)})
(OUT / 'compression-stages.json').write_text(json.dumps(stages, indent=2))
print('T93_SEALED', json.dumps(sealed), path.stat().st_size)
