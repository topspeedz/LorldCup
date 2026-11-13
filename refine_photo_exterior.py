import bpy, math, random
from math import sin,cos,pi
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
scene=bpy.data.scenes['Barclays Photo Exterior Final']
canopy=bpy.data.objects['Photo_Canopy'];lining=bpy.data.objects['Photo_Oculus lining']
materials=list(canopy.data.materials)
def contour(t,u,back=0):
 x=60*math.copysign(abs(cos(t))**.55,cos(t))
 z=14+10.5*math.copysign(abs(sin(t))**.45,sin(t))
 if sin(t)<0:z+=.10*(x+35)*abs(sin(t))**.5
 y=-24+12*max(0,-sin(t))+3*abs(cos(t))**4
 ix=-12+34*cos(t);iz=12.5+3.9*sin(t)+.065*(ix+12)
 return ((1-u)*x+u*ix,(1-u)*y+u*(-20)+back,(1-u)*z+u*iz)
verts=[];faces=[];indices=[]
def panel(points,idx):
 n=len(verts);verts.extend(points);verts.extend([(x,y+.035,z) for x,y,z in points])
 faces.extend(tuple(n+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);indices.extend([idx]*6)
for back in [0,14]:
 for i in range(144):
  for j in range(10):
   a=2*pi*(i+.0001)/144;b=2*pi*(i+.9999)/144;u=(j+.015)/10;v=(j+.985)/10
   panel([contour(a,u,back),contour(b,u,back),contour(b,v,back),contour(a,v,back)],random.randrange(8))
for i in range(144):
 for j in range(7):
  a=2*pi*(i+.0001)/144;b=2*pi*(i+.9999)/144
  panel([contour(a,0,j*2),contour(b,0,j*2),contour(b,0,j*2+1.96),contour(a,0,j*2+1.96)],random.randrange(8))
def replace(ob,vs,fs,ms):
 me=bpy.data.meshes.new(ob.name+'_refined');me.from_pydata(vs,[],fs);me.update()
 for mat in materials:me.materials.append(mat)
 for p,i in zip(me.polygons,ms):p.material_index=i
 ob.data=me
replace(canopy,verts,faces,indices)
verts=[];faces=[];indices=[]
for i in range(144):
 a=2*pi*i/144;b=2*pi*(i+1)/144
 panel([contour(a,1,0),contour(b,1,0),contour(b,1,6),contour(a,1,6)],11)
replace(lining,verts,faces,indices)
# Keep sign legible across the top band.
sign=bpy.data.objects['Photo_BARCLAYS CENTER'];sign.location=(-17,-24.4,20.0);sign.scale.x=sign.scale.x
scene.camera.location=(24,-135,8);scene.camera.rotation_euler=(Vector((0,-8,13))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.lens=32
scene.render.resolution_percentage=80
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-photo-exterior.blend'))
bpy.ops.render.render(scene=scene.name,write_still=True)
