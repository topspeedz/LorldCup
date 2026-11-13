import bpy,math
from math import sin,cos,pi
col=bpy.data.collections['EXR_Architecture'];ob=bpy.data.objects['EXR_Panel slot lights']
pink=next(m for m in ob.data.materials if 'Soft rose panel light' in m.name)
verts=[];faces=[]
def wave(t):return 2.1*sin(t+.65)+1.4*cos(2*t-.4)
for i in range(352):
    a=2*pi*i/352;b=2*pi*(i+1)/352;t=(a+b)/2
    for band,lo,hi,rows in [(0,8.4,18.8,13),(1,23.5,38.5,19)]:
        if band==0 and sin(t)<-.62:continue
        for j in range(1,rows):
            if (i*7+j*13)%19>=5:continue
            def pt(t,f):
                z=lo+(hi-lo)*f+wave(t);swell=1+1.6*sin((z-8)/32*pi)
                return ((98+swell+.035)*sin(t),-(74.5+swell+.035)*cos(t),z)
            u=j/rows;k=len(verts)
            verts.extend([pt(a+.001,u-.009),pt(b-.001,u-.009),pt(b-.001,u-.0015),pt(a+.001,u-.0015)])
            faces.append(tuple(range(k,k+4)))
me=bpy.data.meshes.new('EXR_Recessed light apertures');me.from_pydata(verts,[],faces);me.update();me.materials.append(pink);ob.data=me
print('Aligned recessed lights with actual horizontal panel gaps',len(faces))
