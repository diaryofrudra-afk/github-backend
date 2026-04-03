import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, todayISO } from '../../utils';
import type { FuelEntry } from '../../types';

export function FuelPage({ active }: { active: boolean }) {
  const { state, setState, showToast, save } = useApp();
  const { cranes, fuelLogs } = state;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalReg, setModalReg] = useState('');
  const [fuelDate, setFuelDate] = useState(todayISO());
  const [fuelLitres, setFuelLitres] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdo, setFuelOdo] = useState('');
  const [fuelType, setFuelType] = useState('Diesel');
  const [fuelNotes, setFuelNotes] = useState('');
  const [expandedReg, setExpandedReg] = useState<string | null>(null);

  // Fleet-wide stats
  let totalLitres = 0, totalCost = 0, entryCount = 0;
  cranes.forEach(c => {
    (fuelLogs[c.reg] || []).forEach(e => {
      totalLitres += Number(e.litres) || 0;
      totalCost += Number(e.cost) || 0;
      entryCount++;
    });
  });
  const avgCost = totalLitres ? totalCost / totalLitres : 0;

  const openFuelModal = (reg: string) => {
    setModalReg(reg);
    setFuelDate(todayISO());
    setFuelLitres(''); setFuelCost(''); setFuelOdo(''); setFuelNotes('');
    setFuelType('Diesel');
    setModalOpen(true);
  };

  const saveFuelEntry = () => {
    if (!fuelLitres || Number(fuelLitres) <= 0) return showToast('Enter litres amount', 'error');
    const entry: FuelEntry = {
      id: String(Date.now()),
      date: fuelDate || todayISO(),
      type: fuelType,
      litres: Number(fuelLitres),
      cost: Number(fuelCost) || 0,
      odometer: Number(fuelOdo) || 0,
      notes: fuelNotes.trim(),
    };
    setState(prev => ({
      ...prev,
      fuelLogs: {
        ...prev.fuelLogs,
        [modalReg]: [entry, ...(prev.fuelLogs[modalReg] || [])],
      },
    }));
    save();
    setModalOpen(false);
    showToast(`Logged ${fuelLitres}L for ${modalReg}`, 'success');
  };

  const deleteFuelEntry = (reg: string, id: string) => {
    if (!confirm('Remove this fuel log entry?')) return;
    setState(prev => ({
      ...prev,
      fuelLogs: {
        ...prev.fuelLogs,
        [reg]: (prev.fuelLogs[reg] || []).filter(e => e.id !== id),
      },
    }));
    save();
  };

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-fuel">
      {/* Section bar */}
      <div className="section-bar" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">Fuel Consumption</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Track fuel levels and consumption per asset</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-sm accent" onClick={() => { if (!cranes.length) return showToast('No assets registered', 'warn'); openFuelModal(cranes[0].reg); }}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {' '}Log Fuel
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="fuel-summary-grid" style={{ marginBottom: 16 }}>
        <div className="fuel-stat">
          <div className="fuel-stat-val" style={{ color: 'var(--accent)' }}>{totalLitres.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--t3)' }}> L</span></div>
          <div className="fuel-stat-lbl">Total Consumed</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-val" style={{ color: 'var(--green)' }}>{fmtINR(totalCost)}</div>
          <div className="fuel-stat-lbl">Total Fuel Cost</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-val" style={{ color: 'var(--amber)' }}>₹{avgCost.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--t3)' }}>/L</span></div>
          <div className="fuel-stat-lbl">Avg Price / Litre</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-val" style={{ color: 'var(--violet)' }}>{entryCount}</div>
          <div className="fuel-stat-lbl">Log Entries</div>
        </div>
      </div>

      {/* Asset cards */}
      <div id="fuel-list">
        {!cranes.length ? (
          <div className="empty-state">
            <h4>No Assets</h4>
            <p>Add fleet assets first</p>
          </div>
        ) : (
          cranes.map(crane => {
            const logs = [...(fuelLogs[crane.reg] || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const litresTotal = logs.reduce((s, e) => s + (Number(e.litres) || 0), 0);
            const costTotal = logs.reduce((s, e) => s + (Number(e.cost) || 0), 0);
            const withOdo = logs.filter(e => e.odometer).map(e => Number(e.odometer)).sort((a, b) => a - b);
            const kpl = withOdo.length >= 2 && litresTotal > 0
              ? ((withOdo[withOdo.length - 1] - withOdo[0]) / litresTotal).toFixed(1)
              : null;
            const fillPct = Math.min(100, Math.round(litresTotal / 300 * 100));
            const barColor = fillPct > 60 ? 'var(--green)' : fillPct > 30 ? 'var(--amber)' : 'var(--red)';
            const expanded = expandedReg === crane.reg;
            return (
              <div key={crane.reg} className="fuel-asset-card">
                <div className="fuel-card-head">
                  <div>
                    <div className="fuel-reg">{crane.reg}</div>
                    <div className="fuel-spec">
                      {[crane.year, crane.make, crane.model].filter(Boolean).join(' · ') || 'No specs'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>{litresTotal.toFixed(1)} L</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)' }}>{fmtINR(costTotal)} total</div>
                    </div>
                    <button className="btn-sm accent" style={{ padding: '5px 10px' }} onClick={() => openFuelModal(crane.reg)}>+ Log</button>
                  </div>
                </div>
                <div className="fuel-bar-wrap">
                  <div className="fuel-bar-fill" style={{ width: `${fillPct}%`, background: barColor }} />
                </div>
                <div className="fuel-efficiency">
                  {kpl && <><span className="fuel-eff-val">{kpl}</span><span style={{ fontSize: 9, color: 'var(--t3)' }}>km/L</span></>}
                  {logs.length ? <span style={{ fontSize: 9, color: 'var(--t3)' }}>{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}</span> : <span style={{ fontSize: 9, color: 'var(--t4)' }}>No logs yet</span>}
                  {costTotal > 0 && <span style={{ fontSize: 9, color: 'var(--t3)' }}>avg ₹{logs.length ? (costTotal / logs.length).toFixed(0) : 0}/fill</span>}
                </div>
                {logs.length > 0 && (
                  <>
                    <button
                      className={`fuel-collapse-btn${expanded ? ' open' : ''}`}
                      onClick={() => setExpandedReg(expanded ? null : crane.reg)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                      </svg>
                      {expanded ? ' Hide History' : ' Show History'}
                    </button>
                    {expanded && (
                      <div className="fuel-log-wrap open">
                        <div style={{ overflowX: 'auto' }}>
                          <table className="fuel-log-table">
                            <thead>
                              <tr><th>Date</th><th>Type</th><th>Litres</th><th>Odometer</th><th>Cost</th><th>Notes</th><th></th></tr>
                            </thead>
                            <tbody>
                              {logs.slice(0, 10).map(e => (
                                <tr key={e.id}>
                                  <td>{e.date}</td>
                                  <td>{e.type || 'Diesel'}</td>
                                  <td style={{ color: 'var(--accent)' }}>{Number(e.litres).toFixed(1)} L</td>
                                  <td>{e.odometer ? Number(e.odometer).toLocaleString('en-IN') + ' km' : '—'}</td>
                                  <td style={{ color: 'var(--green)' }}>{e.cost ? fmtINR(Number(e.cost)) : '—'}</td>
                                  <td style={{ color: 'var(--t3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || '—'}</td>
                                  <td>
                                    <button className="btn-icon-sm red" style={{ width: 24, height: 24 }} onClick={() => deleteFuelEntry(crane.reg, e.id)}>×</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Fuel Modal */}
      {modalOpen && (
        <div className="overlay active" id="ov-fuel" onClick={e => { if ((e.target as HTMLElement).id === 'ov-fuel') setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Log Fuel</div>
                <div style={{ fontSize: 9, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>ASSET: {modalReg}</div>
              </div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Asset</label>
                <select className="form-select" value={modalReg} onChange={e => setModalReg(e.target.value)}>
                  {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={fuelDate} onChange={e => setFuelDate(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Fuel Type</label>
                <select className="form-select" value={fuelType} onChange={e => setFuelType(e.target.value)}>
                  <option>Diesel</option><option>Petrol</option><option>CNG</option><option>Other</option>
                </select>
              </div>
              <div className="form-row"><label className="form-label">Litres *</label><input type="number" className="form-input" value={fuelLitres} onChange={e => setFuelLitres(e.target.value)} placeholder="e.g. 50" /></div>
              <div className="form-row"><label className="form-label">Cost (₹)</label><input type="number" className="form-input" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="Total cost" /></div>
              <div className="form-row"><label className="form-label">Odometer (km)</label><input type="number" className="form-input" value={fuelOdo} onChange={e => setFuelOdo(e.target.value)} placeholder="Current reading" /></div>
              <div className="form-row"><label className="form-label">Notes</label><input className="form-input" value={fuelNotes} onChange={e => setFuelNotes(e.target.value)} placeholder="Driver, site, etc." /></div>
            </div>
            <div className="modal-foot">
              <button className="btn-primary" onClick={saveFuelEntry}>Save Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
