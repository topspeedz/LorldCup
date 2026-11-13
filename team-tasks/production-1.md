# Worker 1 — exterior geometry refinement

Implemented in live target D:/Blender/Blender/barclays-worlds-2026/barclays-worlds-2026.blend, scene Barclays • WORLDS 2026. No save, render, export, camera/scene switch, web edit, generator execution or other-owner edit performed.

## Exact changes

| Object | Modifier | Width | Segments | Limit | Clamp overlap |
|---|---|---:|---:|---|---|
| Facade_mullions__silver | Exterior restrained edge bevel (BEVEL) | 0.006 m | 1 | ANGLE, 75 degrees | enabled |
| Roof_seams__steel | Exterior restrained edge bevel (BEVEL) | 0.002 m | 1 | ANGLE, 75 degrees | enabled |

Modifiers remain unapplied. The small chamfers soften sharp end/ring edges without changing the building layout or its openings. Existing base geometry, UV coordinates, material slot names and face material indices were hash-compared before/after and unchanged for both objects.

Oculus_panel_reveals remains unchanged: its 1536 independent quad surfaces have 6144 boundary/nonmanifold edges, making solid-edge bevel inappropriate. No massive panel batches touched.

## Inspection and verification

Both bevel targets had zero boundary/nonmanifold edges, unit object scale, ShaderUV and no previous modifiers. The 75-degree threshold leaves their approximately 60-degree prism edges untouched.

| Object | Evaluated triangles before | After | Added |
|---|---:|---:|---:|
| Facade_mullions__silver | 10256 | 30800 | 20544 |
| Roof_seams__steel | 660 | 1452 | 792 |
| Total | 10916 | 32252 | 21336 |

Added evaluated triangles: 21336, below the 30000 cap with 8664 remaining. All evaluated vertices finite. Largest local bounding-extreme movement was approximately 0.000771 m on mullions; roof-seam extrema unchanged. Mullion Z remains 0 to 8.30000019; roof-seam Z remains 30.01968765 to 30.08031082. Target filepath was asserted before each modifier creation; object references were explicit. Validation assertions passed, with local rollback prepared if the budget or geometry checks failed.

Not checked: rendered appearance and runtime frame cost; combined visual review and saving remain with coordinator. No whole-scene preservation assertion is made because peers share the live scene. Risk: extra geometry is within the assigned budget but its final perceived highlight strength depends on combined lighting/materials.
