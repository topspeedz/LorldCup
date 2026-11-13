"""Static acceptance poses and contact sheets; not T35 animation clips."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
assert json.loads((OUT.parents[2]/'_workspace/gpu-lock.json').read_text())['owner'] == 'T30'
IDS = ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2')
rig = bpy.data.objects['FanRig']
assets = bpy.data.scenes['FanAssets']
poses = ['neutral', 'flex', 'arms-up', 'reach-front', 'reach-side', 'twist', 'squat', 'stride']


def rotate(name, axis, degrees):
    p = rig.pose.bones[name]
    p.rotation_mode = 'QUATERNION'
    local_axis = p.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    p.rotation_quaternion = Quaternion(local_axis.normalized(), math.radians(degrees))


def pose(name):
    for p in rig.pose.bones:
        p.matrix_basis = Matrix.Identity(4)
    for side, sign in [('L', 1), ('R', -1)]:
        if name in ('arms-up', 'reach-side'):
            rotate('upper_arm_'+side, (0, 1, 0), -sign*(115 if name == 'arms-up' else 45))
        if name == 'reach-front':
            p = rig.pose.bones['upper_arm_'+side]
            rest = (p.bone.tail_local-p.bone.head_local).normalized()
            delta = rest.rotation_difference(Vector((sign*.1, -1, .05)).normalized())
            m = p.bone.matrix_local.to_quaternion()
            p.rotation_mode = 'QUATERNION'
            p.rotation_quaternion = m.inverted() @ delta @ m
        if name == 'flex':
            rotate('forearm_'+side, (1, 0, sign), -120)
        if name == 'squat':
            for joint, degrees in [('thigh', -75), ('shin', 110), ('foot', -35)]:
                rotate(joint+'_'+side, (1, 0, 0), degrees)
        if name == 'stride':
            for joint, values in [('thigh', (-28, 26)), ('shin', (12, 40)), ('foot', (16, -66))]:
                rotate(joint+'_'+side, (1, 0, 0), values[0 if side == 'L' else 1])
        if name == 'twist':
            rotate('forearm_'+side, rig.data.bones['forearm_'+side].tail_local-rig.data.bones['forearm_'+side].head_local, 25)
    if name == 'flex':
        rotate('thigh_L', (1, 0, 0), -65)
        rotate('shin_L', (1, 0, 0), 125)
    if name == 'twist':
        rotate('spine', (0, 0, 1), 35)
        rotate('chest', (0, 0, 1), 20)
        rotate('head', (0, 0, 1), -25)
    bpy.context.view_layer.update()
    if name in ('squat', 'stride'):
        dg = bpy.context.evaluated_depsgraph_get()
        ob = bpy.data.objects['fan_f1'].evaluated_get(dg)
        evaluated = ob.to_mesh()
        floor = min(v.co.z for v in evaluated.vertices)
        ob.to_mesh_clear()
        rig.pose.bones['hips'].location = rig.data.bones['hips'].matrix_local.to_3x3().inverted() @ Vector((0, 0, -floor))
        bpy.context.view_layer.update()


def prepare(name):
    bpy.context.window.scene = assets
    pose(name)
    dg = bpy.context.evaluated_depsgraph_get()
    review = bpy.data.scenes.new('T30-'+name)
    review.render.engine = 'BLENDER_EEVEE'
    review.render.resolution_x, review.render.resolution_y = 1024, 1120
    review.render.resolution_percentage = 100
    review.render.image_settings.file_format = 'PNG'
    review.render.filepath = str(OUT/('pose-'+name+'.png'))
    review.world = bpy.data.scenes['FanSheet'].world
    for original in bpy.data.scenes['FanSheet'].objects:
        if original.type == 'LIGHT':
            light = original.copy()
            review.collection.objects.link(light)
            light.location.x -= 2
    camera = bpy.data.objects.new(review.name+'-camera', bpy.data.cameras.new(review.name+'-camera'))
    review.collection.objects.link(camera)
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 8.5
    camera.location = (2.7, -20, -2.3)
    camera.rotation_euler = (Vector((2.7, 0, -2.3))-camera.location).to_track_quat('-Z', 'Y').to_euler()
    review.camera = camera
    metrics = []
    for col, char in enumerate(IDS):
        ob = bpy.data.objects[char]
        ob.hide_set(False)
        evaluated = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(evaluated, depsgraph=dg, preserve_all_data_layers=True)
        me.calc_loop_triangles()
        minimum = min(v.co.z for v in me.vertices)
        assert minimum >= -.02, (name, char, 'ground penetration', minimum)
        assert all(math.isfinite(c) for v in me.vertices for c in v.co)
        assert all(t.area > 1e-12 for t in me.loop_triangles), (name, char, 'collapsed triangles')
        scale_error = max(abs(v-1) for p in rig.pose.bones for v in p.matrix.to_scale())
        assert scale_error < .00001, (name, 'bone scale')
        rest = ob.data
        stretch = max((me.vertices[e.vertices[0]].co-me.vertices[e.vertices[1]].co).length /
                      (rest.vertices[e.vertices[0]].co-rest.vertices[e.vertices[1]].co).length for e in rest.edges)
        metrics.append(dict(id=char, floor=round(minimum, 6), bone_scale_error=round(scale_error, 8),
                            max_edge_stretch=round(stretch, 3)))
        for row, (view, angle) in enumerate([('front', 0), ('side', -math.pi/2), ('back', math.pi), ('close', -.45)]):
            mesh = me
            close = row == 3
            if close:
                mesh = me.copy()
                # Crop only review geometry; source meshes and deformation measurements are unchanged.
                import bmesh
                bm = bmesh.new()
                bm.from_mesh(mesh)
                bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < .85], context='VERTS')
                bm.to_mesh(mesh)
                bm.free()
            instance = bpy.data.objects.new(char+'-'+view+'-'+name, mesh)
            review.collection.objects.link(instance)
            instance.rotation_euler.z = angle
            instance.location = (col*1.8, 0, -row*2.25-(1.0 if close else 0))
            if close:
                instance.scale = (1.5, 1.5, 1.5)
    return review, metrics


reviews, results = [], []
try:
    for name in poses:
        review, metrics = prepare(name)
        reviews.append(review)
        results.append(dict(pose=name, hips_location=list(rig.pose.bones['hips'].location), characters=metrics))
finally:
    bpy.context.window.scene = assets
    pose('neutral')
    for char in IDS:
        bpy.data.objects[char].hide_set(char != 'fan_f1')
        bpy.data.objects[char].hide_render = char != 'fan_f1'
(OUT/'pose-metrics.json').write_text(json.dumps({'ok':True,'poses':results}, indent=2), encoding='utf-8')
queue = list(reviews)
rendered = []


def render_next():
    review = queue.pop(0)
    try:
        bpy.ops.render.render(write_still=True, scene=review.name)
        rendered.append(Path(review.render.filepath).name)
        (OUT/'pose-render-status.json').write_text(json.dumps({'ok':not queue,'rendered':rendered}), encoding='utf-8')
    except Exception as error:
        (OUT/'pose-render-status.json').write_text(json.dumps({'ok':False,'error':str(error),'rendered':rendered}), encoding='utf-8')
        return None
    return .1 if queue else None


bpy.app.timers.register(render_next, first_interval=.5)
print(json.dumps({'ok':True, 'poses':len(results),'characters_per_pose':4, 'rendering':[s.name for s in reviews]}))
