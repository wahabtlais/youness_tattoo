import type { TattooWork } from '../domain/work';
import { useWork } from './useWork';

/** the portfolio pieces with these ids, in that order (unknown ids are skipped) */
export function usePieces(ids: string[] | undefined): TattooWork[] {
  const work = useWork();
  if (!ids?.length || work.status !== 'success') return [];
  return ids.map((id) => work.data.find((w) => w.id === id)).filter((w): w is TattooWork => !!w);
}
