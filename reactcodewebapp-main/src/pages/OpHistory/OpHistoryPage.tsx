import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { TimesheetEntry } from '../../types';
import { LogbookViewer } from '../../components/ui/LogbookViewer';
import { useState, useMemo } from 'react';

function fmt12(t: string): string {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function OpHistoryPage({ active }: { active: boolean }) {
  const { state, setState, showToast, user } = useApp();
  const { timesheets, files } = state;
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);

  const myTs: TimesheetEntry[] = useMemo(() => {
    const entries = user ? (timesheets[user] || []) : [];
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [user, timesheets]);
  const myFiles: unknown[] = user ? (files[user] || []) : [];

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

  function formatDateParts(dateStr: string): { dayName: string; day: number; month: string; year: number; formatted: string } {
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = DAY_NAMES[d.getDay()];
    const day = d.getDate();
    const month = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    const formatted = `${String(day).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${year}`;
    return { dayName, day, month, year, formatted };
  }

  return (
    <div className={`page op-history-page ${active ? 'active' : ''}`} id="page-op-history">
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div className="header-left">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em', margin: 0 }}>Work History</h2>
          <p style={{ fontSize: 13, color: '#8e8e93', marginTop: 4 }}>Review your completed shifts and logbooks</p>
        </div>
      </header>

      <div className="op-history-wrap">
        {!myTs.length ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: 24, border: '1px dashed #e5e7eb' }}>
            <p style={{ color: '#64748b' }}>No shift history yet.</p>
          </div>
        ) : (
          <div className="op-history-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {myTs.map(e => {
              const eh = Number(e.hoursDecimal) || 0;
              const parts = formatDateParts(e.date || '');
              const hasLogbook = myFiles.some((f: any) => f.name.startsWith(`Logbook-${e.date}`));
              const badgeColor = eh >= 10 ? '#7c3aed' : eh >= 8 ? '#34c759' : '#8e8e93';

              return (
                <div key={e.id} className="op-history-card" style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1px solid #e5e7eb', transition: 'all 0.3s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', textTransform: 'uppercase', letterSpacing: 0.5 }}>{parts.dayName}</div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '4px 0 0' }}>{parts.formatted}</h3>
                    </div>
                    <div style={{ padding: '6px 12px', borderRadius: 10, background: `${badgeColor}15`, color: badgeColor, fontSize: 13, fontWeight: 700 }}>
                      {eh.toFixed(1)}h
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#f8fafc', borderRadius: 16, marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Start</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt12(e.startTime)}</div>
                    </div>
                    <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>End</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt12(e.endTime)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {hasLogbook ? (
                      <button 
                        onClick={() => setViewerFileId(e.id)}
                        style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px', fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        View Logbook
                      </button>
                    ) : (
                      <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px', fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        No Logbook
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewerFileId && (() => {
        const entry = myTs.find(e => e.id === viewerFileId);
        const fileRecord = myFiles.find((f: any) => f.name.startsWith(`Logbook-${entry?.date}`)) as any;
        if (!fileRecord) return null;
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
