import type { ImageAsset } from './media';

/**
 * The vocabulary for describing a tattoo. Closed lists, so matching and a
 * future dashboard agree on the words; add a value here when real work
 * needs one. Every descriptive field on a piece is optional - absent means
 * "not known yet", never "not this".
 */
export type TattooSubject =
  | 'botanical'
  | 'animal'
  | 'portrait'
  | 'figure'
  | 'mythological'
  | 'ornamental'
  | 'abstract'
  | 'geometric'
  | 'lettering';
export type TattooStyle =
  | 'fine-line'
  | 'blackwork'
  | 'illustrative'
  | 'realism'
  | 'traditional'
  | 'neo-traditional'
  | 'ornamental';
export type TattooComposition = 'symmetrical' | 'flowing' | 'centred' | 'full-coverage' | 'sleeve';
export type TattooLinework = 'delicate' | 'bold' | 'intricate' | 'minimal';
export type TattooMood = 'dark' | 'calm' | 'delicate' | 'dramatic' | 'organic' | 'playful';
export type TattooPlacement =
  | 'forearm'
  | 'upper-arm'
  | 'shoulder'
  | 'hand'
  | 'chest'
  | 'back'
  | 'ribs'
  | 'leg'
  | 'calf'
  | 'thigh';
export type TattooColour = 'black-and-grey' | 'colour' | 'mixed';

/**
 * Where a piece's descriptive fields come from:
 * - 'demo'     sample values for building and testing the product (Find
 *              Similar's matching). Fictional - not a description of the
 *              photograph - and never shown as a fact about the work.
 * - 'verified' confirmed by Younes. Only these are shown as facts.
 * A piece must be verified before launch (docs/ARCHITECTURE.md).
 */
export type MetadataStatus = 'demo' | 'verified';

/** What can be known about a piece beyond its photograph. */
export interface TattooTraits {
  /** a sentence or two about the piece, in Younes's words */
  description?: string;
  subject?: TattooSubject[];
  style?: TattooStyle[];
  composition?: TattooComposition[];
  linework?: TattooLinework[];
  mood?: TattooMood[];
  placement?: TattooPlacement;
  colour?: TattooColour;
  /** free descriptive words (motif, technique) for future search and filtering */
  tags?: string[];
}

/**
 * One finished tattoo by Younes: its photograph and identity, and whatever
 * is known about it (`TattooTraits`), marked with where that came from.
 */
export interface TattooWork extends TattooTraits {
  /** stable identifier, also the order number shown on the page ("01") */
  id: string;
  /** URL segment for /work/:slug */
  slug: string;
  /** neutral label until a real title exists */
  title: string;
  image: ImageAsset;
  /** describes the photograph for screen readers */
  alt: string;
  metadataStatus: MetadataStatus;
}

/** display words for the vocabulary */
const LABEL: Record<string, string> = {
  'fine-line': 'fine line',
  'neo-traditional': 'neo-traditional',
  'full-coverage': 'full coverage',
  'upper-arm': 'upper arm',
  'black-and-grey': 'black and grey',
};
export const traitLabel = (value: string) => LABEL[value] ?? value;

/**
 * What the site may state about a piece as fact: only verified metadata.
 * Demo values are for matching and stay out of anything presented as
 * information about Younes's work.
 */
export function verifiedFacts(piece: TattooWork) {
  if (piece.metadataStatus !== 'verified') return { meta: '', description: undefined };
  const style = piece.style?.map(traitLabel).join(', ');
  const placement = piece.placement && traitLabel(piece.placement);
  return { meta: [style, placement].filter(Boolean).join(' / '), description: piece.description };
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
