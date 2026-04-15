import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { calcHours, fmtHours, todayISO } from '../../utils';
import { api } from '../../services/api';
import { LogbookViewer } from '../../components/ui/LogbookViewer';
function fmt12(t) {
    if (!t)
        return '—';
    const [hh, mm] = t.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
function fmtTimeSplit(t) {
    if (!t)
        return { time: '—', ampm: '' };
    const [hh, mm] = t.split(':').map(Number);
    const time = `${String(hh % 12 || 12).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const ampm = hh < 12 ? 'AM' : 'PM';
    return { time, ampm };
}
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12)
        return 'Morning';
    if (h < 17)
        return 'Afternoon';
    return 'Evening';
}
function timeAgo(isoOrTs) {
    const ms = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs).getTime();
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}
const NOTIF_READ_KEY = 'suprwise_notif_read_ts';
export function LoggerPage({ active }) {
    const { state, setState, showToast, user, setLastShiftSaved } = useApp();
    const { cranes, timesheets, files } = state;
    // Operator name for greeting
    const operators = state?.operators || [];
    const currentOp = operators.find((op) => op.phone === user || String(op.id) === user);
    const opFirstName = currentOp?.name ? currentOp.name.split(' ')[0] : null;
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [viewerFileId, setViewerFileId] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [openSwipeId, setOpenSwipeId] = useState(null);
    const [notifOpen, setNotifOpen] = useState(false);
    const [lastReadTs, setLastReadTs] = useState(() => Number(localStorage.getItem(NOTIF_READ_KEY) || 0));
    // Build notifications from state
    const notifications = (() => {
        const items = [];
        const uid = user || '';
        // Logbook entries (files)
        const myFileList = uid ? (files[uid] || []) : [];
        myFileList.slice(0, 3).forEach(f => {
            const date = f.name?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'recent';
            items.push({
                id: `file-${f.id}`,
                icon: '📋',
                color: '#EC7A2D',
                text: `Logbook uploaded for ${date}`,
                ts: f.timestamp ? new Date(f.timestamp).getTime() : Date.now() - 3600000,
            });
        });
        // Attendance updates
        const attendance = state?.attendance || [];
        const myAtt = attendance
            .filter((a) => a.operator_key === uid || a.operator_key === currentOp?.phone)
            .slice(0, 2);
        myAtt.forEach((a) => {
            items.push({
                id: `att-${a.id || a.date}`,
                icon: '✅',
                color: '#22c55e',
                text: `Attendance marked ${a.status} for ${a.date}`,
                ts: a.date ? new Date(a.date).getTime() : Date.now() - 7200000,
            });
        });
        // Advance salary updates
        const advMap = (state?.advancePayments || {});
        const myAdvances = Array.isArray(advMap[uid]) ? advMap[uid] : Array.isArray(advMap[currentOp?.phone || '']) ? advMap[currentOp?.phone || ''] : [];
        myAdvances.slice(0, 2).forEach(a => {
            items.push({
                id: `adv-${a.id}`,
                icon: '💰',
                color: '#f59e0b',
                text: `Advance of ₹${Number(a.amount).toLocaleString('en-IN')} recorded for ${a.date}`,
                ts: a.date ? new Date(a.date).getTime() : Date.now() - 86400000,
            });
        });
        // Sort newest first
        return items.sort((a, b) => b.ts - a.ts);
    })();
    const unreadCount = notifications.filter(n => n.ts > lastReadTs).length;
    function handleNotifOpen() {
        setNotifOpen(v => !v);
    }
    function handleMarkAllRead() {
        const now = Date.now();
        localStorage.setItem(NOTIF_READ_KEY, String(now));
        setLastReadTs(now);
    }
    const SWIPE_REVEAL = 76; // px — width of the delete zone
    const dragRef = useRef({ id: '', startX: 0, startY: 0, el: null, isHorizontal: null });
    function handleSwipeTouchStart(id, ev) {
        dragRef.current = {
            id,
            startX: ev.touches[0].clientX,
            startY: ev.touches[0].clientY,
            el: ev.currentTarget,
            isHorizontal: null,
        };
        ev.currentTarget.style.transition = 'none';
    }
    function handleSwipeTouchMove(id, ev) {
        const { startX, startY, el } = dragRef.current;
        if (!el || dragRef.current.id !== id)
            return;
        const dx = ev.touches[0].clientX - startX;
        const dy = ev.touches[0].clientY - startY;
        if (dragRef.current.isHorizontal === null) {
            if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
                dragRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);
            }
            return;
        }
        if (!dragRef.current.isHorizontal)
            return;
        const base = openSwipeId === id ? -SWIPE_REVEAL : 0;
        const offset = Math.min(0, Math.max(-(SWIPE_REVEAL + 16), base + dx));
        el.style.transform = `translateX(${offset}px)`;
    }
    function handleSwipeTouchEnd(id, ev) {
        const { startX, el, isHorizontal } = dragRef.current;
        if (!el || !isHorizontal)
            return;
        const dx = ev.changedTouches[0].clientX - startX;
        const base = openSwipeId === id ? -SWIPE_REVEAL : 0;
        const finalOffset = base + dx;
        el.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
        if (finalOffset < -(SWIPE_REVEAL * 0.35)) {
            el.style.transform = `translateX(-${SWIPE_REVEAL}px)`;
            setOpenSwipeId(id);
        }
        else {
            el.style.transform = 'translateX(0)';
            setOpenSwipeId(null);
        }
    }
    async function handleDeleteEntry(entryId) {
        const uid = user || '';
        setState(prev => ({
            ...prev,
            timesheets: {
                ...prev.timesheets,
                [uid]: (prev.timesheets[uid] || []).filter(t => t.id !== entryId),
            },
        }));
        setOpenSwipeId(null);
        showToast('Entry deleted');
        try {
            await api.deleteTimesheet(entryId);
        }
        catch {
            // entry already removed from local state; server may retry on next sync
        }
    }
    const fileInputRef = useRef(null);
    const assigned = cranes.find(c => c.operator === user);
    const myTs = user ? (timesheets[user] || []) : [];
    const myFiles = user ? (files[user] || []) : [];
    const h = calcHours(startTime, endTime) || 0;
    const handleCommit = async () => {
        if (!startTime || !endTime)
            return showToast('Set start and end times', 'error');
        if (!h || h <= 0)
            return showToast('Invalid time range', 'error');
        const entryId = String(Date.now());
        const dateISO = todayISO();
        const entry = {
            id: entryId,
            date: dateISO,
            startTime,
            endTime,
            hoursDecimal: h,
            operatorId: user || undefined,
        };
        setState(prev => {
            const uid = user || '';
            const existing = prev.timesheets[uid] || [];
            const newAttendance = [...prev.attendance];
            const existingAtt = newAttendance.findIndex(a => a.operator_key === uid && a.date === dateISO);
            const attRecord = {
                id: `auto-${Date.now()}`,
                operator_key: uid,
                date: dateISO,
                status: 'present',
                marked_by: 'operator'
            };
            if (existingAtt >= 0) {
                newAttendance[existingAtt] = { ...newAttendance[existingAtt], status: 'present' };
            }
            else {
                newAttendance.push(attRecord);
            }
            return {
                ...prev,
                timesheets: {
                    ...prev.timesheets,
                    [uid]: [entry, ...existing],
                },
                attendance: newAttendance,
            };
        });
        showToast(`Logged: ${fmt12(startTime)} → ${fmt12(endTime)} · ${fmtHours(h)}`);
        try {
            await api.createTimesheet({
                crane_reg: assigned?.reg || '',
                operator_key: user || '',
                date: dateISO,
                start_time: startTime,
                end_time: endTime,
                hours_decimal: h,
                operator_id: user || undefined,
            });
            // Explicitly mark attendance — belt-and-suspenders alongside the
            // backend's auto-upsert in POST /timesheets
            await api.markAttendance({
                operator_key: user || '',
                date: dateISO,
                status: 'present',
                marked_by: 'operator',
            });
            // Signal AttendancePage to bypass its 15-second cache and re-fetch
            setLastShiftSaved(Date.now());
        }
        catch {
            showToast('Failed to sync to server', 'error');
        }
    };
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize)
            return showToast('File too large (max 5 MB)', 'error');
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result;
            const dateISO = todayISO();
            const existingKey = `Logbook-${dateISO}`;
            const existing = myFiles.find((f) => f.name.startsWith(existingKey));
            if (existing) {
                try {
                    await api.deleteFile(existing.id);
                }
                catch { /* ignore */ }
            }
            const fileRecord = {
                id: existing ? existing.id : String(Date.now()),
                owner_key: user || '',
                name: `${existingKey}-${file.name}`,
                type: file.type,
                data: base64,
                size: String(file.size),
                timestamp: new Date().toISOString(),
            };
            setState(prev => {
                const uid = user || '';
                const existingFiles = (prev.files[uid] || []).filter((f) => f.id !== fileRecord.id);
                return { ...prev, files: { ...prev.files, [uid]: [fileRecord, ...existingFiles] } };
            });
            showToast(`Today's Logbook Uploaded`);
            try {
                await api.createFile(fileRecord);
            }
            catch {
                showToast('Failed to sync file to server', 'error');
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const shiftDate = (delta) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + delta);
            return next;
        });
    };
    const todayISO_ = todayISO();
    const todayEntries = myTs.filter(e => e.date === todayISO_);
    const dayIdx = selectedDate.getDay();
    const monthIdx = selectedDate.getMonth();
    const dayNum = selectedDate.getDate();
    const dateLabel = `${DAY_NAMES[dayIdx]}, ${MONTH_NAMES[monthIdx]} ${dayNum}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((today.getTime() - sel.getTime()) / 86400000);
    const isToday = dayDiff === 0;
    const dateSublabel = dayDiff === 0 ? 'TODAY' : dayDiff === 1 ? 'YESTERDAY' : dayDiff === 2 ? 'DAY BEFORE YESTERDAY' : '';
    const startSplit = fmtTimeSplit(startTime);
    const endSplit = fmtTimeSplit(endTime);
    return (_jsxs("div", { className: `page ${active ? 'active' : ''} logger-page-modern`, id: "page-logger", children: [notifOpen && (_jsx("div", { className: "notif-dismiss", onClick: () => setNotifOpen(false) })), _jsxs("div", { className: "logger-top-header", children: [_jsxs("div", { className: "logger-top-greeting", children: [_jsxs("span", { className: "logger-top-hello", children: ["Good ", getGreeting()] }), _jsx("span", { className: "logger-top-name", children: opFirstName || 'Operator' })] }), _jsxs("div", { className: "logger-notif-wrap", children: [_jsxs("button", { className: "logger-notif-btn", "aria-label": "Notifications", onClick: handleNotifOpen, children: [_jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }), _jsx("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })] }), unreadCount > 0 && _jsx("span", { className: "notif-dot" })] }), _jsxs("div", { className: `notif-panel${notifOpen ? ' open' : ''}`, children: [_jsxs("div", { className: "notif-panel-header", children: [_jsx("span", { className: "notif-panel-title", children: "NOTIFICATIONS" }), _jsx("button", { className: "notif-mark-read", onClick: handleMarkAllRead, children: "Mark all as read" })] }), _jsx("div", { className: "notif-list", children: notifications.length === 0 ? (_jsx("div", { className: "notif-empty", children: "No notifications yet" })) : (notifications.map(n => {
                                            const isUnread = n.ts > lastReadTs;
                                            return (_jsxs("div", { className: `notif-item${isUnread ? ' unread' : ''}`, children: [_jsx("div", { className: "notif-icon", style: { background: n.color + '22', color: n.color }, children: n.icon }), _jsxs("div", { className: "notif-content", children: [_jsx("div", { className: "notif-text", children: n.text }), _jsx("div", { className: "notif-time", children: timeAgo(n.ts) })] }), isUnread && _jsx("div", { className: "notif-unread-dot" })] }, n.id));
                                        })) }), _jsx("button", { className: "notif-view-all", onClick: () => setNotifOpen(false), children: "View All" })] })] })] }), _jsxs("div", { className: "logger-assignment-card", children: [_jsx("div", { className: "op-assign-label", children: "Current Assignment" }), _jsx("div", { className: `op-assign-reg${!assigned ? ' unassigned' : ''}`, children: assigned ? assigned.reg : 'Not Assigned' })] }), _jsxs("div", { className: "logger-date-nav", children: [_jsx("button", { className: "logger-date-arrow", onClick: () => shiftDate(-1), children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("polyline", { points: "15 18 9 12 15 6" }) }) }), _jsxs("div", { className: "logger-date-center", children: [_jsx("h1", { className: "logger-date-text", children: dateLabel }), _jsx("p", { className: "logger-date-sub", children: dateSublabel })] }), _jsx("button", { className: "logger-date-arrow", onClick: () => shiftDate(1), disabled: isToday, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }) })] }), _jsxs("div", { className: "logger-time-cards", children: [_jsxs("div", { className: "logger-time-card", onClick: () => document.getElementById('logger-start-time-input')?.click(), children: [_jsx("span", { className: "logger-time-card-label", children: "START TIME" }), _jsxs("div", { className: "logger-time-card-value", children: [_jsx("span", { className: "logger-time-card-time", children: startSplit.time }), _jsx("span", { className: "logger-time-card-ampm", children: startSplit.ampm })] })] }), _jsxs("div", { className: "logger-time-card", onClick: () => document.getElementById('logger-end-time-input')?.click(), children: [_jsx("span", { className: "logger-time-card-label", children: "END TIME" }), _jsxs("div", { className: "logger-time-card-value", children: [_jsx("span", { className: "logger-time-card-time", children: endSplit.time }), _jsx("span", { className: "logger-time-card-ampm", children: endSplit.ampm })] })] })] }), _jsxs("div", { style: { position: 'absolute', left: '-9999px', top: '-9999px' }, children: [_jsx("input", { id: "logger-start-time-input", type: "time", value: startTime, onChange: e => setStartTime(e.target.value) }), _jsx("input", { id: "logger-end-time-input", type: "time", value: endTime, onChange: e => setEndTime(e.target.value) })] }), _jsxs("div", { className: "logger-total-row", children: [_jsxs("div", { className: "logger-total-left", children: [_jsx("span", { className: "logger-total-label", children: "TOTAL LOGGED" }), _jsxs("div", { className: "logger-total-value", children: [_jsx("span", { className: "logger-total-hours", children: (h || 0).toFixed(1) }), _jsx("span", { className: "logger-total-unit", children: "HRS" })] })] }), _jsxs("div", { className: "logger-total-actions", children: [_jsxs("label", { className: "logger-upload-square", title: "Upload Today's Authorized Logbook", children: [_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "17 8 12 3 7 8" }), _jsx("line", { x1: "12", y1: "3", x2: "12", y2: "15" })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*,.pdf", style: { display: 'none' }, onChange: handleFileUpload })] }), _jsxs("button", { className: "logger-save-btn-rect", onClick: handleCommit, children: ["SAVE SHIFT", _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "9 18 15 12 9 6" }) })] })] })] }), _jsxs("div", { className: "logger-today-entries", children: [_jsx("div", { className: "logger-entries-header", children: _jsxs("h2", { children: ["TODAY'S ENTRIES ", _jsxs("span", { className: "logger-entries-count", children: ["(", todayEntries.length, ")"] })] }) }), todayEntries.length > 0 ? (_jsx("div", { className: "logger-entries-cards", children: todayEntries.map((e, idx) => {
                            const eh = Number(e.hoursDecimal) || 0;
                            const startS = fmtTimeSplit(e.startTime);
                            const endS = fmtTimeSplit(e.endTime);
                            const hasLogbook = myFiles.some((f) => f.name?.includes(e.date));
                            return (_jsxs("div", { className: "logger-entry-swipe-wrapper", children: [_jsx("button", { className: "logger-entry-delete-zone", onClick: () => handleDeleteEntry(e.id), "aria-label": "Delete entry", children: _jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), _jsx("path", { d: "M10 11v6M14 11v6" }), _jsx("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" })] }) }), _jsxs("div", { className: "logger-entry-card", onTouchStart: ev => handleSwipeTouchStart(e.id, ev), onTouchMove: ev => handleSwipeTouchMove(e.id, ev), onTouchEnd: ev => handleSwipeTouchEnd(e.id, ev), onClick: () => { if (openSwipeId === e.id) {
                                            setOpenSwipeId(null);
                                        } }, children: [idx > 0 && _jsx("div", { className: "logger-entry-divider" }), _jsxs("div", { className: "logger-entry-top-row", children: [_jsxs("div", { className: "logger-entry-start-block", children: [_jsx("span", { className: "logger-entry-label", children: "START" }), _jsxs("div", { className: "logger-entry-time-group", children: [_jsx("span", { className: "logger-entry-time-val", children: startS.time }), _jsx("span", { className: "logger-entry-time-ampm", children: startS.ampm })] })] }), _jsxs("div", { className: "logger-entry-center", children: [_jsxs("div", { className: "logger-entry-hours", children: [eh.toFixed(1), " HRS"] }), _jsxs("div", { className: "logger-entry-progress", children: [_jsx("div", { className: "logger-entry-progress-line" }), _jsx("div", { className: "logger-entry-progress-dot" }), _jsx("div", { className: "logger-entry-progress-line" })] })] }), _jsxs("div", { className: "logger-entry-end-block", children: [_jsx("span", { className: "logger-entry-label", children: "END" }), _jsxs("div", { className: "logger-entry-time-group", children: [_jsx("span", { className: "logger-entry-time-val", children: endS.time }), _jsx("span", { className: "logger-entry-time-ampm", children: endS.ampm })] })] })] }), _jsx("div", { className: "logger-entry-bottom-row", children: hasLogbook ? (_jsxs("button", { className: "logger-entry-logbook-pill", onClick: () => {
                                                        const matchedFile = myFiles.find((f) => f.name?.includes(e.date));
                                                        if (matchedFile)
                                                            setViewerFileId(matchedFile.id);
                                                    }, children: [_jsx("div", { className: "logger-pill-icon logger-pill-icon-doc", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "#EC7A2D", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), _jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" })] }) }), _jsx("span", { className: "logger-pill-text", children: "Logbook Attached" }), _jsx("span", { className: "logger-pill-sep", children: "\u2022" }), _jsx("span", { className: "logger-pill-action", children: "View" })] })) : (_jsxs("label", { className: "logger-entry-logbook-pill", htmlFor: `upload-${e.id}`, children: [_jsx("div", { className: "logger-pill-icon logger-pill-icon-plus", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "#EC7A2D", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }) }), _jsx("span", { className: "logger-pill-text", children: "No Attachment" }), _jsx("span", { className: "logger-pill-sep", children: "\u2022" }), _jsx("span", { className: "logger-pill-action", children: "Upload" }), _jsx("input", { id: `upload-${e.id}`, type: "file", accept: "image/*,.pdf", style: { display: 'none' }, onChange: handleFileUpload })] })) })] })] }, e.id));
                        }) })) : (_jsx("div", { className: "logger-entries-empty", children: _jsx("p", { children: "No entries logged yet today." }) }))] }), viewerFileId && (() => {
                const fileRecord = myFiles.find((f) => f.id === viewerFileId);
                return (_jsx(LogbookViewer, { isOpen: !!viewerFileId, onClose: () => setViewerFileId(null), fileDataUrl: fileRecord?.data || null, fileName: fileRecord?.name, onUpdate: e => {
                        const maxSize = 5 * 1024 * 1024;
                        if (e.size > maxSize)
                            return showToast('File too large (max 5 MB)', 'error');
                        const reader = new FileReader();
                        reader.onload = async () => {
                            try {
                                await api.deleteFile(viewerFileId);
                                const fileRecordObj = {
                                    id: viewerFileId,
                                    owner_key: user || '',
                                    name: fileRecord.name,
                                    type: e.type,
                                    data: reader.result,
                                    size: String(e.size),
                                    timestamp: new Date().toISOString(),
                                };
                                await api.createFile(fileRecordObj);
                                setState(prev => {
                                    const uid = user || '';
                                    const existingFiles = (prev.files[uid] || []).filter((f) => f.id !== viewerFileId);
                                    return { ...prev, files: { ...prev.files, [uid]: [fileRecordObj, ...existingFiles] } };
                                });
                                showToast('Logbook updated');
                            }
                            catch { }
                        };
                        reader.readAsDataURL(e);
                    } }));
            })()] }));
}
//# sourceMappingURL=LoggerPage.js.map