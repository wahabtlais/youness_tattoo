/** One encoded size of an image. */
export interface ImageVariant {
  src: string;
  /** intrinsic width in px - drives srcset `w` descriptors */
  width: number;
}

/**
 * A photograph as the UI needs it, wherever it is hosted. Intrinsic size is
 * required so every frame can reserve its space before the image loads.
 */
export interface ImageAsset {
  /** the largest variant; the fallback `src` */
  src: string;
  width: number;
  height: number;
  /** ascending by width; empty when only `src` exists */
  variants: ImageVariant[];
  /**
   * The point that must stay in frame when the image is cropped to another
   * ratio (0..1 from the top-left). Centre when absent.
   */
  focal?: { x: number; y: number };
}
