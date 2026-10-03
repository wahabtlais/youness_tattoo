import type { TattooWork } from '../domain/work';

/**
 * Real tattoo work by Younes, photographed as delivered. No titles, styles,
 * placements or descriptions have been supplied, so each piece only carries
 * its number and a neutral label - add the real fields here (they exist on
 * TattooWork) when Younes provides them. Do not invent them.
 *
 * Originals live untouched in public/work/; the site serves the WebP copies
 * in public/work/web/ made by scripts/build-work-images.py (`widths` lists
 * which exist). Order here is the order of the archive.
 *
 * Read through hooks/useWork, never imported by components directly - this
 * file is what an API replaces.
 */
interface Source {
  /** file stem in public/work/ */
  file: string;
  width: number;
  height: number;
  widths: number[];
}

const SOURCES: Source[] = [
  { file: 'portrait-02', width: 1125, height: 1406, widths: [640, 1125] },
  { file: 'square-01', width: 1125, height: 1125, widths: [640, 1125] },
  { file: 'vertical-03', width: 941, height: 1672, widths: [640, 941] },
  { file: 'portrait-01', width: 1125, height: 1406, widths: [640, 1125] },
  { file: 'vertical-01', width: 1125, height: 2000, widths: [640, 1125] },
  { file: 'vertical-02', width: 649, height: 1154, widths: [649] },
  { file: 'square-02', width: 1125, height: 1125, widths: [640, 1125] },
  { file: 'portrait-03', width: 1125, height: 1406, widths: [640, 1125] },
];

const LABEL = 'Tattoo study';

export const WORK: TattooWork[] = SOURCES.map(({ file, width, height, widths }, i) => {
  const id = String(i + 1).padStart(2, '0');
  const variants = widths.map((w) => ({ src: `/work/web/${file}-${w}.webp`, width: w }));
  return {
    id,
    slug: id,
    title: LABEL,
    alt: `${LABEL} ${id} - tattoo by Younes`,
    image: { src: variants[variants.length - 1].src, width, height, variants },
  };
});
