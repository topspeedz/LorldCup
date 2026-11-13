"""T30: keep the approved head shapes and proportions; join shoulders and bind one rig."""
import ast
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
assert Path(bpy.data.filepath).resolve() == (OUT/'fan-rigged.blend').resolve()
assert 'FanRig' not in bpy.data.objects
IDS = ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2')
scene = bpy.data.scenes['FanAssets']
bpy.context.window.scene = scene
uniform, surface = (bpy.data.materials[n] for n in ('Uniform', 'FanSurface'))
source = ast.parse((OUT/'build-blockout.py').read_text(encoding='utf-8'))
helpers = [n for n in source.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in ('linear', 'Mesh')]
exec(compile(ast.Module(body=helpers, type_ignores=[]), 'T28-mesh-helpers', 'exec'))


class RigMesh(Mesh):
    def __init__(self):
        super().__init__()
        self.parts, self.part, self.uvs = [], 'torso', []

    def add(self, vertices, faces, color, slot=1, smooth=False):
        self.parts.extend([self.part]*len(vertices))
        super().add(vertices, faces, color, slot, smooth)


def clamp(v):
    return max(0, min(1, v))


def blend(a, b, t):
    t = clamp(t)
    weights = {a: 1-t, b: t}
    weights = {k: v for k, v in weights.items() if v >= .01}
    total = sum(weights.values())
    return {k: v/total for k, v in weights.items()}


def weights(part, co):
    x, y, z = co
    side = 'L' if x >= 0 else 'R'
    if part == 'head':
        return {'head': 1}
    if part == 'neck':
        return blend('chest', 'neck', (z-1.405)/.065)
    if part.startswith('arm') or part.startswith('hand'):
        along = ((abs(x)-.22)+(1.37-z))*.5
        if along < .07:
            return blend('shoulder_'+side, 'upper_arm_'+side, along/.07)
        if along < .30:
            return blend('upper_arm_'+side, 'forearm_'+side, (along-.14)/.10)
        return blend('forearm_'+side, 'hand_'+side, (along-.35)/.06)
    if part == 'torso':
        if z > 1.20 and abs(x) > .115:
            t = clamp((abs(x)-.115)/.10)*clamp((z-1.20)/.14)
            return blend('chest', 'shoulder_'+side, t)
        return blend('hips', 'spine', (z-.96)/.17) if z < 1.16 else blend('spine', 'chest', (z-1.16)/.17)
    if part == 'pelvis':
        return {'hips': 1}
    if part == 'leg':
        if z > .80:
            return blend('thigh_'+side, 'hips', (z-.80)/.13)
        if z > .27:
            return blend('shin_'+side, 'thigh_'+side, (z-.47)/.10)
        return blend('foot_'+side, 'shin_'+side, (z-.14)/.10)
    return blend('foot_'+side, 'toe_'+side, (-y-.105)/.075)


print(json.dumps({'replace_mesh_data':list(IDS), 'preserved':'T28 source blend, head vertices, joint layout, proportions'}))
for name in IDS:
    ob = bpy.data.objects[name]
    old = ob.data
    female = ob['body_base'] == 'female'
    skin = tuple(json.loads(ob['skin_srgb']))
    dark, pale = (.13, .18, .22), (.83, .87, .87)
    mesh = RigMesh()
    rings = [(0, 0, .90, .163 if female else .172, .095),
             (0, 0, 1.04, .143 if female else .170, .100),
             (0, -.004, 1.22, .173 if female else .200, .116),
             (0, 0, 1.35, .198 if female else .218, .115),
             (0, 0, 1.40, .181 if female else .198, .098),
             (0, 0, 1.445, .078, .067)]
    v = [(x+rx*math.cos(j*math.tau/16), y+ry*math.sin(j*math.tau/16), z)
         for x, y, z, rx, ry in rings for j in range(16)]
    faces = [tuple(range(15, -1, -1))]
    for k in range(5):
        for j in range(16):
            if k in (2, 3) and j in (14, 15, 0, 1, 6, 7, 8, 9):
                continue
            faces.append((k*16+j, k*16+(j+1)%16, (k+1)*16+(j+1)%16, (k+1)*16+j))
    faces.append(tuple(range(80, 96)))
    mesh.add(v, faces, (.25, .34, .40), slot=0)
    torso_faces = len(faces)
    for side in (1, -1):
        shift = 0 if side == 1 else 8
        j = lambda a: (a+shift)%16
        port = [32+j(a) for a in (14, 15, 0, 1, 2)] + [48+j(2), 64+j(2)] + [64+j(a) for a in (1, 0, 15, 14)] + [48+j(14)]
        axis = Vector((side, 0, -1)).normalized()
        u = axis.cross(Vector((0, 1, 0))).normalized()
        w = axis.cross(u).normalized()
        # Order the shoulder opening around the arm, then bridge without overlapping shells.
        center = Vector((side*.22, 0, 1.33))
        port.sort(key=lambda i: math.atan2((Vector(mesh.v[i])-center).dot(w), (Vector(mesh.v[i])-center).dot(u)))
        phase = math.atan2((Vector(mesh.v[port[0]])-center).dot(w), (Vector(mesh.v[port[0]])-center).dot(u))
        chain = [(.25, 1.34, .080), (.285, 1.305, .077), (.31, 1.28, .074),
                 (.316, 1.274, .065), (.36, 1.23, .061), (.39, 1.20, .057),
                 (.41, 1.18, .055), (.43, 1.16, .054), (.48, 1.11, .052),
                 (.57, 1.02, .040), (.60, .99, .036), (.62, .97, .040),
                 (.646, .944, .045), (.665, .925, .034), (.678, .912, .026)]
        previous = port
        for k, (x, z, radius) in enumerate(chain):
            center = Vector((side*x, -.005 if k > 10 else 0, z))
            new = [tuple(center+radius*(u*math.cos(phase+a*math.tau/12)+w*math.sin(phase+a*math.tau/12))) for a in range(12)]
            offset = len(mesh.v)
            mesh.part = 'arm_'+('L' if side == 1 else 'R')
            mesh.add(new, [], skin)
            indices = list(range(offset, offset+12))
            for a in range(12):
                mesh.f.append((previous[a], previous[(a+1)%12], indices[(a+1)%12], indices[a]))
                mesh.c.append((.25, .34, .40) if k < 3 else skin)
                mesh.m.append(0 if k < 3 else 1)
                mesh.s.append(True)
            previous = indices
        mesh.f.append(tuple(previous))
        mesh.c.append(skin)
        mesh.m.append(1)
        mesh.s.append(True)
        mesh.part = 'hand_'+('L' if side == 1 else 'R')
        mesh.ellipsoid((side*.622, -.038, .949), (.025, .022, .039), skin, n=10, rings=6)
    mesh.part = 'pelvis'
    mesh.loft([(0, 0, .825, .151 if female else .158, .097),
               (0, 0, .92, .167 if female else .178, .107)], dark, smooth=True)
    mesh.part = 'neck'
    mesh.tube([(0, 0, 1.405), (0, 0, 1.44), (0, 0, 1.47), (0, 0, 1.50)], [.063, .063, .062, .061], skin)
    for side in (-1, 1):
        mesh.part = 'leg'
        mesh.tube([(side*.105, 0, .89), (side*.105, -.006, .82), (side*.105, -.006, .745),
                   (side*.105, -.008, .684)], [.096 if female else .100, .093, .091, .087], dark)
        mesh.tube([(side*.105, -.008, .700), (side*.105, -.010, .60), (side*.105, -.012, .56),
                   (side*.105, -.012, .54), (side*.105, -.012, .52), (side*.105, -.013, .50),
                   (side*.105, -.014, .48), (side*.105, .009, .34), (side*.105, 0, .21),
                   (side*.105, 0, .13)], [.073, .068, .065, .064, .0635, .063, .063, .061, .047, .040], skin)
        mesh.tube([(side*.105, 0, .12), (side*.105, .001, .16), (side*.105, .003, .21)], [.042, .044, .047], pale)
        mesh.part = 'foot'
        mesh.loft([(side*.105, -.042, 0, .068, .137), (side*.105, -.042, .028, .070, .139)], pale, smooth=True)
        mesh.loft([(side*.105, -.042, .028, .069, .138), (side*.105, -.041, .063, .069, .132),
                   (side*.105, -.025, .11, .053, .107), (side*.105, .003, .13, .044, .065)], dark, smooth=True)
        for lace in range(3):
            mesh.tube([(side*.105-.034, -.090+lace*.025, .096+lace*.006),
                       (side*.105+.034, -.090+lace*.025, .096+lace*.006)], [.004, .004], pale, n=6)
    head_start = ob['body_vertex_count']
    new_head_start = len(mesh.v)
    mesh.part = 'head'
    offset = len(mesh.v)-head_start
    mesh.v.extend(tuple(v.co) for v in old.vertices[head_start:])
    mesh.parts.extend(['head']*(len(old.vertices)-head_start))
    attr = old.color_attributes['FanColor']
    for p in old.polygons:
        if min(p.vertices) < head_start:
            continue
        mesh.f.append(tuple(i+offset for i in p.vertices))
        mesh.c.append(tuple(attr.data[p.loop_start].color_srgb[:3]))
        mesh.m.append(p.material_index)
        mesh.s.append(p.use_smooth)
    used = sorted({i for face in mesh.f for i in face})
    remap = {old_i: new_i for new_i, old_i in enumerate(used)}
    mesh.v = [mesh.v[i] for i in used]
    mesh.parts = [mesh.parts[i] for i in used]
    mesh.f = [tuple(remap[i] for i in face) for face in mesh.f]
    new_head_start = sum(i < new_head_start for i in used)
    built = mesh.object(name+'-rig-build', scene)
    new = built.data
    for linked in [o for o in bpy.data.objects if o.type == 'MESH' and o.data == old]:
        linked.data = new
    bpy.data.objects.remove(built, do_unlink=True)
    new.name = name
    uv = new.uv_layers.new(name='UVMap')
    for p in new.polygons:
        for li in p.loop_indices:
            i = used[new.loops[li].vertex_index]
            if p.material_index == 0 and p.index < torso_faces and p.center.y < -.001:
                k, j = divmod(i, 16)
                coord = (.5+.5*math.cos(j*math.tau/16), (rings[k][2]-.90)/.545)
            elif p.material_index == 0:
                coord = (.025+.10*(i%12)/11, .30+.35*((i//12)%8)/7)
            else:
                coord = (.5, .5)
            uv.data[li].uv = coord
    for bone in ('root', 'hips', 'spine', 'chest', 'neck', 'head'):
        ob.vertex_groups.new(name=bone)
    for side in ('L', 'R'):
        for bone in ('shoulder', 'upper_arm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'toe'):
            ob.vertex_groups.new(name=bone+'_'+side)
    ob.vertex_groups.new(name='prop_R')
    for i, (part, co) in enumerate(zip(mesh.parts, mesh.v)):
        for bone, weight in weights(part, co).items():
            ob.vertex_groups[bone].add([i], weight, 'REPLACE')
    ob['body_vertex_count'] = new_head_start
    ob['stage'] = 'T30-rigged'
    ob.hide_set(False)
    ob.hide_render = False

data = bpy.data.armatures.new('FanSkeleton')
rig = bpy.data.objects.new('FanRig', data)
scene.collection.objects.link(rig)
rig.show_in_front = True
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
layout = json.loads(scene['joint_layout'])


def bone(name, head, tail, parent=None):
    b = data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = data.edit_bones[parent]
    b.roll = 0


bone('root', (0, 0, 0), (0, 0, .10))
bone('hips', layout['hips'], layout['spine'], 'root')
bone('spine', layout['spine'], layout['chest'], 'hips')
bone('chest', layout['chest'], layout['neck'], 'spine')
bone('neck', layout['neck'], layout['head'], 'chest')
bone('head', layout['head'], (0, 0, 1.78), 'neck')
for side, sign in [('L', 1), ('R', -1)]:
    p = lambda key: (sign*layout[key][0], layout[key][1], layout[key][2])
    bone('shoulder_'+side, layout['chest'], p('shoulder_L'), 'chest')
    bone('upper_arm_'+side, p('shoulder_L'), p('elbow_L'), 'shoulder_'+side)
    bone('forearm_'+side, p('elbow_L'), p('wrist_L'), 'upper_arm_'+side)
    bone('hand_'+side, p('wrist_L'), (sign*.678, -.005, .912), 'forearm_'+side)
    bone('thigh_'+side, p('hip_L'), p('knee_L'), 'hips')
    bone('shin_'+side, p('knee_L'), p('ankle_L'), 'thigh_'+side)
    bone('foot_'+side, p('ankle_L'), (sign*.105, -.14, .055), 'shin_'+side)
    bone('toe_'+side, (sign*.105, -.14, .055), (sign*.105, -.18, .04), 'foot_'+side)
bone('prop_R', (-.646, -.005, .944), (-.646, -.005, .914), 'hand_R')
bpy.ops.object.mode_set(mode='OBJECT')
for name in IDS:
    ob = bpy.data.objects[name]
    ob.parent = rig
    mod = ob.modifiers.new('FanSkin', 'ARMATURE')
    mod.object = rig
    mod.use_deform_preserve_volume = False
    ob.hide_render = name != 'fan_f1'
    ob.hide_set(name != 'fan_f1')
scene['stage'] = 'T30 shared rig and uniform UV; clips belong to T35'
scene.render.fps = 30
print(json.dumps({'rig':rig.name,'bones':len(data.bones),'characters':list(IDS)}))
