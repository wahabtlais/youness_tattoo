# Younes Tattoo Arm — Animation-Ready Asset

## Selected source
`right_arm_tattoo_mhest.glb`

Selected because it has the more suitable open hand/fingers, a long forearm that can emerge from below the archive, and a black/grey + restrained red tattoo treatment that fits the Younes visual language better than the alternate asset.

## Prepared file
`younes_tattoo_arm_rigged.glb`

The mesh has been normalized and prepared with a lightweight 3-bone skin:

- `ArmRoot`
- `Forearm`
- `WristHand`

The fingers are not individually rigged. The wrist/hand can rotate as a unit. This is intentional: the interaction should sell the grab through timing, occlusion, photograph attachment and wrist movement rather than artificial finger deformation.

## Animation clips
The GLB contains three clips intended as starting choreography:

- `Reach` — forearm and wrist settle toward a reaching pose.
- `Grip` — subtle wrist movement for the contact/grab moment.
- `Pull` — forearm/wrist movement for the pull-away phase.

Claude should NOT treat these clips as fixed screen-space animation. The arm needs to be positioned toward the selected photograph dynamically, with the clips used as local pose/timing references.

## Technical notes
- Original mesh: ~19.8k faces / ~10.6k vertices.
- Original source asset was ~2.9 MB.
- Prepared GLB is ~3.1 MB.
- Original textures/materials are preserved.
- Mesh transforms are baked into a clean local coordinate system.
- The asset is oriented along a vertical arm axis and can be positioned below the Work archive.

## Source / attribution
The original GLB metadata identifies the source as:

Miguelhest — "Right_Arm tattoo Mhest"
https://sketchfab.com/3d-models/right-arm-tattoo-mhest-1bd9b5b57c03427383e519d095c65a18

License stated by the original asset metadata:
CC-BY-4.0
http://creativecommons.org/licenses/by/4.0/

Preserve attribution/license information when this asset ships publicly. Verify the current Sketchfab license/source before production release.
