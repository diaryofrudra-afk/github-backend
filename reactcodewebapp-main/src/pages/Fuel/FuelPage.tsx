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
  const [assetSearch, setAssetSearch] = useState('');

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
      {/* Sub-header */}
      <div className="fuel-sub-header-new">
        <div className="fuel-breadcrumb-new">
          <h1 className="fuel-title-new">FUEL CONSUMPTION</h1>
          <span className="fuel-date-badge-new">
            {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
          </span>
        </div>
        <div className="fuel-actions-new">
          <button className="fuel-export-btn-new" onClick={() => showToast('Export feature coming soon', 'info')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            EXPORT TO EXCEL
          </button>
          <button className="fuel-log-fuel-btn-new" onClick={() => {
            if (!cranes.length) return showToast('No assets registered', 'warn');
            openFuelModal(cranes[0].reg);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            LOG FUEL
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="fuel-content-new">
        {/* Glass Summary Cards */}
        <div className="fuel-glass-grid-new">
          {/* Total Consumed */}
          <div className="fuel-glass-card-new">
            <div className="fuel-glass-icon-new fuel-icon-orange">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17" />
                <path d="M3 22h12" />
                <path d="M15 12l3-2v6" />
                <path d="M10 6V4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <div className="fuel-glass-value-new">
              {totalLitres.toFixed(1)}
              <span className="fuel-unit-new">LITRES</span>
            </div>
            <div className="fuel-glass-label-new">Total Consumed</div>
          </div>
          {/* Total Fuel Cost */}
          <div className="fuel-glass-card-new">
            <div className="fuel-glass-icon-new fuel-icon-green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="fuel-glass-value-new fuel-value-green">{fmtINR(totalCost)}</div>
            <div className="fuel-glass-label-new">Total Fuel Cost</div>
          </div>
          {/* Avg Price */}
          <div className="fuel-glass-card-new">
            <div className="fuel-glass-icon-new fuel-icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <div className="fuel-glass-value-new">
              ₹{avgCost.toFixed(1)}
              <span className="fuel-unit-small-new">/L</span>
            </div>
            <div className="fuel-glass-label-new">Avg Price</div>
          </div>
          {/* Log Entries */}
          <div className="fuel-glass-card-new">
            <div className="fuel-glass-icon-new fuel-icon-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="fuel-glass-value-new">{entryCount}</div>
            <div className="fuel-glass-label-new">Log Entries</div>
          </div>
        </div>

        {/* Asset List Header */}
        <div className="fuel-list-header-new">
          <span className="fuel-list-title-new">Active Fleet Assets</span>
          <div className="fuel-list-actions-new">
            <div className="fuel-search-bar-new">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search vehicle..."
                value={assetSearch}
                onChange={e => setAssetSearch(e.target.value)}
              />
            </div>
            <button className="fuel-filter-btn-new">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              FILTERS
            </button>
          </div>
        </div>

        {/* Asset Cards */}
        <div className="fuel-assets-list-new">
          {!cranes.length ? (
            <div className="empty-state">
              <h4>No Assets</h4>
              <p>Add fleet assets first</p>
            </div>
          ) : (
            cranes
              .filter(c =>
                c.reg.toLowerCase().includes(assetSearch.toLowerCase()) ||
                `${c.year} ${c.make} ${c.model}`.toLowerCase().includes(assetSearch.toLowerCase())
              )
              .map(crane => {
                const logs = [...(fuelLogs[crane.reg] || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const litresTotal = logs.reduce((s, e) => s + (Number(e.litres) || 0), 0);
                const costTotal = logs.reduce((s, e) => s + (Number(e.cost) || 0), 0);
                const fillPct = Math.min(100, Math.round(litresTotal / 300 * 100));
                const barColor = fillPct > 60 ? 'var(--green)' : fillPct > 30 ? 'var(--amber)' : 'var(--red)';
                const expanded = expandedReg === crane.reg;

                const getAssetIcon = () => {
                  const modelLower = (crane.model || '').toLowerCase();
                  if (modelLower.includes('truck')) {
                    return (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="1" />
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    );
                  } else if (modelLower.includes('hydra') || modelLower.includes('crane')) {
                    return (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M12 2v14" />
                        <path d="M5 10l7-4 7 4" />
                        <path d="M5 10v6h14v-6" />
                      </svg>
                    );
                  }
                  return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  );
                };

                return (
                  <div key={crane.reg} className="fuel-asset-card-new">
                    <div className="fuel-card-main-new">
                      {/* Left: icon + info */}
                      <div className="fuel-card-left-new">
                        <div className="fuel-icon-square-new">
                          {getAssetIcon()}
                        </div>
                        <div className="fuel-card-info-new">
                          <div className="fuel-reg-new">{crane.reg}</div>
                          <div className="fuel-specs-new">
                            {([crane.make, crane.model, crane.year].filter(Boolean) as string[]).map((s, i, arr) => (
                              <span key={i}>
                                {s}
                                {i < arr.length - 1 && <span className="spec-dot-new">•</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Center: fuel level bar */}
                      <div className="fuel-card-center-new">
                        <div className="fuel-bar-header-new">
                          <span>FUEL LEVEL</span>
                          <span>{fillPct}%</span>
                        </div>
                        <div className="fuel-bar-new">
                          <div className="fuel-bar-fill-new" style={{ width: `${fillPct}%`, background: barColor }} />
                        </div>
                      </div>
                      {/* Right: amount + buttons */}
                      <div className="fuel-card-right-new">
                        <div className="fuel-amount-section-new">
                          <div className="fuel-amount-new">{litresTotal.toFixed(1)} L</div>
                          <div className="fuel-amount-sub-new">{fmtINR(costTotal)} total spent</div>
                        </div>
                        <div className="fuel-buttons-new">
                          <button className="fuel-export-small-btn-new" onClick={() => showToast('Export feature coming soon', 'info')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            EXPORT TO EXCEL
                          </button>
                          <button className="fuel-log-small-btn-new" onClick={() => openFuelModal(crane.reg)}>
                            + LOG FUEL
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Expandable history */}
                    {logs.length > 0 && (
                      <>
                        <button
                          className={`fuel-collapse-btn-new${expanded ? ' open' : ''}`}
                          onClick={() => setExpandedReg(expanded ? null : crane.reg)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                          </svg>
                          {expanded ? 'Hide History' : 'Show History'}
                        </button>
                        {expanded && (
                          <div className="fuel-log-wrap-new open">
                            <div style={{ overflowX: 'auto' }}>
                              <table className="fuel-log-table-new">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Litres</th>
                                    <th>Odometer</th>
                                    <th>Cost</th>
                                    <th>Notes</th>
                                    <th></th>
                                  </tr>
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
      </div>

      {/* Add Fuel Modal */}
      {modalOpen && (
        <div className="fuel-modal-overlay active" onClick={e => { if ((e.target as HTMLElement).className === 'fuel-modal-overlay active' || (e.target as HTMLElement).id === 'ov-fuel') setModalOpen(false); }}>
          <div className="fuel-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="fuel-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17" /><path d="M3 22h12" /><path d="M15 12l3-2v6" /><path d="M10 6V4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2" /></svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, letterSpacing: '-0.01em' }}>Log Fuel</h2>
                  <p style={{ fontSize: 11, color: 'var(--t3)', margin: 0 }}>Capture refueling details for fleet assets</p>
                </div>
              </div>
              <button className="fuel-modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>

            {/* Form */}
            <div className="fuel-modal-body">
              <div className="fuel-modal-grid">
                {/* Row 1: Asset + Date */}
                <div className="fuel-modal-field">
                  <label>Asset</label>
                  <select value={modalReg} onChange={e => setModalReg(e.target.value)}>
                    {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg} — {c.make} {c.model}</option>)}
                  </select>
                </div>
                <div className="fuel-modal-field">
                  <label>Date</label>
                  <div className="fuel-modal-input-wrap">
                    <input type="date" value={fuelDate} onChange={e => setFuelDate(e.target.value)} />
                    <span className="fuel-modal-input-suffix">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    </span>
                  </div>
                </div>

                {/* Row 2: Fuel Type + Litres */}
                <div className="fuel-modal-field">
                  <label>Fuel Type</label>
                  <select value={fuelType} onChange={e => setFuelType(e.target.value)}>
                    <option>Diesel</option><option>Petrol</option><option>CNG</option><option>Electric (kWh)</option><option>Other</option>
                  </select>
                </div>
                <div className="fuel-modal-field">
                  <label>Litres</label>
                  <div className="fuel-modal-input-wrap">
                    <span className="fuel-modal-input-prefix">L</span>
                    <input type="number" step="0.01" value={fuelLitres} onChange={e => setFuelLitres(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Row 3: Cost + Odometer */}
                <div className="fuel-modal-field">
                  <label>Cost</label>
                  <div className="fuel-modal-input-wrap">
                    <span className="fuel-modal-input-prefix">₹</span>
                    <input type="number" step="0.01" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="fuel-modal-field">
                  <label>Odometer</label>
                  <div className="fuel-modal-input-wrap">
                    <span className="fuel-modal-input-prefix">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0" /><path d="M12 12l3 -3" /></svg>
                    </span>
                    <input type="number" value={fuelOdo} onChange={e => setFuelOdo(e.target.value)} placeholder="Current Reading" className="has-both" />
                    <span className="fuel-modal-input-suffix">KM</span>
                  </div>
                </div>
              </div>

              {/* Notes - full width */}
              <div className="fuel-modal-field" style={{ marginTop: 4 }}>
                <label>Notes</label>
                <textarea rows={3} value={fuelNotes} onChange={e => setFuelNotes(e.target.value)} placeholder="Enter any additional details, pump number, or issues..." />
              </div>

              {/* Info Banner */}
              <div className="fuel-modal-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p>Entries are automatically logged to the <strong>Fuel Logs</strong> module. Ensure Odometer readings are accurate for precise fuel efficiency reporting and maintenance forecasting.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="fuel-modal-footer">
              <button className="fuel-modal-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="fuel-modal-btn-save" onClick={saveFuelEntry}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                SAVE ENTRY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
