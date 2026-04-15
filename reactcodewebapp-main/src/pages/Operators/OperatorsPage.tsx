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
  // Temp password modal — shown once after creating an operator
  const [tempPassInfo, setTempPassInfo] = useState<{ name: string; phone: string; password: string } | null>(null);

  // Load operator photos
  useEffect(() => {
    if (!active) return;
    state.operators.forEach(op => {
      api.getOperatorProfile(op.id)
        .then(p => {
          if (p.photo) setOpPhotos(prev => ({ ...prev, [op.id]: p.photo }));
        })
        .catch(() => { });
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
        const newId = (created as any).id || String(Date.now());
        const tempPass = (created as any).temp_password as string | undefined;
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
        // Show temp credentials if backend returned them
        if (tempPass) setTempPassInfo({ name, phone, password: tempPass });
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Operator' : 'Add Operator'}
        variant="add-operator"
        footer={
          <>
            <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={!form.name.trim() || !form.phone.trim()}>
              {editId ? 'Save Changes' : 'Add Operator'}
            </button>
          </>
        }
      >
        {/* Photo + Name Row */}
        <div className="operator-photo-row">
          {/* Photo Upload */}
          <div className="operator-photo-upload">
            <div className="operator-photo-circle" onClick={() => photoRef.current?.click()}>
              {editPhoto ? (
                <img src={editPhoto} alt="Operator" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
            {editPhoto && (
              <button className="operator-photo-edit-btn" type="button" onClick={() => photoRef.current?.click()} title="Change photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {!editPhoto && (
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
                value={form.name}
                onChange={e => f('name', e.target.value)}
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
              value={form.phone}
              onChange={e => f('phone', e.target.value)}
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
              value={form.license}
              onChange={e => f('license', e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              Aadhaar No. <span className="optional">(Optional)</span>
            </label>
            <input
              className="field-input"
              placeholder="12-digit Aadhaar number"
              value={form.aadhaar}
              onChange={e => f('aadhaar', e.target.value)}
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

      {/* Temp Credentials Modal — shown once after operator is created */}
      <Modal open={!!tempPassInfo} onClose={() => setTempPassInfo(null)} title="✅ Operator Account Created">
        {tempPassInfo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontSize: '12px', color: 'var(--t2)', lineHeight: 1.6 }}>
              A login account has been <strong>automatically created</strong> for <strong>{tempPassInfo.name}</strong>.
              Share these credentials securely — the operator can change the password after first login.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Phone (Username)</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: '14px', fontWeight: 700, color: 'var(--t1)', background: 'var(--bg3)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>{tempPassInfo.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Temporary Password</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: '14px', fontWeight: 700, color: 'var(--t1)', background: 'var(--bg3)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', wordBreak: 'break-all' }}>{tempPassInfo.password}</div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: 1.5 }}>
              ⚠️ This password is shown <strong>only once</strong>. Copy it before closing.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-sm accent"
                onClick={() => {
                  navigator.clipboard.writeText(`Phone: ${tempPassInfo.phone}\nPassword: ${tempPassInfo.password}`);
                  showToast('Credentials copied!', 'success');
                }}
              >
                Copy Credentials
              </button>
              <button className="btn-sm outline" onClick={() => setTempPassInfo(null)}>Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
