import { useState } from 'react';
import { useApp } from '../../context/AppContext';

import { PageContainer } from '../../components/ui/PageContainer';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Activity, RefreshCw, Trash2, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  snapshots?: DiagSnapshot[];
  snapshot?: DiagSnapshot;
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
  const { cranes, diagnostics: diagRaw } = state;
  const diagnostics = diagRaw as Record<string, DiagRecord>;

  const [diagFilter, setDiagFilter] = useState<DiagFilter>('all');

  const gpsAssets = cranes.filter(c => !!(c as any).gpsId);
  const warnCount = gpsAssets.filter(c => diagnostics[c.reg]?.health === 'warning').length;
  const critCount = gpsAssets.filter(c => diagnostics[c.reg]?.health === 'critical').length;
  const goodCount = gpsAssets.filter(c => diagnostics[c.reg]?.health === 'good').length;

  const refreshAsset = (reg: string) => {
    const diag = simulateDiag(reg);
    setState(prev => ({ ...prev, diagnostics: { ...prev.diagnostics, [reg]: diag } }));
    save();
    showToast(`Diagnostics refreshed for ${reg}`);
  };

  const simulateAll = () => {
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
    if (!confirm('Delete all diagnostic history?')) return;
    setState(prev => ({ ...prev, diagnostics: {} }));
    save();
    showToast('Diagnostics cleared');
  };

  const filtered = gpsAssets.map(c => ({ crane: c, diag: diagnostics[c.reg] })).filter(item => {
    if (diagFilter === 'all') return true;
    const health = item.diag ? item.diag.health || 'offline' : 'offline';
    return health === diagFilter || (diagFilter === 'online' && health !== 'offline');
  });

  const filters: { id: DiagFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'online', label: 'Online' },
    { id: 'warning', label: 'Warning' },
    { id: 'critical', label: 'Critical' },
    { id: 'offline', label: 'Offline' },
  ];

  return (
    <PageContainer id="page-diagnostics" active={active} className="diagnostics-page">
      <div className="p-5 border-b border-[var(--border)] bg-gradient-to-b from-[var(--accent-s)] to-[var(--bg4)]">
        <PageHeader 
          title="Diagnostics" 
          subtitle="Real-time health monitoring"
          icon={<Activity size={20} />}
          iconBgClass="bg-purple-500 shadow-purple-100"
        >
          <button className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg4)] px-4 text-xs font-bold text-[var(--t1)] transition hover:bg-[var(--bg5)]" onClick={clearAll}>
            <Trash2 size={16} className="text-[var(--t4)]" />
            Clear All
          </button>
          <button className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent-solid)]" onClick={simulateAll}>
            <RefreshCw size={16} />
            Refresh All
          </button>
        </PageHeader>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Healthy Assets"
            value={`${goodCount}/${gpsAssets.length}`}
            colorClass="text-green-600"
            bgClass="bg-green-50"
          />
          <StatCard
            icon={<AlertCircle size={18} />}
            label="Warnings"
            value={warnCount}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Critical Faults"
            value={critCount}
            colorClass="text-red-600"
            bgClass="bg-red-50"
          />
        </div>
      </div>

      <div className="p-5 flex-1 bg-[var(--bg3)] overflow-y-auto">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setDiagFilter(f.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                diagFilter === f.id
                  ? 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm'
                  : 'bg-[var(--bg4)] text-[var(--t3)] border-[var(--border)] hover:border-purple-200 hover:text-purple-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {!gpsAssets.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">No GPS-linked assets found. Link assets in settings to enable diagnostics.</p>
            </div>
          ) : filtered.map(({ crane, diag }) => {
            const s = diag?.snapshot;
            const health = diag?.health || 'offline';
            const hColorClass = health === 'good' ? 'bg-green-50 text-green-600' 
                              : health === 'warning' ? 'bg-amber-50 text-amber-600' 
                              : health === 'critical' ? 'bg-red-50 text-red-600' 
                              : 'bg-[var(--bg5)] text-[var(--t3)]';
            const dotColorClass = health === 'good' ? 'bg-green-500' 
                              : health === 'warning' ? 'bg-amber-500' 
                              : health === 'critical' ? 'bg-red-500' 
                              : 'bg-[var(--t3)]';
            
            return (
              <article key={crane.reg} className="bg-[var(--bg4)] rounded-2xl p-5 border border-[var(--border)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col group">
                <header className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-base font-black text-[var(--t1)] truncate">{crane.reg}</h3>
                    <div className="text-[11px] font-medium text-[var(--t3)] truncate">{crane.make} {crane.model}</div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase ${hColorClass}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
                    {health}
                  </div>
                </header>

                {s ? (
                  <section className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 grid grid-cols-2 gap-3 mb-4 flex-1">
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Battery</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{s.battery?.toFixed(1)}V</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Engine Temp</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{s.engineTemp}°C</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">RPM</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{s.rpm?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Signal</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{s.signalStrength}%</div>
                    </div>
                  </section>
                ) : (
                  <div className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 mb-4 flex-1 flex items-center justify-center text-[var(--t4)] text-xs font-medium">
                    No live data available
                  </div>
                )}

                <footer className="mt-auto">
                  <button onClick={() => refreshAsset(crane.reg)} className="w-full h-10 bg-[var(--bg4)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--t1)] hover:bg-[var(--bg5)] transition active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                    <RefreshCw size={14} className="text-[var(--t4)]" />
                    Refresh Diagnostics
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
