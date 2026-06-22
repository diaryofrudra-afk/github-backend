import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { Modal } from '../../components/ui/Modal';
import { fmtINR, fmtHours, calcBill, getExpiryStatus } from '../../utils';
import { api } from '../../services/api';
import type { Crane, TimesheetEntry } from '../../types';


function getAccHrs(entries: TimesheetEntry[], date: string, startTime: string): number {
  return entries
    .filter(e => e.date === date && e.startTime < startTime)
    .reduce((s, e) => s + (Number(e.hoursDecimal) || 0), 0);
}

function getComplianceAlerts(
  reg: string,
  compliance: Record<string, { insurance?: { date: string }; fitness?: { date: string } }>
): string[] {
  const c = compliance[reg] || {};
  const alerts: string[] = [];
  ([['Insurance', c.insurance], ['Fitness', c.fitness]] as Array<[string, { date: string } | undefined]>).forEach(([label, v]) => {
    if (!v) return;
    const s = getExpiryStatus(v.date);
    if (s.c === 'expired') alerts.push(`${label} expired`);
    else if (s.c === 'warn') alerts.push(`${label}: ${s.l}`);
  });
  return alerts;
}

const BLANK_FORM = {
  reg: '', type: '', make: '', model: '', capacity: '', year: '',
  rate: '', otRate: '', dailyLimit: '8', operator: '', site: '', notes: '',
};

export function AssetsPage({ active }: { active: boolean }) {
  const { state, setState, save, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editReg, setEditReg] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [assignReg, setAssignReg] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState('');



  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.cranes.filter(c =>
      !q
      || c.reg.toLowerCase().includes(q)
      || (c.make || '').toLowerCase().includes(q)
      || (c.model || '').toLowerCase().includes(q)
      || (c.operator || '').includes(q)
    );
  }, [state.cranes, search]);

  function openAdd() {
    setForm({ ...BLANK_FORM });
    setEditReg(null);
    setModalOpen(true);
  }

  function openEdit(reg: string) {
    const c = state.cranes.find(x => x.reg === reg);
    if (!c) return;
    setForm({
      reg: c.reg,
      type: c.type || '',
      make: c.make || '',
      model: c.model || '',
      capacity: c.capacity || '',
      year: c.year || '',
      rate: String(c.rate || ''),
      otRate: String(c.otRate || ''),
      dailyLimit: String(c.dailyLimit || 8),
      operator: c.operator || '',
      site: c.site || '',
      notes: c.notes || '',
    });
    setEditReg(reg);
    setModalOpen(true);
  }

  async function handleSave() {
    const reg = form.reg.trim().toUpperCase();
    if (!reg) return showToast('Registration ID required', 'error');

    const craneData: Crane = {
      id: editReg || reg,
      reg,
      type: form.type,
      make: form.make.trim(),
      model: form.model.trim(),
      capacity: form.capacity.trim(),
      year: form.year.trim(),
      rate: Number(form.rate) || 0,
      otRate: Number(form.otRate) || undefined,
      dailyLimit: Number(form.dailyLimit) || 8,
      operator: form.operator || '',
      site: form.site.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editReg) {
        const existing = state.cranes.find(c => c.reg === editReg);
        if (existing) await api.updateCrane(existing.id, craneData);
        setState(prev => ({
          ...prev,
          cranes: prev.cranes.map(c => c.reg === editReg ? { ...c, ...craneData } : c),
        }));
        showToast(`${reg} updated`);
      } else {
        if (state.cranes.find(c => c.reg === reg)) return showToast('Registration already exists', 'error');
        const created = await api.createCrane(craneData);
        craneData.id = created.id || reg;

        setState(prev => ({
          ...prev,
          cranes: [...prev.cranes, craneData],
        }));
        showToast(`${reg} added`);
      }
      save();
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save asset', 'error');
    }
  }

  async function handleDelete(reg: string) {
    if (!confirm(`Delete asset ${reg}?`)) return;
    const crane = state.cranes.find(c => c.reg === reg);
    if (!crane) return;
    try {
      await api.deleteCrane(crane.id);
      setState(prev => ({ ...prev, cranes: prev.cranes.filter(c => c.reg !== reg) }));
      showToast(`${reg} deleted`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete asset', 'error');
    }
  }

  function openAssign(reg: string) {
    const crane = state.cranes.find(c => c.reg === reg);
    setSelectedOp(crane?.operator || '');
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
      showToast(selectedOp ? `${assignReg} assigned` : `${assignReg} set to standby`, 'info');
      setAssignReg(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign', 'error');
    }
  }

  function f(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-assets">
      <div className="section-bar" style={{ marginBottom: '16px' }}>
        <div className="section-title">Assets</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search registration, make…" id="assets-search" />
          <button className="tb-btn accent" onClick={openAdd}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Asset
          </button>
        </div>
      </div>

      <div id="assets-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            <h4>No Assets</h4>
            <p>{search ? 'No matches found' : 'Add your first asset to get started'}</p>
          </div>
        ) : (
          filtered.map(crane => {
            const op = crane.operator;
            const profile = state.operatorProfiles[op || ''] || {};
            const profileName = (profile as { name?: string }).name;
            const opTs: TimesheetEntry[] = (op ? state.timesheets[op] : undefined) || [];
            const alerts = getComplianceAlerts(crane.reg, state.compliance);
            let totHrs = 0, totRev = 0;
            opTs.forEach(e => {
              const h = Number(e.hoursDecimal) || 0;
              const b = calcBill(h, crane, getAccHrs(opTs, e.date, e.startTime));
              totHrs += h;
              if (b) totRev += b.total;
            });
            return (
              <div key={crane.reg} className="asset-row">
                <div className="asset-row-info">
                  <div className="asset-row-reg">{crane.reg}</div>
                  <div className="asset-row-spec">
                    {[crane.year, crane.make, crane.model, crane.capacity].filter(Boolean).join(' · ') || 'No specs set'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {op
                      ? <span className="badge accent">{profileName || op}</span>
                      : <span className="badge">Standby</span>
                    }
                    {crane.rate ? <span className="badge amber">₹{Number(crane.rate).toLocaleString('en-IN')}/hr</span> : null}
                    {opTs.length > 0 && <span className="badge">{opTs.length} logs · {fmtHours(totHrs)}</span>}
                    {totRev > 0 && <span className="badge green">{fmtINR(totRev)}</span>}
                    {alerts.length > 0 && <span className="badge red">⚠ {alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="asset-row-right">
                  <button className="ca-btn c-amb ar-edit" title="Edit" onClick={() => openEdit(crane.reg)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!op && (
                    <button className="ca-btn c-acc" title="Assign Operator" onClick={() => openAssign(crane.reg)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </button>
                  )}
                  <button className="ca-btn c-red ar-del" title="Delete" onClick={() => handleDelete(crane.reg)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editReg ? `Edit — ${editReg}` : 'Add Fleet Asset'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label className="lbl">Registration *</label>
          <input
            className="inp"
            placeholder="e.g. MH12AB1234"
            value={form.reg}
            disabled={!!editReg}
            onChange={e => {
              const v = e.target.value.toUpperCase();
              f('reg', v);
            }}
          />
          <label className="lbl">Type</label>
          <input className="inp" placeholder="e.g. Crane, Excavator" value={form.type} onChange={e => f('type', e.target.value)} />
          <label className="lbl">Make</label>
          <input className="inp" placeholder="e.g. Liebherr" value={form.make} onChange={e => f('make', e.target.value)} />
          <label className="lbl">Model</label>
          <input className="inp" placeholder="e.g. LTM 1030" value={form.model} onChange={e => f('model', e.target.value)} />
          <label className="lbl">Capacity</label>
          <input className="inp" placeholder="e.g. 30T" value={form.capacity} onChange={e => f('capacity', e.target.value)} />
          <label className="lbl">Year</label>
          <input className="inp" placeholder="e.g. 2021" value={form.year} onChange={e => f('year', e.target.value)} />
          <label className="lbl">Rate (₹/hr)</label>
          <input className="inp" type="number" placeholder="e.g. 1500" value={form.rate} onChange={e => f('rate', e.target.value)} />
          <label className="lbl">OT Rate (₹/hr)</label>
          <input className="inp" type="number" placeholder="Leave blank = same as rate" value={form.otRate} onChange={e => f('otRate', e.target.value)} />
          <label className="lbl">Daily Limit (hrs)</label>
          <input className="inp" type="number" value={form.dailyLimit} onChange={e => f('dailyLimit', e.target.value)} />
          <label className="lbl">Assign Operator</label>
          <select className="inp" value={form.operator} onChange={e => f('operator', e.target.value)}>
            <option value="">— Leave unassigned —</option>
            {state.operators.filter(op => !state.cranes.some(c => c.operator === op.phone && c.reg !== editReg)).map(op => (
                <option key={op.id} value={op.phone}>
                  {op.name ? `${op.name} "${op.phone}"` : op.phone}
                </option>
            ))}
          </select>
          <label className="lbl">Site</label>
          <input className="inp" placeholder="Site/location" value={form.site} onChange={e => f('site', e.target.value)} />
          <label className="lbl">Notes</label>
          <textarea className="notes-area" rows={2} placeholder="Optional notes…" value={form.notes} onChange={e => f('notes', e.target.value)} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={handleSave}>
              {editReg ? 'Save Changes' : 'Deploy Asset'}
            </button>
            <button className="btn-sm outline" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

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
            <button className="btn-sm accent" onClick={confirmAssign}>Assign</button>
            <button className="btn-sm outline" onClick={() => setAssignReg(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
