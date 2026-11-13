import bpy,math
from math import sin,cos,pi
from mathutils import Vector
from pathlib import Path
ROOT=Path(r'D:/Blender/Blender/barclays-worlds-2026')
s=bpy.context.scene
# The plaza wraps the building footprint; it must not cover the sunken arena.
for ob in list(s.objects):
    if ob.name.startswith(('Walk_Plaza__','Plaza_joints__')):bpy.data.objects.remove(ob,do_unlink=True)
v=[];f=[];n=256
for i in range(n):
    t=2*pi*i/n;dx,dy=cos(t),sin(t)
    distance=min((150 if dx>=0 else 180)/max(abs(dx),1e-8),120/max(abs(dy),1e-8))
    v.extend([(96*dx,73*dy,-.02),(distance*dx,distance*dy,-.02)])
for i in range(n):j=(i+1)%n;f.append((2*i,2*i+1,2*j+1,2*j))
me=bpy.data.meshes.new('Plaza_with_open_arena');me.from_pydata(v,[],f);me.update()
ob=bpy.data.objects.new('Walk_Plaza',me);s.collection.objects.link(ob);me.materials.append(bpy.data.materials['paving'])
# Dark roof soffit separates the visible steel structure from the green rooftop.
v=[(0,0,29.7)]+[(94*cos(2*pi*i/160),71*sin(2*pi*i/160),29.7) for i in range(160)]
me=bpy.data.meshes.new('Roof_soffit');me.from_pydata(v,[],[(0,(i+1)%160+1,i+1) for i in range(160)]);me.update()
ob=bpy.data.objects.new('Roof_soffit',me);s.collection.objects.link(ob);me.materials.append(bpy.data.materials['black'])
# Horizontal seams and panel reveals on the projecting canopy.
v=[];f=[]
for row in range(12):
    for i in range(128):
        t0=2*pi*(i+.025)/128;t1=2*pi*(i+.975)/128
        bottom=10.25+row*.42;top=bottom+.36;k=len(v)
        for z in [bottom,top]:
            for t in [t0,t1]:v.append((-101+30.05*cos(t),28.05*sin(t),z+1.5*cos(t)))
        f.append((k,k+1,k+3,k+2))
me=bpy.data.meshes.new('Oculus_panel_reveals');me.from_pydata(v,[],f);me.update()
ob=bpy.data.objects.new('Oculus_panel_reveals',me);s.collection.objects.link(ob)
for i in range(8):me.materials.append(bpy.data.materials['corten'+str(i)])
for p in me.polygons:p.material_index=(p.index*13)%8
for name,loc,target in [('01_Exterior',(-184,-76,32),(-55,0,11)),('02_Interior',(-48,-24,8),(0,0,1))]:
    cam=bpy.data.objects[name];cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
s.camera=bpy.data.objects['02_Interior']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-worlds-2026.blend'))
print('Plaza opening, canopy panels, roof soffit and views corrected')
