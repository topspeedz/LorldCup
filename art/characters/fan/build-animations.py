"""T35: sampled joint rotations on the unchanged T30 skeleton; no live constraints."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
assert Path(bpy.data.filepath).resolve() == (OUT/'fan-anim.blend').resolve()
scene = bpy.data.scenes['FanAssets']
bpy.context.window.scene = scene
rig = bpy.data.objects['FanRig']
scene.render.fps = 30
rig.animation_data_create()
CLIPS = {'Idle': (90, True), 'Walk': (12, True), 'Run': (16, True),
         'Jump': (21.6, False), 'Sit': (24, False), 'Emote_CheerClap': (90, False),
         'Emote_Heart': (108, False), 'Emote_Angry': (78, False), 'Emote_EggThrow': (90, False)}
print(json.dumps({'replace_actions': [a.name for a in bpy.data.actions],
                  'replace_prop': [o.name for o in scene.objects if o.name == 'Prop_Egg']}))
rig.animation_data.action = None
for action in list(bpy.data.actions):
    assert action.name in CLIPS
    bpy.data.actions.remove(action)
if 'Prop_Egg' in bpy.data.objects:
    ob = bpy.data.objects['Prop_Egg']
    mesh = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(mesh)


def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def keys(frame, points):
    for (a, va), (b, vb) in zip(points, points[1:]):
        if frame <= b:
            return Vector(va).lerp(Vector(vb), smooth((frame-a)/(b-a)))
    return Vector(points[-1][1])


def rotate(name, axis, degrees):
    p = rig.pose.bones[name]
    local = p.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    p.rotation_quaternion = p.rotation_quaternion @ Quaternion(local.normalized(), math.radians(degrees))


def orient(name, quaternion):
    p = rig.pose.bones[name]
    parent_delta = p.parent.matrix.to_quaternion() @ p.parent.bone.matrix_local.to_quaternion().inverted()
    p.rotation_quaternion = p.bone.matrix_local.to_quaternion().inverted() @ parent_delta.inverted() @ quaternion
    bpy.context.view_layer.update()


def aim(name, direction):
    bone = rig.data.bones[name]
    q = (bone.tail_local-bone.head_local).normalized().rotation_difference(Vector(direction).normalized())
    orient(name, q @ bone.matrix_local.to_quaternion())


def limb(upper, lower, target, pole):
    a, b = rig.pose.bones[upper], rig.pose.bones[lower]
    start = a.head.copy()
    delta = Vector(target)-start
    distance = delta.length
    l1, l2 = a.bone.length, b.bone.length
    assert abs(l1-l2)+1e-5 < distance < l1+l2+1e-5, (upper, list(target), distance, l1+l2)
    direction = delta.normalized()
    pole = Vector(pole)-start
    bend = (pole-direction*pole.dot(direction)).normalized()
    along = (l1*l1-l2*l2+distance*distance)/(2*distance)
    joint = start+direction*along+bend*math.sqrt(max(0, l1*l1-along*along))
    aim(upper, joint-start)
    aim(lower, Vector(target)-rig.pose.bones[lower].head)


def reset():
    for p in rig.pose.bones:
        p.rotation_mode = 'QUATERNION'
        p.matrix_basis = Matrix.Identity(4)


def pose(name, f, end):
    reset()
    phase = f/end
    hips = Vector((0, 0, 0))
    wrists = {'L': Vector((.30, -.085, .90)), 'R': Vector((-.30, -.085, .90))}
    hands = {'L': Vector((.12, -.05, -1)), 'R': Vector((-.12, -.05, -1))}
    feet = {'L': Vector((.105, 0, .13)), 'R': Vector((-.105, 0, .13))}
    chest, head, twist = 0, 0, 0
    if name == 'Idle':
        breath = math.sin(math.tau*phase)
        chest, head = .7*breath, -.4*breath
        for side in wrists:
            wrists[side].y += .008*breath
    elif name in ('Walk', 'Run'):
        run = name == 'Run'
        speed, duty = (8, .25) if run else (4, .5)
        duration = end/30
        half_stride = speed*duration*duty/2
        hips.z = (.70+.08*math.sin(2*math.tau*phase)**2 if run else .80+.055*math.sin(math.tau*phase)**2)-.93
        chest = 11 if run else 4
        twist = 4*math.sin(math.tau*phase)
        for side, offset in [('L', 0), ('R', .5)]:
            p = (phase+offset) % 1
            if p <= duty:
                feet[side].y = -half_stride+speed*duration*p
            else:
                u = (p-duty)/(1-duty)
                feet[side].y = half_stride*(1-2*smooth(u))
                feet[side].z += (.40 if run else .14)*math.sin(math.pi*u)**2
            s = 1 if side == 'L' else -1
            wrists[side] = Vector((s*.30, (.24 if run else .20)*math.cos(math.tau*p),
                                   1.06 if run else .92))
            hands[side] = Vector((s*.12, -.8, .4 if run else -.65))
    elif name == 'Jump':
        tuck = math.sin(math.pi*phase)**2
        chest, head = 5*tuck, -7*tuck
        for side in feet:
            feet[side] += Vector((0, .18*tuck, .22*tuck))
            wrists[side].y -= .18*tuck
            wrists[side].z += .35*tuck
            hands[side] = hands[side].lerp(Vector((0,-.7,.3)),tuck)
    elif name == 'Sit':
        t = smooth(phase)
        hips = Vector((0, .40*t, -.37*t))
        chest = 4*math.sin(math.pi*phase)
        for side, s in [('L', 1), ('R', -1)]:
            wrists[side] = wrists[side].lerp(Vector((s*.25, .16, .65)), t)
            hands[side] = hands[side].lerp(Vector((0, -1, -.15)), t)
    elif name == 'Emote_CheerClap':
        hips.z = keys(f, [(0,(0,0,0)),(8,(0,0,-.045)),(20,(0,0,0)),(90,(0,0,0))]).z
        chest = -3*math.sin(math.pi*phase)**2
        head = -5*math.sin(math.pi*phase)**2
        for side, s in [('L', 1), ('R', -1)]:
            rest = tuple(wrists[side])
            points = [(0,rest),(8,(s*.32,-.10,.87)),(20,(s*.32,-.14,1.78)),
                      (27,(s*.23,-.39,1.47))]
            points += [(frame,(s*(.044 if frame%12 == 8 else .23),-.42,1.47))
                       for frame in (32,38,44,50,56,62,68)]
            points += [(77,(s*.29,-.25,1.15)),(90,rest)]
            wrists[side] = keys(f, points)
            t = smooth(min(f/20,(90-f)/15))
            hands[side] = hands[side].lerp(Vector((0,0,1)),t)
    elif name == 'Emote_Heart':
        for side, s in [('L', 1), ('R', -1)]:
            rest = tuple(wrists[side])
            wrists[side] = keys(f, [(0,rest),(16,(s*.48,-.16,1.37)),
                                    (34,(s*.11,-.19,1.79)),(76,(s*.11,-.19,1.79)),
                                    (91,(s*.45,-.18,1.35)),(108,rest)])
            t = smooth(min(f/30,(108-f)/25))
            hands[side] = hands[side].lerp(Vector((-s,0,-.55)),t)
        head = 3*math.sin(math.pi*phase)**2
    elif name == 'Emote_Angry':
        twist = keys(f, [(0,(0,0,0)),(18,(0,0,-10)),(29,(0,0,8)),
                         (41,(0,0,-8)),(52,(0,0,8)),(78,(0,0,0))]).z
        chest = 7*math.sin(math.pi*phase)**2
        head = 5*math.sin(math.pi*phase)**2
        wrists['R'] = keys(f, [(0,tuple(wrists['R'])),(15,(-.32,-.24,1.48)),
                              (26,(-.60,-.22,1.44)),(37,(-.28,-.37,1.50)),
                              (49,(-.61,-.20,1.38)),(60,(-.32,-.25,1.46)),
                              (78,tuple(wrists['R']))])
        t = smooth(min(f/15,(78-f)/18))
        hands['R'] = hands['R'].lerp(Vector((-.3,0,1)),t)
        wrists['L'].y -= .08*math.sin(math.pi*phase)**2
    elif name == 'Emote_EggThrow':
        twist = keys(f, [(0,(0,0,0)),(30,(0,0,-14)),(40,(0,0,14)),
                         (48,(0,0,10)),(90,(0,0,0))]).z
        chest = keys(f, [(0,(0,0,0)),(28,(-5,0,0)),(45,(9,0,0)),(90,(0,0,0))]).x
        wrists['R'] = keys(f, [(0,tuple(wrists['R'])),(17,(-.36,.10,1.42)),
                              (30,(-.36,.15,1.66)),(35,(-.36,.10,1.68)),
                              (40,(-.25,-.40,1.52)),(46,(-.23,-.45,1.22)),
                              (64,(-.31,-.23,1.02)),(90,tuple(wrists['R']))])
        if 35 < f < 46:
            windup, release, follow = Vector((-.36,.10,1.68)), Vector((-.25,-.40,1.52)), Vector((-.23,-.45,1.22))
            velocity = (follow-windup)/11
            a,b,duration,u = (windup,release,5,(f-35)/5) if f <= 40 else (release,follow,6,(f-40)/6)
            v0,v1 = (Vector(),velocity) if f <= 40 else (velocity,Vector())
            # Preserve hand velocity through egg_release, then decelerate in the follow-through.
            wrists['R'] = (2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*duration*v0+(-2*u**3+3*u*u)*b+(u**3-u*u)*duration*v1
        t = smooth(min(f/17,(90-f)/26))
        hands['R'] = hands['R'].lerp(keys(f, [(0,(0,0,1)),(35,(0,0,1)),
                                    (40,(0,-1,.05)),(46,(0,-1,-.4)),(90,(0,0,-1))]),t)
        wrists['L'].y -= .17*math.sin(math.pi*phase)**2
        wrists['L'].z += .10*math.sin(math.pi*phase)**2
    rig.pose.bones['hips'].location = rig.data.bones['hips'].matrix_local.to_3x3().inverted() @ hips
    rotate('spine',(1,0,0),chest*.4)
    rotate('chest',(1,0,0),chest*.6)
    rotate('hips',(0,0,1),twist*.3)
    rotate('chest',(0,0,1),twist*.7)
    rotate('head',(1,0,0),head)
    bpy.context.view_layer.update()
    for side, s in [('L',1),('R',-1)]:
        limb('thigh_'+side,'shin_'+side,feet[side],(s*.105,-2,.5))
        orient('foot_'+side, rig.data.bones['foot_'+side].matrix_local.to_quaternion())
        pole = Vector((s*1.5,-.3,1.25+hips.z))
        if name in ('Walk','Run'):
            pole = Vector((s*.34,.55,.95+hips.z))
        elif name in ('Sit','Jump'):
            t = smooth(phase) if name == 'Sit' else math.sin(math.pi*phase)**2
            pole = pole.lerp(Vector((s*.36,.55,.95+hips.z)),t)
        limb('upper_arm_'+side,'forearm_'+side,wrists[side],pole)
        aim('hand_'+side,hands[side])


samples = {'Idle':[0,23,45,68,90], 'Walk':[0,3,6,9,12], 'Run':[0,2,4,8,12,16],
           'Jump':[0,4,10.8,17,21.6], 'Sit':[0,6,12,18,24],
           'Emote_CheerClap':[0,8,20,27,32,38,44,56,68,90],
           'Emote_Heart':[0,16,34,55,76,91,108], 'Emote_Angry':[0,15,26,37,49,60,78],
           'Emote_EggThrow':[0,17,30,35,40,46,64,90]}
for name,(end,loop) in CLIPS.items():
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action['loop'] = loop
    action['sample_frames'] = json.dumps(samples[name])
    if name == 'Emote_EggThrow':
        action['egg_release'], action['egg_scream'] = 40, 34
    rig.animation_data.action = action
    # Subframe keys keep the fast planted foot steady during quaternion interpolation.
    frames = [i/4 for i in range(int(end*4)+1)] if name in ('Walk','Run') else [*range(math.floor(end)+1)]
    if end != int(end):
        frames.append(end)
    previous = {}
    for frame in frames:
        pose(name,frame,end)
        for p in rig.pose.bones:
            if p.name == 'root':
                continue
            if p.name in previous and p.rotation_quaternion.dot(previous[p.name]) < 0:
                p.rotation_quaternion.negate()
            previous[p.name] = p.rotation_quaternion.copy()
            p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
        rig.pose.bones['hips'].keyframe_insert('location',frame=frame,group='hips')
    for curve in action.layers[0].strips[0].channelbag(action.slots[0]).fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    print(json.dumps({'built':name,'end':end,'loop':loop}))

# Hand-sized, smooth, closed egg: 240 triangles, no image or skin.
verts = [(0,0,.031)]
for ring in range(1,9):
    a = math.pi*ring/9
    r = .023*math.sin(a)*(1-.16*math.cos(a))
    verts += [(r*math.cos(j*math.tau/15),r*math.sin(j*math.tau/15),.031*math.cos(a)) for j in range(15)]
verts += [(0,0,-.031)]
faces = [(0,1+j,1+(j+1)%15) for j in range(15)]
for ring in range(7):
    for j in range(15):
        a,b = 1+ring*15+j, 1+ring*15+(j+1)%15
        faces.append((a,a+15,b+15,b))
faces += [(121,106+(j+1)%15,106+j) for j in range(15)]
mesh = bpy.data.meshes.new('Prop_Egg')
mesh.from_pydata(verts,[],faces)
mesh.update()
egg = bpy.data.objects.new('Prop_Egg',mesh)
scene.collection.objects.link(egg)
# glTF local (0, 0, -0.055) puts the egg against the palm when added to prop_R.
egg.location = (0,.055,0)
material = bpy.data.materials.get('EggShell') or bpy.data.materials.new('EggShell')
material.use_nodes = True
bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (.88,.79,.63,1)
bsdf.inputs['Roughness'].default_value = .62
mesh.materials.append(material)
for polygon in mesh.polygons:
    polygon.use_smooth = True
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
scene.frame_start, scene.frame_end = 0, 90
scene.frame_set(0)
print(json.dumps({'ok':True,'actions':list(CLIPS),'egg_release':40,'egg_scream':34}))
