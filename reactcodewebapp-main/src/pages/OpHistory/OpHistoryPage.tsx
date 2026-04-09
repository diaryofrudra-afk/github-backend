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

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

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

  function getHoursBadgeColor(hrs: number): string {
    if (hrs >= 10) return 'op-hours-purple';
    if (hrs >= 8) return 'op-hours-green';
    return 'op-hours-gray';
  }

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
    <div className={`page ${active ? 'active' : ''}`} id="page-op-history">
      <div className="op-history-wrap">
        {/* Section Header */}
        <div className="op-history-section-header">
          <span className="op-history-section-title">Recent Logs</span>
          <button className="op-history-filter-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Filter
          </button>
        </div>

        {/* Log Cards */}
        {!myTs.length ? (
          <p className="empty-msg">No shift history yet.</p>
        ) : (
          <div className="op-history-cards">
            {myTs.map(e => {
              const eh = Number(e.hoursDecimal) || 0;
              const parts = formatDateParts(e.date || '');
              const hasLogbook = myFiles.some((f: any) => f.name.startsWith(`Logbook-${e.date}`));
              const badgeClass = getHoursBadgeColor(eh);

              return (
                <div key={e.id} className="op-history-card">
                  {/* Top Row: Day + Hours Badge */}
                  <div className="op-history-card-top">
                    <div>
                      <div className="op-history-day-label">{parts.dayName}</div>
                      <div className="op-history-date">{parts.formatted}</div>
                    </div>
                    <span className={`op-hours-badge ${badgeClass}`}>{eh.toFixed(1)}h</span>
                  </div>

                  {/* Time Row */}
                  <div className="op-history-times">
                    <div className="op-history-time-item">
                      <span className="op-history-time-label">START TIME</span>
                      <span className="op-history-time-value">{fmt12(e.startTime)}</span>
                    </div>
                    <div className="op-history-time-item">
                      <span className="op-history-time-label">END TIME</span>
                      <span className="op-history-time-value">{fmt12(e.endTime)}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="op-history-divider" />

                  {/* Bottom Row: Asset */}
                  <div className="op-history-asset">
                    {hasLogbook ? (
                      <button className="op-history-asset-btn" onClick={() => setViewerFileId(e.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Logbook Attached
                      </button>
                    ) : (
                      <div className="op-history-asset-text">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        No Logbook Attached
                      </div>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
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
