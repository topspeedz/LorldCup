import bpy,bmesh,ast,math,json
from math import sin,cos,pi
from mathutils import Vector
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026');OUT=ROOT/'reference-match'
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026'];col=bpy.data.collections['ReferenceMatch'];root=bpy.data.objects['REF_StageOrigin']
S=-9.1;mats={m.name[4:]:m for m in bpy.data.materials if m.name.startswith('REF_')};batches={}
src=ast.parse((ROOT/'build_scene.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'add','box','beam'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
src=ast.parse((OUT/'build-stage.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'mesh_obj','material','lathe','outline','text'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
font=bpy.data.fonts.get('Arial Bold') or bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
material('MonitorDisplay',(.018,.08,.10),.25,.32,.45)
material('PlayerSkin0',(.58,.32,.18),0,.48);material('PlayerSkin1',(.78,.51,.34),0,.5);material('PlayerSkin2',(.40,.22,.14),0,.5)
material('Hair',(.012,.009,.007),.0,.5);material('Eyes',(.75,.76,.73),0,.32);material('Pupil',(.012,.009,.008),0,.35)
for team,filename in [('PlayerGEN','audience-jersey-geng.png'),('PlayerBLG','audience-jersey-blg.png')]:
    material(team,(.4,.4,.4),0,.6);m=mats[team];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images[filename];m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])

sources=['Monitor_housing__black','Monitor_pixels__cyan','Monitor_stand__steel','Keyboard__black','Keyboard_keys__silver','Mousepad__black','Player_PC__black','PC_LED__cyan','Player_chair__black','Player_chair_back__blue','Chair_pedestal__silver','Chair_base__steel']
sources += [o.name for o in bpy.data.collections['ReferenceMatch_PreviousStage'].objects if o.name.startswith(('InteriorDetail_Monitor','InteriorDetail_Mouse','InteriorDetail_Headset','InteriorDetail_PC_','InteriorDetail_Chair_'))]
records=[]
for name in sources:
    old=bpy.data.objects[name];ob=old.copy();ob.data=old.data.copy();ob.name='REF_Reused_'+name;col.objects.link(ob);ob.parent=root
    ob.location=(0,0,0);ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
    flooroffset=.27 if any(k in name for k in ['PC','chair','Chair']) else .54
    for v in ob.data.vertices:
        x,y,z=v.co;side=-1 if y<0 else 1
        v.co=(side*7.2+x*.85,-.60+(y-side*6.3)*(-side),S+flooroffset+(z+7.73))
    for slot in ob.material_slots:
        if not slot.material:continue
        n=slot.material.name
        slot.material=mats['MonitorDisplay'] if 'Monitor_pixels' in name else mats['Rubber'] if n in ['black','blue'] else mats['Silver'] if n in ['silver','ivory'] else mats['Steel'] if n=='steel' else mats['Cyan']
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));assert all(e.is_manifold for e in bm.edges);bm.to_mesh(ob.data);bm.free()
    records.append(ob.name)

def ellipsoid(name,center,scale,ma,n=16,rings=8):
    cx,cy,cz=center;sx,sy,sz=scale
    v=[(cx,cy,cz-sz)]+[(cx+sx*sin(pi*k/rings)*cos(2*pi*j/n),cy+sy*sin(pi*k/rings)*sin(2*pi*j/n),cz-sz*cos(pi*k/rings)) for k in range(1,rings) for j in range(n)]+[(cx,cy,cz+sz)]
    top=len(v)-1;f=[(0,1+(j+1)%n,1+j) for j in range(n)]
    for k in range(rings-2):
        for j in range(n):a=1+k*n+j;b=1+k*n+(j+1)%n;f.append((a,b,b+n,a+n))
    f += [(top,1+(rings-2)*n+j,1+(rings-2)*n+(j+1)%n) for j in range(n)]
    add(name,ma,v,f)

for side in [-1,1]:
    team='PlayerGEN' if side<0 else 'PlayerBLG';shirt='Rubber' if side<0 else 'Eyes';trim='Gold' if side<0 else 'Cyan'
    for i in range(5):
        x=side*7.2+(i-2)*1.7425;y=.50;skin='PlayerSkin'+str(i%3)
        # Seated torso, neck, face, hair, arms and hands at the keyboard.
        ellipsoid('PlayerTorso',(x,y,S+1.33),(.25,.16,.36),shirt,16,10)
        ellipsoid('PlayerPelvis',(x,y,S+.98),(.23,.17,.16),'Rubber')
        beam('PlayerNecks',(x,y,S+1.58),(x,y,S+1.79),.074,skin,12)
        ellipsoid('PlayerHeads',(x,y-.015,S+1.95),(.145,.13,.19),skin,20,12)
        ellipsoid('PlayerHair',(x,y+.025,S+2.075),(.15,.137,.09),'Hair',20,8)
        for sg in [-1,1]:
            ellipsoid('PlayerEars',(x+sg*.14,y,S+1.95),(.027,.022,.044),skin,10,6)
            ellipsoid('PlayerEyes',(x+sg*.052,y-.135,S+1.98),(.033,.012,.016),'Eyes',12,6)
            ellipsoid('PlayerPupils',(x+sg*.052,y-.146,S+1.98),(.011,.005,.011),'Pupil',10,6)
            beam('PlayerBrows',(x+sg*.052-.03,y-.139,S+2.014),(x+sg*.052+.03,y-.139,S+2.014),.006,'Hair',6)
            beam('PlayerSleeves',(x+sg*.20,y,S+1.56),(x+sg*.29,y-.28,S+1.30),.085,shirt,12)
            ellipsoid('PlayerElbows',(x+sg*.29,y-.28,S+1.30),(.07,.07,.07),skin,12,6)
            beam('PlayerForearms',(x+sg*.29,y-.28,S+1.30),(x+sg*.17,-.46,S+1.58),.055,skin,12)
            ellipsoid('PlayerHands',(x+sg*.17,-.51,S+1.58),(.065,.11,.035),skin,12,6)
            beam('PlayerThighs',(x+sg*.12,y,S+.97),(x+sg*.12,y-.40,S+.83),.095,'Rubber',12)
            beam('PlayerShins',(x+sg*.12,y-.4,S+.83),(x+sg*.12,y-.43,S+.38),.065,'Rubber',10)
            ellipsoid('PlayerShoes',(x+sg*.12,y-.50,S+.34),(.09,.15,.065),'Rubber',12,6)
            ellipsoid('PlayerHeadset',(x+sg*.17,y,S+1.96),(.045,.075,.083),'Rubber',14,8)
            ellipsoid('PlayerHeadsetLED',(x+sg*.207,y,S+1.96),(.008,.048,.05),trim,12,8)
        ellipsoid('PlayerNoses',(x,y-.145,S+1.94),(.023,.035,.035),skin,12,8)
        beam('PlayerMouths',(x-.035,y-.133,S+1.88),(x+.035,y-.133,S+1.88),.004,'Hair',8)
        for k in range(16):
            a=pi*k/16;b=pi*(k+1)/16
            beam('PlayerHeadbands',(x+.18*cos(a),y,S+1.96+.22*sin(a)),(x+.18*cos(b),y,S+1.96+.22*sin(b)),.018,'Rubber',8)
        beam('PlayerBoomMics',(x-.17,y-.03,S+1.96),(x-.09,y-.24,S+1.88),.008,'Rubber',8)
        mesh_obj('PlayerJersey_'+str(side)+'_'+str(i),[(x-.19,y-.143,S+1.08),(x+.19,y-.143,S+1.08),(x+.19,y-.143,S+1.59),(x-.19,y-.143,S+1.59)],[(0,1,2,3)],team,[[(0,0),(1,0),(1,1),(0,1)]])
        text('ChairBrand_'+str(side)+'_'+str(i),'GEN.G' if side<0 else 'BLG',(x,1.03,S+1.91),.105,trim,(pi/2,0,pi))

# Reference-like fan light sticks: position follows actual occupied seat centers.
count=0
for ob in [o for o in scene.objects if o.name.startswith('Audience_torsos__')]:
    original=bpy.data.meshes.get(ob.name)
    if original is None or len(original.vertices)%8:continue
    for k in range(0,len(original.vertices),8*3):
        co=[original.vertices[k+j].co for j in range(8)];c=sum(co,Vector())/8
        # World to stage-local coordinates for the -90 degree stage root.
        x,y=-c.y,c.x
        ma='Gold' if x<0 else ('Pink' if count%3==0 else 'Cyan')
        a=(x+.18,y-.05,c.z+.03);b=(x+.20+.09*sin(count),y-.08,c.z+.45)
        beam('FanLightsticks',a,b,.018,ma,5);count+=1

for (name,ma),(v,f) in batches.items():
    ob=mesh_obj(name+'__'+ma,v,f,ma);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));assert all(e.is_manifold for e in bm.edges);assert all(math.isfinite(c) for vert in bm.verts for c in vert.co);bm.to_mesh(ob.data);bm.free()
    if name.startswith('Player'):
        for p in ob.data.polygons:p.use_smooth=True
print(json.dumps({'reused_equipment_groups':len(records),'players':10,'fan_lightsticks':count}))
(OUT/'equipment-report.json').write_text(json.dumps({'reused':records,'players':10,'fan_lightsticks':count},indent=2),encoding='utf-8')
