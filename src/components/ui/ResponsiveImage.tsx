import type { CSSProperties, ImgHTMLAttributes } from 'react';
import type { ImageAsset } from '../../domain/media';
import { cx } from '../../lib/cx';

interface ResponsiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height' | 'alt'> {
  image: ImageAsset;
  /** required: describe the work, or pass "" for a purely decorative image */
  alt: string;
  /**
   * Crop into a fixed frame, e.g. "4 / 5" for a 9:16 photograph in an
   * editorial 4:5 frame. Omit to keep the photograph's own ratio (the
   * caller's frame then decides).
   */
  ratio?: string;
  /** with `ratio`: cover crops to fill the frame, contain shows it all */
  fit?: 'cover' | 'contain';
  /** above the fold: load eagerly at high priority */
  priority?: boolean;
  frameClassName?: string;
}

/**
 * The one way the site puts a photograph on the page: srcset/sizes from the
 * asset's variants, intrinsic size reserved so nothing shifts as it loads,
 * lazy by default, and the focal point kept in frame when cropped. Artwork
 * is never stretched - only cropped (cover) or letterboxed (contain).
 */
export function ResponsiveImage({
  image,
  alt,
  sizes,
  ratio,
  fit = 'cover',
  priority = false,
  className,
  frameClassName,
  style,
  ...rest
}: ResponsiveImageProps) {
  const position = image.focal ? `${image.focal.x * 100}% ${image.focal.y * 100}%` : undefined;
  const img = (
    <img
      src={image.src}
      srcSet={image.variants.length ? image.variants.map((v) => `${v.src} ${v.width}w`).join(', ') : undefined}
      sizes={image.variants.length ? sizes : undefined}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cx(ratio && 'block size-full', ratio && (fit === 'cover' ? 'object-cover' : 'object-contain'), className)}
      style={position ? { objectPosition: position, ...style } : style}
      {...rest}
    />
  );
  if (!ratio) return img;
  return (
    <span className={cx('block overflow-hidden', frameClassName)} style={{ aspectRatio: ratio } as CSSProperties}>
      {img}
    </span>
  );
}
