import { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { VehicleCard } from './VehicleCard';
import { getExpiryStatus } from '../../utils';
import { api } from '../../services/api';
import type { TimesheetEntry, Crane, Operator } from '../../types';


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


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
  const [editModal, setEditModal] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | null>(null);
  const [assetForm, setAssetForm] = useState({ reg: '', type: '', make: '', model: '', capacity: '', year: '', rate: '', otRate: '', dailyLimit: '8', site: '' });
  const [showSite, _setShowSite] = useState(false); // Collapsible additional field
  const [opForm, setOpForm] = useState({ name: '', phone: '', license: '', aadhaar: '' });

  const [opPhoto, setOpPhoto] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);



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
      const newId = created.id || String(Date.now());
      const newOp: Operator = { id: newId, name, phone, license: opForm.license.trim(), aadhaar: opForm.aadhaar.trim(), status: 'active' };
      setState(prev => ({ ...prev, operators: [...prev.operators, newOp] }));
      // Save photo if uploaded
      if (opPhoto) {
        await api.updateOperatorProfile(newId, { photo: opPhoto });
      }
      showToast(`${name} added`);
      setOpModal(false);
      setOpForm({ name: '', phone: '', license: '', aadhaar: '' });
      setOpPhoto('');
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

  function handleEdit(reg: string) {
    const crane = state.cranes.find(c => c.reg === reg);
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
        ot_rate: editingCrane.otRate || 0,
        daily_limit: editingCrane.dailyLimit || 8,
        site: editingCrane.site || '',
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
    <div className={`page ${active ? 'active' : ''}`} id="page-fleet">
      {/* Redesigned Search & Action Bar */}
      <div className="fleet-toolbar">
        <div className="fleet-toolbar-title">Fleet Deployment</div>
        <div className="fleet-toolbar-actions">
          <div className="fleet-search">
            <svg className="fleet-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search assets, operators…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="fleet-btn secondary" onClick={() => setOpModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Add Operator
          </button>
          <button className="fleet-btn primary" onClick={() => setAssetModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Add Asset
          </button>
        </div>
      </div>

      {/* Redesigned Filter Tabs */}
      <div className="fleet-filters-wrap">
        <div className="fleet-filters">
          <button
            className={`fleet-pill${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Assets
          </button>
          <button
            className={`fleet-pill${filter === 'assigned' ? ' active' : ''}`}
            onClick={() => setFilter('assigned')}
          >
            Active
          </button>
          <button
            className={`fleet-pill${filter === 'unassigned' ? ' active' : ''}`}
            onClick={() => setFilter('unassigned')}
          >
            Standby
          </button>
          <button
            className={`fleet-pill${filter === 'alert' ? ' active' : ''}`}
            onClick={() => setFilter('alert')}
          >
            <span className="fleet-alert-dot" />
            Alerts
          </button>
        </div>
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
                onEdit={handleEdit}
              />
            );
          })
        )}
      </div>

      {/* Assign Operator Modal */}
      <Modal
        open={!!assignReg}
        onClose={() => setAssignReg(null)}
        title={`Assign Operator`}
        subtitle={`Assign an operator to ${assignReg}`}
        variant="add-operator"
        footer={
          <>
            <button className="btn-cancel" onClick={() => setAssignReg(null)}>Cancel</button>
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
                .filter(op => !state.cranes.some(c => c.operator === op.phone && c.reg !== assignReg))
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
            <div className="select-wrapper">
              <select
                className="field-input field-select"
                value={assetForm.type}
                onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="">Select Asset Type</option>
                <option>Crane</option>
                <option>Excavator</option>
                <option>Loader</option>
                <option>Digger</option>
              </select>
              <svg className="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
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

        {/* Site (collapsible) */}
        <div className="field-group" style={{ display: showSite ? undefined : 'none' }}>
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
                <div className="select-wrapper">
                  <select
                    className="field-input field-select"
                    value={editingCrane.type}
                    onChange={e => setEditingCrane({ ...editingCrane, type: e.target.value })}
                  >
                    <option value="">Select Asset Type</option>
                    <option>Crane</option>
                    <option>Excavator</option>
                    <option>Loader</option>
                    <option>Digger</option>
                  </select>
                  <svg className="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
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

            {/* Site (collapsible) */}
            <div className="field-group" style={{ display: showSite ? undefined : 'none' }}>
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
                    value={editingCrane.otRate || editingCrane.rate || 0}
                    onChange={e => setEditingCrane({ ...editingCrane, otRate: Number(e.target.value) })}
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
    </div>
  );
}
