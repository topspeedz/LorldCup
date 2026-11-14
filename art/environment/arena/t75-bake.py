"""T75 single bake pass, adapted from t32-bake.py; only changed atlas groups."""
import bpy, bmesh, numpy as np, json, math, time, sys
from pathlib import Path
ART=Path(__file__).resolve().parent
ROOT=ART.parents[2]
OUT=ROOT/'temp/T75'
s=bpy.data.scenes['Barclays • WORLDS 2026'];bpy.context.window.scene=s
assert json.loads((ROOT/'_workspace/gpu-lock.json').read_text())['owner']=='T75'
from mathutils import Vector
from bpy_extras.bmesh_utils import bmesh_linked_uv_islands
exec(compile((ART/'t32-lightmap-math.py').read_text(encoding='utf-8'),'t32-lightmap-math.py','exec'),globals())
exec(compile((ART/'t32-denoise.py').read_text(encoding='utf-8'),'t32-denoise.py','exec'),globals())

repair=globals().get('rebake_concourse_only',False)
assert Path(bpy.data.filepath).resolve()==ART/'barclays-arena-t75.blend'
LM=OUT/'lightmaps';LM.mkdir(exist_ok=True)
start_bake=time.perf_counter()
scene=s
dynamic=[o for o in scene.objects if o.type=='MESH' and (o.data.attributes.get('_CM_PART') or o.name.startswith('REF_Player') or o.name.endswith('__lod10'))]
for ob in dynamic:ob.hide_render=True
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=64
scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=2
scene.cycles.use_denoising=True
scene.render.bake.margin=2;scene.render.bake.use_clear=True
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=False
interior_world=scene.world
glass=bpy.data.materials.get('CCR_Clear display glass')
if glass:
    ns=glass.node_tree.nodes;lk=glass.node_tree.links;glass_p=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    glass_p.inputs['Metallic'].default_value=1;glass_p.inputs['Transmission Weight'].default_value=0
    glass_p.inputs['Base Color'].default_value=(1,1,1,1);glass_p.inputs['Alpha'].default_value=1
    glass_output=next(n for n in ns if n.type=='OUTPUT_MATERIAL')
    lk.new(next(n for n in ns if n.type=='MIX_SHADER').outputs[0],glass_output.inputs['Surface'])
    glass['thinGlassIOR']=1.42

def used_materials(ob):
    return [ob.data.materials[i] for i in sorted({p.material_index for p in ob.data.polygons}) if i<len(ob.data.materials) and ob.data.materials[i]]
def principled(mat):return next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if mat.use_nodes else None
def emitting(mat):
    p=principled(mat)
    return p is not None and p.inputs['Emission Strength'].default_value>.01
def reflective(mat):
    p=principled(mat)
    return p is not None and (p.inputs['Metallic'].default_value>=.6 or p.inputs['Transmission Weight'].default_value>.05 or 'glass' in mat.name.lower())

groups={k:[] for k in ['stage','bowl','seats','interior']}
skip=[]
for ob in scene.objects:
    if ob.type!='MESH' or ob.hide_render or not ob.data.polygons:continue
    info=ob.get('bakedLighting')
    if info:
        key=Path(info['texture']).name.split('-v2')[0]
    elif ob.name.startswith('Walk_Ramp'):key='bowl'
    elif ob.name.startswith(('Collide_RampAInfill','Collide_RampBInfill','Collide_EntryLowCurbs')):key='interior'
    else:
        skip.append(ob.name);continue
    if key in groups:groups[key].append(ob)

report={'source':str(bpy.data.filepath),'samples':scene.cycles.samples,'device':'OPTIX','pass':'DIFFUSE DIRECT+INDIRECT, no COLOR','dynamic_excluded':[o.name for o in dynamic],'reflective_or_emissive_unbaked':skip,'atlases':[]}
if repair:
    previous=json.loads((OUT/'lightmap-report.json').read_text());report['source']=previous['source']
    report['atlases']=[a for a in previous['atlases'] if a['name']!='concourse'];groups={'concourse':groups['concourse']}
(OUT/'lightmap-report.json').write_text(json.dumps(report,indent=2))
# Apply only export-time modifiers so the UVs match exported topology exactly.
for ob in sum(groups.values(),[]):
    if ob.modifiers:
        dg=bpy.context.evaluated_depsgraph_get();evaluated=ob.evaluated_get(dg)
        ob.data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=dg)
        ob.modifiers.clear()

for key,objects in groups.items():
    if not objects:continue
    tick=time.perf_counter();print('LIGHTMAP_START',key,len(objects),flush=True)
    scene.world=interior_world
    verts=[];faces=[];mi=[];smooth=[];uv_names=set();materials=[];mat_ids={};spans=[]
    for ob in objects:uv_names.update(uv.name for uv in ob.data.uv_layers)
    # Default UV sampling is made explicit per object when a shared material has different UV names.
    uv_values={name:[] for name in uv_names};uv_values['_BakeAlbedo']=[]
    for ob in objects:
        me=ob.data;vbase=len(verts)
        loop_start=sum(len(f) for f in faces) if not spans else spans[-1][2]
        verts.extend(tuple(ob.matrix_world@v.co) for v in me.vertices)
        first=next((u for u in me.uv_layers if u.active_render),me.uv_layers.active)
        slots={}
        for mat_index in {p.material_index for p in me.polygons}:
            orig=me.materials[mat_index] if mat_index<len(me.materials) else None
            if orig is None:raise RuntimeError('Missing bake material '+ob.name)
            mk=(orig.name,first.name if first else '')
            if mk not in mat_ids:
                material=orig.copy();nodes=material.node_tree.nodes;links=material.node_tree.links;p=principled(material)
                # A diffuse transport bake is independent of the final metal/specular BRDF.
                if p:
                    for link in list(p.inputs['Metallic'].links):links.remove(link)
                    p.inputs['Metallic'].default_value=0
                uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='_BakeAlbedo'
                for node in list(nodes):
                    if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:links.new(uvnode.outputs[0],node.inputs['Vector'])
                    if node.type=='TEX_COORD':
                        for link in list(node.outputs['UV'].links):links.new(uvnode.outputs[0],link.to_socket)
                mat_ids[mk]=len(materials);materials.append(material)
            slots[mat_index]=mat_ids[mk]
        for p in me.polygons:
            faces.append(tuple(vbase+i for i in p.vertices));mi.append(slots[p.material_index]);smooth.append(p.use_smooth)
        count=len(me.loops)
        for name in uv_values:
            layer=first if name=='_BakeAlbedo' else me.uv_layers.get(name)
            values=np.zeros(count*2,dtype=np.float32)
            if layer:layer.data.foreach_get('uv',values)
            uv_values[name].extend(values.reshape(-1,2))
        spans.append((ob,loop_start,loop_start+count))
    mesh=bpy.data.meshes.new('Lightmap bake '+key);mesh.from_pydata(verts,[],faces);mesh.update()
    proxy=bpy.data.objects.new('Lightmap bake '+key,mesh);scene.collection.objects.link(proxy)
    for material in materials:mesh.materials.append(material)
    for poly,idx,sm in zip(mesh.polygons,mi,smooth):poly.material_index=idx;poly.use_smooth=sm
    for name,values in uv_values.items():mesh.uv_layers.new(name=name).data.foreach_set('uv',np.asarray(values,dtype=np.float32).reshape(-1))
    # Every polygon has its own planar chart with a two-pixel border. No overlapping reuse.
    size=4096 if key in ('bowl','seats','exterior','concourse') else 2048
    if key=='stage':size=2048
    positions=np.asarray(verts,dtype=np.float32);extents=[];charts=[]
    lighting_uv=mesh.uv_layers.new(name='LightingBake');mesh.uv_layers.active=lighting_uv
    if key=='concourse':
        # Join coplanar cafe bevel faces into islands; per-face padding would exceed a 4K atlas.
        bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.151917,margin_method='FRACTION',island_margin=2/size)
        bpy.ops.object.mode_set(mode='OBJECT')
        # Edit mode rebuilds RNA layer storage; reacquire it before reading the UV data.
        lighting_uv=mesh.uv_layers['LightingBake']
        loop_vertices=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',loop_vertices)
        assert np.array_equal(loop_vertices,np.fromiter((v for face in faces for v in face),dtype=np.int32)),'UV unwrap reordered export loops'
        uv=np.empty(len(mesh.loops)*2,dtype=np.float32);lighting_uv.data.foreach_get('uv',uv);uv=uv.reshape(-1,2);density=None
        # Skinny timber islands must cover several texels, not disappear between pixel centres.
        bm=bmesh.new();bm.from_mesh(mesh);bm.faces.index_update()
        islands=[np.array([li for face in island for li in mesh.polygons[face.index].loop_indices]) for island in bmesh_linked_uv_islands(bm,bm.loops.layers.uv['LightingBake'])]
        bm.free()
        lows=np.array([uv[loops].min(axis=0) for loops in islands])
        extents=np.maximum(np.array([np.ptp(uv[loops],axis=0) for loops in islands]),1e-8)
        origins,dims,_=pack_charts(extents,size)
        assert dims.min()>=3,'Subpixel cafe lightmap island'
        for loops,low,extent,origin,dim in zip(islands,lows,extents,origins,dims):
            uv[loops]=(origin+(uv[loops]-low)/extent*dim)/size
        lighting_uv.data.foreach_set('uv',uv.reshape(-1))
        print('CAFE_UV_ISLANDS',len(islands),'MIN_PIXELS',float(dims.min()),flush=True)
    else:
        for poly in mesh.polygons:
            chart,extent=planar_chart(positions[list(poly.vertices)],poly.normal)
            extents.append(extent);charts.append(chart)
        origins,dims,density=pack_charts(extents,size)
        uv=np.concatenate([(origin+chart*dim)/size for origin,chart,dim in zip(origins,charts,dims)]).astype(np.float32)
        lighting_uv.data.foreach_set('uv',uv.reshape(-1))
    assert np.isfinite(uv).all() and uv.min()>=0 and uv.max()<=1
    for ob,a,b in spans:
        existing=ob.data.attributes.get('_LIGHTMAP_UV')
        if existing:ob.data.attributes.remove(existing)
        attr=ob.data.attributes.new('_LIGHTMAP_UV','FLOAT2','CORNER');coords=uv[a:b].copy();coords[:,1]=1-coords[:,1];attr.data.foreach_set('vector',coords.reshape(-1))
        ob.hide_render=True
    image=bpy.data.images.new('Static light '+key,width=size,height=size,alpha=True,float_buffer=True)
    image.colorspace_settings.name='Non-Color'
    for material in materials:
        target=material.node_tree.nodes.new('ShaderNodeTexImage');target.image=image;material.node_tree.nodes.active=target
    bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},uv_layer='LightingBake')
    pixels=np.empty(size*size*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(size,size,4)
    assert np.isfinite(pixels).all(),key
    # Cycles render denoising does not denoise bake images; explicitly filter the linear transport.
    pixels[...,:3]=denoise(pixels[...,:3])
    rgba,scale=encode_rgbm(pixels[...,:3])
    old_range={'stage':128,'bowl':16,'seats':8,'interior':16}[key]
    if scale<old_range:
        scale=old_range
        multiplier=np.maximum(np.ceil(np.max(pixels[...,:3],axis=-1)/scale*255)/255,1/255)
        rgba=np.rint(np.clip(np.concatenate((pixels[...,:3]/(multiplier[...,None]*scale),multiplier[...,None]),axis=-1),0,1)*255).astype(np.uint8)
    target=bpy.data.images.new('RGBM '+key,width=size,height=size,alpha=True);target.colorspace_settings.name='Non-Color';target.alpha_mode='CHANNEL_PACKED'
    target.pixels.foreach_set((rgba.astype(np.float32)/255).reshape(-1));target.filepath_raw=str(LM/(key+'-v2.png'));target.file_format='PNG';target.save()
    decoded=rgba[...,:3]/255*(rgba[...,3:]/255)*scale
    for ob,a,b in spans:
        ob.hide_render=False
        ob['bakedLighting']={'texture':'./lightmaps/'+key+'-v2.png','range':scale,'uvAttribute':'_lightmap_uv'}
    entry={'name':key,'size':size,'range':scale,'objects':[o.name for o in objects],'faces':len(faces),'texels_per_metre':density,'max':float(pixels[...,:3].max()),'mean':float(pixels[...,:3].mean()),'encode_mean_error':float(np.abs(decoded-pixels[...,:3]).mean()),'seconds':time.perf_counter()-tick}
    report['atlases'].append(entry);(OUT/'lightmap-report.json').write_text(json.dumps(report,indent=2))
    print('LIGHTMAP_DONE',key,entry['seconds'],entry['mean'],flush=True)
    bpy.data.objects.remove(proxy,do_unlink=True);bpy.data.meshes.remove(mesh)
    for material in materials:bpy.data.materials.remove(material)
    bpy.data.images.remove(image);bpy.data.images.remove(target)
    del pixels,rgba,decoded,verts,faces,charts,uv_values,positions

scene.world=interior_world
if glass:
    # glTF carries the reflective layer; the viewer restores the source's Fresnel transparency.
    glass_p.inputs['Alpha'].default_value=((1.42-1)/(1.42+1))**2
    glass.node_tree.links.new(glass_p.outputs[0],glass_output.inputs['Surface'])
for ob in dynamic:ob.hide_render=False
scene.render.engine='BLENDER_EEVEE'
report['seconds']=time.perf_counter()-start_bake
report['toneMapping']={'view':'AgX','look':scene.view_settings.look,'exposureEV':scene.view_settings.exposure,'gamma':scene.view_settings.gamma}
(OUT/'lightmap-report.json').write_text(json.dumps(report,indent=2))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'barclays-arena-t75-baked.blend'),copy=True)
print('LIGHTMAP_COMPLETE',report['seconds'],flush=True)
