import type { AsyncState } from '../lib/async';
import type { TattooWork } from '../domain/work';
import { WORK } from '../data/work';

const ARCHIVE: AsyncState<TattooWork[]> = { status: 'success', data: WORK };

/**
 * The data boundary for Younes's work: components read the archive here and
 * handle every AsyncState, so the source can change underneath them.
 *
 * Today the archive is static and ships with the bundle, so it is ready on
 * the first render (no loading flash under the hero's hand-off). When it
 * moves to an API, this hook becomes the fetch (keyed request, abort on
 * unmount, `retry` on error) and nothing that calls it changes.
 */
export function useWork(): AsyncState<TattooWork[]> {
  return ARCHIVE;
}
