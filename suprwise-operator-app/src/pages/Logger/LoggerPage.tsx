import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { calcHours, fmtHours, todayISO } from '../../utils';
import { api } from '../../services/api';
import type { TimesheetEntry } from '../../types';
import { LogbookViewer } from '../../components/ui/LogbookViewer';

function fmt12(t: string): string {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

function fmtTimeSplit(t: string): { time: string; ampm: string } {
  if (!t) return { time: '—', ampm: '' };
  const [hh, mm] = t.split(':').map(Number);
  const time = `${String(hh % 12 || 12).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const ampm = hh < 12 ? 'AM' : 'PM';
  return { time, ampm };
}

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function timeAgo(isoOrTs: string | number): string {
  const ms = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const NOTIF_READ_KEY = 'suprwise_notif_read_ts';

export function LoggerPage({ active }: { active: boolean }) {
  const { state, setState, showToast, user, setLastShiftSaved } = useApp();
  const { cranes, timesheets, files } = state;

  // Operator name for greeting
  const operators = state?.operators || [];
  const currentOp = operators.find((op: any) => op.phone === user || String(op.id) === user);
  const opFirstName = currentOp?.name ? currentOp.name.split(' ')[0] : null;

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastReadTs, setLastReadTs] = useState<number>(
    () => Number(localStorage.getItem(NOTIF_READ_KEY) || 0)
  );

  // Build notifications from state
  const notifications = (() => {
    const items: { id: string; icon: string; color: string; text: string; ts: number }[] = [];
    const uid = user || '';

    // Logbook entries (files)
    const myFileList: any[] = uid ? (files[uid] || []) : [];
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
      .filter((a: any) => a.operator_key === uid || a.operator_key === currentOp?.phone)
      .slice(0, 2);
    myAtt.forEach((a: any) => {
      items.push({
        id: `att-${a.id || a.date}`,
        icon: '✅',
        color: '#22c55e',
        text: `Attendance marked ${a.status} for ${a.date}`,
        ts: a.date ? new Date(a.date).getTime() : Date.now() - 7200000,
      });
    });

    // Advance salary updates
    const advMap = (state?.advancePayments || {}) as Record<string, any[]>;
    const myAdvances: any[] = Array.isArray(advMap[uid]) ? (advMap[uid] as any[]) : Array.isArray(advMap[currentOp?.phone || '']) ? (advMap[currentOp?.phone || ''] as any[]) : [];
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
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    el: HTMLElement | null;
    isHorizontal: boolean | null;
  }>({ id: '', startX: 0, startY: 0, el: null, isHorizontal: null });

  function handleSwipeTouchStart(id: string, ev: React.TouchEvent<HTMLDivElement>) {
    dragRef.current = {
      id,
      startX: ev.touches[0].clientX,
      startY: ev.touches[0].clientY,
      el: ev.currentTarget,
      isHorizontal: null,
    };
    ev.currentTarget.style.transition = 'none';
  }

  function handleSwipeTouchMove(id: string, ev: React.TouchEvent<HTMLDivElement>) {
    const { startX, startY, el } = dragRef.current;
    if (!el || dragRef.current.id !== id) return;
    const dx = ev.touches[0].clientX - startX;
    const dy = ev.touches[0].clientY - startY;

    if (dragRef.current.isHorizontal === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        dragRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!dragRef.current.isHorizontal) return;

    const base = openSwipeId === id ? -SWIPE_REVEAL : 0;
    const offset = Math.min(0, Math.max(-(SWIPE_REVEAL + 16), base + dx));
    el.style.transform = `translateX(${offset}px)`;
  }

  function handleSwipeTouchEnd(id: string, ev: React.TouchEvent<HTMLDivElement>) {
    const { startX, el, isHorizontal } = dragRef.current;
    if (!el || !isHorizontal) return;
    const dx = ev.changedTouches[0].clientX - startX;
    const base = openSwipeId === id ? -SWIPE_REVEAL : 0;
    const finalOffset = base + dx;

    el.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
    if (finalOffset < -(SWIPE_REVEAL * 0.35)) {
      el.style.transform = `translateX(-${SWIPE_REVEAL}px)`;
      setOpenSwipeId(id);
    } else {
      el.style.transform = 'translateX(0)';
      setOpenSwipeId(null);
    }
  }

  async function handleDeleteEntry(entryId: string) {
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
    } catch {
      // entry already removed from local state; server may retry on next sync
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const assigned = cranes.find(c => c.operator === user);
  const myTs: TimesheetEntry[] = user ? (timesheets[user] || []) : [];
  const myFiles: unknown[] = user ? (files[user] || []) : [];

  const h = calcHours(startTime, endTime) || 0;

  const handleCommit = async () => {
    if (!startTime || !endTime) return showToast('Set start and end times', 'error');
    if (!h || h <= 0) return showToast('Invalid time range', 'error');
    const entryId = String(Date.now());
    const dateISO = todayISO();

    const entry: TimesheetEntry = {
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
      } else {
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
    } catch {
      showToast('Failed to sync to server', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) return showToast('File too large (max 5 MB)', 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const dateISO = todayISO();

      const existingKey = `Logbook-${dateISO}`;
      const existing = myFiles.find((f: any) => f.name.startsWith(existingKey)) as any;
      if (existing) {
        try { await api.deleteFile(existing.id); } catch { /* ignore */ }
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
        const existingFiles = (prev.files[uid] || []).filter((f: any) => f.id !== fileRecord.id);
        return { ...prev, files: { ...prev.files, [uid]: [fileRecord, ...existingFiles] } };
      });
      showToast(`Today's Logbook Uploaded`);
      try {
        await api.createFile(fileRecord);
      } catch {
        showToast('Failed to sync file to server', 'error');
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const shiftDate = (delta: number) => {
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
  const today = new Date(); today.setHours(0,0,0,0);
  const sel = new Date(selectedDate); sel.setHours(0,0,0,0);
  const dayDiff = Math.round((today.getTime() - sel.getTime()) / 86400000);
  const isToday = dayDiff === 0;
  const dateSublabel = dayDiff === 0 ? 'TODAY' : dayDiff === 1 ? 'YESTERDAY' : dayDiff === 2 ? 'DAY BEFORE YESTERDAY' : '';

  const startSplit = fmtTimeSplit(startTime);
  const endSplit = fmtTimeSplit(endTime);

  return (
    <div className={`page ${active ? 'active' : ''} logger-page-modern`} id="page-logger">
      {/* Dismiss layer for notification panel */}
      {notifOpen && (
        <div className="notif-dismiss" onClick={() => setNotifOpen(false)} />
      )}

      {/* Top Header */}
      <div className="logger-top-header">
        <div className="logger-top-greeting">
          <span className="logger-top-hello">Good {getGreeting()}</span>
          <span className="logger-top-name">{opFirstName || 'Operator'}</span>
        </div>
        <div className="logger-notif-wrap">
          <button className="logger-notif-btn" aria-label="Notifications" onClick={handleNotifOpen}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>

          {/* Notification panel */}
          <div className={`notif-panel${notifOpen ? ' open' : ''}`}>
            <div className="notif-panel-header">
              <span className="notif-panel-title">NOTIFICATIONS</span>
              <button className="notif-mark-read" onClick={handleMarkAllRead}>Mark all as read</button>
            </div>

            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">No notifications yet</div>
              ) : (
                notifications.map(n => {
                  const isUnread = n.ts > lastReadTs;
                  return (
                    <div key={n.id} className={`notif-item${isUnread ? ' unread' : ''}`}>
                      <div className="notif-icon" style={{ background: n.color + '22', color: n.color }}>
                        {n.icon}
                      </div>
                      <div className="notif-content">
                        <div className="notif-text">{n.text}</div>
                        <div className="notif-time">{timeAgo(n.ts)}</div>
                      </div>
                      {isUnread && <div className="notif-unread-dot" />}
                    </div>
                  );
                })
              )}
            </div>

            <button className="notif-view-all" onClick={() => setNotifOpen(false)}>
              View All
            </button>
          </div>
        </div>
      </div>

      {/* Current Assignment Card */}
      <div className="logger-assignment-card">
        <div className="op-assign-label">Current Assignment</div>
        <div className={`op-assign-reg${!assigned ? ' unassigned' : ''}`}>
          {assigned ? assigned.reg : 'Not Assigned'}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="logger-date-nav">
        <button className="logger-date-arrow" onClick={() => shiftDate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="logger-date-center">
          <h1 className="logger-date-text">{dateLabel}</h1>
          <p className="logger-date-sub">{dateSublabel}</p>
        </div>
        <button className="logger-date-arrow" onClick={() => shiftDate(1)} disabled={isToday}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Time Input Cards */}
      <div className="logger-time-cards">
        {/* Start Time */}
        <div className="logger-time-card" onClick={() => document.getElementById('logger-start-time-input')?.click()}>
          <span className="logger-time-card-label">START TIME</span>
          <div className="logger-time-card-value">
            <span className="logger-time-card-time">{startSplit.time}</span>
            <span className="logger-time-card-ampm">{startSplit.ampm}</span>
          </div>
        </div>
        {/* End Time */}
        <div className="logger-time-card" onClick={() => document.getElementById('logger-end-time-input')?.click()}>
          <span className="logger-time-card-label">END TIME</span>
          <div className="logger-time-card-value">
            <span className="logger-time-card-time">{endSplit.time}</span>
            <span className="logger-time-card-ampm">{endSplit.ampm}</span>
          </div>
        </div>
      </div>

      {/* Hidden time inputs for actual picking */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <input id="logger-start-time-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <input id="logger-end-time-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
      </div>

      {/* Total Logged + Actions */}
      <div className="logger-total-row">
        <div className="logger-total-left">
          <span className="logger-total-label">TOTAL LOGGED</span>
          <div className="logger-total-value">
            <span className="logger-total-hours">{(h || 0).toFixed(1)}</span>
            <span className="logger-total-unit">HRS</span>
          </div>
        </div>
        <div className="logger-total-actions">
          <label className="logger-upload-square" title="Upload Today's Authorized Logbook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          <button className="logger-save-btn-rect" onClick={handleCommit}>
            SAVE SHIFT
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Today's Entries */}
      <div className="logger-today-entries">
        <div className="logger-entries-header">
          <h2>TODAY'S ENTRIES <span className="logger-entries-count">({todayEntries.length})</span></h2>
        </div>
        {todayEntries.length > 0 ? (
          <div className="logger-entries-cards">
            {todayEntries.map((e, idx) => {
              const eh = Number(e.hoursDecimal) || 0;
              const startS = fmtTimeSplit(e.startTime);
              const endS = fmtTimeSplit(e.endTime);
              const hasLogbook = myFiles.some((f: any) => f.name?.includes(e.date));
              return (
                <div key={e.id} className="logger-entry-swipe-wrapper">
                  {/* Delete zone revealed on swipe-left */}
                  <button
                    className="logger-entry-delete-zone"
                    onClick={() => handleDeleteEntry(e.id)}
                    aria-label="Delete entry"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>

                  {/* Swipeable card surface */}
                  <div
                    className="logger-entry-card"
                    onTouchStart={ev => handleSwipeTouchStart(e.id, ev)}
                    onTouchMove={ev => handleSwipeTouchMove(e.id, ev)}
                    onTouchEnd={ev => handleSwipeTouchEnd(e.id, ev)}
                    onClick={() => { if (openSwipeId === e.id) { setOpenSwipeId(null); } }}
                  >
                  {idx > 0 && <div className="logger-entry-divider" />}

                  {/* Top row: START | hours + progress | END */}
                  <div className="logger-entry-top-row">
                    <div className="logger-entry-start-block">
                      <span className="logger-entry-label">START</span>
                      <div className="logger-entry-time-group">
                        <span className="logger-entry-time-val">{startS.time}</span>
                        <span className="logger-entry-time-ampm">{startS.ampm}</span>
                      </div>
                    </div>

                    <div className="logger-entry-center">
                      <div className="logger-entry-hours">
                        {eh.toFixed(1)} HRS
                      </div>
                      <div className="logger-entry-progress">
                        <div className="logger-entry-progress-line" />
                        <div className="logger-entry-progress-dot" />
                        <div className="logger-entry-progress-line" />
                      </div>
                    </div>

                    <div className="logger-entry-end-block">
                      <span className="logger-entry-label">END</span>
                      <div className="logger-entry-time-group">
                        <span className="logger-entry-time-val">{endS.time}</span>
                        <span className="logger-entry-time-ampm">{endS.ampm}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: logbook attachment pill */}
                  <div className="logger-entry-bottom-row">
                    {hasLogbook ? (
                      <button className="logger-entry-logbook-pill" onClick={() => {
                        const matchedFile = myFiles.find((f: any) => f.name?.includes(e.date)) as any;
                        if (matchedFile) setViewerFileId(matchedFile.id);
                      }}>
                        <div className="logger-pill-icon logger-pill-icon-doc">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EC7A2D" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </div>
                        <span className="logger-pill-text">Logbook Attached</span>
                        <span className="logger-pill-sep">•</span>
                        <span className="logger-pill-action">View</span>
                      </button>
                    ) : (
                      <label className="logger-entry-logbook-pill" htmlFor={`upload-${e.id}`}>
                        <div className="logger-pill-icon logger-pill-icon-plus">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EC7A2D" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </div>
                        <span className="logger-pill-text">No Attachment</span>
                        <span className="logger-pill-sep">•</span>
                        <span className="logger-pill-action">Upload</span>
                        <input
                          id={`upload-${e.id}`}
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="logger-entries-empty">
            <p>No entries logged yet today.</p>
          </div>
        )}
      </div>

      {viewerFileId && (() => {
        const fileRecord = myFiles.find((f: any) => f.id === viewerFileId) as any;
        return (
          <LogbookViewer
            isOpen={!!viewerFileId}
            onClose={() => setViewerFileId(null)}
            fileDataUrl={fileRecord?.data || null}
            fileName={fileRecord?.name}
            onUpdate={e => {
              const maxSize = 5 * 1024 * 1024;
              if (e.size > maxSize) return showToast('File too large (max 5 MB)', 'error');
              const reader = new FileReader();
              reader.onload = async () => {
                try {
                  await api.deleteFile(viewerFileId);
                  const fileRecordObj = {
                    id: viewerFileId,
                    owner_key: user || '',
                    name: fileRecord.name,
                    type: e.type,
                    data: reader.result as string,
                    size: String(e.size),
                    timestamp: new Date().toISOString(),
                  };
                  await api.createFile(fileRecordObj);
                  setState(prev => {
                    const uid = user || '';
                    const existingFiles = (prev.files[uid] || []).filter((f: any) => f.id !== viewerFileId);
                    return { ...prev, files: { ...prev.files, [uid]: [fileRecordObj, ...existingFiles] } };
                  });
                  showToast('Logbook updated');
                } catch { }
              };
              reader.readAsDataURL(e);
            }}
          />
        );
      })()}
    </div>
  );
}
