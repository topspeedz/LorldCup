# Worker 2 — interior architecture and seating inspection

Read-only inspection completed 2026-11-11. Read full `.codex/agents/technical-artist.toml` role definition. No Blender mutations or generator execution.

## Connection and target
- MCP available: execute_blender_code, get_addon_status and get_scene_info succeeded.
- Live filepath: `D:/Blender/Blender/barclays-worlds-2026/barclays-worlds-2026.blend` (matches target; checked again before detailed inventory).
- Scene: `Barclays • WORLDS 2026`; 239 objects (219 meshes, 16 lights, 4 cameras). Existing active camera: `04_City_Exterior`; untouched.
- Blender 5.2.2 LTS, add-on 1.8, protocol 14 versus expected 15. Read-only fallbacks work; no update performed.

## Exact architecture/seating object names
Core seating and bowl:
`Walk_Tier0__concrete`, `Walk_Tier1__concrete`, `Seats__seat`, `Seats__seat2`, `Seat_armrests__steel`, `Aisle_handrails__silver`, `Suites_floor__concrete`, `Suite_windows__glass`, `Suite_piers__ivory`, `Suite_fascia__ivory`.

Interior circulation/lobby:
`Walk_Concourse__concrete`, `Walk_EntryBridge__concrete`, `Walk_Atrium__concrete`, `Atrium_ceiling__wood`, `Collide_LobbyColumns__steel`, `Collide_TicketGate__silver`, `Collide_Concession__wood`, `Kiosk_fascia__black`, `Counter__silver`, `Menu_board__blue`, `Collide_Columns__concrete`, `Walk_EntryRamp__concrete`, `Ramp_rail__silver`, `Ramp_posts__silver`, `Portal_header__black`.

Interior overhead architecture (confirm boundary with roof/exterior owner before changes):
`Roof_truss_chords__steel`, `Roof_truss_web__silver`, `Roof_truss_web__steel`, `Roof_lateral__steel`, `Catwalk__steel`, `Roof_soffit`.

Associated wayfinding (confirm content ownership): `Welcome`, `Portal_sign`, `Concession_title` plus exact numbered names `.001` through `.018`, and `Section_number` plus exact numbered names `.001` through `.031` (all suffixes exist in live inventory).

Adjacent objects awaiting ownership confirmation, not claimed for changes: `Aisle_step_lights__cyan`, `Tier_ribbon__blue`, `Tier_ribbon_light__cyan`, `Lobby_stripLights__whiteLED`, `Gate_reader__cyan`; crowd objects `Audience_torsos__crowd0`, `Audience_torsos__crowd1`, `Audience_torsos__crowd2`, `Audience_torsos__crowd3`, `Audience_torsos__crowd4`, `Audience_heads__crowd0`, `Audience_heads__crowd1`, `Audience_heads__crowd2`, `Audience_heads__crowd3`, `Audience_heads__crowd4`, `Audience_heads__skin`.

Explicit exclusions: `Walk_ArenaFloor__black` (stage-front floor), all stage/player/screen/lighting equipment, cameras, exterior shell and city. No other worker objects changed.

## Findings and dependencies
- Live metadata records 19,384 seats and 12,392 spectators; not independently recounted per seat. `build_scene.py:165` generates two tiers of 23 rows, with radial aisles and western lower-bowl entry opening.
- Seats are batched across tiers by material, not individually addressable seat objects. Polygon-derived triangle counts: `Seats__seat` 406,968; `Seats__seat2` 58,248; armrests 465,216; combined 930,432. Lower/upper tier meshes add 68,448 / 69,552 triangles. These are mesh counts, not measured GPU timings or draw calls.
- All 31 architecture/seating mesh objects inspected have one UV layer, one mesh-data user and no modifiers. UV quality and topology validity were not established by layer presence. No LOD chain was identified in scene object names; no runtime LOD certification performed.
- Many materials (steel/silver/concrete/black/ivory/blue/glass) serve other owners too. Any approved local material change needs explicit isolation or coordination, never global material edits by default.
- `web/main.js:36-37` derives walkable/collision meshes from `Walk_` / `Collide_` names; `seatedArea` approximates seating collision radially. Renaming or changing bowl/ramp dimensions can break traversal and needs coordinated viewer validation.
- `build_scene.py:127-228`, `refine_scene.py` roof-soffit creation, `finish_scene.py`, `apply_shaders.py`, README and reference catalog inspected as source text only. Original generators must not be rerun.
- Reference catalog includes 25 selected interior photographs; examined thumbnail `references/barclays-center/thumbnails/1002.jpg` (Bruce Damonte interior, original catalog path `references/high-resolution/interior/1002_090705_SHoP_Barclays_Center_pho_Bruce_Damonte_47.jpg`). It supports tiered dark seating and overhead truss character but is a basketball configuration, not a directive to alter event layout. Existing README explicitly calls geometry approximate and upper-bowl vertical circulation incomplete.

## Proposed scope for coordinator approval
Limit any follow-up to a named defect or explicitly requested visual adjustment in the core seating/bowl and interior circulation objects above; preserve existing layout, counts, walkable naming and shared materials unless specifically directed otherwise. Before production, specify target reference/view, exact desired change, roof/wayfinding/crowd/LED ownership boundaries, target platform and geometry/texture/draw-call budgets; role-template example budgets are not project-approved limits. Then inspect and validate only affected explicit object/data references, with coordinator-owned save/export and viewer traversal checks.

No concrete visual change has been authorized, so none is proposed as an automatic redesign or applied. Remaining clarification: what exact interior/seating change is wanted, which reference is authoritative, and which adjacent ownership boundaries apply.

Skipped: rendering, exporting, saving, scene/camera changes, full topology/UV audit and runtime/GPU profiling. Risk: shared materials, batched seats and viewer collision assumptions can make an otherwise local edit affect other areas; protocol mismatch remains.
