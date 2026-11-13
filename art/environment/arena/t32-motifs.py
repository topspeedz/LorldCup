"""Original, text-free artwork for the twelve surfaces approved in U5-a."""
import bpy
import json
import numpy as np
from pathlib import Path

ART = Path(__file__).resolve().parent
scene = bpy.data.scenes['Barclays • WORLDS 2026']
size = 512
y, x = np.mgrid[:size, :size].astype(np.float32) / (size - 1)
atlas = np.zeros((size * 2, size * 2, 4), dtype=np.float32)

def capsule(x0, x1, cy, radius):
    distance = np.sqrt((x - np.clip(x, x0, x1)) ** 2 + (y - cy) ** 2)
    return np.clip((radius - distance) * size + .5, 0, 1)

def color(name):
    nodes = bpy.data.materials[name].node_tree.nodes
    node = next(n for n in nodes if n.type in ('BSDF_PRINCIPLED', 'EMISSION'))
    return np.array(node.inputs['Emission Color' if node.type == 'BSDF_PRINCIPLED' else 'Color'].default_value[:3])

# Separate staggered bars and dots; no lettering, shields, trophies, or copied insignia.
for column, palette in enumerate((color('REF_Gold'), color('REF_Cyan'))):
    panel = atlas[size:, column * size:(column + 1) * size]
    panel[..., :3] = (.004, .008, .016)
    panel[..., 3] = 1
    for row, (left, right) in enumerate(((.18, .52), (.38, .75), (.24, .61), (.46, .81))):
        cy = .26 + row * .16
        mask = np.maximum(capsule(left, right, cy, .025), capsule(left - .09, left - .09, cy, .025))
        panel[..., :3] += mask[..., None] * palette * (.55 + row * .12)
crest = atlas[:size, :size]
mask = np.zeros((size, size), dtype=np.float32)
for row, (left, right) in enumerate(((.26, .55), (.39, .67), (.30, .59), (.46, .74))):
    cy = .27 + row * .15
    mask = np.maximum(mask, capsule(left, right, cy, .032))
crest[..., :3] = (.8, .86, .94)
crest[..., 3] = mask
image = bpy.data.images.get('arena-patterns-v2') or bpy.data.images.new('arena-patterns-v2', width=size * 2, height=size * 2, alpha=True)
if tuple(image.size) != (size * 2, size * 2):
    image.scale(size * 2, size * 2)
image.pixels.foreach_set(atlas.reshape(-1))
image.filepath_raw = str(ART / 'arena-patterns-v2.png')
image.file_format = 'PNG'
image.save()
image.pack()
specs = {
    'REF_Artwork_Crest': (0, 0, 8, 8, 6),
    'REF_Artwork_G': (0, 1, 32, 18, 2),
    'REF_Artwork_B': (1, 1, 32, 18, 2),
    'REF_Artwork_DeskG': (0, 1, 32, 8, 1),
    'REF_Artwork_DeskB': (1, 1, 32, 8, 1),
}
replacements = []
for name, (u0, v0, nx, ny, expected) in specs.items():
    mat = bpy.data.materials[name]
    previous = json.loads((ART / 't32-source-inspection.json').read_text())['materials'][name]['images'][0]['name']
    visible = json.loads((ART / 't32-source-inspection.json').read_text())['materials'][name]['objects']
    objects = [scene.objects[name] for name in visible]
    assert len(objects) == expected, (name, len(objects))
    for ob in objects:
        assert len(ob.data.vertices) == (nx + 1) * (ny + 1), ob.name
        uv = ob.data.uv_layers.active
        for loop in ob.data.loops:
            index = loop.vertex_index
            uv.data[loop.index].uv = ((u0 + index % (nx + 1) / nx) / 2, (v0 + index // (nx + 1) / ny) / 2)
    nodes = mat.node_tree.nodes
    nodes.clear()
    p = nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (0, 0, 0, 1)
    p.inputs['Emission Strength'].default_value = .85
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    mat.node_tree.links.new(tex.outputs['Color'], p.inputs['Emission Color'])
    if name == 'REF_Artwork_Crest':
        mat.node_tree.links.new(tex.outputs['Alpha'], p.inputs['Alpha'])
        mat.surface_render_method = 'DITHERED'
        mat.use_backface_culling = False
    output = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(p.outputs[0], output.inputs['Surface'])
    replacements.append({'material': name, 'original_image': previous, 'new_image': image.name,
                         'file': 'art/environment/arena/arena-patterns-v2.png', 'objects': [o.name for o in objects]})
(ART / 't32-motifs.json').write_text(json.dumps({'replacements': replacements}, indent=2), encoding='utf-8')
print('T32_MOTIFS', json.dumps({'surfaces': sum(len(e['objects']) for e in replacements), 'image': image.name}), flush=True)
if Path(__file__).name == 't32-motifs.py':
    assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-v2.blend'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-v2.blend'))
