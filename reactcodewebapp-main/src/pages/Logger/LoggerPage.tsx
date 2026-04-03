import { useState, useEffect, useRef } from 'react';
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
  const { cranes, timesheets, operatorProfiles, files } = state;

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const assigned = cranes.find(c => c.operator === user);
  const profile = user ? (operatorProfiles[user] || {}) : {};
  const myTs: TimesheetEntry[] = user ? (timesheets[user] || []) : [];
  const myFiles: unknown[] = user ? (files[user] || []) : [];

  const h = calcHours(startTime, endTime);

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
    // Persist to backend
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
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) return showToast('File too large (max 5 MB)', 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const dateISO = todayISO();
      
      // Delete existing logbook for today if any
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

  // Recalc on time changes (no-op — bill is derived reactively)
  useEffect(() => { /* reactive */ }, [startTime, endTime]);

  const todayISO_ = todayISO();
  const todayEntries = myTs.filter(e => e.date === todayISO_);

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-logger">
      {/* Hero assignment strip */}
      <div className="op-hero">
        <div className="op-assign-label">Current Assignment</div>
        <div className="op-assign-reg" id="op-reg">{assigned ? assigned.reg : 'NONE'}</div>
        {(profile as { name?: string; licence?: string }).name && (
          <div className="op-profile-strip">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{(profile as { name?: string }).name}</span>
            {(profile as { licence?: string }).licence && (
              <span style={{ background: 'var(--accent-s)', color: 'var(--accent)', border: '1px solid var(--accent-g)', borderRadius: 'var(--rf)', padding: '3px 10px', fontSize: 9 }}>
                {(profile as { licence?: string }).licence}
              </span>
            )}
          </div>
        )}
        {!assigned && (
          <div style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
            No equipment assigned — contact dispatch.
          </div>
        )}
      </div>

      {/* Logger card */}
      <div className="logger-card">
        <div className="logger-title">Shift Logger</div>
        <div className="time-row">
          <div>
            <div className="time-label">Start Time</div>
            <div className="time-box">
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="time-label">End Time</div>
            <div className="time-box">
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Hours preview */}
        {h && h > 0 && (
          <div className="bill-preview show">
            <div className="bp-label">Hours Calculated</div>
            <div className="bp-total">{fmtHours(h)}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px', marginTop: '16px' }}>
          <label 
            title="Upload Today's Authorized Logbook"
            style={{
              width: '46px', height: '46px',
              borderRadius: '50%',
              background: 'var(--accent-s)',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <button 
            className="btn-primary" 
            style={{ 
              height: '46px', 
              borderRadius: '23px',
              fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }} 
            onClick={handleCommit}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Commit Shift Log
          </button>
        </div>

        {/* Record count */}
        <div style={{ fontSize: 9, color: 'var(--t3)', textAlign: 'center', marginTop: 10 }}>
          {(myTs.length + myFiles.length) > 0 ? `[ ${myTs.length + myFiles.length} RECORDS SYNCED ]` : ''}
        </div>
      </div>

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 8 }}>
            Today's Entries ({todayEntries.length})
          </div>
          <div className="bill-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Start</th><th>End</th><th>Hours</th><th style={{ textAlign: 'center' }}>Log Book</th></tr>
              </thead>
              <tbody>
                {todayEntries.map(e => {
                  const eh = Number(e.hoursDecimal) || 0;
                  return (
                    <tr key={e.id}>
                      <td>{fmt12(e.startTime)}</td>
                      <td>{fmt12(e.endTime)}</td>
                      <td><span className="hours-badge">{fmtHours(eh)}</span></td>
                      <td style={{ textAlign: 'center' }}>
                         {(() => {
                            const todayLogbook = myFiles.find((f: any) => f.name.startsWith(`Logbook-${e.date}`)) as any;
                            if (!todayLogbook) return <span style={{fontSize:10, color:'var(--t4)'}}>Missing</span>;
                            return (
                               <div onClick={() => setViewerFileId(todayLogbook.id)} style={{width: 32, height: 32, cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border:'1px solid var(--border)', display: 'inline-block'}}>
                                   {todayLogbook.type.includes('image') ? <img src={todayLogbook.data} alt="thumb" style={{width:'100%', height:'100%', objectFit: 'cover'}}/> : <div style={{background:'var(--bg4)', width:'100%', height:'100%', fontSize:8, display:'flex', alignItems:'center', justifyContent:'center'}}>DOC</div>}
                               </div>
                            );
                         })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            // Allow update directly from viewer!
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
                  } catch {}
                };
                reader.readAsDataURL(e);
            }}
          />
        );
      })()}
    </div>
  );
}
