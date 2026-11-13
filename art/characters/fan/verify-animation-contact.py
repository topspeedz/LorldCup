"""All-frame arm/body intersections and speed-compensated stance drift."""
import json
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
rig = bpy.data.objects['FanRig']
scene = bpy.data.scenes['FanAssets']
bpy.context.window.scene = scene
selections = {}
for char in ('fan_f1','fan_f2','fan_m1','fan_m2'):
    ob = bpy.data.objects[char]
    ob.hide_set(False)
    ob.data.calc_loop_triangles()
    torso, arms = set(), set()
    for v in ob.data.vertices:
        weights = {ob.vertex_groups[g.group].name:g.weight for g in v.groups}
        if sum(w for n,w in weights.items() if n in ('hips','spine','chest','neck','head')) > .8:
            torso.add(v.index)
        if abs(v.co.x) > .295 and sum(w for n,w in weights.items() if n.startswith(('upper_arm_','forearm_','hand_'))) > .98:
            arms.add(v.index)
    triangles = [tuple(t.vertices) for t in ob.data.loop_triangles]
    selections[char] = ([t for t in triangles if all(i in torso for i in t)],
                        [t for t in triangles if all(i in arms for i in t)])

rows = []
for name in ('Emote_CheerClap','Emote_Heart'):
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    collisions = []
    for frame in range(int(action.frame_range[1])+1):
        scene.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        for char,(torso,arms) in selections.items():
            ev = bpy.data.objects[char].evaluated_get(dg)
            mesh = ev.to_mesh()
            vertices = [v.co.copy() for v in mesh.vertices]
            body_tree = BVHTree.FromPolygons(vertices,torso,all_triangles=True)
            arm_tree = BVHTree.FromPolygons(vertices,arms,all_triangles=True)
            overlaps = body_tree.overlap(arm_tree)
            if overlaps:
                collisions.append({'frame':frame,'id':char,'triangles':len(overlaps)})
            ev.to_mesh_clear()
    rows.append({'clip':name,'frames':int(action.frame_range[1])+1,'collisions':collisions})

clap_contact = []
action = bpy.data.actions['Emote_CheerClap']
rig.animation_data.action = action
rig.animation_data.action_slot = action.slots[0]
scene.frame_set(32)
for char in selections:
    ob = bpy.data.objects[char]
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = ev.to_mesh()
    sides = []
    for side in ('L','R'):
        group = ob.vertex_groups['hand_'+side].index
        sides.append([v.index for v in ob.data.vertices
                      if any(g.group == group and g.weight > .8 for g in v.groups)])
    mesh.calc_loop_triangles()
    right = set(sides[1])
    triangles = [tuple(t.vertices) for t in mesh.loop_triangles if all(i in right for i in t.vertices)]
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices],triangles,all_triangles=True)
    gap = min(tree.find_nearest(mesh.vertices[i].co)[3] for i in sides[0])
    assert gap < .006, (char,'clap misses',gap)
    clap_contact.append({'id':char,'frame':32,'gap_m':gap})
    ev.to_mesh_clear()

stance = []
for name,speed,frames in [('Walk',4,range(0,7)),('Run',8,range(0,5))]:
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    positions = []
    for sample in range(frames[-1]*8+1):
        frame = sample/8
        scene.frame_set(int(frame),subframe=frame-int(frame))
        p = rig.pose.bones['foot_L'].head.copy()
        p.y -= speed*frame/30
        positions.append(p)
    drift = max((p-positions[0]).length for p in positions)
    assert drift < .01, (name,'stance slip',drift)
    stance.append({'clip':name,'speed_mps':speed,'stance_frames':[frames[0],frames[-1]],
                   'sample_step_frames':.125,'drift_m':drift})
action = bpy.data.actions['Emote_EggThrow']
rig.animation_data.action = action
rig.animation_data.action_slot = action.slots[0]
scene.frame_set(39,subframe=.5)
before = rig.pose.bones['prop_R'].head.copy()
scene.frame_set(40,subframe=.5)
release_velocity = (rig.pose.bones['prop_R'].head-before)*30
assert release_velocity.y < -.25, ('throw must move forward at release',list(release_velocity))
result = {'ok':not any(r['collisions'] for r in rows),'contact':rows,'clap':clap_contact,'stance':stance,
          'egg_release_velocity_blender_mps':list(release_velocity)}
(OUT/'animation-contact-metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
assert result['ok'], 'Arm/body intersections'
