# Worker 4 exterior materials — production result

Completed live MCP changes in `D:/Blender/Blender/barclays-worlds-2026/barclays-worlds-2026.blend`, scene `Barclays • WORLDS 2026`. Filepath and active scene asserted before mutation. No save, render, export, camera/lighting, geometry, modifier, UV, web, or image-pixel changes.

Viewed existing `exterior-photo-reference.png`: rust-brown canopy with broad subdued highlights and comparatively smooth reflective glazed entrance. Preserved every existing base-color texture and rust variant; adjusted surface response only.

## Exact changes

| Material | Parameter | Before | After |
|---|---|---:|---:|
| corten0 through corten7 | Metallic | 0.32 | 0.20 |
| corten0 through corten7 | Normal Map Strength | 0.65 | 0.48 |
| corten0 through corten7 | Roughness | Existing packed map direct | Same map multiplied by 0.94 |
| glass_Exterior_W4 | Metallic | 0.18 | 0.00 |
| glass_Exterior_W4 | IOR | 1.46 | 1.50 |
| glass_Exterior_W4 | Transmission Weight | 0.12 | 0.22 |
| glass_Exterior_W4 | Coat Weight | 0.50 | 0.15 |
| glass_Exterior_W4 | Coat Roughness | 0.12 | 0.08 |
| glass_Exterior_W4 | Normal Map Strength | 0.65 | 0.20 |
| silver_Exterior_W4 | Metallic | 0.92 | 0.95 |
| silver_Exterior_W4 | Normal Map Strength | 0.65 | 0.35 |

Corten change reduces metallic response and exaggerated normal detail while mildly opening the broad roughness highlight; each material adds one standard Math Multiply node labeled `Exterior weathering roughness factor`. Glass and silver retain direct existing packed roughness textures. Existing Principled / Image Texture / Normal Map graphs retained; no custom shader or procedural texture generation added. GLTF export of the roughness multiplier and transmission remains for coordinator verification.

## Exact object users

Each `cortenN` (N = 0,1,2,3,4,5,6,7) retains exactly four users, asserted before changes:

- `Corten_panels__cortenN`
- `Oculus_corten__cortenN`
- `Oculus_panel_reveals`
- `Upper_corten_skin`

Eight explicit facade batches: `Corten_panels__corten0`, `Corten_panels__corten1`, `Corten_panels__corten2`, `Corten_panels__corten3`, `Corten_panels__corten4`, `Corten_panels__corten5`, `Corten_panels__corten6`, `Corten_panels__corten7`.

Eight explicit oculus batches: `Oculus_corten__corten0`, `Oculus_corten__corten1`, `Oculus_corten__corten2`, `Oculus_corten__corten3`, `Oculus_corten__corten4`, `Oculus_corten__corten5`, `Oculus_corten__corten6`, `Oculus_corten__corten7`.

`glass_Exterior_W4` is a copy of `glass`, assigned exclusively to `Collide_CurtainWall__glass`. `silver_Exterior_W4` is a copy of `silver`, assigned exclusively to `Facade_mullions__silver`. Both target mesh datablocks were verified single-user before material assignment. Each new material's exact sole object user was asserted after assignment. Original shared glass/silver node input values were snapshot-compared and preserved, keeping interior materials unchanged by this worker.

## Evidence and remaining verification

MCP execution succeeded. After mutation, all eight corten material user counts remained four and both facade copies had one user. Reported metallic/normal values match the table. All 30 image-node references across the ten touched materials were asserted packed, 512×512, with sRGB color textures and Non-Color roughness/normal textures. Existing image data are shared read-only; no resolution increase or imagery download occurred.

No scene-wide unchanged assertion made because peers are actively editing. This worker only changed the listed material graphs and the two explicit material slots. Coordinator must perform combined visual review, save, and any GLTF/runtime validation; rendered appearance and performance were not checked here. Changes currently reside in the live unsaved Blender session.
