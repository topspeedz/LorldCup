"""Additive interior detailing; run once against the backed-up live scene."""
import bpy, bmesh, ast, math, json
from pathlib import Path
from math import sin, cos, pi
from mathutils import Vector

ROOT = Path('D:/Blender/Blender/barclays-worlds-2026')
assert Path(bpy.data.filepath).resolve() == (ROOT/'barclays-worlds-2026.blend').resolve()
scene = bpy.data.scenes['Barclays • WORLDS 2026']
assert not bpy.data.collections.get('InteriorDetail_Stage')
original = {o.name: (tuple(o.matrix_world), len(o.data.vertices) if o.type=='MESH' else None)
            for o in scene.objects if not o.name.startswith('Audience')}
collection = bpy.data.collections.new('InteriorDetail_Stage')
scene.collection.children.link(collection)
batches = {}
# Reuse only the existing primitive builders, never execute the scene generator.
source = ast.parse((ROOT/'build_scene.py').read_text(encoding='utf-8'))
for node in source.body:
    if isinstance(node, ast.FunctionDef) and node.name in {'add','box','beam'}:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'existing-builders','exec'))

def arc(name, rx, ry, z, radius, material, count=128):
    for j in range(count):
        a=2*pi*j/count; b=2*pi*(j+1)/count
        beam(name,(rx*cos(a),ry*sin(a),z),(rx*cos(b),ry*sin(b),z),radius,material)

# Stage fascia hardware follows the existing five concentric steps exactly.
for r,z in [(16,-10),(15.5,-9.55),(15,-9.1),(14.5,-8.65),(14,-8.2)]:
    for j in range(64):
        t=2*pi*(j+.5)/64
        for zz in [z+.09,z+.32]:
            a=((r-.002)*cos(t),(r-.002)*sin(t),zz)
            b=((r+.012)*cos(t),(r+.012)*sin(t),zz)
            beam('Fascia_fasteners',a,b,.017,'silver',8)
        # Recess-looking inserts sit on the fascia, never over walk surfaces.
        if j%4==0:
            box('Fascia_service_frame',((r+.006)*cos(t),(r+.006)*sin(t),z+.22),(.42,.018,.17),'steel',t-pi/2)
            for q in range(5):
                d=(q-2)*.063
                box('Fascia_vent_slats',((r+.018)*cos(t)+d*sin(t),(r+.018)*sin(t)-d*cos(t),z+.22),(.018,.015,.12),'black',t-pi/2)
for j in range(64):
    t=2*pi*j/64
    beam('Deck_panel_joints',(11.55*cos(t),11.55*sin(t),-7.745),(13.94*cos(t),13.94*sin(t),-7.745),.003,'steel',4)

# Original ten player stations: detailed attachments, no changed placement/count.
for side in [-1,1]:
    for i in range(5):
        x=(i-2)*2.05; y=side*6.3
        front=y+side*.548
        for sign in [-1,1]:
            beam('Desk_corner_trim',(x+sign*.89,front,-7.62),(x+sign*.72,front,-6.96),.015,'silver',6)
            for zz in [-7.60,-7.00]:
                beam('Desk_panel_screws',(x+sign*.91,front,zz),(x+sign*.91,front+side*.014,zz),.014,'silver',8)
        box('Desk_lower_reveal',(x,front,-7.63),(1.76,.025,.035),'steel')
        box('Desk_underside_tray',(x,y,-6.96),(1.5,.36,.065),'steel')
        for dx in [-.65,.65]:
            beam('Desk_cable_drops',(x+dx,y,-7.05),(x+dx,y,-7.57),.014,'black',6)
        # Back vents, power button and bezel fasteners on the existing monitors.
        for q in range(11):
            box('Monitor_vents',(x+(q-5)*.057,y+side*.049,-6.30),(.026,.008,.15),'steel')
        for dx in [-.46,.46]:
            for zz in [-6.48,-5.98]:
                beam('Monitor_bezel_screws',(x+dx,y+side*.044,zz),(x+dx,y+side*.057,zz),.009,'silver',6)
        box('Monitor_status',(x+.40,y-side*.051,-6.49),(.025,.009,.008),'whiteLED')
        box('Monitor_foot',(x,y,-6.713),(.25,.22,.024),'steel')
        # Mouse and headsets sit beside the existing keyboards and mousepads.
        box('Mouse',(x+.62,y-side*.30,-6.675),(.063,.108,.045),'black')
        box('Mouse_split',(x+.62,y-side*.32,-6.651),(.003,.054,.003),'silver')
        beam('Mouse_lead',(x+.62,y-side*.245,-6.67),(x+.55,y-side*.10,-6.708),.003,'black',6)
        hx=x-.70; hy=y-side*.12
        for sign in [-1,1]:
            beam('Headset_cups',(hx+sign*.105,hy-.037,-6.67),(hx+sign*.105,hy+.037,-6.67),.05,'black',10)
            beam('Headset_accents',(hx+sign*.108,hy-.039,-6.67),(hx+sign*.108,hy-.043,-6.67),.033,'blue',10)
        for q in range(12):
            a=pi*q/12;b=pi*(q+1)/12
            beam('Headset_band',(hx+.105*cos(a),hy,-6.67+.12*sin(a)),(hx+.105*cos(b),hy,-6.67+.12*sin(b)),.009,'steel',6)
        # PC vent grills and corner rails retain the tower envelope.
        for q in range(12):
            box('PC_grille',(x+.65,y-side*.304,-7.52+q*.039),(.18,.010,.012),'steel')
        for dx in [-.106,.106]:
            box('PC_corner_rails',(x+.65+dx,y-side*.307,-7.25),(.012,.012,.69),'silver')
        # Chair bolsters, stitched seams and caster tires.
        cy=y-side*1.4
        for sign in [-1,1]:
            beam('Chair_bolsters',(x+sign*.265,cy-side*.083,-6.97),(x+sign*.265,cy-side*.083,-6.10),.044,'black',8)
            beam('Chair_piping',(x+sign*.215,cy-side*.13,-6.96),(x+sign*.215,cy-side*.13,-6.13),.007,'ivory',6)
        for k in range(5):
            t=2*pi*k/5;wx=x+.38*cos(t);wy=y-side*1.1+.38*sin(t)
            beam('Chair_casters',(wx-.035,wy,-7.672),(wx+.035,wy,-7.672),.052,'black',10)

# Suspended screen frame: perimeter panel reveals, fasteners and light graphics.
for side in range(4):
    t=side*pi/2; tangent=Vector((sin(t),-cos(t),0)); radial=Vector((cos(t),sin(t),0))
    def screen_point(u,z,r=10.568):
        return tuple(radial*r+tangent*u+Vector((0,0,z)))
    for u in [-10.16,10.16]:
        beam('Screen_corner_rails',screen_point(u,3.53),screen_point(u,14.08),.055,'silver',8)
        for z in [4,6,8,10,12,13.7]:
            beam('Screen_fasteners',screen_point(u,z),screen_point(u,z,10.59),.034,'silver',8)
    for u in range(-9,10,3):
        beam('Screen_header_reveals',screen_point(u,13.38),screen_point(u,13.86),.012,'black',4)
    # Restrict graphic shards to the panel edges; all original text stays visible.
    for sign in [-1,1]:
        for q in range(3):
            u=sign*(9.3-q*.32)
            beam('Screen_graphic_shards',screen_point(u,4.1),screen_point(u-sign*.95,7.0),.028 if q else .055,'cyan',4)
            beam('Screen_graphic_shards',screen_point(u,13.45),screen_point(u-sign*.65,11.7),.022,'ivory',4)
    for q in range(24):
        u=-9.3+q*.81
        box('Screen_lower_modules',screen_point(u,3.31,9.96),(.55,.35,.12),'black',t-pi/2)
        beam('Screen_downlight',screen_point(u,3.25,9.96),screen_point(u,3.22,9.96),.062,'whiteLED',8)

# Box truss around existing fixture ring and visible hanging attachment hardware.
for z in [22.72,23.28]:
    arc('Lighting_boxtruss_chords',27,23,z,.048,'silver',96)
for j in range(96):
    a=2*pi*j/96;b=2*pi*(j+1)/96
    beam('Lighting_boxtruss_diagonals',(27*cos(a),23*sin(a),22.72),(27*cos(b),23*sin(b),23.28),.028,'steel',6)
    beam('Lighting_boxtruss_uprights',(27*cos(a),23*sin(a),22.72),(27*cos(a),23*sin(a),23.28),.026,'silver',6)
for i in range(32):
    t=2*pi*i/32;x=27*cos(t);y=23*sin(t)
    for sign in [-1,1]:
        box('Fixture_yokes',(x+sign*.35*cos(t),y+sign*.35*sin(t),22.60),(.085,.16,.56),'steel',t)
    box('Fixture_clamps',(x,y,23.0),(.20,.22,.14),'black',t)
    beam('Fixture_safety_wire',(x,y,23.22),(x+.25,y,22.40),.009,'steel',6)
    if i%4==0:
        for j in range(6):
            sx=x*1.2;sy=y*1.2;z=19-j*.55
            for q in range(7):
                box('Speaker_grille',(sx,sy-.408,z-.18+q*.06),(.88,.016,.018),'steel')
            for dx in [-.45,.45]:
                box('Speaker_side_rails',(sx+dx,sy-.42,z),(.027,.025,.43),'silver')
        beam('Speaker_rigging',(x*1.2,y*1.2,19.35),(x,y,23),.035,'steel',8)
for x in [-10,10]:
    for y in [-10,10]:
        box('Screen_chain_hoists',(x,y,24.7),(.48,.44,.64),'black')
        for z in [15,17,19,21,23]:
            box('Screen_cable_clamps',(x,y,z),(.16,.16,.08),'silver')

report=[]
for (name,material),(verts,faces) in batches.items():
    full='InteriorDetail_'+name+'__'+material
    assert not bpy.data.objects.get(full)
    me=bpy.data.meshes.new(full);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    assert all(math.isfinite(c) for v in bm.verts for c in v.co)
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
    assert all(f.calc_area()>1e-12 for f in bm.faces)
    bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(full,me);collection.objects.link(ob)
    me.materials.append(bpy.data.materials[material]);me.calc_loop_triangles()
    report.append(dict(name=full,triangles=len(me.loop_triangles),material=material))
assert sum(r['triangles'] for r in report)<200000
(ROOT/'interior-detail/stage-report.json').write_text(json.dumps(dict(objects=report,total_triangles=sum(r['triangles'] for r in report),original_objects_edited=0),indent=2),encoding='utf-8')
print(json.dumps(dict(objects=len(report),triangles=sum(r['triangles'] for r in report))))
