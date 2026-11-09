import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { adoptShellPortrait, HERO_PORTRAIT, shellPortraitImage } from './heroPortrait';

interface ArtistPortraitProps {
  alt: string;
  /** receives the pointer parallax transform (useHeroMotion) */
  parallaxRef: RefObject<HTMLDivElement | null>;
  /** the on-screen photographic box: registers the knock-out type's mask */
  plateRef: RefObject<HTMLDivElement | null>;
  /** the image has loaded (the hero's decoration waits for it) */
  onLoad?: () => void;
}

/**
 * Nested wrappers so each motion source owns exactly one property:
 * parallax (pointer transform, written by useHeroMotion) > scroll
 * (transform from --p / the scroll timeline) > breathe (translate/scale
 * keyframes) > plate.
 *
 * The image is the page's largest paint: preloaded by index.html, high
 * priority, sized for the screen, and visible from its first frame (its
 * entrance moves it, never fades it in from nothing). Arriving on the
 * pre-rendered page, the image already on screen is carried over as it is
 * (heroPortrait.ts: a new one would paint again and count as the page's
 * largest paint a second time); React leaves it alone inside the plate, and
 * it goes when the plate does.
 */
export function ArtistPortrait({ alt, parallaxRef, plateRef, onLoad }: ArtistPortraitProps) {
  const [shell] = useState(shellPortraitImage);
  const loaded = useRef(onLoad);
  useLayoutEffect(() => {
    loaded.current = onLoad;
  });
  useLayoutEffect(() => {
    const plate = plateRef.current;
    if (!shell || !plate) return;
    return adoptShellPortrait(shell, plate, alt, () => loaded.current?.());
  }, [shell, alt, plateRef]);

  return (
    <div className="heroPortrait" ref={parallaxRef}>
      <div className="heroPortrait__scroll">
        <div className="heroPortrait__breathe">
          <div className="heroPortrait__plate" ref={plateRef}>
            {shell ? null : (
              <img
                src={HERO_PORTRAIT.src}
                srcSet={HERO_PORTRAIT.srcSet}
                sizes={HERO_PORTRAIT.sizes}
                width={HERO_PORTRAIT.width}
                height={HERO_PORTRAIT.height}
                alt={alt}
                draggable={false}
                fetchPriority="high"
                onLoad={onLoad}
                onError={onLoad}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
