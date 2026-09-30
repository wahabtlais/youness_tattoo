import { useRef, useState } from 'react';
import { ArtworkFrame } from '../components/ArtworkFrame';
import { ArtworkFocus } from '../components/ArtworkFocus';
import { useInView } from '../hooks/useInView';
import { ARTWORKS, type Artwork } from '../data/artworks';
import './Work.css';

/**
 * Desktop salon placement for the 7 pieces (indexed to ARTWORKS order).
 * Asymmetric on purpose - see brief step 3. Below 900px this is unused;
 * ArtworkFrame.css falls back to a plain stacked column.
 */
const LAYOUT: React.CSSProperties[] = [
  { '--fx': '4%', '--fy': '2%', '--fw': 'clamp(180px,16vw,260px)', '--fh': 'clamp(240px,22vw,340px)', '--frot': '-1.2deg' } as React.CSSProperties,
  { '--fx-r': '8%', '--fy': '6%', '--fw': 'clamp(140px,12vw,200px)', '--fh': 'clamp(140px,12vw,200px)', '--frot': '1deg' } as React.CSSProperties,
  { '--fx-r': '22%', '--fy': '27%', '--fw': 'clamp(160px,13vw,220px)', '--fh': 'clamp(120px,10vw,170px)', '--frot': '0.6deg' } as React.CSSProperties,
  { '--fx': '3%', '--fy': '47%', '--fw': 'clamp(190px,17vw,270px)', '--fh': 'clamp(260px,23vw,360px)', '--frot': '0.8deg' } as React.CSSProperties,
  { '--fx-r': '5%', '--fy': '54%', '--fw': 'clamp(110px,9vw,150px)', '--fh': 'clamp(110px,9vw,150px)', '--frot': '-1.6deg' } as React.CSSProperties,
  { '--fx': '38%', '--fy': '63%', '--fw': 'clamp(150px,12vw,200px)', '--fh': 'clamp(110px,9vw,150px)', '--frot': '1.6deg' } as React.CSSProperties,
  { '--fx': '44%', '--fy': '9%', '--fw': 'clamp(120px,10vw,160px)', '--fh': 'clamp(160px,13vw,210px)', '--frot': '-0.9deg' } as React.CSSProperties,
];

export function Work() {
  const [selected, setSelected] = useState<Artwork | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [headingRef, headingIn] = useInView<HTMLDivElement>();

  function handleSelect(artwork: Artwork, el: HTMLButtonElement) {
    lastTriggerRef.current = el;
    setSelected(artwork);
  }

  function handleClose() {
    setSelected(null);
    lastTriggerRef.current?.focus();
  }

  return (
    <section className="work" id="work" aria-labelledby="workHeading">
      <div className="work__intro" ref={headingRef} data-in={headingIn}>
        <span className="kicker">The gallery</span>
        <h2 id="workHeading">A wall of work in progress.</h2>
        <p>Studies and forms while the studio's portfolio is prepared. Select a piece to look closer.</p>
      </div>

      <div className={`work__wall${selected ? ' work__wall--dimmed' : ''}`}>
        {ARTWORKS.map((artwork, i) => (
          <ArtworkFrame key={artwork.id} artwork={artwork} style={LAYOUT[i]} onSelect={handleSelect} />
        ))}
      </div>

      <ArtworkFocus artwork={selected} onClose={handleClose} />
    </section>
  );
}
