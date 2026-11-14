"""Export only collision/floor triangles to a CPU check, without creating a GLB."""
import json
import re
from pathlib import Path
import bpy
import numpy as np

OUT = Path(__file__).resolve().parents[3] / 'temp/T75'
scene = bpy.data.scenes['Barclays • WORLDS 2026']; bpy.context.window.scene = scene
pattern = re.compile(r'^(Walk_|Collide_|Seats__|Seat_armrests__)|Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_(Counter|Timber|Refrigerator|Lounge|Banquette)|^REF_(CircularStage|TrophyIsland|RunwayTransition|CenterStairs|TeamRiser)')
nodes = []; offset = 0
with (OUT / 'navigation.bin').open('wb') as stream:
    for ob in scene.objects:
        if ob.type != 'MESH' or ob.hide_render or not pattern.search(ob.name):
            continue
        mesh = ob.data; mesh.calc_loop_triangles()
        xyz = np.empty((len(mesh.vertices), 3), dtype=np.float32); mesh.vertices.foreach_get('co', xyz.ravel())
        matrix = np.array(ob.matrix_world)
        xyz = xyz @ matrix[:3, :3].T + matrix[:3, 3]
        xyz = np.ascontiguousarray(xyz[:, [0, 2, 1]] * [1, 1, -1], dtype=np.float32)
        indices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.uint32)
        mesh.loop_triangles.foreach_get('vertices', indices)
        nodes.append(dict(name=ob.name, positionOffset=offset, positionCount=len(xyz),
                          indexOffset=offset + xyz.nbytes, indexCount=len(indices)))
        stream.write(xyz.tobytes()); stream.write(indices.tobytes()); offset += xyz.nbytes + indices.nbytes
(OUT / 'navigation.json').write_text(json.dumps(nodes))
print('T75_NAV_DATA', len(nodes), offset, flush=True)
