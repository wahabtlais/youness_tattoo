/**
 * Which work detail opens from the physical archive:
 *
 *   'a'  Version A - the print laid on paper beside its text (the default)
 *   'b'  Version B (prototype) - the print hangs large on its own rope, the
 *        other prints smaller along it, its details beneath
 *
 * Change DETAIL_VERSION to switch for everyone. To compare the two without
 * rebuilding, open the site with ?detail=a or ?detail=b - that wins for the
 * rest of the visit (it is read once, when the page loads).
 */
export type DetailVersion = 'a' | 'b';

export const DETAIL_VERSION: DetailVersion = 'a';

function chosen(): DetailVersion {
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('detail');
  return asked === 'a' || asked === 'b' ? asked : DETAIL_VERSION;
}

/** the version this visit uses */
export const detailVersion: DetailVersion = chosen();
