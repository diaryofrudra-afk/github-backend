import { useDeferredValue, useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Truck,
  ChevronDown,
  ChevronUp,
  ArrowDownUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useMobileAppMode } from '../../hooks/useMobileAppMode';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { VehicleCard } from './VehicleCard';
import { LiveTrackModal } from './LiveTrackModal';
import { LogbookModal } from '../../components/LogbookModal';
import { useUnifiedGPS, type UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import { DoughnutChart } from '../../components/charts/DoughnutChart';
import { getExpiryStatus } from '../../utils';
import { api } from '../../services/api';
import type { Crane, Operator, TimesheetEntry } from '../../types';


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeRegistration(r?: string): string {
  return (r || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

type FleetFilter = 'all' | 'assigned' | 'unassigned' | 'alert';

const DEFAULT_ASSET_TYPES = ['Crane', 'Excavator', 'Loader', 'Digger'];

function getComplianceAlerts(reg: string, compliance: Record<string, { insurance?: { date: string }; fitness?: { date: string } }>): string[] {
  const c = compliance[reg] || {};
  const alerts: string[] = [];
  const items: Array<[string, { date: string } | undefined]> = [
    ['Insurance', c.insurance],
    ['Fitness', c.fitness],
  ];
  items.forEach(([label, v]) => {
    if (!v) return;
    const s = getExpiryStatus(v.date);
    if (s.c === 'expired') alerts.push(`${label} expired`);
    else if (s.c === 'warn') alerts.push(`${label}: ${s.l}`);
  });
  return alerts;
}

function getLatestLogbookEntry(crane: Crane, timesheets: Record<string, TimesheetEntry[]>): TimesheetEntry | undefined {
  if (!crane.operator) return undefined;
  const entries = timesheets[crane.operator] || [];
  return entries
    .filter(e => !e.crane_reg || e.crane_reg === crane.reg)
    .slice()
    .sort((a, b) => {
      const aStamp = `${a.date || ''}T${a.endTime || a.end_time || a.startTime || a.start_time || ''}`;
      const bStamp = `${b.date || ''}T${b.endTime || b.end_time || b.startTime || b.start_time || ''}`;
      return bStamp.localeCompare(aStamp);
    })[0];
}

function getLogbookEntryStamp(entry?: TimesheetEntry): string {
  if (!entry) return '';
  return `${entry.date || ''}T${entry.endTime || entry.end_time || entry.startTime || entry.start_time || ''}`;
}

function isVehicleEngineOn(vehicle?: UnifiedVehicle): boolean {
  return !!vehicle && !!(vehicle.engine_on ?? (vehicle.ignition === 'on'));
}

// Composite 0–100 fleet health score: penalise compliance alerts and low utilization.
function computeHealthScore(total: number, alerts: number, utilization: number): number {
  if (total === 0) return 100;
  const alertPenalty = Math.min(40, (alerts / total) * 100 * 0.6); // up to 40 pts
  const utilPenalty = utilization < 50 ? (50 - utilization) * 0.4 : 0; // up to 20 pts
  return Math.max(0, Math.round(100 - alertPenalty - utilPenalty));
}

// Read a CSS custom property off the document root (so chart colors follow the theme).
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function FleetPage({ active }: { active: boolean }) {
  const { state, setState, save, showToast, theme } = useApp();
  const isMobileApp = useMobileAppMode();
  const [fleetExpanded, setFleetExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [sortAlpha, setSortAlpha] = useState(false);

  const [assignCraneId, setAssignCraneId] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState('');
  const [assetModal, setAssetModal] = useState(false);
  const [opModal, setOpModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | null>(null);
  const [trackCrane, setTrackCrane] = useState<Crane | null>(null);
  const [logbookOpen, setLogbookOpen] = useState(false);
  const [logbookReg, setLogbookReg] = useState('');
  const [logbookOp, setLogbookOp] = useState('');
  const [assetForm, setAssetForm] = useState({ reg: '', type: '', make: '', model: '', capacity: '', year: '', rate: '', otRate: '', dailyLimit: '8', site: '', emi: '', fixedExpenses: '' });
  const [opForm, setOpForm] = useState({ name: '', phone: '', license: '', aadhaar: '' });
  const { vehicles: gpsVehicles } = useUnifiedGPS();

  const [opPhoto, setOpPhoto] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  const assignCrane = useMemo(
    () => state.cranes.find(c => c.id === assignCraneId) || null,
    [state.cranes, assignCraneId]
  );

  const assetTypes = useMemo(() => {
    const types = new Set(DEFAULT_ASSET_TYPES);
    state.cranes.forEach(c => {
      if (c.type?.trim()) types.add(c.type.trim());
    });
    if (editingCrane?.type?.trim()) types.add(editingCrane.type.trim());
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [editingCrane?.type, state.cranes]);

  const operatorNameByKey = useMemo(() => {
    const names: Record<string, string> = {};
    state.operators.forEach(op => {
      if (op.id) names[op.id] = op.name;
      if (op.phone) names[op.phone] = op.name;
    });
    Object.entries(state.operatorProfiles).forEach(([key, profile]) => {
      if (profile.name) names[key] = profile.name;
    });
    return names;
  }, [state.operators, state.operatorProfiles]);

  const complianceAlertsByReg = useMemo(() => {
    const alerts: Record<string, string[]> = {};
    state.cranes.forEach(c => {
      alerts[c.reg] = getComplianceAlerts(c.reg, state.compliance);
    });
    return alerts;
  }, [state.cranes, state.compliance]);

  const gpsMatchesByReg = useMemo(() => {
    const matches: Record<string, UnifiedVehicle> = {};
    gpsVehicles.forEach(v => {
      matches[normalizeRegistration(v.registration_number)] = v;
    });
    return matches;
  }, [gpsVehicles]);

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return state.cranes.filter(c => {
      const profileName = operatorNameByKey[c.operator || ''] || '';
      const ms = !q
        || c.reg.toLowerCase().includes(q)
        || (c.make || '').toLowerCase().includes(q)
        || (c.operator || '').includes(q)
        || profileName.toLowerCase().includes(q);

      const alerts = complianceAlertsByReg[c.reg] || [];
      const engineOn = isVehicleEngineOn(gpsMatchesByReg[normalizeRegistration(c.reg)]);
      const mf =
        filter === 'all' ? true
          : filter === 'assigned' ? engineOn        // Active Now → engine on
            : filter === 'unassigned' ? !engineOn   // Standby → engine off
              : filter === 'alert' ? alerts.length > 0
                : true;
      return ms && mf;
    });
  }, [state.cranes, operatorNameByKey, complianceAlertsByReg, gpsMatchesByReg, deferredSearch, filter]);

  const orderedFleet = useMemo(() => {
    return filtered
      .map(crane => {
        const gpsMatch = gpsMatchesByReg[normalizeRegistration(crane.reg)];
        const latestLogbookEntry = getLatestLogbookEntry(crane, state.timesheets);
        const priority = isVehicleEngineOn(gpsMatch) ? 0 : latestLogbookEntry ? 1 : 2;
        return {
          crane,
          gpsMatch,
          latestLogbookEntry,
          priority,
          logbookStamp: getLogbookEntryStamp(latestLogbookEntry),
        };
      })
      .sort((a, b) => {
        if (sortAlpha) return a.crane.reg.localeCompare(b.crane.reg);
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.priority === 1) return b.logbookStamp.localeCompare(a.logbookStamp);
        return a.crane.reg.localeCompare(b.crane.reg);
      });
  }, [filtered, gpsMatchesByReg, state.timesheets, sortAlpha]);

  const assignedCount = state.cranes.filter(
    c => isVehicleEngineOn(gpsMatchesByReg[normalizeRegistration(c.reg)])
  ).length;
  const standbyCount = state.cranes.length - assignedCount;
  const alertCount = Object.values(complianceAlertsByReg).filter(alerts => alerts.length > 0).length;

  // Hours-based fleet utilization over the last 30 days: logged timesheet hours / available capacity.
  const utilizationRate = useMemo(() => {
    const windowDays = 30;
    const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
    let totalHours = 0;
    let capacity = 0;
    state.cranes.forEach(c => {
      const limit = Number(c.dailyLimit ?? c.daily_limit ?? 8) || 8;
      capacity += limit * windowDays;
      const ts = state.timesheets[c.operator || ''] || [];
      ts.forEach(e => {
        const matchesCrane = e.crane_reg ? e.crane_reg === c.reg : true;
        if (matchesCrane && e.date >= cutoff) totalHours += Number(e.hoursDecimal) || 0;
      });
    });
    if (capacity <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((totalHours / capacity) * 100)));
  }, [state.cranes, state.timesheets]);

  const healthScore = useMemo(
    () => computeHealthScore(state.cranes.length, alertCount, utilizationRate),
    [state.cranes.length, alertCount, utilizationRate]
  );
  const healthTier = healthScore >= 85 ? 'good' : healthScore >= 60 ? 'warn' : 'bad';

  const kpis: Array<{ value: number; label: string; tone: string; dot: 'active' | 'standby' | 'alert' | null; key: FleetFilter }> = [
    { value: state.cranes.length, label: 'Total Assets', tone: 'default', dot: null, key: 'all' },
    { value: assignedCount, label: 'Active Now', tone: 'active', dot: 'active', key: 'assigned' },
    { value: standbyCount, label: 'Standby', tone: 'default', dot: 'standby', key: 'unassigned' },
    { value: alertCount, label: 'Alerts', tone: alertCount > 0 ? 'alert' : 'default', dot: alertCount > 0 ? 'alert' : 'standby', key: 'alert' },
  ];

  const renderKpi = (kpi: typeof kpis[number]) => (
    <button
      key={kpi.label}
      onClick={() => setFilter(kpi.key)}
      className={`fleet-kpi ${filter === kpi.key ? 'active' : ''}`}
      aria-pressed={filter === kpi.key}
    >
      <div className="fleet-kpi-head">
        {kpi.dot && <span className={`fleet-dot ${kpi.dot}`} />}
        <span className="fleet-kpi-label">{kpi.label}</span>
      </div>
      <div className={`fleet-kpi-value ${kpi.tone}`}>{kpi.value}</div>
    </button>
  );

  const donutData = useMemo(() => {
    void theme; // recompute colors when the theme switches
    return {
      labels: ['Active', 'Standby', 'Alerts'],
      datasets: [{
        data: [assignedCount, standbyCount, alertCount],
        backgroundColor: [
          cssVar('--green', '#34c759'),
          cssVar('--t3', '#8e8e93'),
          cssVar('--red', '#ff3b30'),
        ],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    };
  }, [assignedCount, standbyCount, alertCount, theme]);

  async function handleAddAsset() {
    const reg = assetForm.reg.trim().toUpperCase();
    if (!reg) return showToast('Registration ID required', 'error');
    if (state.cranes.find(c => c.reg === reg)) return showToast('Registration already exists', 'error');
    try {
      const created = await api.createCrane({
        reg, type: assetForm.type, make: assetForm.make.trim(), model: assetForm.model.trim(),
        capacity: assetForm.capacity.trim(), year: assetForm.year.trim(), rate: Number(assetForm.rate) || 0,
        otRate: Number(assetForm.otRate) || undefined, dailyLimit: Number(assetForm.dailyLimit) || 8,
        site: assetForm.site.trim(),
        emi: Number(assetForm.emi) || 0,
        fixedExpenses: Number(assetForm.fixedExpenses) || 0,
      });
      const newCrane: Crane = {
        id: created.id || reg, reg, type: assetForm.type, make: assetForm.make.trim(), model: assetForm.model.trim(),
        capacity: assetForm.capacity.trim(), year: assetForm.year.trim(), rate: Number(assetForm.rate) || 0,
        otRate: Number(assetForm.otRate) || undefined, dailyLimit: Number(assetForm.dailyLimit) || 8,
        site: assetForm.site.trim(),
        emi: Number(assetForm.emi) || 0,
        fixedExpenses: Number(assetForm.fixedExpenses) || 0,
      };
      setState(prev => ({
        ...prev,
        cranes: [...prev.cranes, newCrane],
      }));
      save();
      showToast(`${reg} added`);
      setAssetModal(false);
      setAssetForm({ reg: '', type: '', make: '', model: '', capacity: '', year: '', rate: '', otRate: '', dailyLimit: '8', site: '', emi: '', fixedExpenses: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add asset', 'error');
    }
  }

  async function handleAddOp() {
    const name = opForm.name.trim(), phone = opForm.phone.trim();
    if (!name) return showToast('Name required', 'error');
    if (!phone) return showToast('Phone required', 'error');
    if (state.operators.find(o => o.phone === phone)) return showToast('Phone already registered', 'error');
    try {
      const created = await api.createOperator({ name, phone, license: opForm.license.trim(), aadhaar: opForm.aadhaar.trim(), status: 'active' });
      const newId = created.id || String(Date.now());
      const newOp: Operator = { id: newId, name, phone, license: opForm.license.trim(), aadhaar: opForm.aadhaar.trim(), status: 'active' };
      // Save photo if uploaded
      let profilePhoto = '';
      if (opPhoto) {
        await api.updateOperatorProfile(newId, { photo: opPhoto });
        profilePhoto = opPhoto;
      }
      setState(prev => ({
        ...prev,
        operators: [...prev.operators, newOp],
        operatorProfiles: {
          ...prev.operatorProfiles,
          [phone]: { ...(prev.operatorProfiles[phone] || {}), name, photo: profilePhoto || prev.operatorProfiles[phone]?.photo },
          [newId]: { ...(prev.operatorProfiles[newId] || {}), name, photo: profilePhoto || prev.operatorProfiles[newId]?.photo },
        },
      }));
      showToast(`${name} added`);
      setOpModal(false);
      setOpForm({ name: '', phone: '', license: '', aadhaar: '' });
      setOpPhoto('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add operator', 'error');
    }
  }

  function handleAssign(id: string) {
    const crane = state.cranes.find(c => c.id === id);
    if (!crane) return;
    setSelectedOp(crane.operator || '');
    setAssignCraneId(id);
  }

  async function confirmAssign() {
    if (!assignCraneId) return;
    const crane = state.cranes.find(c => c.id === assignCraneId);
    if (!crane) return;
    try {
      await api.updateCrane(crane.id, { operator: selectedOp || '' });
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.map(c =>
          c.id === assignCraneId ? { ...c, operator: selectedOp } : c
        ),
      }));
      const selectedName = operatorNameByKey[selectedOp] || selectedOp;
      showToast(selectedOp ? `${crane.reg} assigned to ${selectedName}` : `${crane.reg} returned to standby`, 'info');
      setAssignCraneId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign', 'error');
    }
  }

  async function handleDelete(id: string) {
    const crane = state.cranes.find(c => c.id === id);
    if (!crane) return;
    if (!confirm(`Delete asset ${crane.reg}?`)) return;
    try {
      await api.deleteCrane(crane.id);
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.filter(c => c.id !== id),
      }));
      showToast(`${crane.reg} deleted`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete asset', 'error');
    }
  }

  function handleEdit(id: string) {
    const crane = state.cranes.find(c => c.id === id);
    if (!crane) return;
    setEditingCrane(crane);
    setEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editingCrane) return;
    const reg = editingCrane.reg.trim().toUpperCase();
    if (!reg) return showToast('Registration ID required', 'error');
    try {
      await api.updateCrane(editingCrane.id, {
        reg,
        type: editingCrane.type,
        make: editingCrane.make || '',
        model: editingCrane.model || '',
        capacity: editingCrane.capacity || '',
        year: editingCrane.year || '',
        rate: editingCrane.rate || 0,
        otRate: Number(editingCrane.otRate) > 0 ? editingCrane.otRate : undefined,
        dailyLimit: editingCrane.dailyLimit || 8,
        site: editingCrane.site || '',
        emi: Number(editingCrane.emi) || 0,
        fixedExpenses: Number(editingCrane.fixedExpenses) || 0,
      });
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.map(c =>
          c.id === editingCrane.id ? { ...editingCrane, reg } : c
        ),
      }));
      save();
      showToast(`${reg} updated`, 'success');
      setEditModal(false);
      setEditingCrane(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update asset', 'error');
    }
  }


  const listTitle: Record<FleetFilter, string> = {
    all: 'All Assets',
    assigned: 'Active Now',
    unassigned: 'On Standby',
    alert: 'Needs Attention',
  };
  const listCount = orderedFleet.length === state.cranes.length
    ? `${state.cranes.length} assets`
    : `${orderedFleet.length} of ${state.cranes.length}`;

  return (
    <div className={`page fleet-page ${active ? 'active' : ''}`} id="page-fleet">
      <div className="w-full fleet-cmd-wrap">
        {/* ── COMMAND CENTER ── */}
        {isMobileApp ? (
          <div className={`fleet-cmd fleet-cmd-mobile ${fleetExpanded ? 'expanded' : 'collapsed'}`}>
            {/* Hero row: title + expand toggle */}
            <div className="fleet-cmd-hero">
              <div className="fleet-cmd-titleblock">
                <div className="fleet-cmd-icon">
                  <Truck size={20} />
                </div>
                <div>
                  <h1 className="fleet-cmd-title">Fleet Overview</h1>
                  <p className="fleet-cmd-sub">Real-time operational intelligence</p>
                </div>
              </div>
              <button
                className="fleet-cmd-expand"
                onClick={() => setFleetExpanded(v => !v)}
                aria-expanded={fleetExpanded}
                aria-label={fleetExpanded ? 'Collapse fleet summary' : 'Expand fleet summary'}
              >
                {fleetExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Search — always reachable without expanding */}
            <div className="fleet-cmd-search">
              <Search size={14} />
              <input
                placeholder="Search registration, make..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Always visible: Total Assets + Active Now */}
            <div className="fleet-kpis fleet-kpis-primary">
              {kpis.slice(0, 2).map(renderKpi)}
            </div>

            {fleetExpanded && (
              <>
                <div className="fleet-kpis fleet-kpis-secondary">
                  {kpis.slice(2).map(renderKpi)}
                </div>

                <div className="fleet-cmd-aside">
                  <div className="fleet-donut">
                    <DoughnutChart
                      data={donutData}
                      options={{ cutout: '72%', plugins: { legend: { display: false } } }}
                    />
                    <div className="fleet-donut-center">
                      <span className="fleet-donut-num">{state.cranes.length}</span>
                      <span className="fleet-donut-cap">Assets</span>
                    </div>
                  </div>
                  <div className={`fleet-health ${healthTier}`}>
                    <span className="fleet-health-score">
                      {healthScore}
                      <span className="fleet-health-max">/100</span>
                    </span>
                    <span className="fleet-health-label">Fleet Health</span>
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="fleet-util">
                  <div className="fleet-util-head">
                    <span className="fleet-util-title">Fleet Utilization</span>
                    <span className="fleet-util-pct">{utilizationRate}%</span>
                  </div>
                  <div className="fleet-util-track">
                    <div className="fleet-util-fill" style={{ width: `${utilizationRate}%` }} />
                  </div>
                  <p className="fleet-util-note">Logged operating hours vs. available capacity · last 30 days</p>
                </div>

                {/* Add Asset */}
                <button className="fleet-cmd-add" onClick={() => setAssetModal(true)}>
                  <Plus size={16} />
                  Add Asset
                </button>
              </>
            )}
          </div>
        ) : (
        <div className="fleet-cmd">
          {/* Hero row */}
          <div className="fleet-cmd-hero">
            <div className="fleet-cmd-titleblock">
              <div className="fleet-cmd-icon">
                <Truck size={20} />
              </div>
              <div>
                <h1 className="fleet-cmd-title">Fleet Overview</h1>
                <p className="fleet-cmd-sub">Real-time operational intelligence</p>
              </div>
            </div>

            <div className="fleet-cmd-actions">
              <div className="fleet-cmd-search">
                <Search size={14} />
                <input
                  placeholder="Search registration, make..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="fleet-cmd-add" onClick={() => setAssetModal(true)}>
                <Plus size={16} />
                Add Asset
              </button>
            </div>
          </div>

          {/* KPI cluster (clickable filters) + distribution donut */}
          <div className="fleet-cmd-body">
            <div className="fleet-kpis">
              {kpis.map(renderKpi)}
            </div>

            <div className="fleet-cmd-aside">
              <div className="fleet-donut">
                <DoughnutChart
                  data={donutData}
                  options={{ cutout: '72%', plugins: { legend: { display: false } } }}
                />
                <div className="fleet-donut-center">
                  <span className="fleet-donut-num">{state.cranes.length}</span>
                  <span className="fleet-donut-cap">Assets</span>
                </div>
              </div>
              <div className={`fleet-health ${healthTier}`}>
                <span className="fleet-health-score">
                  {healthScore}
                  <span className="fleet-health-max">/100</span>
                </span>
                <span className="fleet-health-label">Fleet Health</span>
              </div>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="fleet-util">
            <div className="fleet-util-head">
              <span className="fleet-util-title">Fleet Utilization</span>
              <span className="fleet-util-pct">{utilizationRate}%</span>
            </div>
            <div className="fleet-util-track">
              <div className="fleet-util-fill" style={{ width: `${utilizationRate}%` }} />
            </div>
            <p className="fleet-util-note">Logged operating hours vs. available capacity · last 30 days</p>
          </div>
        </div>
        )}

        {/* ── LIST HEADER ── */}
        <div className="fleet-list-header">
          <div className="fleet-list-headline">
            <span className="fleet-list-title">{listTitle[filter]}</span>
            <span className="fleet-list-count">{listCount}</span>
          </div>
          <button
            className={`fleet-sort-btn${sortAlpha ? ' active' : ''}`}
            onClick={() => setSortAlpha((v) => !v)}
            aria-pressed={sortAlpha}
            title={sortAlpha ? 'Sorted A–Z · tap for default' : 'Sort A–Z'}
          >
            <ArrowDownUp size={14} />
            Sort
          </button>
        </div>

        {/* ── ASSET GRID ── */}
        <div className="fleet-grid-wrap">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {orderedFleet.length === 0 ? (
                <div className="fleet-empty col-span-full">
                  <div className="fleet-empty-icon">
                    <Truck size={20} />
                  </div>
                  <h3 className="fleet-empty-title">No assets found</h3>
                  <p className="fleet-empty-sub">Try adjusting your search or filters</p>
                </div>
              ) : (
                orderedFleet.map(({ crane, gpsMatch, latestLogbookEntry }) => {
                  const profileName = operatorNameByKey[crane.operator || ''];
                  const alerts = complianceAlertsByReg[crane.reg] || [];
                  return (
                    <VehicleCard
                      key={crane.id}
                      crane={crane}
                      compact={isMobileApp}
                      operatorName={profileName}
                      alerts={alerts}
                      gpsMatch={gpsMatch}
                      latestLogbookEntry={latestLogbookEntry}
                      onAssign={handleAssign}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onViewLogbook={(reg, opKey) => {
                        setLogbookReg(reg);
                        setLogbookOp(opKey);
                        setLogbookOpen(true);
                      }}
                      onLiveTrack={(c) => setTrackCrane(c)}
                    />
                  );
                })
              )}
            </div>
        </div>
      </div>

      {/* Assign Operator Modal */}
      <Modal
        open={!!assignCraneId}
        onClose={() => setAssignCraneId(null)}
        title={`Assign Operator`}
        subtitle={`Assign an operator to ${assignCrane?.reg || ''}`}
        variant="add-operator"
        footer={
          <>
            <button className="btn-cancel" onClick={() => setAssignCraneId(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirmAssign} disabled={!selectedOp && selectedOp !== ''}>
              {selectedOp ? 'Assign Operator' : 'Set Standby'}
            </button>
          </>
        }
      >
        {/* Operator Selection */}
        <div className="field-group">
          <label className="field-label">
            Operator <span className="required">*</span>
          </label>
          <div className="select-wrapper">
            <select
              className="field-input field-select"
              value={selectedOp}
              onChange={e => setSelectedOp(e.target.value)}
            >
              <option value="">Select an operator</option>
              {state.operators
                .filter(op => !state.cranes.some(c => c.operator === op.phone && c.id !== assignCraneId))
                .map(op => (
                  <option key={op.id} value={op.phone}>
                    {op.name ? `${op.name} — ${op.phone}` : op.phone}
                  </option>
                ))}
            </select>
            <svg className="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Info Note */}
        <div className="security-note">
          <span className="security-note-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <p>
            Select an operator to assign to this asset. Leave unassigned to return the asset to standby status. An operator can only be assigned to one asset at a time.
          </p>
        </div>
      </Modal>

      {/* Add Asset Modal */}
      <Modal
        open={assetModal}
        onClose={() => setAssetModal(false)}
        title="Add Fleet Asset"
        variant="add-asset"
        subtitle="Register a new machine to your fleet inventory"
        footer={
          <>
            <button className="btn-cancel" onClick={() => setAssetModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddAsset} disabled={!assetForm.reg.trim() || !assetForm.type || !assetForm.make}>
              Add Asset
            </button>
          </>
        }
      >
        {/* Main Fields - Two Column Grid */}
        <div className="field-row">
          {/* Registration */}
          <div className="field-group">
            <label className="field-label">
              Registration <span className="required">*</span>
            </label>
            <input
              className="field-input"
              placeholder="e.g., MH12AB1234"
              value={assetForm.reg}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setAssetForm(f => ({ ...f, reg: v }));
              }}
            />
          </div>

          {/* Type */}
          <div className="field-group">
            <label className="field-label">
              Type <span className="required">*</span>
            </label>
            <input
              className="field-input"
              list="fleet-asset-types"
              placeholder="Select or enter asset type"
              value={assetForm.type}
              onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}
            />
            <datalist id="fleet-asset-types">
              {assetTypes.map(type => <option key={type} value={type} />)}
            </datalist>
          </div>
        </div>

        <div className="field-row">
          {/* Make */}
          <div className="field-group">
            <label className="field-label">
              Make <span className="required">*</span>
            </label>
            <input
              className="field-input"
              placeholder="e.g., Liebherr"
              value={assetForm.make}
              onChange={e => setAssetForm(f => ({ ...f, make: e.target.value }))}
            />
          </div>

          {/* Model */}
          <div className="field-group">
            <label className="field-label">
              Model <span className="required">*</span>
            </label>
            <input
              className="field-input"
              placeholder="e.g., LTM 1030"
              value={assetForm.model}
              onChange={e => setAssetForm(f => ({ ...f, model: e.target.value }))}
            />
          </div>
        </div>

        <div className="field-row">
          {/* Capacity */}
          <div className="field-group">
            <label className="field-label">
              Capacity <span className="required">*</span>
            </label>
            <div className="input-suffix-group">
              <input
                className="field-input field-input-suffix"
                placeholder="e.g., 30"
                type="text"
                value={assetForm.capacity}
                onChange={e => setAssetForm(f => ({ ...f, capacity: e.target.value.replace(/[^0-9.]/g, '') }))}
              />
              <span className="input-suffix">T</span>
            </div>
          </div>

          {/* Year */}
          <div className="field-group">
            <label className="field-label">
              Year <span className="required">*</span>
            </label>
            <input
              className="field-input"
              placeholder="2021"
              type="number"
              value={assetForm.year}
              onChange={e => setAssetForm(f => ({ ...f, year: e.target.value }))}
            />
          </div>
        </div>

        {/* Site */}
        <div className="field-group">
          <label className="field-label">
            Site <span className="optional">(Optional)</span>
          </label>
          <input
            className="field-input"
            placeholder="Site/location"
            value={assetForm.site}
            onChange={e => setAssetForm(f => ({ ...f, site: e.target.value }))}
          />
        </div>

        {/* Pricing & Operations Section */}
        <div className="section-divider">
          <h3 className="section-divider-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            Pricing &amp; Operations
          </h3>
          <div className="field-row field-row-3col">
            {/* Rate */}
            <div className="field-group">
              <label className="field-label field-label-compact">
                Rate (₹/HR) <span className="required">*</span>
              </label>
              <input
                className="field-input"
                placeholder="0.00"
                type="number"
                value={assetForm.rate}
                onChange={e => setAssetForm(f => ({ ...f, rate: e.target.value }))}
              />
            </div>

            {/* OT Rate */}
            <div className="field-group">
              <label className="field-label field-label-compact">
                OT Rate (₹/HR) <span className="optional">(Optional)</span>
              </label>
              <input
                className="field-input"
                placeholder="0.00"
                type="number"
                value={assetForm.otRate}
                onChange={e => setAssetForm(f => ({ ...f, otRate: e.target.value }))}
              />
            </div>

            {/* Daily Limit */}
            <div className="field-group">
              <label className="field-label field-label-compact">
                Daily Limit (HRS) <span className="optional">(Optional)</span>
              </label>
              <input
                className="field-input"
                placeholder="8"
                type="number"
                value={assetForm.dailyLimit}
                onChange={e => setAssetForm(f => ({ ...f, dailyLimit: e.target.value }))}
              />
            </div>
          </div>

          <div className="field-row field-row-2col" style={{ marginTop: '12px' }}>
            {/* Monthly EMI */}
            <div className="field-group">
              <label className="field-label field-label-compact">
                Monthly EMI (₹) <span className="optional">(Optional)</span>
              </label>
              <input
                className="field-input"
                placeholder="0.00"
                type="number"
                value={assetForm.emi}
                onChange={e => setAssetForm(f => ({ ...f, emi: e.target.value }))}
              />
            </div>

            {/* Monthly Fixed Expenses */}
            <div className="field-group">
              <label className="field-label field-label-compact">
                Monthly Fixed Expenses (₹) <span className="optional">(Optional)</span>
              </label>
              <input
                className="field-input"
                placeholder="0.00"
                type="number"
                value={assetForm.fixedExpenses}
                onChange={e => setAssetForm(f => ({ ...f, fixedExpenses: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Additional Note */}
        <div className="security-note">
          <span className="security-note-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <p>
            Ensure all technical specifications match the asset's registration certificate. Operators will be assigned to this asset via the Operators dashboard.
          </p>
        </div>
      </Modal>

      {/* Add Operator Modal */}
      <Modal
        open={opModal}
        onClose={() => setOpModal(false)}
        title="Add Operator"
        variant="add-operator"
        footer={
          <>
            <button className="btn-cancel" onClick={() => { setOpModal(false); setOpPhoto(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleAddOp} disabled={!opForm.name.trim() || !opForm.phone.trim()}>
              Add Operator
            </button>
          </>
        }
      >
        {/* Photo + Name Row */}
        <div className="operator-photo-row">
          {/* Photo Upload */}
          <div className="operator-photo-upload">
            <div className="operator-photo-circle" onClick={() => photoRef.current?.click()}>
              {opPhoto ? (
                <img src={opPhoto} alt="Operator" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
            {opPhoto && (
              <button className="operator-photo-edit-btn" type="button" onClick={() => photoRef.current?.click()} title="Change photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {!opPhoto && (
              <button className="operator-photo-edit-btn" type="button" onClick={() => photoRef.current?.click()} title="Upload photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) return showToast('Image must be under 5 MB', 'error');
              const base64 = await fileToBase64(file);
              setCropSrc(base64);
              e.target.value = '';
            }} />
          </div>

          {/* Name Field */}
          <div className="operator-photo-name">
            <div className="field-group">
              <label className="field-label">
                Name <span className="required">*</span>
              </label>
              <input
                className="field-input"
                placeholder="Full name"
                value={opForm.name}
                onChange={e => setOpForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Phone Field */}
        <div className="field-group">
          <label className="field-label">
            Phone <span className="required">*</span>
          </label>
          <div className="phone-input-group">
            <span className="phone-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <input
              className="field-input"
              placeholder="10-digit phone number"
              value={opForm.phone}
              onChange={e => setOpForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        {/* Optional Fields Row */}
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">
              License No. <span className="optional">(Optional)</span>
            </label>
            <input
              className="field-input"
              placeholder="Driving license number"
              value={opForm.license}
              onChange={e => setOpForm(f => ({ ...f, license: e.target.value }))}
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              Aadhaar No. <span className="optional">(Optional)</span>
            </label>
            <input
              className="field-input"
              placeholder="12-digit Aadhaar number"
              value={opForm.aadhaar}
              onChange={e => setOpForm(f => ({ ...f, aadhaar: e.target.value }))}
            />
          </div>
        </div>

        {/* Security Info Note */}
        <div className="security-note">
          <span className="security-note-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <p>
            Personal information provided here will be stored securely and used only for operational verification and regulatory compliance.
          </p>
        </div>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal
        open={editModal}
        onClose={() => { setEditModal(false); setEditingCrane(null); }}
        title={`Edit Asset — ${editingCrane?.reg || ''}`}
        subtitle="Update asset details and specifications"
        variant="add-asset"
        footer={
          <>
            <button className="btn-cancel" onClick={() => { setEditModal(false); setEditingCrane(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={!editingCrane?.reg.trim()}>
              Save Changes
            </button>
          </>
        }
      >
        {editingCrane && (
          <>
            {/* Main Fields - Two Column Grid */}
            <div className="field-row">
              {/* Registration */}
              <div className="field-group">
                <label className="field-label">
                  Registration <span className="required">*</span>
                </label>
                <input
                  className="field-input"
                  placeholder="e.g., MH12AB1234"
                  value={editingCrane.reg}
                  onChange={e => setEditingCrane({ ...editingCrane, reg: e.target.value.toUpperCase() })}
                />
              </div>

              {/* Type */}
              <div className="field-group">
                <label className="field-label">
                  Type <span className="required">*</span>
                </label>
                <input
                  className="field-input"
                  list="fleet-edit-asset-types"
                  placeholder="Select or enter asset type"
                  value={editingCrane.type}
                  onChange={e => setEditingCrane({ ...editingCrane, type: e.target.value })}
                />
                <datalist id="fleet-edit-asset-types">
                  {assetTypes.map(type => <option key={type} value={type} />)}
                </datalist>
              </div>
            </div>

            <div className="field-row">
              {/* Make */}
              <div className="field-group">
                <label className="field-label">
                  Make <span className="required">*</span>
                </label>
                <input
                  className="field-input"
                  placeholder="e.g., Liebherr"
                  value={editingCrane.make || ''}
                  onChange={e => setEditingCrane({ ...editingCrane, make: e.target.value })}
                />
              </div>

              {/* Model */}
              <div className="field-group">
                <label className="field-label">
                  Model <span className="required">*</span>
                </label>
                <input
                  className="field-input"
                  placeholder="e.g., LTM 1030"
                  value={editingCrane.model || ''}
                  onChange={e => setEditingCrane({ ...editingCrane, model: e.target.value })}
                />
              </div>
            </div>

            <div className="field-row">
              {/* Capacity */}
              <div className="field-group">
                <label className="field-label">
                  Capacity <span className="required">*</span>
                </label>
                <div className="input-suffix-group">
                  <input
                    className="field-input field-input-suffix"
                    placeholder="e.g., 30"
                    value={editingCrane.capacity || ''}
                    onChange={e => setEditingCrane({ ...editingCrane, capacity: e.target.value.replace(/[^0-9.]/g, '') })}
                  />
                  <span className="input-suffix">T</span>
                </div>
              </div>

              {/* Year */}
              <div className="field-group">
                <label className="field-label">
                  Year <span className="required">*</span>
                </label>
                <input
                  className="field-input"
                  placeholder="2021"
                  type="number"
                  value={editingCrane.year || ''}
                  onChange={e => setEditingCrane({ ...editingCrane, year: e.target.value })}
                />
              </div>
            </div>

            {/* Site */}
            <div className="field-group">
              <label className="field-label">
                Site <span className="optional">(Optional)</span>
              </label>
              <input
                className="field-input"
                placeholder="Site/location"
                value={editingCrane.site || ''}
                onChange={e => setEditingCrane({ ...editingCrane, site: e.target.value })}
              />
            </div>

            {/* Pricing & Operations Section */}
            <div className="section-divider">
              <h3 className="section-divider-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                Pricing &amp; Operations
              </h3>
              <div className="field-row field-row-3col">
                {/* Rate */}
                <div className="field-group">
                  <label className="field-label field-label-compact">
                    Rate (₹/HR) <span className="required">*</span>
                  </label>
                  <input
                    className="field-input"
                    placeholder="0.00"
                    type="number"
                    value={editingCrane.rate || 0}
                    onChange={e => setEditingCrane({ ...editingCrane, rate: Number(e.target.value) })}
                  />
                </div>

                {/* OT Rate */}
                <div className="field-group">
                  <label className="field-label field-label-compact">
                    OT Rate (₹/HR) <span className="optional">(Optional)</span>
                  </label>
                  <input
                    className="field-input"
                    placeholder="0.00"
                    type="number"
                    value={editingCrane.otRate ?? ''}
                    onChange={e => setEditingCrane({ ...editingCrane, otRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>

                {/* Daily Limit */}
                <div className="field-group">
                  <label className="field-label field-label-compact">
                    Daily Limit (HRS) <span className="optional">(Optional)</span>
                  </label>
                  <input
                    className="field-input"
                    placeholder="8"
                    type="number"
                    value={editingCrane.dailyLimit || 8}
                    onChange={e => setEditingCrane({ ...editingCrane, dailyLimit: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="field-row field-row-2col" style={{ marginTop: '12px' }}>
                {/* Monthly EMI */}
                <div className="field-group">
                  <label className="field-label field-label-compact">
                    Monthly EMI (₹) <span className="optional">(Optional)</span>
                  </label>
                  <input
                    className="field-input"
                    placeholder="0.00"
                    type="number"
                    value={editingCrane.emi ?? ''}
                    onChange={e => setEditingCrane({ ...editingCrane, emi: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>

                {/* Monthly Fixed Expenses */}
                <div className="field-group">
                  <label className="field-label field-label-compact">
                    Monthly Fixed Expenses (₹) <span className="optional">(Optional)</span>
                  </label>
                  <input
                    className="field-input"
                    placeholder="0.00"
                    type="number"
                    value={editingCrane.fixedExpenses ?? ''}
                    onChange={e => setEditingCrane({ ...editingCrane, fixedExpenses: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Additional Note */}
            <div className="security-note">
              <span className="security-note-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <p>
                Ensure all technical specifications match the asset's registration certificate. Operators will be assigned to this asset via the Operators dashboard.
              </p>
            </div>
          </>
        )}
      </Modal>

      {/* Image Cropper Modal */}
      <Modal open={!!cropSrc} onClose={() => setCropSrc('')} title="Adjust Photo">
        {cropSrc && (
          <ImageCropper
            src={cropSrc}
            onCrop={(cropped) => { setOpPhoto(cropped); setCropSrc(''); }}
            onCancel={() => setCropSrc('')}
          />
        )}
      </Modal>

      {logbookOpen && (
        <LogbookModal
          open={logbookOpen}
          onClose={() => setLogbookOpen(false)}
          craneReg={logbookReg}
          operatorKey={logbookOp}
        />
      )}

      <LiveTrackModal
        open={!!trackCrane}
        onClose={() => setTrackCrane(null)}
        crane={trackCrane}
        vehicle={trackCrane ? gpsMatchesByReg[normalizeRegistration(trackCrane.reg)] : undefined}
      />
    </div>
  );
}
