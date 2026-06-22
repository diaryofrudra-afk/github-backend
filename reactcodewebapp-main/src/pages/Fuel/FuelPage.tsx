import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, todayISO } from '../../utils';
import { api } from '../../services/api';
import type { FuelEntry } from '../../types';

import { PageContainer } from '../../components/ui/PageContainer';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { SearchInput } from '../../components/ui/SearchInput';
import { Download, Plus, Droplet, IndianRupee, Tag } from 'lucide-react';

export function FuelPage({ active }: { active: boolean }) {
  const { state, setState, showToast } = useApp();
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
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});

  // Current-month prefix — summary cards filter to this month (consistent with the month badge)
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Fleet-wide stats scoped to the current month
  let totalLitres = 0, totalCost = 0, entryCount = 0;
  cranes.forEach(c => {
    (fuelLogs[c.reg] || []).forEach(e => {
      if (!e.date.startsWith(monthPrefix)) return;
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

  const saveFuelEntry = async () => {
    if (!fuelLitres || Number(fuelLitres) <= 0) return showToast('Enter litres amount', 'error');
    try {
      const created: FuelEntry = await api.createFuelLog({
        crane_reg: modalReg,
        date: fuelDate || todayISO(),
        type: fuelType,
        litres: Number(fuelLitres),
        cost: Number(fuelCost) || 0,
        odometer: Number(fuelOdo) || undefined,
        notes: fuelNotes.trim(),
      });
      setState(prev => ({
        ...prev,
        fuelLogs: {
          ...prev.fuelLogs,
          [modalReg]: [created, ...(prev.fuelLogs[modalReg] || [])],
        },
      }));
      setModalOpen(false);
      showToast(`Logged ${fuelLitres}L for ${modalReg}`, 'success');
    } catch {
      showToast('Failed to save fuel entry', 'error');
    }
  };

  const deleteFuelEntry = async (reg: string, id: string) => {
    if (!confirm('Remove this fuel log entry?')) return;
    try {
      await api.deleteFuelLog(id);
      setState(prev => ({
        ...prev,
        fuelLogs: {
          ...prev.fuelLogs,
          [reg]: (prev.fuelLogs[reg] || []).filter(e => e.id !== id),
        },
      }));
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  };

  const filteredCranes = cranes.filter(c =>
    c.reg.toLowerCase().includes(assetSearch.toLowerCase()) ||
    [c.make, c.model, c.year].filter(Boolean).join(' ').toLowerCase().includes(assetSearch.toLowerCase())
  );

  return (
    <PageContainer id="page-fuel" active={active} className="fuel-page">
      <div className="p-5 border-b border-[var(--border)] bg-gradient-to-b from-[var(--accent-s)] to-[var(--bg4)]">
        <PageHeader 
          title="Fuel" 
          subtitle="Monitor and manage fuel consumption"
          icon={<Droplet size={20} />}
          iconBgClass="bg-orange-500 shadow-orange-100"
        >
          <button className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg4)] px-4 text-xs font-bold text-[var(--t1)] transition hover:bg-[var(--bg5)]" onClick={() => showToast('Export feature coming soon', 'info')}>
            <Download size={16} className="text-[var(--t4)]" />
            Export
          </button>
          <button className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent-solid)]" onClick={() => {
            if (!cranes.length) return showToast('No assets registered', 'warn');
            openFuelModal(cranes[0].reg);
          }}>
            <Plus size={16} />
            Log Fuel
          </button>
        </PageHeader>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Droplet size={18} />}
            label="Consumed"
            value={`${totalLitres.toFixed(1)} L`}
            colorClass="text-orange-600"
            bgClass="bg-orange-50"
          />
          <StatCard
            icon={<IndianRupee size={18} />}
            label="Fuel Cost"
            value={fmtINR(totalCost)}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
          />
          <StatCard
            icon={<Tag size={18} />}
            label="Avg Price"
            value={`₹${avgCost.toFixed(2)}/L`}
            colorClass="text-green-600"
            bgClass="bg-green-50"
          />
          <StatCard
            icon={<Droplet size={18} />}
            label="Log Entries"
            value={entryCount}
            colorClass="text-[var(--t2)]"
            bgClass="bg-[var(--bg5)]"
          />
        </div>
      </div>

      <div className="p-5 flex-1 bg-[var(--bg3)] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-sm font-bold text-[var(--t1)]">Active Assets</h3>
          <SearchInput value={assetSearch} onChange={setAssetSearch} placeholder="Search vehicle..." />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!cranes.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">Add fleet assets first</p>
            </div>
          ) : filteredCranes.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">No assets match "{assetSearch}"</p>
            </div>
          ) : (
            filteredCranes.map(crane => {
              const logs = [...(fuelLogs[crane.reg] || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const litresTotal = logs.reduce((s, e) => s + (Number(e.litres) || 0), 0);
              const costTotal = logs.reduce((s, e) => s + (Number(e.cost) || 0), 0);

              // Monthly usage bar — shows this month's consumption as % of 300 L baseline
              const monthLitres = logs
                .filter(e => e.date.startsWith(monthPrefix))
                .reduce((s, e) => s + (Number(e.litres) || 0), 0);
              const fillPct = Math.min(100, Math.round(monthLitres / 300 * 100));
              // High consumption = red/amber (warning), low = green
              const barColor = fillPct > 60 ? 'bg-red-500' : fillPct > 30 ? 'bg-amber-500' : 'bg-green-500';
              const expanded = expandedReg === crane.reg;

              const displayLogs = showAllMap[crane.reg] ? logs : logs.slice(0, 10);

              return (
                <article key={crane.reg} className="bg-[var(--bg4)] rounded-2xl p-5 border border-[var(--border)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col group">
                  <header className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-sm border border-orange-100">
                        <Droplet size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-[var(--t1)] truncate">{crane.reg}</h3>
                        <p className="text-[11px] font-medium text-[var(--t3)] truncate">
                          {([crane.make, crane.model, crane.year].filter(Boolean) as string[]).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1">
                      <span>Monthly Usage</span>
                      <span>{fillPct}%</span>
                    </div>
                    <div className="h-2 bg-[var(--bg5)] rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>

                  <section className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 grid grid-cols-2 gap-3 mb-4 flex-1">
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Total Consumed</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{litresTotal.toFixed(1)} L</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Total Spent</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{fmtINR(costTotal)}</div>
                    </div>
                  </section>

                  <footer className="grid grid-cols-2 gap-2 mt-auto">
                    <button 
                      onClick={() => setExpandedReg(expanded ? null : crane.reg)}
                      className="h-9 bg-[var(--bg5)] text-[var(--t2)] border border-[var(--border)] hover:bg-[var(--bg5)] rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1"
                    >
                      {expanded ? 'Hide History' : 'History'}
                    </button>
                    <button 
                      onClick={() => openFuelModal(crane.reg)}
                      className="h-9 bg-orange-500 text-white hover:bg-orange-600 rounded-xl text-[11px] font-bold transition shadow-sm flex items-center justify-center gap-1"
                    >
                      <Plus size={14} /> Log Fuel
                    </button>
                  </footer>

                  {/* Expandable history */}
                  {expanded && logs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <div className="max-h-60 overflow-y-auto pr-2">
                        {displayLogs.map(e => (
                          <div key={e.id} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                            <div>
                              <div className="text-xs font-bold text-[var(--t1)]">{e.date}</div>
                              <div className="text-[10px] text-[var(--t3)]">{e.type || 'Diesel'}</div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <div>
                                <div className="text-xs font-bold text-orange-600">{Number(e.litres).toFixed(1)} L</div>
                                <div className="text-[10px] text-green-600">{e.cost ? fmtINR(Number(e.cost)) : '—'}</div>
                              </div>
                              <button onClick={() => deleteFuelEntry(crane.reg, e.id)} className="p-1 text-[var(--t4)] hover:text-red-500 transition">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {logs.length > 10 && !showAllMap[crane.reg] && (
                          <button
                            className="w-full text-center text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-2 hover:underline"
                            onClick={() => setShowAllMap(p => ({ ...p, [crane.reg]: true }))}
                          >
                            Show all {logs.length} entries
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Add Fuel Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-[var(--bg4)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg3)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Droplet size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--t1)]">Log Fuel</h2>
                  <p className="text-[11px] font-medium text-[var(--t3)] uppercase tracking-wider">Capture refueling details</p>
                </div>
              </div>
              <button className="text-[var(--t4)] hover:text-[var(--t1)] bg-[var(--bg4)] p-2 rounded-xl border border-[var(--border)] transition shadow-sm" onClick={() => setModalOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Asset</label>
                  <select value={modalReg} onChange={e => setModalReg(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition">
                    {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg} — {c.make}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Date</label>
                  <input type="date" value={fuelDate} onChange={e => setFuelDate(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Fuel Type</label>
                  <select value={fuelType} onChange={e => setFuelType(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition">
                    <option>Diesel</option><option>Petrol</option><option>CNG</option><option>Electric (kWh)</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Litres</label>
                  <div className="relative">
                    <input type="number" step="0.01" value={fuelLitres} onChange={e => setFuelLitres(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t4)] text-sm font-bold">L</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Cost</label>
                  <div className="relative">
                    <input type="number" step="0.01" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t4)] text-sm font-bold">₹</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Odometer</label>
                  <div className="relative">
                    <input type="number" value={fuelOdo} onChange={e => setFuelOdo(e.target.value)} placeholder="Reading" className="w-full pr-8 pl-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t4)] text-[10px] font-bold">KM</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mb-1.5 block">Notes</label>
                <textarea rows={3} value={fuelNotes} onChange={e => setFuelNotes(e.target.value)} placeholder="Enter any additional details..." className="w-full px-3 py-2.5 bg-[var(--bg5)] border border-[var(--border)] rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition resize-none" />
              </div>
            </div>

            <div className="p-5 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg3)]">
              <button className="px-5 py-2.5 bg-[var(--bg4)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--t2)] hover:bg-[var(--bg5)] transition shadow-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-md shadow-orange-200" onClick={saveFuelEntry}>Save Entry</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
