"""Export with T93's exact flags, without rerunning its geometry edits."""
import ast
import json
from pathlib import Path
import bpy

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93b'
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t93b.blend'
assert not bpy.data.is_dirty
assert (OUT / 'backup/arena-v2.glb').exists()
for node in ast.parse((ART / 't93-export.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'settings' for t in node.targets):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'T93 export settings', 'exec'))
properties = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
assert set(settings) <= properties
path = OUT / 'arena-quantized.glb'
assert not path.exists()
assert 'FINISHED' in bpy.ops.export_scene.gltf(filepath=str(path), **settings)
(OUT / 'compression-stages.json').write_text(json.dumps([{
    'stage': 'quantized', 'bytes': path.stat().st_size, 'file': str(path), 'settings': settings}]), encoding='utf-8')
print('T93b_EXPORT', path.stat().st_size, flush=True)
