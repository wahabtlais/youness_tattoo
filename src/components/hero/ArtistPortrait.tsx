import type { RefObject } from 'react';

interface ArtistPortraitProps {
  /**
   * - rest:   the portrait as printed on the page (under the knockout type)
   * - reveal: a registered copy above every type plane, masked to the cursor
   *           spotlight, so the spotlight cuts through the print - letters
   *           included - to the photograph underneath
   */
  plane: 'rest' | 'reveal';
  /**
   * rest: the soft editorial plate. reveal: today the sharper, closer
   * "developed" plate of the same photo; swap in the real tattoo layer
   * (same size + registration) later with no other changes.
   */
  src: string;
  alt?: string;
  parallaxRef: RefObject<HTMLDivElement | null>;
  /**
   * rest: the on-screen photographic box (registers the type knockout).
   * reveal: the masked plate - receives --mx / --my / --r from useRevealEngine.
   */
  plateRef: RefObject<HTMLDivElement | null>;
}

/**
 * Nested wrappers so each motion source owns exactly one property:
 * parallax (pointer transform, written by the reveal engine) > scroll
 * (transform from --p) > breathe (translate/scale keyframes) > plate.
 * Both planes share the same classes, so they stay in register.
 */
export function ArtistPortrait({ plane, src, alt = '', parallaxRef, plateRef }: ArtistPortraitProps) {
  return (
    <div className={`heroPortrait heroPortrait--${plane}`} ref={parallaxRef} aria-hidden={plane === 'reveal'}>
      <div className="heroPortrait__scroll">
        <div className="heroPortrait__breathe">
          <div className="heroPortrait__plate" ref={plateRef}>
            {plane === 'rest' ? (
              <img src={src} alt={alt} draggable={false} decoding="async" fetchPriority="high" />
            ) : (
              <div className="heroPortrait__loupe" style={{ backgroundImage: `url(${src})` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
