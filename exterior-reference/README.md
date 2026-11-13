# Barclays exterior — supplied photographic references

Delivery: `../barclays-worlds-2026.blend`.
Open the `Exterior Reference Review` scene for the daylight exterior cameras.
The original `Barclays • WORLDS 2026` scene retains its interior lighting and cameras.
Both scenes share the new exterior objects in `EXR_Architecture`.

Changes: asymmetric open canopy with a descending left return, panelled soffits and fascia,
unbranded inner LED ribbon, folded weathering-steel cladding, recessed rose light apertures,
glazed entrance, continuous glazed belt, planted roof with standing seams and perimeter coping,
Barclays signage, and exterior entrance downlights.

Original replaced exterior objects remain in the hidden `EXR_PreviousExterior` collection.
Full pre-edit backup: `../before-exterior-reference-20261112.blend`.

`verification.json` records 1,531 original objects with unchanged geometry/transform/material-slot
signatures, no degenerate new faces, UV layers on every new mesh, and a clear vertical ray
through the actual canopy opening. Final exterior base meshes total 326,786 triangles.

Review images: `Front.png`, `ThreeQuarter.png`, `Aerial.png`, `PanelDetail.png`,
`Oculus.png`, `PanelDetailNight.png`. Completion is recorded in `render-status.json`.

Dimensions and hidden surfaces are inferred from photographs, not survey drawings.
Existing city surroundings, event content and interior were not rebuilt.
The prior web GLB has not been regenerated. Procedural materials and architectural lighting
have been reviewed in Blender only; runtime LODs, texture baking and GPU profiling are not part
of this delivery.
