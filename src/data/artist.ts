import type { ImageAsset } from '../domain/media';
import portrait1400 from '../assets/artist/portrait-1400.webp';
import portrait700 from '../assets/artist/portrait-700.webp';

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
    // the portrait chosen for this section, shown whole - its paper-and-ink
    // panel on the right is part of the photograph (original, not served:
    // assets-src/artist-section.png)
    image: {
      src: portrait1400,
      width: 1400,
      height: 1122,
      variants: [
        { src: portrait700, width: 700 },
        { src: portrait1400, width: 1400 },
      ],
    },
    alt: 'Portrait of Younes in a black cap and black T-shirt, looking straight into the camera against a dark backdrop, with ink-drawn leaves on aged paper at the right.',
  },
};
