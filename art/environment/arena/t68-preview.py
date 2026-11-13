"""Prepare an isolated geometry proposal and matched CPU review renders; no GLB export."""
import json
import math
import runpy
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T68'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == OUT / 'source-export.blend'
helpers = runpy.run_path(str(ART / 't68-check.py'))
scene = helpers['SCENE']
targets = helpers['seat_targets']()
original_names = set(scene.objects.keys())
changes = {}


def render(label):
    hidden = {ob: ob.hide_render for ob in scene.objects}
    old_camera = scene.camera
    camera = bpy.data.objects.new('T68_ReviewCamera', bpy.data.cameras.new('T68_ReviewCamera'))
    fill = bpy.data.objects.new('T68_ReviewFill', bpy.data.lights.new('T68_ReviewFill', 'AREA'))
    scene.collection.objects.link(camera)
    scene.collection.objects.link(fill)
    scene.camera = camera
    camera.data.lens = 28
    camera.data.clip_end = 350
    fill.data.energy = 1300
    fill.data.shape = 'DISK'
    fill.data.size = 5
    for ob in scene.objects:
        if ob.type == 'MESH' and ('_CM_PART' in ob.data.attributes or ob.name.startswith(
            ('EXR_', 'City', 'Road', 'Crosswalk', 'Plaza', 'Walk_Plaza', 'Collide_City'))):
            ob.hide_render = True
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 6
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 3
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 6
    scene.render.resolution_x = 640
    scene.render.resolution_y = 400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    for name, location, target in (
        ('ledge', (4, -39, 1.5), (0, -46, 1.0)),
        ('entrance', (-58, 1, 2), (-53, 6, -.5)),
        ('aisle', (-40, 14, 2), (-49, 20, -2)),
    ):
        camera.location = location
        camera.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
        fill.location = Vector(location) + Vector((0, 0, .7))
        fill.rotation_euler = (Vector(target) - fill.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(OUT / f'{label}-{name}.png')
        bpy.ops.render.render(write_still=True)
        print('T68_RENDERED', scene.render.filepath, flush=True)
    for ob, value in hidden.items():
        ob.hide_render = value
    scene.camera = old_camera
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(fill, do_unlink=True)


render('before')

# Retract only the cantilever; the outer strip under the suite piers stays fixed.
ob = scene.objects['Suites_floor__concrete']
count = 0
for v in ob.data.vertices:
    if math.hypot(v.co.x / 56, v.co.y / 41) < 1.001:
        v.co.x *= 60.8 / 56
        v.co.y *= 45.8 / 41
        count += 1
ob.data.update()
assert count > 100
changes[ob.name] = dict(retracted_vertices=count, inner_radii_before=[56, 41], inner_radii_after=[60.8, 45.8])
for ob in scene.objects:
    if ob.name.startswith('REF_RibbonProgram_0_'):
        inverse = ob.matrix_world.inverted()
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            p.x *= 60.6 / 55.64
            p.y = (p.y + .0053705) * 45.6 / 45.64 - .0053705
            v.co = inverse @ p
        ob.data.update()
        changes[ob.name] = dict(edge_radii=[60.6, 45.6], height_unchanged=True)
    elif ob.name.startswith('REF_RibbonBrand_0_'):
        transform = ob.matrix_world.copy()
        p = transform.translation
        p.x *= 60.6 / 55.64
        p.y = (p.y + .0053705) * 45.6 / 45.64 - .0053705
        transform.translation = p
        ob.matrix_world = transform
        changes[ob.name] = dict(follows_ribbon=True)

# The original low guard also crosses the new side landings near the entrance.
for name in ('Tier_ribbon__blue', 'Tier_ribbon_light__cyan'):
    ob = scene.objects[name]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for y in (-4.8, 4.8):
        faces = [f for f in bm.faces if f.calc_center_median().x < -48 and f.calc_center_median().z < 3]
        edges = {e for f in faces for e in f.edges}
        verts = {v for f in faces for v in f.verts}
        bmesh.ops.bisect_plane(bm, geom=list(verts) + list(edges) + faces,
            plane_co=(0, y, 0), plane_no=(0, 1, 0), dist=1e-6)
    remove = [f for f in bm.faces if f.calc_center_median().x < -48 and
              f.calc_center_median().z < 3 and abs(f.calc_center_median().y) < 4.8]
    bmesh.ops.delete(bm, geom=remove, context='FACES')
    boundaries = [e for e in bm.edges if e.is_boundary and
        all(v.co.x < -48 and v.co.z < 3 for v in e.verts) and
        any(all(abs(v.co.y - y) < 1e-4 for v in e.verts) for y in (-4.8, 4.8))]
    bmesh.ops.holes_fill(bm, edges=boundaries)
    bm.to_mesh(ob.data)
    bm.free()
    changes[name] = dict(west_opening_half_width=4.8)

# One entrance-facing chair column beside each of the two adjacent radial aisles.
for name in ('Seats__seat', 'Seats__seat2', 'Seat_armrests__steel'):
    ob = scene.objects[name]
    remove = []
    part_targets = helpers['arm_targets']() if name == 'Seat_armrests__steel' else targets
    tolerance = .02 if name == 'Seat_armrests__steel' else .55
    for first in range(0, len(ob.data.vertices), 8):
        center = sum((v.co for v in ob.data.vertices[first:first + 8]), Vector()) / 8
        if any((center - target).length < tolerance for target in part_targets):
            remove.extend(range(first, first + 8))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in remove], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    changes[name] = dict(removed_box_parts=len(remove) // 8)
assert changes['Seats__seat']['removed_box_parts'] + changes['Seats__seat2']['removed_box_parts'] == 92
assert changes['Seat_armrests__steel']['removed_box_parts'] == 92

# Pull back the matching plinth ends, so an empty chair column is actually clear.
ob = scene.objects['Fix_SeatBases__steel']
matrix = scene.objects['Walk_Tier0__concrete'].matrix_world
inverse = matrix.inverted()
count = 0
for v in ob.data.vertices:
    p = inverse @ v.co
    row = math.floor((p.z + 9.9 + .001) / .43)
    if not 0 <= row < 23 or p.z > .1:
        continue
    rx, ry = 31 + row * 1.08, 21 + row * 1.08
    radial_offset = min((-.12, .20, .12, .38),
        key=lambda d: abs(math.hypot(p.x / (rx + d), p.y / (ry + d)) - 1))
    angle = math.atan2(p.y / (ry + radial_offset), p.x / (rx + radial_offset)) % (2 * math.pi)
    for k, sector, direction in ((0, 7, 1), (1, 9, -1)):
        target = targets[row * 2 + k]
        end = math.atan2(target.y / (21 + row * 1.08), target.x / (31 + row * 1.08)) % (2 * math.pi)
        end += direction * .36 / (21 + row * 1.08)
        edge = sector * math.pi / 8
        if .021 < direction * (angle - edge) < direction * (end - edge):
            p.x = (rx + radial_offset) * math.cos(end)
            p.y = (ry + radial_offset) * math.sin(end)
            v.co = matrix @ p
            count += 1
ob.data.update()
changes[ob.name] = dict(retracted_vertices=count)

# Side landings meet the existing treads. Their upper approach joins the main ramp.
ob = scene.objects['Walk_Tier0__concrete']
bm = bmesh.new()
bm.from_mesh(ob.data)
new_faces = []
quads = ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))
for side in (-1, 1):
    ya, yb = sorted((side * 3.3, side * 4.7))
    sections = []
    for row in range(22, 18, -1):
        radius = 31 + row * 1.08
        a, b = -(radius + 1.1) * math.cos(math.pi / 32), -(radius - .02) * math.cos(math.pi / 32)
        z = -9.9 + row * .43
        sections.append((a, b, z, z))
    sections.insert(0, (-59, sections[0][0], -.625, -.44))
    for a, b, za, zb in sections:
        vertices = [bm.verts.new(p) for p in ((a, ya, za - .2), (b, ya, zb - .2),
            (b, yb, zb - .2), (a, yb, za - .2), (a, ya, za), (b, ya, zb), (b, yb, zb), (a, yb, za))]
        for q in quads:
            face = bm.faces.new([vertices[i] for i in q])
            new_faces.append(face)
            for loop in face.loops:
                loop[bm.loops.layers.uv['ShaderUV']].uv = loop.vert.co.xy / 2
bmesh.ops.recalc_face_normals(bm, faces=new_faces)
bm.to_mesh(ob.data)
bm.free()
changes[ob.name] = dict(added_faces=len(new_faces), side_width=1.4, tread_rise=.43, approach_x=-59)

# An opening in the old side rail is necessary at the two branch junctions.
for name in ('Ramp_rail__silver', 'Ramp_posts__silver'):
    ob = scene.objects[name]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for x in (-59.7, -55.5):
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=(x, 0, 0), plane_no=(1, 0, 0), dist=1e-6)
    remove = [f for f in bm.faces if -59.7 < f.calc_center_median().x < -55.5]
    bmesh.ops.delete(bm, geom=remove, context='FACES')
    boundaries = [e for e in bm.edges if e.is_boundary and
                  any(all(abs(v.co.x - x) < 1e-4 for v in e.verts) for x in (-59.7, -55.5))]
    bmesh.ops.holes_fill(bm, edges=boundaries)
    bm.to_mesh(ob.data)
    bm.free()
    changes[name] = dict(opening_x=[-59.7, -55.5])

assert set(scene.objects.keys()) == original_names
result = helpers['check']()
(OUT / 'proposal.json').write_text(json.dumps(dict(changes=changes, check=result,
    removed_chairs=46, lightmap_rebake_owner='T75'), indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t68-proposal.blend'))
render('after')
print('T68_PROPOSAL_READY', len(changes), flush=True)
