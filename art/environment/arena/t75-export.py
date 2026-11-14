"""Measure geometry and one-step Draco changes in staging; leave the public GLB untouched."""
import json
from pathlib import Path
import bpy

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t75-baked.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']; bpy.context.window.scene = scene
settings = dict(export_format='GLB', check_existing=False, use_active_scene=True, use_visible=True,
    use_renderable=True, export_materials='EXPORT', export_texcoords=True, export_normals=True,
    export_tangents=True, export_attributes=True, export_extras=True, export_animations=False,
    export_apply=True, export_cameras=True, export_lights=False, export_image_format='AUTO',
    export_image_quality=95, export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_draco_generic_quantization=24)
properties = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
assert set(settings) <= properties
report = []
for label, bits in [('geometry', (20,12,16)), ('quantized', (19,11,15))]:
    path = OUT / f'arena-{label}.glb'
    result = bpy.ops.export_scene.gltf(filepath=str(path), **settings,
        export_draco_position_quantization=bits[0], export_draco_normal_quantization=bits[1],
        export_draco_texcoord_quantization=bits[2])
    assert 'FINISHED' in result
    report.append(dict(stage=label, bytes=path.stat().st_size, quantization=list(bits), file=str(path)))
    print('T75_EXPORT_STAGE', json.dumps(report[-1]), flush=True)
(OUT / 'compression-stages.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
