# Spectator and seating detail

Replaced all 12,392 original block spectators in place with three-ring rounded shoulder/waist silhouettes, separate sleeve arms with skin endcaps, seated thighs, eight-sided four-ring heads with integrated necks and cheek/forehead profiles, and hair material zones. Three packed skin-tone face atlases add eyes, eyebrows, noses and mouths. Source seat XY centers and spectator count remain unchanged. Head tops extend 40 mm above the prior heads; no tall standing/raised-arm crowd was introduced.

6158 spectators wear GEN.G-inspired black/gold jerseys; 6234 wear BLG-inspired white/cyan/magenta jerseys. Two packed 512×512 textures include readable GEN.G or BLG and WORLDS 2026 text, collar shapes, stripes and trim. These are reference-inspired designs rather than claims of exact official kits. Faces use three skin tones and two hair shades. 517 spectators have small within-seat light sticks.

Exact changed original objects:

- Audience_torsos__crowd0, Audience_torsos__crowd1, Audience_torsos__crowd2, Audience_torsos__crowd3, Audience_torsos__crowd4
- Audience_heads__crowd0, Audience_heads__crowd1, Audience_heads__crowd2, Audience_heads__crowd3, Audience_heads__crowd4, Audience_heads__skin

New grouped meshes:

- AudienceDetail_Aisle_supports: 248 rail support posts
- AudienceDetail_Aisle_mounts: 248 mounting feet
- AudienceDetail_Aisle_nosing: 558 small backing plates
- AudienceDetail_Aisle_guides: 558 white step guide strips
- AudienceDetail_Ribbon_chevrons: 192 cyan chevrons on existing ribbons

No seat positions, arena colors, stage, screen, light data, cameras, render settings, or other workers' assets were edited. Existing shared materials were not changed; audience-specific new materials are prefixed AudienceDetail_. All original audience material slots remain, with new AudienceJerseyUV coordinates explicitly authored for replacement geometry. Shader textures are packed in the live file.

All generated solid components passed boundary/nonmanifold, finite-coordinate, zero-area and consistent-normal checks before commit. The 11 replaced objects have no modifiers; their evaluated triangle counts equal verified base counts. Final added geometry is **1,266,968 triangles**, below the coordinator's revised 1,300,000 limit. Total audience geometry is 1,639,880 triangles; five seating-detail objects add 23,632 triangles. Detailed before/after bounds and topology are in audience-report.json. The budget was increased after the first close-up review exposed pointed heads and overly angular shoulders; the final pass specifically corrected those issues.

audience-detail.py records the first executed passes; it intentionally refuses to run again once AudienceDetail_GEN.G exists. audience-refine.py records the follow-up face/shoulder refinement from retained original orphan mesh data. audience-textures.py and audience-faces.py produce the five packed texture images. No save or render performed by this worker; parent owns combined visual verification and save. This is compact stylized arena-crowd geometry, not rigged close-up hero characters; individual fingers, shoes, animation, game-engine LODs and GPU runtime profiling were not added or verified.
