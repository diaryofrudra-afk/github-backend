import { useState, useRef, useMemo } from 'react';
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const myFiles: any[] = user ? (files[user] || []) : [];

  const h = calcHours(startTime, endTime) || 0;

  const dateISO = selectedDate.toISOString().slice(0, 10);
  const isToday = dateISO === todayISO();

  const todayEntries = useMemo(() => {
    return myTs.filter(e => (e.date || '').startsWith(dateISO));
  }, [myTs, dateISO]);

  const handleCommit = async () => {
    if (!startTime || !endTime) return showToast('Set start and end times', 'error');
    if (!h || h <= 0) return showToast('Invalid time range', 'error');
    const entryId = String(Date.now());

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

    showToast(`Logged: ${fmtHours(h)}`);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) return showToast('File too large (max 5 MB)', 'error');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileRecord = {
          id: String(Date.now()),
          owner_key: user || '',
          name: `Logbook-${dateISO}-${file.name}`,
          type: file.type,
          data: reader.result as string,
          size: String(file.size),
          timestamp: new Date().toISOString(),
        };
        await api.createFile(fileRecord);
        setState(prev => {
          const uid = user || '';
          return { ...prev, files: { ...prev.files, [uid]: [fileRecord, ...(prev.files[uid] || [])] } };
        });
        showToast('Logbook uploaded');
      } catch {
        showToast('Upload failed', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const startSplit = fmtTimeSplit(startTime);
  const endSplit = fmtTimeSplit(endTime);
  const dateLabel = selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`page logger-page ${active ? 'active' : ''}`} id="page-logger">
      <header className="page-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="header-left">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em', margin: 0 }}>Log Time</h2>
          <p style={{ fontSize: 13, color: '#8e8e93', marginTop: 4 }}>Record your daily shift hours</p>
        </div>
        {assigned && (
          <div style={{ background: '#fff4ef', padding: '8px 16px', borderRadius: 12, border: '1px solid #ff6b35', color: '#ff6b35', fontSize: 13, fontWeight: 700 }}>
             Assigned: {assigned.reg}
          </div>
        )}
      </header>

      <div style={{ background: '#fff', borderRadius: 24, padding: 32, border: '1px solid #e5e7eb', marginBottom: 24, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 32 }}>
          <button onClick={() => shiftDate(-1)} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{DAY_NAMES[selectedDate.getDay()]}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{dateLabel}</div>
          </div>
          <button onClick={() => shiftDate(1)} disabled={isToday} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isToday ? 0.3 : 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <div 
            onClick={() => document.getElementById('start-t')?.click()}
            style={{ padding: 24, background: '#f8fafc', borderRadius: 20, border: '1px solid #e5e7eb', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>Start Time</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1a2e' }}>{startSplit.time} <span style={{ fontSize: 14, color: '#8e8e93' }}>{startSplit.ampm}</span></div>
            <input id="start-t" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          </div>
          <div 
            onClick={() => document.getElementById('end-t')?.click()}
            style={{ padding: 24, background: '#f8fafc', borderRadius: 20, border: '1px solid #e5e7eb', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>End Time</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1a2e' }}>{endSplit.time} <span style={{ fontSize: 14, color: '#8e8e93' }}>{endSplit.ampm}</span></div>
            <input id="end-t" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: '#1a1a2e', borderRadius: 20, color: '#fff' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Total Hours</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{(h || 0).toFixed(1)} <span style={{ fontSize: 14 }}>HRS</span></div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
              title="Upload Logbook"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
            <input type="file" ref={fileInputRef} hidden accept="image/*,.pdf" onChange={handleFileUpload} />
            <button onClick={handleCommit} style={{ height: 48, padding: '0 32px', borderRadius: 14, background: '#ff6b35', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(255, 107, 53, 0.3)' }}>
              Save Shift
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1px solid #e5e7eb' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 20 }}>Today's Entries</h3>
        {todayEntries.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>No entries logged yet today.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {todayEntries.map(e => {
              const hasLogbook = myFiles.some((f: any) => f.name?.includes(e.date));
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #e5e7eb' }}>
                   <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase' }}>Start</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt12(e.startTime)}</div>
                      </div>
                      <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase' }}>End</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt12(e.endTime)}</div>
                      </div>
                      <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase' }}>Hours</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ff6b35' }}>{Number(e.hoursDecimal).toFixed(1)}</div>
                      </div>
                   </div>
                   <div style={{ display: 'flex', gap: 8 }}>
                      {hasLogbook && (
                        <button onClick={() => setViewerFileId(e.id)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          Logbook
                        </button>
                      )}
                   </div>
                </div>
              );
            })}
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
