"""Check exported tracks, rest transforms, cues, and Blender round-trip poses."""
import json
import math
import re
import struct
from pathlib import Path

import bpy

ROOT = Path('D:/Projects/lorldcup-metaverse')
OUT = ROOT/'art/characters/fan'
payload = (ROOT/'web/assets/characters/fan-anim.glb').read_bytes()
size = struct.unpack_from('<I',payload,12)[0]
g = json.loads(payload[20:20+size])
binary = 28+size
body = (ROOT/'web/assets/characters/fan.glb').read_bytes()
model = json.loads(body[20:20+struct.unpack_from('<I',body,12)[0]])
assert g['extensionsUsed'] == ['KHR_draco_mesh_compression']
assert g['extensionsRequired'] == ['KHR_draco_mesh_compression']
assert len(g['skins']) == 1 and len(g['skins'][0]['joints']) == 23
assert len(g['meshes']) == len(g['materials']) == 1 and not g.get('images')
assert g['meshes'][0]['name'] == 'Prop_Egg'
assert 'skin' not in next(n for n in g['nodes'] if n['name'] == 'Prop_Egg')
assert max(abs(a-b) for a,b in zip(next(n for n in g['nodes'] if n['name'] == 'Prop_Egg')['translation'],[0,0,-.055])) < 1e-6
assert not any(re.search(r'[\s.:\[\]/]',n['name']) for n in g['nodes'])
joints = {g['nodes'][i]['name'] for i in g['skins'][0]['joints']}
assert joints == {model['nodes'][i]['name'] for i in model['skins'][0]['joints']}
rest_error = 0
for n in g['nodes']:
    if n['name'] not in joints|{'FanRig'}:
        continue
    original = next(b for b in model['nodes'] if b['name'] == n['name'])
    for key,default in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]:
        rest_error = max(rest_error,*(abs(a-b) for a,b in zip(n.get(key,default),original.get(key,default))))
assert rest_error < 1e-6, ('rest transforms',rest_error)


def read(index):
    a = g['accessors'][index]
    view = g['bufferViews'][a['bufferView']]
    assert a['componentType'] == 5126
    count = {'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    start = binary+view.get('byteOffset',0)+a.get('byteOffset',0)
    stride = view.get('byteStride',count*4)
    return [struct.unpack_from('<'+'f'*count,payload,start+i*stride) for i in range(a['count'])]


expected = {'Idle':3,'Walk':.4,'Run':16/30,'Jump':.72,'Sit':.8,
            'Emote_CheerClap':3,'Emote_Heart':3.6,'Emote_Angry':2.6,'Emote_EggThrow':3}
assert {a['name'] for a in g['animations']} == set(expected)
endpoints, rows = {}, []
for a in g['animations']:
    length = 0
    ends = {}
    for c in a['channels']:
        name = g['nodes'][c['target']['node']]['name']
        path = c['target']['path']
        assert name in joints-{'root'}
        assert path == 'rotation' or (name == 'hips' and path == 'translation')
        sampler = a['samplers'][c['sampler']]
        times, values = read(sampler['input']), read(sampler['output'])
        assert len(times) == len(values) and times[0][0] == 0
        assert all(math.isfinite(v) for row in values for v in row)
        assert all(x[0] < y[0] for x,y in zip(times,times[1:]))
        length = max(length,times[-1][0])
        ends[(name,path)] = (values[0],values[-1])
        if a['name'] in ('Idle','Walk','Run'):
            assert max(abs(x-y) for x,y in zip(values[0],values[-1])) < 1e-6
        if a['name'] == 'Jump' and path == 'translation':
            assert max(abs(x-y) for row in values for x,y in zip(row,values[0])) < 1e-6
    assert abs(length-expected[a['name']]) < 1e-6
    endpoints[a['name']] = ends
    rows.append({'clip':a['name'],'seconds':length,'channels':len(a['channels'])})
for name in ('Jump','Sit','Emote_CheerClap','Emote_Heart','Emote_Angry','Emote_EggThrow'):
    for target,values in endpoints[name].items():
        neutral = endpoints['Idle'][target][0]
        assert max(abs(x-y) for x,y in zip(values[0],neutral)) < 1e-5, (name,'start',target)
        if name != 'Sit':
            assert max(abs(x-y) for x,y in zip(values[1],neutral)) < 1e-5, (name,'end',target)

original_scene = bpy.context.window.scene
rig = bpy.data.objects['FanRig']
before = {kind:set(getattr(bpy.data,kind)) for kind in ('objects','meshes','armatures','materials','actions')}
temp = bpy.data.scenes.new('T35-Roundtrip')
temp.render.fps = 30
pose_error = 0
try:
    bpy.context.window.scene = temp
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/characters/fan-anim.glb'),
                             merge_vertices=False,import_pack_images=True,bone_heuristic='BLENDER')
    imported = set(bpy.data.objects)-before['objects']
    imported_rig = next(o for o in imported if o.type == 'ARMATURE')
    assert set(imported_rig.data.bones.keys()) == joints
    imported_actions = set(bpy.data.actions)-before['actions']
    assert len(imported_actions) == 9
    for name in expected:
        source = bpy.data.actions[name]
        target = next(a for a in imported_actions if a.name == name or a.name.startswith(name+'.'))
        rig.animation_data.action = source
        rig.animation_data.action_slot = source.slots[0]
        imported_rig.animation_data.action = target
        imported_rig.animation_data.action_slot = target.slots[0]
        for track in imported_rig.animation_data.nla_tracks:
            track.mute = True
        for frame in json.loads(source['sample_frames']):
            bpy.context.window.scene = original_scene
            original_scene.frame_set(int(frame),subframe=frame-int(frame))
            source_mats = {p.name:p.matrix.copy() for p in rig.pose.bones}
            bpy.context.window.scene = temp
            temp.frame_set(int(frame),subframe=frame-int(frame))
            for p in imported_rig.pose.bones:
                pose_error = max(pose_error,*(abs(p.matrix[i][j]-source_mats[p.name][i][j])
                                              for i in range(4) for j in range(4)))
    assert pose_error < .0001, ('round-trip pose matrices',pose_error)
finally:
    bpy.context.window.scene = original_scene
    print(json.dumps({'remove_temporary_objects':[o.name for o in set(bpy.data.objects)-before['objects']]}))
    for kind in before:
        data = getattr(bpy.data,kind)
        for item in set(data)-before[kind]:
            data.remove(item,do_unlink=True)
    bpy.data.scenes.remove(temp)
    rig.animation_data.action = bpy.data.actions['Idle']
    rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
    original_scene.frame_set(0)
result = {'ok':True,'rest_transform_error':rest_error,'roundtrip_pose_error':pose_error,
          'clips':rows,'egg_release_frame':40,'egg_scream_frame':34}
(OUT/'animation-export-metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
