import type { ImageAsset } from '../domain/media';
// the portrait in use: the real photograph on its deep navy backdrop
// (assets-src/artist-portrait-dark.png, kept byte for byte), with a
// controlled low-key lighting treatment - scripts/build-artist-portrait.mjs,
// brightness only, the face as shot. Earlier portraits are kept beside it as
// backups: portrait-paper-* (assets-src/artist-portrait-paper.png) and
// portrait-1400/700 (assets-src/artist-section.png).
import portrait1402 from '../assets/artist/portrait-night-1402.webp';
import portrait700 from '../assets/artist/portrait-night-700.webp';

/**
 * The Artist section's content - kept apart from its layout so Younes's
 * own words and photographs drop in without touching the component.
 *
 * Only what is already known is filled in: his name, that he tattoos in
 * Detroit, Michigan by appointment (as the rest of the site says), and that
 * the work in the archive is his. Nothing about his background, experience,
 * influences or approach is invented: `intro` stays null until he writes it.
 */
export interface ArtistContent {
  label: string;
  /** the line that turns from the work to the person */
  headline: string;
  name: string;
  /** facts, in mono under the signature */
  meta: string[];
  /**
   * His introduction, in his own words, a paragraph per entry. Null until
   * Younes provides it: production then shows nothing in its place, and
   * development shows a marked placeholder so the layout can be judged.
   */
  intro: string[] | null;
  portrait: { image: ImageAsset; alt: string };
}

export const ARTIST: ArtistContent = {
  label: 'The artist',
  headline: 'Every print on that line is his work.',
  name: 'Younes',
  meta: ['Tattoo artist', 'Detroit, Michigan', 'By appointment'],
  intro: null,
  portrait: {
    // Younes in low-key light against deep navy (see the imports above)
    image: {
      src: portrait1402,
      width: 1402,
      height: 1122,
      variants: [
        { src: portrait700, width: 700 },
        { src: portrait1402, width: 1402 },
      ],
    },
    alt: 'Portrait of Younes in a black Sullen Art Company cap and a black T-shirt, lit low and from one side, looking into the camera against a dark backdrop.',
  },
};
