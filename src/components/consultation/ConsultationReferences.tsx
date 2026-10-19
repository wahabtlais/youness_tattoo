import type { ConsultationEntry } from '../../domain/consultation';
import type { TattooWork } from '../../domain/work';
import { preferenceLabel } from '../find-similar/findSimilarSession';
import { ResponsiveImage } from '../ui/ResponsiveImage';

interface ConsultationReferencesProps {
  entry: Extract<ConsultationEntry, { from: 'find-similar' }>;
  pieces: TattooWork[];
  /** full: the starting piece, what was kept, what drew them; compact: one line */
  compact?: boolean;
}

/**
 * What the client brought from Find Similar: the piece they started from
 * (always first, and labelled as such), the further pieces they kept, and
 * what they said draws them. Real pieces only - read from the archive by id.
 */
export function ConsultationReferences({ entry, pieces, compact }: ConsultationReferencesProps) {
  const find = (id: string) => pieces.find((p) => p.id === id);
  const origin = find(entry.workId);
  const kept = (entry.selection?.references ?? []).map(find).filter((p) => p !== undefined);
  const drawnTo = entry.selection?.drawnTo ?? [];
  const note = entry.selection?.note;
  if (!origin) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ul className="flex shrink-0 gap-1.5" aria-label="Your references">
          {[origin, ...kept].map((p, i) => (
            <li key={p.id} className={i === 0 ? 'w-8 border border-burgundy p-px' : 'w-8 border border-rule p-px'}>
              <ResponsiveImage image={p.image} alt={i === 0 ? `Starting piece: ${p.alt}` : `${p.title} ${p.id}`} ratio="4 / 5" sizes="32px" />
            </li>
          ))}
        </ul>
        <p className="type-meta text-ink-soft">
          Starting from {origin.id}
          {kept.length > 0 && ` · ${kept.length} more`}
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Your references" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <figure className="w-[clamp(4.75rem,15vw,6.5rem)]">
          <span className="block border border-burgundy bg-paper p-1">
            <ResponsiveImage image={origin.image} alt={origin.alt} ratio="4 / 5" sizes="104px" />
          </span>
          <figcaption className="mt-2 type-meta text-ink-soft">
            Starting piece · <span className="text-burgundy">{origin.id}</span>
          </figcaption>
        </figure>
        {kept.length > 0 && (
          <div>
            <p className="type-meta text-ink-soft">Also kept</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {kept.map((p) => (
                <li key={p.id} className="w-12">
                  <span className="block border border-rule bg-paper p-0.5">
                    <ResponsiveImage image={p.image} alt={`${p.title} ${p.id}`} ratio="4 / 5" sizes="48px" />
                  </span>
                  <span className="mt-1 block type-meta text-ink-soft">{p.id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {(drawnTo.length > 0 || note) && (
        <div className="text-body leading-copy text-ink-soft">
          {drawnTo.length > 0 && <p>Drawn to {drawnTo.map(preferenceLabel).join(' · ').toLowerCase()}</p>}
          {note && <p className="mt-1 font-serif text-lede italic">“{note}”</p>}
        </div>
      )}
    </section>
  );
}
