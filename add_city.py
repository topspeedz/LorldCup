"""Approximate surrounding city silhouettes based on the user-supplied photograph."""
import bpy,math,random,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'D:/Blender/Blender/barclays-worlds-2026');s=bpy.context.scene;random.seed(73)
assert s.name=='Barclays • WORLDS 2026','Select the complete stadium scene before adding its city background'
existing={o.name:(len(o.data.vertices) if o.type=='MESH' else 0,tuple(v for row in o.matrix_world for v in row)) for o in s.objects}
collection=bpy.data.collections.new('City background • photo proportions');s.collection.children.link(collection)
materials={};batch={}
def material(name,color,metal=0,rough=.65):
    m=bpy.data.materials.new('City_'+name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*color,1);materials[name]=m
for args in [('teal',(.10,.23,.22),.35,.42),('teal_dark',(.055,.13,.13),.4,.35),('glass',(.16,.28,.31),.65,.2),('glass_light',(.32,.44,.43),.5,.25),('window_dark',(.055,.085,.10),.3,.35),('limestone',(.46,.43,.34),0,.85),('concrete',(.3,.32,.31),0,.9),('brick',(.27,.12,.075),0,.9),('red',(.34,.045,.045),.1,.6),('roof',(.08,.095,.10),.25,.6),('road',(.055,.07,.075),0,.9),('sidewalk',(.3,.32,.32),0,.9),('paint',(.68,.66,.54),0,.8),('bark',(.12,.075,.04),0,.9),('leaves',(.045,.115,.035),0,.95),('leaves_light',(.10,.18,.05),0,.95)]:material(*args)
def box(name,p,size,ma):
    v,f=batch.setdefault((name,ma),([],[]));k=len(v);x,y,z=p;a,b,c=[q/2 for q in size]
    v.extend([(x+u,y+w,z+t) for u,w,t in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]])
    f.extend(tuple(k+j for j in q) for q in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

buildings=[]
def building(label,x,y,width,depth,height,ma,spacing=3.2,glass='window_dark',base=0):
    box('Collide_CityBuildings',(x,y,base+height/2),(width,depth,height),ma)
    box('CityRoofCaps',(x,y,base+height+.2),(width+.3,depth+.3,.4),'roof')
    floors=int(height/3.3)
    for side in [-1,1]:
        count=max(1,int(width/spacing))
        for col in range(count):
            xx=x+(col-(count-1)/2)*spacing
            for row in range(floors):
                zz=base+1.9+row*3.3
                if zz>base+height-1:continue
                window=glass if random.random()>.17 else 'glass_light'
                box('CityWindows',(xx,y+side*(depth/2+.025),zz),(spacing*.46,.04,1.6),window)
        count=max(1,int(depth/spacing))
        for col in range(count):
            yy=y+(col-(count-1)/2)*spacing
            for row in range(floors):
                zz=base+1.9+row*3.3
                if zz>base+height-1:continue
                window=glass if random.random()>.17 else 'glass_light'
                box('CityWindows',(x+side*(width/2+.025),yy,zz),(.04,spacing*.46,1.6),window)
    for z in range(0,int(height),int(3.3*5)):
        box('CitySpandrels',(x,y,base+z+.2),(width+.12,depth+.12,.18),ma)
    if base==0:
        box('CityRoofPlant',(x-width*.15,y,base+height+1.3),(width*.35,depth*.4,2.2),'concrete')
        buildings.append({'name':label,'position':[x,y],'height':height})

# The tall stepped green mass on the left and the red/glass mass on the right anchor the supplied skyline.
building('Green tower lower',69,111,34,29,53,'teal',2.8,'glass')
building('Green tower setback',72,114,27,25,61,'teal',2.8,'glass',base=53)
box('CityPenthouse',(72,114,116),(23,19,4),'concrete')
for y in [106,111,116]:box('CityRooftopLouvers',(72,y,119),(22,.2,2),'roof')
building('Right glass tower',91,-105,25,25,96,'glass_light',3,'glass')
building('Red tower podium',70,-100,24,24,51,'red',3,'glass')
building('Center limestone block',130,34,33,29,61,'limestone',3.4)
building('Center setback',134,33,24,24,10,'concrete',3.4,base=61)
building('Rear midrise',136,-10,27,22,54,'concrete',3.2)
building('Rear midrise two',150,-54,24,24,42,'brick',3)
building('Left beige block',-31,130,28,25,30,'limestone',3)
building('Left apartment',8,143,23,28,43,'concrete',3)
building('Far left apartment',42,167,30,25,48,'brick',3)
for i,(x,y) in enumerate([(-89,123),(-55,125),(-110,-118),(-65,-124),(-25,-130),(17,-141),(132,83),(165,120),(181,37),(178,-40),(153,-102)]):
    building('Street block '+str(i+1),x,y,random.randint(17,25),random.randint(17,25),random.randint(13,27),'brick' if i%3 else 'limestone',3)
    for dx in [-6,6]:box('CityGroundStorefront',(x+dx,y-12.6,2.0),(4,.1,3),'glass')
# Distant ground and street strips remain visually below the existing walkable plaza.
box('CityGround',(10,10,-.44),(600,520,.3),'sidewalk')
for y in [-88,91,155]:
    box('CityRoads',(20,y,-.25),(400,14,.06),'road')
    for x in range(-170,221,10):box('CityRoadMarkings',(x,y,-.212),(4,.12,.02),'paint')
for x in [119,173]:
    box('CityRoads',(x,0,-.24),(12,360,.06),'road')
    for y in range(-170,171,10):box('CityRoadMarkings',(x,y,-.2),(.12,4,.02),'paint')
for y in [-88,91]:
    for x in [115,122,169,176]:
        for d in range(-5,6,2):box('CityCrosswalk',(x,y+d,-.17),(2.7,.8,.025),'paint')
# Small street props give scale without adding interiors to the background buildings.
for i in range(18):
    x=-60+i*11;y=92 if i%2 else -89
    box('CityStreetlights',(x,y,4.3),(.12,.12,8.6),'roof')
    box('CityStreetlights',(x,y+1,8.55),(.15,2.2,.15),'roof')
    box('CityLampHead',(x,y+2.1,8.45),(.5,.8,.2),'paint')
for i in range(26):
    x=random.uniform(-165,175);y=random.choice([-92,-84,87,95])
    box('CityCars',(x,y,.65),(3.8,1.7,1.1),random.choice(['red','teal_dark','concrete']))
    box('CityCarWindows',(x,y,1.2),(2,1.5,.5),'glass')
for i in range(24):
    x=-85+i*8;y=82 if i%2 else -80
    box('CityTreeTrunks',(x,y,2),(.28,.28,4),'bark')
    for j in range(3):
        cx=x+random.uniform(-1,1);cy=y+random.uniform(-1,1);cz=4.7+j*.6
        verts,faces=batch.setdefault(('CityTrees','leaves' if j%2 else 'leaves_light'),([],[]));k=len(verts)
        n=10
        for ring in range(1,6):
            t=math.pi*ring/6
            for a in range(n):
                angle=2*math.pi*a/n;verts.append((cx+2.1*math.sin(t)*math.cos(angle),cy+2.1*math.sin(t)*math.sin(angle),cz+2.2*math.cos(t)))
        for ring in range(4):
            for a in range(n):faces.append((k+ring*n+a,k+ring*n+(a+1)%n,k+(ring+1)*n+(a+1)%n,k+(ring+1)*n+a))
        faces.extend([tuple(k+a for a in range(n-1,-1,-1)),tuple(k+4*n+a for a in range(n))])

for (name,ma),(v,f) in batch.items():
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();ob=bpy.data.objects.new(name+'__'+ma,me);collection.objects.link(ob);me.materials.append(materials[ma]);ob['city_background']=True

# Camera-only sky preserves the original arena lighting.
nodes=s.world.node_tree.nodes;links=s.world.node_tree.links
out=next(n for n in nodes if n.type=='OUTPUT_WORLD');old=out.inputs['Surface'].links[0].from_socket
env=nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'web/city-sky.jpg'));env.image.pack()
bg=nodes.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=.8;links.new(env.outputs['Color'],bg.inputs['Color'])
path=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader');links.new(path.outputs['Is Camera Ray'],mix.inputs[0]);links.new(old,mix.inputs[1]);links.new(bg.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
data=bpy.data.cameras.new('04_City_Exterior');data.lens=28;data.clip_end=1000
cam=bpy.data.objects.new('04_City_Exterior',data);collection.objects.link(cam);cam.location=(-225,-45,43);cam.rotation_euler=(Vector((22,12,37))-cam.location).to_track_quat('-Z','Y').to_euler()
after={o.name:(len(o.data.vertices) if o.type=='MESH' else 0,tuple(v for row in o.matrix_world for v in row)) for o in s.objects if o.name in existing}
assert existing==after,'Original objects changed'
s.camera=cam
report={'background_buildings':len(buildings),'background_meshes':len(batch),'original_objects_preserved':True,'buildings':buildings}
(ROOT/'city-verification.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-worlds-2026.blend'))
print(json.dumps({k:v for k,v in report.items() if k!='buildings'}))
