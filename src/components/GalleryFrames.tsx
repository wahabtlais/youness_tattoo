import { forwardRef } from 'react';
import botanical from '../assets/placeholders/botanical.svg';
import geometric from '../assets/placeholders/geometric.svg';
import contour from '../assets/placeholders/contour.svg';
import hand from '../assets/placeholders/hand.svg';
import mark from '../assets/placeholders/mark.svg';
import './GalleryFrames.css';

/**
 * Background wall pieces for the hero composition (decorative only, hence
 * aria-hidden - the real, selectable wall lives in sections/Work.tsx and
 * shares the same placeholder art via src/assets/placeholders).
 */
const FRAMES = [
  { src: botanical, className: 'frame frame--a' },
  { src: geometric, className: 'frame frame--b' },
  { src: contour, className: 'frame frame--c' },
  { src: hand, className: 'frame frame--d' },
  { src: mark, className: 'frame frame--e' },
];

export const GalleryFrames = forwardRef<HTMLDivElement>(function GalleryFrames(_, ref) {
  return (
    <div className="galleryFrames" ref={ref} aria-hidden="true">
      {FRAMES.map(({ src, className }) => (
        <div className={className} key={className}>
          <div className="frame__art">
            <img src={src} alt="" />
          </div>
        </div>
      ))}
    </div>
  );
});
