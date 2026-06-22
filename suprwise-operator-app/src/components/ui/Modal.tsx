import type { ReactNode } from 'react';
import { Pretext } from './Pretext';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${className || ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><Pretext text={title} font="700 15px 'Plus Jakarta Sans'" balanced /></div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
