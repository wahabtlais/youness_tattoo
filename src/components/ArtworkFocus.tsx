import { useEffect, useRef } from 'react';
import type { Artwork } from '../data/artworks';
import './ArtworkFocus.css';

interface ArtworkFocusProps {
  artwork: Artwork | null;
  onClose: () => void;
}

/**
 * The "stepping closer to a painting" state: a centered, enlarged artwork
 * with its metadata, over a scrim. Pure React state, no routing - closing
 * returns focus to whichever frame opened it.
 */
export function ArtworkFocus({ artwork, onClose }: ArtworkFocusProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!artwork) return;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [artwork, onClose]);

  if (!artwork) return null;

  return (
    <div className="artworkFocusScrim" onClick={onClose}>
      <div
        className="artworkFocus"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artworkFocusTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="artworkFocus__close unstyled" onClick={onClose}>
          Close
        </button>
        <div className="artworkFocus__art">
          <img src={artwork.image} alt={`${artwork.title} — ${artwork.category} placeholder study`} />
        </div>
        <div className="artworkFocus__meta">
          <span className="artworkFocus__category">{artwork.category}</span>
          <h3 id="artworkFocusTitle">{artwork.title}</h3>
          {artwork.description && <p>{artwork.description}</p>}
          {artwork.placeholder && <p className="artworkFocus__note">Placeholder study — not final studio work.</p>}
        </div>
      </div>
    </div>
  );
}
