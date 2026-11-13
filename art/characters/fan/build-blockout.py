"""T28 working model and orthographic review sheet; run through Blender MCP."""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector

OUT = Path('D:/Projects/lorldcup-metaverse/art/characters/fan')
assert Path(bpy.data.filepath).resolve() == (OUT / 'fan.blend').resolve()
assert not any(n in bpy.data.objects for n in ('fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'))


def linear(rgb):
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, color, vertex=False, emission=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*linear(color), 1)
    p.inputs['Roughness'].default_value = .82
    m.diffuse_color = (*linear(color), 1)
    if vertex:
        node = m.node_tree.nodes.new('ShaderNodeVertexColor')
        node.layer_name = 'FanColor'
        m.node_tree.links.new(node.outputs['Color'], p.inputs['Base Color'])
    if emission:
        p.inputs['Emission Color'].default_value = (*linear(color), 1)
        p.inputs['Emission Strength'].default_value = 1
    return m


uniform = material('Uniform', (.25, .34, .40))
surface = material('FanSurface', (.5, .5, .5), vertex=True)
ink = material('sheet-ink', (.10, .18, .22), emission=True)
muted = material('sheet-muted', (.34, .42, .46), emission=True)
paper = material('sheet-paper', (.91, .93, .93))


class Mesh:
    # Same small batching pattern as interior-detail/audience-detail.py.
    def __init__(self):
        self.v, self.f, self.c, self.m, self.s = [], [], [], [], []

    def add(self, vertices, faces, color, slot=1, smooth=False):
        offset = len(self.v)
        self.v.extend(vertices)
        self.f.extend(tuple(offset + i for i in f) for f in faces)
        self.c.extend([color] * len(faces))
        self.m.extend([slot] * len(faces))
        self.s.extend([smooth] * len(faces))

    def ellipsoid(self, center, scale, color, n=16, rings=8, smooth=True):
        # Geometry from reference-match/equipment-players.py, without source-scene mutation.
        cx, cy, cz = center
        sx, sy, sz = scale
        v = [(cx, cy, cz - sz)] + [
            (cx + sx * math.sin(math.pi*k/rings) * math.cos(2*math.pi*j/n),
             cy + sy * math.sin(math.pi*k/rings) * math.sin(2*math.pi*j/n),
             cz - sz * math.cos(math.pi*k/rings))
            for k in range(1, rings) for j in range(n)] + [(cx, cy, cz + sz)]
        f = [(0, 1+(j+1) % n, 1+j) for j in range(n)]
        for k in range(rings-2):
            for j in range(n):
                a, b = 1+k*n+j, 1+k*n+(j+1) % n
                f.append((a, b, b+n, a+n))
        f.extend((len(v)-1, 1+(rings-2)*n+j, 1+(rings-2)*n+(j+1) % n) for j in range(n))
        self.add(v, f, color, smooth=smooth)

    def tube(self, points, radii, color, slot=1, n=12, smooth=True):
        axis = (Vector(points[-1])-Vector(points[0])).normalized()
        u = axis.cross(Vector((0, 1, 0))).normalized()
        w = axis.cross(u).normalized()
        vertices = [tuple(Vector(p)+r*(u*math.cos(j*2*math.pi/n)+w*math.sin(j*2*math.pi/n)))
                    for p, r in zip(points, radii) for j in range(n)]
        faces = [tuple(range(n-1, -1, -1))]
        for k in range(len(points)-1):
            faces.extend((k*n+j, k*n+(j+1) % n, (k+1)*n+(j+1) % n, (k+1)*n+j)
                         for j in range(n))
        faces.append(tuple(range((len(points)-1)*n, len(points)*n)))
        self.add(vertices, faces, color, slot, smooth)

    def loft(self, rings, color, slot=1, n=16, smooth=False):
        vertices = [(x+rx*math.cos(j*2*math.pi/n), y+ry*math.sin(j*2*math.pi/n), z)
                    for x, y, z, rx, ry in rings for j in range(n)]
        faces = [tuple(range(n-1, -1, -1))]
        for k in range(len(rings)-1):
            faces.extend((k*n+j, k*n+(j+1) % n, (k+1)*n+(j+1) % n, (k+1)*n+j)
                         for j in range(n))
        faces.append(tuple(range((len(rings)-1)*n, len(rings)*n)))
        self.add(vertices, faces, color, slot, smooth)

    def hair_cap(self, center, radius, front_end, back_end, color, n=24, rings=7):
        cx, cy, cz = center
        rx, ry, rz = radius
        vertices = [(cx, cy, cz+rz)]
        for k in range(1, rings+1):
            for j in range(n):
                phi = 2*math.pi*j/n
                front = max(0, -math.sin(phi)) ** .6
                theta = (back_end + (front_end-back_end)*front)*k/rings
                vertices.append((cx+rx*math.sin(theta)*math.cos(phi),
                                 cy+ry*math.sin(theta)*math.sin(phi), cz+rz*math.cos(theta)))
        faces = [(0, 1+j, 1+(j+1) % n) for j in range(n)]
        for k in range(rings-1):
            faces.extend((1+k*n+j, 1+(k+1)*n+j, 1+(k+1)*n+(j+1) % n, 1+k*n+(j+1) % n)
                         for j in range(n))
        vertices.append((cx, cy+.02, cz))
        faces.extend((len(vertices)-1, 1+(rings-1)*n+(j+1) % n, 1+(rings-1)*n+j) for j in range(n))
        self.add(vertices, faces, color, smooth=False)

    def object(self, name, scene):
        me = bpy.data.meshes.new(name+'-mesh')
        me.from_pydata(self.v, [], self.f)
        me.materials.append(uniform)
        me.materials.append(surface)
        me.update()
        for polygon, slot, smooth in zip(me.polygons, self.m, self.s):
            polygon.material_index = slot
            polygon.use_smooth = smooth
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(me)
        bm.free()
        attr = me.color_attributes.new(name='FanColor', type='BYTE_COLOR', domain='CORNER')
        for polygon, color in zip(me.polygons, self.c):
            for i in polygon.loop_indices:
                attr.data[i].color_srgb = (*color, 1)
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        return ob


variants = [
    ('fan_f1', 'female', 'side-part-bob', (.80, .57, .42), (.055, .045, .038)),
    ('fan_f2', 'female', 'high-curly-puff', (.37, .20, .12), (.045, .032, .026)),
    ('fan_m1', 'male', 'swept-quiff', (.91, .68, .53), (.25, .125, .065)),
    ('fan_m2', 'male', 'short-textured-crop', (.62, .37, .22), (.075, .050, .035)),
]
asset_scene = bpy.data.scenes['FanAssets']
asset_scene.unit_settings.system = 'METRIC'
asset_scene.unit_settings.scale_length = 1
joint_layout = {'hips': [0, 0, .93], 'spine': [0, 0, 1.1], 'chest': [0, 0, 1.32],
                'neck': [0, 0, 1.43], 'head': [0, 0, 1.615],
                'shoulder_L': [.22, 0, 1.37], 'elbow_L': [.41, 0, 1.18],
                'wrist_L': [.60, 0, .99], 'hip_L': [.105, 0, .93],
                'knee_L': [.105, -.012, .52], 'ankle_L': [.105, 0, .13]}
asset_scene['joint_layout'] = json.dumps(joint_layout)
asset_scene['stage'] = 'T28 static blockout; T30 binds the shared FanRig after T29 review'

for name, body, hairstyle, skin, hair in variants:
    female = body == 'female'
    mesh = Mesh()
    dark, pale = (.13, .18, .22), (.83, .87, .87)
    mesh.loft([(0, 0, .90, .163 if female else .172, .095),
               (0, 0, 1.04, .143 if female else .170, .100),
               (0, -.004, 1.22, .173 if female else .200, .116),
               (0, 0, 1.35, .198 if female else .218, .115),
               (0, 0, 1.40, .181 if female else .198, .098),
               (0, 0, 1.445, .078, .067)], (.25, .34, .40), slot=0)
    mesh.loft([(0, 0, .825, .151 if female else .158, .097),
               (0, 0, .92, .167 if female else .178, .107)], dark, smooth=True)
    mesh.tube([(0, 0, 1.405), (0, 0, 1.50)], [.063, .061], skin)
    for side in (-1, 1):
        mesh.tube([(side*.150, 0, 1.370), (side*.248, 0, 1.342), (side*.31, 0, 1.28)],
                  [.083 if female else .092, .077, .074], (.25, .34, .40), slot=0)
        mesh.tube([(side*.300, 0, 1.290), (side*.41, 0, 1.18),
                   (side*.48, 0, 1.11), (side*.60, 0, .99)],
                  [.065, .055, .052, .036], skin)
        mesh.tube([(side*.595, 0, .995), (side*.646, -.005, .944), (side*.678, -.005, .912)],
                  [.038, .045, .026], skin, n=10)
        mesh.ellipsoid((side*.622, -.038, .949), (.025, .022, .039), skin, n=10, rings=6)
        mesh.tube([(side*.105, 0, .89), (side*.105, -.006, .745), (side*.105, -.008, .684)],
                  [.096 if female else .100, .091, .087], dark)
        mesh.tube([(side*.105, -.008, .700), (side*.105, -.012, .54),
                   (side*.105, -.014, .49), (side*.105, .009, .34), (side*.105, 0, .13)],
                  [.073, .064, .063, .061, .040], skin)
        mesh.tube([(side*.105, 0, .12), (side*.105, .003, .21)], [.042, .047], pale)
        mesh.loft([(side*.105, -.042, 0, .068, .137),
                   (side*.105, -.042, .028, .070, .139)], pale, smooth=True)
        mesh.loft([(side*.105, -.042, .028, .069, .138),
                   (side*.105, -.041, .063, .069, .132),
                   (side*.105, -.025, .11, .053, .107),
                   (side*.105, .003, .13, .044, .065)], dark, smooth=True)
        for lace in range(3):
            mesh.tube([(side*.105-.034, -.090+lace*.025, .096+lace*.006),
                       (side*.105+.034, -.090+lace*.025, .096+lace*.006)], [.004, .004], pale, n=6)
    body_count = len(mesh.v)
    mesh.ellipsoid((0, 0, 1.615), (.123 if female else .129, .111, .165), skin, n=20, rings=12)
    for side in (-1, 1):
        mesh.ellipsoid((side*.122, .002, 1.607), (.022, .018, .034), skin, n=10, rings=6)
        eye_z = 1.641
        mesh.ellipsoid((side*.046, -.102, eye_z), (.023, .011, .010 if name=='fan_f1' else .014),
                       (.89, .89, .84), n=12, rings=6)
        mesh.ellipsoid((side*.046, -.112, eye_z), (.009, .004, .009), (.05, .04, .035), n=10, rings=6)
        mesh.tube([(side*.046-.022, -.108, 1.667), (side*.046+.022, -.107, 1.672)],
                  [.0038, .0045], hair, n=6)
    nose_w = .019 if name in ('fan_f1', 'fan_m1') else .026
    mesh.ellipsoid((0, -.113, 1.604), (nose_w, .029, .024), skin, n=12, rings=8)
    lip = tuple(max(.03, c*.70) for c in skin)
    mesh.ellipsoid((0, -.105, 1.560), (.029, .007, .005 if name=='fan_f1' else .008), lip, n=12, rings=6)
    if hairstyle == 'side-part-bob':
        mesh.hair_cap((0, .006, 1.626), (.142, .133, .175), 1.00, 2.30, hair)
        mesh.ellipsoid((-.045, -.109, 1.714), (.070, .015, .019), hair, n=12, rings=6, smooth=False)
    elif hairstyle == 'high-curly-puff':
        mesh.hair_cap((0, .006, 1.620), (.129, .119, .163), 1.12, 1.95, hair)
        mesh.ellipsoid((0, .062, 1.737), (.122, .099, .073), hair, n=16, rings=8, smooth=False)
        for j in range(15):
            a = j*2*math.pi/15
            mesh.ellipsoid((.108*math.cos(a), .060+.075*math.sin(a), 1.761+.025*math.sin(j*2.4)),
                           (.027, .029, .029), hair, n=8, rings=5, smooth=False)
        for j in range(6):
            a = j*2*math.pi/6
            mesh.ellipsoid((.054*math.cos(a), .057+.048*math.sin(a), 1.800),
                           (.029, .029, .026), hair, n=8, rings=5, smooth=False)
    elif hairstyle == 'swept-quiff':
        mesh.hair_cap((0, .007, 1.625), (.133, .120, .165), 1.1, 1.72, hair)
        mesh.ellipsoid((-.035, -.031, 1.769), (.087, .084, .052), hair, n=16, rings=7, smooth=False)
        mesh.ellipsoid((.055, -.030, 1.755), (.071, .073, .037), hair, n=12, rings=6, smooth=False)
    else:
        mesh.hair_cap((0, .007, 1.621), (.133, .118, .166), 1.17, 1.85, hair)
        for j in range(13):
            a = j*2*math.pi/13
            mesh.ellipsoid((.097*math.cos(a), .008+.079*math.sin(a), 1.746+.010*math.sin(j*1.7)),
                           (.026, .027, .026), hair, n=8, rings=5, smooth=False)
        for x in (-.040, 0, .040):
            mesh.ellipsoid((x, -.014, 1.779), (.030, .055, .022), hair, n=8, rings=5, smooth=False)
    ob = mesh.object(name, asset_scene)
    ob['body_base'], ob['hair_style'] = body, hairstyle
    ob['skin_srgb'], ob['body_vertex_count'] = json.dumps(skin), body_count
    ob['joint_layout'] = json.dumps(joint_layout)
    ob['stage'] = 'static-blockout'
    ob.hide_render = name != 'fan_f1'
    ob.hide_set(name != 'fan_f1')


def text_object(scene, name, body, x, z, size, mat=ink):
    data = bpy.data.curves.new(name, 'FONT')
    data.body, data.size, data.space_character = body, size, 1.15
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.location, ob.rotation_euler = (x, -.52, z), (math.pi/2, 0, 0)
    data.materials.append(mat)
    return ob


def studio(scene, target, scale, width, height):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    world = bpy.data.worlds.new(scene.name+'-world')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (.77, .82, .85, 1)
    bg.inputs['Strength'].default_value = .65
    scene.world = world
    camera = bpy.data.objects.new(scene.name+'-camera', bpy.data.cameras.new(scene.name+'-camera'))
    scene.collection.objects.link(camera)
    camera.location = (target[0], -18, target[2])
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO', scale
    scene.camera = camera
    for label, pos, power, size in [('key', (-3, -6, 7), 1100, 7), ('fill', (7, -3, 4), 750, 6)]:
        data = bpy.data.lights.new(scene.name+'-'+label, 'AREA')
        ob = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(ob)
        ob.location, data.energy, data.shape, data.size = pos, power, 'DISK', size
        ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z', 'Y').to_euler()
    me = bpy.data.meshes.new(scene.name+'-backdrop')
    me.from_pydata([(-30, .55, -30), (30, .55, -30), (30, .55, 30), (-30, .55, 30)], [], [(0, 1, 2, 3)])
    me.materials.append(paper)
    ob = bpy.data.objects.new(me.name, me)
    scene.collection.objects.link(ob)
    return scene


sheet = studio(bpy.data.scenes.new('FanSheet'), (2.7, 0, .34), 7.8, 2400, 1800)
text_object(sheet, 'sheet-kicker', 'CHARACTER STUDY     /     T28     /     12 NOV 2026', -.88, 2.86, .075, muted)
text_object(sheet, 'sheet-title', 'FAN  /  FOUR FACES', -.88, 2.53, .23)
text_object(sheet, 'sheet-subtitle', '2 BODY BASES    /    SHARED A-POSE    /    FRONT + RIGHT PROFILE', -.87, 2.31, .078, muted)
for index, (name, body, hairstyle, skin, hair) in enumerate(variants):
    x = index*1.8
    for view, z in [('front', .20), ('side', -2.05)]:
        ob = bpy.data.objects.new('sheet-'+name+'-'+view, bpy.data.objects[name].data)
        sheet.collection.objects.link(ob)
        ob.location = (x, 0, z)
        ob.rotation_euler.z = 0 if view == 'front' else -math.pi/2
    text_object(sheet, 'sheet-id-'+name, name.upper()+'   /   '+('F' if body=='female' else 'M'), x-.70, 2.10, .088)
    text_object(sheet, 'sheet-hair-'+name, hairstyle.replace('-', ' ').upper(), x-.70, -.04, .066, muted)
    text_object(sheet, 'sheet-view-'+name, 'RIGHT PROFILE', x-.70, -2.27, .060, muted)
text_object(sheet, 'sheet-footer', 'STATIC BLOCKOUT   /   NO LOGOS   /   METRES   /   RIG + UV AFTER ART REVIEW', -.88, -2.49, .068, muted)

comparison = studio(bpy.data.scenes.new('FanStyleComparison'), (1.65, 0, .92), 5.3, 1920, 1000)
reference = json.loads((OUT/'reference-player.json').read_text(encoding='utf-8'))
for entry in reference['objects']:
    me = bpy.data.meshes.new('reference-'+entry['name'])
    me.from_pydata(entry['vertices'], [], entry['faces'])
    for value in entry['materials']:
        name = 'reference-'+value['name']
        mat = bpy.data.materials.get(name)
        if mat is None:
            mat = material(name, (.5, .5, .5))
            next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value = value['color']
        me.materials.append(mat)
    for poly, index in zip(me.polygons, entry['material_indices']):
        poly.material_index = index
        poly.use_smooth = True
    ob = bpy.data.objects.new(me.name, me)
    comparison.collection.objects.link(ob)
for x, name in [(1.65, 'fan_f1'), (3.30, 'fan_m2')]:
    ob = bpy.data.objects.new('compare-'+name, bpy.data.objects[name].data)
    comparison.collection.objects.link(ob)
    ob.location.x = x
text_object(comparison, 'comparison-title', 'EXISTING WORLD  /  NEW FANS', -.65, 2.03, .12)
text_object(comparison, 'comparison-reference', 'EXISTING PLAYER / SEATED', -.65, -.18, .065, muted)
text_object(comparison, 'comparison-female', 'T28 / FEMALE BASE', 1.0, -.18, .065, muted)
text_object(comparison, 'comparison-male', 'T28 / MALE BASE', 2.65, -.18, .065, muted)
text_object(comparison, 'comparison-note', 'SAME STUDIO LIGHT / ORIGINAL GEOMETRY SCALE / RUNTIME ART CHECK FOLLOWS IN T46', -.65, -.34, .048, muted)

bpy.context.window.scene = sheet
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fan.blend'))
print(json.dumps({'saved':str(OUT/'fan.blend'), 'characters':[v[0] for v in variants],
                  'scenes':[s.name for s in bpy.data.scenes]}))
