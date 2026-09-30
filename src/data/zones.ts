export interface RevealZone {
  id: string;
  /** fractional bounding box within the figure plate, [min, max] on each axis */
  x: [number, number];
  y: [number, number];
  title: string;
  subtitle: string;
}

/**
 * Coordinates are fractions of the figure plate, calibrated against the
 * current placeholder statue artwork. Re-calibrate against the actual
 * bounding box once the real angel artwork is in (see src/assets/README.md).
 */
export const ZONES: RevealZone[] = [
  { id: 'forearm', x: [0.7, 0.95], y: [0.24, 0.4], title: 'Forearm sleeve', subtitle: 'Botanical · 3 sessions' },
  { id: 'chest', x: [0.26, 0.62], y: [0.26, 0.4], title: 'Chest piece', subtitle: 'Ornamental · 2 sessions' },
  { id: 'sleeve', x: [0.06, 0.28], y: [0.36, 0.62], title: 'Full left sleeve', subtitle: 'Floral · 5 sessions' },
  { id: 'stomach', x: [0.3, 0.6], y: [0.4, 0.56], title: 'Stomach', subtitle: 'Filigree · 2 sessions' },
];

export function findZone(u: number, v: number, zones: RevealZone[] = ZONES): RevealZone | null {
  for (const zone of zones) {
    if (u >= zone.x[0] && u <= zone.x[1] && v >= zone.y[0] && v <= zone.y[1]) return zone;
  }
  return null;
}
