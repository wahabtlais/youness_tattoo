# Prototype: physical work archive

**Status: experiment, not approved.** Branch `feat/physical-work-archive-prototype`. It answers one question: does *rope + photographs + a tattooed hand that takes one down* feel like the right Work experience for Younes?

On this branch the home page shows the archive in place of the Work section. `sections/Work.tsx` is untouched; swapping the one block in `pages/HomePage.tsx` brings it back.

## What it is

```
src/components/work/physical-archive/
├── PhysicalWorkArchive.tsx   the section: intro, stage, detail; owns the pick
├── WorkArchiveIntro.tsx      / 02, SELECTED WORKS, one line, View all works
├── WorkPhotograph.tsx        one hanging print (clip, wire, print)
├── useArchiveMotion.ts       rope, drift, drag, swing - one rAF loop
├── ropeRenderer.ts           draws rope.png bent onto the rope's curve
├── layout.ts                 sizes, angles, hang lengths, spacing
├── pickTimeline.ts           the pick and the return - GSAP timelines
├── arm/
│   ├── armStage.ts           the 3D tattooed arm: one WebGL canvas (three.js)
│   └── armConfig.ts          the arm's performance as tunable transforms
├── WorkPhysicalDetail.tsx    the detail view (native dialog) + the arm's canvas
└── physicalArchive.css       print paper and shadow, clip
```

The motion has three owners, so nothing fights over a transform:
- **rAF engine** (`useArchiveMotion`): position on the rope and swing.
- **CSS:** the hover/focus lift.
- **GSAP** (`pickTimeline`): the pick, including the arm's pose, which `armStage` renders.

React never re-renders for motion.

## Rope

`src/assets/work/rope.png` is drawn on a canvas in 5px vertical slices, each dropped onto the rope's curve:
- a gentle sag across the screen,
- a local dip under the touched print,
- a damped recoil where a print is pulled off.

The strip is made seamless once (its tail cross-faded over its head) so it can travel forever, and a softened shadow copy is pre-rendered. It runs past both edges of the viewport and moves with the prints.

## Photographs

- Real work from `public/work`, using the existing responsive WebP copies, lazy-loaded.
- Each is an off-white paper print with grain and a soft layered contact shadow.
- Each hangs from a black binder clip on the rope, on a short wire.
- Controlled variation comes from short cycles in `layout.ts`: size, rest angle (±3°), hang length and spacing.
- Each swings on a damped spring when the archive speeds up or stops.

## Interaction

**Drift:**
- About 14px/s right to left (9px/s on mobile).
- Slows to 30% while the pointer is over the archive and stops on a print.
- Stops while a print has keyboard focus.

**Input:**
- Mouse drag and touch swipe have inertia. `touch-action: pan-y` keeps vertical page scrolling.
- Horizontal trackpad scrolling moves the archive; vertical wheel scrolling still moves the page.

**Touch:** the print rises 6px, its shadow deepens, it settles toward level, the rope dips under it, and its neighbours stir.

**Pick (about 3.1s).** The hand goes to an edge of the print, and the print comes to the hand. The hand never passes through the photograph. Times are from the click:

| Time | Beat |
|---|---|
| 0.00–0.25 | **Anticipation:** the archive stops, the others recede, the print lifts. |
| 0.25–1.05 | **Enter:** the arm comes in on a diagonal from the bottom right. |
| 1.05–1.40 | **Approach:** slow, onto the print's lower edge. It stops short and never overshoots. |
| 1.40–1.55 | **Settle:** the hand stops on the contact point, low and right on the print (78% across, 80% down, configurable). |
| 1.55–1.75 | **Give:** the print comes 14px to the hand, turns about 1.5°, and its shadow deepens. From here it is attached to the hand. |
| 1.75–2.35 | **Pull:** hand and print move together down the arm's line, toward the viewer and a little toward the middle of the screen. The rope recoils and the empty clip stays on the line. |
| 2.35–2.70 | **Release:** the hand lets go and the arm retreats below the screen. |
| 2.50–3.10 | **Detail:** the same print flies on into the detail layout, laid out in its exact proportions. |

**Close** (Close, Escape or a click on the paper): the print flies back to its clip and swings as it is re-hung.

**Find similar** opens the existing consultation with `{ from: 'find-similar', workId }`. There is no similarity logic yet.

**Keyboard:** Tab reaches every print (the archive scrolls to the focused one), Enter takes it down, and Escape returns it with focus back on that print.

**Reduced motion:** no drift, swing or rope play, and no arm. three.js and the model are never downloaded. Selecting goes straight to the detail and back.

## The arm

**Model:** `src/assets/work/glb/younes_tattoo_arm_rigged.glb`, the prepared arm described in [YOUNES_ARM_ASSET_NOTES.md](YOUNES_ARM_ASSET_NOTES.md). It's derived from "Right_Arm tattoo Mhest" by Miguelhest, CC BY 4.0 (credit in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)).
- **Mesh:** a relaxed right arm whose sleeve (black-and-grey realism with red roses) is textured on the outer side only.
- **Rig:** three joints (`ArmRoot`, `Forearm`, `WristHand`) and three clips (`Reach` 1.0s, `Grip` 0.48s, `Pull` 0.95s), used as prepared.
- **Optimisation:** the shipped copy only recompresses the 2048² colour texture (PNG to JPEG) and repacks the buffers, taking it from 3.1 MB to 1.3 MB. The rig, weights and clips are untouched. The original package stays local in `assets-src/arm/` (git-ignored).

**How the clips are used:** GSAP controls where the arm is, on screen and aimed at the selected print. The clips provide the local forearm and wrist motion. Each clip's progress (`pose.reach`, `pose.grip`, `pose.pull`, 0..1) is tweened on the same beats as the screen-space motion and applied by the mixer every frame, so they never run on their own clock. The clips' boundaries line up (Reach ends where Grip starts, and Grip ends where Pull starts), so they hand over without blending.

**Known issue in the prepared rig:**
- **Inverted rig:** the mesh is oriented hand-down (hand at y≈0, shoulder at y=1.615), but the joints were placed as if the hand were at the top.
  - `ArmRoot` (y=0) carries the hand, wrist and forearm (8,765 vertices). They are rigid.
  - `Forearm` (y=0.94) moves the upper arm, and `WristHand` (y=1.23) moves the shoulder cap.
  - So the clips' wrist rotations (7–16°) bend the upper arm, which is off-screen, and the hand itself never articulates.
- **Hard weights:** each vertex follows one joint, so a larger bend would crease the sleeve at y≈0.75 and y≈1.14. At the clips' angles that is not visible on screen.
- **Fix:** re-skin with the joints at the wrist and elbow of the hand-down mesh (or flip the mesh) and soft weights across the joints. No code change is needed; the clip names and timeline stay the same.

**Rendering:** one transparent WebGL canvas lives in the detail dialog, above the flying print (`armStage.ts`).
- **Loading:** three.js, the loader and the model load lazily when the archive comes into view, in their own chunk. The model loads once and is reused for every pick.
- **Running:** it renders only while a pick plays, then stops.
- **Cleanup:** geometry, materials, textures, the shadow map and the renderer are disposed when the archive unmounts.
- **Fallback:** if WebGL or the model fails, the print lifts off and flies to the detail on its own.

**Camera:** a stable perspective camera. One world unit is one CSS px at the print's plane, so each pick reads the selected print's DOM rectangle and the hand is placed on it directly. Moving toward the viewer gets real perspective.

**Layering:** fingers in front, the print in the middle, the forearm behind.
- The hand stays in front of the print's plane the whole time, and the forearm tips away into the scene.
- An invisible plane the size of the print sits exactly where the print is. It writes depth and catches the hand's shadow. Wherever the forearm passes behind the print it is genuinely hidden, while the fingers stay over the print's edge.
- Nothing ever crosses the print's plane, so the arm can never appear to come through the photograph.
- Once the print has come to the hand, it rides on the finger pads (with a whisper of lag in its angle), so hand and print move as one.

**Light:** a warm-neutral key from above-left (matching the prints' own shadows), a warm hemisphere fill, a dim warm side fill, soft shadows on the print and on the paper behind, and neutral tone mapping. There's no environment map, no rim light and no cool tones.

**Staging:** everything is tunable in `arm/armConfig.ts`.
- **Contact point:** the target is a contact point on the selected print, never its centre.
- **Lean:** the arm leans toward the print from one shoulder below the screen on the right, kept between 15° and 30° wherever the print is. On tall screens the shoulder is further right, so the upper arm (and the model's cut end) always leaves past the right edge.
- **Scale:** the hand is 1.3× the print's width (1.08× on phones).

## Temporary assets and placeholders

| | Status |
|---|---|
| **Arm** (`younes_tattoo_arm_rigged.glb`) | A licensed stock model (CC BY 4.0). **Its sleeve is someone else's tattoo design, not Younes's work.** Before this ships, either credit it visibly and make clear it isn't his, or replace it with a model wearing his own work. The public site also needs a visible attribution line. |
| **Rope** (`src/assets/work/rope.png`) | Provided for this prototype. **Its source and licence are not recorded yet.** Record them (as in INK_ASSETS.md) before it ships. |
| **Detail copy** | Title is the archive's neutral label. Style, placement and the story are marked "to be added": nothing is invented. |
| **Intro copy** | Draft ("Original pieces / no repeats" is from the brief, so confirm it is accurate). "View all works" jumps to the archive, which holds all eight works. |

## Known limits of the prototype

- The archive loops (it is a lap of eight prints), so a print leaves on the left and re-enters on the right.
- The detail view is sized when it opens; resizing the window while it is open doesn't re-flow the flight.
- GSAP (3.15, free standard licence) runs the pick choreography; three.js (r186) renders the arm.
- The fingers are not rigged (by design), and with the rig issue above the wrist doesn't articulate yet either. The grab is sold by staging: pass behind, close over, attach.
- three.js is about 155 kB gzipped, loaded lazily. Vite's 500 kB chunk-size notice for it is expected.
