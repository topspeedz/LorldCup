import bpy, bmesh, math, json, hashlib, array
from pathlib import Path
from mathutils import Vector
ROOT=Path('D:/Blender/Blender/barclays-worlds-2026/concourse-reference')

def signature(ob):
    h=hashlib.sha256(str((ob.type,tuple(tuple(r) for r in ob.matrix_world),ob.hide_render)).encode())
    if ob.type=='MESH':
        data=array.array('f',[0])*(len(ob.data.vertices)*3);ob.data.vertices.foreach_get('co',data);h.update(data.tobytes())
        h.update(str((len(ob.data.polygons),[m.name if m else None for m in ob.data.materials])).encode())
    if ob.animation_data and ob.animation_data.action:h.update(ob.animation_data.action.name.encode())
    return h.hexdigest()

stable_path=ROOT/'preserved-persistent.json'
if stable_path.exists():
    exec(compile((ROOT/'preservation.py').read_text(encoding='utf-8'),'preservation.py','exec'))
    baseline=json.loads(stable_path.read_text());check_signature=persistent_signature
else:
    baseline=json.loads((ROOT/'preserved-before.json').read_text());check_signature=signature
changed=[n for n,h in baseline.items() if n not in bpy.data.objects or check_signature(bpy.data.objects[n])!=h]
issues=[];source_tris={};evaluated_tris={};surfaces=[];light_counts={}
depsgraph=bpy.context.evaluated_depsgraph_get()
for name in ['CCR_SharedFourBayRow','CCR_EntryAdjacentTwoBayRow']:
    source_tris[name]=0
    evaluated_tris[name]=0
    light_counts[name]=sum(o.type=='LIGHT' for o in bpy.data.collections[name].objects)
    for ob in bpy.data.collections[name].objects:
        if ob.type!='MESH':continue
        me=ob.data;source_tris[name]+=sum(len(p.vertices)-2 for p in me.polygons)
        evaluated_tris[name]+=sum(len(p.vertices)-2 for p in ob.evaluated_get(depsgraph).data.polygons)
        bm=bmesh.new();bm.from_mesh(me)
        flat=sum(f.calc_area()<1e-10 for f in bm.faces)
        nonmanifold=sum(not e.is_manifold for e in bm.edges)
        inconsistent=sum(e.is_manifold and not e.is_contiguous for e in bm.edges)
        finite=all(math.isfinite(v) for p in me.vertices for v in p.co)
        if 'Menu images' in ob.name:
            surfaces.append(ob.name)
        elif nonmanifold:issues.append([ob.name,'nonmanifold',nonmanifold])
        if flat or inconsistent or not finite or not me.uv_layers:issues.append([ob.name,'invalid',flat,inconsistent,finite,bool(me.uv_layers)])
        bm.free()

instances=[o for o in bpy.data.collections['CCR_Concourse'].objects if o.instance_type=='COLLECTION']
evaluated=sum(evaluated_tris[o.instance_collection.name] for o in instances)
polys={}
for o in instances:
    compact=o.instance_collection.name=='CCR_EntryAdjacentTwoBayRow'
    bounds=[(-3.8,-.5),(3.8,-.5),(3.8,2.70),(-3.8,2.70)] if compact else [(-7.68,-6.20),(7.68,-6.20),(7.68,2.70),(-7.68,2.70)]
    polys[o.name]=[(o.matrix_world@Vector((x,y,0))).xy for x,y in bounds]

def overlap(a,b):
    for poly in [a,b]:
        for p,q in zip(poly,poly[1:]+poly[:1]):
            edge=q-p;axis=Vector((-edge.y,edge.x)).normalized()
            av=[v.dot(axis) for v in a];bv=[v.dot(axis) for v in b]
            if max(av)<=min(bv)+.001 or max(bv)<=min(av)+.001:return False
    return True

overlaps=[];names=list(polys)
for i,n in enumerate(names):
    for m in names[i+1:]:
        if overlap(polys[n],polys[m]):overlaps.append([n,m])
gate=[Vector(p) for p in [(-92,-10),(-90,-10),(-90,10),(-92,10)]]
ramp=[Vector(p) for p in [(-61,-3.4),(-29,-3.4),(-29,3.4),(-61,3.4)]]
blocked=[n for n,p in polys.items() if overlap(p,gate) or overlap(p,ramp)]
def connected_bounds(ob,transform):
    adjacency=[[] for _ in ob.data.vertices]
    for edge in ob.data.edges:
        a,b=edge.vertices;adjacency[a].append(b);adjacency[b].append(a)
    remaining=set(range(len(adjacency)));bounds=[]
    while remaining:
        first=remaining.pop();component={first};stack=[first]
        while stack:
            for other in adjacency[stack.pop()]:
                if other in remaining:remaining.remove(other);component.add(other);stack.append(other)
        points=[transform@ob.data.vertices[i].co for i in component]
        bounds.append([(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)])
    return bounds

north=bpy.data.objects['CCR_MainEntry_North']
front=connected_bounds(bpy.data.objects['CCR_Black cylindrical columns'],north.matrix_world)
old=connected_bounds(bpy.data.objects['Collide_LobbyColumns__steel'],bpy.data.objects['Collide_LobbyColumns__steel'].matrix_world)
main_aisle=min(b[1][0] for b in old if b[1][0]>0)-max(b[1][1] for b in front)
table_edge=min(v.co.y for v in bpy.data.objects['CCR_Standing table tops'].data.vertices)
ring_widths=[]
original=bpy.data.objects['Collide_Columns__concrete']
for instance in instances:
    if not instance.name.startswith('CCR_Row_') or instance.instance_collection.name.endswith('TwoBayRow'):continue
    obstacles=connected_bounds(original,instance.matrix_world.inverted()@original.matrix_world)
    edge=max(v.co.y for v in bpy.data.objects['CCR_Black cylindrical columns'].data.vertices)
    for bounds in obstacles:
        cx=sum(bounds[0])/2;cy=sum(bounds[1])/2
        if abs(cx)<7.3 and edge<cy<table_edge:edge=max(edge,bounds[1][1])
    ring_widths.append(table_edge-edge)

report={'preserved_original_objects':len(baseline),'changed_original_objects':changed,'mesh_issues':issues,
        'preservation_mode':'persisted transforms and mesh topology' if stable_path.exists() else 'live world transforms and mesh vertices',
        'intentional_menu_image_surfaces':surfaces,'source_triangles':source_tris,'evaluated_source_triangles':evaluated_tris,'total_instanced_triangles':evaluated,
        'source_lights':light_counts,'instanced_local_lights':sum(light_counts[o.instance_collection.name] for o in instances),
        'rows':len(instances),'row_footprint_overlaps':overlaps,'gate_or_ramp_obstructions':blocked,
        'main_aisle_clear_width_m':round(main_aisle,3),'ring_min_straight_aisle_width_m':round(min(ring_widths),3),
        'packed_images':[(im.name,bool(im.packed_file),list(im.size)) for im in bpy.data.images if im.name in ['finish-menu-atlas.png','wide-menu-atlas.png']],
        'web_export_updated':False}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
assert not changed and not issues and not overlaps and not blocked, 'See verification.json'
assert len(instances)==21 and evaluated<2100000
assert main_aisle>=3 and min(ring_widths)>=2.5
