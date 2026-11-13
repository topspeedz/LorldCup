"""Geometry regressions, run against either the untouched or candidate snapshot."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
SCENE = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = SCENE


def tree(name):
    ob = SCENE.objects[name]
    return BVHTree.FromPolygons([ob.matrix_world @ v.co for v in ob.data.vertices],
                               [tuple(p.vertices) for p in ob.data.polygons])


def seat_targets():
    targets = []
    for row in range(23):
        rx, ry, z = 31 + row * 1.08, 21 + row * 1.08, -9.9 + row * .43
        count = int(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / .68)
        angles = [2 * math.pi * (j + .5) / count for j in range(count)]
        for sector, direction in ((7, 1), (9, -1)):
            edge = sector * math.pi / 8
            angle = min((a for a in angles if .022 < direction * (a - edge) < .08),
                        key=lambda a: abs(a - edge))
            targets.append(Vector((rx * math.cos(angle), ry * math.sin(angle), z + .7)))
    return targets


def arm_targets():
    arms = []
    for i, p in enumerate(seat_targets()):
        row = i // 2
        angle = math.atan2(p.y / (21 + row * 1.08), p.x / (31 + row * 1.08)) - math.pi / 2
        arms.extend(p + Vector((side * .28 * math.cos(angle), side * .28 * math.sin(angle), -.09))
                    for side in (-1, 1))
    return arms


def check():
    ledge = tree('Suites_floor__concrete')
    overhead = ledge.ray_cast(Vector((0, -44.4, .7)), Vector((0, 0, 1)), 2)[0]
    floor = tree('Walk_Tier0__concrete')
    connections = []
    for side in (-1, 1):
        for x in (-58.8, -57, -55, -54, -53, -52):
            hit = floor.ray_cast(Vector((x, side * 4.1, 1)), Vector((0, 0, -1)), 5)[0]
            connections.append(None if hit is None else round(hit.z, 4))
    gaps, maximum_step = 0, 0
    for side in (-1, 1):
        paths = [[(-58.9 + i * .05, side * 4.1) for i in range(154)]]
        paths += [[(x, side * (4.1 + i * .05)) for i in range(22)]
                  for x in (-53.305719, -52.216487, -51.126792)]
        for path in paths:
            previous = None
            for x, y in path:
                hit = floor.ray_cast(Vector((x, y, 1)), Vector((0, 0, -1)), 5)[0]
                gaps += hit is None
                if hit is not None and previous is not None:
                    maximum_step = max(maximum_step, abs(hit.z - previous))
                previous = hit.z if hit is not None else None
    remaining = 0
    for name in ('Seats__seat', 'Seats__seat2', 'Seat_armrests__steel'):
        targets = arm_targets() if name == 'Seat_armrests__steel' else seat_targets()
        tolerance = .02 if name == 'Seat_armrests__steel' else .55
        mesh = SCENE.objects[name].data
        for first in range(0, len(mesh.vertices), 8):
            center = sum((v.co for v in mesh.vertices[first:first + 8]), Vector()) / 8
            if any((center - target).length < tolerance for target in targets):
                remaining += 1
    result = dict(overhead_clear=overhead is None, connection_heights=connections,
                  aisle_seat_parts_remaining=remaining, access_path_gaps=gaps,
                  access_path_maximum_step=round(maximum_step, 4))
    blocked = []
    for ob in SCENE.objects:
        if ob.name.startswith(('REF_RibbonProgram_0_', 'Tier_ribbon')):
            obstacle = tree(ob.name)
            for side in (-1, 1):
                if obstacle.ray_cast(Vector((-56.6, side * 4.1, .2)), Vector((1, 0, 0)), 2)[0]:
                    blocked.append(ob.name)
    result['connection_ribbon_obstacles'] = blocked
    print('T68_CHECK', json.dumps(result), flush=True)
    assert overhead is None, 'The suite slab still blocks head space above the last lower-bowl row'
    assert all(h is not None for h in connections), 'The entrance-to-seat connection has a gap'
    assert remaining == 0, 'A removed aisle column still has chair parts'
    assert not blocked, 'A ribbon or low guard blocks the new entrance branch'
    assert gaps == 0 and maximum_step <= .431, 'A seat access path has a hole or excessive step'
    return result


if __name__ == '__main__':
    check()
