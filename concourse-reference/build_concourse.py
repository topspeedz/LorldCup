"""One-time, reference-matched concourse pass. Run in the existing arena file."""
import bpy, bmesh, math, random, json, hashlib, array
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

ROOT = Path('D:/Blender/Blender/barclays-worlds-2026/concourse-reference')
scene = bpy.data.scenes['Barclays • WORLDS 2026']
assert bpy.data.filepath.replace('\\', '/').endswith('/barclays-worlds-2026.blend')
assert 'CCR_Concourse' not in bpy.data.collections, 'One-time production pass already applied'
rng = random.Random(20261112)

def signature(ob):
    h = hashlib.sha256(str((ob.type, tuple(tuple(r) for r in ob.matrix_world), ob.hide_render)).encode())
    if ob.type == 'MESH':
        data = array.array('f', [0]) * (len(ob.data.vertices) * 3)
        ob.data.vertices.foreach_get('co', data); h.update(data.tobytes())
        h.update(str((len(ob.data.polygons), [m.name if m else None for m in ob.data.materials])).encode())
    if ob.animation_data and ob.animation_data.action:
        h.update(ob.animation_data.action.name.encode())
    return h.hexdigest()

replace_prefix = ('Collide_Concession__', 'Kiosk_fascia__', 'Counter__', 'Menu_board__', 'Concession_title')
replace = [o for o in scene.objects if o.name.startswith(replace_prefix) and not all(c.hide_render for c in o.users_collection)]
finish_names = ['Walk_Concourse__concrete', 'Walk_Atrium__concrete', 'Walk_EntryBridge__concrete',
                'Collide_Columns__concrete', 'Collide_LobbyColumns__steel', 'Atrium_ceiling__wood']
changed_names = {o.name for o in replace} | set(finish_names)
baseline = {o.name: signature(o) for o in bpy.data.objects if o.name not in changed_names}
(ROOT / 'preserved-before.json').write_text(json.dumps(baseline), encoding='utf-8')
(ROOT / 'replaced-before.json').write_text(json.dumps([o.name for o in replace], indent=2), encoding='utf-8')

col = bpy.data.collections.new('CCR_Concourse')
for s in [scene, bpy.data.scenes['Exterior Reference Review']]: s.collection.children.link(col)
archive = bpy.data.collections.new('CCR_PreviousConcessions')
scene.collection.children.link(archive); archive.hide_render = True; archive.hide_viewport = True
for ob in replace:
    for c in list(ob.users_collection): c.objects.unlink(ob)
    archive.objects.link(ob)
row = bpy.data.collections.new('CCR_SharedFourBayRow')
row.use_fake_user = True
mats = []
atlas = bpy.data.images.load(str(ROOT / 'finish-menu-atlas.png'), check_existing=True)
atlas.pack()

def mat(name, color, rough=.45, metal=0, emission=0):
    m = bpy.data.materials.new('CCR_' + name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    p.inputs['Emission Color'].default_value = (*color, 1); p.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = (*color, 1); m['target'] = 'Desktop Blender visualization'
    mats.append(m); return len(mats)-1

def atlas_material(name, offset, rough, tile=None, emission=0):
    idx = mat(name, (.3, .2, .12), rough)
    m = mats[idx]; ns = m.node_tree.nodes; lk = m.node_tree.links
    p = next(n for n in ns if n.type == 'BSDF_PRINCIPLED')
    uv = ns.new('ShaderNodeTexCoord'); src = uv.outputs['UV']
    if tile:
        n = ns.new('ShaderNodeVectorMath'); n.operation = 'MULTIPLY'; n.inputs[1].default_value = (*tile, 1)
        lk.new(src, n.inputs[0]); f = ns.new('ShaderNodeVectorMath'); f.operation = 'FRACTION'
        lk.new(n.outputs['Vector'], f.inputs[0]); src = f.outputs['Vector']
    n = ns.new('ShaderNodeVectorMath'); n.operation = 'MULTIPLY'; n.inputs[1].default_value = (.494, .494, 1)
    lk.new(src, n.inputs[0]); a = ns.new('ShaderNodeVectorMath'); a.operation = 'ADD'
    a.inputs[1].default_value = (offset[0]+.003, offset[1]+.003, 0); lk.new(n.outputs['Vector'], a.inputs[0])
    im = ns.new('ShaderNodeTexImage'); im.image = atlas; lk.new(a.outputs['Vector'], im.inputs['Vector'])
    lk.new(im.outputs['Color'], p.inputs['Base Color'])
    if emission:
        lk.new(im.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = emission
    else:
        b = ns.new('ShaderNodeBump'); b.inputs['Strength'].default_value = .16; b.inputs['Distance'].default_value = .0015
        lk.new(im.outputs['Color'], b.inputs['Height']); lk.new(b.outputs['Normal'], p.inputs['Normal'])
    return idx

wood = atlas_material('Warm vertical timber grain', (0, .5), .42, (.32, .33))
stone = atlas_material('Charcoal veined counter stone', (.5, .5), .27, (.5, .6))
coffee_menu = atlas_material('Coffee menu image', (0, 0), .5, emission=.35)
snack_menu = atlas_material('Snack menu image', (.5, 0), .5, emission=.35)
black = mat('Soft black powdercoat', (.012, .014, .014), .33, .35)
recess = mat('Timber shadow joints', (.025, .014, .008), .83)
bronze = mat('Brushed champagne trim', (.3, .19, .075), .29, .8)
steel = mat('Brushed stainless equipment', (.41, .43, .43), .24, .88)
white = mat('Warm ivory lettering and cups', (.85, .82, .72), .32)
sign = mat('Soft illuminated sign', (.9, .85, .7), .36, emission=.5)
warm = mat('3000K strip diffuser', (1, .69, .36), .4, emission=3.5)
ceiling_mat = mat('Warm charcoal ceiling', (.032, .027, .021), .85)
leather = mat('Olive upholstered banquette', (.16, .17, .065), .58)
tan = mat('Golden baked pastry', (.56, .25, .055), .42)
popcorn_mat = mat('Butter popcorn', (.85, .65, .29), .65)
red = mat('Snack packet red', (.58, .025, .014), .36)
yellow = mat('Snack packet yellow', (.9, .48, .015), .36)
blue = mat('Snack packet blue', (.01, .12, .42), .36)
green = mat('Lounge plant leaf', (.045, .12, .024), .65)
coffee_liquid = mat('Espresso', (.028, .009, .003), .18)
glass = mat('Clear display glass', (.7, .85, .82), .09)
gm = mats[glass]; ns = gm.node_tree.nodes; lk = gm.node_tree.links
p = next(n for n in ns if n.type == 'BSDF_PRINCIPLED'); p.inputs['IOR'].default_value = 1.45
tr = ns.new('ShaderNodeBsdfTransparent'); mix = ns.new('ShaderNodeMixShader'); mix.inputs[0].default_value = .10
lk.new(tr.outputs[0], mix.inputs[1]); lk.new(p.outputs[0], mix.inputs[2])
lk.new(mix.outputs[0], next(n for n in ns if n.type == 'OUTPUT_MATERIAL').inputs['Surface'])

floor = mat('Charcoal stone floor with 1200mm joints', (.095, .09, .078), .31)
fm = mats[floor]; ns = fm.node_tree.nodes; lk = fm.node_tree.links
p = next(n for n in ns if n.type == 'BSDF_PRINCIPLED')
tc = ns.new('ShaderNodeTexCoord'); brick = ns.new('ShaderNodeTexBrick')
brick.inputs['Scale'].default_value = 1
brick.inputs['Brick Width'].default_value = 1.2; brick.inputs['Row Height'].default_value = .6
brick.inputs['Mortar Size'].default_value = .003; brick.offset = .5; brick.offset_frequency = 2
brick.inputs['Color1'].default_value = (.105, .10, .089, 1)
brick.inputs['Color2'].default_value = (.067, .065, .058, 1)
brick.inputs['Mortar'].default_value = (.025, .023, .02, 1)
lk.new(tc.outputs['Object'], brick.inputs['Vector'])
noise = ns.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 17; noise.inputs['Detail'].default_value = 4
lk.new(tc.outputs['Object'], noise.inputs['Vector'])
mixc = ns.new('ShaderNodeMixRGB'); mixc.blend_type = 'MULTIPLY'; mixc.inputs[0].default_value = .24
lk.new(brick.outputs['Color'], mixc.inputs[1]); lk.new(noise.outputs['Color'], mixc.inputs[2]); lk.new(mixc.outputs[0], p.inputs['Base Color'])
bump = ns.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .17; bump.inputs['Distance'].default_value = .008
lk.new(brick.outputs['Fac'], bump.inputs['Height']); lk.new(bump.outputs['Normal'], p.inputs['Normal'])

batches = {}
cube_faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]

def add(group, verts, faces, mi, smooth=False, screen=False):
    vs, fs, ms, uvs, sm = batches.setdefault(group, ([],[],[],[],[])); base = len(vs)
    vs.extend(verts)
    for face in faces:
        fs.append(tuple(base+i for i in face)); ms.append(mi); sm.append(smooth and len(face)==4)
        normal = (Vector(verts[face[1]])-Vector(verts[face[0]])).cross(Vector(verts[face[2]])-Vector(verts[face[0]]))
        axis = max(range(3), key=lambda i: abs(normal[i]))
        coords = (1,2) if axis==0 else (0,2) if axis==1 else (0,1)
        uv = [(verts[i][coords[0]], verts[i][coords[1]]) for i in face]
        if screen: uv = [(0,0),(1,0),(1,1),(0,1)]
        uvs.append(uv)

def box(group, loc, size, mi, angle=0):
    x,y,z=loc; a,b,c=[v/2 for v in size]; co,si=cos(angle),sin(angle)
    verts=[(x+u*co-v*si,y+u*si+v*co,z+w) for u,v,w in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
    add(group, verts, cube_faces, mi)

def beam(group, start, end, radius, mi, sides=12, end_radius=None):
    a,b=Vector(start),Vector(end); axis=(b-a).normalized(); u=axis.cross(Vector((0,0,1)))
    if u.length < .01: u=axis.cross(Vector((0,1,0)))
    u.normalize(); v=axis.cross(u); verts=[]
    for point,r in [(a,radius),(b,radius if end_radius is None else end_radius)]:
        verts.extend(tuple(point+r*(u*cos(2*pi*j/sides)+v*sin(2*pi*j/sides))) for j in range(sides))
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(j,(j+1)%sides,(j+1)%sides+sides,j+sides) for j in range(sides)]
    add(group,verts,faces,mi,True)

def ellipsoid(group, loc, radius, mi, sides=10, rings=6):
    x,y,z=loc; rx,ry,rz=radius; verts=[(x,y,z-rz)]
    for j in range(1,rings):
        p=-pi/2+pi*j/rings
        verts.extend((x+rx*cos(p)*cos(2*pi*k/sides),y+ry*cos(p)*sin(2*pi*k/sides),z+rz*sin(p)) for k in range(sides))
    verts.append((x,y,z+rz)); top=len(verts)-1
    faces=[(0,1+(k+1)%sides,1+k) for k in range(sides)]
    for j in range(rings-2):
        a=1+j*sides; b=a+sides
        faces.extend((a+k,a+(k+1)%sides,b+(k+1)%sides,b+k) for k in range(sides))
    faces.extend((top,1+(rings-2)*sides+k,1+(rings-2)*sides+(k+1)%sides) for k in range(sides))
    add(group,verts,faces,mi,True)

font=bpy.data.fonts.load('C:/Windows/Fonts/bahnschrift.ttf', check_existing=True)
def text(body, loc, size, mi=sign, group='Signage'):
    cu=bpy.data.curves.new('CCR_'+body,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.002;cu.bevel_depth=.0006;cu.resolution_u=2;cu.font=font
    ob=bpy.data.objects.new('CCR_'+group+' '+body,cu);row.objects.link(ob);ob.location=loc;ob.rotation_euler=(pi/2,0,0);cu.materials.append(mats[mi])
    return ob

def area(name, loc, target, power, size, size_y, color=(1,.74,.49)):
    d=bpy.data.lights.new('CCR_'+name,'AREA');d.shape='RECTANGLE';d.energy=power;d.color=color;d.size=size;d.size_y=size_y
    ob=bpy.data.objects.new(d.name,d);row.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob

def cup(x,y,z,scale=1):
    r=.036*scale; h=.09*scale
    beam('Counter accessories',(x,y,z),(x,y,z+h),r*.77,white,14,r)
    beam('Counter accessories',(x,y,z+h),(x,y,z+h+.004),r*1.07,white,14)
    beam('Counter accessories',(x,y,z+h+.004),(x,y,z+h+.005),r*.86,coffee_liquid,14)

# Architectural construction: solid returns, physical slats and a ceiling over the customer aisle.
box('Wall backing',(0,2.61,2.1),(15.2,.18,4.2),recess)
for k in range(190):
    x=-7.56+k*.08
    box('Vertical timber slats',(x,2.49,2.1),(.065,.08,4.2),wood)
    box('Vertical timber slats',(x,.1,3.78),(.065,.08,.84),wood)
for x in [-7.6,-3.8,0,3.8,7.6]:
    box('Solid wall returns',(x,1.28,2.1),(.13,2.7,4.2),recess)
    for k in range(33):
        y=.02+k*.08
        for side in [-1,1]: box('Vertical timber slats',(x+side*.075,y,2.1),(.035,.065,4.2),wood)
box('Ceiling',(0,-1.75,4.29),(15.36,8.9,.18),ceiling_mat)
box('Ceiling edge trim',(0,-6.18,4.23),(15.36,.09,.13),black)
for x in [-6,-2,2,6]:
    box('Ceiling light housings',(x,-1.65,4.187),(.11,8.1,.055),black)
    box('Ceiling light diffusers',(x,-1.65,4.155),(.065,8.0,.018),warm)
for x in [-7.3,-3.65,0,3.65,7.3]:
    beam('Black cylindrical columns',(x,-5.65,.02),(x,-5.65,4.2),.155,black,24)
    beam('Column collars',(x,-5.65,.02),(x,-5.65,.08),.168,black,24)
for x in [-3.8,3.8]:
    area('Ceiling soft wash',(x,-2.5,4.09),(x,-2.5,0),580,6.7,5.4)

centers=[-5.7,-1.9,1.9,5.7]
for x,label in zip(centers,['LOUNGE','DRINKS','COFFEE','SNACKS']):
    box('Black sign fascia',(x,-.015,3.08),(3.66,.22,.45),black)
    box('Sign bronze lower edge',(x,-.135,2.855),(3.66,.016,.025),bronze)
    text(label,(x,-.135,3.075),.29)
    box('Under fascia strip',(x,.07,2.825),(3.46,.045,.022),warm)
    area(label+' display wash',(x,.05,2.77),(x,.5,.8),65,3.3,.28)
    if label in ['COFFEE','SNACKS']:
        box('Counter plinth',(x,.46,.12),(3.5,1.06,.2),black)
        box('Veined stone counters',(x,.44,.61),(3.52,1.08,.87),stone)
        box('Counter bronze foot trim',(x,-.113,.145),(3.53,.018,.022),bronze)
        box('Counter worktops',(x,.41,1.077),(3.62,1.17,.075),stone)
        box('Counter toe light',(x,-.106,.18),(3.46,.024,.026),warm)
        box('Counter upper light',(x,-.108,1.025),(3.48,.02,.018),warm)
        box('Rear service cabinet',(x,2.18,.55),(3.4,.58,1.1),black)
        box('Rear prep counter',(x,2.16,1.125),(3.48,.65,.05),steel)
        for dx in [-1.1,0,1.1]: box('Cabinet seams',(x+dx,1.882,.56),(.012,.01,.96),steel)
        # A real image-mapped display: square artwork, with side accessory shelving.
        box('Menu monitor frames',(x,2.32,2.12),(1.34,.13,1.10),black)
        w,h=1.27,1.03
        add('Menu images',[(x-w/2,2.245,2.12-h/2),(x+w/2,2.245,2.12-h/2),(x+w/2,2.245,2.12+h/2),(x-w/2,2.245,2.12+h/2)],[(0,1,2,3)],coffee_menu if label=='COFFEE' else snack_menu,screen=True)
        area(label+' toe wash',(x,-.18,.20),(x,-1.7,0),18,3.25,.08)
    # Round standing tables sit along the storefront edge, clear of the through aisle.
    if label!='LOUNGE':
        tx=x+1.28;ty=-1.03
        beam('Standing table feet',(tx,ty,.035),(tx,ty,.075),.27,black,24)
        beam('Standing table pedestals',(tx,ty,.07),(tx,ty,1.04),.045,black,16)
        beam('Standing table tops',(tx,ty,1.04),(tx,ty,1.09),.37,wood,32)

# Coffee machine, grinder, reusable cups and a three-shelf pastry display.
x=1.9
box('Espresso machines',(x-.78,.48,1.36),(1.02,.56,.49),steel)
box('Espresso black panel',(x-.78,.185,1.40),(.93,.035,.27),black)
box('Espresso drip tray',(x-.78,.035,1.13),(1.05,.37,.055),steel)
for dx in [-.26,0,.26]:
    beam('Coffee group heads',(x-.78+dx,.12,1.39),(x-.78+dx,.12,1.32),.047,steel,12)
    beam('Portafilter handles',(x-.78+dx,.05,1.33),(x-.78+dx,-.08,1.33),.018,black,10)
    beam('Espresso buttons',(x-.78+dx,.161,1.48),(x-.78+dx,.147,1.48),.017,sign,10)
    cup(x-.78+dx,.01,1.16)
for dx in [-.41,.4]:
    beam('Steam wands',(x-.78+dx,.13,1.36),(x-.78+dx,.02,1.23),.011,steel,10)
for j in range(6): cup(x-1.15+j*.14,.47,1.61,.9)
box('Coffee grinder base',(x-.03,.55,1.24),(.26,.32,.29),black)
beam('Coffee grinder hopper',(x-.03,.55,1.39),(x-.03,.55,1.68),.075,glass,16,.12)
beam('Coffee grinder beans',(x-.03,.55,1.43),(x-.03,.55,1.62),.07,coffee_liquid,14,.10)
beam('Coffee grinder lid',(x-.03,.55,1.68),(x-.03,.55,1.7),.125,black,16)

def display_case(cx, width, pastry=True):
    y=.37
    box('Display case frames',(cx,y,1.15),(width,.72,.07),steel)
    for z in [1.19,1.4,1.62]:
        box('Display shelves',(cx,y,z),(width-.07,.64,.018),steel)
        for dx in [-.3,0,.3]:
            if pastry:
                for k in range(5):
                    a=(k-2)*.4
                    ellipsoid('Pastries',(cx+dx+a*.07,y+.025*abs(k-2),z+.045),(.055,.08-.01*abs(k-2),.039),tan,8,4)
            else:
                ellipsoid('Hot dog buns',(cx+dx,y,z+.04),(.105,.05,.035),tan,10,4)
                ellipsoid('Hot dog sausages',(cx+dx,y,z+.064),(.105,.024,.021),red,10,4)
                for k in range(5):
                    beam('Mustard',(cx+dx-.07+k*.03,y-.012*(-1)**k,z+.084),(cx+dx-.04+k*.03,y+.012*(-1)**k,z+.084),.004,yellow,6)
    for dx in [-width/2,width/2]:
        for yy in [.01,.73]: beam('Display case frames',(cx+dx,yy,1.16),(cx+dx,yy,1.82),.014,steel,10)
        box('Display glass',(cx+dx,y,1.49),(.008,.72,.64),glass)
    box('Display glass',(cx,.005,1.49),(width,.008,.64),glass)
    box('Display glass',(cx,y,1.82),(width,.72,.008),glass)
    box('Display warm strip',(cx,.67,1.79),(width-.04,.025,.018),warm)

display_case(x+.89,1.0,True)
for k in range(7): cup(x-1.45,1.98,1.16+k*.024,.9)
for j in range(4):
    beam('Coffee syrups',(x+.8+j*.18,2.09,1.15),(x+.8+j*.18,2.09,1.41),.045,tan,12)
    beam('Syrup pumps',(x+.8+j*.18,2.09,1.4),(x+.8+j*.18,2.09,1.48),.012,black,8)

# Popcorn machine, hot dog warmer and tiered packaged snacks.
x=5.7;px=x-1.1;py=.37
box('Popcorn base',(px,py,1.15),(.76,.75,.09),steel)
box('Popcorn canopy',(px,py,2.0),(.82,.79,.15),steel)
for dx in [-.36,.36]:
    for dy in [-.34,.34]: beam('Popcorn frame',(px+dx,py+dy,1.19),(px+dx,py+dy,1.94),.014,steel,10)
    box('Popcorn glass',(px+dx,py,1.57),(.007,.7,.73),glass)
box('Popcorn glass',(px,.022,1.57),(.72,.007,.73),glass)
beam('Popcorn kettle',(px,py,1.66),(px,py,1.82),.18,steel,16)
beam('Popcorn kettle shaft',(px,py,1.81),(px,py,1.94),.018,steel,10)
box('Popcorn lamp',(px,py,1.915),(.45,.12,.018),warm)
for k in range(185):
    xx=rng.uniform(-.32,.32); yy=rng.uniform(-.3,.3); zz=1.21+rng.uniform(0,.13)*(1-.5*abs(xx)/.32)
    ellipsoid('Popcorn kernels',(px+xx,py+yy,zz),(.027,.024,.025),popcorn_mat,6,3)
display_case(x-.1,.87,False)
for level in range(3):
    z=1.18+level*.205; y=.25+level*.13
    box('Snack rack shelves',(x+1.12,y,z),(.75,.31,.025),black)
    beam('Snack rack front lips',(x+.75,y-.16,z+.045),(x+1.49,y-.16,z+.045),.011,steel,10)
    for j in range(5):
        xx=x+.82+j*.145
        box('Snack packets',(xx,y+.025,z+.1),(.125,.065,.175),[red,yellow,blue][(j+level)%3],.06*(-1)**j)
        box('Snack packet label',(xx,y-.012,z+.11),(.092,.004,.04),white)
        box('Snack packet crimp',(xx,y+.025,z+.185),(.125,.07,.012),bronze)
for k in range(6): cup(x-.56,.7,1.12+k*.026,1)

# Three glazed drink refrigerators with shelves, bottles, labels and door hardware.
x=-1.9
for dx in [-1.05,0,1.05]:
    fx=x+dx
    box('Drink refrigerator bodies',(fx,2.34,1.22),(.96,.04,2.39),black)
    for side in [-1,1]: box('Drink refrigerator bodies',(fx+side*.46,1.78,1.22),(.04,1.15,2.39),black)
    for z in [.045,2.395]: box('Drink refrigerator bodies',(fx,1.78,z),(.96,1.15,.04),black)
    box('Refrigerator bright inner back',(fx,2.27,1.26),(.83,.018,2.13),steel)
    box('Refrigerator interior opening',(fx,2.25,1.25),(.84,.03,2.1),recess)
    for z in [.36,.76,1.16,1.56,1.96]:
        box('Refrigerator shelves',(fx,1.43,z),(.85,.57,.022),steel)
        for j in range(6):
            bx=fx-.34+j*.137
            beam('Drink bottles',(bx,1.35,z+.018),(bx,1.35,z+.235),.043,[green,blue,red][j%3],10,.035)
            beam('Bottle necks',(bx,1.35,z+.23),(bx,1.35,z+.29),.018,[green,blue,red][j%3],10)
            beam('Bottle caps',(bx,1.35,z+.288),(bx,1.35,z+.31),.021,steel,10)
            beam('Bottle wrap labels',(bx,1.35,z+.07),(bx,1.35,z+.17),.044,white,10)
    # Shelving and bottles sit in front of the dark backing; glazing is the frontmost surface.
    box('Refrigerator door glass',(fx,1.075,1.25),(.83,.009,2.14),glass)
    for xx in [-.45,.45]: box('Fridge door frame',(fx+xx,1.06,1.25),(.035,.045,2.22),steel)
    for zz in [.14,2.36]: box('Fridge door frame',(fx,1.06,zz),(.92,.045,.035),steel)
    beam('Fridge door handles',(fx+.33,1.0,.95),(fx+.33,1.0,1.5),.014,steel,10)
    box('Fridge light strips',(fx-.39,1.10,1.27),(.018,.02,2.04),warm)
    box('Fridge vent',(fx,1.075,.08),(.75,.018,.08),steel)

# Upholstered lounge, small round tables, pendant shades and two planters.
x=-5.7
box('Banquette base',(x,1.92,.26),(3.38,1.0,.42),black)
box('Banquette seat cushion',(x,1.80,.53),(3.29,.83,.17),leather)
box('Banquette back cushion',(x,2.30,1.03),(3.29,.2,.96),leather)
for j in range(18): box('Upholstery vertical channels',(x-1.57+j*.185,2.183,1.02),(.018,.024,.91),recess)
for dx in [-.94,.94]:
    tx=x+dx;ty=.7
    beam('Lounge table feet',(tx,ty,.02),(tx,ty,.055),.26,black,24)
    beam('Lounge table stems',(tx,ty,.055),(tx,ty,.69),.038,black,12)
    beam('Lounge table tops',(tx,ty,.69),(tx,ty,.74),.40,wood,28)
    for sy in [-.15,.15]:
        sx=tx+.2; yy=-.1+sy
        beam('Lounge stool legs',(sx-.14,yy,.02),(sx-.1,yy,.43),.018,black,10)
        beam('Lounge stool legs',(sx+.14,yy,.02),(sx+.1,yy,.43),.018,black,10)
    beam('Lounge stool cushions',(tx+.2,-.1,.43),(tx+.2,-.1,.51),.24,leather,24)
for dx in [-1,0,1]:
    beam('Pendant cords',(x+dx,1.25,3.65),(x+dx,1.25,4.18),.007,black,6)
    beam('Pendant shades',(x+dx,1.25,3.41),(x+dx,1.25,3.67),.37,bronze,4,.045)
    beam('Pendant glowing faces',(x+dx,1.25,3.405),(x+dx,1.25,3.413),.34,warm,4)
for px in [x-1.48,x+1.48]:
    beam('Planter pots',(px,.35,.03),(px,.35,.42),.14,stone,16,.20)
    for j in range(12):
        a=j*2.4; h=.46+rng.uniform(.22,.8); ex=px+cos(a)*.26;ey=.35+sin(a)*.24
        beam('Plant stems',(px,.35,.4),(ex,ey,h),.008,green,6)
        ellipsoid('Plant leaves',(ex,ey,h),(.055,.11,.025),green,8,4)

for group,(verts,faces,indices,uvs,smooth) in batches.items():
    name='CCR_'+group; me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);row.objects.link(ob)
    used=sorted(set(indices)); remap={mi:i for i,mi in enumerate(used)}
    for mi in used:me.materials.append(mats[mi])
    uv=me.uv_layers.new(name='Surface metres and atlas UV')
    for p,mi,coords,sm in zip(me.polygons,indices,uvs,smooth):
        p.material_index=remap[mi];p.use_smooth=sm
        for li,co in zip(p.loop_indices,coords):uv.data[li].uv=co
    if group in ['Veined stone counters','Counter worktops','Standing table tops','Espresso machines','Banquette seat cushion','Banquette back cushion','Black sign fascia']:
        bevel=ob.modifiers.new('Small manufactured edge radius','BEVEL');bevel.width=.009 if 'Banquette' not in group else .035;bevel.segments=3
    ob['reference_pass']='Concourse coffee and snack corners'

# The two rows adjacent to the west entry keep the original narrow footprint.
# Their compact coffee/snack pair leaves the new entry-side galleries clear.
compact=bpy.data.collections.new('CCR_EntryAdjacentTwoBayRow');compact.use_fake_user=True
for source in row.objects:
    if source.type=='MESH':
        bm=bmesh.new();bm.from_mesh(source.data)
        for point,normal in [((0,0,0),(1,0,0)),((0,-.5,0),(0,1,0))]:
            result=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=point,plane_no=normal,clear_inner=True,dist=.00001)
            edges=[e for e in result['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
            if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
        if not bm.faces:bm.free();continue
        for v in bm.verts:v.co.x-=3.8
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        me=source.data.copy();bm.to_mesh(me);bm.free();me.update()
        ob=source.copy();ob.data=me;ob.name=source.name+'_Compact';compact.objects.link(ob)
    elif source.location.x>0:
        ob=source.copy();ob.data=source.data.copy();ob.name=source.name+'_Compact';compact.objects.link(ob);ob.location.x-=3.8
        if ob.type=='LIGHT' and 'Ceiling soft wash' in ob.name:
            ob.location.y=.5;ob.data.energy=220;ob.data.size=7;ob.data.size_y=2.5

instances=[]
for i in range(20):
    if i==10:continue
    t=2*pi*i/20
    ob=bpy.data.objects.new('CCR_Row_%02d'%i,None);col.objects.link(ob);ob.instance_type='COLLECTION';ob.instance_collection=compact if i in [9,11] else row
    ob.location=(82.5*cos(t),(62*.9950264096260071-1.5)*sin(t)-.005370497703552246,0)
    ob.rotation_euler.z=t-pi/2;ob['existing_concession_sector']=i
    instances.append(ob)
for side in [-1,1]:
    ob=bpy.data.objects.new('CCR_MainEntry_'+('North' if side>0 else 'South'),None);col.objects.link(ob);ob.instance_type='COLLECTION';ob.instance_collection=row
    ob.location=(-79,side*12,0);ob.rotation_euler.z=0 if side>0 else pi;instances.append(ob)

# Isolate material edits to existing circulation objects; no shared shader mutation.
for name in finish_names:
    ob=bpy.data.objects[name];ob.data=ob.data.copy()
    ob.data.materials.clear();ob.data.materials.append(mats[floor if name.startswith('Walk_') else ceiling_mat if name.startswith('Atrium_') else black])

def camera(name,loc,target,lens):
    data=bpy.data.cameras.new('CCR_'+name);data.lens=lens;data.clip_start=.05;data.clip_end=600
    ob=bpy.data.objects.new(data.name,data);col.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob

cameras=[camera('OriginalView',(-67.6,6.3,1.7),(-80.5,11.2,1.9),23),
         camera('ReverseView',(-89.3,6.4,1.7),(-76,11.3,1.8),23),
         camera('CounterView',(-72.2,8.8,1.6),(-75.3,12.3,1.65),30),
         camera('RingView',(73.9,8.3,1.7),(81.7,-2.5,1.9),24),
         camera('CutawayView',(-63,-2,11),(-79,12,1.3),38)]

report={'rows':len(instances),'existing_concession_rows':19,'main_entry_rows':2,
        'source_mesh_objects':sum(o.type=='MESH' for o in row.objects),
        'source_triangles':sum(len(p.vertices)-2 for o in row.objects if o.type=='MESH' for p in o.data.polygons),
        'source_lights':sum(o.type=='LIGHT' for o in row.objects),'atlas_size':list(atlas.size),
        'archived_objects':[o.name for o in replace], 'material_only_objects':finish_names,
        'cameras':[o.name for o in cameras]}
assert report['rows']==21 and report['source_triangles']<100000, report
(ROOT/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.context.window.scene=scene
print(json.dumps(report))
