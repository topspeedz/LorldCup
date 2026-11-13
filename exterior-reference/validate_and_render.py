import bpy, json, hashlib, array, math
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/exterior-reference')
def signature(ob):
    h=hashlib.sha256(str((ob.type,tuple(tuple(r) for r in ob.matrix_world),ob.hide_render)).encode())
    if ob.type=='MESH':
        a=array.array('f',[0])*(len(ob.data.vertices)*3);ob.data.vertices.foreach_get('co',a);h.update(a.tobytes())
        h.update(str((len(ob.data.polygons),[m.name if m else None for m in ob.data.materials])).encode())
    return h.hexdigest()
baseline=json.loads((ROOT/'preserved-before.json').read_text())
changed=[n for n,sig in baseline.items() if n not in bpy.data.objects or signature(bpy.data.objects[n])!=sig]
assert not changed,changed
col=bpy.data.collections['EXR_Architecture'];issues=[];tris=0
for ob in col.objects:
    if ob.type!='MESH':continue
    me=ob.data
    if not me.uv_layers:
        uv=me.uv_layers.new(name='Architectural metres')
        for p in me.polygons:
            axis=max(range(3),key=lambda k:abs(p.normal[k]));axes=[k for k in range(3) if k!=axis]
            for li in p.loop_indices:
                co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]],co[axes[1]])
    assert all(math.isfinite(c) for v in me.vertices for c in v.co),ob.name
    bad=sum(p.area<1e-9 for p in me.polygons)
    if bad:issues.append([ob.name,bad])
    tris+=sum(len(p.vertices)-2 for p in me.polygons)
assert not issues,issues
assert tris<500000,tris
# Test the opening geometrically: vertical ray through its centre must miss canopy meshes.
from mathutils import Vector
from mathutils.bvhtree import BVHTree
dg=bpy.context.evaluated_depsgraph_get();ray_hits=[]
for ob in col.objects:
    if ob.type!='MESH' or not any(s in ob.name for s in ['Canopy','Oculus']):continue
    tree=BVHTree.FromObject(ob,dg)
    origin=ob.matrix_world.inverted()@Vector((-124,8,60))
    if tree.ray_cast(origin,Vector((0,0,-1)),100)[0] is not None:ray_hits.append(ob.name)
assert not ray_hits,ray_hits
report={'preserved_original_objects':len(baseline),'changed_original_objects':changed,'new_exterior_triangles':tris,'degenerate_faces':issues,'oculus_centre_vertical_ray':'clear','exterior_objects':len(col.objects),'all_new_meshes_have_uv':True,'source':'Photo-derived exterior; no surveyed dimensions','web_glb_updated':False}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2))
review=bpy.data.scenes['Exterior Reference Review'];review.camera=bpy.data.objects['EXR_Front']
bpy.context.window.scene=review
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT.parent/'barclays-worlds-2026.blend'))
shots=['Front','ThreeQuarter','Aerial','PanelDetail','Oculus','PanelDetailNight']
state={'remaining':shots[:],'completed':[],'status':'rendering'}
bg=next(n for n in review.world.node_tree.nodes if n.type=='BACKGROUND')
sky=next(n for n in review.world.node_tree.nodes if n.type=='TEX_SKY')
sun=next(o for o in review.objects if o.name.startswith('EXR_Review sun'))
day=(bg.inputs['Strength'].default_value,sky.sun_elevation,sun.data.energy)
def render_next():
    try:
        if not state['remaining']:
            bg.inputs['Strength'].default_value,sky.sun_elevation,sun.data.energy=day
            review.camera=bpy.data.objects['EXR_Front'];review.render.filepath=str(ROOT/'Front.png')
            state['status']='complete';(ROOT/'render-status.json').write_text(json.dumps(state,indent=2))
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT.parent/'barclays-worlds-2026.blend'))
            return None
        shot=state['remaining'].pop(0)
        if shot.endswith('Night'):
            bg.inputs['Strength'].default_value=.12;sky.sun_elevation=.08;sun.data.energy=.35
        review.camera=bpy.data.objects['EXR_'+shot.replace('Night','')]
        review.render.filepath=str(ROOT/(shot+'.png'))
        bpy.ops.render.render(scene=review.name,write_still=True)
        state['completed'].append(shot);(ROOT/'render-status.json').write_text(json.dumps(state,indent=2))
        return .4
    except Exception as exc:
        bg.inputs['Strength'].default_value,sky.sun_elevation,sun.data.energy=day
        state['status']='failed';state['error']=str(exc);(ROOT/'render-status.json').write_text(json.dumps(state,indent=2));return None
(ROOT/'render-status.json').write_text(json.dumps(state,indent=2))
bpy.app.timers.register(render_next,first_interval=.3)
print(json.dumps(report))
