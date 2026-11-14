"""Keep the invisible collision material independent of the silver rail's UV maps."""
import json
import shutil
import struct
from pathlib import Path
import bpy

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
BAK = ROOT / '_workspace/_run/2026-11-13-ux-motion-rooms/bak/T93'
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t93-ready.blend'
backup = BAK / 'barclays-arena-t93-ready-before-material.blend'
assert not backup.exists()
shutil.copy2(bpy.data.filepath, backup)
mat = bpy.data.materials['T93_InvisibleCollision']
nodes, links = mat.node_tree.nodes, mat.node_tree.links
p = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
for node in list(nodes):
    if node not in (p, output):
        nodes.remove(node)
p.inputs['Base Color'].default_value = (0, 0, 0, 1)
p.inputs['Metallic'].default_value = 0
p.inputs['Roughness'].default_value = 1
p.inputs['Alpha'].default_value = 0
links.new(p.outputs[0], output.inputs['Surface'])
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93-ready.blend'))
source = (OUT / 'arena-final.glb').read_bytes()
assert source == (ROOT / 'web/arena-v2.glb').read_bytes()
backup_glb = BAK / 'web/arena-before-collision-material.glb'
assert not backup_glb.exists()
backup_glb.write_bytes(source)
length = struct.unpack_from('<I', source, 12)[0]
g = json.loads(source[20:20 + length])
material = next(m for m in g['materials'] if m['name'] == 'T93_InvisibleCollision')
material.pop('normalTexture', None)
material['pbrMetallicRoughness'] = {'baseColorFactor': [0, 0, 0, 0], 'metallicFactor': 0, 'roughnessFactor': 1}
payload = json.dumps(g, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
payload += b' ' * (-len(payload) % 4)
binary_chunk = source[20 + length:]
result = struct.pack('<III', 0x46546c67, 2, 20 + len(payload) + len(binary_chunk))
result += struct.pack('<II', len(payload), 0x4e4f534a) + payload + binary_chunk
assert result[20 + len(payload):] == binary_chunk
for path in (OUT / 'arena-final.glb', ROOT / 'web/arena-v2.glb'):
    path.write_bytes(result)
print('T93_FINAL_MATERIAL', len(result), 'bytes; all binary geometry and images unchanged')
