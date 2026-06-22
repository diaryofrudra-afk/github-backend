import { useDeferredValue, useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  AlertTriangle,
  Activity,
  PauseCircle,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { VehicleCard } from './VehicleCard';
import { LiveTrackModal } from './LiveTrackModal';
import { LogbookModal } from '../../components/LogbookModal';
import { useUnifiedGPS, type UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import { getExpiryStatus } from '../../utils';
import { api } from '../../services/api';
import type { Crane, Operator } from '../../types';


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

export function FleetPage({ active }: { active: boolean }) {
  const { state, setState, save, showToast } = useApp();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<FleetFilter>('all');

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
      const mf =
        filter === 'all' ? true
          : filter === 'assigned' ? !!c.operator
            : filter === 'unassigned' ? !c.operator
              : filter === 'alert' ? alerts.length > 0
                : true;
      return ms && mf;
    });
  }, [state.cranes, operatorNameByKey, complianceAlertsByReg, deferredSearch, filter]);

  const gpsMatchesByReg = useMemo(() => {
    const matches: Record<string, UnifiedVehicle> = {};
    gpsVehicles.forEach(v => {
      matches[normalizeRegistration(v.registration_number)] = v;
    });
    return matches;
  }, [gpsVehicles]);

  const assignedCount = state.cranes.filter(c => !!c.operator).length;
  const standbyCount = state.cranes.length - assignedCount;
  const alertCount = Object.values(complianceAlertsByReg).filter(alerts => alerts.length > 0).length;

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


  return (
    <div className={`page fleet-page ${active ? 'active' : ''}`} id="page-fleet">
      <div className="w-full">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-200 bg-gradient-to-b from-orange-50/50 to-white px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-100">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Fleet</h1>
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Asset Management</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-1">
                  {[
                    ['all', 'All', state.cranes.length],
                    ['assigned', 'Active', assignedCount],
                    ['unassigned', 'Standby', standbyCount],
                    ['alert', 'Alerts', alertCount],
                  ].map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key as FleetFilter)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                        filter === key
                          ? 'bg-white text-orange-600 shadow-sm border border-orange-100'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label} <span className={`ml-1 ${filter === key ? 'text-orange-400' : 'text-slate-400'}`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-64 items-center rounded-xl border border-slate-200 bg-white px-3 transition-focus-within focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-50">
                  <Search size={14} className="text-slate-400" />
                  <input
                    placeholder="Search registration, make..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ml-2 w-full border-none bg-transparent text-xs font-medium outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  onClick={() => setAssetModal(true)}
                  className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600 active:scale-95"
                >
                  <Plus size={16} />
                  Add Asset
                </button>
              </div>
            </div>

            {/* OPERATIONAL SNAPSHOT */}
            <div className="mt-5 bg-white rounded-xl border border-slate-200 flex overflow-x-auto shadow-sm">
              <div className="p-4 px-6 border-r border-slate-100 flex flex-col justify-center gap-0.5 min-w-[162px] flex-shrink-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity size={14} className="text-orange-500" />
                  <span className="text-[9.5px] font-extrabold text-orange-500 uppercase tracking-wide">
                    Live Status
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800 leading-tight">
                  Operational
                </p>
                <p className="text-sm font-extrabold text-slate-800 leading-tight">
                  Snapshot
                </p>
              </div>
              
              <div className="flex-1 p-4 px-6 border-r border-slate-100 flex items-center gap-3.5 min-w-[150px]">
                <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600">
                  <Truck size={20} />
                </div>
                <div>
                  <p className="text-[30px] font-extrabold text-slate-800 tracking-tighter leading-none">
                    {state.cranes.length}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
                    Total Assets
                  </p>
                </div>
              </div>

              <div className="flex-1 p-4 px-6 border-r border-slate-100 flex items-center gap-3.5 min-w-[150px]">
                <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 text-green-600">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-[30px] font-extrabold text-green-600 tracking-tighter leading-none">
                    {assignedCount}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
                    Currently Active
                  </p>
                </div>
              </div>

              <div className="flex-1 p-4 px-6 border-r border-slate-100 flex items-center gap-3.5 min-w-[150px]">
                <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-500">
                  <PauseCircle size={20} />
                </div>
                <div>
                  <p className="text-[30px] font-extrabold text-slate-800 tracking-tighter leading-none">
                    {standbyCount}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
                    On Standby
                  </p>
                </div>
              </div>

              <div className="flex-1 p-4 px-6 flex items-center gap-3.5 min-w-[150px]">
                <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[30px] font-extrabold text-slate-800 tracking-tighter leading-none">
                    {alertCount}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
                    Compliance Alerts
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50/30">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {filtered.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50">
                    <Truck size={20} className="text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No assets found</h3>
                  <p className="mt-1 text-xs text-slate-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                filtered.map((crane: Crane) => {
                  const profileName = operatorNameByKey[crane.operator || ''];
                  const alerts = complianceAlertsByReg[crane.reg] || [];
                  const gpsMatch = gpsMatchesByReg[normalizeRegistration(crane.reg)];
                  return (
                    <VehicleCard
                      key={crane.id}
                      crane={crane}
                      operatorName={profileName}
                      alerts={alerts}
                      gpsMatch={gpsMatch}
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
