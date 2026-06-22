import type { ReactNode } from 'react';
interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
    maxWidth?: string;
}
export declare function Modal({ open, onClose, title, children, className, maxWidth }: ModalProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=Modal.d.ts.map