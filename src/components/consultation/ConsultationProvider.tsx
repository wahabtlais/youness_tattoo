import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ConsultationEntry } from '../../domain/consultation';
import { ConsultationContext } from './consultationContext';
import { ConsultationPanel } from './ConsultationPanel';

/**
 * One consultation for the whole site, reachable from any page. Holds where
 * it was opened from (`entry`), which is what Find Similar will build on:
 * a consultation that starts from a specific piece of Younes's work.
 */
export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<ConsultationEntry | null>(null);
  const open = useCallback((next: ConsultationEntry) => setEntry(next), []);
  const close = useCallback(() => setEntry(null), []);
  const controls = useMemo(() => ({ open, close }), [open, close]);

  return (
    <ConsultationContext value={controls}>
      {children}
      <ConsultationPanel entry={entry} onClose={close} />
    </ConsultationContext>
  );
}
