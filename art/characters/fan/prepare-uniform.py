"""Create the logo-free neutral Uniform map and its shared UV template in Blender."""
from pathlib import Path

import bpy
import numpy as np

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
size = 512
pixels = np.ones((size, size, 4), dtype=np.float32)
pixels[:, :, :3] = (.25, .34, .40)
pixels[12:24, :, :3] = (.36, .45, .50)
pixels[:, :10, :3] = (.18, .26, .32)
pixels[:, -10:, :3] = (.18, .26, .32)
for x in range(150, 362):
    y = int(440+abs(x-256)*.55)
    pixels[y:y+7, x, :3] = (.18, .26, .32)
texture = bpy.data.images.new('uniform-neutral', width=size, height=size, alpha=False)
texture.colorspace_settings.name = 'sRGB'
texture.pixels.foreach_set(pixels.ravel())
texture.filepath_raw = str(OUT/'uniform-neutral.png')
texture.file_format = 'PNG'
texture.save()
texture.pack()
mat = bpy.data.materials['Uniform']
shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
image_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
image_node.image = texture
mat.node_tree.links.new(image_node.outputs['Color'], shader.inputs['Base Color'])
shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
shader.inputs['Roughness'].default_value = .82

pixels[:] = (0, 0, 0, 0)
mesh = bpy.data.objects['fan_f1'].data
uv = mesh.uv_layers.active.data
for poly in mesh.polygons:
    if mesh.materials[poly.material_index].name != 'Uniform':
        continue
    points = [np.array(uv[i].uv)*511 for i in poly.loop_indices]
    for start, end in zip(points, points[1:]+points[:1]):
        count = int(max(abs(end-start)))+2
        line = np.rint(np.linspace(start, end, count)).astype(int)
        pixels[line[:, 1], line[:, 0]] = (.1, .65, .9, 1)
template = bpy.data.images.new('uniform-uv', width=size, height=size, alpha=True)
template.pixels.foreach_set(pixels.ravel())
template.filepath_raw = str(OUT/'uniform-uv.png')
template.file_format = 'PNG'
template.save()
print('Uniform: packed logo-free 512x512 PNG; shared UV template saved')
