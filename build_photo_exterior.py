import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
random.seed(19)
scene=bpy.data.scenes.new('Barclays Photo Exterior')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
mats=[]; batches={}
def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new('Photo_'+name);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 m.diffuse_color=(*color,1);mats.append(m);return len(mats)-1
rust=[mat('Corten'+str(i),(.19+i*.018,.047+i*.007,.019+i*.003),.45,.7) for i in range(8)]
glass=mat('Reflective blue glazing',(.075,.19,.23),.72,.16)
steel=mat('Mullions',(.11,.13,.13),.7,.3)
cyan=mat('Barclays turquoise',(.015,.58,.73),.25,.32)
white=mat('Oculus white LED',(.75,.81,.91),.1,.4)
node=next(n for n in mats[white].node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Emission Color'].default_value=(.7,.8,1,1);node.inputs['Emission Strength'].default_value=.35
paving=mat('Plaza limestone',(.32,.34,.35),0,.85)
dark=mat('Shadow',(.025,.032,.035),.25,.6)
def add(group,material,v,f):
 vs,fs,ms=batches.setdefault(group,([],[],[]));n=len(vs);vs.extend(v);fs.extend(tuple(n+i for i in q) for q in f);ms.extend([material]*len(f))
cube_faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def box(group,loc,size,m):
 x,y,z=loc;a,b,c=[s/2 for s in size]
 add(group,m,[(x+u*a,y+v*b,z+w*c) for u,v,w in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],cube_faces)
def outer(t):
 x=60*math.copysign(abs(cos(t))**.45,cos(t));y=24*math.copysign(abs(sin(t))**.55,sin(t))
 return x,y
def surf(t,u,top=False):
 x,y=outer(t);ix=-10+34*cos(t);iy=-3+12*sin(t)
 # shortcut: rear and depth inferred from one photo, replace with surveyed sections when supplied.
 oz=19-16*math.exp(-((x+57)/9)**2)*(max(0,-sin(t))*.4+.6)
 iz=15.7+1.8*sin(t)+.025*ix
 z=(1-u)*oz+u*iz
 if top:z=24.5-u*5.8
 return (x*(1-u)+ix*u,y*(1-u)+iy*u,z)
def tile(group,points,m,thick=.045):
 add(group,m,points+[(x,y,z+thick) for x,y,z in points],cube_faces)
N=144;R=12
for top in [False,True]:
 for i in range(N):
  for j in range(R):
   a=2*pi*(i+.025)/N;b=2*pi*(i+.975)/N;u=(j+.025)/R;v=(j+.975)/R
   tile('Canopy', [surf(a,u,top),surf(b,u,top),surf(b,v,top),surf(a,v,top)],random.choice(rust))
for i in range(N):
 a=2*pi*(i+.025)/N;b=2*pi*(i+.975)/N
 for j in range(8):
  p=surf(a,0);q=surf(b,0);h=24.5
  z0=j/8;z1=(j+.90)/8
  points=[(p[0],p[1],p[2]+(h-p[2])*z0),(q[0],q[1],q[2]+(h-q[2])*z0),(q[0],q[1],q[2]+(h-q[2])*z1),(p[0],p[1],p[2]+(h-p[2])*z1)]
  tile('Canopy',points,random.choice(rust))
 # Inner white ribbon is a real hollow ring, never an ellipse covering the opening.
 p=surf(a,1);q=surf(b,1)
 tile('Oculus lining',[p,q,(q[0],q[1],18.7),(p[0],p[1],18.7)],white)
# Glass entrance recessed beneath the flying canopy.
box('Entry',(3,9,5.3),(100,29,10.6),dark)
for i in range(40):
 x=-47+i*2.5
 for j in range(3):
  box('Glazing',(x,-5.65,1.7+j*3.45),(2.37,.15,3.3),glass)
 box('Mullions',(x-1.24,-5.83,5.2),(.085,.13,10.4),steel)
for z in [0,3.45,6.9,10.4]:box('Mullions',(1.75,-5.84,z),(100,.14,.09),steel)
for x in range(-18,21,3):
 box('Doors',(x,-5.98,1.5),(2.8,.16,2.95),glass)
 box('Doors',(x,-6.10,1.5),(.07,.10,3),steel)
 box('Doors',(x+.8,-6.2,1.35),(.04,.08,.55),steel)
box('Plaza',(0,0,-.3),(230,160,.6),paving)
for x in range(-110,111,5):box('Paving joints',(x,-20,.008),(.025,110,.012),dark)
for y in range(-75,56,5):box('Paving joints',(0,y,.01),(220,.025,.012),dark)
for x in [-45,-38,35,42,49]:box('Bollards',(x,-19,.7),(.22,.22,1.4),steel)
for group,(vs,fs,ms) in batches.items():
 me=bpy.data.meshes.new('Photo_'+group);me.from_pydata(vs,[],fs);me.update()
 ob=bpy.data.objects.new('Photo_'+group,me);scene.collection.objects.link(ob)
 for m in mats:me.materials.append(m)
 for p,idx in zip(me.polygons,ms):p.material_index=idx
def text(body,loc,size):
 cu=bpy.data.curves.new('Photo_Sign','FONT');cu.body=body;cu.size=size;cu.extrude=.045;cu.bevel_depth=.012;cu.resolution_u=6
 ob=bpy.data.objects.new('Photo_BARCLAYS CENTER',cu);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(pi/2,0,0);cu.materials.append(mats[cyan]);return ob
sign=text('BARCLAYS CENTER',(-16,-24.3,20.25),4.6)
bpy.context.view_layer.update();sign.scale.x=70/sign.dimensions.x
# Small turquoise shield with abstract eagle silhouette in the photo's sign position.
def badge(name,coords,y,material):
 me=bpy.data.meshes.new(name);me.from_pydata([(x,y,z) for x,z in coords],[],[tuple(range(len(coords)))]);me.update();ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);me.materials.append(mats[material]);return ob
badge('Photo_Barclays shield',[(-28,24),(-20,24),(-20.7,18),(-24,16.9),(-27.3,18)],-24.4,cyan)
badge('Photo_Eagle silhouette',[(-24,18),(-26.8,20),(-27,22.6),(-25.2,21.8),(-25.7,23),(-24.3,22.7),(-23.5,23.4),(-22.3,23),(-22.6,21.8),(-20.8,22.4),(-21.2,20.2),(-23.2,19),(-23.5,20.5)],-24.5,white)
world=bpy.data.worlds.new('Photo daylight');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.32,.55,.75,1);bg.inputs['Strength'].default_value=.65
ld=bpy.data.lights.new('Photo sunlight','SUN');ld.energy=3;ld.angle=.12
sun=bpy.data.objects.new('Photo sunlight',ld);scene.collection.objects.link(sun);sun.rotation_euler=(.45,-.55,-.45)
ld=bpy.data.lights.new('Photo fill','AREA');ld.energy=23000;ld.shape='DISK';ld.size=70
ob=bpy.data.objects.new('Photo fill',ld);scene.collection.objects.link(ob);ob.location=(0,-55,30);ob.rotation_euler=(Vector((0,0,12))-ob.location).to_track_quat('-Z','Y').to_euler()
ca=bpy.data.cameras.new('Photo camera');cam=bpy.data.objects.new('Photo camera',ca);scene.collection.objects.link(cam);cam.location=(12,-148,2.3);cam.rotation_euler=(Vector((0,-2,12))-cam.location).to_track_quat('-Z','Y').to_euler();ca.lens=34;scene.camera=cam
try:scene.render.engine='BLENDER_EEVEE'
except TypeError:pass
scene.render.resolution_x=1500;scene.render.resolution_y=950;scene.render.resolution_percentage=80
scene.render.filepath=str(ROOT/'renders/exterior-photo-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-photo-exterior.blend'))
print('Photo exterior built',len(scene.objects))
