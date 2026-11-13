"""Geometric regressions for T06, evaluated without modifying the loaded blend."""
import hashlib
import json
import math
import re
import struct
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
SCENE = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = SCENE
assert bpy.app.background


def digest(ob):
    h = hashlib.sha256()
    h.update(np.asarray(ob.matrix_world, dtype=np.float64).tobytes())
    if ob.type == 'MESH':
        for sequence, field, size, dtype in ((ob.data.vertices, 'co', 3, np.float32),
                    (ob.data.loops, 'vertex_index', 1, np.int32),
                    (ob.data.polygons, 'material_index', 1, np.int32)):
            values = np.empty(len(sequence) * size, dtype=dtype)
            sequence.foreach_get(field, values)
            h.update(values.tobytes())
        for attr in ob.data.attributes:
            if attr.name.startswith(('cm_', '_CM_', '_LIGHTMAP')):
                field, size = ('vector', 3) if attr.data_type == 'FLOAT_VECTOR' else ('value', 1)
                values = np.empty(len(attr.data) * size, dtype=np.float32)
                attr.data.foreach_get(field, values)
                h.update(attr.name.encode())
                h.update(values.tobytes())
        h.update(json.dumps([m.name if m else None for m in ob.data.materials]).encode())
    return h.hexdigest()


def bvh(ob, evaluated=False):
    if evaluated:
        ob = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return BVHTree.FromPolygons([ob.matrix_world @ v.co for v in ob.data.vertices],
                               [tuple(p.vertices) for p in ob.data.polygons])


def hit(tree, point, direction, length):
    return tree.ray_cast(Vector(point), Vector(direction), length)[0] if tree else None


def check():
    results = {}
    trees = {name: bvh(SCENE.objects[name]) if name in SCENE.objects else None for name in (
        'Fix_SeatBases__steel', 'Fix_UpperWestTreads__concrete', 'Fix_TierRisers__concrete',
        'Fix_TierSoffits__concrete', 'Collide_RampInfill__concrete', 'Fix_PCFeet__black')}
    pads = failures = missing_tread = 0
    for name in ('Seats__seat', 'Seats__seat2'):
        ob = SCENE.objects[name]
        for first in range(0, len(ob.data.vertices), 8):
            points = [ob.matrix_world @ v.co for v in ob.data.vertices[first:first+8]]
            lo, hi = min(p.z for p in points), max(p.z for p in points)
            if not .13 < hi-lo < .15:
                continue
            pads += 1
            center = sum(points, Vector()) / 8
            samples = [center.lerp(p, amount) for p in points[:4] for amount in (0, .45, .85)]
            contacts = [hit(trees['Fix_SeatBases__steel'], (p.x, p.y, lo+.01), (0,0,-1), .03) for p in samples]
            failures += not any(p is not None for p in contacts)
            if center.x < -60 and abs(center.y) < 3.1:
                tread = hit(trees['Fix_UpperWestTreads__concrete'], (center.x,center.y,lo), (0,0,-1), .34)
                # Only the 116 seats over the original cut require the new bridge.
                original = hit(bvh_tier1, (center.x,center.y,lo), (0,0,-1), .34)
                if original is None:
                    missing_tread += tread is None
    results['seat_contact'] = dict(pads=pads, unsupported=failures, west_missing=missing_tread,
                                   ok=pads == 19384 and failures == 0 and missing_tread == 0)
    base = SCENE.objects.get('Fix_SeatBases__steel')
    base_samples = base_misses = 0
    floors = [bvh(SCENE.objects[n]) for n in ('Walk_Tier0__concrete','Walk_Tier1__concrete')]
    floors.append(trees['Fix_UpperWestTreads__concrete'])
    if base:
        for face in base.data.polygons:
            if face.normal.z > -.9:
                continue
            points = [base.matrix_world @ base.data.vertices[i].co for i in face.vertices]
            center = sum(points,Vector())/len(points)
            for p in [center] + [center.lerp(v,.8) for v in points]:
                base_samples += 1
                base_misses += not any(hit(tree,(p.x,p.y,p.z+.005),(0,0,-1),.015) is not None for tree in floors)
    results['base_grounding'] = dict(samples=base_samples, misses=base_misses, ok=base_samples>0 and base_misses == 0)

    riser_misses = tested = 0
    for tier, rx0, ry0, z0, rise, gap in ((0,31,21,-9.9,.43,.105),(1,61,46,6.2,.63,.045)):
        matrix = SCENE.objects[f'Walk_Tier{tier}__concrete'].matrix_world
        for row in range(1,23):
            for segment in range(256):
                angle = 2*math.pi*(segment+.5)/256
                if abs(angle-math.pi) < gap:
                    continue
                # A horizontal probe through the former 0.23/0.43 m slit.
                c, s = math.cos(angle), math.sin(angle)
                p = matrix @ Vector(((rx0+row*1.08-.5)*c,(ry0+row*1.08-.5)*s,z0+row*rise-(rise+.2)/2))
                direction = matrix.to_3x3() @ Vector((c,s,0))
                tested += 1
                riser_misses += hit(trees['Fix_TierRisers__concrete'], p, direction, .7) is None
    results['riser_slits'] = dict(samples=tested, misses=riser_misses, ok=riser_misses == 0)

    ramp_hits = [hit(trees['Collide_RampInfill__concrete'], (-50,y,-6), (0,dy,0), 5)
                 for y,dy in ((-6,1),(6,-1))]
    results['ramp_sides'] = dict(ok=all(p is not None for p in ramp_hits))
    columns = SCENE.objects.get('Collide_TierColumns__concrete')
    beams = SCENE.objects.get('Fix_TierBeams__concrete')
    column_contacts = column_misses = 0
    if columns and beams:
        beam_tree = bvh(beams)
        ground = [bvh(SCENE.objects[n]) for n in ('Walk_ArenaFloor__black','Walk_Concourse__concrete')]
        for face in columns.data.polygons:
            if abs(face.normal.z) < .8:
                continue
            p = columns.matrix_world @ face.center
            column_contacts += 1
            if face.normal.z < 0:
                column_misses += not any(hit(tree,(p.x,p.y,p.z+.005),(0,0,-1),.015) is not None for tree in ground)
            else:
                column_misses += hit(beam_tree,(p.x,p.y,p.z-.01),(0,0,1),.025) is None
    results['column_grounding'] = dict(contacts=column_contacts, misses=column_misses, ok=column_contacts == 56 and column_misses == 0)
    if beams:
        beam_misses = 0
        for face in beams.data.polygons:
            if face.normal.z < .8:
                continue
            p = beams.matrix_world @ face.center
            beam_misses += hit(trees['Fix_TierSoffits__concrete'], (p.x,p.y,p.z-.01),(0,0,1),.03) is None
        results['beam_contact'] = dict(misses=beam_misses, ok=beam_misses == 0)
    if columns:
        keep = set(json.loads((ROOT/'web-lightmaps/floor-fix/visible-objects.json').read_text()))
        furniture = []
        graph = bpy.context.evaluated_depsgraph_get()
        for inst in graph.object_instances:
            ob = inst.object
            owner = inst.parent.original.name if inst.is_instance and inst.parent else ob.original.name
            if owner not in keep or ob.type != 'MESH' or not re.match(r'CCR_|Collide_(Columns|Concession)|REF_(Reused|DeskBody|Player|Backstage)',owner):
                continue
            points = [inst.matrix_world @ Vector(p) for p in ob.bound_box]
            lo = [min(p[i] for p in points) for i in range(3)]
            hi = [max(p[i] for p in points) for i in range(3)]
            furniture.append((ob.original,inst.matrix_world.copy(),lo,hi))
        intersections = []
        cache = {}
        for ob in (columns,beams):
            if not ob:
                continue
            for first in range(0,len(ob.data.vertices),8):
                vertices = [ob.matrix_world@v.co for v in ob.data.vertices[first:first+8]]
                lo = [min(p[i] for p in vertices) for i in range(3)]
                hi = [max(p[i] for p in vertices) for i in range(3)]
                faces = [tuple(i-first for i in face.vertices) for face in ob.data.polygons
                         if all(first <= i < first+8 for i in face.vertices)]
                tree = BVHTree.FromPolygons(vertices,faces)
                for index,(item,transform,a,b) in enumerate(furniture):
                    if any(hi[i] <= a[i]+1e-4 or lo[i] >= b[i]-1e-4 for i in range(3)):
                        continue
                    if index not in cache:
                        mesh = item.evaluated_get(graph).data
                        cache[index] = BVHTree.FromPolygons([transform@v.co for v in mesh.vertices],
                                                           [tuple(p.vertices) for p in mesh.polygons])
                    if tree.overlap(cache[index]):
                        intersections.append((ob.name,first//8,item.name))
        results['column_furniture'] = dict(furniture_instances=len(furniture), intersections=intersections,
                                          ok=len(furniture)>0 and not intersections)
    # The route stays open above its existing walkable surface.
    new = [bvh(o) for o in SCENE.objects if o.type == 'MESH' and o.name.startswith(('Fix_', 'Collide_Tier', 'Collide_Ramp'))]
    blocked = 0
    for x in (-90,-80,-70,-61,-55,-45,-35):
        floor = 0 if x <= -61 else -(x+61)*10/32
        for y in (-2.5,0,2.5):
            blocked += any(hit(tree, (x,y,floor+.05), (0,0,1), 2.2) is not None for tree in new)
    results['western_route'] = dict(blocked=blocked, ok=blocked == 0)

    desk = SCENE.objects['REF_DeskBody__Obsidian']
    pc = SCENE.objects['REF_Reused_Player_PC__black']
    intersection = len(bvh(desk, True).overlap(bvh(pc, True)))
    unsupported_pc = 0
    for first in range(0,len(pc.data.vertices),8):
        points = [pc.matrix_world @ v.co for v in pc.data.vertices[first:first+8]]
        center = sum(points,Vector())/8
        z = min(p.z for p in points)
        unsupported_pc += hit(trees['Fix_PCFeet__black'], (center.x,center.y,z+.01),(0,0,-1),.02) is None
    desk_bottom = min((desk.matrix_world @ v.co).z for v in desk.data.vertices)
    results['equipment'] = dict(evaluated_surface_intersections=intersection, unsupported_pc=unsupported_pc,
                               desk_bottom=desk_bottom, ok=intersection == 0 and unsupported_pc == 0 and abs(desk_bottom+8.83)<1e-4)
    moon = SCENE.objects.get('EXR_MoonLight')
    direction = moon.rotation_euler.to_quaternion() @ Vector((0,0,1)) if moon else Vector()
    background = [n.inputs['Strength'].default_value for n in SCENE.world.node_tree.nodes if n.type == 'BACKGROUND']
    results['moon'] = dict(direction=list(direction), energy=moon.data.energy if moon else None, background=background,
        color=list(moon.data.color) if moon else None, angle_degrees=math.degrees(moon.data.angle) if moon else None,
        ok=moon is not None and (direction-Vector((-.7094,-.4096,.5736)).normalized()).length<1e-5
           and abs(moon.data.energy-.012)<1e-7 and all(abs(v-.009)<1e-7 for v in background)
           and all(abs(x-y)<1e-6 for x,y in zip(moon.data.color,(.72,.82,1)))
           and abs(math.degrees(moon.data.angle)-1)<1e-6)
    if 'T31_original_signatures' in SCENE:
        signatures = json.loads(SCENE['T31_original_signatures'])
        lost = sorted(set(signatures)-set(SCENE.objects.keys()))
        changed = [name for name in signatures if name in SCENE.objects and name != desk.name
                   and digest(SCENE.objects[name]) != signatures[name]]
        results['preserved'] = dict(original_objects=len(signatures), lost=lost, unexpectedly_changed=changed,
                                    ok=not lost and not changed)
        with (ROOT/'web/arena.glb').open('rb') as handle:
            header = handle.read(20)
            gltf = json.loads(handle.read(struct.unpack_from('<I',header,12)[0]))
        names = {n.get('name','') for n in gltf['nodes']}
        groups = {}
        for prefix in ('REF_Jumbotron_', 'REF_Reused_Monitor_pixels__cyan', 'REF_Player',
                       'Walk_', 'Collide_', 'Audience_', 'REF_FanLightsticks'):
            expected = sorted(n for n in names if n.startswith(prefix))
            groups[prefix] = dict(v1_count=len(expected), missing=[n for n in expected if n not in SCENE.objects])
        crowd = [o for o in SCENE.objects if o.type == 'MESH' and o.data.attributes.get('cm_part')]
        results['runtime_names'] = dict(groups=groups, crowd_attribute_objects=len(crowd),
            ok=all(not g['missing'] for g in groups.values()) and len(crowd)==14)
        topology = []
        for name in json.loads(SCENE['T31_added_objects']):
            ob = SCENE.objects[name]
            if ob.type != 'MESH':
                continue
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            open_edges = sum(not edge.is_manifold for edge in bm.edges)
            zero_faces = sum(face.calc_area()<1e-10 for face in bm.faces)
            finite = all(math.isfinite(c) for v in bm.verts for c in v.co)
            # These surfaces deliberately meet the preserved stair slabs.
            open_allowed = name in ('Fix_TierRisers__concrete','Fix_TierFascia__concrete')
            topology.append(dict(name=name, boundary_edges=open_edges, zero_area_faces=zero_faces,
                                 finite=finite, ok=finite and zero_faces == 0 and (open_allowed or open_edges == 0)))
            bm.free()
        results['new_topology'] = dict(objects=topology, ok=all(t['ok'] for t in topology))
    results['ok'] = all(item['ok'] for item in results.values())
    print('T31_CHECK', json.dumps(results), flush=True)
    return results


bvh_tier1 = bvh(SCENE.objects['Walk_Tier1__concrete'])
if __name__ == '__main__':
    assert check()['ok'], 'T31 geometric acceptance failed'
