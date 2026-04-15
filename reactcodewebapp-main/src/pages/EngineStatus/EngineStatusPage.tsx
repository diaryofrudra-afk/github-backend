import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { EngineStatusRecord } from '../../types';

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
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export function EngineStatusPage({ active }: { active: boolean }) {
  const { showToast, state } = useApp();
  const [records, setRecords] = useState<EngineStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCrane, setSelectedCrane] = useState<string>('');
  const [cranes, setCranes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [durations, setDurations] = useState<{ status: string; duration_seconds: number }[]>([]);

  useEffect(() => {
    if (active) {
      fetchCranes();
    }
  }, [active]);

  useEffect(() => {
    if (active && state.cranes?.length) {
      const regNumbers = state.cranes.map((c: any) => c.reg).filter(Boolean);
      setCranes(regNumbers);
    }
  }, [active, state.cranes]);

  useEffect(() => {
    if (active && startDate && endDate) {
      fetchDurations();
    } else if (active) {
      fetchHistory();
    }
  }, [active, selectedCrane, startDate, endDate]);

  const fetchCranes = async () => {
    try {
      const craneData = await api.getCranes();
      const regNumbers = craneData.map((c: any) => c.reg).filter(Boolean);
      setCranes(regNumbers);
    } catch (err) {
      console.error('Failed to fetch cranes:', err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getEngineStatusHistory({
        crane_reg: selectedCrane || undefined,
        limit: 500,
      });
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch engine status history:', err);
      showToast('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDurations = async () => {
    if (!selectedCrane || !startDate || !endDate) return;
    setLoading(true);
    try {
      const data = await api.getEngineStatusDurations(
        selectedCrane,
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString()
      );
      setDurations(data);
    } catch (err) {
      console.error('Failed to fetch durations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const csvContent = await api.exportEngineStatusHistory({
        crane_reg: selectedCrane || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `engine-status-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Export downloaded', 'success');
    } catch (err) {
      console.error('Failed to export:', err);
      showToast('Failed to export', 'error');
    }
  };

  if (!active) return null;

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      background: '#f4f6f8',
      padding: '20px',
      minHeight: '100vh',
    }}>
      <h2 style={{ color: '#1f2937', marginBottom: '20px' }}>Engine Status History</h2>

      <div style={{
        background: '#fff',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedCrane}
            onChange={(e) => setSelectedCrane(e.target.value)}
            style={{
              padding: '10px 15px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              minWidth: '200px',
            }}
          >
            <option value="">All Vehicles</option>
            {cranes.map((reg) => (
              <option key={reg} value={reg}>{reg}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '10px 15px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
            }}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '10px 15px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
            }}
          />

          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              background: '#1f2937',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: 'auto',
            }}
          >
            Download CSV
          </button>
        </div>
      </div>

      {startDate && endDate && selectedCrane ? (
        <div style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <h3 style={{ color: '#1f2937', marginBottom: '15px' }}>
            Engine On/Off Durations - {selectedCrane}
          </h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div style={{ display: 'flex', gap: '30px' }}>
              {durations.filter(d => d.status === 'ON').reduce((acc, d) => acc + d.duration_seconds, 0) > 0 && (
                <div style={{ padding: '15px', background: '#ecfdf5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                    {formatDuration(durations.filter(d => d.status === 'ON').reduce((acc, d) => acc + d.duration_seconds, 0))}
                  </div>
                  <div style={{ color: '#059669', fontSize: '14px' }}>Total Engine ON</div>
                </div>
              )}
              {durations.filter(d => d.status === 'OFF').reduce((acc, d) => acc + d.duration_seconds, 0) > 0 && (
                <div style={{ padding: '15px', background: '#fef2f2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    {formatDuration(durations.filter(d => d.status === 'OFF').reduce((acc, d) => acc + d.duration_seconds, 0))}
                  </div>
                  <div style={{ color: '#dc2626', fontSize: '14px' }}>Total Engine OFF</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: '#fff',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      }}>
        <thead>
          <tr>
            <th style={styles.th}>Registration Number</th>
            <th style={styles.th}>Engine Status</th>
            <th style={styles.th}>Previous Status</th>
            <th style={styles.th}>Time</th>
            <th style={styles.th}>Source</th>
            <th style={styles.th}>Location</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} style={{ padding: '20px', textAlign: 'center' }}>
                Loading...
              </td>
            </tr>
          ) : records.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                No engine status records found
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 'bold' }}>{record.crane_reg}</td>
                <td style={styles.td}>
                  <span className={record.engine_on ? 'status-on' : 'status-off'}>
                    {record.engine_on ? 'ON' : 'OFF'}
                  </span>
                </td>
                <td style={styles.td}>
                  {record.previous_status !== null ? (
                    <span style={{ color: record.previous_status ? '#059669' : '#dc2626' }}>
                      {record.previous_status ? 'ON' : 'OFF'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td style={styles.td}>{formatDateTime(record.changed_at)}</td>
                <td style={styles.td}>{record.source}</td>
                <td style={styles.td}>
                  {record.address || (record.location_lat && record.location_lng
                    ? `${record.location_lat.toFixed(4)}, ${record.location_lng.toFixed(4)}`
                    : '-')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <style>{`
        .status-on {
          color: #059669;
          font-weight: bold;
        }
        .status-off {
          color: #dc2626;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

const styles = {
  th: {
    background: '#1f2937',
    color: '#fff',
    padding: '14px 16px',
    textAlign: 'left' as const,
    textTransform: 'uppercase' as const,
    fontSize: '14px',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '14px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #e5e7eb',
  },
  tr: {
    borderBottom: '1px solid #e5e7eb',
  },
};
