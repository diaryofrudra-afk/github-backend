import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { todayISO, toISO } from '../../utils';
import { api } from '../../services/api';
function getMonthOptions() {
    const now = new Date();
    const opts = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        opts.push({ value, label });
    }
    return opts;
}
export function AttendancePage({ active }) {
    const { state, setState, user, lastShiftSaved } = useApp();
    const monthOptions = useMemo(() => getMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
    const lastFetch = useRef(0);
    const operators = state?.operators || [];
    const timesheets = state?.timesheets || {};
    const attendance = state?.attendance || [];
    useEffect(() => {
        if (!active)
            return;
        const forceRefresh = lastShiftSaved > lastFetch.current;
        if (!forceRefresh && Date.now() - lastFetch.current < 15000)
            return;
        lastFetch.current = Date.now();
        Promise.all([
            api.exportAll().catch(() => null),
            api.getAttendance().catch(() => [])
        ])
            .then(([rawAll, attRaw]) => {
            if (!rawAll && (!attRaw || !attRaw.length))
                return;
            const newState = {};
            if (rawAll) {
                const data = rawAll;
                const tsRaw = data.timesheets;
                const mappedTimesheets = {};
                if (tsRaw && typeof tsRaw === 'object') {
                    for (const [key, entries] of Object.entries(tsRaw)) {
                        if (Array.isArray(entries)) {
                            mappedTimesheets[key] = entries.map((t) => ({
                                id: String(t?.id || ''),
                                date: toISO(String(t?.date || '')),
                                startTime: String(t?.start_time ?? t?.startTime ?? ''),
                                endTime: String(t?.end_time ?? t?.endTime ?? ''),
                                hoursDecimal: Number(t?.hours_decimal ?? t?.hoursDecimal ?? 0),
                                operatorId: t?.operator_id ?? t?.operatorId,
                                notes: String(t?.notes ?? ''),
                            }));
                        }
                    }
                    newState.timesheets = mappedTimesheets;
                }
                if (data.operators)
                    newState.operators = data.operators;
                if (data.operatorProfiles)
                    newState.operatorProfiles = data.operatorProfiles;
                if (data.advancePayments)
                    newState.advancePayments = data.advancePayments;
            }
            if (Array.isArray(attRaw)) {
                newState.attendance = attRaw.map(a => ({
                    id: String(a?.id || ''),
                    operator_key: String(a?.operator_key || ''),
                    date: toISO(String(a?.date || '')) || String(a?.date || ''),
                    status: String(a?.status || ''),
                    marked_by: String(a?.marked_by || ''),
                }));
            }
            setState(prev => ({ ...prev, ...newState }));
        })
            .catch((err) => {
            console.error('[Attendance] Sync error:', err);
        });
    }, [active, setState, lastShiftSaved]);
    // Find the operator record matching the logged-in user (falls back to null)
    const myOperator = useMemo(() => operators.find(op => op && (op.phone === user || String(op.id) === user)) || null, [operators, user]);
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const firstDay = new Date(yr, mo - 1, 1).getDay();
    const today = todayISO();
    function renderOperatorView() {
        const operator = myOperator;
        // Fall back to the logged-in user's phone when no operator record exists
        const phone = operator?.phone || user || '';
        const operatorKeys = operator
            ? [operator.phone, String(operator.id)].filter(Boolean)
            : [user || ''].filter(Boolean);
        // Salary & advances
        const operatorProfiles = state?.operatorProfiles || {};
        const profile = (operatorProfiles[phone] || operatorProfiles[String(operator?.id || '')] || {});
        const salary = Number(profile?.salary) || 0;
        const workDays = Number(profile?.workingDays) || 26;
        const advancePaymentsMap = state?.advancePayments || {};
        const opKey = phone || (operator ? String(operator.id) : '');
        const opAdvances = (advancePaymentsMap[opKey] || []);
        const currentMonthStr = `${yr}-${String(mo).padStart(2, '0')}`;
        const monthlyAdvances = Array.isArray(opAdvances) ? opAdvances.filter(a => a?.date?.startsWith(currentMonthStr)) : [];
        const totalAdvances = monthlyAdvances.reduce((s, a) => s + (Number(a?.amount) || 0), 0);
        const dayHoursMap = {};
        operatorKeys.forEach(key => {
            const entries = timesheets[key] || [];
            entries.forEach(e => {
                const iso = toISO(e?.date || '');
                if (iso)
                    dayHoursMap[iso] = (dayHoursMap[iso] || 0) + (Number(e?.hoursDecimal) || 0);
            });
        });
        const att = {};
        for (const [iso, hrs] of Object.entries(dayHoursMap)) {
            if (hrs > 0)
                att[iso] = { present: true, source: 'timesheet' };
        }
        attendance.filter(a => operatorKeys.includes(a?.operator_key)).forEach(a => {
            if (a?.status === 'present')
                att[a.date] = { present: true, source: 'manual' };
            else if (a?.status === 'absent')
                att[a.date] = { present: false, source: 'manual' };
        });
        let presentCount = 0;
        let absentCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (iso > today)
                break;
            if (att[iso]?.present)
                presentCount++;
            else
                absentCount++;
        }
        const perDay = workDays > 0 ? salary / workDays : 0;
        const earnedGross = Math.round(perDay * presentCount);
        const monthShort = new Date(yr, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
        const dayLabelsFull = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        // Calculate first day offset (Monday-based: Mon=0, ..., Sun=6)
        const firstDayMon = (firstDay + 6) % 7;
        const calCells = [];
        for (let b = 0; b < firstDayMon; b++)
            calCells.push(_jsx("div", { className: "op-att-cal-blank" }, `blank-${b}`));
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isPresent = att[iso]?.present;
            const isFuture = iso > today;
            const isToday = iso === today;
            let cellClass = 'op-att-cal-day';
            if (isFuture)
                cellClass += ' op-att-cal-future';
            else if (isPresent)
                cellClass += ' op-att-cal-present';
            else if (isToday)
                cellClass += ' op-att-cal-today';
            calCells.push(_jsxs("div", { className: cellClass, children: [_jsx("span", { className: "op-att-cal-num", children: d }), isPresent && _jsx("span", { className: "op-att-cal-dot" })] }, iso));
        }
        function shiftMonth(delta) {
            const d = new Date(yr, mo - 1 + delta, 1);
            setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return (_jsxs("div", { className: "op-attendance-modern", children: [_jsxs("div", { className: "op-att-page-header", children: [_jsx("div", { children: _jsx("div", { className: "op-att-page-label", children: "Your Attendance" }) }), _jsxs("div", { className: "op-att-header-chips", children: [_jsxs("div", { className: "op-att-present-chip", children: [_jsx("span", { className: "op-att-present-num", children: presentCount }), _jsx("span", { className: "op-att-present-lbl", children: "days present" })] }), _jsxs("div", { className: "op-att-present-chip op-att-absent-chip", children: [_jsx("span", { className: "op-att-present-num", children: absentCount }), _jsx("span", { className: "op-att-present-lbl", children: "days absent" })] })] })] }), _jsxs("div", { className: "op-att-calendar-card", children: [_jsxs("div", { className: "op-att-calendar-header", children: [_jsxs("div", { children: [_jsx("div", { className: "op-att-calendar-month", children: monthShort }), _jsx("div", { className: "op-att-calendar-year", children: yr })] }), _jsxs("div", { className: "op-att-calendar-nav", children: [_jsx("button", { onClick: () => shiftMonth(-1), children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "15 18 9 12 15 6" }) }) }), _jsx("button", { onClick: () => shiftMonth(1), children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }) })] })] }), _jsx("div", { className: "op-att-day-headers", children: dayLabelsFull.map(l => (_jsx("div", { className: `op-att-day-header${l === 'Sun' ? ' op-att-day-header-sun' : ''}`, children: l }, l))) }), _jsx("div", { className: "op-att-cal-grid", children: calCells })] }), _jsxs("div", { className: "op-salary-tracker", children: [_jsxs("div", { className: "op-salary-tracker-header", children: [_jsxs("div", { className: "op-salary-tracker-title", children: [_jsx("span", { className: "op-salary-tracker-bar" }), "Salary Tracker"] }), _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: 'var(--t4)' }, children: [_jsx("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }), _jsx("line", { x1: "2", y1: "10", x2: "22", y2: "10" })] })] }), (() => {
                            const displaySalary = salary > 0 ? salary : 25000;
                            const displayWorkDays = workDays > 0 ? workDays : 26;
                            const displayPerDay = displaySalary / displayWorkDays;
                            const displayEarned = salary > 0 ? earnedGross : Math.round(displayPerDay * Math.max(presentCount, 18));
                            const displayAdvance = salary > 0 ? totalAdvances : 1200;
                            const displayBalance = displayEarned - displayAdvance;
                            const isDemo = salary === 0;
                            return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "op-salary-row", children: [_jsxs("span", { className: "op-salary-row-label", children: ["TOTAL SALARY EARNED", isDemo ? ' (DEMO)' : ''] }), _jsxs("span", { className: "op-salary-row-value op-salary-row-earned", children: [_jsx("span", { className: "op-salary-sign", children: "+" }), "\u20B9", displayEarned.toLocaleString('en-IN')] })] }), _jsxs("div", { className: "op-salary-row", children: [_jsxs("span", { className: "op-salary-row-label", children: ["ADVANCE RECEIVED", isDemo ? ' (DEMO)' : ''] }), _jsxs("span", { className: "op-salary-row-value op-salary-row-advance", children: [_jsx("span", { className: "op-salary-sign", children: "\u2212" }), "\u20B9", displayAdvance.toLocaleString('en-IN')] })] }), _jsx("div", { className: "op-salary-divider" }), _jsxs("div", { className: "op-salary-balance-row", children: [_jsx("span", { className: "op-salary-balance-label", children: "TOTAL BALANCE" }), _jsxs("span", { className: `op-salary-balance-value${displayBalance < 0 ? ' negative' : ''}`, children: ["\u20B9", Math.abs(displayBalance).toLocaleString('en-IN')] })] }), _jsxs("div", { className: "op-salary-footer", children: [_jsxs("span", { className: "op-salary-footer-month", children: [monthShort.toUpperCase(), " ", yr] }), _jsxs("span", { className: "op-salary-footer-verified", children: [_jsx("span", { className: "op-salary-verified-dot" }), isDemo ? 'DEMO DATA' : 'VERIFIED'] })] })] }));
                        })()] })] }));
    }
    return (_jsx("div", { className: `page ${active ? 'active' : ''}`, id: "page-attendance", children: renderOperatorView() }));
}
//# sourceMappingURL=AttendancePage.js.map