import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
export function BottomNav({ onSignOut }) {
    const { activePage, setActivePage, toggleTheme, setSettingsOpen, user, userRole, state } = useApp();
    const [menuOpen, setMenuOpen] = useState(false);
    // Get operator details
    const operators = state?.operators || [];
    const currentOperator = userRole === 'operator'
        ? operators.find(op => op.phone === user || String(op.id) === user)
        : null;
    const opName = currentOperator?.name || '';
    const opPhone = currentOperator?.phone || user || '';
    // Initials: prefer name words, fall back to last 2 digits of phone
    const initials = opName
        ? opName.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
        : (user || '').replace(/\D/g, '').slice(-2) || 'OP';
    // Calculate attendance stats
    const attendance = state?.attendance || [];
    const operatorKeys = currentOperator ? [currentOperator.phone, String(currentOperator.id)].filter(Boolean) : [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let presentCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const att = attendance.find(a => operatorKeys.includes(a.operator_key) && a.date === iso && a.status === 'present');
        if (att)
            presentCount++;
    }
    const tabs = [
        {
            page: 'logger', label: 'Log Time', icon: (_jsxs("svg", { viewBox: "0 0 24 24", width: "26", height: "26", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", fill: "none", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }))
        },
        {
            page: 'op-history', label: 'History', icon: (_jsxs("svg", { viewBox: "0 0 24 24", width: "26", height: "26", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", fill: "none", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }))
        },
        {
            page: 'attendance', label: 'Attendance', icon: (_jsxs("svg", { viewBox: "0 0 24 24", width: "26", height: "26", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", fill: "none", children: [_jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("polyline", { points: "17 11 19 13 23 9" })] }))
        },
    ];
    function handleDocuments() {
        setMenuOpen(false);
        setSettingsOpen(true);
    }
    function handleLogout() {
        setMenuOpen(false);
        onSignOut();
    }
    return (_jsxs(_Fragment, { children: [menuOpen && (_jsx("div", { className: "bnp-dismiss", onClick: () => setMenuOpen(false) })), _jsxs("div", { className: `bnp-float${menuOpen ? ' open' : ''}`, children: [_jsxs("div", { className: "bnp-float-user", children: [_jsx("div", { className: "bnp-float-avatar", children: initials }), _jsxs("div", { className: "bnp-float-userinfo", children: [_jsx("div", { className: "bnp-float-name", children: opName || opPhone }), opName && _jsx("div", { className: "bnp-float-phone", children: opPhone })] })] }), _jsx("div", { className: "bnp-float-sep" }), _jsxs("button", { className: "bnp-float-item", onClick: handleDocuments, children: [_jsx("div", { className: "bnp-float-icon bnp-fi-accent", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })] }) }), _jsx("span", { className: "bnp-float-label", children: "Account settings" })] }), _jsx("div", { className: "bnp-float-sep" }), _jsxs("button", { className: "bnp-float-item", onClick: toggleTheme, children: [_jsx("div", { className: "bnp-float-icon bnp-fi-accent", children: _jsx("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }) }) }), _jsx("span", { className: "bnp-float-label", children: "Dark mode" })] }), _jsx("div", { className: "bnp-float-sep" }), _jsxs("button", { className: "bnp-float-item bnp-float-logout", onClick: handleLogout, children: [_jsx("div", { className: "bnp-float-icon bnp-fi-red", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", fill: "none", children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("polyline", { points: "16 17 21 12 16 7" }), _jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })] }) }), _jsx("span", { className: "bnp-float-label", children: "Log out" })] })] }), _jsx("div", { id: "bottom-nav-spacer" }), _jsx("nav", { id: "bottom-nav", children: _jsxs("div", { className: "bottom-nav-inner", children: [tabs.map((tab) => {
                            const isActive = activePage === tab.page;
                            return (_jsxs("button", { className: `bottom-nav-tab${isActive ? ' active' : ''}`, onClick: () => setActivePage(tab.page), "aria-label": tab.label, children: [_jsx("span", { className: "bottom-nav-icon", children: tab.icon }), _jsx("span", { className: "bottom-nav-label", children: tab.label }), isActive && _jsx("span", { className: "bottom-nav-indicator" })] }, tab.page));
                        }), _jsxs("button", { className: `bottom-nav-tab bottom-nav-tab-profile${menuOpen ? ' active' : ''}`, onClick: () => setMenuOpen(!menuOpen), "aria-label": "Profile", children: [_jsxs("span", { className: "bottom-nav-icon bottom-nav-profile-icon", children: [_jsx("img", { className: "profile-nav-icon-img", src: "/worker.png", alt: "Profile", width: "26", height: "26" }), presentCount > 0 && (_jsx("span", { className: "bottom-nav-profile-count", children: presentCount }))] }), _jsx("span", { className: "bottom-nav-label", children: "Profile" }), menuOpen && _jsx("span", { className: "bottom-nav-indicator" })] })] }) })] }));
}
//# sourceMappingURL=BottomNav.js.map