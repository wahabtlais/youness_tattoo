import { forwardRef } from 'react';
import './Cursor.css';

export const Cursor = forwardRef<HTMLDivElement>(function Cursor(_, ref) {
  return <div className="cursorRing" ref={ref} aria-hidden="true" />;
});
