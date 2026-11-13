import bpy
from mathutils import Vector
review=bpy.data.scenes.new('Concourse Cutaway Review');review.use_fake_user=True
review.render.engine=bpy.data.scenes['Concourse Reference Review'].render.engine
review.render.resolution_x=1440;review.render.resolution_y=960;review.render.resolution_percentage=100
review.eevee.taa_render_samples=96;review.eevee.use_raytracing=True
review.render.use_compositing=False
world=bpy.data.worlds.new('CCR_Cutaway dark surround');world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.025,.028,.032,1);bg.inputs['Strength'].default_value=.4;review.world=world
row=bpy.data.objects['CCR_MainEntry_North'].copy();row.name='CCR_CutawayRow';review.collection.objects.link(row)
vertices=[(x,y,z) for z in [-.18,0] for x,y in [(-87.3,4.8),(-70.7,4.8),(-70.7,15.4),(-87.3,15.4)]]
me=bpy.data.meshes.new('CCR_Review floor cut');me.from_pydata(vertices,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.update()
me.materials.append(bpy.data.materials['CCR_Charcoal stone floor with 1200mm joints'])
ob=bpy.data.objects.new('CCR_Review floor cut',me);review.collection.objects.link(ob)
bevel=ob.modifiers.new('Floor slab edge','BEVEL');bevel.width=.015;bevel.segments=2
camera=bpy.data.objects['CCR_CutawayView'];review.collection.objects.link(camera)
camera.location=(-61,-9,14.8);camera.rotation_euler=(Vector((-79,10.2,1.65))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type=next(i.identifier for i in camera.data.bl_rna.properties['type'].enum_items if i.identifier=='ORTHO')
camera.data.ortho_scale=23.5;review.camera=camera
d=bpy.data.lights.new('CCR_Cutaway softbox','AREA');d.energy=1400;d.color=(1,.82,.64);d.shape='DISK';d.size=10
ob=bpy.data.objects.new(d.name,d);review.collection.objects.link(ob);ob.location=(-80,4,11)
ob.rotation_euler=(Vector((-79,11,1.8))-ob.location).to_track_quat('-Z','Y').to_euler()
print('Isolated cutaway review created; actual arena geometry remains intact')
