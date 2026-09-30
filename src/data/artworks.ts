import botanical from '../assets/placeholders/botanical.svg';
import geometric from '../assets/placeholders/geometric.svg';
import contour from '../assets/placeholders/contour.svg';
import hand from '../assets/placeholders/hand.svg';
import mark from '../assets/placeholders/mark.svg';
import wave from '../assets/placeholders/wave.svg';
import arc from '../assets/placeholders/arc.svg';

export interface Artwork {
  id: string;
  title: string;
  category: string;
  image: string;
  description?: string;
  /** true = not real studio work, safe to show as a stand-in only */
  placeholder?: boolean;
}

/**
 * No real portfolio photography exists yet. These are abstract line-study
 * placeholders, not invented "Younes work" - swap `image` (and title/
 * category/description) for real pieces when they're ready. Keep every
 * entry's `placeholder: true` until it's a genuine studio photo.
 */
export const ARTWORKS: Artwork[] = [
  {
    id: 'study-01',
    title: 'Study 01',
    category: 'Botanical',
    image: botanical,
    description: 'Line study, botanical form.',
    placeholder: true,
  },
  {
    id: 'study-02',
    title: 'Form Study',
    category: 'Geometric',
    image: geometric,
    description: 'Concentric form study.',
    placeholder: true,
  },
  {
    id: 'study-03',
    title: 'Line Study',
    category: 'Contour',
    image: contour,
    description: 'Contour line study.',
    placeholder: true,
  },
  {
    id: 'study-04',
    title: 'Form Study II',
    category: 'Anatomical',
    image: hand,
    description: 'Anatomical line study.',
    placeholder: true,
  },
  {
    id: 'study-05',
    title: 'Mark',
    category: 'Minimal',
    image: mark,
    description: 'Minimal mark study.',
    placeholder: true,
  },
  {
    id: 'study-06',
    title: 'Wave Study',
    category: 'Abstract',
    image: wave,
    description: 'Abstract contour study.',
    placeholder: true,
  },
  {
    id: 'study-07',
    title: 'Arc Study',
    category: 'Geometric',
    image: arc,
    description: 'Geometric arc study.',
    placeholder: true,
  },
];
