import type { Appointment } from '../types';
import { useResource } from '../useResource';

const active = (rows: Appointment[]) => rows.filter((a) => a.status === 'proposed' || a.status === 'confirmed');

/** the appointments overlapping [from, to) - live from the server, cancelled and finished ones left out of the calendar */
export function useAppointments(from: Date, to: Date) {
  const r = useResource<Appointment[]>(`/api/studio/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, active);
  return { list: r.data, error: r.error, reload: r.reload };
}
