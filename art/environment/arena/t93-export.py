"""Use the T75 final Draco precision and retain every runtime attribute and extra."""
import bpy
import json
from pathlib import Path
ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
assert (ART / 'barclays-arena-t93-baked.blend').exists()
# A 5 cm clearance keeps the .32 m player radius off the invisible portal returns.
cy = -.005370497703552246
barrier = bpy.context.scene.objects['Collide_T93RearRing__barrier']
for v in barrier.data.vertices:
    axis = 1 if v.co.x < -53 else 0 if abs(v.co.y - cy) > 43 else None
    if axis is not None:
        offset = cy if axis == 1 else 0
        value = v.co[axis] - offset
        if abs(abs(value) - 3.45) < .0001:
            v.co[axis] = offset + (3.40 if value > 0 else -3.40)
caps = bpy.context.scene.objects['Collide_T93RearPortalCaps__concrete']
for v in caps.data.vertices:
    axis = 1 if v.co.x < -53 else 0
    offset = cy if axis == 1 else 0
    value = v.co[axis] - offset
    v.co[axis] = offset + (1 if value > 0 else -1) * (3.40 + (abs(value) - 3.51) * .5)
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93-final.blend'))
settings = dict(export_format='GLB', check_existing=False, use_active_scene=True, use_visible=True,
    use_renderable=True, export_materials='EXPORT', export_texcoords=True, export_normals=True,
    export_tangents=True, export_attributes=True, export_extras=True, export_animations=False,
    export_apply=True, export_cameras=True, export_lights=False, export_image_format='AUTO',
    export_image_quality=95, export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_draco_generic_quantization=24,
    export_draco_position_quantization=19, export_draco_normal_quantization=11,
    export_draco_texcoord_quantization=15)
properties = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
assert set(settings) <= properties
path = OUT / 'arena-quantized.glb'
assert not path.exists()
result = bpy.ops.export_scene.gltf(filepath=str(path), **settings)
assert 'FINISHED' in result
(OUT / 'compression-stages.json').write_text(json.dumps([{'stage':'quantized','bytes':path.stat().st_size,'file':str(path)}]))
print('T93_EXPORT', path.stat().st_size)
