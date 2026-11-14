"""Apply the approved T75 bundle to the isolated T68 copy, without baking or exporting."""
import collections
import json
import math
import runpy
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
OUT = ROOT / 'temp/T75'
assert bpy.app.background and Path(bpy.data.filepath).resolve() == OUT / 'source.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
protected = [Vector((p['position'][0], -p['position'][2], p['position'][1]))
             for p in json.loads((ROOT / 'web/config/seats.json').read_text())['seats']]
original_names = set(scene.objects.keys())
changes = {}
removed_chairs = []
removed_people = []
modified = set()
quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def commit(ob, bm):
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    modified.add(ob.name)


def prune(ob, predicate):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    delete = [v for v in bm.verts if predicate(ob.matrix_world @ v.co)]
    bmesh.ops.delete(bm, geom=delete, context='VERTS')
    commit(ob, bm)
    return len(delete)


def append(ob, vertices, faces, material=0):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    inverse = ob.matrix_world.inverted()
    added = [bm.verts.new(inverse @ Vector(p)) for p in vertices]
    created = []
    for points in faces:
        face = bm.faces.new([added[i] for i in points])
        face.material_index = material
        created.append(face)
        for layer in bm.loops.layers.uv.values():
            for loop in face.loops:
                loop[layer].uv = loop.vert.co.xy / 2
    bmesh.ops.recalc_face_normals(bm, faces=created)
    commit(ob, bm)


def make(name, material, vertices, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(bpy.data.materials[material])
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    return ob


def protected_at(p):
    return any((p.xy - q.xy).length < .7 and abs(p.z - q.z) < 1.3 for q in protected)


def clear_zone(p):
    if p.z > 2 or protected_at(p):
        return None
    _, chair_id, distance = chair_tree.find(p)
    if distance < 1.4:
        p = cushions[chair_id]
    if protected_at(p):
        return None
    if -61 < p.x < -28.5 and abs(p.y) < 5.9:
        return 'entry'
    if abs(p.x) < 5.05 and 18.5 < abs(p.y) < 51.5:
        return 'ramp-A' if p.y > 0 else 'ramp-B'
    if distance < 1.4 and chair_id in stair_targets:
        return stair_targets[chair_id]
    return None


# Pick one additional existing chair column on each side of each approved stair.
cushions = []
for name in ('Seats__seat', 'Seats__seat2'):
    ob = scene.objects[name]
    for first in range(0, len(ob.data.vertices), 8):
        points = [ob.matrix_world @ v.co for v in ob.data.vertices[first:first + 8]]
        if max(p.z for p in points) - min(p.z for p in points) > .2:
            continue
        center = sum(points, Vector()) / 8
        if center.z < 2:
            cushions.append(center)
chair_tree = KDTree(len(cushions))
for index, point in enumerate(cushions):
    chair_tree.insert(point, index)
chair_tree.balance()
stair_chairs = []
for row in range(23):
    rx, ry, z = 31 + row * 1.08, 21 + row * 1.08, -9.9 + row * .43
    candidates = [p for p in cushions if abs(p.z - z - .39) < .02]
    for sector in (7, 9):
        edge = sector * math.pi / 8
        for direction in (-1, 1):
            nearby = [(direction * (math.atan2(p.y / ry, p.x / rx) % (2 * math.pi) - edge), p)
                      for p in candidates]
            near = [(angle, p) for angle, p in nearby if 0 < angle < .15]
            assert near, (row, sector, direction)
            stair_chairs.append((f'stair-{sector}', min(near, key=lambda pair: pair[0])[1]))
assert len(stair_chairs) == 92
stair_targets = {chair_tree.find(point)[1]: label for label, point in stair_chairs}

# Remove whole chair parts; six selectable chairs and every lower retained chair stay intact.
for name in ('Seats__seat', 'Seats__seat2', 'Seat_armrests__steel'):
    ob = scene.objects[name]
    remove = []
    for first in range(0, len(ob.data.vertices), 8):
        center = sum((ob.matrix_world @ v.co for v in ob.data.vertices[first:first + 8]), Vector()) / 8
        zone = clear_zone(center)
        if center.z > 5 or zone:
            remove.extend(range(first, first + 8))
            if zone and name.startswith('Seats'):
                removed_chairs.append(dict(zone=zone, center=list(center)))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in remove], context='VERTS')
    commit(ob, bm)
    changes[name] = dict(removed_box_parts=len(remove) // 8)

# Four chords per block keep each continuous bench strip on the original curved tread.
vertices, faces = [], []
for row in range(23):
    rx, ry, z = 61 + row * 1.08, 46 + row * 1.08, 6.2 + row * .63
    profile = [(-.23, 0), (.28, 0), (.28, 1.08), (.16, 1.08), (.16, .46), (-.23, .46)]
    for sector in range(16):
        start, end = sector * math.pi / 8 + .022, (sector + 1) * math.pi / 8 - .022
        for part in range(4):
            a, b = start + (end - start) * part / 4, start + (end - start) * (part + 1) / 4
            offset = len(vertices)
            vertices.extend(((rx + r) * math.cos(t), (ry + r) * math.sin(t) - .0053705, z + h)
                            for t in (a, b) for r, h in profile)
            faces += [tuple(offset + i for i in range(5, -1, -1)), tuple(offset + 6 + i for i in range(6))]
            faces += [(offset + i, offset + (i + 1) % 6, offset + (i + 1) % 6 + 6, offset + i + 6) for i in range(6)]
append(scene.objects['Seats__seat'], vertices, faces)

# Regenerate the approved lower chair bases to the remaining actual chair extents.
ob = scene.objects['Fix_SeatBases__steel']
ob.data.clear_geometry()
vertices, faces = [], []
for row in range(23):
    rx, ry, z = 31 + row * 1.08, 21 + row * 1.08, -9.9 + row * .43
    keep = [p for p in cushions if abs(p.z - z - .39) < .02 and clear_zone(p) is None]
    for sector in range(16):
        angles = sorted(math.atan2(p.y / ry, p.x / rx) % (2 * math.pi) for p in keep
                        if int((math.atan2(p.y / ry, p.x / rx) % (2 * math.pi)) / (math.pi / 8)) == sector)
        if not angles:
            continue
        a0, b0 = angles[0] - .26 / max(rx, ry), angles[-1] + .26 / max(rx, ry)
        for part in range(4):
            a, b = a0 + (b0 - a0) * part / 4, a0 + (b0 - a0) * (part + 1) / 4
            offset = len(vertices)
            for inner, outer, height in ((.12, .38, z), (-.12, .20, z + .32)):
                vertices += [((rx + r) * math.cos(t), (ry + r) * math.sin(t) - .0053705, height)
                             for r, t in ((inner, a), (outer, a), (outer, b), (inner, b))]
            faces += [tuple(offset + i for i in face) for face in quads]
append(ob, vertices, faces)

# Cutting the new openings also removes the old stair slabs and underside across each ramp.
def cut_box(ob, low, high):
    before = len(ob.data.polygons)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    inverse = ob.matrix_world.inverted()
    for axis in range(3):
        for bound in (low[axis], high[axis]):
            point = Vector((0, 0, 0)); point[axis] = bound
            normal = Vector((0, 0, 0)); normal[axis] = 1
            normal = ob.matrix_world.to_3x3().transposed() @ normal
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                  plane_co=inverse @ point, plane_no=normal, dist=1e-6)
    delete = [f for f in bm.faces if all(low[i] - 1e-5 <= (ob.matrix_world @ f.calc_center_median())[i] <= high[i] + 1e-5 for i in range(3))]
    bmesh.ops.delete(bm, geom=delete, context='FACES')
    commit(ob, bm)
    return before - len(ob.data.polygons)


for name in ('Walk_Tier0__concrete', 'Fix_TierRisers__concrete', 'Fix_TierSoffits__concrete',
             'Fix_TierFascia__concrete', 'Tier_ribbon__blue', 'Tier_ribbon_light__cyan'):
    for side in (-1, 1):
        low, high = sorted((side * 18.8, side * 51.2))
        cut_box(scene.objects[name], (-3.45, low, -11), (3.45, high, 2))

# The black wedges in the approved view are missing floor, confirmed by the source ray probe.
# Flat infill meets the concourse and the retained seat access without widening the central ramp.
for side in (-1, 1):
    polygon = [(-61, side * 3.388), (-61, side * 7.9), (-55.5, side * 5.2), (-55.5, side * 3.388)]
    append(scene.objects['Walk_Tier0__concrete'], [(x, y, z) for z in (-.2, 0) for x, y in polygon], quads)
vertices, faces = [], []
for side in (-1, 1):
    ya, yb = sorted((side * 3.388, side * 3.49))
    offset = len(vertices)
    vertices += [(x,y,z) for z in (0,.12) for x,y in ((-58.9,ya),(-55.5,ya),(-55.5,yb),(-58.9,yb))]
    faces += [tuple(offset + i for i in face) for face in quads]
make('Collide_EntryLowCurbs__concrete', 'concrete', vertices, faces)

# Copy the approved slope dimensions; each side lands beyond the circular stage radius.
for label, side in (('A', 1), ('B', -1)):
    vertices = [(-3.383, side * 51, -.2), (3.383, side * 51, -.2),
                (3.383, side * 19, -10.2), (-3.383, side * 19, -10.2),
                (-3.383, side * 51, 0), (3.383, side * 51, 0),
                (3.383, side * 19, -10), (-3.383, side * 19, -10)]
    ob = make(f'Walk_Ramp{label}__concrete', 'concrete', vertices, quads)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); commit(ob, bm)
    for source in ('Ramp_rail__silver', 'Ramp_posts__silver'):
        origin = scene.objects[source]
        copy = origin.copy(); copy.data = origin.data.copy()
        copy.name = f'Collide_Ramp{label}_{"rail" if "rail" in source else "posts"}__silver'
        copy.matrix_world = Matrix.Identity(4)
        for v in copy.data.vertices:
            p = origin.matrix_world @ v.co
            v.co = (p.y + .0053705, side * (-p.x - 10), p.z)
        scene.collection.objects.link(copy)
        modified.add(copy.name)

# Handrails and their mounts in the approved entrance stairs are removed as whole components.
for name in ('Aisle_handrails__silver', 'AudienceDetail_Aisle_supports', 'AudienceDetail_Aisle_mounts'):
    ob = scene.objects[name]
    def remove_rail(p):
        if p.z > 5:
            return False
        if abs(p.x) < 5.2 and 18 < abs(p.y) < 52:
            return True
        angle = math.atan2(p.y / (21 + max(0, (p.z + 9.9) / .43) * 1.08),
                           p.x / (31 + max(0, (p.z + 9.9) / .43) * 1.08)) % (2 * math.pi)
        return any(abs(angle - sector * math.pi / 8) < .04 for sector in (7, 9))
    prune(ob, remove_rail)

# Keep all upper spectator identities. Simplify their components in their own local frame.
crowd_counts = {}
for ob in list(scene.objects):
    if ob.type != 'MESH' or '_CM_PART' not in ob.data.attributes:
        continue
    mesh = ob.data
    names = ['_CM_ORIGIN', '_CM_RIGHT', '_CM_FRONT', '_CM_PART', '_CM_SIDE', '_CM_SEED', '_CM_STYLE']
    data = {}
    for name in names:
        width = 3 if name in names[:3] else 1
        values = np.empty((len(mesh.vertices), width), dtype=np.float32)
        mesh.attributes[name].data.foreach_get('vector' if width == 3 else 'value', values.ravel())
        data[name] = values
    components = collections.defaultdict(list)
    for poly in mesh.polygons:
        v = poly.vertices[0]
        key = (*data['_CM_ORIGIN'][v], int(round(data['_CM_PART'][v, 0])), int(round(data['_CM_SIDE'][v, 0])))
        components[key].append(poly.index)
    bm = bmesh.new(); bm.from_mesh(mesh); bm.verts.ensure_lookup_table()
    deletes = set(); replacements = []; identities = set()
    for key, indices in components.items():
        origin = Vector(key[:3]); part, side = key[3:]
        world = ob.matrix_world @ origin
        zone = clear_zone(world)
        upper = world.z > 5
        if not upper and not zone:
            continue
        polys = [mesh.polygons[i] for i in indices]
        ids = sorted({v for poly in polys for v in poly.vertices})
        deletes.update(ids)
        if zone:
            if part == 1:
                removed_people.append(dict(zone=zone, origin=list(world)))
            continue
        if part == 1:
            identities.add(tuple(key[:3]))
        if part == 5:
            continue
        index = ids[0]
        right, front = Vector(data['_CM_RIGHT'][index]), Vector(data['_CM_FRONT'][index])
        frame = Matrix((right, front, Vector((0, 0, 1)))).transposed()
        coords = np.array([tuple(frame.inverted() @ (mesh.vertices[i].co - origin)) for i in ids])
        lo, hi = coords.min(axis=0), coords.max(axis=0)
        center = (lo + hi) / 2; half = (hi - lo) / 2
        if part == 2:
            local = [center + half * np.array(v) for v in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1))]
            faces = [(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]
        elif part in (0, 1):
            local = [(x,y,z) for z in (lo[2],hi[2]) for x,y in ((lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1]))]
            faces = quads
        else:
            # A triangular prism keeps the seated limb/lightstick bounds with eight triangles.
            local = [(x,y,z) for z in (lo[2],hi[2]) for x,y in ((lo[0],lo[1]),(hi[0],lo[1]),(center[0],hi[1]))]
            faces = [(2,1,0),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]
        material = max(polys, key=lambda poly: poly.area).material_index
        uv = sum((mesh.uv_layers.active.data[li].uv for poly in polys for li in poly.loop_indices), Vector((0,0))) / sum(len(p.vertices) for p in polys) if mesh.uv_layers.active else Vector((0,0))
        replacements.append(([origin + frame @ Vector(p) for p in local], faces, index, material, uv))
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in deletes], context='VERTS')
    layers = {name: (bm.verts.layers.float_vector[name] if name in names[:3] else bm.verts.layers.float[name]) for name in names}
    added_faces = []
    for points, faces, index, material, uv in replacements:
        verts = [bm.verts.new(p) for p in points]
        for v in verts:
            for name, layer in layers.items():
                v[layer] = data[name][index] if name in names[:3] else float(data[name][index, 0])
        for face_indices in faces:
            face = bm.faces.new([verts[i] for i in face_indices]); face.material_index = material
            added_faces.append(face)
            for layer in bm.loops.layers.uv.values():
                for loop in face.loops:
                    loop[layer].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=added_faces)
    commit(ob, bm)
    crowd_counts[ob.name] = len(identities)
    print('T75_CROWD', ob.name, len(replacements), flush=True)

# Isolate upper portions before decimating: the lower geometry and its UVs are unchanged.
upper_static = ['Walk_Tier1__concrete', 'Fix_UpperWestTreads__concrete', 'Fix_TierRisers__concrete',
    'Fix_TierSoffits__concrete', 'Fix_TierFascia__concrete', 'Aisle_handrails__silver',
    'AudienceDetail_Aisle_supports', 'AudienceDetail_Aisle_mounts', 'AudienceDetail_Aisle_nosing',
    'AudienceDetail_Aisle_guides', 'AudienceDetail_Ribbon_chevrons', 'Aisle_step_lights__cyan',
    'Tier_ribbon__blue', 'Tier_ribbon_light__cyan', 'Suite_fascia__ivory']
upper_static += [o.name for o in scene.objects if o.type == 'MESH' and o.name.startswith('REF_RibbonProgram_1_')]
for name in upper_static:
    ob = scene.objects.get(name)
    if ob is None:
        continue
    upper = ob.copy(); upper.data = ob.data.copy(); scene.collection.objects.link(upper)
    prune(upper, lambda p: p.z <= 5)
    if not upper.data.polygons:
        bpy.data.objects.remove(upper, do_unlink=True)
        continue
    prune(ob, lambda p: p.z > 5)
    modifier = upper.modifiers.new('T75 upper reduction', 'DECIMATE'); modifier.ratio = .20
    modifier.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    reduced = bpy.data.meshes.new_from_object(upper.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.from_mesh(reduced); commit(ob, bm)
    bpy.data.objects.remove(upper, do_unlink=True); bpy.data.meshes.remove(reduced)
for ob in scene.objects:
    if ob.type == 'FONT' and ob.matrix_world.translation.z > 5 and ob.name.startswith(('Section_number', 'REF_RibbonBrand_1_')):
        ob.data = ob.data.copy(); ob.data.resolution_u = 1
        modified.add(ob.name)

# Restore the original twelve images and UVs from the owner's prepared v1 source.
logo_names = ['REF_WorldsCrest', 'REF_PedestalCrest'] + [f'REF_HeaderCrest_{i}' for i in range(4)]
logo_names += [f'REF_Jumbotron_{i}' for i in range(4)] + ['REF_DeskFace_-1', 'REF_DeskFace_1']
with bpy.data.libraries.load(str(ROOT / 'web-lightmaps/floor-fix/baked-export.blend'), link=False) as (source, target):
    assert set(logo_names) <= set(source.objects)
    target.objects = list(logo_names)
copied_images = set()
for name, original in zip(logo_names, target.objects):
    ob = scene.objects[name]
    assert len(ob.data.loops) == len(original.data.loops), name
    values = np.empty(len(ob.data.loops) * 2, dtype=np.float32)
    original.data.uv_layers.active.data.foreach_get('uv', values)
    ob.data.uv_layers.active.data.foreach_set('uv', values)
    ob.data.materials.clear()
    for material in original.data.materials:
        ob.data.materials.append(material)
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and node.image.name not in copied_images:
                image = node.image
                assert image.packed_file, image.name
                name_on_disk = 't75-' + ('worlds-crest-alpha' if image.name.startswith('WORLDS') else 'final-arena') + '.png'
                (ART / name_on_disk).write_bytes(image.packed_file.data)
                image.filepath = str(ART / name_on_disk)
                copied_images.add(image.name)
    bpy.data.objects.remove(original, do_unlink=True)
    modified.add(name)

exterior_names = ['EXR_Folded corten facade', 'EXR_Dark rainscreen backing', 'EXR_Panel slot lights',
    'EXR_Continuous glass belt', 'EXR_Belt vertical mullions', 'EXR_Belt light fixtures',
    'EXR_Canopy upper panels', 'EXR_Canopy soffit panels', 'EXR_Canopy fascia louvers',
    'EXR_Canopy fascia backing', 'EXR_Entrance glazing', 'EXR_Entrance mullions',
    'EXR_Entrance transoms', 'EXR_Front return glazing']
lod_pairs = []
for name in exterior_names:
    ob = scene.objects[name]
    copy = ob.copy(); copy.data = ob.data.copy(); copy.name = name + '__lod10'
    scene.collection.objects.link(copy)
    modifier = copy.modifiers.new('T75 exterior ten percent', 'DECIMATE')
    modifier.ratio = .10; modifier.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    reduced = bpy.data.meshes.new_from_object(copy.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    copy.modifiers.clear(); copy.data = reduced
    lod_pairs.append(dict(original=name, lod=copy.name))

report = dict(approval='msg_2da85b511072', modified=sorted(modified & set(scene.objects.keys())),
    removed_chairs=removed_chairs, removed_people=removed_people, upper_spectators_kept=crowd_counts,
    lod_pairs=lod_pairs, removed_nodes=sorted(original_names - set(scene.objects.keys())),
    added_nodes=sorted(set(scene.objects.keys()) - original_names), changes=changes,
    pending=['complete clearance check', 'lightmap bake/export'])
(OUT / 'geometry-changes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'barclays-arena-t75.blend'))
print('T75_MODEL_SAVED', json.dumps(dict(removed_chair_parts=len(removed_chairs), removed_spectators=len(removed_people),
      added_nodes=report['added_nodes'], pending=report['pending'])), flush=True)
