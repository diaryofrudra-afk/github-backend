import type { ReactNode } from 'react';
import { Pretext } from './Pretext';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  maxWidth?: string;
  subtitle?: string;
  variant?: string;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, children, className, maxWidth, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${className || ''}`} onClick={e => e.stopPropagation()} style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><Pretext text={title} font="700 15px 'Plus Jakarta Sans'" balanced /></div>
            {subtitle && <div className="modal-subtitle"><Pretext text={subtitle} font="400 13px 'Plus Jakarta Sans'" balanced /></div>}
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
