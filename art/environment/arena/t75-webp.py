"""Replace embedded PNGs by lossless WebP, retaining exact decoded pixels and all GLB data."""
import io
import json
import struct
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T75'
source = (OUT / 'arena-quantized.glb').read_bytes()
assert source[:4] == b'glTF' and struct.unpack_from('<I', source, 4)[0] == 2
length = struct.unpack_from('<I', source, 12)[0]
g = json.loads(source[20:20 + length])
bin_start = 20 + length + 8
binary = source[bin_start:]
replacements = {}; images = []
cached = {}
final_path = OUT / 'arena-final.glb'
if final_path.exists():
    previous = final_path.read_bytes()
    size = struct.unpack_from('<I', previous, 12)[0]
    old = json.loads(previous[20:20 + size]); old_bin = previous[28 + size:]
    for image in old['images']:
        view = old['bufferViews'][image['bufferView']]
        cached[image['bufferView']] = old_bin[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
for index, image in enumerate(g['images']):
    if image.get('mimeType') != 'image/png':
        continue
    view = g['bufferViews'][image['bufferView']]
    offset = view.get('byteOffset', 0)
    png = binary[offset:offset + view['byteLength']]
    pixels = Image.open(io.BytesIO(png)).convert('RGBA')
    webp = cached.get(image['bufferView'])
    if webp is None or not np.array_equal(np.array(pixels), np.array(Image.open(io.BytesIO(webp)).convert('RGBA'))):
        encoded = io.BytesIO()
        pixels.save(encoded, format='WEBP', lossless=True, quality=100, method=6, exact=True)
        webp = encoded.getvalue()
    assert np.array_equal(np.array(pixels), np.array(Image.open(io.BytesIO(webp)).convert('RGBA'))), image['name']
    replacements[image['bufferView']] = webp
    image['mimeType'] = 'image/webp'
    images.append(dict(name=image.get('name'), image=index, pngBytes=len(png), webpBytes=len(webp), pixelsExact=True))
for texture in g['textures']:
    if texture.get('source') in {im['image'] for im in images}:
        texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
# The crest base RGB is multiplied by zero; share its identical alpha with the emissive image.
crest = next(m for m in g['materials'] if m['name'].startswith('REF_Artwork_Crest'))
base = crest['pbrMetallicRoughness']
assert base['baseColorFactor'][:3] == [0, 0, 0]
base_texture = g['textures'][base['baseColorTexture']['index']]['extensions']['EXT_texture_webp']
emissive_texture = g['textures'][crest['emissiveTexture']['index']]['extensions']['EXT_texture_webp']
mask_index, color_index = base_texture['source'], emissive_texture['source']
mask = Image.open(io.BytesIO(replacements[g['images'][mask_index]['bufferView']])).convert('RGBA')
color = Image.open(io.BytesIO(replacements[g['images'][color_index]['bufferView']])).convert('RGBA')
assert np.array_equal(np.array(mask)[:, :, 3], np.array(color)[:, :, 3])
assert sum(t['extensions']['EXT_texture_webp']['source'] == mask_index for t in g['textures']) == 1
base_texture['source'] = color_index
g['images'].pop(mask_index)
for texture in g['textures']:
    ext = texture['extensions']['EXT_texture_webp']
    if ext['source'] > mask_index:
        ext['source'] -= 1
# shortcut: retain the now-unused mask buffer view to avoid renumbering unrelated Draco views.
for key in ('extensionsUsed', 'extensionsRequired'):
    if 'EXT_texture_webp' not in g.setdefault(key, []):
        g[key].append('EXT_texture_webp')
chunks = []; offset = 0
for index, view in enumerate(g['bufferViews']):
    old_offset = view.get('byteOffset', 0)
    payload = replacements.get(index, binary[old_offset:old_offset + view['byteLength']])
    view['byteOffset'] = offset; view['byteLength'] = len(payload)
    padded = payload + b'\0' * (-len(payload) % 4)
    chunks.append(padded); offset += len(padded)
g['buffers'][0]['byteLength'] = offset
raw_json = json.dumps(g, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
raw_json += b' ' * (-len(raw_json) % 4)
raw_bin = b''.join(chunks)
result = struct.pack('<III', 0x46546c67, 2, 28 + len(raw_json) + len(raw_bin))
result += struct.pack('<II', len(raw_json), 0x4e4f534a) + raw_json
result += struct.pack('<II', len(raw_bin), 0x004e4942) + raw_bin
assert len(result) == struct.unpack_from('<I', result, 8)[0]
(OUT / 'arena-final.glb').write_bytes(result)
(OUT / 'webp-images.json').write_text(json.dumps(images, indent=2), encoding='utf-8')
stages = json.loads((OUT / 'compression-stages.json').read_text())
stages = [stage for stage in stages if stage['stage'] != 'lossless-webp']
stages.append(dict(stage='lossless-webp', bytes=len(result), file=str(OUT / 'arena-final.glb'), images=len(g['images'])))
(OUT / 'compression-stages.json').write_text(json.dumps(stages, indent=2), encoding='utf-8')
print('T75_WEBP', json.dumps(dict(bytes=len(result), images=len(g['images']), decoded_pixels_exact=True, shared_crest_alpha=True,
    image_bytes_before=sum(i['pngBytes'] for i in images), image_bytes_after=sum(i['webpBytes'] for i in images))))
assert len(result) < 100_000_000, 'Vercel limit exceeded: ask the coordinator before publishing the asset'
