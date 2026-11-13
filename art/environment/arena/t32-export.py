"""Export-only conversion of a snapshot. Never saves or alters the live source blend."""
import bpy,json,math,time,sys,numpy as np
from pathlib import Path
ART=Path(__file__).resolve().parent
ROOT=ART.parents[2]
OUT=ART/'t32-bake';OUT.mkdir(exist_ok=True)
assert Path(bpy.data.filepath).resolve()==ART/'barclays-arena-v2.blend'
assert json.loads((ROOT/'_workspace/gpu-lock.json').read_text())['owner']=='T32'
s=bpy.data.scenes['Barclays • WORLDS 2026'];bpy.context.window.scene=s
keep=set(json.loads((ROOT/'web-lightmaps/floor-fix/visible-objects.json').read_text()));excluded=[]
keep.update(json.loads((ART/'t32-source-inspection.json').read_text())['added'])
(OUT/'visible-objects.json').write_text(json.dumps(sorted(keep),indent=2))
exec(compile((ART/'t32-motifs.py').read_text(encoding='utf-8'),'t32-motifs.py','exec'))
for ob in list(s.objects):
    if ob.name not in keep or ob.name=='REF_Atmosphere__Atmosphere':excluded.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
for ob in s.objects:
    for key in list(ob.keys()):
        if key.startswith('T31_'):del ob[key]
    if ob.name=='EXR_Review sun':ob.hide_render=True
if any(o.instance_collection and o.name.startswith('CCR_') for o in s.objects):
    exec(compile((ROOT/'web-lightmaps/prepare-concourse.py').read_text(encoding='utf-8'),'prepare-concourse.py','exec'))
s.frame_set(1)
animated=[]
for ob in s.objects:
    if ob.type=='MESH' and ob.data.attributes.get('cm_part'):
        animated.append(ob.name)
        for mod in list(ob.modifiers):
            if mod.type=='NODES' and mod.node_group.name=='CrowdMotion_SeatedReactions':ob.modifiers.remove(mod)
        for attr in ob.data.attributes:
            if attr.name.startswith('cm_'):attr.name='_'+attr.name.upper()
        ob['crowdMotion']=True;ob['crowdDuration']=30;ob['crowdCoordinates']='Blender local Z-up'
assert len(animated)==14

# Existing PBR image materials keep their original UVs. Add the same box projection only where missing.
config=json.loads((ROOT/'materials/materials.json').read_text())
uv_added=[]
for ob in s.objects:
    if ob.type!='MESH':continue
    me=ob.data
    used=[m for m in me.materials if m and m.use_nodes]
    if any(n.type=='UVMAP' and n.uv_map=='ShaderUV' for m in used for n in m.node_tree.nodes) and not me.uv_layers.get('ShaderUV'):
        uv=me.uv_layers.new(name='ShaderUV')
        for poly in me.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]));pair=[i for i in range(3) if i!=axis]
            mat=me.materials[poly.material_index];tile=config.get(mat.name,{}).get('tile',[1,1])
            for li in poly.loop_indices:
                co=ob.matrix_world@me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[pair[0]]/tile[0],co[pair[1]]/tile[1])
        uv_added.append(ob.name)

# Bake the three remaining procedural surface inputs to portable image textures.
bake_scene=bpy.data.scenes.new('Export material bake');bpy.context.window.scene=bake_scene;bake_scene.render.engine='CYCLES';bake_scene.cycles.samples=1
bake_scene.render.bake.margin=8;bake_scene.render.bake.use_clear=True
quad=bpy.data.meshes.new('Export bake quad');quad.from_pydata([(0,0,0),(1,0,0),(1,1,0),(0,1,0)],[],[(0,1,2,3)])
uv=quad.uv_layers.new(name='UVMap')
for li,xy in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=xy
plane=bpy.data.objects.new('Export bake quad',quad);bake_scene.collection.objects.link(plane);plane.select_set(True);bpy.context.view_layer.objects.active=plane
baked=[]
channels=[('REF_Deck','Roughness'),('REF_GoldWaves','Base Color'),('REF_BlueWaves','Base Color')]
used={m.name for o in s.objects if o.type=='MESH' for m in o.data.materials if m}
channels.extend((name,'Base Color') for name in sorted(used) if name.startswith(('EXR_Weathered steel','EXR_Sedum roof')))
for name,channel in channels:
    original=bpy.data.materials[name];mat=original.copy();quad.materials.clear();quad.materials.append(mat)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');source=p.inputs[channel].links[0].from_socket
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');em=nodes.new('ShaderNodeEmission');links.new(source,em.inputs['Color']);links.new(em.outputs[0],output.inputs['Surface'])
    size=256 if name.startswith('EXR_') else 1024
    image=bpy.data.images.new(name+' WebBake',width=size,height=size,alpha=False)
    if channel=='Roughness':image.colorspace_settings.name='Non-Color'
    target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
    bpy.ops.object.bake(type='EMIT');image.filepath_raw=str(OUT/(name+'-baked.png'));image.file_format='PNG';image.save();image.pack()
    nodes=original.node_tree.nodes;links=original.node_tree.links;p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    tex=nodes.new('ShaderNodeTexImage');tex.image=image;uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='Architectural metres' if name.startswith('EXR_') else 'WebBakeUV';links.new(uvnode.outputs['UV'],tex.inputs['Vector']);links.new(tex.outputs['Color'],p.inputs[channel])
    if channel=='Base Color' and p.inputs['Emission Color'].is_linked:links.new(tex.outputs['Color'],p.inputs['Emission Color'])
    baked.append(name)
bpy.context.window.scene=s;bpy.data.scenes.remove(bake_scene)
for ob in s.objects:
    if ob.type!='MESH' or not any(m and m.name in baked and not m.name.startswith('EXR_') for m in ob.data.materials):continue
    me=ob.data;uv=me.uv_layers.get('WebBakeUV') or me.uv_layers.new(name='WebBakeUV')
    lo=[min(v.co[i] for v in me.vertices) for i in range(3)];hi=[max(v.co[i] for v in me.vertices) for i in range(3)]
    for poly in me.polygons:
        for li in poly.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=((co.x-lo[0])/max(hi[0]-lo[0],1e-6),(co.y-lo[1])/max(hi[1]-lo[1],1e-6))

# Expose unsupported area-light and beam configuration for the companion web renderer.
lights=[]
for ob in s.objects:
    if ob.type=='LIGHT' and ob.name.startswith(('REF_','CCR_')):
        lights.append(dict(name=ob.name,type=ob.data.type,position=list(ob.matrix_world.translation),direction=list(ob.matrix_world.to_quaternion()@__import__('mathutils').Vector((0,0,-1))),color=list(ob.data.color),energy=ob.data.energy,spot_size=ob.data.spot_size if ob.data.type=='SPOT' else None))
(OUT/'web-lighting.json').write_text(json.dumps(lights,indent=2),encoding='utf-8')

# Blender cannot calculate tangent space on ngons; triangulate only those export faces.
triangulated=[]
depsgraph=bpy.context.evaluated_depsgraph_get()
for ob in s.objects:
    if ob.type!='MESH':continue
    if not any(m and m.use_nodes and any(n.type=='NORMAL_MAP' for n in m.node_tree.nodes) for m in ob.data.materials):continue
    if any(len(p.vertices)>4 for p in ob.evaluated_get(depsgraph).data.polygons):
        modifier=ob.modifiers.new('Web export ngon tangents','TRIANGULATE');modifier.min_vertices=5
        triangulated.append(ob.name)

exec(compile((ART/'t32-bake.py').read_text(encoding='utf-8'),'t32-bake.py','exec'))
start=time.perf_counter()
result=bpy.ops.export_scene.gltf(filepath=str(ROOT/'web/arena-v2.glb'),export_format='GLB',check_existing=False,
    use_active_scene=True,use_visible=True,use_renderable=True,export_materials='EXPORT',export_texcoords=True,
    export_normals=True,export_tangents=True,export_attributes=True,export_extras=True,export_animations=False,export_apply=True,
    export_cameras=True,export_lights=False,export_image_format='AUTO',export_image_quality=95,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=20,export_draco_normal_quantization=12,export_draco_texcoord_quantization=16,
    export_draco_generic_quantization=24)
assert 'FINISHED' in result
report=dict(output=str(ROOT/'web/arena-v2.glb'),bytes=(ROOT/'web/arena-v2.glb').stat().st_size,export_seconds=time.perf_counter()-start,
            animated_objects=animated,baked_materials=baked,added_uv_objects=uv_added,triangulated_ngon_objects=triangulated,excluded_count=len(excluded),
            standard_animations=False,animation_runtime='web/crowd-motion.js',audio='web/crowd-performance.mp3',source_blend_untouched=True)
(OUT/'export-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
