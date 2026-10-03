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
├── PickingHand.tsx           TEMPORARY hand (SVG)
├── handGeometry.ts           the hand's pinch point, edge offset, thumb pivot
├── WorkPhysicalDetail.tsx    the detail view (native dialog)
└── physicalArchive.css       print paper and shadow, clip, hand shadow
```

The motion has three owners, so nothing fights over a transform:
- **rAF engine** (`useArchiveMotion`): position on the rope and swing.
- **CSS:** the hover/focus lift.
- **GSAP** (`pickTimeline`): the pick.

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

**Pick (about 2.9s):**
1. Select: the archive stops, the others recede, the print lifts.
2. The hand enters from below the screen, still turned slightly.
3. It slows and aligns its pinch under the print.
4. Grab: the thumb closes on the print, which gives a few px.
5. Pull: hand and print come off the rope toward the viewer, scaled about the pinch so they stay together. The rope recoils and the empty clip stays on the line.
6. Detail: the hand lets go and drops away, the paper comes up, and the same print flies into the detail layout. The detail is laid out in that print's exact proportions, so the hand-over is seamless.

**Close** (Close, Escape or a click on the paper): the print flies back to its clip and swings as it is re-hung.

**Find similar** opens the existing consultation with `{ from: 'find-similar', workId }`. There is no similarity logic yet.

**Keyboard:** Tab reaches every print (the archive scrolls to the focused one), Enter takes it down, and Escape returns it with focus back on that print.

**Reduced motion:** no drift, swing or rope play, and no hand. Selecting goes straight to the detail and back.

## Temporary assets and placeholders

| | Status |
|---|---|
| **Hand** (`PickingHand.tsx`) | **Temporary.** An ink-drawn, tattoo-flash-style SVG right hand, split into two layers: fingers behind the print, thumb in front. The project has no hand asset, no image generator was available, and a client's tattooed limb cut out of a portfolio photo would not be appropriate. To replace it: a photographed tattooed hand reaching up, cut out as two registered layers (everything but the thumb / the thumb), with the three points in `handGeometry.ts` re-measured. |
| **Rope** (`src/assets/work/rope.png`) | Provided for this prototype. **Its source and licence are not recorded yet.** Record them (as in INK_ASSETS.md) before it ships. |
| **Detail copy** | Title is the archive's neutral label. Style, placement and the story are marked "to be added": nothing is invented. |
| **Intro copy** | Draft ("Original pieces / no repeats" is from the brief, so confirm it is accurate). "View all works" jumps to the archive, which holds all eight works. |

## Known limits of the prototype

- The archive loops (it is a lap of eight prints), so a print leaves on the left and re-enters on the right.
- The detail view is sized when it opens; resizing the window while it is open doesn't re-flow the flight.
- GSAP (3.15, free standard licence) was added for the pick choreography only.
