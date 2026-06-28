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

const toDateInput = (d: Date) => d.toISOString().split('T')[0];

// Quick-range presets (in days). `custom` lets the user pick manually.
const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: '1', label: '24h', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'custom', label: 'Custom', days: null },
];

function rangeForDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: toDateInput(start), end: toDateInput(end) };
}

export function EngineHistoryModal({ craneReg, open, onClose }: Props) {
  const initial = rangeForDays(7);
  const [preset, setPreset] = useState('7');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [records, setRecords] = useState<EngineStatusRecord[]>([]);
  const [durations, setDurations] = useState<{ status: string; duration_seconds: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset to default range when a new vehicle is opened
  useEffect(() => {
    if (open) {
      const d = rangeForDays(7);
      setPreset('7');
      setStartDate(d.start);
      setEndDate(d.end);
    }
  }, [open, craneReg]);

  // Fetch history + durations whenever dates or crane changes
  useEffect(() => {
    if (!open || !craneReg) return;
    fetchHistory();
  }, [open, craneReg, startDate, endDate]);

  useEffect(() => {
    if (!open || !craneReg || !startDate || !endDate) return;
    fetchDurations();
  }, [open, craneReg, startDate, endDate]);

  const applyPreset = (p: { key: string; days: number | null }) => {
    setPreset(p.key);
    if (p.days != null) {
      const r = rangeForDays(p.days);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

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
      a.download = `status-history-${craneReg}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const totalOn = durations.filter(d => d.status === 'ON').reduce((s, d) => s + d.duration_seconds, 0);
  const totalOff = durations.filter(d => d.status === 'OFF').reduce((s, d) => s + d.duration_seconds, 0);
  const totalTracked = totalOn + totalOff;
  const onPct = totalTracked > 0 ? Math.round((totalOn / totalTracked) * 100) : 0;
  const transitions = records.length;

  const inputStyle: React.CSSProperties = {
    padding: '8px 11px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 13,
    background: 'var(--bg3)',
    color: 'var(--t1)',
    colorScheme: 'dark',
    outline: 'none',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Status History — ${craneReg}`}
      subtitle="Ignition on/off transitions logged from GPS"
      maxWidth="860px"
    >
      {/* ── Controls bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Quick-range segmented control */}
          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              gap: 2,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              width: 'fit-content',
            }}
          >
            {PRESETS.map(p => {
              const active = preset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--t2)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Manual date inputs */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={e => { setPreset('custom'); setStartDate(e.target.value); }}
              style={inputStyle}
            />
            <span style={{ color: 'var(--t3)', fontSize: 13 }}>→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={toDateInput(new Date())}
              onChange={e => { setPreset('custom'); setEndDate(e.target.value); }}
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          style={{
            padding: '9px 16px',
            background: 'var(--bg3)',
            color: 'var(--t1)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--t1)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <SummaryCard
          label="Engine ON"
          value={formatDuration(totalOn)}
          color="#10b981"
          tint="rgba(16,185,129,0.10)"
          icon={<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />}
        />
        <SummaryCard
          label="Engine OFF"
          value={formatDuration(totalOff)}
          color="#ef4444"
          tint="rgba(239,68,68,0.09)"
          icon={<><circle cx="12" cy="12" r="9" /><line x1="12" y1="2" x2="12" y2="12" /></>}
        />
        <SummaryCard
          label="Transitions"
          value={String(transitions)}
          color="var(--accent)"
          tint="var(--accent-s)"
          icon={<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>}
        />
      </div>

      {/* ── Utilization bar ── */}
      {totalTracked > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Utilization
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--t1)', fontWeight: 700 }}>{onPct}% running</span>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', background: 'var(--bg4)' }}>
            <div style={{ width: `${onPct}%`, background: '#10b981', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${100 - onPct}%`, background: '#ef4444', opacity: 0.55 }} />
          </div>
        </div>
      )}

      {/* ── Records table ── */}
      <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Time', 'Status', 'Previous', 'Source', 'Location'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 14px',
                      textAlign: 'left',
                      background: 'var(--bg4)',
                      color: 'var(--t3)',
                      fontSize: 10.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.7px',
                      fontWeight: 700,
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>
                    <Spinner />
                    <div style={{ marginTop: 10, fontSize: 13 }}>Loading status history…</div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <circle cx="12" cy="12" r="10" /><polyline points="12 7 12 12 15 14" />
                    </svg>
                    <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--t2)' }}>No status events</div>
                    <div style={{ marginTop: 4, fontSize: 12.5 }}>No ignition transitions were logged in this period.</div>
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg3)',
                      borderBottom: i === records.length - 1 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '11px 14px', color: 'var(--t1)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {formatDateTime(r.changed_at)}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <StatusPill on={r.engine_on} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.previous_status == null ? (
                        <span style={{ color: 'var(--t3)' }}>—</span>
                      ) : (
                        <span style={{ color: r.previous_status ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                          {r.previous_status ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--t2)',
                          textTransform: 'capitalize',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'var(--bg4)',
                        }}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '11px 14px',
                        color: 'var(--t3)',
                        fontSize: 12,
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.address ||
                        (r.location_lat && r.location_lng
                          ? `${r.location_lat.toFixed(4)}, ${r.location_lng.toFixed(4)}`
                          : '—')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function SummaryCard({
  label,
  value,
  color,
  tint,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: tint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function StatusPill({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 11px',
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.3px',
        background: on ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
        color: on ? '#10b981' : '#ef4444',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: on ? '#10b981' : '#ef4444',
          display: 'inline-block',
          boxShadow: on ? '0 0 0 3px rgba(16,185,129,0.18)' : 'none',
        }}
      />
      {on ? 'ON' : 'OFF'}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border)" strokeWidth="3" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
