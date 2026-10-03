import type { RefObject } from 'react';
import { HAND_VIEWBOX } from './handGeometry';

/**
 * TEMPORARY PROTOTYPE ASSET - replace with a real photographed, cut-out
 * tattooed hand (two layers, same registration: everything but the thumb,
 * and the thumb alone).
 *
 * An ink-drawn right hand, back to the viewer, reaching up from below:
 * tattoo-flash line art so it reads as drawn on purpose rather than as a
 * failed photograph. It is split in two layers so the pinch is believable:
 * the fingers pass BEHIND the print, the thumb lands IN FRONT of it.
 *
 * Coordinates are in the 240 x 1800 viewBox (most of it forearm). The pickTimeline aligns
 * PINCH (where the thumb tip closes) with the print's bottom edge.
 */
const INK = 'var(--color-ink)';
const SKIN = '#efe4d8';

interface PickingHandProps {
  backRef: RefObject<HTMLDivElement | null>;
  frontRef: RefObject<HTMLDivElement | null>;
  thumbRef: RefObject<SVGGElement | null>;
}

const layer = 'pointer-events-none absolute top-0 left-0 origin-top-left opacity-0 will-change-transform';

export function PickingHand({ backRef, frontRef, thumbRef }: PickingHandProps) {
  return (
    <>
      <div ref={backRef} className={`${layer} pa-hand-shadow z-1`} aria-hidden="true">
        <svg viewBox={`0 0 ${HAND_VIEWBOX.w} ${HAND_VIEWBOX.h}`} className="block size-full overflow-visible">
          <g fill={SKIN} stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            {/* forearm, hand and four fingers */}
            <path d="M72 1800 L76 600 C76 520 74 470 78 432 C70 400 58 360 54 320 C50 290 50 270 54 256 L54 120 C54 100 60 90 72 90 C84 90 90 100 90 120 L90 248 C92 252 94 252 96 248 L96 92 C96 72 102 62 113 62 C124 62 130 72 130 92 L130 250 C132 254 134 254 136 250 L136 118 C136 100 141 92 150 92 C159 92 164 100 164 118 L164 262 C166 266 168 266 170 262 L170 168 C170 154 175 148 181 148 C188 148 192 154 192 168 L192 300 C194 340 190 390 178 430 C180 470 178 520 180 600 L186 1800 Z" />
          </g>
          <g fill="none" stroke={INK} strokeLinecap="round">
            {/* knuckles, joints, wrist */}
            <g strokeWidth="1.3" opacity="0.75">
              <path d="M60 236 C66 230 80 230 86 236 M100 228 C106 222 120 222 126 228 M140 240 C145 234 157 234 160 240 M173 270 C177 265 186 265 189 270" />
              <path d="M60 172 C66 168 80 168 85 172 M101 160 C107 156 120 156 125 160 M141 172 C146 168 157 168 160 172 M174 214 C178 210 186 210 188 214" />
              <path d="M62 126 C68 123 78 123 83 126 M103 112 C108 109 118 109 123 112 M143 128 C147 125 155 125 158 128 M175 180 C179 177 185 177 187 180" />
              <path d="M82 436 C112 446 150 446 176 434" />
            </g>
            {/* shading, hatched along the shadow side */}
            <g strokeWidth="1" opacity="0.5">
              <path d="M186 300 L178 310 M188 318 L179 329 M187 338 L177 349 M184 358 L174 369 M180 378 L171 388 M176 460 L168 470 M177 482 L169 492 M178 506 L170 516" />
            </g>
          </g>
          {/* tattoos */}
          <g fill={INK} stroke={INK} strokeLinecap="round" strokeLinejoin="round">
            {/* dagger on the back of the hand */}
            <circle cx="122" cy="282" r="5" fill="none" strokeWidth="1.8" />
            <path d="M122 287 L122 312" strokeWidth="5" />
            <path d="M102 316 C112 312 132 312 142 316" fill="none" strokeWidth="3" />
            <path d="M115 320 L122 410 L129 320 Z" fill="none" strokeWidth="1.8" />
            <path d="M122 324 L122 398" strokeWidth="0.9" />
            {/* dotwork either side of the blade */}
            <g stroke="none">
              <circle cx="100" cy="350" r="1.6" /><circle cx="94" cy="364" r="1.4" /><circle cx="100" cy="378" r="1.6" />
              <circle cx="144" cy="350" r="1.6" /><circle cx="150" cy="364" r="1.4" /><circle cx="144" cy="378" r="1.6" />
              <circle cx="72" cy="200" r="2" /><circle cx="113" cy="190" r="2" /><circle cx="150" cy="204" r="2" /><circle cx="181" cy="226" r="1.8" />
            </g>
            {/* blackwork bands and a zig-zag panel on the forearm */}
            <path d="M77 528 C110 534 150 534 180 528 L180 560 C150 566 110 566 77 560 Z" stroke="none" />
            <path d="M77 576 C110 582 150 582 180 576" fill="none" strokeWidth="2" />
            <path d="M80 600 L96 624 L112 600 L128 624 L144 600 L160 624 L176 600 M80 640 L96 664 L112 640 L128 664 L144 640 L160 664 L176 640" fill="none" strokeWidth="1.6" />
            <path d="M78 690 C110 696 150 696 181 690" fill="none" strokeWidth="2" />
            {/* the sleeve continues down the arm */}
            <path d="M77 820 C110 828 150 828 182 820 L182 900 C150 908 110 908 77 900 Z" stroke="none" />
            <path d="M76 940 C110 948 150 948 183 940 M76 1000 C110 1008 150 1008 183 1000" fill="none" strokeWidth="2" />
          </g>
        </svg>
      </div>

      <div ref={frontRef} className={`${layer} z-3`} aria-hidden="true">
        <svg viewBox={`0 0 ${HAND_VIEWBOX.w} ${HAND_VIEWBOX.h}`} className="block size-full overflow-visible">
          <g ref={thumbRef}>
            <path
              d="M52 400 C40 360 44 300 52 250 C58 214 62 196 66 184 C70 170 84 168 88 182 C92 196 90 216 88 240 C86 290 88 330 92 372 Z"
              fill={SKIN}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M70 192 C70 183 84 182 85 192 C84 200 71 201 70 192 Z" fill="none" stroke={INK} strokeWidth="1.2" opacity="0.8" />
            <path d="M57 262 C64 258 78 258 84 262" fill="none" stroke={INK} strokeWidth="1.3" opacity="0.75" />
            {/* a small star on the thumb */}
            <path d="M70 300 L73 309 L82 309 L75 315 L78 324 L70 318 L62 324 L65 315 L58 309 L67 309 Z" fill={INK} />
          </g>
        </svg>
      </div>
    </>
  );
}
