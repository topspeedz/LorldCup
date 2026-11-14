"""Keep unchanged meshes' original Draco bytes, including recalculated tangents."""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T93b'


def read(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), data[28 + size:]


def payload(g, binary, index):
    view = g['bufferViews'][index]
    offset = view.get('byteOffset', 0)
    return binary[offset:offset + view['byteLength']]


old, old_bin = read(OUT / 'backup/arena-v2.glb')
g, binary = read(OUT / 'arena-final.glb')
old_nodes = {n['name']: n for n in old['nodes']}
replacements, retained = {}, []
for node in g['nodes']:
    if 'mesh' not in node or node['name'] == 'Collide_T93RearRing__barrier':
        continue
    previous = old['meshes'][old_nodes[node['name']]['mesh']]['primitives']
    current = g['meshes'][node['mesh']]['primitives']
    assert len(previous) == len(current)
    for a, b in zip(previous, current):
        ae, be = a['extensions']['KHR_draco_mesh_compression'], b['extensions']['KHR_draco_mesh_compression']
        assert ae['attributes'] == be['attributes']
        for key in a['attributes']:
            assert old['accessors'][a['attributes'][key]] == g['accessors'][b['attributes'][key]]
        assert old['accessors'][a['indices']] == g['accessors'][b['indices']]
        original = payload(old, old_bin, ae['bufferView'])
        if original != payload(g, binary, be['bufferView']):
            replacements[be['bufferView']] = original
            retained.append(node['name'])

chunks, offset = [], 0
for index, view in enumerate(g['bufferViews']):
    data = replacements.get(index, payload(g, binary, index))
    view['byteOffset'], view['byteLength'] = offset, len(data)
    padded = data + b'\0' * (-len(data) % 4)
    chunks.append(padded)
    offset += len(padded)
g['buffers'][0]['byteLength'] = offset
text = json.dumps(g, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
text += b' ' * (-len(text) % 4)
data = b''.join(chunks)
result = struct.pack('<III', 0x46546c67, 2, 28 + len(text) + len(data))
result += struct.pack('<II', len(text), 0x4e4f534a) + text
result += struct.pack('<II', len(data), 0x004e4942) + data
(OUT / 'arena-final.glb').write_bytes(result)
(OUT / 'preserved-draco.json').write_text(json.dumps({'meshes': retained, 'bufferViews': len(replacements),
    'bytes': len(result)}, indent=2), encoding='utf-8')
print('T93b_PRESERVED', json.dumps(retained), len(result))
