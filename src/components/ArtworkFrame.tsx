import type { Artwork } from '../data/artworks';
import './ArtworkFrame.css';

interface ArtworkFrameProps {
  artwork: Artwork;
  style?: React.CSSProperties;
  onSelect: (artwork: Artwork, el: HTMLButtonElement) => void;
}

export function ArtworkFrame({ artwork, style, onSelect }: ArtworkFrameProps) {
  return (
    <button
      type="button"
      className="artworkFrame unstyled"
      style={style}
      onClick={(e) => onSelect(artwork, e.currentTarget)}
      aria-label={`${artwork.title} — ${artwork.category}${artwork.placeholder ? ' (placeholder study)' : ''}`}
    >
      <span className="artworkFrame__art">
        <img src={artwork.image} alt="" />
      </span>
      <span className="artworkFrame__caption">
        <span className="artworkFrame__title">{artwork.title}</span>
        <span className="artworkFrame__category">{artwork.category}</span>
      </span>
    </button>
  );
}
