import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import { BottomNav } from './components/layout/BottomNav';
import { ToastContainer } from './components/ui/Toast';
import { AuthPage } from './components/auth/AuthPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { LoggerPage } from './pages/Logger/LoggerPage';
import { OpHistoryPage } from './pages/OpHistory/OpHistoryPage';
import { SettingsModal } from './pages/Settings/SettingsPage';
import { ErrorBoundary } from './ErrorBoundary';
import { api, clearToken, getToken } from './services/api';
import { toISO } from './utils';
export default function App() {
    const { activePage, setActivePage, user, setUser, setUserRole, setState, clearUserData, showToast, } = useApp();
    const [loading, setLoading] = useState(false);
    function loadDataFromAPI() {
        setLoading(true);
        // Reset to empty state first — never show stale data
        setState(() => ({
            cranes: [], operators: [], operatorProfiles: {},
            ownerProfile: { name: '', roleTitle: '', phone: '', email: '', company: '', city: '', state: '', gst: '', website: '', defaultLimit: '8' },
            fuelLogs: {}, cameras: [], integrations: { fuel: {}, cameras: {} },
            advancePayments: {}, diagnostics: {}, clients: [],
            invoices: [], payments: [], creditNotes: [],
            quotations: [], proformas: [], challans: [],
            files: {}, timesheets: {}, compliance: {},
            attendance: [], maintenance: {}, notifications: [], opNotifications: {},
        }));
        api.exportAll()
            .then((data) => {
            const raw = data;
            const cranes = (raw.cranes || []).map(c => ({
                id: c.id, reg: c.reg, type: c.type, make: c.make, model: c.model,
                capacity: c.capacity, year: c.year, rate: c.rate,
                otRate: c.ot_rate ?? c.otRate, dailyLimit: c.daily_limit ?? c.dailyLimit,
                operator: c.operator, site: c.site, status: c.status, notes: c.notes,
            }));
            const tsRaw = raw.timesheets;
            let timesheets = {};
            if (Array.isArray(tsRaw)) {
                tsRaw.forEach((t) => {
                    const key = (t.operator_key || t.operatorKey || '');
                    if (!timesheets[key])
                        timesheets[key] = [];
                    timesheets[key].push({
                        id: t.id,
                        date: toISO((t.date || '')),
                        startTime: (t.start_time ?? t.startTime),
                        endTime: (t.end_time ?? t.endTime),
                        hoursDecimal: (t.hours_decimal ?? t.hoursDecimal),
                        operatorId: (t.operator_id ?? t.operatorId),
                        notes: t.notes,
                    });
                });
            }
            else if (tsRaw && typeof tsRaw === 'object') {
                for (const [key, entries] of Object.entries(tsRaw)) {
                    timesheets[key] = (entries || []).map(t => ({
                        id: t.id,
                        date: toISO((t.date || '')),
                        startTime: (t.start_time ?? t.startTime),
                        endTime: (t.end_time ?? t.endTime),
                        hoursDecimal: (t.hours_decimal ?? t.hoursDecimal),
                        operatorId: (t.operator_id ?? t.operatorId),
                        notes: t.notes,
                    }));
                }
            }
            setState(prev => ({
                ...prev,
                cranes: cranes,
                operators: (raw.operators || prev.operators),
                timesheets: timesheets,
                files: (raw.files || prev.files),
                attendance: (raw.attendance || prev.attendance),
                advancePayments: (raw.advancePayments || prev.advancePayments),
                operatorProfiles: (raw.operatorProfiles || prev.operatorProfiles),
            }));
        })
            .catch(() => {
            showToast('Could not reach server. Check your connection.', 'error');
        })
            .finally(() => {
            setLoading(false);
        });
    }
    // On mount: if a token exists, restore the session via /auth/me
    useEffect(() => {
        const token = getToken();
        if (!token)
            return;
        api.me()
            .then(me => {
            setUser(me.phone);
            setUserRole(me.role);
            setActivePage('logger');
            loadDataFromAPI();
        })
            .catch(() => {
            clearToken();
            setUser(null);
            setUserRole(null);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    function handleSignOut() {
        clearUserData();
    }
    if (!user) {
        return _jsx(AuthPage, { loadDataFromAPI: loadDataFromAPI });
    }
    // ── Authenticated (Operator only) ──
    return (_jsxs("div", { id: "app-shell", className: `visible operator-mode`, children: [loading && (_jsx("div", { style: {
                    position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
                    background: 'var(--accent)', zIndex: 9999,
                    animation: 'loadingBar 1.5s ease-in-out infinite',
                } })), _jsx("div", { className: "body-split", children: _jsxs("div", { className: "page-content", children: [_jsx(ErrorBoundary, { children: _jsx(LoggerPage, { active: activePage === 'logger' }) }), _jsx(ErrorBoundary, { children: _jsx(OpHistoryPage, { active: activePage === 'op-history' }) }), _jsx(ErrorBoundary, { children: _jsx(AttendancePage, { active: activePage === 'attendance' }) })] }) }), _jsx(BottomNav, { onSignOut: handleSignOut }), _jsx(SettingsModal, {}), _jsx(ToastContainer, {})] }));
}
//# sourceMappingURL=App.js.map