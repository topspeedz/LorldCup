import bpy,bmesh,ast,math,json
from math import sin,cos,pi
from mathutils import Vector
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026');OUT=ROOT/'reference-match'
assert Path(bpy.data.filepath).resolve()==(ROOT/'barclays-worlds-2026.blend').resolve()
scene=bpy.data.scenes['Barclays • WORLDS 2026'];col=bpy.data.collections['ReferenceMatch'];root=bpy.data.objects['REF_StageOrigin'];S=-9.1
mats={m.name[4:]:m for m in bpy.data.materials if m.name.startswith('REF_')};batches={}
src=ast.parse((ROOT/'build_scene.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'add','box','beam'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
src=ast.parse((OUT/'build-stage.py').read_text(encoding='utf-8'))
for n in src.body:
    if isinstance(n,ast.FunctionDef) and n.name in {'mesh_obj','text'}:exec(compile(ast.Module(body=[n],type_ignores=[]),'helpers','exec'))
font=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')

light_before=[]
for o in scene.objects:
    if o.type=='LIGHT' and (o.name.startswith('Stage_key') or o.name.startswith('Blue_arena_light')):
        light_before.append(dict(name=o.name,energy=o.data.energy,color=list(o.data.color)))
        o.data.energy=0
# Isolate this look from the prior world's stored shader data.
old_world=scene.world;scene.world=old_world.copy();scene.world.name='REF_NightArena'
for n in scene.world.node_tree.nodes:
    if n.type=='BACKGROUND':n.inputs['Strength'].default_value=.035
scene.eevee.use_raytracing=True;scene.eevee.ray_tracing_method='SCREEN'
scene.eevee.ray_tracing_options.screen_trace_quality=1
scene.eevee.ray_tracing_options.trace_max_roughness=.65
scene.eevee.ray_tracing_options.screen_trace_thickness=.12
scene.eevee.volumetric_tile_size='4';scene.eevee.volumetric_samples=64;scene.eevee.use_volumetric_shadows=True
scene.eevee.taa_render_samples=48
scene.view_settings.exposure=0
floor=bpy.data.objects['Walk_ArenaFloor__black'];floor.data.materials.clear();floor.data.materials.append(mats['Deck'])

def light(name,kind,loc,target,color,power,size=1,angle=.22):
    d=bpy.data.lights.new('REF_'+name,kind);d.energy=power;d.color=color
    if kind=='SPOT':d.spot_size=angle;d.spot_blend=.42;d.shadow_soft_size=.09
    if kind=='AREA':d.shape='DISK';d.size=size
    o=bpy.data.objects.new('REF_'+name,d);col.objects.link(o);o.parent=root;o.location=loc;o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();return o

gold=(1,.47,.12);cyan=(.03,.63,1);pink=(1,.025,.30)
for side in [-1,1]:
    color=gold if side<0 else cyan
    for i in range(8):
        x=side*(11+i*1.75);y=5-i*1.0;z=17.5+(i%2)*1.5
        target=(side*(5+(i%4)*2.1),-6+i*.8,S)
        c=color if side<0 or i%3 else pink
        light('OverheadBeam_'+str(side)+'_'+str(i),'SPOT',(x,y,z),target,c,4500,angle=.13+(i%3)*.035)
        box('BeamFixture',(x,y,z),(.5,.55,.45),'Rubber');beam('BeamLens',(x,y,z-.22),(x,y,z-.26),.16,'Gold' if side<0 else 'Pink' if i%3==0 else 'Cyan',12)
    light('TeamKey_'+str(side),'AREA',(side*7.2,-3,2),(side*7.2,0,S+1.2),(.8,.88,1) if side>0 else (1,.86,.65),1800,size=7)
    light('BackdropWash_'+str(side),'AREA',(side*8,6,S+1.5),(side*8,8.4,S+4),color,950,size=4)
    light('ScenicRim_'+str(side),'AREA',(side*13,9,S+3),(side*7,2,S),color,1300,size=5)
    for k in range(6):
        t=(-pi/2+pi*k/5) if side>0 else (pi/2+pi*k/5)
        x=40*cos(t);y=38*sin(t)
        light('BowlWash_'+str(side)+'_'+str(k),'AREA',(x*.75,y*.75,5),(x,y,2),color,1300,size=10)
    for j in range(5):
        x=side*(5+j*1.65)
        light('WingUplight_'+str(side)+'_'+str(j),'SPOT',(x,7.0,S+.15),(x,8.4,S+5),color,160,angle=.55)
        box('WingFixture',(x,7,S+.16),(.23,.25,.30),'Rubber')
light('TrophySpecial','SPOT',(0,-9.4,S+8.0),(0,-9.4,S+.2),(.88,.94,1),2100,angle=.31)
light('TrophyFill','AREA',(0,-14,S+4),(0,-9.4,S+1.8),(.92,.95,1),500,size=3)
light('DeckSoftbox','AREA',(0,-2,5),(0,-3,S),(.5,.62,.85),650,size=12)

# A physical scattering volume, not transparent cone meshes.
vol=bpy.data.materials.new('REF_Atmosphere');vol.use_nodes=True;vol.node_tree.nodes.clear()
out=vol.node_tree.nodes.new('ShaderNodeOutputMaterial');scatter=vol.node_tree.nodes.new('ShaderNodeVolumeScatter');scatter.inputs['Density'].default_value=.005;scatter.inputs['Anisotropy'].default_value=.35
vol.node_tree.links.new(scatter.outputs['Volume'],out.inputs['Volume']);mats['Atmosphere']=vol
box('Atmosphere',(0,0,7),(185,155,37),'Atmosphere')

# Team-colored ribbon bands and aisle light colors use the existing stadium geometry.
for name in ['Tier_ribbon__blue','Tier_ribbon_light__cyan','Aisle_step_lights__cyan','AudienceDetail_Aisle_guides','AudienceDetail_Ribbon_chevrons']:
    o=bpy.data.objects.get(name)
    if not o:continue
    o.data=o.data.copy();o.data.materials.clear()
    for ma in ['GoldWaves','BlueWaves'] if name=='Tier_ribbon__blue' else ['Gold','Cyan','Pink']:o.data.materials.append(mats[ma])
    for p in o.data.polygons:p.material_index=0 if p.center.y>0 else (1 if len(o.data.materials)==2 or p.index%6 else 2)
for tier,rx,ry,z in [(0,55.86,45.86,-.01),(1,85.86,70.86,20.69)]:
    for j in range(32):
        t=2*pi*(j+.5)/32;x=rx*cos(t);y=ry*sin(t)
        # Local axes swapped to line up with the preserved world-space bowl.
        xx,yy=-y,x;angle=math.atan2(ry*cos(t),-rx*sin(t))-pi/2
        text('RibbonBrand_'+str(tier)+'_'+str(j),'GEN.G' if xx<0 else 'BLG',(xx,yy,z+.28),.42,'Gold' if xx<0 else 'Cyan',(pi/2,0,angle))

count=0
for ob in [o for o in scene.objects if o.name.startswith('Audience_heads__')]:
    assert len(ob.data.vertices)%32==0
    for k in range(0,len(ob.data.vertices),32*2):
        c=sum((ob.data.vertices[k+j].co for j in range(32)),Vector())/32;x,y=-c.y,c.x
        ma='Gold' if x<0 else ('Pink' if count%3==0 else 'Cyan')
        beam('FanLightsticks',(x+.18,y,c.z-.3),(x+.18+.08*sin(count),y-.04,c.z+.15),.018,ma,5);count+=1

for (name,ma),(v,f) in batches.items():
    ob=mesh_obj(name+'__'+ma,v,f,ma);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()

for name,loc,target,lens in [('Front',(0,-40,1.7),(0,0,-2.0),32),('East',(29,-27,1.5),(0,0,-2.0),32),('Rear',(0,35,3),(0,0,-2.2),30),('Top',(0,-21,31),(0,0,S),38)]:
    d=bpy.data.cameras.new('REF_Camera_'+name);d.lens=lens;d.clip_start=.08;d.clip_end=500
    o=bpy.data.objects.new('REF_Camera_'+name,d);col.objects.link(o);o.parent=root;o.location=loc;o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
scene.camera=bpy.data.objects['REF_Camera_Front']
# Blender 5.2 compositor uses a scene-owned node group.
group=bpy.data.node_groups.new('REF_EventBloom','CompositorNodeTree');scene.compositing_node_group=group
group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
rl=group.nodes.new('CompositorNodeRLayers');out=group.nodes.new('NodeGroupOutput');glare=group.nodes.new('CompositorNodeGlare')
group.links.new(rl.outputs['Image'],glare.inputs['Image']);group.links.new(glare.outputs['Image'],out.inputs['Image'])
print('GLARE_INPUTS',[(i.name,str(i.default_value)) for i in glare.inputs if hasattr(i,'default_value')])
(OUT/'lighting-report.json').write_text(json.dumps({'old_lights':light_before,'new_lights':len([o for o in col.objects if o.type=='LIGHT']),'fan_lightsticks':count,'old_world':old_world.name},indent=2),encoding='utf-8')
print('Lighting committed',count)
