import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { api } from '../services/api';
import type { EngineStatusRecord } from '../types';

interface Props {
  craneReg: string;
  open: boolean;
  onClose: () => void;
}

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

// Default date range: last 7 days
function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function EngineHistoryModal({ craneReg, open, onClose }: Props) {
  const defaults = defaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [records, setRecords] = useState<EngineStatusRecord[]>([]);
  const [durations, setDurations] = useState<{ status: string; duration_seconds: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset dates when a new vehicle is opened
  useEffect(() => {
    if (open) {
      const d = defaultDates();
      setStartDate(d.start);
      setEndDate(d.end);
    }
  }, [open, craneReg]);

  // Fetch history whenever dates or crane changes
  useEffect(() => {
    if (!open || !craneReg) return;
    fetchHistory();
  }, [open, craneReg, startDate, endDate]);

  // Fetch durations when both dates are set
  useEffect(() => {
    if (!open || !craneReg || !startDate || !endDate) return;
    fetchDurations();
  }, [open, craneReg, startDate, endDate]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getEngineStatusHistory({
        crane_reg: craneReg,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
        limit: 500,
      });
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch engine history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDurations = async () => {
    if (!startDate || !endDate) return;
    try {
      const data = await api.getEngineStatusDurations(
        craneReg,
        new Date(startDate).toISOString(),
        new Date(endDate + 'T23:59:59').toISOString()
      );
      setDurations(data);
    } catch (err) {
      console.error('Failed to fetch durations:', err);
    }
  };

  const handleExport = async () => {
    try {
      const csvContent = await api.exportEngineStatusHistory({
        crane_reg: craneReg,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
      });
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `engine-history-${craneReg}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const totalOn = durations.filter(d => d.status === 'ON').reduce((s, d) => s + d.duration_seconds, 0);
  const totalOff = durations.filter(d => d.status === 'OFF').reduce((s, d) => s + d.duration_seconds, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Engine History — ${craneReg}`}
      subtitle="All ignition on/off transitions logged from GPS"
      maxWidth="820px"
    >
      {/* ── Filters ── */}
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
        <button
          onClick={handleExport}
          style={{
            marginTop: 18,
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download CSV
        </button>
      </div>

      {/* ── Duration Summary ── */}
      {(totalOn > 0 || totalOff > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {totalOn > 0 && (
            <div style={{
              padding: '12px 18px',
              background: 'rgba(5, 150, 105, 0.1)',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              borderRadius: 8,
              minWidth: 120,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>{formatDuration(totalOn)}</div>
              <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>Total Engine ON</div>
            </div>
          )}
          {totalOff > 0 && (
            <div style={{
              padding: '12px 18px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: 8,
              minWidth: 120,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{formatDuration(totalOff)}</div>
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>Total Engine OFF</div>
            </div>
          )}
        </div>
      )}

      {/* ── Records Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Time', 'Engine Status', 'Previous', 'Source', 'Location'].map(h => (
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
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)' }}>
                  Loading…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)' }}>
                  No engine events found for this period
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--t1)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(r.changed_at)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      background: r.engine_on ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.1)',
                      color: r.engine_on ? '#059669' : '#dc2626',
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: r.engine_on ? '#059669' : '#dc2626',
                        display: 'inline-block',
                      }} />
                      {r.engine_on ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: r.previous_status == null ? 'var(--t3)' : r.previous_status ? '#059669' : '#dc2626', fontSize: 12, fontWeight: 600 }}>
                    {r.previous_status == null ? '—' : r.previous_status ? 'ON' : 'OFF'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--t2)', textTransform: 'capitalize' }}>
                    {r.source}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--t3)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.address || (r.location_lat && r.location_lng
                      ? `${r.location_lat.toFixed(4)}, ${r.location_lng.toFixed(4)}`
                      : '—')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
