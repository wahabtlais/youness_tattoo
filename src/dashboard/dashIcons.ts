/**
 * The dashboard's icons: hairline strokes on a 20px grid, drawn to sit
 * with the mono labels (the site has no general icon set - simple-icons
 * holds brand marks only). Each is a list of path data; circles as
 * [cx, cy, r].
 */
export type DashIconName =
  | 'overview'
  | 'inquiries'
  | 'clients'
  | 'calendar'
  | 'portfolio'
  | 'publishing'
  | 'assistant'
  | 'bell'
  | 'account'
  | 'menu'
  | 'close'
  | 'arrow'
  | 'send'
  | 'external'
  | 'sun'
  | 'moon'
  | 'alert'
  | 'clock'
  | 'reply'
  | 'funnel'
  | 'check'
  | 'prepare'
  | 'up'
  | 'down'
  | 'sparkles'
  | 'globe'
  | 'lock';

export const DASH_ICONS: Record<DashIconName, { paths: string[]; circles?: [number, number, number][] }> = {
  overview: { paths: ['M3.5 3.5h5v5h-5z', 'M11.5 3.5h5v5h-5z', 'M3.5 11.5h5v5h-5z', 'M11.5 11.5h5v5h-5z'] },
  inquiries: { paths: ['M3 11.5 5 4.5h10l2 7v4.5H3z', 'M3 11.5h4.2l.8 2h4l.8-2H17'] },
  clients: {
    paths: ['M2.8 16.2c.6-2.6 2.5-4.1 4.7-4.1s4.1 1.5 4.7 4.1', 'M12.6 4.4a2.5 2.5 0 0 1 0 5', 'M14 12.3c1.6.4 2.6 1.7 3 3.9'],
    circles: [[7.5, 7, 2.6]],
  },
  calendar: { paths: ['M3.5 5h13v11.5h-13z', 'M3.5 8.5h13', 'M7 3v3.5', 'M13 3v3.5'] },
  portfolio: { paths: ['M3.5 3.5h13v13h-13z', 'M3.5 13.2 7.3 9.6l3 2.7 2.4-2 3.8 3.4'], circles: [[12.6, 6.9, 1.2]] },
  publishing: { paths: ['M10 5.5C8.2 4.2 6 3.7 3.5 3.9v11c2.5-.2 4.7.3 6.5 1.6 1.8-1.3 4-1.8 6.5-1.6v-11C14 3.7 11.8 4.2 10 5.5z', 'M10 5.5v11'] },
  assistant: { paths: ['M3.5 4.5h13v9h-7L6 16.5v-3H3.5z', 'M6.5 8h7', 'M6.5 10.5h4.5'] },
  bell: { paths: ['M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z', 'M8.3 16.8a1.8 1.8 0 0 0 3.4 0'] },
  account: { paths: ['M4 17c.9-3 3.2-4.6 6-4.6s5.1 1.6 6 4.6'], circles: [[10, 7, 3]] },
  menu: { paths: ['M3 6h14', 'M3 10h14', 'M3 14h14'] },
  close: { paths: ['M5 5l10 10', 'M15 5 5 15'] },
  arrow: { paths: ['M4 10h12', 'M11.5 5.5 16 10l-4.5 4.5'] },
  send: { paths: ['M10 16V4.5', 'M5.5 9 10 4.5 14.5 9'] },
  external: { paths: ['M8.5 4.5h-4v11h11v-4', 'M11.5 4.5h4v4', 'M15.5 4.5 9 11'] },
  sun: {
    paths: ['M10 2.5v1.8', 'M10 15.7v1.8', 'M2.5 10h1.8', 'M15.7 10h1.8', 'M4.7 4.7 6 6', 'M14 14l1.3 1.3', 'M4.7 15.3 6 14', 'M14 6l1.3-1.3'],
    circles: [[10, 10, 3.2]],
  },
  moon: { paths: ['M15.6 12.3A6.2 6.2 0 0 1 7.7 4.4a6.2 6.2 0 1 0 7.9 7.9z'] },
  alert: { paths: ['M10 3.5 17.2 16H2.8z', 'M10 8.3v3.6', 'M10 14.1v.01'] },
  clock: { paths: ['M10 6.3V10l2.6 1.6'], circles: [[10, 10, 6.6]] },
  reply: { paths: ['M8 5 3.5 9.5 8 14', 'M3.5 9.5h8a5 5 0 0 1 5 5v1'] },
  funnel: { paths: ['M3 4h14l-5.5 6.5V16l-3-1.5v-4z'] },
  check: { paths: ['M4.5 10.5 8 14l7.5-8'] },
  prepare: { paths: ['M8.5 5.5h8', 'M8.5 10h8', 'M8.5 14.5h8', 'M3.5 5.6l1 1 1.7-2', 'M3.5 10.1l1 1 1.7-2', 'M3.8 14.5h1.8'] },
  up: { paths: ['M3.5 14 8 9.5l3 3 5.5-6', 'M12.5 6.5h4v4'] },
  down: { paths: ['M3.5 6 8 10.5l3-3 5.5 6', 'M12.5 13.5h4v-4'] },
  // the assistant's mark: a four-point spark and a small one
  globe: { paths: ['M3.4 10h13.2', 'M10 3.4c-1.9 1.9-2.8 4.2-2.8 6.6s.9 4.7 2.8 6.6', 'M10 3.4c1.9 1.9 2.8 4.2 2.8 6.6s-.9 4.7-2.8 6.6'], circles: [[10, 10, 6.6]] },
  lock: { paths: ['M5 9h10v7.5H5z', 'M7 9V6.5a3 3 0 0 1 6 0V9'] },
  sparkles: { paths: ['M8.5 3.5 9.8 7.2l3.7 1.3-3.7 1.3-1.3 3.7-1.3-3.7-3.7-1.3 3.7-1.3z', 'M14.5 11.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'] },
};
