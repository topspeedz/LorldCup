import bpy,json,hashlib
import numpy as np
from pathlib import Path
ROOT=Path(r'D:/Blender/Blender/barclays-worlds-2026')
config=json.loads((ROOT/'materials/materials.json').read_text())
scene=bpy.context.scene

def geometry_signature():
    digest=hashlib.sha256()
    for ob in sorted(scene.objects,key=lambda o:o.name):
        digest.update(ob.name.encode());digest.update(np.array(ob.matrix_world,dtype=np.float32).tobytes())
        if ob.type=='MESH':
            a=np.empty(len(ob.data.vertices)*3,dtype=np.float32);ob.data.vertices.foreach_get('co',a);digest.update(a.tobytes())
    return digest.hexdigest()

before=geometry_signature();images={}
def texture(mat,name,space):
    path=ROOT/'materials'/name
    if name not in images:
        im=bpy.data.images.load(str(path),check_existing=True);im.colorspace_settings.name=space;im.pack();images[name]=im
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=images[name];node.label='PBR / '+name;return node

changed=[]
for name,d in config.items():
    mat=bpy.data.materials.get(name)
    if mat is None:continue
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='ShaderUV';uv.location=(-900,100)
    color=texture(mat,name+'-color.png','sRGB');color.location=(-620,250)
    rough=texture(mat,d['family']+'-rough.png','Non-Color');rough.location=(-620,0)
    normal=texture(mat,d['family']+'-normal.png','Non-Color');normal.location=(-620,-260)
    for n in [color,rough,normal]:links.new(uv.outputs['UV'],n.inputs['Vector'])
    links.new(color.outputs['Color'],bs.inputs['Base Color']);links.new(rough.outputs['Color'],bs.inputs['Roughness'])
    nm=nodes.new('ShaderNodeNormalMap');nm.location=(-300,-220);nm.inputs['Strength'].default_value=.65
    links.new(normal.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value=d['metal']
    if name in ['ivory','blue','seat','seat2','glass']:
        bs.inputs['Coat Weight'].default_value=.5 if name=='glass' else .2
        bs.inputs['Coat Roughness'].default_value=.12 if name=='glass' else .25
    if name=='glass':bs.inputs['IOR'].default_value=1.46;bs.inputs['Transmission Weight'].default_value=.12
    changed.append(name)

# Box projection sets real-world tile density on the existing geometry without moving vertices.
objects=0
for ob in scene.objects:
    if ob.type!='MESH' or not any(m and m.name in config for m in ob.data.materials):continue
    me=ob.data
    if not me.loops:continue
    coords=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',coords);coords=coords.reshape(-1,3)
    matrix=np.array(ob.matrix_world,dtype=np.float32);coords=coords@matrix[:3,:3].T+matrix[:3,3]
    indices=np.empty(len(me.loops),dtype=np.int32);me.loops.foreach_get('vertex_index',indices);points=coords[indices]
    normals=np.empty(len(me.polygons)*3,dtype=np.float32);me.polygons.foreach_get('normal',normals);normals=normals.reshape(-1,3)
    lengths=np.empty(len(me.polygons),dtype=np.int32);me.polygons.foreach_get('loop_total',lengths)
    axes=np.repeat(np.abs(normals).argmax(axis=1),lengths)
    uv=np.empty((len(me.loops),2),dtype=np.float32)
    for axis,pair in [(0,(1,2)),(1,(0,2)),(2,(0,1))]:uv[axes==axis]=points[axes==axis][:,pair]
    material_indices=np.empty(len(me.polygons),dtype=np.int32);me.polygons.foreach_get('material_index',material_indices)
    material_indices=np.repeat(material_indices,lengths)
    for i,mat in enumerate(me.materials):
        if mat and mat.name in config:uv[material_indices==i]/=np.array(config[mat.name]['tile'])
    layer=me.uv_layers.get('ShaderUV') or me.uv_layers.new(name='ShaderUV');me.uv_layers.active=layer
    layer.data.foreach_set('uv',uv.reshape(-1));objects+=1

assert before==geometry_signature(),'Geometry or placement changed'
assert len(changed)==21,len(changed)
report={'materials':changed,'packed_texture_images':len(images),'uv_objects':objects,'geometry_unchanged':True,'geometry_sha256':before}
(ROOT/'shader-verification.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-worlds-2026.blend'))
print(json.dumps(report))
