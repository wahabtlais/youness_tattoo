import { createContext, useContext } from 'react';
import type { ConsultationEntry } from '../../domain/consultation';

export interface ConsultationControls {
  /** begin a consultation, remembering where the client came from */
  open: (entry: ConsultationEntry) => void;
  close: () => void;
}

export const ConsultationContext = createContext<ConsultationControls | null>(null);

/** Every "Ask Younes" / "Find similar" entry point goes through this. */
export function useConsultation(): ConsultationControls {
  const ctx = useContext(ConsultationContext);
  if (!ctx) throw new Error('useConsultation must be used inside <ConsultationProvider>');
  return ctx;
}
