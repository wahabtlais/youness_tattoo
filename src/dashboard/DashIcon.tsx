import { cx } from '../lib/cx';
import { DASH_ICONS, type DashIconName } from './dashIcons';

/** one of the dashboard's hairline icons; decorative - the control beside or around it carries the name */
export function DashIcon({ name, className }: { name: DashIconName; className?: string }) {
  const icon = DASH_ICONS[name];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('size-[1.15rem] shrink-0', className)}
    >
      {icon.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {icon.circles?.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </svg>
  );
}
