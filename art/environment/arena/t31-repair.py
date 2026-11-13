"""Repair only the approved arena copy; source objects remain except desk casework."""
import json
import math
import runpy
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
assert bpy.app.background
assert Path(bpy.data.filepath).resolve() == HERE / 'barclays-arena-v2.blend'
helpers = runpy.run_path(str(HERE / 't31-check.py'), run_name='t31_checks')
scene = helpers['SCENE']
assert 'T31_original_signatures' not in scene, 'Run once on a fresh source copy'
original = {o.name: helpers['digest'](o) for o in scene.objects}
scene['T31_original_signatures'] = json.dumps(original)
original_materials = sorted(m.name for m in bpy.data.materials)
batches = {}
matrix = scene.objects['Walk_Tier0__concrete'].matrix_world
quads = ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))


def add(name, material, vertices, faces, transform=None):
    vertices = [tuple(transform @ Vector(v)) for v in vertices] if transform is not None else vertices
    vs, fs, mat = batches.setdefault(name, ([], [], material))
    assert mat == material
    offset = len(vs)
    vs.extend(vertices)
    fs.extend(tuple(offset+i for i in face) for face in faces)


def box(name, material, lo, hi, transform=None):
    x,y,z = lo
    X,Y,Z = hi
    add(name, material, [(x,y,z),(X,y,z),(X,Y,z),(x,Y,z),(x,y,Z),(X,y,Z),(X,Y,Z),(x,Y,Z)], quads, transform)


def ring_piece(name, material, a, b, bottom, top, ends=(True,True)):
    # Each profile is (inner rx, inner ry, outer rx, outer ry, z).
    vs = []
    for profile in (bottom, top):
        ix,iy,ox,oy,z = profile
        vs.extend([(ix*math.cos(a),iy*math.sin(a),z),(ox*math.cos(a),oy*math.sin(a),z),
                   (ox*math.cos(b),oy*math.sin(b),z),(ix*math.cos(b),iy*math.sin(b),z)])
    faces = [f for i,f in enumerate(quads) if not (i == 2 and not ends[0]) and not (i == 4 and not ends[1])]
    add(name,material,vs,faces,matrix)


def finish(name):
    vs, fs, material = batches.pop(name)
    assert name not in bpy.data.objects
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(bpy.data.materials[material])
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


# Continuous bases stop at every radial aisle. Their inclined section contacts
# the pad above and the existing tread behind the pad's slight front overhang.
for tier, rx0, ry0, z0, rise, gap in ((0,31,21,-9.9,.43,.105),(1,61,46,6.2,.63,.045)):
    for row in range(23):
        rx,ry,z = rx0+row*1.08, ry0+row*1.08, z0+row*rise
        for sector in range(16):
            start, end = sector*math.pi/8+.022, (sector+1)*math.pi/8-.022
            if tier == 0 and sector == 7:
                end = math.pi-.11
            if tier == 0 and sector == 8:
                start = math.pi+.11
            # Four chords per seating block keep all bases within the tread.
            for part in range(4):
                a = start+(end-start)*part/4
                b = start+(end-start)*(part+1)/4
                ring_piece('Fix_SeatBases__steel','steel',a,b,
                           (rx+.12,ry+.12,rx+.38,ry+.38,z),
                           (rx-.12,ry-.12,rx+.20,ry+.20,z+.32), (part == 0,part == 3))

        for segment in range(256):
            a,b = 2*math.pi*segment/256, 2*math.pi*(segment+1)/256
            in_gap = abs((a+b)/2-math.pi) < gap
            if tier == 1 and in_gap:
                ring_piece('Fix_UpperWestTreads__concrete','concrete',a,b,
                           (rx-.02,ry-.02,rx+1.1,ry+1.1,z-.2),
                           (rx-.02,ry-.02,rx+1.1,ry+1.1,z), (segment == 126,segment == 129))
            if row and not (tier == 0 and in_gap):
                # shortcut: risers meet retained slabs; make solids if those slabs are ever removed.
                vs = [( (rx-.02)*math.cos(t), (ry-.02)*math.sin(t), height)
                      for height in (z-rise,z-.2) for t in (a,b)]
                add('Fix_TierRisers__concrete','concrete',vs,[(0,2,3,1)],matrix)

    inner, outer = -.02, 22*1.08+1.1
    zinner, zouter = z0-.2-rise-.06, z0+22*rise-.2-.06

    def underside(r):
        return zinner+(zouter-zinner)*(r-inner)/(outer-inner)

    for segment in range(256):
        a,b = 2*math.pi*segment/256, 2*math.pi*(segment+1)/256
        if tier == 0 and abs((a+b)/2-math.pi) < gap:
            continue
        vs = [( (rx0+r)*math.cos(t), (ry0+r)*math.sin(t), underside(r)+dz)
              for dz in (0,.04) for r,t in ((inner,a),(outer,a),(outer,b),(inner,b))]
        faces = [f for i,f in enumerate(quads) if i not in (2,4)
                 or (tier == 0 and ((i == 2 and segment == 132) or (i == 4 and segment == 123)))]
        add('Fix_TierSoffits__concrete','concrete',vs,faces,matrix)
        # Close the back rim between the underside skin and the last slab.
        vs = [((rx0+outer)*math.cos(t),(ry0+outer)*math.sin(t),height)
              for height in (zouter+.04,z0+22*rise-.2) for t in (a,b)]
        add('Fix_TierFascia__concrete','concrete',vs,[(0,1,3,2)],matrix)

    if tier == 0:
        # The existing western opening keeps its exact edges; sawtooth fascia
        # closes only the exposed stair section above the inclined soffit.
        for angle in (math.pi-4*2*math.pi/256, math.pi+4*2*math.pi/256):
            for row in range(23):
                r1,r2 = row*1.08-.02,row*1.08+1.1
                height = z0+row*rise-.2
                profile = [(r1,underside(r1)+.04),(r2,underside(r2)+.04),(r2,height),(r1,height)]
                vs = [((rx0+r)*math.cos(angle),(ry0+r)*math.sin(angle),h) for r,h in profile]
                face = (0,1,2,3) if angle < math.pi else (3,2,1,0)
                add('Fix_TierFascia__concrete','concrete',vs,[face],matrix)
                if row:
                    prev = (row-1)*1.08+1.1
                    profile = [(prev,underside(prev)+.04),(r1,underside(r1)+.04),
                               (r1,height),(prev,z0+(row-1)*rise-.2)]
                    vs = [((rx0+r)*math.cos(angle),(ry0+r)*math.sin(angle),h) for r,h in profile]
                    add('Fix_TierFascia__concrete','concrete',vs,[face],matrix)

# Ramp infill meets the original underside, terminates at arena floor, and
# occupies no space above the walkable slope or outside its existing width.
end = -61 + 9.8*32/10
vs = [(-61,-3.4,-10),(end,-3.4,-10),(-61,-3.4,-.2),
      (-61,3.4,-10),(end,3.4,-10),(-61,3.4,-.2)]
add('Collide_RampInfill__concrete','concrete',vs,[(0,2,1),(3,4,5),(0,1,4,3),(0,3,5,2),(2,5,4,1)],matrix)
for name in list(batches):
    finish(name)

# Keep the desk face/LED/artwork, PCs and monitors fixed. Shorten only the rear
# casework volume to make a continuous equipment bay behind the front fascia.
desk = scene.objects['REF_DeskBody__Obsidian']
desk.data = desk.data.copy()
for v in desk.data.vertices:
    if v.co.y > -.5:
        v.co.y = -.95
    if v.co.z < -8.79:
        v.co.z = -8.83
desk.data.update()
pc = scene.objects['REF_Reused_Player_PC__black']
for first in range(0,len(pc.data.vertices),8):
    points = [v.co for v in pc.data.vertices[first:first+8]]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    box('Fix_PCFeet__black','REF_Rubber',(lo[0],lo[1],-8.83),(hi[0],hi[1],lo[2]),pc.matrix_world)
finish('Fix_PCFeet__black')

# Columns stay between radial aisles, clear of the west route and shipped
# furniture, including collection instances. Candidate rejection is measured.
bpy.context.view_layer.update()
soffit = helpers['bvh'](scene.objects['Fix_TierSoffits__concrete'])
keep = set(json.loads((ROOT/'web-lightmaps/floor-fix/visible-objects.json').read_text()))
obstacles = []
graph = bpy.context.evaluated_depsgraph_get()
for inst in graph.object_instances:
    ob = inst.object
    owner = inst.parent.original.name if inst.is_instance and inst.parent else ob.original.name
    if owner not in keep or ob.type != 'MESH' or owner.startswith(('Walk_','Seats','Seat_', 'Audience_', 'REF_Player')):
        continue
    coords = [inst.matrix_world @ Vector(p) for p in ob.bound_box]
    lo = Vector([min(p[i] for p in coords) for i in range(3)])
    hi = Vector([max(p[i] for p in coords) for i in range(3)])
    obstacles.append((ob.original, inst.matrix_world.copy(), lo, hi))
obstacle_trees = {}
columns = []
rejections = []
for tier, radii, floor_name in ((0,((44,34),(42,32),(46,36)),'Walk_ArenaFloor__black'),
                               (1,((70,53),(76,59),(68,51)),'Walk_Concourse__concrete')):
    floor_tree = helpers['bvh'](scene.objects[floor_name])
    for sector in range(16):
        angle = (sector+.5)*math.pi/8
        if abs(angle-math.pi) < .2:
            continue
        for rx,ry in radii:
            center = matrix @ Vector((rx*math.cos(angle),ry*math.sin(angle),0))
            floor = helpers['hit'](floor_tree,(center.x,center.y,1),(0,0,-1),20)
            if floor is None:
                continue
            bottom = floor.z
            top = helpers['hit'](soffit,(center.x,center.y,bottom+.01),(0,0,1),25)
            if top is None or top.z-bottom < 1:
                continue
            blocked = None
            for index,(ob,transform,lo,hi) in enumerate(obstacles):
                if any((center[i]+.85 < lo[i] or center[i]-.85 > hi[i]) for i in (0,1)) or hi.z < bottom+.01 or lo.z > top.z:
                    continue
                if index not in obstacle_trees:
                    mesh = ob.evaluated_get(graph).data
                    obstacle_trees[index] = BVHTree.FromPolygons([transform@v.co for v in mesh.vertices],
                                                                  [tuple(p.vertices) for p in mesh.polygons])
                tree = obstacle_trees[index]
                for h in (.12,.6,1.2,1.8,2.3):
                    if any(helpers['hit'](tree,(center.x,center.y,bottom+h),d,1.15) is not None
                           for d in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0))):
                        blocked = ob.name
                        break
                if blocked:
                    break
            if blocked:
                rejections.append((tier,sector,rx,ry,blocked))
                continue
            xy = [(center.x-.3,center.y-.3),(center.x+.3,center.y-.3),
                  (center.x+.3,center.y+.3),(center.x-.3,center.y+.3)]
            heights = [helpers['hit'](soffit,(x,y,bottom+.01),(0,0,1),25).z for x,y in xy]
            vs = [(x,y,bottom) for x,y in xy]+[(x,y,h-.18) for (x,y),h in zip(xy,heights)]
            add('Collide_TierColumns__concrete','concrete',vs,quads)
            beam_xy = [(center.x-.6,center.y-.4),(center.x+.6,center.y-.4),
                       (center.x+.6,center.y+.4),(center.x-.6,center.y+.4)]
            beam_h = [helpers['hit'](soffit,(x,y,bottom+.01),(0,0,1),25).z for x,y in beam_xy]
            vs = [(x,y,h-.18) for (x,y),h in zip(beam_xy,beam_h)]+[(x,y,h) for (x,y),h in zip(beam_xy,beam_h)]
            add('Fix_TierBeams__concrete','concrete',vs,quads)
            columns.append(dict(tier=tier,sector=sector,center=[center.x,center.y],bottom=bottom,top=heights))
            break
    assert sum(c['tier']==tier for c in columns) >= 8, 'Too few unobstructed column locations'
finish('Collide_TierColumns__concrete')
finish('Fix_TierBeams__concrete')
scene['T31_columns'] = json.dumps(columns)
scene['T31_column_rejections'] = json.dumps(rejections)

moon_data = bpy.data.lights.new('EXR_MoonLight','SUN')
moon_data.energy = .012
moon_data.color = (.72,.82,1)
moon_data.angle = math.radians(1)
moon = bpy.data.objects.new('EXR_MoonLight',moon_data)
scene.collection.objects.link(moon)
moon.rotation_euler = Vector((-.7094,-.4096,.5736)).to_track_quat('Z','Y').to_euler()
for node in scene.world.node_tree.nodes:
    if node.type == 'BACKGROUND':
        node.inputs['Strength'].default_value = .009
review_sun = scene.objects.get('EXR_Review sun')
if review_sun:
    review_sun.hide_render = True
bpy.context.view_layer.update()

added = [o for o in scene.objects if o.name not in original]
triangles = 0
for ob in added:
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
assert triangles <= 5866000-5808498, triangles
assert original_materials == sorted(m.name for m in bpy.data.materials)
print('T31_ADDED',json.dumps(dict(triangles=triangles,objects=[o.name for o in added],
      columns=len(columns),rejections=rejections)),flush=True)
scene['T31_added_triangles'] = triangles
scene['T31_added_objects'] = json.dumps([o.name for o in added])
scene['T31_notes'] = 'Riser and fascia open edges meet retained slabs; preserve in T32 export. Re-bake is T32.'
assert helpers['check']()['ok']
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'barclays-arena-v2.blend'), check_existing=False)
print('T31_SAVED',str(HERE/'barclays-arena-v2.blend'),flush=True)
