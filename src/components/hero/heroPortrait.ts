/**
 * The hero portrait (public/hero, made by scripts/build-hero-portrait.mjs
 * from the two plates in src/assets/hero). Fixed addresses, so index.html can
 * preload the right one before any JavaScript runs - keep its inline script
 * in step with these.
 */
export const HERO_PORTRAIT = {
  src: '/hero/younes-1000.webp',
  srcSet: '/hero/younes-640.webp 640w, /hero/younes-1000.webp 1000w',
  /**
   * the portrait's rendered width (Hero.css: --pw = 0.6357 x --ph, where
   * --ph = min(0.98 x max(100svh, 600px), 128vw))
   */
  sizes: 'min(max(62.3vh, 374px), 81.4vw)',
  width: 1000,
  height: 1573,
  /** the knock-out type's mask: only the silhouette is used, so the small file */
  mask: '/hero/younes-640.webp',
};

/**
 * The pre-rendered page's own portrait <img> (scripts/prerender-hero.mjs),
 * kept so the live page can carry on with the same element instead of a new
 * one. The browser counts an element's largest paint once, at its first
 * paint; a fresh image put in its place would paint again - later, and
 * often a little larger (the portrait is still rising into place when the
 * pre-rendered page first shows it) - and become the page's largest paint
 * instead.
 */
let shellPortrait: HTMLImageElement | null = null;

/** take the pre-rendered portrait out of #root before React's first render empties it (main.tsx) */
export function keepShellPortrait() {
  if (typeof document === 'undefined' || !('heroShell' in document.documentElement.dataset)) return;
  shellPortrait = document.querySelector<HTMLImageElement>('#root .heroPortrait__plate img');
}

/** the pre-rendered portrait, if one is waiting to be adopted (null once it has been) */
export function shellPortraitImage() {
  return shellPortrait;
}

/**
 * Put the pre-rendered portrait into the live hero's plate (React renders
 * none there in that case, so never touches it) and report when it has
 * loaded. Later visits to the hero render their own. Returns the cleanup.
 */
export function adoptShellPortrait(img: HTMLImageElement, plate: HTMLElement, alt: string, onLoad: () => void) {
  shellPortrait = null;
  img.alt = alt;
  if (img.parentElement !== plate) plate.appendChild(img);
  if (img.complete) {
    onLoad();
    return;
  }
  img.addEventListener('load', onLoad, { once: true });
  img.addEventListener('error', onLoad, { once: true });
  return () => {
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onLoad);
  };
}
