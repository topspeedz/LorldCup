"""Render T28 review evidence from the working meshes; requires the T28 GPU lock."""
import bpy
import json
from pathlib import Path

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
assert Path(bpy.data.filepath).resolve() == (OUT/'fan.blend').resolve()
assert json.loads((OUT.parents[2]/'_workspace/gpu-lock.json').read_text())['owner'] == 'T28'


def render_reviews():
    sheet = bpy.data.scenes['FanSheet']
    original_scene = bpy.context.window.scene
    original_percentage = sheet.render.resolution_percentage
    original_path = sheet.render.filepath
    originals = {o: o.data for o in sheet.objects if o.name.startswith('sheet-fan_')}
    temporary_meshes = []
    uniform = bpy.data.materials['Uniform']
    p = next(n for n in uniform.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    uniform_color = tuple(p.inputs['Base Color'].default_value)
    rendered = []
    black = None
    try:
        bpy.context.window.scene = sheet
        for filename, mode, percent in [('fan-sheet.png', 'color', 100),
                                         ('fan-small.png', 'color', 30),
                                         ('fan-grayscale.png', 'gray', 50),
                                         ('fan-silhouette.png', 'silhouette', 50)]:
            sheet.render.resolution_percentage = percent
            if mode == 'gray':
                copies = {}
                for ob, me in originals.items():
                    if me.name not in copies:
                        copy = me.copy()
                        temporary_meshes.append(copy)
                        for value in copy.color_attributes['FanColor'].data:
                            r, g, b, a = value.color
                            luma = .2126*r + .7152*g + .0722*b
                            value.color = (luma, luma, luma, a)
                        copies[me.name] = copy
                    ob.data = copies[me.name]
                luma = sum(a*b for a, b in zip(uniform_color, (.2126, .7152, .0722)))
                p.inputs['Base Color'].default_value = (luma, luma, luma, 1)
            if mode == 'silhouette':
                black = bpy.data.materials.new('review-silhouette')
                black.use_nodes = True
                bsdf = next(n for n in black.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                bsdf.inputs['Base Color'].default_value = (.001, .001, .001, 1)
                bsdf.inputs['Roughness'].default_value = 1
                copies = {}
                for ob, me in originals.items():
                    if me.name not in copies:
                        copy = me.copy()
                        temporary_meshes.append(copy)
                        copy.materials.clear()
                        copy.materials.append(black)
                        for polygon in copy.polygons:
                            polygon.material_index = 0
                        copies[me.name] = copy
                    ob.data = copies[me.name]
            sheet.render.filepath = str(OUT/filename)
            bpy.ops.render.render(write_still=True, scene=sheet.name)
            rendered.append(filename)
            print('RENDERED', filename)
        for ob, me in originals.items():
            ob.data = me
        p.inputs['Base Color'].default_value = uniform_color
        comparison = bpy.data.scenes['FanStyleComparison']
        bpy.context.window.scene = comparison
        comparison.render.filepath = str(OUT/'fan-style-comparison.png')
        bpy.ops.render.render(write_still=True, scene=comparison.name)
        rendered.append('fan-style-comparison.png')
        (OUT/'render-status.json').write_text(json.dumps({'ok':True, 'rendered':rendered}), encoding='utf-8')
    except Exception as error:
        (OUT/'render-status.json').write_text(json.dumps({'ok':False, 'rendered':rendered, 'error':str(error)}), encoding='utf-8')
        raise
    finally:
        for ob, me in originals.items():
            ob.data = me
        p.inputs['Base Color'].default_value = uniform_color
        sheet.render.resolution_percentage, sheet.render.filepath = original_percentage, original_path
        bpy.context.window.scene = original_scene
        print('Remove temporary render meshes:', [me.name for me in temporary_meshes])
        for me in temporary_meshes:
            bpy.data.meshes.remove(me)
        if black:
            bpy.data.materials.remove(black)
    return None


(OUT/'render-status.json').write_text(json.dumps({'ok':None, 'status':'rendering'}), encoding='utf-8')
bpy.app.timers.register(render_reviews, first_interval=.5)
print('Review rendering scheduled')
