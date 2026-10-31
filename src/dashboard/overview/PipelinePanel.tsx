import { pipeline, WINDOW_WEEKS } from '../analytics';
import { BarList } from '../charts/BarList';
import { STATUS_LABEL } from '../format';
import type { Overview } from '../types';
import { STUDIO_ROOT } from '../navigation';
import { Panel } from './Panel';

/**
 * Where the inquiries stand, by the consultation's own statuses, in the
 * order an inquiry moves through them - each in its stage colour, the same
 * as on the inquiry map and the detail page. Above the rows, one strip
 * splits the whole into active and closed with both counts written out;
 * then each stage with its count and share, active and closed under their
 * own headings. Counts and shares are of the same records the activity
 * chart counts.
 */
export function PipelinePanel({ o, className }: { o: Overview; className?: string }) {
  const p = pipeline(o);
  const firstClosed = p.rows.findIndex((r) => !r.open);
  const closed = p.total - p.open;
  return (
    <Panel
      id="studioPipeline"
      title="Inquiry pipeline"
      icon="funnel"
      tone="info"
      context={`${p.total} inquiries received in the last ${WINDOW_WEEKS} weeks`}
      link={{ to: `${STUDIO_ROOT}/inquiries`, label: 'Inquiry map' }}
      className={className}
    >
      {p.total === 0 ? (
        <p className="py-8 text-center text-body text-ink-soft">No inquiries yet — the pipeline fills as they arrive.</p>
      ) : (
        <>
          <div className="mb-4">
            <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {p.rows
                .filter((r) => r.count > 0)
                .map((r) => (
                  <span key={r.status} data-status={r.status} className="h-full bg-(--st-solid)" style={{ flexGrow: r.count, opacity: r.open ? 1 : 0.55 }} />
                ))}
            </div>
            <p className="mt-2 flex justify-between gap-3 text-[0.8125rem]">
              <span>
                <span className="font-bold text-ink tabular-nums">{p.open}</span> <span className="text-ink-soft">active</span>
              </span>
              <span>
                <span className="font-bold text-ink tabular-nums">{closed}</span> <span className="text-ink-soft">closed</span>
              </span>
            </p>
          </div>
          <BarList
            label={`Inquiries by status, last ${WINDOW_WEEKS} weeks`}
            rows={p.rows.map((r, i) => ({
              key: r.status,
              label: STATUS_LABEL[r.status],
              value: r.count,
              share: r.share,
              muted: !r.open,
              status: r.status,
              group: i === 0 ? `Active pipeline · ${p.open}` : i === firstClosed ? `Closed outcomes · ${closed}` : undefined,
            }))}
          />
        </>
      )}
    </Panel>
  );
}
