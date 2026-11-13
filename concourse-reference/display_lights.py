import bpy
from mathutils import Vector
for collection,shift in [('CCR_SharedFourBayRow',0),('CCR_EntryAdjacentTwoBayRow',-3.8)]:
    col=bpy.data.collections[collection]
    for label,x,y,z,power,width,depth in [
        ('Popcorn interior',4.6,.37,1.91,8,.48,.38),
        ('Pastry interior',2.79,.6,1.77,5,.84,.12),
        ('Warmer interior',5.6,.6,1.77,5,.73,.12)]:
        d=bpy.data.lights.new('CCR_'+label,'AREA');d.shape='RECTANGLE';d.energy=power;d.color=(1,.68,.35)
        d.size=width;d.size_y=depth;d.use_shadow=False;d.use_custom_distance=True;d.cutoff_distance=1.5
        ob=bpy.data.objects.new(d.name,d);col.objects.link(ob);ob.location=(x+shift,y,z)
        ob.rotation_euler=(Vector((x+shift,.30,1.18))-ob.location).to_track_quat('-Z','Y').to_euler()
row=bpy.data.objects['CCR_Row_00'];camera=bpy.data.objects['CCR_CounterView']
camera.location=row.matrix_world@Vector((3.3,-4.7,1.72));target=row.matrix_world@Vector((3.8,.2,1.85))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=23.5
print('Bounded cabinet lighting and an unobstructed actual-concourse counter camera added')
