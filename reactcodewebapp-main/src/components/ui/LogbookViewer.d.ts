interface LogbookViewerProps {
    isOpen: boolean;
    onClose: () => void;
    fileDataUrl: string | null;
    fileName?: string;
    onUpdate?: (file: File) => void;
    onRemove?: () => void;
}
export declare function LogbookViewer({ isOpen, onClose, fileDataUrl, fileName, onUpdate, onRemove }: LogbookViewerProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=LogbookViewer.d.ts.map