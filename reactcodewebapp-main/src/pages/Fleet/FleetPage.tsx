import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { Modal } from '../../components/ui/Modal';
import { VehicleCard } from './VehicleCard';
import { getExpiryStatus } from '../../utils';
import { api } from '../../services/api';
import type { TimesheetEntry, Crane, Operator } from '../../types';


type FleetFilter = 'all' | 'assigned' | 'unassigned' | 'alert';

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
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [assignReg, setAssignReg] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState('');
  const [assetModal, setAssetModal] = useState(false);
  const [opModal, setOpModal] = useState(false);
  const [assetForm, setAssetForm] = useState({ reg: '', type: '', make: '', model: '', capacity: '', year: '', rate: '', otRate: '', dailyLimit: '8', site: '' });
  const [opForm, setOpForm] = useState({ name: '', phone: '', license: '', aadhaar: '' });



  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.cranes.filter(c => {
      const profile = state.operatorProfiles[c.operator || ''] || {};
      const profileName = (profile as { name?: string }).name || '';
      const ms = !q
        || c.reg.toLowerCase().includes(q)
        || (c.make || '').toLowerCase().includes(q)
        || (c.operator || '').includes(q)
        || profileName.toLowerCase().includes(q);

      const alerts = getComplianceAlerts(c.reg, state.compliance);
      const mf =
        filter === 'all' ? true
          : filter === 'assigned' ? !!c.operator
            : filter === 'unassigned' ? !c.operator
              : filter === 'alert' ? alerts.length > 0
                : true;
      return ms && mf;
    });
  }, [state.cranes, state.operatorProfiles, state.compliance, search, filter]);

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
      });
      const newCrane: Crane = {
        id: created.id || reg, reg, type: assetForm.type, make: assetForm.make.trim(), model: assetForm.model.trim(),
        capacity: assetForm.capacity.trim(), year: assetForm.year.trim(), rate: Number(assetForm.rate) || 0,
        otRate: Number(assetForm.otRate) || undefined, dailyLimit: Number(assetForm.dailyLimit) || 8,
        site: assetForm.site.trim(),
      };
      setState(prev => ({
        ...prev,
        cranes: [...prev.cranes, newCrane],
      }));
      save();
      showToast(`${reg} added`);
      setAssetModal(false);
      setAssetForm({ reg: '', type: '', make: '', model: '', capacity: '', year: '', rate: '', otRate: '', dailyLimit: '8', site: '' });
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
      const newOp: Operator = { id: created.id || String(Date.now()), name, phone, license: opForm.license.trim(), aadhaar: opForm.aadhaar.trim(), status: 'active' };
      setState(prev => ({ ...prev, operators: [...prev.operators, newOp] }));
      showToast(`${name} added`);
      setOpModal(false);
      setOpForm({ name: '', phone: '', license: '', aadhaar: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add operator', 'error');
    }
  }

  function handleAssign(reg: string) {
    const crane = state.cranes.find(c => c.reg === reg);
    if (!crane) return;
    setSelectedOp(crane.operator || '');
    setAssignReg(reg);
  }

  async function confirmAssign() {
    if (!assignReg) return;
    const crane = state.cranes.find(c => c.reg === assignReg);
    if (!crane) return;
    try {
      await api.updateCrane(crane.id, { operator: selectedOp || '' });
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.map(c =>
          c.reg === assignReg ? { ...c, operator: selectedOp } : c
        ),
      }));
      showToast(selectedOp ? `${assignReg} assigned to ${selectedOp}` : `${assignReg} returned to standby`, 'info');
      setAssignReg(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign', 'error');
    }
  }

  async function handleDelete(reg: string) {
    if (!confirm(`Delete asset ${reg}?`)) return;
    const crane = state.cranes.find(c => c.reg === reg);
    if (!crane) return;
    try {
      await api.deleteCrane(crane.id);
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.filter(c => c.reg !== reg),
      }));
      showToast(`${reg} deleted`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete asset', 'error');
    }
  }

  const filterPills: Array<{ key: FleetFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'assigned', label: 'Active' },
    { key: 'unassigned', label: 'Standby' },
    { key: 'alert', label: '⚠ Alerts' },
  ];

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-fleet">
      <div className="section-bar">
        <div className="section-title">Fleet Deployment</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search assets, operators…"
            id="fleet-search"
          />
          <button className="tb-btn accent" onClick={() => setAssetModal(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Asset
          </button>
          <button className="tb-btn accent" onClick={() => setOpModal(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Operator
          </button>
        </div>
      </div>

      <div className="filter-row" id="fleet-filters">
        {filterPills.map(pill => (
          <span
            key={pill.key}
            className={`fpill${filter === pill.key ? ' active' : ''}`}
            data-filter={pill.key}
            onClick={() => setFilter(pill.key)}
          >
            {pill.label}
          </span>
        ))}
      </div>

      <div id="fleet-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
              <path d="M2 20h20" />
              <path d="M10 4v16" />
              <path d="M10 4l8 4" />
              <path d="M18 8v12" />
            </svg>
            <h4>No Assets</h4>
            <p>Add assets or adjust filters</p>
          </div>
        ) : (
          filtered.map(crane => {
            const profile = state.operatorProfiles[crane.operator || ''] || {};
            const profileName = (profile as { name?: string }).name;
            const opTimesheets: TimesheetEntry[] = (crane.operator ? state.timesheets[crane.operator] : undefined) || [];
            const alerts = getComplianceAlerts(crane.reg, state.compliance);
            return (
              <VehicleCard
                key={crane.reg}
                crane={crane}
                timesheets={opTimesheets}
                operatorName={profileName}
                alerts={alerts}
                onAssign={handleAssign}
                onDelete={handleDelete}
              />
            );
          })
        )}
      </div>

      <Modal open={!!assignReg} onClose={() => setAssignReg(null)} title={`Assign Operator — ${assignReg}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="lbl">Select Operator</label>
          <select className="inp" value={selectedOp} onChange={e => setSelectedOp(e.target.value)}>
            <option value="">— Leave unassigned —</option>
            {state.operators.filter(op => !state.cranes.some(c => c.operator === op.phone && c.reg !== assignReg)).map(op => (
                <option key={op.id} value={op.phone}>
                  {op.name ? `${op.name} "${op.phone}"` : op.phone}
                </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={confirmAssign}>
              {selectedOp ? 'Assign' : 'Set Standby'}
            </button>
            <button className="btn-sm outline" onClick={() => setAssignReg(null)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Add Asset Modal */}
      <Modal open={assetModal} onClose={() => setAssetModal(false)} title="Add Fleet Asset">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label className="lbl">Registration *</label>
          <input
            className="inp"
            placeholder="e.g. MH12AB1234"
            value={assetForm.reg}
            onChange={e => {
              const v = e.target.value.toUpperCase();
              setAssetForm(f => ({ ...f, reg: v }));
            }}
          />
          <label className="lbl">Type</label>
          <input className="inp" placeholder="e.g. Crane, Excavator" value={assetForm.type} onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))} />
          <label className="lbl">Make</label>
          <input className="inp" placeholder="e.g. Liebherr" value={assetForm.make} onChange={e => setAssetForm(f => ({ ...f, make: e.target.value }))} />
          <label className="lbl">Model</label>
          <input className="inp" placeholder="e.g. LTM 1030" value={assetForm.model} onChange={e => setAssetForm(f => ({ ...f, model: e.target.value }))} />
          <label className="lbl">Capacity</label>
          <input className="inp" placeholder="e.g. 30T" value={assetForm.capacity} onChange={e => setAssetForm(f => ({ ...f, capacity: e.target.value }))} />
          <label className="lbl">Year</label>
          <input className="inp" placeholder="e.g. 2021" value={assetForm.year} onChange={e => setAssetForm(f => ({ ...f, year: e.target.value }))} />
          <label className="lbl">Rate (₹/hr)</label>
          <input className="inp" type="number" placeholder="e.g. 1500" value={assetForm.rate} onChange={e => setAssetForm(f => ({ ...f, rate: e.target.value }))} />
          <label className="lbl">OT Rate (₹/hr)</label>
          <input className="inp" type="number" placeholder="Leave blank = same as rate" value={assetForm.otRate} onChange={e => setAssetForm(f => ({ ...f, otRate: e.target.value }))} />
          <label className="lbl">Daily Limit (hrs)</label>
          <input className="inp" type="number" value={assetForm.dailyLimit} onChange={e => setAssetForm(f => ({ ...f, dailyLimit: e.target.value }))} />
          <label className="lbl">Site</label>
          <input className="inp" placeholder="Site/location" value={assetForm.site} onChange={e => setAssetForm(f => ({ ...f, site: e.target.value }))} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={handleAddAsset}>Deploy Asset</button>
            <button className="btn-sm outline" onClick={() => setAssetModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Add Operator Modal */}
      <Modal open={opModal} onClose={() => setOpModal(false)} title="Add Operator">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label className="lbl">Name *</label>
          <input className="inp" placeholder="Full name" value={opForm.name} onChange={e => setOpForm(f => ({ ...f, name: e.target.value }))} />
          <label className="lbl">Phone *</label>
          <input className="inp" placeholder="10-digit phone" value={opForm.phone} onChange={e => setOpForm(f => ({ ...f, phone: e.target.value }))} />
          <label className="lbl">License No.</label>
          <input className="inp" placeholder="DL number" value={opForm.license} onChange={e => setOpForm(f => ({ ...f, license: e.target.value }))} />
          <label className="lbl">Aadhaar No.</label>
          <input className="inp" placeholder="Aadhaar number" value={opForm.aadhaar} onChange={e => setOpForm(f => ({ ...f, aadhaar: e.target.value }))} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={handleAddOp}>Add Operator</button>
            <button className="btn-sm outline" onClick={() => setOpModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
