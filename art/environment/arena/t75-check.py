"""CPU geometry checks, first run against the unchanged source to reproduce omissions."""
import json
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
SCENE = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = SCENE
assert bpy.app.background


def tree(ob):
    return BVHTree.FromPolygons([ob.matrix_world @ v.co for v in ob.data.vertices],
                               [tuple(p.vertices) for p in ob.data.polygons])


def check():
    missing = [name for name in ('Walk_RampA__concrete', 'Walk_RampB__concrete') if name not in SCENE.objects]
    assert not missing, f'Approved side ramps are missing: {missing}'
    floors = {name: tree(SCENE.objects[name]) for name in ('Walk_RampA__concrete', 'Walk_RampB__concrete')}
    for name, sign in (('Walk_RampA__concrete', 1), ('Walk_RampB__concrete', -1)):
        for step in range(321):
            distance = min(31.999, max(.001, step * .1))
            y = sign * (51 - distance)
            height = -distance * 10 / 32
            for x in (-2.8, 0, 2.8):
                hit = floors[name].ray_cast(Vector((x, y, height + .5)), Vector((0, 0, -1)), 1)[0]
                assert hit and abs(hit.z - height) < .01, (name, x, y, height, hit)
    seat_trees = [tree(SCENE.objects[name]) for name in ('Seats__seat', 'Seats__seat2')]
    protected = json.loads((ROOT / 'web/config/seats.json').read_text())['seats']
    for seat in protected:
        x, z, negative_y = seat['position']
        top = Vector((x, -negative_y, z + .8))
        hits = [t.ray_cast(top, Vector((0, 0, -1)), .7)[0] for t in seat_trees]
        assert any(h is not None for h in hits), f'Protected chair missing: {seat["id"]}'
    lod = [ob for ob in SCENE.objects if ob.name.endswith('__lod10')]
    assert lod, 'Exterior LOD copies missing'
    for ob in lod:
        original = SCENE.objects[ob.name[:-7]]
        count = lambda mesh: sum(len(p.vertices) - 2 for p in mesh.polygons)
        ratio = count(ob.data) / count(original.data)
        assert .06 <= ratio <= .13, (ob.name, ratio)
    names = ['REF_WorldsCrest', 'REF_PedestalCrest'] + [f'REF_HeaderCrest_{i}' for i in range(4)]
    names += [f'REF_Jumbotron_{i}' for i in range(4)] + ['REF_DeskFace_-1', 'REF_DeskFace_1']
    for name in names:
        ob = SCENE.objects[name]
        images = [n.image.name for m in ob.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
        assert any(image.startswith(('Final Arena', 'WORLDS crest alpha')) for image in images), (name, images)
    print('T75_GEOMETRY_CHECKS_PASSED', json.dumps(dict(ramp_samples=1926, protected_chairs=6,
          restored_logo_surfaces=12, exterior_lod_pairs=len(lod))), flush=True)


if __name__ == '__main__':
    check()
