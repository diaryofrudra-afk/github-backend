import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** The trigger element the popover is anchored to. */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Renders its children in a portal on document.body with fixed positioning,
 * so the popover floats above everything and is never clipped by an ancestor's
 * `overflow: hidden` (e.g. `.bl-card`). Right-aligned to the trigger; repositions
 * on scroll/resize. Closes on click outside both the trigger and the popover.
 */
export function Popover({ anchorRef, open, onClose, className, children }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000 }}
    >
      {children}
    </div>,
    document.body,
  );
}
