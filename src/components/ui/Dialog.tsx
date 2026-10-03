import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the visible title */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * A native modal <dialog>: focus moves in and is contained, Escape closes,
 * focus returns to the opener, and the page behind is inert - all from the
 * platform. The dialog is a full-viewport surface; a click on the surface
 * itself (outside the content) closes it. Page scroll is locked while any
 * dialog is open (styles/base.css).
 */
export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
