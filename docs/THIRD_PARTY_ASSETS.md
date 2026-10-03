# Third-party assets

Every external asset the site ships, with its licence. The ink footage has its own record in [INK_ASSETS.md](INK_ASSETS.md).

## Tattooed arm (3D model)

| | |
|---|---|
| Title | "Right_Arm tattoo Mhest" |
| Creator | Miguelhest (https://sketchfab.com/Miguelhest) |
| Source | https://sketchfab.com/3d-models/right-arm-tattoo-mhest-1bd9b5b57c03427383e519d095c65a18 |
| Licence | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/), as read from the original file's embedded metadata. **Confirm it on the source page before public release.** |
| Commercial use | Yes |
| Attribution required | **Yes**: title, creator, source, licence, and that it was modified |
| Modified | Yes. It was normalised and given a 3-bone skin with Reach/Grip/Pull clips ([YOUNES_ARM_ASSET_NOTES.md](YOUNES_ARM_ASSET_NOTES.md)). The colour texture was then recompressed (PNG to JPEG, same resolution). It is posed, lit and rendered in the browser. |
| Shipped as | `src/assets/work/glb/younes_tattoo_arm_rigged.glb` (1.3 MB). Its file no longer carries the original author/licence metadata, so this record is the attribution. |
| Local source | `assets-src/arm/` (git-ignored): the original `right_arm_tattoo_mhest.glb` (2.9 MB), the prepared `younes_tattoo_arm_rigged.glb` (3.1 MB) and its package zip |
| Used for | The arm that takes a print down in the Work archive prototype (`components/work/physical-archive/arm/`) |

**Credit line** for the site's credits:

> "Right_Arm tattoo Mhest" by Miguelhest (sketchfab.com/Miguelhest), CC BY 4.0, modified.

**Open items before shipping:**
- The public site has no credits section yet, so the attribution exists only in this file.
- **The sleeve on this arm is not Younes's tattoo work.** On a tattoo artist's site a visitor may assume it is. Either say so where it's credited, or replace the model with one wearing his own work.

## Considered and not used

| Asset | Why not |
|---|---|
| "Arm For Tattoo" by robertramsay (https://sketchfab.com/3d-models/arm-for-tattoo-5d5d06cc33f940c080d596c28ca8d249, CC BY 4.0) | A stiff T-pose with flat, spread fingers (it reads as a mannequin, not a reaching hand), a hollow open shoulder, and 13.7 MB of 4096² textures. Kept locally in `assets-src/arm/` (git-ignored). |

## Rope

`src/assets/work/rope.png` was provided for the prototype. **Its source and licence are not recorded yet.** Add them here before it ships.
