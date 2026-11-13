# Barclays Worlds 2026 — reference-based interior detail

The existing circular stage, player-station layout, Worlds text and blue/white arena identity are preserved. Spectator uniforms specifically follow the user's later GEN.G and BLG direction: black/gold and white/cyan/magenta. This is reference-inspired uniform styling, not an exact official uniform reproduction.

## Stage, equipment and overhead structure

- Stage fascia fasteners, framed ventilation slots, and fine outer deck panel joints.
- Ten existing player stations receive corner trim, fasteners, cable trays/drops, monitor vents and bezel screws, power indicators, monitor feet, mice and headsets.
- Existing PC towers receive grille slats and corner rails; player chairs receive bolsters, piping and caster hardware.
- Suspended screen perimeter rails, modular joints, fasteners, edge graphics and underside light modules preserve the existing screen content.
- Lighting-ring box-truss chords, diagonals and uprights; fixture yokes, clamps and safety wires; speaker grilles and rigging; screen hoists and cable clamps.
- Rounded edges on existing chair backs/seats, monitor housings and PC towers; original desk bevels remain.

42 new grouped detail meshes: 59,176 triangles. Four equipment bevel modifiers: +7,040 evaluated triangles. All new solid meshes and these evaluated equipment meshes passed closed-edge, consistent-normal and finite-coordinate checks. New details reuse existing materials; no shared shader nodes were edited by the stage pass.

## Spectator bowl

12,392 original spectator locations are retained: 6,158 GEN.G-inspired uniforms and 6,234 BLG-inspired uniforms. Block torsos/heads are replaced with shaped jersey torsos, softer shoulders, arms, seated thighs, rounded heads, integrated necks, hair and packed face/jersey textures. Facial features include eyes, brows, nose and mouth. Added rail posts/mounting feet, stair guide strips and ribbon chevrons follow the existing bowl layout.

Spectator/seating net addition: 1,266,968 triangles. Combined net addition: **1,333,184 triangles**. This larger crowd budget was needed to improve the initial faceless low-poly heads identified in the close-up review. Object/material details and geometry validation are recorded in audience-report.json and audience-report.md.

## Review and delivery

- interior-overview.png: whole arena interior.
- interior-equipment.png: player equipment and desk finish.
- interior-audience.png: character shapes and GEN.G/BLG-inspired uniforms.
- reference.png: supplied visual reference retained with the project.
- Existing camera transforms are unchanged; three new review cameras use the InteriorDetail_ prefix. Render settings and the previously active scene camera are restored after review renders.
- Backup: ../before-interior-detail-20261111.blend.
- Final file: ../barclays-worlds-2026.blend.

The Python files record one-time live production passes, not a scene generator to rerun. They intentionally guard against duplicate execution. No reload or whole-scene replacement was performed.

Limitations: characters are static stylized arena crowd assets, not rigged hero characters or photoreal people. Blender still renders were reviewed; animation, game-engine LODs, GPU frame-time, mobile shader performance and a runtime walkthrough were not validated. The denser crowd increases file size and render/viewport memory use.
