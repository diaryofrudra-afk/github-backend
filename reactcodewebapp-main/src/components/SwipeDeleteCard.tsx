import { useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';

interface SwipeDeleteCardProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
  foregroundClassName?: string;
  disabled?: boolean;
  deleteLabel?: string;
}

const SWIPE_LIMIT = 112;
const DELETE_THRESHOLD = 118;

export function SwipeDeleteCard({
  children,
  onDelete,
  className = '',
  foregroundClassName = '',
  disabled = false,
  deleteLabel = 'Delete',
}: SwipeDeleteCardProps) {
  const foregroundRef = useRef<HTMLDivElement | null>(null);
  const deleteRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    mode: 'swipe' | 'scroll' | null;
  } | null>(null);

  const setReveal = (offset: number, animated = false) => {
    const foreground = foregroundRef.current;
    const deleteButton = deleteRef.current;
    const reveal = Math.min(SWIPE_LIMIT, Math.max(0, -offset));

    if (foreground) {
      foreground.style.transition = animated ? 'transform 180ms cubic-bezier(.2,.8,.2,1)' : 'none';
      foreground.style.transform = `translate3d(${offset}px, 0, 0)`;
    }

    if (deleteButton) {
      deleteButton.style.transition = animated
        ? 'opacity 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1)'
        : 'none';
      deleteButton.style.opacity = String(Math.min(1, reveal / 28));
      deleteButton.style.transform = `translate3d(${Math.max(0, 100 - (reveal / SWIPE_LIMIT) * 100)}%, 0, 0)`;
      deleteButton.style.pointerEvents = reveal > 8 ? 'auto' : 'none';
    }
  };

  const reset = () => {
    setReveal(0, true);
    dragRef.current = null;
  };

  const startDelete = () => {
    if (disabled) {
      reset();
      return;
    }
    setReveal(-360, true);
    window.setTimeout(onDelete, 170);
  };

  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = ev.target as HTMLElement;
    if (target.closest('input, textarea, select, button, a, [data-no-swipe]')) return;

    dragRef.current = {
      startX: ev.clientX,
      startY: ev.clientY,
      pointerId: ev.pointerId,
      mode: null,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== ev.pointerId) return;

    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;

    if (drag.mode === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
    }

    if (drag.mode !== 'swipe') return;

    ev.preventDefault();
    const offset = Math.min(0, Math.max(-SWIPE_LIMIT, dx));
    setReveal(offset);
  };

  const onPointerUp = (ev: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== ev.pointerId) return;

    const dx = ev.clientX - drag.startX;
    if (drag.mode === 'swipe' && dx < -DELETE_THRESHOLD) {
      startDelete();
      return;
    }
    reset();
  };

  return (
    <div
      className={`swipe-delete-card ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
    >
      <button
        ref={deleteRef}
        type="button"
        className="swipe-delete-action"
        onClick={startDelete}
        aria-label={deleteLabel}
      >
        <DeleteIcon />
        <span>{deleteLabel}</span>
      </button>
      <div ref={foregroundRef} className={`swipe-delete-foreground ${foregroundClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}

function DeleteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 7l1 12a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 19l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 11v5M13.5 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
