"""Read the exported GLB in a separate Blender process; never save the import."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
assert bpy.app.background
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'web/arena-v2.glb'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
names = {o.name for o in bpy.context.scene.objects}
expected = json.loads((ART / 't32-source-inspection.json').read_text())['added']
for name in expected:
    if name != 'EXR_MoonLight':
        assert name in names, name
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
result = {'mesh_objects': len(meshes), 'materials': len(bpy.data.materials),
          'bounds_blender': [[min(v[i] for v in points), max(v[i] for v in points)] for i in range(3)],
          'new_meshes': [name for name in expected if name != 'EXR_MoonLight'],
          'screens': [f'REF_Jumbotron_{i}' for i in range(4) if f'REF_Jumbotron_{i}' in names]}
assert len(result['screens']) == 4
(ART / 't32-reopen.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print('T32_REOPEN', json.dumps(result), flush=True)
