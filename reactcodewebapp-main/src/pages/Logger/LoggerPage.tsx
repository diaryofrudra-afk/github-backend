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

export function LoggerPage({ active }: { active: boolean }) {
  const { state, setState, showToast, user } = useApp();
  const { cranes, timesheets, files } = state;

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const assigned = cranes.find(c => c.operator === user);
  const myTs: TimesheetEntry[] = user ? (timesheets[user] || []) : [];
  const myFiles: unknown[] = user ? (files[user] || []) : [];

  const h = calcHours(startTime, endTime) || 0;
  const breakMinutes = h >= 6 ? 30 : 0;

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

  const dateLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isToday = todayISO() === selectedDate.toISOString().split('T')[0];

  return (
    <div className={`page ${active ? 'active' : ''} logger-page-modern`} id="page-logger">
      {/* Current Assignment Card */}
      {assigned && (
        <div className="logger-assignment-card">
          <div className="op-assign-label">Current Assignment</div>
          <div className="op-assign-reg">{assigned.reg}</div>
        </div>
      )}

      {/* Date Navigation */}
      <div className="logger-date-nav">
        <button className="logger-date-arrow" onClick={() => shiftDate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="logger-date-center">
          <h1 className="logger-date-text">{dateLabel}</h1>
          <p className="logger-date-sub">{isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
        <button className="logger-date-arrow" onClick={() => shiftDate(1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Duration Badge */}
      <div className="logger-duration-badge">
        <span className="logger-duration-dot" />
        <span>{(h || 0).toFixed(1)} HRS</span>
      </div>

      {/* Time Input Cards */}
      <div className="logger-time-cards">
        {/* Start Time */}
        <div className="logger-time-card">
          <span className="logger-time-card-label">Start Time</span>
          <div className="logger-time-card-display">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="logger-time-card-input" />
          </div>
        </div>
        {/* End Time */}
        <div className="logger-time-card">
          <span className="logger-time-card-label">End Time</span>
          <div className="logger-time-card-display">
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="logger-time-card-input" />
          </div>
        </div>
      </div>

      {/* Break Info */}
      <div className="logger-break-row">
        <div className="logger-break-line" />
        <span className="logger-break-text">Break: {breakMinutes} MIN</span>
        <div className="logger-break-line" />
      </div>

      {/* Action Buttons */}
      <div className="logger-actions-modern">
        <label className="logger-upload-circle" title="Upload Today's Authorized Logbook">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>

        <button className="logger-save-btn-modern" onClick={handleCommit}>
          Save Shift
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Today's Entries */}
      {todayEntries.length > 0 && (
        <div className="logger-today-entries">
          <div className="logger-entries-header">
            <h2>Today's Entries ({todayEntries.length})</h2>
            <button className="logger-view-all">View All</button>
          </div>
          <div className="logger-entries-card">
            <div className="logger-entries-head">
              <span>Start</span>
              <span>End</span>
              <span style={{ textAlign: 'right' }}>Hours</span>
            </div>
            {todayEntries.map(e => {
              const eh = Number(e.hoursDecimal) || 0;
              return (
                <div key={e.id} className="logger-entry-row">
                  <span>{fmt12(e.startTime)}</span>
                  <span>{fmt12(e.endTime)}</span>
                  <span className="logger-entry-hours">{eh.toFixed(1)}h</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
