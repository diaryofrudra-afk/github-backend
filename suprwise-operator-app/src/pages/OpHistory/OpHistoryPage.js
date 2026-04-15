import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { LogbookViewer } from '../../components/ui/LogbookViewer';
import { useState, useMemo } from 'react';
function fmt12(t) {
    if (!t)
        return '—';
    const [hh, mm] = t.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export function OpHistoryPage({ active }) {
    const { state, setState, showToast, user } = useApp();
    const { timesheets, files } = state;
    const [viewerFileId, setViewerFileId] = useState(null);
    const myTs = useMemo(() => {
        const entries = user ? (timesheets[user] || []) : [];
        return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [user, timesheets]);
    const myFiles = user ? (files[user] || []) : [];
    const handleUpdateLogbook = async (file) => {
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize)
            return showToast('File too large', 'error');
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                if (viewerFileId)
                    await api.deleteFile(viewerFileId);
                const fileRecord = {
                    id: viewerFileId || String(Date.now()),
                    owner_key: user || '',
                    name: file.name,
                    type: file.type,
                    data: reader.result,
                    size: String(file.size),
                    timestamp: new Date().toISOString(),
                };
                await api.createFile(fileRecord);
                setState(prev => {
                    const uid = user || '';
                    const newFiles = (prev.files[uid] || []).filter((f) => f.id !== viewerFileId);
                    newFiles.unshift(fileRecord);
                    return { ...prev, files: { ...prev.files, [uid]: newFiles } };
                });
                showToast('Logbook updated');
            }
            catch {
                showToast('Update failed', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    function getHoursBadgeColor(hrs) {
        if (hrs >= 10)
            return 'op-hours-purple';
        if (hrs >= 8)
            return 'op-hours-green';
        return 'op-hours-gray';
    }
    function formatDateParts(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const dayName = DAY_NAMES[d.getDay()];
        const day = d.getDate();
        const month = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
        const year = d.getFullYear();
        const formatted = `${String(day).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${year}`;
        return { dayName, day, month, year, formatted };
    }
    return (_jsxs("div", { className: `page ${active ? 'active' : ''}`, id: "page-op-history", children: [_jsx("div", { className: "op-history-wrap", children: !myTs.length ? (_jsx("p", { className: "empty-msg", children: "No shift history yet." })) : (_jsx("div", { className: "op-history-cards", children: myTs.map(e => {
                        const eh = Number(e.hoursDecimal) || 0;
                        const parts = formatDateParts(e.date || '');
                        const hasLogbook = myFiles.some((f) => f.name.startsWith(`Logbook-${e.date}`));
                        const badgeClass = getHoursBadgeColor(eh);
                        return (_jsxs("div", { className: "op-history-card", children: [_jsxs("div", { className: "op-history-card-top", children: [_jsxs("div", { children: [_jsx("div", { className: "op-history-day-label", children: parts.dayName }), _jsx("div", { className: "op-history-date", children: parts.formatted })] }), _jsxs("span", { className: `op-hours-badge ${badgeClass}`, children: [eh.toFixed(1), "h"] })] }), _jsxs("div", { className: "op-history-times", children: [_jsxs("div", { className: "op-history-time-item", children: [_jsx("span", { className: "op-history-time-label", children: "START TIME" }), _jsx("span", { className: "op-history-time-value", children: fmt12(e.startTime) })] }), _jsxs("div", { className: "op-history-time-connector", children: [_jsx("div", { className: "op-history-time-connector-line" }), _jsx("div", { className: "op-history-time-connector-dot" }), _jsx("div", { className: "op-history-time-connector-line" })] }), _jsxs("div", { className: "op-history-time-item", children: [_jsx("span", { className: "op-history-time-label", children: "END TIME" }), _jsx("span", { className: "op-history-time-value", children: fmt12(e.endTime) })] })] }), _jsx("div", { className: "op-history-divider" }), _jsxs("div", { className: "op-history-asset", children: [hasLogbook ? (_jsxs("button", { className: "op-history-asset-btn", onClick: () => setViewerFileId(e.id), children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), "Logbook Attached"] })) : (_jsxs("div", { className: "op-history-asset-text", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), "No Logbook Attached"] })), _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", className: "op-history-asset-chevron", children: _jsx("polyline", { points: "9 18 15 12 9 6" }) })] })] }, e.id));
                    }) })) }), viewerFileId && (() => {
                const entry = myTs.find(e => e.id === viewerFileId);
                const fileRecord = myFiles.find((f) => f.name.startsWith(`Logbook-${entry?.date}`));
                if (!fileRecord)
                    return null;
                return (_jsx(LogbookViewer, { isOpen: !!viewerFileId, onClose: () => setViewerFileId(null), fileDataUrl: fileRecord?.data || null, fileName: fileRecord?.name, onUpdate: handleUpdateLogbook }));
            })()] }));
}
//# sourceMappingURL=OpHistoryPage.js.map