import { Link } from 'react-router';
import { CALL_STATUS_LABEL, type CanvasCallArtwork, type CanvasCallStatus } from '../../domain/canvasCall';
import type { JournalImage } from '../../domain/journal';
import type { TattooWork } from '../../domain/work';
import { useWork } from '../../hooks/useWork';
import { cx } from '../../lib/cx';
import { PlaceholderPlate } from '../ui/PlaceholderPlate';
import { ResponsiveImage } from '../ui/ResponsiveImage';

/**
 * The picture for a journal post or a canvas call: one of Younes's pieces
 * (by id, captioned), its own photograph, or a placeholder plate. `ratio`
 * crops to a frame; without it the photograph keeps its own shape.
 */
export function ContentPicture({
  picture,
  ratio,
  sizes,
  demo,
  priority,
  className,
}: {
  picture: JournalImage | CanvasCallArtwork | undefined;
  ratio?: string;
  sizes: string;
  demo?: boolean;
  /** the page's lead picture, above the fold: fetched at once, not lazily */
  priority?: boolean;
  className?: string;
}) {
  const work = useWork();
  if (!picture || ('kind' in picture && picture.kind === 'placeholder')) {
    return <PlaceholderPlate label={demo ? 'Artwork to come — demo' : 'Artwork to come'} ratio={ratio ?? '4 / 5'} className={className} />;
  }
  const workId = 'workId' in picture ? picture.workId : null;
  const piece = workId && work.status === 'success' ? work.data.find((w) => w.id === workId) : undefined;
  const image = piece ? piece.image : 'image' in picture ? picture.image : null;
  if (!image) return <PlaceholderPlate label="Image to come" ratio={ratio ?? '4 / 5'} className={className} />;
  const alt = piece ? piece.alt : 'alt' in picture ? picture.alt : '';
  const caption =
    'caption' in picture && picture.caption
      ? picture.caption
      : piece
        ? `Reference from the portfolio · ${piece.id}${demo ? ' — demo' : ''}`
        : undefined;
  return (
    <figure className={className}>
      <span className="block border border-rule bg-paper-light p-[clamp(0.3rem,0.7vw,0.55rem)]">
        <ResponsiveImage image={image} alt={alt} ratio={ratio} sizes={sizes} priority={priority} className="block h-auto w-full" />
      </span>
      {caption && <figcaption className="mt-2 type-meta text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}

/** a call's status, in mono: open in burgundy with a filled mark, the rest quieter */
export function StatusTag({ status, className }: { status: CanvasCallStatus; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 type-meta', status === 'open' ? 'text-burgundy' : 'text-ink-soft', className)}>
      <span
        aria-hidden="true"
        className={cx(
          'size-2 rounded-full border',
          status === 'open' ? 'border-burgundy bg-burgundy' : status === 'upcoming' ? 'border-ink-soft' : 'border-ink-muted bg-ink-muted/40',
        )}
      />
      {CALL_STATUS_LABEL[status]}
    </span>
  );
}

/** a row of small prints linking to the pieces' own pages (/work/:slug) */
export function RelatedWork({ pieces, title = 'Related work' }: { pieces: TattooWork[]; title?: string }) {
  if (!pieces.length) return null;
  return (
    <nav aria-label={title} className="border-t border-rule pt-5">
      <p className="mb-3 type-meta text-ink-soft">{title}</p>
      <ul className="flex flex-wrap gap-3">
        {pieces.map((p) => (
          <li key={p.id}>
            <Link to={`/work/${p.slug}`} aria-label={`${p.title} ${p.id}`} className="group block w-[clamp(4.5rem,8vw,6rem)]">
              <span className="block border border-rule bg-paper-light p-1 transition-colors group-hover:border-burgundy group-focus-visible:border-burgundy">
                <ResponsiveImage image={p.image} alt="" ratio="4 / 5" sizes="96px" />
              </span>
              <span className="mt-1.5 block type-meta text-ink-muted group-hover:text-burgundy">/ {p.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** a quiet "← Journal" style link back to an index */
export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-3 type-label text-ink-soft transition-colors hover:text-burgundy">
      <span aria-hidden="true">&larr;</span>
      {children}
    </Link>
  );
}
