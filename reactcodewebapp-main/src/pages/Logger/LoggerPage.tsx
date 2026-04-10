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

  const dayIdx = selectedDate.getDay();
  const monthIdx = selectedDate.getMonth();
  const dayNum = selectedDate.getDate();
  const dateLabel = `${DAY_NAMES[dayIdx]}, ${MONTH_NAMES[monthIdx]} ${dayNum}`;
  const isToday = todayISO() === selectedDate.toISOString().split('T')[0];

  const startSplit = fmtTimeSplit(startTime);
  const endSplit = fmtTimeSplit(endTime);

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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="logger-date-center">
          <h1 className="logger-date-text">{dateLabel}</h1>
          <p className="logger-date-sub">{isToday ? 'TODAY' : ''}</p>
        </div>
        <button className="logger-date-arrow" onClick={() => shiftDate(1)}>
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
          <button className="logger-view-all">VIEW ALL</button>
        </div>
        {todayEntries.length > 0 ? (
          <div className="logger-entries-cards">
            {todayEntries.map((e, idx) => {
              const eh = Number(e.hoursDecimal) || 0;
              const startS = fmtTimeSplit(e.startTime);
              const endS = fmtTimeSplit(e.endTime);
              const hasLogbook = myFiles.some((f: any) => f.name?.includes(e.date));
              return (
                <div key={e.id} className="logger-entry-card">
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
                      <button className="logger-entry-logbook-pill" onClick={() => setViewerFileId(e.id)}>
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
