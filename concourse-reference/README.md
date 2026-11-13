# Barclays concourse — supplied-reference modeling

Applied to `../barclays-worlds-2026.blend` for all 19 existing concession locations and both sides of the west main-entry passage, as explicitly confirmed by the user.

## Appearance and contents

- Physical vertical timber slats with 80 mm pitch and 15 mm recessed joints; packed wood grain image and solid side returns.
- Dark veined stone counter fronts/worktops, bronze trim, warm linear fascia and toe lighting, charcoal tiled floors and smooth black columns.
- Coffee machines with group heads, portafilters, steam wands, cup stacks, grinder and lit pastry cases.
- Popcorn machine with modeled kernels/kettle, hot dog display and tiered snack packets.
- Three-door drink refrigerators with shelves, bottles, labels, glazing and handles.
- Upholstered lounge benches, stools, circular tables, plants and pendant shades.
- Readable image-mapped coffee/snack menus. Image generation used the built-in `image_gen` tool; source files and prompts are retained beside this document.

Seventeen ring locations use a shared four-bay row. The two ring locations immediately beside the west entry use a compact coffee/snack pair to clear the entry galleries. Two additional four-bay galleries fit the main passage. Counter-side furniture stays outside the continuous circulation strip.

## Open and inspect

- `Concourse Reference Review` scene: the actual arena, including the new concourse. Cameras `CCR_OriginalView`, `CCR_ReverseView`, `CCR_CounterView`, `CCR_RingView`, and `CCR_ExitConnection`.
- `Concourse Cutaway Review` scene: an isolated architectural review platform with one shared row. Its image is rendered with only the review ceiling hidden; the production ceilings remain intact.
- `CCR_Concourse` collection contains the 21 placed rows. Edit the shared source collections `CCR_SharedFourBayRow` and `CCR_EntryAdjacentTwoBayRow` to edit linked details.
- `CCR_PreviousConcessions` retains the old simple kiosks hidden and recoverable.
- Full pre-edit backup: `../before-concourse-reference-20261112.blend`.

## Verification

`verification.json` records 1,564 preserved original objects with no transform/geometry/material-slot/action-reference changes, closed solid meshes, finite coordinates, valid UV layers and no degenerate faces. The two explicitly identified menu-image surfaces are intentionally open display faces. Existing circulation floor/column objects received isolated materials; column side normals were smoothed. No shared original material nodes were changed.

The pre-edit live-world signature check passed before deriving a persisted-transform/topology baseline. Reopened-file verification uses that baseline because Blender leaves hidden archived objects' world matrices unevaluated until they are displayed. The pre-existing unlinked daylight light is retained with a fake user; original data was not intentionally discarded.

All 21 row footprint checks pass; the main ramp and ticket gates remain clear. Measured straight aisle clearance is 3.181 m at the main entry and at least 2.547 m around the ring with its retained existing columns. Measurements are from this model and do not constitute real-building compliance certification.

New evaluated scene geometry: 960,112 instanced triangles. Two packed generated atlases: 1254 × 1254 timber/stone atlas and 1536 × 1024 wide menu atlas. The new font is packed. Main/preview Eevee shadow capacity is 1024 MB; local light influence is bounded. Review images are 1440 × 960.

No web/GLB export, game-engine LOD certification, mobile performance measurement or crowds/animation changes were included. Existing stage, crowd and exterior remain preserved. Glass uses an Eevee-friendly Fresnel transparency/reflection shader without optical distortion.

Production scripts are one-time passes, not a general-purpose scene generator; do not rerun them over the finished scene.
