import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';

import { api } from '../../services/api';
import type { Operator, TimesheetEntry } from '../../types';


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BLANK_FORM = { name: '', phone: '', license: '', aadhaar: '', salary: '', workingDays: '26' };

export function OperatorsPage({ active }: { active: boolean }) {
  const { state, setState, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [assignOpId, setAssignOpId] = useState<string | null>(null);
  const [selectedCrane, setSelectedCrane] = useState('');
  const [opPhotos, setOpPhotos] = useState<Record<string, string>>({});
  const [editPhoto, setEditPhoto] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState('');

  // Load operator photos
  useEffect(() => {
    if (!active) return;
    state.operators.forEach(op => {
      api.getOperatorProfile(op.id)
        .then(p => {
          if (p.photo) setOpPhotos(prev => ({ ...prev, [op.id]: p.photo }));
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, state.operators.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.operators.filter(op => {
      return !q
        || op.name.toLowerCase().includes(q)
        || op.phone.includes(q)
        || (op.license || '').toLowerCase().includes(q)
        || (op.aadhaar || '').includes(q);
    });
  }, [state.operators, search]);

  function openAdd() {
    setForm({ ...BLANK_FORM });
    setEditPhoto('');
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const op = state.operators.find(o => o.id === id);
    if (!op) return;
    const opKey = op.phone || id;
    const prof = (state.operatorProfiles as any)[opKey] || {};
    setForm({
      name: op.name,
      phone: op.phone,
      license: op.license || '',
      aadhaar: op.aadhaar || '',
      salary: String(prof.salary || ''),
      workingDays: String(prof.workingDays || '26'),
    });
    setEditPhoto(opPhotos[id] || '');
    setEditId(id);
    setModalOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) return showToast('Name required', 'error');
    if (!phone) return showToast('Phone required', 'error');

    try {
      if (editId) {
        await api.updateOperator(editId, { name, phone, license: form.license.trim(), aadhaar: form.aadhaar.trim() });
        // Save photo if changed
        if (editPhoto !== (opPhotos[editId] || '')) {
          await api.updateOperatorProfile(editId, { photo: editPhoto });
          setOpPhotos(prev => ({ ...prev, [editId]: editPhoto }));
        }
        
        const salaryNum = Number(form.salary) || 0;
        const wdNum = Number(form.workingDays) || 26;
        
        setState(prev => ({
          ...prev,
          operators: prev.operators.map(o =>
            o.id === editId
              ? { ...o, name, phone, license: form.license.trim(), aadhaar: form.aadhaar.trim() }
              : o
          ),
          operatorProfiles: {
            ...prev.operatorProfiles,
            [phone]: { ...((prev.operatorProfiles as any)[phone] || {}), salary: salaryNum, workingDays: wdNum }
          }
        }));
        showToast('Operator updated');
      } else {
        if (state.operators.find(o => o.phone === phone)) return showToast('Phone already registered', 'error');
        const created = await api.createOperator({ name, phone, license: form.license.trim(), aadhaar: form.aadhaar.trim(), status: 'active' });
        const newId = created.id || String(Date.now());
        // Save photo for new operator
        if (editPhoto) {
          await api.updateOperatorProfile(newId, { photo: editPhoto });
          setOpPhotos(prev => ({ ...prev, [newId]: editPhoto }));
        }
        
        const salaryNum = Number(form.salary) || 0;
        const wdNum = Number(form.workingDays) || 26;
        
        const newOp: Operator = {
          id: newId,
          name,
          phone,
          license: form.license.trim(),
          aadhaar: form.aadhaar.trim(),
          status: 'active',
        };
        setState(prev => ({ 
          ...prev, 
          operators: [...prev.operators, newOp],
          operatorProfiles: {
            ...prev.operatorProfiles,
            [phone]: { ...((prev.operatorProfiles as any)[phone] || {}), salary: salaryNum, workingDays: wdNum }
          }
        }));
        showToast(`${name} added`);
      }
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save operator', 'error');
    }
  }

  async function handleDelete(id: string) {
    const op = state.operators.find(o => o.id === id);
    if (!op) return;
    if (!confirm(`Delete operator ${op.name}?`)) return;
    try {
      await api.deleteOperator(id);
      setState(prev => ({ ...prev, operators: prev.operators.filter(o => o.id !== id) }));
      showToast(`${op.name} deleted`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete operator', 'error');
    }
  }

  function openAssign(opId: string) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;
    const alreadyOn = state.cranes.find(c => c.operator === op.phone || c.operator === op.id);
    setSelectedCrane(alreadyOn?.reg || '');
    setAssignOpId(opId);
  }

  async function confirmAssign() {
    if (!assignOpId) return;
    const op = state.operators.find(o => o.id === assignOpId);
    if (!op) return;
    const opKey = op.phone;
    try {
      // Unassign from current crane if any
      const currentCrane = state.cranes.find(c => c.operator === opKey);
      if (currentCrane) {
        await api.updateCrane(currentCrane.id, { operator: '' });
      }
      // Assign to new crane if selected
      if (selectedCrane) {
        const newCrane = state.cranes.find(c => c.reg === selectedCrane);
        if (newCrane) {
          await api.updateCrane(newCrane.id, { operator: opKey });
        }
      }
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.map(c => {
          if (c.operator === opKey) return { ...c, operator: '' };
          if (c.reg === selectedCrane) return { ...c, operator: opKey };
          return c;
        }),
      }));
      showToast(selectedCrane ? `${op.name} assigned to ${selectedCrane}` : `${op.name} unassigned`, 'info');
      setAssignOpId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign', 'error');
    }
  }

  function f(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-operators">
      <div className="section-bar" style={{ marginBottom: '16px' }}>
        <div className="section-title">Operators</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone…" id="operators-search" />
          <button className="tb-btn accent" onClick={openAdd}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Operator
          </button>
        </div>
      </div>

      <div id="operators-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <h4>No Operators</h4>
            <p>{search ? 'No matches found' : 'Register your first operator'}</p>
          </div>
        ) : (
          filtered.map(op => {
            const crane = state.cranes.find(c => c.operator === op.id || c.operator === op.phone);
            const opTs: TimesheetEntry[] = (state.timesheets[op.phone] || state.timesheets[op.id] || []);
            const initials = op.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || op.phone.slice(-2);
            
            // Salary Calculation
            const opKey = op.phone || String(op.id);
            const profileAny = (state.operatorProfiles as any)[opKey] || {};
            const salary = Number(profileAny?.salary) || 0;
            const workDays = Number(profileAny?.workingDays) || 26;
            
            const now = new Date();
            const yr = now.getFullYear();
            const mo = now.getMonth() + 1;
            const daysInMonth = new Date(yr, mo, 0).getDate();
            const selectedMonth = `${yr}-${String(mo).padStart(2, '0')}`;
            
            const dayHoursMap: Record<string, number> = {};
            opTs.forEach(e => {
               const iso = e?.date?.substring(0, 10);
               if (iso) dayHoursMap[iso] = (dayHoursMap[iso] || 0) + (Number(e?.hoursDecimal) || 0);
            });
            const att: Record<string, boolean> = {};
            for (const [iso, hrs] of Object.entries(dayHoursMap)) {
               if (hrs > 0 && iso.startsWith(selectedMonth)) att[iso] = true;
            }
            state.attendance.filter((a: any) => a?.operator_key === opKey && a.date.startsWith(selectedMonth)).forEach((a: any) => {
               if (a?.status === 'present') att[a.date] = true;
               else if (a?.status === 'absent') att[a.date] = false;
            });
            let presentCount = 0;
            for (let d = 1; d <= daysInMonth; d++) {
               const iso = `${selectedMonth}-${String(d).padStart(2, '0')}`;
               if (att[iso]) presentCount++;
            }
            
            const perDay = workDays > 0 ? salary / workDays : 0;
            const earnedGross = Math.round(perDay * presentCount);
            
            const opAdvances = ((state.advancePayments as any)[opKey] || []) as any[];
            const monthlyAdvances = Array.isArray(opAdvances) ? opAdvances.filter(a => a?.date?.startsWith(selectedMonth)) : [];
            const totalAdvances = monthlyAdvances.reduce((s, a) => s + (Number(a?.amount) || 0), 0);
            
            return (
              <div key={op.id} className="op-row">
                {opPhotos[op.id] ? (
                  <img src={opPhotos[op.id]} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div className="op-row-av">{initials}</div>
                )}
                <div className="op-row-info">
                  <div className="op-row-name">{op.name}</div>
                  <div className="op-row-meta">
                    <span style={{ fontFamily: 'var(--fm)' }}>{op.phone}</span>
                    {op.license && (
                      <span style={{ background: 'var(--accent-s)', color: 'var(--accent)', border: '1px solid var(--accent-g)', borderRadius: 'var(--rf)', padding: '1px 7px', fontSize: '9px' }}>
                        {op.license}
                      </span>
                    )}
                    {crane ? <span className="badge accent">→ {crane.reg}</span> : <span className="badge">Unassigned</span>}
                    {salary > 0 && <span className="badge green">Earned: ₹{(earnedGross).toLocaleString()} / ₹{(salary).toLocaleString()}</span>}
                    {totalAdvances > 0 && <span className="badge red" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Adv: ₹{totalAdvances.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="op-row-right">
                  <button 
                    className="ca-btn" 
                    title="Add Advance" 
                    style={{ background: 'var(--green-s)', color: 'var(--green)', borderColor: 'var(--green-s)' }}
                    onClick={() => {
                      const baseSalary = Number(((state.operatorProfiles as any)[opKey] || {}).salary) || 0;
                      if (!baseSalary) return showToast('Please assign a Monthly Salary first by editing the operator', 'error');
                      const amt = prompt(`Enter advance amount to pay ${op.name}:`);
                      if (!amt) return;
                      const notes = prompt('Enter notes/reason (optional):') || '';
                      
                      const nowISO = new Date().toISOString();
                      const newAdv = { id: String(Date.now()), date: nowISO, amount: Number(amt), notes };
                      setState(prev => ({
                        ...prev,
                        advancePayments: {
                          ...(prev.advancePayments || {}),
                          [opKey]: [...((prev.advancePayments as any)?.[opKey] || []), newAdv]
                        }
                      }));
                      showToast(`Advance of ₹${amt} recorded for ${op.name}`);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                  </button>
                  <button className="ca-btn c-acc opr-edit" title="Edit" onClick={() => openEdit(op.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!crane && (
                    <button className="ca-btn c-acc" title="Assign to Asset" onClick={() => openAssign(op.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                        <path d="M2 20h20" /><path d="M10 4v16" /><path d="M10 4l8 4" /><path d="M18 8v12" />
                      </svg>
                    </button>
                  )}
                  <button className="ca-btn c-red opr-del" title="Delete" onClick={() => handleDelete(op.id)}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Operator' : 'Add Operator'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            {editPhoto ? (
              <img src={editPhoto} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                {form.name ? form.name.slice(0, 2).toUpperCase() : '?'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="btn-sm outline" type="button" onClick={() => photoRef.current?.click()} style={{ fontSize: 11 }}>
                {editPhoto ? 'Change Photo' : 'Upload Photo'}
              </button>
              {editPhoto && (
                <button className="btn-sm outline" type="button" style={{ fontSize: 11, color: 'var(--error, #e53e3e)' }} onClick={() => setEditPhoto('')}>
                  Remove
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
          </div>
          <label className="lbl">Name *</label>
          <input className="inp" placeholder="Full name" value={form.name} onChange={e => f('name', e.target.value)} />
          <label className="lbl">Phone *</label>
          <input className="inp" placeholder="10-digit phone" value={form.phone} onChange={e => f('phone', e.target.value)} />
          <label className="lbl">License No.</label>
          <input className="inp" placeholder="DL number" value={form.license} onChange={e => f('license', e.target.value)} />
          <label className="lbl">Aadhaar No.</label>
          <input className="inp" placeholder="Aadhaar number" value={form.aadhaar} onChange={e => f('aadhaar', e.target.value)} />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label className="lbl">Monthly Salary (₹)</label>
              <input type="number" className="inp" placeholder="e.g. 25000" value={form.salary} onChange={e => f('salary', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="lbl">Base Working Days</label>
              <input type="number" className="inp" placeholder="e.g. 26" value={form.workingDays} onChange={e => f('workingDays', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={handleSave}>{editId ? 'Save Changes' : 'Add Operator'}</button>
            <button className="btn-sm outline" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!assignOpId} onClose={() => setAssignOpId(null)} title={`Assign to Asset — ${state.operators.find(o => o.id === assignOpId)?.name || ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="lbl">Select Asset</label>
          <select className="inp" value={selectedCrane} onChange={e => setSelectedCrane(e.target.value)}>
            <option value="">— Leave unassigned —</option>
            {state.cranes.filter(c => !c.operator || c.operator === (state.operators.find(o => o.id === assignOpId)?.phone || '')).map(c => (
                <option key={c.reg} value={c.reg}>
                  {c.reg}{c.make ? ` · ${c.make}` : ''}{c.model ? ` ${c.model}` : ''}
                </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn-sm accent" onClick={confirmAssign}>Assign</button>
            <button className="btn-sm outline" onClick={() => setAssignOpId(null)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!cropSrc} onClose={() => setCropSrc('')} title="Adjust Photo">
        {cropSrc && (
          <ImageCropper
            src={cropSrc}
            onCrop={(cropped) => { setEditPhoto(cropped); setCropSrc(''); }}
            onCancel={() => setCropSrc('')}
          />
        )}
      </Modal>
    </div>
  );
}
