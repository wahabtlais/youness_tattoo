/** an L: one hairline along the top, one down the left; rotated per corner */
const MARK =
  'pointer-events-none fixed z-41 size-corner opacity-42 before:absolute before:top-0 before:left-0 before:h-px before:w-full before:bg-ink after:absolute after:top-0 after:left-0 after:h-full after:w-px after:bg-ink';

const CORNERS = [
  'top-margin-y left-margin-x',
  'top-margin-y right-margin-x rotate-90',
  'bottom-margin-y left-margin-x rotate-270',
  'bottom-margin-y right-margin-x rotate-180',
];

/**
 * Transfer-paper registration brackets in the four corners of the viewport -
 * the site-wide print motif, on every page.
 */
export function RegistrationMarks() {
  return CORNERS.map((corner) => <i key={corner} aria-hidden="true" className={`${MARK} ${corner}`} />);
}
