"""T93: preserve the central ramps; add side access, chairs and a parallel rear ring."""
import ast
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T93'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
assert Path(bpy.data.filepath).resolve() == ART / 'barclays-arena-t75-baked.blend'
assert not (ART / 'barclays-arena-t93.blend').exists()
modified = set()
quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
for node in ast.parse((ART / 't75-build.py').read_text(encoding='utf-8')).body:
    if isinstance(node, ast.FunctionDef) and node.name in ('commit', 'append', 'make', 'cut_box'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'T75 geometry helpers', 'exec'))

CY = -.005370497703552246
SY = scene.objects['Walk_Tier0__concrete'].scale.y
RX, RY = 55.86, 45.86 * SY
protected = json.loads((ROOT / 'web/config/seats.json').read_text())['seats']
changes = {'protected_seats': protected, 'rear_width_m': 5.0, 'ramps_width_m': 6.766,
           'modified': [], 'added': [], 'new_seats': [], 'runtime_recommendations': []}
chair_geometry = {}


def finish(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    commit(ob, bm)


def point(label, r, w, z):
    return (-r, w + CY, z) if label == 'Entry' else (w, (r if label == 'A' else -r) + CY, z)


def box_to(ob, center, size, angle=0):
    c = Vector(center)
    rot = Matrix.Rotation(angle, 3, 'Z')
    verts = [c + rot @ Vector((x * size[0] / 2, y * size[1] / 2, z * size[2] / 2))
             for z in (-1, 1) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    if ob.name in ('Seats__seat', 'Seat_armrests__steel', 'Fix_SeatBases__steel'):
        vv, ff = chair_geometry.setdefault(ob.name, ([], []))
        offset = len(vv)
        vv.extend(verts)
        ff.extend(tuple(offset + i for i in face) for face in quads)
    else:
        append(ob, verts, quads)


def parallel(t, offset):
    normal = Vector((math.cos(t) / RX, math.sin(t) / RY))
    normal.normalize()
    return Vector((RX * math.cos(t), RY * math.sin(t))) + offset * normal


def remap_ring(ob, old_rx, old_ry, offset):
    inv = ob.matrix_world.inverted()
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        q = Vector((p.x, p.y - CY))
        t = math.atan2(q.y / old_ry, q.x / old_rx)
        old = Vector((old_rx * math.cos(t), old_ry * math.sin(t)))
        n = Vector((math.cos(t) / old_rx, math.sin(t) / old_ry)).normalized()
        q = parallel(t, offset + (q - old).dot(n))
        v.co = inv @ Vector((q.x, q.y + CY, p.z))
    ob.data.update()
    modified.add(ob.name)


def cut_portals(ob, high=6.5):
    cut_box(ob, (-70, CY - 3.45, -.3), (-53, CY + 3.45, high))
    for side in (-1, 1):
        lo, hi = sorted((side * 43, side * 56))
        cut_box(ob, (-3.45, lo + CY, -.3), (3.45, hi + CY, high))


# The former outer ellipse was only 0.2 m behind the seats at its north/south tips.
rear = ['Suites_floor__concrete', 'Suite_windows__glass', 'Suite_piers__ivory', 'Suite_fascia__ivory']
rear += [o.name for o in scene.objects if o.name.startswith('REF_SuiteRibbon_')]
print('T93_REMAP', rear, flush=True)
for name in rear:
    ob = scene.objects[name]
    remap_ring(ob, 61, 46 * SY, 5.0)
    cut_portals(ob)
for ob in list(scene.objects):
    if ob.name.startswith('REF_RibbonProgram_0_'):
        remap_ring(ob, 60.6, 45.6 * SY, 4.6)
        cut_portals(ob, 3)
    elif ob.name.startswith('REF_RibbonBrand_0_'):
        p = ob.matrix_world.translation.copy()
        t = math.atan2((p.y - CY) / (45.6 * SY), p.x / 60.6)
        q = parallel(t, 4.6)
        ob.location += Vector((q.x - p.x, q.y + CY - p.y, 0))
        modified.add(ob.name)

# The underlying concourse already supplies the flat 360-degree floor.
# Match its inner edge to the retained seat rim without introducing coplanar plates.
ob = scene.objects['Walk_Concourse__concrete']
inv = ob.matrix_world.inverted()
for v in ob.data.vertices:
    p = ob.matrix_world @ v.co
    if abs(math.hypot(p.x / 56, (p.y - CY) / (46 * SY)) - 1) < .006:
        t = math.atan2((p.y - CY) / (46 * SY), p.x / 56)
        q = parallel(t, -.015)
        v.co = inv @ Vector((q.x, q.y + CY, p.z))
modified.add(ob.name)

# Clear only the uneven ends beside each ramp, then rebuild the retained row heights.
trim_names = ['Walk_Tier0__concrete', 'Fix_TierRisers__concrete', 'Fix_TierSoffits__concrete',
              'Fix_TierFascia__concrete']
print('T93_TRIM', trim_names, flush=True)
for name in trim_names:
    ob = scene.objects[name]
    cut_box(ob, (-56, CY - 6, -11), (-28.8, CY + 6, .01))
    for side in (-1, 1):
        lo, hi = sorted((side * 18.8, side * 46))
        cut_box(ob, (-5.05, lo + CY, -11), (5.05, hi + CY, .01))

seat_ob = scene.objects['Seats__seat']
arms = scene.objects['Seat_armrests__steel']
bases = scene.objects['Fix_SeatBases__steel']
for label in ('Entry', 'A', 'B'):
    access_name = 'Walk_RampA__T93EntryAccess' if label == 'Entry' else f'Walk_Ramp{label}__T93SeatAccess'
    access = make(access_name, 'concrete', [], [])
    changes['added'].append(access.name)
    for side in (-1, 1):
        outer_w = 6 if label == 'Entry' else 5.05
        for row in range(23):
            rx, ry, z = 31 + row * 1.08, (21 + row * 1.08) * SY, -9.9 + row * .43
            def radius(w, d=0):
                a, b = (rx + d, ry + d * SY) if label == 'Entry' else (ry + d * SY, rx + d)
                return a * math.sqrt(1 - (w / b) ** 2)
            w0, w1 = side * 3.45, side * outer_w
            footprint = [(radius(w, d), w) for d, w in ((-.02, w0), (-.02, w1), (1.06, w1), (1.06, w0))]
            append(access, [point(label, r, w, height) for height in (z - .2, z) for r, w in footprint], quads)
            # Exactly one extra chair column per side; keep every pre-existing chair.
            w = side * 4.44
            r = radius(w)
            c = Vector(point(label, r, w, z))
            t = math.atan2((c.y - CY) / ry, c.x / rx)
            angle = t - math.pi / 2
            box_to(seat_ob, c + Vector((0, 0, .39)), (.49, .46, .14), angle)
            box_to(seat_ob, c + Vector((.22 * math.cos(t), .22 * math.sin(t), .76)), (.49, .12, .64), angle)
            box_to(bases, c + Vector((0, 0, .16)), (.38, .30, .32), angle)
            for arm in (-1, 1):
                box_to(arms, c + Vector((arm * .28 * math.cos(angle), arm * .28 * math.sin(angle), .61)), (.05, .46, .055), angle)
            reserved = label == 'Entry' and 14 <= row <= 21
            user_id = f'lower-entry-{"south" if side < 0 else "north"}-{22 - row:02}' if reserved else None
            stand = Vector(point(label, radius(side * 3.77, .48), side * 3.77, z))
            changes['new_seats'].append({'id': user_id or f't93-{label.lower()}-{side}-{row:02}',
                'ramp': label, 'row': row, 'side': side, 'reserved': reserved, 'blender': list(c), 'angle': t,
                'position': [c.x, c.z, -c.y], 'standPosition': [stand.x, stand.z, -stand.y], 'screenFace': 'west' if reserved else None})
        # A 0.70 m side stair starts on the same concourse level at the ramp head.
        r0 = 55.5 if label == 'Entry' else 45.25
        top = 61.5 if label == 'Entry' else 51.5
        for edge in (3.45,):
            footprint = [(r0, side * edge, -.44), (r0, side * 4.08, -.44),
                         (top, side * 4.08, 0), (top, side * edge, 0)]
            append(access, [point(label, r, w, z + dz) for dz in (-.2, 0) for r, w, z in footprint], quads)
    finish(access)

for name, (verts, faces) in chair_geometry.items():
    append(scene.objects[name], verts, faces)

# Shorten the existing rails only at their head to expose both side stair entrances.
rails = ['Ramp_rail__silver', 'Ramp_posts__silver']
rails += [f'Collide_Ramp{label}_{part}__silver' for label in ('A', 'B') for part in ('rail', 'posts')]
print('T93_RAIL_OPENINGS', rails, flush=True)
for name in rails:
    ob = scene.objects[name]
    if name.startswith('Ramp_'):
        cut_box(ob, (-62, -5, -2), (-59.2, 5, 3))
    else:
        side = 1 if 'RampA' in name else -1
        lo, hi = sorted((side * 49.2, side * 52))
        cut_box(ob, (-5, lo, -2), (5, hi, 3))
    finish(ob)

# Invisible collision panels surround both edges and close the ends at each portal.
mat = bpy.data.materials['silver'].copy()
mat.name = 'T93_InvisibleCollision'
p = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
p.inputs['Alpha'].default_value = 0
mat.surface_render_method = 'DITHERED'
barrier = make('Collide_T93RearRing__barrier', mat.name, [], [])
verts, faces = [], []
def panel(a, b, low, high):
    k = len(verts)
    verts.extend([(a.x, a.y + CY, low), (b.x, b.y + CY, low), (b.x, b.y + CY, high), (a.x, a.y + CY, high)])
    faces.append((k, k + 1, k + 2, k + 3))
for offset, low, high in ((-.03, -1, 3.2), (4.75, -.25, 6.2)):
    for i in range(720):
        a, b = parallel(math.tau * i / 720, offset), parallel(math.tau * (i + 1) / 720, offset)
        panel(a, b, low, high)
append(barrier, verts, faces)
cut_portals(barrier, 7)
changes['added'].append(barrier.name)
# Real sill end caps and invisible returns prevent walking onto cut-off LED ends.
caps = make('Collide_T93RearPortalCaps__concrete', 'concrete', [], [])
for label in ('Entry', 'A', 'B'):
    for side in (-1, 1):
        inner = RX if label == 'Entry' else RY
        a, b = Vector(point(label, inner, side * 3.40, 0)), Vector(point(label, inner + 5, side * 3.40, 0))
        append(barrier, [a + Vector((0, 0, -.25)), b + Vector((0, 0, -.25)), b + Vector((0, 0, 6.2)), a + Vector((0, 0, 6.2))], [(0, 1, 2, 3)])
        box_to(caps, point(label, inner + 4.6, side * 3.40, 1.14), (.06, 1.0, .28) if label != 'Entry' else (1.0, .06, .28))
changes['added'].append(caps.name)

for name in changes['added']:
    ob = scene.objects[name]
    if ob.name.startswith('Walk_') or ob is caps:
        ob['bakedLighting'] = {'texture': './lightmaps/bowl-v2.png', 'range': 16, 'uvAttribute': '_lightmap_uv'}
        uv = ob.data.uv_layers.get('ShaderUV') or ob.data.uv_layers.new(name='ShaderUV')
        for poly in ob.data.polygons:
            axes = [i for i in range(3) if i != max(range(3), key=lambda j: abs(poly.normal[j]))]
            for li in poly.loop_indices:
                q = ob.data.vertices[ob.data.loops[li].vertex_index].co
                uv.data[li].uv = (q[axes[0]] / 2, q[axes[1]] / 2)

changes['modified'] = sorted(modified)
changes['runtime_recommendations'] = [
    'T97: register the sixteen reserved positions below and clear their crowd origins.',
    'Keep the existing six arena-fixes edgeSegments: access starts around the ramp heads, beyond their ends.',
    'New access meshes use the existing Walk_RampA/B__ recognition to allow walking beside the ramps.'
]
assert len([s for s in changes['new_seats'] if s['reserved']]) == 16
(OUT / 'geometry-changes.json').write_text(json.dumps(changes, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t93.blend'))
print('T93_GEOMETRY_SAVED', len(changes['new_seats']), 'chairs', len(modified), 'changed meshes', flush=True)
