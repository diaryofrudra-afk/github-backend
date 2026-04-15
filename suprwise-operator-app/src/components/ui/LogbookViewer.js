import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { useApp } from '../../context/AppContext';
export function LogbookViewer({ isOpen, onClose, fileDataUrl, fileName, onUpdate, onRemove }) {
    const fileInputRef = useRef(null);
    const { showToast } = useApp();
    if (!isOpen)
        return null;
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024)
            return showToast('File too large (max 5 MB)', 'error');
        if (onUpdate)
            onUpdate(file);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    return (_jsxs("div", { className: "logbook-viewer-overlay", onClick: onClose, children: [_jsx("button", { className: "logbook-viewer-close", onClick: (e) => { e.stopPropagation(); onClose(); }, children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }), _jsx("div", { className: "logbook-viewer-image-container", onClick: e => e.stopPropagation(), children: fileDataUrl ? (fileDataUrl.startsWith('data:application/pdf') ? (_jsx("iframe", { src: fileDataUrl, className: "logbook-viewer-iframe", title: fileName || 'Document' })) : (_jsx("img", { src: fileDataUrl, alt: "Logbook", className: "logbook-viewer-img" }))) : (_jsx("div", { className: "logbook-viewer-empty", children: "No image uploaded" })) }), (onUpdate || onRemove) && (_jsxs("div", { className: "logbook-viewer-actions", children: [onUpdate && (_jsxs("label", { className: "btn-primary logbook-viewer-upload", style: { cursor: 'pointer' }, children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", fill: "none", children: [_jsx("polyline", { points: "16 16 12 12 8 16" }), _jsx("line", { x1: "12", y1: "12", x2: "12", y2: "21" }), _jsx("path", { d: "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" })] }), "Upload New", _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*,application/pdf", style: { display: 'none' }, onChange: handleFileChange })] })), onRemove && fileDataUrl && (_jsxs("button", { className: "btn-primary red logbook-viewer-remove", style: { background: 'var(--red-s)', color: 'var(--red)', border: '1px solid var(--red-g)' }, children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", fill: "none", children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }), "Remove"] }))] }))] }));
}
//# sourceMappingURL=LogbookViewer.js.map