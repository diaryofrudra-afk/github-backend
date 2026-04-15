import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Pretext } from './Pretext';
export function EmptyState({ message, icon }) {
    return (_jsxs("div", { className: "empty-state", children: [icon && _jsx("div", { className: "empty-icon", children: icon }), _jsx("p", { children: _jsx(Pretext, { text: message, font: "400 12px Inter", balanced: true }) })] }));
}
//# sourceMappingURL=EmptyState.js.map