import type { ImageAsset } from './media';

/**
 * One finished tattoo by Younes. Everything beyond the photograph is
 * optional because it only exists once Younes supplies it - never fill a
 * field with a guess.
 */
export interface TattooWork {
  /** stable identifier, also the order number shown on the page ("01") */
  id: string;
  /** URL segment for /work/:slug */
  slug: string;
  /** neutral label until a real title exists */
  title: string;
  image: ImageAsset;
  /** describes the photograph for screen readers */
  alt: string;
  style?: string;
  placement?: string;
  description?: string;
  /** search / Find Similar vocabulary (subject, technique, motif) */
  tags?: string[];
}

export type WorkShape = 'square' | 'portrait' | 'tall';

/** the photograph's native shape, from its pixel size */
export function workShape({ image }: TattooWork): WorkShape {
  const r = image.width / image.height;
  if (r > 0.95) return 'square';
  if (r > 0.7) return 'portrait';
  return 'tall';
}

/** e.g. 4:5 - factual, shown as contact-sheet metadata */
export const SHAPE_RATIO: Record<WorkShape, string> = { square: '1:1', portrait: '4:5', tall: '9:16' };
