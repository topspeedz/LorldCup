"""Read-only measurements for T31; also records the missing-support regression."""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

scene = bpy.data.scenes['Barclays • WORLDS 2026']
bpy.context.window.scene = scene
assert bpy.app.background


def bounds(ob):
    points = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
    return [[round(min(p[i] for p in points), 5), round(max(p[i] for p in points), 5)] for i in range(3)]


def emit(label, value):
    print('T31_' + label, json.dumps(value, ensure_ascii=False), flush=True)


for name in ('Walk_Tier0__concrete', 'Walk_Tier1__concrete', 'Walk_EntryRamp__concrete',
             'Seats__seat', 'REF_DeskBody__Obsidian', 'REF_Reused_Player_PC__black',
             'REF_TeamRiser__Obsidian', 'Collide_Columns__concrete'):
    ob = scene.objects[name]
    emit('OBJECT', dict(name=name, bounds=bounds(ob), matrix=[list(row) for row in ob.matrix_world],
                       materials=[m.name if m else None for m in ob.data.materials],
                       modifiers=[(m.name, m.type) for m in ob.modifiers], hidden=ob.hide_render,
                       vertices=len(ob.data.vertices), faces=len(ob.data.polygons),
                       sample=[list(v.co) for v in ob.data.vertices[:8]]))

emit('WORLD', dict(name=scene.world.name, nodes=[dict(type=n.type, name=n.name,
                  strength=n.inputs['Strength'].default_value if n.type == 'BACKGROUND' else None)
                  for n in scene.world.node_tree.nodes]))
emit('IMAGES', dict(total=len(bpy.data.images), missing=[(i.name, i.filepath) for i in bpy.data.images
                  if i.source == 'FILE' and not i.packed_file and not Path(bpy.path.abspath(i.filepath)).exists()]))
emit('LIGHTS', [(o.name, o.data.type, o.data.energy, o.hide_render) for o in scene.objects
                if o.type == 'LIGHT' and (o.data.type == 'SUN' or 'Moon' in o.name)])
emit('PC_ATTACHMENTS', [(o.name, bounds(o)) for o in scene.objects if 'PC' in o.name and o.type == 'MESH' and not o.hide_render])
emit('DESK_VERTICES', [list(v.co) for v in scene.objects['REF_DeskBody__Obsidian'].data.vertices])
emit('COLLECTIONS', [(c.name, c.hide_render, len(c.objects)) for c in bpy.data.collections if c.name.startswith(('REF', 'Fix', 'Audience'))])

if '--check-missing' in sys.argv:
    missing = [name for name in ('Fix_SeatBases__steel', 'Fix_UpperWestTreads__concrete',
               'Fix_TierRisers__concrete', 'Fix_TierSoffits__concrete', 'Collide_TierColumns__concrete',
               'Collide_RampInfill__concrete', 'EXR_MoonLight') if name not in scene.objects]
    emit('BASELINE_FAILURES', missing)
    assert not missing, 'T06 support/closure/moon regressions reproduced'
