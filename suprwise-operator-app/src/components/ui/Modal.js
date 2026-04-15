import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Pretext } from './Pretext';
export function Modal({ open, onClose, title, children, className }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsxs("div", { className: `modal ${className || ''}`, onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("div", { className: "modal-title", children: _jsx(Pretext, { text: title, font: "700 15px 'Plus Jakarta Sans'", balanced: true }) }), _jsx("button", { className: "modal-close", onClick: onClose, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", fill: "none", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsx("div", { className: "modal-body", children: children })] }) }));
}
//# sourceMappingURL=Modal.js.map