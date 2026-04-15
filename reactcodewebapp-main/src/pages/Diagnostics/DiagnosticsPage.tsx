import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getExpiryStatus } from '../../utils';

type DiagFilter = 'all' | 'online' | 'warning' | 'critical' | 'offline';

interface DiagSnapshot {
  battery?: number | null;
  speed?: number | null;
  rpm?: number | null;
  engineTemp?: number | null;
  coolantTemp?: number | null;
  odometer?: number | null;
  signalStrength?: number | null;
  satellites?: number | null;
  hdop?: number | null;
  faults?: Array<{ code: string; description: string; severity?: string }>;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  ignition?: string | null;
  date?: string;
  time?: string;
}

interface DiagRecord {
  health?: string;
  snapshots?: DiagSnapshot[]; // Legacy/Frontend storage
  snapshot?: DiagSnapshot;    // Backend model
  updated_at?: string;
}

function getDiagHealth(s: DiagSnapshot): string {
  if (!s) return 'offline';
  if (s.faults && s.faults.length > 0) return 'critical';
  if ((s.battery !== null && s.battery !== undefined && s.battery < 11.5) || (s.engineTemp !== null && s.engineTemp !== undefined && s.engineTemp > 110)) return 'warning';
  return 'good';
}

function simulateDiag(_reg: string): DiagRecord {
  const ign = Math.random() > 0.3 ? 'ON' : 'OFF';
  const snap: DiagSnapshot = {
    battery: Math.round((11 + Math.random() * 3) * 10) / 10,
    speed: ign === 'ON' ? Math.round(Math.random() * 60) : 0,
    engineTemp: Math.round(60 + Math.random() * 50),
    coolantTemp: Math.round(50 + Math.random() * 40),
    rpm: ign === 'ON' ? Math.round(800 + Math.random() * 2500) : 0,
    odometer: Math.round(10000 + Math.random() * 80000),
    signalStrength: Math.round(30 + Math.random() * 70),
    satellites: Math.round(5 + Math.random() * 10),
    hdop: Math.round((0.5 + Math.random() * 3) * 10) / 10,
    faults: [],
    lat: 20.29 + Math.random() * 0.1,
    lng: 85.82 + Math.random() * 0.1,
    heading: Math.round(Math.random() * 360),
    ignition: ign,
    date: new Date().toLocaleDateString('en-IN'),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
  return { 
    health: getDiagHealth(snap), 
    snapshot: snap, 
    updated_at: new Date().toISOString() 
  };
}

export function DiagnosticsPage({ active }: { active: boolean }) {
  const { state, setState, showToast, save } = useApp();
  const { cranes, diagnostics, compliance } = state;

  const [diagFilter, setDiagFilter] = useState<DiagFilter>('all');
  const [selectedReg, setSelectedReg] = useState('');


  const refreshAsset = (reg: string) => {
    const diag = simulateDiag(reg);
    setState(prev => ({ ...prev, diagnostics: { ...prev.diagnostics, [reg]: diag } }));
    save();
    showToast(`Diagnostics refreshed for ${reg}`);
  };

  const simulateAll = () => {
    const gpsAssets = cranes.filter(c => !!(c as unknown as Record<string, unknown>).gpsId);
    if (!gpsAssets.length) return showToast('No GPS-linked assets', 'warn');
    setState(prev => {
      const newDiag = { ...prev.diagnostics };
      gpsAssets.forEach(c => { newDiag[c.reg] = simulateDiag(c.reg); });
      return { ...prev, diagnostics: newDiag };
    });
    save();
    showToast(`Diagnostics updated for ${gpsAssets.length} assets`);
  };

  const clearAll = async () => {
    if (!confirm('Delete all diagnostic history for every asset?')) return;
    setState(prev => ({ ...prev, diagnostics: {} }));
    save();
    showToast('Diagnostics cleared');
  };

  const gpsAssets = cranes.filter(c => !!(c as unknown as Record<string, unknown>).gpsId);
  const allDiags = gpsAssets.map(c => ({ crane: c, diag: (diagnostics[c.reg] as DiagRecord) || null }));

  const online = allDiags.filter(d => d.diag && d.diag.health && d.diag.health !== 'offline').length;
  const goodCount = allDiags.filter(d => d.diag && d.diag.health === 'good').length;
  const warnCount = allDiags.filter(d => d.diag && d.diag.health === 'warning').length;
  const critCount = allDiags.filter(d => d.diag && d.diag.health === 'critical').length;
  const totalFaults = allDiags.reduce((s, d) => {
    const snap = d.diag ? (d.diag.snapshot || (d.diag.snapshots && d.diag.snapshots[0])) : null;
    if (!snap) return s;
    return s + (snap.faults || []).length;
  }, 0);

  let filtered = allDiags;
  if (diagFilter === 'online') filtered = allDiags.filter(d => d.diag && d.diag.health && d.diag.health !== 'offline');
  else if (diagFilter === 'warning') filtered = allDiags.filter(d => d.diag && d.diag.health === 'warning');
  else if (diagFilter === 'critical') filtered = allDiags.filter(d => d.diag && d.diag.health === 'critical');
  else if (diagFilter === 'offline') filtered = allDiags.filter(d => !d.diag || !d.diag.health || d.diag.health === 'offline');

  const filters: Array<{ id: DiagFilter; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'online', label: 'Online' }, { id: 'warning', label: 'Warning' },
    { id: 'critical', label: 'Critical' }, { id: 'offline', label: 'Offline' },
  ];

  // Compliance for selected asset
  const compReg = selectedReg || (cranes.length ? cranes[0].reg : '');
  const comp = compReg ? (compliance[compReg] || {}) : {};

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-diagnostics">
      <div className="section-bar" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">GPS Diagnostics</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Real-time health monitoring for GPS-linked assets</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-sm accent" onClick={simulateAll}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            {' '}Refresh All
          </button>
          <button className="btn-sm outline" onClick={simulateAll}>Simulate Data</button>
          <button className="btn-sm outline" onClick={clearAll}>Clear All</button>
        </div>
      </div>

      {/* Summary */}
      <div className="diag-summary-grid" style={{ marginBottom: 16 }}>
        <div className="diag-stat" style={{ '--kc': 'var(--accent)' } as React.CSSProperties}><div className="diag-stat-val" style={{ color: 'var(--accent)' }}>{gpsAssets.length}</div><div className="diag-stat-lbl">GPS-linked assets</div></div>
        <div className="diag-stat" style={{ '--kc': 'var(--green)' } as React.CSSProperties}><div className="diag-stat-val" style={{ color: 'var(--green)' }}>{online}</div><div className="diag-stat-lbl">Online · {goodCount} healthy</div></div>
        <div className="diag-stat" style={{ '--kc': 'var(--amber)' } as React.CSSProperties}><div className="diag-stat-val" style={{ color: 'var(--amber)' }}>{warnCount}</div><div className="diag-stat-lbl">Warnings active</div></div>
        <div className="diag-stat" style={{ '--kc': 'var(--red)' } as React.CSSProperties}><div className="diag-stat-val" style={{ color: 'var(--red)' }}>{critCount}</div><div className="diag-stat-lbl">{totalFaults} active fault{totalFaults !== 1 ? 's' : ''}</div></div>
      </div>


      {/* Compliance quick-view */}
      {cranes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Compliance:</span>
            <select className="form-select" style={{ fontSize: 10, padding: '3px 6px', width: 'auto' }} value={compReg} onChange={e => setSelectedReg(e.target.value)}>
              {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['insurance', 'fitness'] as const).map(key => {
              const rec = comp[key];
              const { l, c } = getExpiryStatus(rec?.date);
              const color = c === 'expired' ? 'var(--red)' : c === 'warn' ? 'var(--amber)' : c === 'ok' ? 'var(--green)' : 'var(--t4)';
              return (
                <div key={key} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rmd)', padding: '8px 12px', minWidth: 100 }}>
                  <div style={{ fontSize: 8, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color }}>{l}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="filter-row" style={{ marginBottom: 12 }}>
        {filters.map(f => (
          <span key={f.id} className={`fpill${diagFilter === f.id ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setDiagFilter(f.id)}>{f.label}</span>
        ))}
      </div>

      {/* Diagnostics list */}
      <div id="diag-list">
        {!gpsAssets.length ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            <h4>No GPS-Linked Assets</h4>
            <p>Link a GPS device to any asset in the asset settings to enable diagnostics.</p>
          </div>
        ) : !filtered.length ? (
          <div className="empty-msg">No assets match this filter.</div>
        ) : (
          filtered.map(({ crane, diag }) => {
            const s = diag ? (diag.snapshot || (diag.snapshots && diag.snapshots[0])) : null;
            const health = diag ? diag.health || 'offline' : 'offline';
            const hClass = health === 'good' ? 'good' : health === 'warning' ? 'warning' : health === 'critical' ? 'critical' : 'offline';
            const hLabel = health.charAt(0).toUpperCase() + health.slice(1);
            const faults = s ? (s.faults || []) : [];
            const specsLine = [crane.year, crane.make, crane.model, crane.capacity].filter(Boolean).join(' · ');
            return (
              <div key={crane.reg} className="diag-asset-card">
                <div className="diag-card-head">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="diag-reg">{crane.reg}</span>
                      <span className={`diag-health-pill ${hClass}`}>
                        <span className="diag-health-dot" />
                        {hLabel}
                      </span>
                    </div>
                    {specsLine && <div className="diag-spec">{specsLine}</div>}
                    <div style={{ fontSize: 9, color: 'var(--t4)', marginTop: 2 }}>GPS: {(crane as unknown as Record<string, string>).gpsId || '—'}</div>
                  </div>
                  <button className="btn-sm accent" style={{ padding: '4px 10px', fontSize: 8 }} onClick={() => refreshAsset(crane.reg)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                    {' '}Refresh
                  </button>
                </div>
                {s ? (
                  <div className="diag-metrics">
                    {s.battery != null && <div className="diag-metric"><div className="diag-metric-lbl">Battery</div><div className="diag-metric-val" style={{ color: s.battery < 11.5 ? 'var(--red)' : s.battery < 12.2 ? 'var(--amber)' : 'var(--green)' }}>{s.battery.toFixed(1)}</div><div className="diag-metric-unit">Volts</div></div>}
                    {s.speed != null && <div className="diag-metric"><div className="diag-metric-lbl">Speed</div><div className="diag-metric-val">{s.speed}</div><div className="diag-metric-unit">km/h</div></div>}
                    {s.rpm != null && <div className="diag-metric"><div className="diag-metric-lbl">RPM</div><div className="diag-metric-val">{s.rpm.toLocaleString()}</div><div className="diag-metric-unit">rev/min</div></div>}
                    {s.engineTemp != null && <div className="diag-metric"><div className="diag-metric-lbl">Engine Temp</div><div className="diag-metric-val" style={{ color: s.engineTemp > 110 ? 'var(--red)' : s.engineTemp > 95 ? 'var(--amber)' : 'var(--t1)' }}>{s.engineTemp}</div><div className="diag-metric-unit">°C</div></div>}
                    {s.odometer != null && <div className="diag-metric"><div className="diag-metric-lbl">Odometer</div><div className="diag-metric-val">{Number(s.odometer).toLocaleString('en-IN')}</div><div className="diag-metric-unit">km</div></div>}
                    {s.signalStrength != null && <div className="diag-metric"><div className="diag-metric-lbl">GPS Signal</div><div className="diag-metric-val" style={{ color: s.signalStrength < 15 ? 'var(--red)' : s.signalStrength < 40 ? 'var(--amber)' : 'var(--green)' }}>{s.signalStrength}%</div><div className="diag-metric-unit">{s.satellites || '—'} sats</div></div>}
                    {s.ignition != null && <div className="diag-metric"><div className="diag-metric-lbl">Ignition</div><div className="diag-metric-val" style={{ color: s.ignition === 'ON' ? 'var(--green)' : 'var(--t3)' }}>{s.ignition}</div><div className="diag-metric-unit">{s.ignition === 'ON' ? 'Running' : 'Off'}</div></div>}
                  </div>
                ) : (
                  <div className="empty-msg" style={{ padding: '12px 0' }}>No diagnostic data yet. Click Refresh to simulate.</div>
                )}
                {faults.length > 0 && (
                  <div className="diag-faults">
                    {faults.map((f, i) => (
                      <span key={i} className={`diag-fault ${f.severity || 'warn'}`}>
                        <span style={{ fontSize: 6 }}>●</span> {f.code}: {f.description}
                      </span>
                    ))}
                  </div>
                )}
                {s && (
                  <div style={{ marginTop: 6, fontSize: 9, color: 'var(--t4)' }}>
                    Last update: {s.date} at {s.time}
                    {s.lat && s.lng ? ` · ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : ''}
                    {s.heading != null ? ` · Heading ${s.heading}°` : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
