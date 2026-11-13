"""Check GLB structure and Draco round-trip geometry, weights, colors, and UVs."""
import json
import re
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion
from mathutils.kdtree import KDTree

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
IDS = ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2')
payload = (ROOT/'web/assets/characters/fan.glb').read_bytes()
g = json.loads(payload[20:20+struct.unpack_from('<I', payload, 12)[0]])
assert g['extensionsUsed'] == ['KHR_draco_mesh_compression']
assert g['extensionsRequired'] == ['KHR_draco_mesh_compression']
assert len(g['skins']) == 1 and len(g['skins'][0]['joints']) == 23
assert not g.get('animations')
assert {m['name'] for m in g['meshes']} == set(IDS)
assert {m['name'] for m in g['materials']} == {'Uniform', 'FanSurface'}
assert all(not re.search(r'[\s.:\[\]/]', n['name']) for n in g['nodes'])
assert len(g['images']) == 1 and 'bufferView' in g['images'][0]
parents = {child:i for i,n in enumerate(g['nodes']) for child in n.get('children',[])}


def world(index):
    n = g['nodes'][index]
    if 'matrix' in n:
        m = Matrix([n['matrix'][i:i+4] for i in range(0,16,4)]).transposed()
    else:
        x,y,z,w = n.get('rotation', [0,0,0,1])
        m = Matrix.Translation(n.get('translation',[0,0,0])) @ Quaternion((w,x,y,z)).to_matrix().to_4x4() @ Matrix.Diagonal((*n.get('scale',[1,1,1]),1))
    return world(parents[index]) @ m if index in parents else m


binary = 20+struct.unpack_from('<I', payload, 12)[0]+8
accessor = g['accessors'][g['skins'][0]['inverseBindMatrices']]
view = g['bufferViews'][accessor['bufferView']]
offset = binary+view.get('byteOffset',0)+accessor.get('byteOffset',0)
bind_error = 0
for j, index in enumerate(g['skins'][0]['joints']):
    values = struct.unpack_from('<16f',payload,offset+j*64)
    inverse_bind = Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
    bound = world(index) @ inverse_bind
    bind_error = max(bind_error,*(abs(bound[r][c]-(1 if r==c else 0)) for r in range(4) for c in range(4)))
assert bind_error < .00001, ('inverse bind matrices',bind_error)
for mesh in g['meshes']:
    assert len(mesh['primitives']) == 2
    for p in mesh['primitives']:
        assert 'KHR_draco_mesh_compression' in p['extensions']
        assert {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'} <= set(p['attributes'])
        assert 'JOINTS_1' not in p['attributes'] and 'WEIGHTS_1' not in p['attributes']
old_scene = bpy.context.window.scene
before = {kind: set(getattr(bpy.data, kind)) for kind in ['objects','meshes','armatures','materials','images']}
temp = bpy.data.scenes.new('T30-Roundtrip')
bpy.context.window.scene = temp
try:
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/characters/fan.glb'),
                              merge_vertices=False, import_pack_images=True, bone_heuristic='BLENDER')
    imported = set(bpy.data.objects)-before['objects']
    rigs = [o for o in imported if o.type == 'ARMATURE']
    assert len(rigs) == 1 and set(rigs[0].data.bones.keys()) == set(bpy.data.objects['FanRig'].data.bones.keys())
    rows = []
    for name in IDS:
        original = bpy.data.objects[name]
        target = next(o for o in imported if o.type == 'MESH' and re.sub(r'\.\d+$','',o.name) == name)
        tree = KDTree(len(original.data.vertices))
        for v in original.data.vertices:
            tree.insert(original.matrix_world @ v.co, v.index)
        tree.balance()
        max_distance = max_weight_error = 0
        for v in target.data.vertices:
            _, index, distance = tree.find(target.matrix_world @ v.co)
            max_distance = max(max_distance, distance)
            a = {original.vertex_groups[w.group].name:w.weight for w in original.data.vertices[index].groups}
            b = {target.vertex_groups[w.group].name:w.weight for w in v.groups}
            max_weight_error = max(max_weight_error, *(abs(a.get(k,0)-b.get(k,0)) for k in a.keys()|b.keys()))
        assert max_distance < .0001 and max_weight_error < .0001, (name,max_distance,max_weight_error)
        assert len(target.data.uv_layers) == 1
        color = target.data.color_attributes.active_color
        source_uv = original.data.uv_layers.active.data
        uv_choices = {}
        for p in original.data.polygons:
            for li in p.loop_indices:
                uv_choices.setdefault((original.data.loops[li].vertex_index,p.material_index),[]).append(tuple(source_uv[li].uv))
        max_uv_error = 0
        uniform_colors = []
        for p in target.data.polygons:
            material_name = re.sub(r'\.\d+$','',target.data.materials[p.material_index].name)
            source_slot = original.data.materials.find(material_name)
            for li in p.loop_indices:
                vertex = target.data.vertices[target.data.loops[li].vertex_index]
                _, index, _ = tree.find(target.matrix_world @ vertex.co)
                u,v = target.data.uv_layers.active.data[li].uv
                max_uv_error = max(max_uv_error,min(max(abs(u-a),abs(v-b)) for a,b in uv_choices[index,source_slot]))
            if material_name == 'Uniform':
                for i in p.loop_indices:
                    c = color.data[i if color.domain == 'CORNER' else target.data.loops[i].vertex_index].color
                    uniform_colors.append(tuple(c[:3]))
        assert uniform_colors and all(min(c) > .999 for c in uniform_colors), 'Uniform must not multiply the team map by vertex tint'
        assert max_uv_error < .0001, (name,'UV round trip',max_uv_error)
        rows.append(dict(id=name, max_position_error_m=max_distance, max_weight_error=max_weight_error,
                         uniform_vertex_color='white', max_uv_error=max_uv_error, uv_layers=len(target.data.uv_layers)))
    result = dict(ok=True, skins=1, joints=23, materials=2, textures=1, max_bind_matrix_error=bind_error, extensions=g['extensionsUsed'], characters=rows)
    (OUT/'export-metrics.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
finally:
    bpy.context.window.scene = old_scene
    print('Remove temporary GLB import:', [o.name for o in set(bpy.data.objects)-before['objects']])
    for ob in set(bpy.data.objects)-before['objects']:
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(temp)
    for kind in ['meshes','armatures','materials','images']:
        collection = getattr(bpy.data, kind)
        for block in set(collection)-before[kind]:
            if block.users == 0:
                collection.remove(block)
