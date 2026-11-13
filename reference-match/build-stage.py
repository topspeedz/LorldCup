"""Reference stage reconstruction. Run once in the live backed-up Blender file."""
import bpy,bmesh,math,json,ast
import numpy as np
from pathlib import Path
from math import sin,cos,pi
from mathutils import Vector,Matrix
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
OUT=ROOT/'reference-match';OUT.mkdir(exist_ok=True)
REF=Path('D:/Blender/Blender/references/barclays-center/references/Arena')
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026']
assert not bpy.data.collections.get('ReferenceMatch')
col=bpy.data.collections.new('ReferenceMatch');scene.collection.children.link(col)
root=bpy.data.objects.new('REF_StageOrigin',None);col.objects.link(root);root.rotation_euler.z=-pi/2
archive=bpy.data.collections.new('ReferenceMatch_PreviousStage');scene.collection.children.link(archive)
prefixes=('Walk_Stage','Stage_LED','Stage_inlay','Stage_radials','Stage_light_beams','Player_','Desk_','Monitor_','Keyboard','Mousepad','PC_LED','Chair_','Screen_','Team_desk')
archived=[]
for o in list(scene.objects):
    if o.name.startswith(prefixes) or (o.name.startswith('InteriorDetail_') and o.type=='MESH' and not any(k in o.name for k in ['Lighting_','Fixture_','Speaker_'])):
        for c in list(o.users_collection):c.objects.unlink(o)
        archive.objects.link(o);archived.append(o.name)
archive.hide_render=True;archive.hide_viewport=True
(OUT/'archived-objects.json').write_text(json.dumps(archived,indent=2),encoding='utf-8')
S=-9.1;batches={};mats={}
src=ast.parse((ROOT/'build_scene.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'add','box','beam'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'existing-primitives','exec'))

def material(name,color,metal=0,rough=.4,emit=0):
    m=bpy.data.materials.new('REF_'+name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=(*color,1);mats[name]=m;return m
material('Obsidian',(.012,.017,.023),.58,.25)
material('Deck',(.035,.043,.052),.72,.22)
material('Steel',(.035,.043,.05),.82,.3)
material('Rubber',(.009,.012,.018),.0,.7)
material('Silver',(.58,.65,.72),.92,.18)
material('GoldMetal',(.65,.35,.08),.8,.23)
material('Gold',(1,.47,.075),.3,.25,7)
material('Cyan',(.008,.68,1),.25,.23,6)
material('Pink',(1,.012,.30),.25,.23,6)
material('White',(.82,.9,1),.1,.35,2)
material('ScreenBlack',(.004,.008,.014),.2,.32)
# Fine floor roughness variation preserves directional light reflections.
m=mats['Deck'];nt=m.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=110;tex.inputs['Detail'].default_value=2
rough=nt.nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.18;rough.inputs['To Max'].default_value=.29
nt.links.new(tex.outputs['Fac'],rough.inputs['Value']);nt.links.new(rough.outputs['Result'],p.inputs['Roughness'])

def mesh_obj(name,v,f,ma,uv=None):
    me=bpy.data.meshes.new('REF_'+name);me.from_pydata(v,[],f);me.update()
    if uv:
        lay=me.uv_layers.new(name='ReferenceUV')
        for poly,coords in zip(me.polygons,uv):
            for idx,pair in zip(poly.loop_indices,coords):lay.data[idx].uv=pair
    ob=bpy.data.objects.new('REF_'+name,me);col.objects.link(ob);ob.parent=root;me.materials.append(mats[ma]);return ob

def prism(name,poly,z0,z1,ma):
    n=len(poly);v=[(x,y,z) for z in [z0,z1] for x,y in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    add(name,ma,v,f)

def plate(name,poly,y,depth,ma):
    n=len(poly);v=[(x,yy,z) for yy in [y,y+depth] for x,z in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    add(name,ma,v,f)

def outline(name,points,ma,r=.025,closed=True):
    pairs=list(zip(points,points[1:]+points[:1])) if closed else list(zip(points,points[1:]))
    for a,b in pairs:beam(name,a,b,r,ma,6)

def rim(name,r,z,ma,width=.025,start=0,end=2*pi,n=160):
    for i in range(n):
        a=start+(end-start)*i/n;b=start+(end-start)*(i+1)/n
        beam(name,(r*cos(a),r*sin(a),z),(r*cos(b),r*sin(b),z),width,ma,6)

def lathe(name,center,rings,ma,n=64):
    cx,cy,cz=center;v=[(cx+r*cos(2*pi*j/n),cy+r*sin(2*pi*j/n),cz+z) for z,r in rings for j in range(n)]
    f=[tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))]
    f += [(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(len(rings)-1) for j in range(n)]
    add(name,ma,v,f)

font=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
def text(name,body,loc,size,ma,rotation=(pi/2,0,0)):
    cu=bpy.data.curves.new('REF_'+name,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.font=font;cu.extrude=.001;cu.resolution_u=4
    ob=bpy.data.objects.new('REF_'+name,cu);col.objects.link(ob);ob.parent=root;ob.location=loc;ob.rotation_euler=rotation;cu.materials.append(mats[ma]);return ob

# Packed original art, projected only onto physical LED surfaces.
image=bpy.data.images.load(str(REF/'Final Arena.png'),check_existing=True);image.pack()
for name in ['Artwork_G','Artwork_B','Artwork_DeskG','Artwork_DeskB','Artwork_Crest']:
    m=bpy.data.materials.new('REF_'+name);m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');im=nt.nodes.new('ShaderNodeTexImage');im.image=image
    em.inputs['Strength'].default_value=.85;nt.links.new(im.outputs['Color'],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs['Surface']);mats[name]=m

def art(name,corners,pixels,ma,nx=20,ny=12):
    # Homography rectifies each photographed artwork quad without baking the arena as a backdrop.
    a=[];b=[]
    for (u,v),(x,y) in zip([(0,0),(1,0),(1,1),(0,1)],pixels):
        a.extend([[u,v,1,0,0,0,-u*x,-v*x],[0,0,0,u,v,1,-u*y,-v*y]]);b.extend([x,y])
    h=np.append(np.linalg.solve(np.array(a),np.array(b)),1).reshape(3,3)
    vv=[];uvs=[];ff=[]
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx;p=(Vector(corners[0])*(1-u)+Vector(corners[1])*u)*(1-v)+(Vector(corners[3])*(1-u)+Vector(corners[2])*u)*v
            vv.append(tuple(p));q=h@np.array([u,v,1]);uvs.append((q[0]/q[2]/image.size[0],1-q[1]/q[2]/image.size[1]))
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i;ff.append((k,k+1,k+nx+2,k+nx+1))
    return mesh_obj(name,vv,ff,ma,[[uvs[k] for k in f] for f in ff])

# Main single-height black deck and two-tone perimeter, matching the reference silhouette.
lathe('CircularStage',(0,0,0),[(-10,15.85),(S-.08,16),(S,15.98)],'Deck',192)
for ma,a,b in [('Gold',pi/2,3*pi/2),('Cyan',-pi/2,pi/2)]:rim('StageEdge',16.01,S-.04,ma,.026,a,b,96)
for j in range(72):
    t=2*pi*(j+.5)/72;x,y=16.01*cos(t),16.01*sin(t);ma='Gold' if x<0 else ('Pink' if j%3==0 else 'Cyan')
    box('StageFascia_panels',(15.99*cos(t),15.99*sin(t),S-.47),(1.32,.07,.70),'Obsidian',t-pi/2)
    if j%2==0:box('StageFascia_lamps',(16.045*cos(t),16.045*sin(t),S-.32),(.54,.035,.07),ma,t-pi/2)
    if j%6==0:
        for k in range(8):box('StageFascia_vents',(x+(k-3.5)*.045*sin(t),y-(k-3.5)*.045*cos(t),S-.68),(.018,.025,.15),'Steel',t-pi/2)
# Reflective modular deck joints.
for x in range(-15,16,2):
    half=math.sqrt(15.8**2-x*x)
    beam('DeckSeams',(x,-half,S+.002),(x,half,S+.002),.003,'Rubber',4)
for y in range(-14,15,2):
    half=math.sqrt(15.8**2-y*y)
    beam('DeckSeams',(-half,y,S+.002),(half,y,S+.002),.003,'Rubber',4)

# Trophy island and runway: front points toward the existing west entry.
island=[(-1.5,-29),(1.5,-29),(1.5,-12.5),(4.6,-9.5),(2.8,-6.7),(-2.8,-6.7),(-4.6,-9.5),(-1.5,-12.5)]
prism('TrophyIsland',island,S,S+.20,'Obsidian')
outline('RunwayEdge',[(x,y,S+.22) for x,y in island],'Gold',.022)
island2=[(-1.25,-29),(1.25,-29),(1.25,-12.3),(4.20,-9.5),(2.6,-7.0),(-2.6,-7.0),(-4.20,-9.5),(-1.25,-12.3)]
outline('RunwayInset',[(x,y,S+.225) for x,y in island2],'White',.012)
outline('TrophyCyanAccent',[(2.6,-7,S+.23),(4.2,-9.5,S+.23),(1.25,-12.3,S+.23)],'Cyan',.025,False)
for yy in range(-28,-12,2):beam('RunwaySeams',(-1.2,yy,S+.204),(1.2,yy,S+.204),.002,'Rubber',4)
lathe('PedestalFoot',(0,-9.4,S+.2),[(0,1.43),(.10,1.43),(.16,1.29)],'Silver',8)
lathe('Pedestal',(0,-9.4,S+.36),[(0,1.15),(1.12,.83),(1.20,.84)],'Obsidian',8)
for zz,rr in [(S+.38,1.17),(S+1.53,.87)]:
    outline('PedestalTrim',[(rr*cos(pi/8+2*pi*j/8),-9.4+rr*sin(pi/8+2*pi*j/8),zz) for j in range(8)],'Gold',.018)
for j in range(8):
    t=pi/8+2*pi*j/8;beam('PedestalRibs',(1.15*cos(t),-9.4+1.15*sin(t),S+.38),(.83*cos(t),-9.4+.83*sin(t),S+1.5),.015,'GoldMetal',6)
# Silver trophy body, hollow cup lip, handles and crown-like prongs.
base=S+1.57
lathe('Trophy',(0,-9.4,base),[(0,.42),(.07,.46),(.13,.32),(.25,.25),(.38,.12),(.62,.14),(.75,.28),(.95,.44),(1.20,.57),(1.34,.55),(1.36,.50),(1.17,.48),(.94,.36),(.82,.15)],'Silver',64)
for sign in [-1,1]:
    pts=[(sign*.30,-9.4,base+.69),(sign*.62,-9.4,base+.90),(sign*.80,-9.4,base+1.22),(sign*.77,-9.4,base+1.45),(sign*.55,-9.4,base+1.37)]
    outline('TrophyHandles',pts,'Silver',.045,False)
for j in range(8):
    t=2*pi*j/8;beam('TrophyCrown',(.53*cos(t),-9.4+.53*sin(t),base+1.27),(.61*cos(t),-9.4+.61*sin(t),base+1.56),.025,'Silver',6)

# Angular layered scenic walls, LED wings and center grand-final stair.
for j in range(7):
    y=4.9+j*.40;box('CenterStair',(0,y,S+.09+j*.17),(6.0,.43,.18+j*.34),'Obsidian')
    beam('CenterStairNosing',(-2.95,y-.22,S+.18+j*.34),(2.95,y-.22,S+.18+j*.34),.012,'Gold',6)
central=[(-4.2,S+7.2),(4.2,S+7.2),(2.7,S+1.3),(-2.7,S+1.3)]
plate('CenterBackdrop',central,9.1,.35,'Obsidian')
outline('CenterBackdropTrim',[(x,9.08,z) for x,z in central],'GoldMetal',.028)
banner=[(-3.0,S+3.5),(3.0,S+3.5),(2.65,S+2.85),(-2.65,S+2.85)]
plate('GrandFinalFascia',banner,8.50,.20,'ScreenBlack');outline('GrandFinalTrim',[(x,8.48,z) for x,z in banner],'Gold',.02)
text('GrandFinal','GRAND FINAL',(0,8.45,S+3.18),.48,'White')
# Crest sampled from the supplied central stage, no invented tournament logo.
art('WorldsCrest',[(-.9,9.04,S+4.35),(.9,9.04,S+4.35),(.9,9.04,S+6.05),(-.9,9.04,S+6.05)],[(798,554),(884,554),(884,493),(798,493)],'Artwork_Crest',8,8)
art('PedestalCrest',[(-.27,-10.38,S+.70),(.27,-10.38,S+.70),(.27,-10.30,S+1.21),(-.27,-10.30,S+1.21)],[(798,554),(884,554),(884,493),(798,493)],'Artwork_Crest',8,8)

def wave_material(name,color,second):
    m=material(name,color,.3,.3,0);nt=m.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
    noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3;noise.inputs['Detail'].default_value=3
    wave=nt.nodes.new('ShaderNodeTexWave');wave.inputs['Scale'].default_value=3.0;wave.inputs['Distortion'].default_value=7;wave.inputs['Detail'].default_value=3
    ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.35;ramp.color_ramp.elements[0].color=(.003,.008,.015,1);ramp.color_ramp.elements[1].position=.70;ramp.color_ramp.elements[1].color=(*color,1)
    ramp.color_ramp.elements.new(.92).color=(*second,1)
    nt.links.new(wave.outputs['Color'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color']);nt.links.new(ramp.outputs[0],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.8
wave_material('GoldWaves',(.75,.35,.045),(1,.72,.24));wave_material('BlueWaves',(.005,.55,.9),(.8,.012,.33))
for side in [-1,1]:
    ma='Gold' if side<0 else 'Cyan';wave='GoldWaves' if side<0 else 'BlueWaves'
    poly=[(side*3.4,S+1.1),(side*10.6,S+.3),(side*12.6,S+6.0),(side*5.1,S+5.4)]
    plate('WingMainFrame',poly,8.45,.40,'Obsidian')
    inner=[(side*4.15,S+1.35),(side*10.30,S+.70),(side*11.65,S+5.35),(side*5.45,S+4.90)]
    plate('WingLED',inner,8.40,.035,wave);outline('WingLEDTrim',[(x,8.36,z) for x,z in inner],ma,.025)
    for k in range(3):
        x=11.5+k*1.12;h=6.9-k*1.55;y=7.7-k*1.10
        pp=[(side*(x-1.15),S+.25),(side*(x+.10),S+.25),(side*(x+1.60),S+h),(side*(x-.10),S+h-.45)]
        plate('ScenicBlade',pp,y,.25,'Obsidian')
        beam('ScenicBladeEdge',(side*(x-.95),y-.025,S+.45),(side*(x+.60),y-.025,S+h-.55),.055,ma if k!=2 or side<0 else 'Pink',6)
        beam('ScenicBladeRim',(side*(x+.10),y-.025,S+.25),(side*(x+1.60),y-.025,S+h),.016,'Silver',6)
    # Real rear braces and casework visible from the rear reference.
    for x in [side*5.5,side*8.5,side*11.0,side*13.0]:
        for z in [S+.4,S+4.5]:beam('RearBraces',(x,8.9,z),(x,11,S+.12),.055,'Steel',8)
        box('BackstageCase',(x,10.8,S+.38),(.8,.6,.7),'Rubber')
        for dx in [-.36,.36]:box('FlightCaseCorners',(x+dx,10.49,S+.38),(.035,.035,.65),'Silver')
        for yy in [9.5,9.7]:beam('BackstageCable',(side*3,yy,S+.07),(side*13,yy,S+.07),.018,'Rubber',6)

# Two pentagonal integrated team desks, both facing the runway.
for side in [-1,1]:
    cx=side*7.2;ma='Gold' if side<0 else 'Cyan'
    for level,expand in [(0,.35),(1,.20),(2,0)]:
        p=[(cx-4.0-expand,-2.2-expand),(cx+4.0+expand,-2.2-expand),(cx+4.35+expand,-1.6),(cx+4.35+expand,1.5),(cx-4.35-expand,1.5),(cx-4.35-expand,-1.6)]
        prism('TeamRiser',p,S+level*.09,S+(level+1)*.09,'Obsidian');outline('TeamRiserEdge',[(x,y,S+(level+1)*.09+.006) for x,y in p],ma if level!=1 or side<0 else 'Pink',.015)
    front=[(cx-3.75,S+.30),(cx+3.75,S+.30),(cx+4.08,S+1.45),(cx-4.08,S+1.45)]
    plate('DeskBody',front,-1.5,1.10,'Obsidian')
    box('DeskWorktop',(cx,-.87,S+1.49),(8.20,1.35,.10),'Steel')
    outline('DeskLEDOutline',[(x,-1.522,z) for x,z in front],ma,.025)
    pixels=[(418,712),(680,712),(705,665),(400,665)] if side<0 else [(994,715),(1272,715),(1287,665),(978,665)]
    art('DeskFace_'+str(side),[(front[0][0],-1.528,front[0][1]),(front[1][0],-1.528,front[1][1]),(front[2][0],-1.528,front[2][1]),(front[3][0],-1.528,front[3][1])],pixels,'Artwork_DeskG' if side<0 else 'Artwork_DeskB',32,8)

# Four-sided diamond scoreboard with separate headers, top service deck and suspension.
points=[(0,-8.3),(8.3,0),(0,8.3),(-8.3,0)];bottom=S+8.4;top=S+15.7
prism('ScoreboardStructure',points,bottom,top,'Obsidian')
pixG=[(449,427),(823,404),(823,160),(441,216)];pixB=[(850,405),(1230,432),(1240,211),(851,161)]
for j in range(4):
    a=Vector((*points[j],0));b=Vector((*points[(j+1)%4],0));mid=(a+b)/2;normal=mid.normalized();a+=normal*.025;b+=normal*.025
    gold=mid.x<0;ma='Gold' if gold else 'Cyan'
    cs=[tuple(a+Vector((0,0,bottom+.12))),tuple(b+Vector((0,0,bottom+.12))),tuple(b+Vector((0,0,top-1.25))),tuple(a+Vector((0,0,top-1.25)))]
    # Reverse front edge orientation where necessary so lettering is not mirrored.
    art('Jumbotron_'+str(j),cs,pixG if gold else pixB,'Artwork_G' if gold else 'Artwork_B',32,18)
    outline('JumbotronTrim',cs,ma,.035)
    for z in [top-.05,top-1.15]:beam('HeaderLight',tuple(a+Vector((0,0,z))),tuple(b+Vector((0,0,z))),.035,ma,8)
    tangent=(b-a).normalized();yaw=math.atan2(tangent.y,tangent.x)
    text('WorldsHeader_'+str(j),'WORLDS 2026',tuple(mid+normal*.08+Vector((0,0,top-.62))),.53,'White',(pi/2,0,yaw))
    for k in range(13):
        p=a.lerp(b,(k+.5)/13)
        beam('ScreenUndersideLamps',tuple(p+Vector((0,0,bottom-.04))),tuple(p+Vector((0,0,bottom-.10))),.07,'White' if k%3 else ma,10)
for x,y in points:
    beam('ScoreboardCorner',(x,y,bottom-.1),(x,y,top+.1),.07,'Steel',8)
    beam('ScoreboardSuspension',(x*.95,y*.95,top),(x*.95,y*.95,26.4),.045,'Steel',8)
    box('ScoreboardHoist',(x*.95,y*.95,top+1.8),(.48,.45,.62),'Rubber')
for z in [top+.2,top+1.0]:outline('ScoreboardTopRail',[(x,y,z) for x,y in points],'Steel',.03)
for i in range(4):
    a=Vector((*points[i],top));b=Vector((*points[(i+1)%4],top))
    for k in range(12):
        p=a.lerp(b,k/12);q=a.lerp(b,(k+1)/12)
        beam('ScoreboardTopTruss',tuple(p+Vector((0,0,.2))),tuple(q+Vector((0,0,1))),.025,'Steel',6)

# Compile grouped physical components with outward normals, leaving intended LED art surfaces open.
report=[]
for (name,ma),(v,f) in batches.items():
    ob=mesh_obj(name+'__'+ma,v,f,ma);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data)
    assert all(math.isfinite(c) for vert in bm.verts for c in vert.co)
    assert all(e.is_manifold for e in bm.edges)
    bm.free();ob.data.calc_loop_triangles();report.append({'name':ob.name,'triangles':len(ob.data.loop_triangles)})
    if name in ['CircularStage','Trophy','TrophyHandles']:
        for p in ob.data.polygons:p.use_smooth=True
assert sum(r['triangles'] for r in report)<300000
(OUT/'stage-geometry.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'new_grouped_meshes':len(report),'triangles':sum(r['triangles'] for r in report),'archived_objects':len(archived)}))
