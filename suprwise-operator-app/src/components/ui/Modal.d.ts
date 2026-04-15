import type { ReactNode } from 'react';
interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
}
export declare function Modal({ open, onClose, title, children, className }: ModalProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=Modal.d.ts.map