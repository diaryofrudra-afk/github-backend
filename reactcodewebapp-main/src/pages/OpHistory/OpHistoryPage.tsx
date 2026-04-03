import { useApp } from '../../context/AppContext';
import { fmtHours, todayISO, fmtDate } from '../../utils';
import { api } from '../../services/api';
import { Pretext } from '../../components/ui/Pretext';
import type { TimesheetEntry } from '../../types';
import { LogbookViewer } from '../../components/ui/LogbookViewer';
import { useState } from 'react';

function fmt12(t: string): string {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

// getAccHrs removed as it was only used for billing calculations

export function OpHistoryPage({ active }: { active: boolean }) {
  const { state, setState, showToast, user } = useApp();
  const { timesheets, files } = state;
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);

  const myTs: TimesheetEntry[] = user ? (timesheets[user] || []) : [];
  const myFiles: unknown[] = user ? (files[user] || []) : [];

  const deleteEntry = async (id: string) => {
    if (!confirm('Remove this entry?')) return;
    const uid = user || '';
    const entry = myTs.find(e => e.id === id);
    setState(prev => {
      const remaining = (prev.timesheets[uid] || []).filter(e => e.id !== id);
      let attendance = prev.attendance;
      // If no other entries remain for this date, remove auto-marked attendance
      if (entry && !remaining.some(e => e.date === entry.date)) {
        attendance = attendance.filter(a =>
          !(a.operator_key === uid && a.date === entry.date && a.marked_by === 'operator')
        );
      }
      return {
        ...prev,
        timesheets: { ...prev.timesheets, [uid]: remaining },
        attendance,
      };
    });
    try {
      await api.deleteTimesheet(id);
    } catch {
      showToast('Failed to delete from server', 'error');
    }
  };

  const handleUpdateLogbook = async (file: File) => {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) return showToast('File too large', 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (viewerFileId) await api.deleteFile(viewerFileId);
        const fileRecord = {
          id: viewerFileId || String(Date.now()),
          owner_key: user || '',
          name: file.name,
          type: file.type,
          data: reader.result as string,
          size: String(file.size),
          timestamp: new Date().toISOString(),
        };
        await api.createFile(fileRecord);
        setState(prev => {
          const uid = user || '';
          const newFiles = (prev.files[uid] || []).filter((f: any) => f.id !== viewerFileId);
          newFiles.unshift(fileRecord);
          return { ...prev, files: { ...prev.files, [uid]: newFiles } };
        });
        showToast('Logbook updated');
      } catch {
        showToast('Update failed', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const exportXlsx = () => {
    if (!XLSX) return showToast('XLSX library missing', 'error');
    const wb = XLSX.utils.book_new();
    const td: unknown[][] = [['Date', 'Start', 'End', 'Hours', 'OT', 'Asset', 'Remarks']];
    myTs.forEach(e => {
      const h = Number(e.hoursDecimal) || 0;
      td.push([e.date, fmt12(e.startTime), fmt12(e.endTime), fmtHours(h), (e as TimesheetEntry & { hasOT?: boolean }).hasOT ? 'Yes' : 'No', (e as TimesheetEntry & { craneReg?: string }).craneReg || '—', myFiles.some((f: any) => f.name.startsWith(`Logbook-${e.date}`)) ? 'Logbook Attached' : '']);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(td);
    XLSX.utils.book_append_sheet(wb, ws1, 'Timesheets');
    const fd: unknown[][] = [['File', 'Type', 'Size', 'Uploaded']];
    (myFiles as Array<{ name: string; type: string; size: string; timestamp: string }>).forEach(f => fd.push([f.name, f.type, f.size, f.timestamp]));
    const ws2 = XLSX.utils.aoa_to_sheet(fd);
    XLSX.utils.book_append_sheet(wb, ws2, 'Files');
    XLSX.writeFile(wb, `${user}_${todayISO()}.xlsx`);
    showToast('Exported successfully.');
  };

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-op-history">
      <div className="section-bar" style={{ marginBottom: 14 }}>
        <div className="section-title">My Shift History</div>
        <button className="btn-sm green" onClick={exportXlsx}>
          <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {' '}Export
        </button>
      </div>

      <div id="op-history-content">
        {!myTs.length ? (
          <p className="empty-msg">No shift history yet.</p>
        ) : (
          <div className="bill-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Hours</th>
                  <th>Asset Detail</th>
                  <th style={{ textAlign: 'center' }}>Log Book</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {myTs.map(e => {
                  const eh = Number(e.hoursDecimal) || 0;
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 700 }}>{fmtDate(e.date)}</td>
                      <td>{fmt12(e.startTime)}</td>
                      <td>{fmt12(e.endTime)}</td>
                      <td>
                        <span className="hours-badge">{fmtHours(eh)}</span>
                        {(e as TimesheetEntry & { hasOT?: boolean }).hasOT && <span className="ot-badge"> OT</span>}
                      </td>
                      <td>
                        <Pretext 
                          text={(e as TimesheetEntry & { craneReg?: string }).craneReg || 'No Asset Attached'} 
                          font="600 11px var(--fm)"
                          lineHeight={16}
                        />
                      </td>
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
                      <td>
                        <button
                          className="btn-icon-sm red"
                          style={{ width: 26, height: 26 }}
                          onClick={() => deleteEntry(e.id)}
                          title="Delete entry"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            onUpdate={handleUpdateLogbook}
          />
        );
      })()}
    </div>
  );
}
