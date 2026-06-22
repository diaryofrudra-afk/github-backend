import { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { useApp } from '../context/AppContext';
import { fmtINR, fmtHours, calcBill } from '../utils';
import { LogbookViewer } from './ui/LogbookViewer';
import { Eye, AlertTriangle } from 'lucide-react';

interface Props {
  craneReg: string;
  operatorKey: string;
  open: boolean;
  onClose: () => void;
}

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30); // Show last 30 days of logbooks by default
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function LogbookModal({ craneReg, operatorKey, open, onClose }: Props) {
  const { state } = useApp();
  const defaults = defaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string>('');

  const crane = useMemo(() => {
    return state.cranes.find(c => c.reg === craneReg) || null;
  }, [state.cranes, craneReg]);

  // Filter timesheets for this crane and operator in the selected date range
  const filteredTimesheets = useMemo(() => {
    if (!operatorKey) return [];
    const tsList = state.timesheets[operatorKey] || [];
    return tsList
      .filter(e => {
        const matchesCrane = e.crane_reg ? e.crane_reg === craneReg : true;
        const matchesStart = startDate ? e.date >= startDate : true;
        const matchesEnd = endDate ? e.date <= endDate : true;
        return matchesCrane && matchesStart && matchesEnd;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.timesheets, operatorKey, craneReg, startDate, endDate]);

  const summary = useMemo(() => {
    let totalHrs = 0;
    let totalRev = 0;
    filteredTimesheets.forEach(e => {
      const h = Number(e.hoursDecimal) || 0;
      totalHrs += h;
      const b = crane ? calcBill(h, crane, 0) : null;
      if (b) totalRev += b.total;
    });
    return {
      shifts: filteredTimesheets.length,
      hours: totalHrs,
      revenue: totalRev
    };
  }, [filteredTimesheets, crane]);

  // Find scanned logbook files
  const logbookFiles = useMemo(() => {
    if (!operatorKey) return [];
    return (state.files[operatorKey] || []) as any[];
  }, [state.files, operatorKey]);

  const getLogbookFileForDate = (date: string) => {
    return logbookFiles.find(f => f.name.includes(`Logbook-${date}`) || f.name.includes(date)) || null;
  };

  const format12 = (t: string): string => {
    if (!t) return '—';
    const [hh, mm] = t.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Operator Logbook — ${craneReg}`}
      subtitle="Shift sheets and physical uploads submitted by the operator"
      maxWidth="820px"
    >
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 13,
              background: 'var(--bg3)',
              color: 'var(--t1)',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 13,
              background: 'var(--bg3)',
              color: 'var(--t1)',
            }}
          />
        </div>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{
          padding: '12px 18px',
          background: 'var(--accent-s)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          flex: 1,
          minWidth: 120,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{summary.shifts} Shifts</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Total Work Days</div>
        </div>
        <div style={{
          padding: '12px 18px',
          background: 'var(--accent-s)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          flex: 1,
          minWidth: 120,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{fmtHours(summary.hours)}</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Total Hours Logged</div>
        </div>
        <div style={{
          padding: '12px 18px',
          background: 'var(--green-s)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          flex: 1,
          minWidth: 120,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmtINR(summary.revenue)}</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Earned Revenue</div>
        </div>
      </div>

      {/* Logbook entries table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Shift Timing', 'Hours', 'Billing Est.', 'Notes', 'Scanned Slip'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'var(--bg4)',
                  color: 'var(--t2)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTimesheets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)' }}>
                  No logbook entries found for this period
                </td>
              </tr>
            ) : (
              filteredTimesheets.map((r, i) => {
                const b = crane ? calcBill(Number(r.hoursDecimal) || 0, crane, 0) : null;
                const file = getLogbookFileForDate(r.date);

                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--t1)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {r.date}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--t1)', whiteSpace: 'nowrap' }}>
                      {format12(r.startTime)} – {format12(r.endTime)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--t1)', fontWeight: 700 }}>
                      {r.hoursDecimal} hrs
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontWeight: 700 }}>
                      {b ? fmtINR(b.total) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--t2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>
                      {r.notes || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {file ? (
                        <button
                          onClick={() => {
                            setViewerFileUrl(file.data);
                            setViewerFileName(file.name);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 0
                          }}
                        >
                          <Eye size={13} /> View scan
                        </button>
                      ) : (
                        <span style={{ color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={13} /> Missing scan
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LogbookViewer
        isOpen={viewerFileUrl !== null}
        onClose={() => setViewerFileUrl(null)}
        fileDataUrl={viewerFileUrl}
        fileName={viewerFileName}
      />
    </Modal>
  );
}
