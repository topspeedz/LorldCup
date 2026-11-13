import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/exterior-reference')
col=bpy.data.collections['EXR_Architecture']
for name in ['Canopy soffit panels','Canopy upper panels','Canopy fascia louvers','Canopy fascia backing','Oculus inner LED ribbon','Canopy recessed downlights']:
    bpy.data.objects['EXR_'+name].location.x=-15
bpy.data.objects['EXR_BARCLAYS CENTER'].location.x=-145.35
for name in ['Turquoise shield','Eagle sign']:bpy.data.objects['EXR_'+name].location.x=-15
for name in ['Entrance glazing','Entrance mullions','Entrance transoms']:
    bpy.data.objects['EXR_'+name].location.x=-19
used={m for o in col.objects if o.type in ('MESH','FONT') for m in o.data.materials if m}
for m in used:
    if 'Weathered steel' in m.name:
        ns=m.node_tree.nodes
        ramp=next(n for n in ns if n.type=='VALTORGB')
        i=int(m.name.split('steel ')[1][:2]);base=(.16+i*.013,.042+i*.0048,.016+i*.0025)
        ramp.color_ramp.elements[0].color=(*(v*.78 for v in base),1)
        ramp.color_ramp.elements[1].color=(*(v*1.16 for v in base),1)
        for n in ns:
            if n.type=='TEX_NOISE' and n.inputs['Scale'].default_value<10:n.inputs['Scale'].default_value=6
    if 'Unbranded oculus LED' in m.name:
        p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        p.inputs['Base Color'].default_value=(.018,.065,.078,1)
        p.inputs['Emission Color'].default_value=(.04,.17,.22,1);p.inputs['Emission Strength'].default_value=.5
    if 'Blue grey architectural glass' in m.name:
        p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        p.inputs['Base Color'].default_value=(.058,.10,.11,1);p.inputs['Metallic'].default_value=.75;p.inputs['Roughness'].default_value=.105
for i,x in enumerate(range(-49,50,14)):
    name='EXR_Entrance downlight %02d'%i
    if name in bpy.data.objects:continue
    ld=bpy.data.lights.new(name,'AREA');ld.energy=180;ld.color=(1,.76,.51);ld.shape='DISK';ld.size=4
    ob=bpy.data.objects.new(name,ld);col.objects.link(ob);ob.location=(-134,-x,21)
def aim(name,loc,target,lens):
    ob=bpy.data.objects['EXR_'+name];ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();ob.data.lens=lens
aim('Front',(-213,0,2.5),(-124,0,18),20)
aim('ThreeQuarter',(-262,181,44),(-41,0,18),40)
aim('Aerial',(-277,205,164),(-25,0,18),44)
aim('PanelDetail',(-32,99,31),(-4,74,28),55)
aim('Oculus',(-151,8,3),(-117,4,24),20)
review=bpy.data.scenes['Exterior Reference Review'];review.camera=bpy.data.objects['EXR_Front']
review.render.use_compositing=False;review.render.use_sequencer=False
review.render.resolution_x=1600;review.render.resolution_y=1000;review.render.resolution_percentage=100
review.eevee.taa_render_samples=48;review.eevee.use_raytracing=True
review.world.use_nodes=True;ns=review.world.node_tree.nodes;lk=review.world.node_tree.links
bg=next(n for n in ns if n.type=='BACKGROUND');bg.inputs['Strength'].default_value=.55
env=ns.new('ShaderNodeTexEnvironment');env.image=bpy.data.images['city-sky.jpg'];lk.new(env.outputs['Color'],bg.inputs['Color'])
bpy.context.window.scene=review
print('Exterior materials, cameras and architectural lighting finished')
