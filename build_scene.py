"""Photo-proportioned Barclays / approved circular blue Worlds stage. Not survey geometry."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

ROOT=Path(r'D:/Blender/Blender/barclays-worlds-2026')
random.seed(26)
scene=bpy.data.scenes.new('Barclays • WORLDS 2026')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
mats={}; batches={}

def mat(name,color,metal=0,rough=.5,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1);mats[name]=m;return name

mat('concrete',(.22,.24,.27),rough=.85);mat('paving',(.36,.38,.40),rough=.9)
mat('asphalt',(.055,.065,.075),rough=.95);mat('steel',(.05,.06,.075),.72,.36)
mat('seat',(.035,.045,.055),.18,.45);mat('seat2',(.065,.08,.095),.15,.48)
mat('silver',(.45,.52,.60),.8,.25);mat('ivory',(.73,.78,.82),.28,.32)
mat('glass',(.035,.13,.19),.55,.17);mat('wood',(.32,.18,.08),rough=.6)
mat('black',(.009,.014,.025),.2,.44);mat('blue',(.008,.08,.45),.35,.3)
mat('cyan',(.035,.65,1),.25,.2,3);mat('whiteLED',(.75,.9,1),.1,.2,3)
mat('gold',(.6,.38,.08),.8,.22);mat('green',(.035,.16,.07),rough=.95)
for i in range(8):mat('corten'+str(i),(.17+i*.022,.052+i*.009,.021+i*.006),.6,.7)
for i,c in enumerate([(.035,.055,.09),(.1,.14,.22),(.19,.21,.24),(.055,.12,.2),(.26,.22,.20)]):mat('crowd'+str(i),c,rough=.8)
mat('skin',(.4,.24,.16),rough=.8)

def mesh(name,verts,faces,material):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.data.materials.append(mats[material]);return ob

def add(name,material,verts,faces):
    key=(name,material)
    v,f=batches.setdefault(key,([],[]));n=len(v);v.extend(verts);f.extend(tuple(n+j for j in face) for face in faces)

def box(name,loc,size,material,angle=0):
    x,y,z=loc;a,b,c=[v/2 for v in size];co,si=cos(angle),sin(angle)
    v=[(x+u*co-v*si,y+u*si+v*co,z+w) for u,v,w in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
    add(name,material,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def beam(name,a,b,r,material,n=6):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
    if u.length<.01:u=axis.cross(Vector((0,1,0)))
    u.normalize();w=axis.cross(u);v=[]
    for p in [a,b]:
        for j in range(n):v.append(tuple(p+r*(u*cos(2*pi*j/n)+w*sin(2*pi*j/n))))
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    add(name,material,v,f)

def ring(name,rx,ry,z,width,height,material,cx=0,cy=0,n=160,gap=0):
    wx,wy=width if isinstance(width,tuple) else (width,width)
    for i in range(n):
        t=2*pi*(i+.5)/n
        if gap and abs(t-pi)<gap:continue
        v=[]
        for zz in [z,z+height]:
            for a,b in [(rx,ry),(rx-wx,ry-wy)]:
                for tt in [2*pi*i/n,2*pi*(i+1)/n]:v.append((cx+a*cos(tt),cy+b*sin(tt),zz))
        add(name,material,v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])

def disk(name,rx,ry,z,material,cx=0,cy=0,n=120):
    v=[(cx,cy,z)]+[(cx+rx*cos(2*pi*i/n),cy+ry*sin(2*pi*i/n),z) for i in range(n)]
    add(name,material,v,[(0,i+1,(i+1)%n+1) for i in range(n)])

def text(name,body,loc,size,material,rot=(pi/2,0,0),align='CENTER'):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x=align;cu.align_y='CENTER';cu.extrude=.008;cu.resolution_u=3
    ob=bpy.data.objects.new(name,cu);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=rot;cu.materials.append(mats[material]);return ob

def light(name,loc,color,power,size=8):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;return ob

# Exterior plaza and sidewalk. Building entrance is on the negative X side.
box('Walk_Plaza',(-15,0,-.22),(330,240,.4),'paving')
box('Road',(-147,0,-.18),(16,240,.1),'asphalt')
for y in range(-100,101,10):box('Road_markings',(-147,y,-.115),(.15,4,.02),'ivory')
for y in range(-8,9,2):box('Crosswalk',(-147,y,-.1),(12,1,.02),'ivory')
for y in range(-104,105,4):box('Plaza_joints',(-20,y,-.011),(240,.025,.02),'concrete')
for x in range(-132,121,4):box('Plaza_joints',(x,0,-.01),(.025,208,.02),'concrete')
# Curtain-wall panels and mullions; open doorway faces west.
for i in range(240):
    t=2*pi*(i+.5)/240
    if abs(t-pi)<.095:continue
    p=(96*cos(t),73*sin(t),4.1);tangent=math.atan2(73*cos(t),-96*sin(t))
    box('Collide_CurtainWall',p,(2.05,.18,8.2),'glass',tangent)
    beam('Facade_mullions',(p[0],p[1],0),(p[0],p[1],8.3),.075,'silver')
for z in [2.6,5.2,8.2]:ring('Facade_mullions',96.15,73.15,z,.08,.08,'silver',gap=.095)
# Layered weathering-steel bands: individually staggered and varied panels.
for band in range(3):
    for row in range(5):
        for j in range(224):
            t=2*pi*(j+.5+(row%2)*.5)/224
            z=8.6+band*6.15+row*.84+1.5*sin(t+.6)+.7*cos(2*t)
            rx=98+2.3*sin(t*2+band*.8);ry=75+1.4*sin(t+band)
            x,y=rx*cos(t),ry*sin(t);a=math.atan2(ry*cos(t),-rx*sin(t))
            box('Corten_panels',(x,y,z),(2.2,.28,.7),'corten'+str(random.randrange(8)),a)
# Continuous inner shell, cut at glass entrance; green roof profile.
ring('Collide_Arena_shell',94,71,8.3,1.0,20.7,'black')
disk('Roof',95,72,30.0,'green')
for y in range(-65,66,4):
    half=94*math.sqrt(max(0,1-(y/72)**2));beam('Roof_seams',(-half,y,30.05),(half,y,30.05),.035,'steel')
# West oculus canopy: elliptical opening and flared asymmetric rim.
for i in range(128):
    t0=2*pi*i/128;t1=2*pi*(i+1)/128;v=[]
    for z in [10.2,15.3]:
        for rx,ry in [(30,28),(17,15)]:
            for t in [t0,t1]:v.append((-101+rx*cos(t),ry*sin(t),z+1.5*cos(t)))
    add('Oculus_corten','corten'+str(i%8),v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6)])
ring('Oculus_LED',17,15,10.6,.12,1.5,'cyan',cx=-101,n=128)
text('Barclays_sign','BARCLAYS CENTER',(-130.8,0,15.3),2.3,'cyan',(pi/2,0,-pi/2))
text('Entry_sign','WORLDS 2026  /  GRAND FINAL',(-96.4,0,7),.68,'whiteLED',(pi/2,0,-pi/2))
for side in [-1,1]:
    for y in [8,12,16]:
        beam('Bollards',(-117,side*y,0),(-117,side*y,.95),.12,'silver')
    for x in [-112,-125]:
        box('Plaza_bench',(x,side*23,.5),(5,1.1,.25),'wood')
        for dx in [-1.8,1.8]:box('Bench_legs',(x+dx,side*23,.23),(.15,.7,.5),'steel')
    beam('Flag_pole',(-122,side*34,0),(-122,side*34,11),.09,'silver')
    box('Event_flag',(-122,side*34,8),(0.09,2,5),'blue')
    text('Flag_text','WORLDS\n2026',(-122.07,side*34,8),.6,'whiteLED',(pi/2,0,-pi/2))
# Lower bowl is below plaza level; open concourse connects directly to atrium.
disk('Walk_ArenaFloor',59,45,-10,'black')
ring('Walk_Concourse',95,72,-.2,(39,26),.2,'concrete',gap=.1)
box('Walk_EntryBridge',(-63,0,-.1),(4,6.8,.2),'concrete')
box('Walk_Atrium',(-80,0,-.1),(32,25,.2),'concrete')
box('Atrium_ceiling',(-80,0,7.7),(31,26,.22),'wood')
for x in range(-92,-62,4):
    for y in [-10,10]:beam('Collide_LobbyColumns',(x,y,0),(x,y,7.5),.26,'steel',12)
    box('Lobby_stripLights',(x,0,7.5),(.12,22,.04),'whiteLED')
for y in [-9,-6,6,9]:
    box('Collide_TicketGate',(-91,y,.52),(1.7,.42,1.04),'silver')
    box('Gate_reader',(-91.3,y,1.08),(.35,.32,.08),'cyan')
text('Welcome','WELCOME TO THE FINAL',(-86,0,5.1),.7,'whiteLED',(pi/2,0,-pi/2))
# Ring concourse furniture, concession kiosks and wayfinding.
for i in range(20):
    t=2*pi*i/20
    if abs(t-pi)<.28:continue
    x,y=84*cos(t),62*sin(t);a=t+pi/2
    box('Collide_Concession',(x,y,1.5),(7,3,3),'wood',a)
    box('Kiosk_fascia',(x,y,3.3),(7.2,3.2,.45),'black',a)
    text('Concession_title','BROOKLYN  /  FOOD + DRINK',(x*.966,y*.966,3.4),.35,'whiteLED',(pi/2,0,t-pi/2))
    for offset in [-2,0,2]:
        px=x+offset*cos(a)-1.6*cos(t);py=y+offset*sin(a)-1.6*sin(t)
        box('Counter',(px,py,1.05),(1.8,1.1,.15),'silver',a)
        box('Menu_board',(px+1.5*cos(t),py+1.5*sin(t),2.5),(1.5,.08,.8),'blue',a)
    for rad in [74,90]:beam('Collide_Columns',(rad*cos(t),rad*.76*sin(t),0),(rad*cos(t),rad*.76*sin(t),7),.3,'concrete',10)
# Main accessible sloped entry; clear opening through lower seating.
v=[(-61,-3.4,0),(-61,3.4,0),(-29,3.4,-10),(-29,-3.4,-10)]
add('Walk_EntryRamp','concrete',v,[(0,3,2,1)])
for side in [-1,1]:
    beam('Ramp_rail',(-61,side*3.4,1.1),(-29,side*3.4,-8.9),.055,'silver')
    for j in range(17):
        x=-61+j*2;z=-(x+61)*10/32
        beam('Ramp_posts',(x,side*3.4,z),(x,side*3.4,z+1.1),.035,'silver')
text('Portal_sign','101   /   ARENA FLOOR',(-61.5,0,4),.65,'whiteLED',(pi/2,0,-pi/2))
box('Portal_header',(-61,0,4.4),(1,9,1),'black')
# Tier geometry and thousands of individually shaped seats, batched by material.
seats=0;people=0
for tier,rows,rx0,ry0,z0,rise in [(0,23,31,21,-9.9,.43),(1,23,61,46,6.2,.63)]:
    for row in range(rows):
        rx=rx0+row*1.08;ry=ry0+row*1.08;z=z0+row*rise
        ring('Walk_Tier'+str(tier),rx+1.1,ry+1.1,z-.2,1.12,.2,'concrete',n=256,gap=.105 if tier==0 else .045)
        count=int(2*pi*math.sqrt((rx*rx+ry*ry)/2)/.68)
        for j in range(count):
            t=2*pi*(j+.5)/count
            # Radial aisles every 22.5 degrees, plus the main western entry.
            if min((t%(pi/8)),pi/8-t%(pi/8))<.022:continue
            if tier==0 and abs(t-pi)<.11:continue
            x,y=rx*cos(t),ry*sin(t);a=t-pi/2
            box('Seats',(x,y,z+.39),(.49,.46,.14),'seat' if j%4 else 'seat2',a)
            box('Seats',(x+.22*cos(t),y+.22*sin(t),z+.76),(.49,.12,.64),'seat',a)
            for s in [-1,1]:
                ax=x+s*.28*cos(a);ay=y+s*.28*sin(a)
                box('Seat_armrests',(ax,ay,z+.61),(.05,.46,.055),'steel',a)
            seats+=1
            if random.random()<.64:
                # Low-poly spectators retain seat spacing and clear circulation aisles.
                cm='crowd'+str(random.randrange(5))
                box('Audience_torsos',(x,y,z+.79),(.36,.28,.53),cm,a)
                beam('Audience_heads',(x,y,z+1.08),(x,y,z+1.28),.115,'skin' if j%4==0 else cm,6)
                people+=1
        if row%5==0:
            for sector in range(16):
                t=sector*pi/8
                x,y=(rx+.1)*cos(t),(ry+.1)*sin(t)
                box('Aisle_step_lights',(x,y,z+.025),(.75,.09,.035),'cyan',t)
    # Aisle handrails, concourse edge, continuous ribbon LED.
    outerx=rx0+(rows-1)*1.08;outery=ry0+(rows-1)*1.08
    ring('Tier_ribbon',outerx+1.1,outery+1.1,z0+rows*rise,.15,.58,'blue')
    ring('Tier_ribbon_light',outerx+1.2,outery+1.2,z0+rows*rise+.55,.07,.06,'cyan')
    for sector in range(16):
        t=sector*pi/8
        if tier==0 and sector==8:continue
        for row in range(0,rows-2,3):
            r1=row*1.08;r2=(row+3)*1.08
            beam('Aisle_handrails',((rx0+r1)*cos(t),(ry0+r1)*sin(t),z0+row*rise+1),((rx0+r2)*cos(t),(ry0+r2)*sin(t),z0+(row+3)*rise+1),.04,'silver')
    for sector in range(16):
        t=(sector+.5)*pi/8
        text('Section_number',str(101+tier*100+sector),((outerx+1)*cos(t),(outery+1)*sin(t),z0+rows*rise+1.6),.7,'whiteLED',(pi/2,0,t-pi/2))
# Suites between bowls: dark glazing, piers, fascia.
ring('Suites_floor',62,47,1,6,.3,'concrete')
for i in range(80):
    t=2*pi*(i+.5)/80
    if abs(t-pi)<.12:continue
    x,y=61*cos(t),46*sin(t);a=math.atan2(46*cos(t),-61*sin(t))
    box('Suite_windows',(x,y,3.7),(3.8,.15,3.6),'glass',a)
    beam('Suite_piers',(x,y,1),(x,y,6),.12,'ivory')
ring('Suite_fascia',61.5,46.5,5.7,.35,.65,'ivory')
# Roof truss grid, upper catwalk, hanging hardware.
for x in range(-78,79,9):
    extent=67*math.sqrt(max(0,1-(x/91)**2))
    for z in [26.4,29.0]:beam('Roof_truss_chords',(x,-extent,z),(x,extent,z),.13,'steel')
    steps=max(2,int(extent/3))
    for k in range(steps*2):
        y=-extent+k*extent/steps;yy=y+extent/steps
        beam('Roof_truss_web',(x,y,26.4),(x,yy,29),.075,'silver')
        beam('Roof_truss_web',(x,y,29),(x,yy,26.4),.075,'steel')
for y in range(-56,57,8):
    extent=87*math.sqrt(max(0,1-(y/70)**2));beam('Roof_lateral',(-extent,y,28),(extent,y,28),.12,'steel')
ring('Catwalk',78,58,25.5,1.1,.12,'steel')
# Approved blue/white concentric circular stage.
for r,z,h,ma in [(16,-10,.45,'black'),(15.5,-9.55,.45,'ivory'),(15,-9.1,.45,'blue'),(14.5,-8.65,.45,'ivory'),(14,-8.2,.45,'blue')]:
    ring('Stage_steps',r,r,z,r,h,ma,n=128)
    ring('Stage_LED',r+.02,r+.02,z+h-.06,.08,.06,'cyan',n=128)
disk('Walk_Stage',14,14,-7.75,'ivory')
disk('Stage_inlay',11.5,11.5,-7.73,'blue')
for a in range(0,360,30):
    t=math.radians(a);beam('Stage_radials',(4*cos(t),4*sin(t),-7.71),(11*cos(t),11*sin(t),-7.71),.035,'whiteLED')
# Two five-player desk arcs. Detailed monitors, keyboards, mousepads and chairs.
for team,side in enumerate([-1,1]):
    for i in range(5):
        x=(i-2)*2.05;y=side*6.3
        box('Player_desks',(x,y,-6.8),(1.95,1.1,.15),'ivory')
        box('Desk_fronts',(x,y+side*.48,-7.22),(1.95,.12,.9),'blue')
        box('Desk_trim',(x,y+side*.55,-6.91),(1.9,.04,.06),'cyan')
        for dx in [-.8,.8]:box('Desk_legs',(x+dx,y,-7.25),(.09,.7,.9),'steel')
        box('Monitor_housing',(x,y,-6.23),(1.0,.09,.58),'black')
        box('Monitor_pixels',(x,y-side*.052,-6.23),(.94,.015,.51),'cyan')
        beam('Monitor_stand',(x,y,-6.75),(x,y,-6.45),.045,'steel')
        box('Keyboard',(x,y-side*.35,-6.69),(.55,.18,.035),'black')
        for key in range(12):box('Keyboard_keys',(x-.24+key*.044,y-side*.35,-6.666),(.025,.12,.012),'silver')
        box('Mousepad',(x+.62,y-side*.3,-6.71),(.32,.3,.015),'black')
        box('Player_PC',(x+.65,y,-7.25),(.25,.6,.75),'black')
        box('PC_LED',(x+.79,y,-7.23),(.02,.4,.5),'cyan')
        box('Player_chair',(x,y-side*1.1,-7.12),(.65,.62,.16),'black')
        box('Player_chair_back',(x,y-side*1.4,-6.52),(.65,.15,1.1),'blue')
        beam('Chair_pedestal',(x,y-side*1.1,-7.7),(x,y-side*1.1,-7.15),.07,'silver')
        for k in range(5):
            t=2*pi*k/5;beam('Chair_base',(x,y-side*1.1,-7.65),(x+.38*cos(t),y-side*1.1+.38*sin(t),-7.65),.035,'steel')
    text('Team_desk','WORLDS 2026', (0,side*6.87,-7.15),.55,'whiteLED',(pi/2,0,0 if side<0 else pi))
# Four-sided suspended display, structural cage and cable drops.
for side in range(4):
    t=side*pi/2;x=10.2*cos(t);y=10.2*sin(t);a=t-pi/2
    box('Screen_frame',(x,y,8.8),(20.7,.6,11),'steel',a)
    box('Screen_panel',(x+.32*cos(t),y+.32*sin(t),8.8),(19.8,.08,10.2),'blue',a)
    rot=(pi/2,0,t+pi/2)
    text('Screen_WORLDS','WORLDS',(x+.4*cos(t),y+.4*sin(t),10.5),2.15,'whiteLED',rot)
    text('Screen_2026','2026',(x+.42*cos(t),y+.42*sin(t),7.6),2.6,'whiteLED',rot)
    text('Screen_FINAL','GRAND FINAL  /  LEAGUE OF LEGENDS',(x+.43*cos(t),y+.43*sin(t),5.15),.46,'cyan',rot)
    for z in [3.5,14.1]:box('Screen_edge',(x,y,z),(20.6,.75,.11),'cyan',a)
for x in [-10,10]:
    for y in [-10,10]:
        beam('Screen_suspension',(x,y,14),(x,y,28),.055,'steel')
        for z in range(15,28,2):beam('Screen_cage',(x,y,z),(x-1 if x>0 else x+1,y,z+2),.04,'silver')
ring('Screen_lower_ring',10.5,10.5,2.9,.2,.2,'whiteLED',n=96)
# Stage lights and hanging line arrays. Beam lines stay inside arena.
for i in range(32):
    t=2*pi*i/32;x,y=27*cos(t),23*sin(t)
    beam('Lighting_truss',(x,y,23),(27*cos(t+.16),23*sin(t+.16),23),.12,'silver')
    box('Moving_head_lights',(x,y,22.5),(.6,.7,.8),'black',t)
    beam('Fixture_lens',(x,y,22.1),(x,y,21.95),.22,'cyan',12)
    if i%4==0:
        for j in range(6):box('Hanging_speakers',(x*1.2,y*1.2,19-j*.55),(1,.8,.48),'black',t)
for side in [-1,1]:
    for x in [-40,-20,0,20,40]:light('Blue_arena_light',(x,side*27,20),(.14,.35,1),2600,14)
for x in [-12,0,12]:light('Stage_key',(x,0,20),(.75,.88,1),4400,10)
for x in [-90,-75]:light('Lobby_light',(x,0,7.2),(1,.8,.6),700,10)
light('Plaza_key',(-110,-30,60),(1,.88,.72),55000,60)
world=bpy.data.worlds.new('Evening');world.use_nodes=True
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.11,.16,.25,1)
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.5;scene.world=world
# Flush material batches, preserving named walking and collision surfaces.
for (name,ma),(v,f) in batches.items():mesh(name+'__'+ma,v,f,ma)
def camera(name,loc,target,lens=25):
    d=bpy.data.cameras.new(name);d.lens=lens;d.clip_end=600;ob=bpy.data.objects.new(name,d);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
outside=camera('01_Exterior',(-155,-56,24),(-70,0,11),26)
inside=camera('02_Interior',(-49,-28,10),(0,0,5),21)
entry=camera('03_Entry',(-119,0,1.7),(-80,0,3),22)
scene.camera=outside;scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=70
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene['reference_note']='Photo-proportioned Barclays Center with user-approved circular blue stage; not a measured building or verified 2026 final.'
scene['seat_count']=seats;scene['spectator_count']=people
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.clip_end=700
assert seats>10000 and people>6000,(seats,people)
assert any(o.name.startswith('Walk_EntryRamp') for o in scene.objects)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-worlds-2026.blend'))
report={'objects':len(scene.objects),'seats':seats,'spectators':people,'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH')}
(ROOT/'build-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
