"""Read the T31 copy without saving or touching the live Blender session."""
import bpy
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert Path(bpy.data.filepath).resolve() == OUT / 'barclays-arena-v2.blend'
scene = bpy.data.scenes['Barclays • WORLDS 2026']
keep = set(json.loads((ROOT / 'web-lightmaps/floor-fix/visible-objects.json').read_text()))
added = [o.name for o in scene.objects if o.name.startswith('Fix_') or o.name in ('Collide_RampInfill__concrete', 'Collide_TierColumns__concrete', 'EXR_MoonLight')]
keep.update(added)
materials = {}
for ob in scene.objects:
    if ob.name not in keep or not hasattr(ob.data, 'materials'):
        continue
    for mat in ob.data.materials:
        if not mat or not mat.use_nodes:
            continue
        images = [{'name': n.image.name, 'path': n.image.filepath, 'packed': bool(n.image.packed_file), 'size': list(n.image.size)} for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
        if images:
            materials.setdefault(mat.name, {'images': images, 'objects': []})['objects'].append(ob.name)
protected = [ROOT / 'barclays-worlds-2026.blend', ROOT / 'web/arena.glb']
protected += [p for p in (ROOT / 'web/lightmaps').glob('*.png') if not p.stem.endswith('-v2')]
data = {'source': str(bpy.data.filepath), 'added': added, 'materials': materials,
        'images': [{'name': im.name, 'path': im.filepath, 'packed': bool(im.packed_file), 'exists': Path(bpy.path.abspath(im.filepath)).exists()} for im in bpy.data.images if im.source == 'FILE'],
        'original_sha256': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.file_digest(p.open('rb'), 'sha256').hexdigest() for p in protected},
        'export_properties': [p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties],
        'world': [(n.name, n.inputs['Strength'].default_value) for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND']}
(OUT / 't32-source-inspection.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
print('T32_SOURCE', json.dumps({'added': added, 'image_materials': len(materials), 'missing_unpacked': [im for im in data['images'] if not im['packed'] and not im['exists']], 'world': data['world']}), flush=True)
