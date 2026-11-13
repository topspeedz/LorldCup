import bpy,bmesh,math,json
from pathlib import Path
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026')
s=bpy.data.scenes['Barclays Photo Exterior Final'];bpy.context.window.scene=s
source=[o for o in s.objects if o.type in {'MESH','FONT'}]
report={'scene':s.name,'lod_triangles':{},'finite':True,'boundary_edges':0,'nonmanifold_edges':0,'limitations':['Single photograph; unsurveyed proportions and unseen geometry approximate','Logo is simplified silhouette','No engine import, GPU timing or runtime LOD switching validated']}
for ob in source:
 if ob.type=='FONT':continue
 if ob.name in ['Photo_Barclays shield','Photo_Eagle silhouette']:
  mod=ob.modifiers.new('Badge thickness','SOLIDIFY');mod.thickness=.06
  deps=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(ob.evaluated_get(deps));ob.modifiers.clear();ob.data=me
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data)
 report['boundary_edges']+=sum(e.is_boundary for e in bm.edges);report['nonmanifold_edges']+=sum(not e.is_manifold for e in bm.edges);bm.free()
 assert all(math.isfinite(v) for vert in ob.data.vertices for v in vert.co)
 uv=ob.data.uv_layers.new(name='Photo planar UV') if not ob.data.uv_layers else ob.data.uv_layers.active
 for loop in ob.data.loops:
  v=ob.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/120+.5,(v.y+v.z)/160+.5)
for level,ratio in enumerate([1,.5,.2,.06]):
 coll=bpy.data.collections.new('Photo_LOD'+str(level));s.collection.children.link(coll);count=0
 for original in source:
  if level==0:
   ob=original;coll.objects.link(ob);s.collection.objects.unlink(ob)
  else:
   deps=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(original.evaluated_get(deps));ob=bpy.data.objects.new(original.name+'_LOD'+str(level),me);coll.objects.link(ob);ob.matrix_world=original.matrix_world.copy()
   if level==3 and 'Canopy' in ob.name:
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.35);bm.to_mesh(ob.data);bm.free()
   mod=ob.modifiers.new('LOD reduction','DECIMATE');mod.ratio=ratio
  deps=bpy.context.evaluated_depsgraph_get();evaluated=ob.evaluated_get(deps);me=evaluated.to_mesh();me.calc_loop_triangles();count+=len(me.loop_triangles);evaluated.to_mesh_clear()
 coll.hide_render=level>0;coll.hide_viewport=level>0
 report['lod_triangles']['LOD'+str(level)]=count
assert report['nonmanifold_edges']==0,report
assert report['lod_triangles']['LOD0']<127000
assert report['lod_triangles']['LOD3']<15100
assert all(a>b for a,b in zip(list(report['lod_triangles'].values()),list(report['lod_triangles'].values())[1:]))
(ROOT/'exterior-photo-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barclays-photo-exterior.blend'))
print(json.dumps(report))
