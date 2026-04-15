import { jsx as _jsx } from "react/jsx-runtime";
import { Pretext } from './Pretext';
export function Badge({ label, variant = 'default', className }) {
    return (_jsx("span", { className: `badge badge-${variant} ${className || ''}`, children: _jsx(Pretext, { text: label, font: "700 8px 'Plus Jakarta Sans'", balanced: true }) }));
}
//# sourceMappingURL=Badge.js.map