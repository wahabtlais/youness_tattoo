import type { ConsultationEntry } from '../../domain/consultation';

type CallEntry = Extract<ConsultationEntry, { from: 'canvas-call' }>;

/**
 * The Canvas Call a consultation answers, wherever the consultation shows
 * its context (the first step, the review, the finished draft) - its title
 * as the visitor saw it, and whether it was a fictional example.
 */
export function ConsultationCall({ entry }: { entry: CallEntry }) {
  return (
    <div className="border-l border-burgundy pl-4">
      <p className="type-meta text-ink-soft">Responding to the canvas call</p>
      <p className="mt-1.5 font-serif text-lede">{entry.title}</p>
      {entry.demo && <p className="mt-1.5 type-meta text-burgundy">Demo call — a fictional example</p>}
    </div>
  );
}
