import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { api } from '../../services/api';
import { PageContainer } from '../../components/ui/PageContainer';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Users, Plus, Edit2, Trash2, IndianRupee } from 'lucide-react';


const BLANK_FORM = { name: '', phone: '', license: '', aadhaar: '', salary: '', workingDays: '26' };

export function OperatorsPage({ active }: { active: boolean }) {
  const { state, setState, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [assignOpId, setAssignOpId] = useState<string | null>(null);
  const [selectedCraneId, setSelectedCraneId] = useState('');
  const [opPhotos, setOpPhotos] = useState<Record<string, string>>({});
  const [editPhoto, setEditPhoto] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState('');
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
        if (editPhoto !== (opPhotos[editId] || '')) {
          await api.updateOperatorProfile(editId, { photo: editPhoto });
          setOpPhotos(prev => ({ ...prev, [editId]: editPhoto }));
        }
        setState(prev => ({
          ...prev,
          operators: prev.operators.map(o => o.id === editId ? { ...o, name, phone, license: form.license.trim(), aadhaar: form.aadhaar.trim() } : o),
          operatorProfiles: {
            ...prev.operatorProfiles,
            [phone]: { ...(prev.operatorProfiles[phone] || {}), salary: Number(form.salary), workingDays: Number(form.workingDays) }
          }
        }));
        showToast('Operator updated');
      } else {
        const res = await api.createOperator({
          name, phone, license: form.license.trim(), aadhaar: form.aadhaar.trim(),
        });
        const newOp = { ...res, id: res.id || String(Date.now()) };
        if (editPhoto) {
          await api.updateOperatorProfile(newOp.id, { photo: editPhoto });
          setOpPhotos(prev => ({ ...prev, [newOp.id]: editPhoto }));
        }
        setState(prev => ({
          ...prev,
          operators: [...prev.operators, newOp],
          operatorProfiles: {
            ...prev.operatorProfiles,
            [phone]: { name, salary: Number(form.salary), workingDays: Number(form.workingDays) }
          }
        }));
        if (res.temp_password) {
          setTempPassInfo({ name: res.name, phone: res.phone, password: res.temp_password });
        } else {
          showToast('Operator created');
        }
      }
      setModalOpen(false);
    } catch (e: any) {
      showToast(e.message || 'Error saving operator', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this operator?')) return;
    try {
      await api.deleteOperator(id);
      setState(prev => ({ ...prev, operators: prev.operators.filter(o => o.id !== id) }));
      showToast('Operator removed');
    } catch {
      showToast('Failed to remove operator', 'error');
    }
  }

  function openAssign(id: string) {
    setAssignOpId(id);
    setSelectedCraneId('');
  }

  async function confirmAssign() {
    if (!assignOpId || !selectedCraneId) return;
    const crane = state.cranes.find(c => c.id === selectedCraneId);
    if (!crane) return;
    try {
      await api.updateCrane(crane.id, { operator: assignOpId });
      setState(prev => ({
        ...prev,
        cranes: prev.cranes.map(c => c.id === selectedCraneId ? { ...c, operator: assignOpId } : c)
      }));
      setAssignOpId(null);
      showToast('Asset assigned');
    } catch {
      showToast('Assignment failed', 'error');
    }
  }

  return (
    <PageContainer id="page-operators" active={active} className="operators-page">
      <div className="p-5 border-b border-[var(--border)] bg-gradient-to-b from-[var(--accent-s)] to-[var(--bg4)]">
        <PageHeader 
          title="Operators" 
          subtitle="Workforce Management"
          icon={<Users size={20} />}
          iconBgClass="bg-blue-500 shadow-blue-100"
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search operators..." />
          <button className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent-solid)]" onClick={openAdd}>
            <Plus size={16} />
            Add Operator
          </button>
        </PageHeader>
      </div>

      <div className="p-5 bg-[var(--bg3)] flex-1 overflow-y-auto">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">{search ? 'No operators match your search' : 'No operators registered yet.'}</p>
            </div>
          ) : (
            filtered.map(op => {
              const crane = state.cranes.find(c => c.operator === op.id || c.operator === op.phone);
              const initials = op.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OP';
              const opKey = op.phone || String(op.id);
              const profile = (state.operatorProfiles as any)[opKey] || {};
              const salary = Number(profile.salary) || 0;

              return (
                <article key={op.id} className="bg-[var(--bg4)] rounded-2xl p-5 border border-[var(--border)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col group">
                  <header className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="relative">
                        {opPhotos[op.id] ? (
                          <img src={opPhotos[op.id]} alt="" className="w-12 h-12 rounded-full object-cover shadow-sm border border-[var(--border)]" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-black shadow-sm">
                            {initials}
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                        <h3 className="text-base font-black text-[var(--t1)] truncate">{op.name}</h3>
                        <p className="text-[11px] font-medium text-[var(--t3)]">{op.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(op.id)} className="p-1.5 text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--bg5)] rounded-lg transition"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(op.id)} className="p-1.5 text-[var(--t4)] hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                    </div>
                  </header>

                  <section className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 grid grid-cols-2 gap-3 mb-4 flex-1">
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Asset</div>
                      <div className={`text-xs font-bold truncate ${crane ? 'text-blue-600' : 'text-[var(--t4)]'}`}>{crane ? crane.reg : 'Standby'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Salary</div>
                      <div className="text-xs font-bold text-[var(--t1)] truncate">{salary ? `₹${salary.toLocaleString('en-IN')}` : '—'}</div>
                    </div>
                  </section>

                  <footer className="grid grid-cols-2 gap-2 mt-auto">
                    {!crane && <button onClick={() => openAssign(op.id)} className="h-9 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-xl text-[11px] font-bold transition">Assign</button>}
                    <button 
                      onClick={() => {
                        const amt = prompt(`Enter advance amount to pay ${op.name}:`);
                        if (!amt) return;
                        const nowISO = new Date().toISOString();
                        const newAdv = { id: String(Date.now()), date: nowISO, amount: Number(amt), notes: '' };
                        setState(prev => ({
                          ...prev,
                          advancePayments: { ...(prev.advancePayments || {}), [opKey]: [...((prev.advancePayments as any)?.[opKey] || []), newAdv] }
                        }));
                        showToast(`Advance of ₹${amt} recorded`);
                      }} 
                      className={`h-9 bg-[var(--bg4)] text-[var(--t1)] border border-[var(--border)] hover:bg-[var(--bg5)] rounded-xl text-[11px] font-bold transition shadow-sm flex items-center justify-center gap-1 ${crane ? 'col-span-2' : ''}`}
                    >
                      <IndianRupee size={12} className="text-[var(--t4)]" />
                      Advance
                    </button>
                  </footer>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Operator' : 'Add Operator'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
              {editPhoto ? (
                <img src={editPhoto} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: '2px solid #fff' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <input type="file" ref={photoRef} hidden accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setCropSrc(await fileToBase64(file));
              }} />
            </div>
          </div>
          
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="inp" placeholder="e.g. Rahul Kumar" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="inp" placeholder="10-digit number" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <div className="form-group">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Monthly Salary</label>
                <input type="number" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} className="inp" placeholder="₹" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
             </div>
             <div className="form-group">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Working Days</label>
                <input type="number" value={form.workingDays} onChange={e => setForm({...form, workingDays: e.target.value})} className="inp" placeholder="26" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
             </div>
          </div>
          <button className="btn-sm accent" onClick={handleSave} style={{ width: '100%', height: 48, borderRadius: 12, marginTop: 10, fontWeight: 800, fontSize: 15 }}>{editId ? 'Save Changes' : 'Create Account'}</button>
        </div>
      </Modal>

      {/* Assign Asset Modal */}
      <Modal open={!!assignOpId} onClose={() => setAssignOpId(null)} title="Assign to Asset">
        <div className="flex flex-col gap-4 py-2">
          <label className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest">Select an Asset</label>
          <select 
            value={selectedCraneId} 
            onChange={e => setSelectedCraneId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] outline-none bg-[var(--bg4)] font-semibold focus:border-orange-500 focus:ring-2 focus:ring-orange-50 transition"
          >
            <option value="">Select Asset...</option>
            {state.cranes.filter(c => !c.operator).map(c => <option key={c.id} value={c.id}>{c.reg} ({c.make})</option>)}
          </select>
          <button className="w-full h-12 bg-orange-500 text-white font-bold rounded-xl mt-2 transition hover:bg-orange-600 disabled:opacity-50" onClick={confirmAssign} disabled={!selectedCraneId}>
            Confirm Assignment
          </button>
        </div>
      </Modal>

      {/* Temp Password Modal */}
      <Modal open={!!tempPassInfo} onClose={() => setTempPassInfo(null)} title="Account Created">
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: 64, height: 64, background: 'var(--accent-s)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', margin: '0 auto 20px' }}>
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Success!</h3>
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 20 }}>Operator account created for <b>{tempPassInfo?.name}</b></p>
          <div style={{ background: 'var(--bg5)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
             <p style={{ fontSize: 12, color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>Temporary Password</p>
             <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2 }}>{tempPassInfo?.password}</div>
          </div>
          <button className="btn-sm accent" onClick={() => setTempPassInfo(null)} style={{ width: '100%', height: 48, borderRadius: 12, fontWeight: 800 }}>Done</button>
        </div>
      </Modal>

      {cropSrc && <ImageCropper src={cropSrc} onCrop={setEditPhoto} onCancel={() => setCropSrc('')} />}
    </PageContainer>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
