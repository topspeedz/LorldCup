import bpy, math, json
from math import sin,cos,pi
col=bpy.data.collections['EXR_Architecture']
def wave(t):return 2.1*sin(t+.65)+1.4*cos(2*t-.4)
def world(x,y,z):return (y,-x,z)
verts=[];faces=[]
for i in range(352):
    a=2*pi*i/352;b=2*pi*(i+1)/352;k=len(verts)
    for t in [a,b]:
        z=38.5+wave(t);swell=1+1.6*sin((z-8)/32*pi)
        verts.extend([world((74.5+swell)*cos(t),(98+swell)*sin(t),z),world(73*cos(t),97*sin(t),37.4+wave(t))])
    faces.append((k,k+2,k+3,k+1))
def mesh(name,vs,fs,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);col.objects.link(ob);me.materials.append(mat)
    mod=ob.modifiers.new('Closed edge thickness','SOLIDIFY');mod.thickness=.075
    return ob
rust=next(m for m in bpy.data.objects['EXR_Canopy fascia louvers'].data.materials if 'Weathered steel 04' in m.name)
mesh('EXR_Roof perimeter coping',verts,faces,rust)
verts=[];faces=[]
for i in range(352):
    a=2*pi*i/352;b=2*pi*(i+1)/352
    if sin((a+b)/2)>=-.62:continue
    k=len(verts)
    for t,z in [(a,8.4),(b,8.4),(b,18.8),(a,18.8)]:
        zz=z+wave(t);swell=1+1.6*sin((zz-8)/32*pi)
        verts.append(world((74.5+swell)*cos(t),(98+swell)*sin(t),zz))
    faces.append(tuple(range(k,k+4)))
glass=next(m for m in bpy.data.objects['EXR_Entrance glazing'].data.materials if 'Blue grey architectural glass' in m.name)
mesh('EXR_Front return glazing',verts,faces,glass)
me=bpy.data.objects['EXR_Roof standing seams'].data
for i in range(0,len(me.vertices),8):
    block=list(me.vertices[i:i+8]);cy=sum(v.co.y for v in block)/8
    for v in block:v.co.y=cy+(v.co.y-cy)*3.2;v.co.z+=.08
me.update()
print('Closed roof perimeter and facade returns; raised roof seams')
