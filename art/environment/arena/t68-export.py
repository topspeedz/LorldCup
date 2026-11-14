"""Export the approved T68 copy with the existing web metadata and Draco settings."""
import hashlib
import json
import struct
from pathlib import Path

import bpy

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
SOURCE = ART / 'barclays-arena-t68-proposal.blend'
WEB = ROOT / 'web/arena-v2.glb'
BACKUP = ROOT / '_workspace/_run/2026-11-13-ux-motion-rooms/bak/T68/arena-v2.glb'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == SOURCE
assert hashlib.sha256(WEB.read_bytes()).digest() == hashlib.sha256(BACKUP.read_bytes()).digest(), 'Web asset changed after the backup'
blob = BACKUP.read_bytes()
baseline = json.loads(blob[20:20 + struct.unpack_from('<I', blob, 12)[0]])
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
metadata = []
for node in baseline['nodes']:
    info = node.get('extras', {}).get('bakedLighting')
    if info and node['name'] in scene.objects:
        ob = scene.objects[node['name']]
        if dict(ob['bakedLighting']) != info:
            metadata.append(node['name'])
            ob['bakedLighting'] = info
assert len([o for o in scene.objects if 'bakedLighting' in o]) == 383
settings = dict(filepath=str(WEB), export_format='GLB', check_existing=False,
    use_active_scene=True, use_visible=True, use_renderable=True, export_materials='EXPORT',
    export_texcoords=True, export_normals=True, export_tangents=True, export_attributes=True,
    export_extras=True, export_animations=False, export_apply=True, export_cameras=True,
    export_lights=False, export_image_format='AUTO', export_image_quality=95,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=20, export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=16, export_draco_generic_quantization=24)
properties = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
assert set(settings) <= properties, set(settings) - properties
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('T68_EXPORT_METADATA_PRESERVED', json.dumps(metadata), flush=True)
result = bpy.ops.export_scene.gltf(**settings)
assert 'FINISHED' in result
print('T68_EXPORTED', json.dumps(dict(file=str(WEB), bytes=WEB.stat().st_size,
    source=str(SOURCE), lightmaps_rebaked=False, approval='msg_c45516334468')), flush=True)
