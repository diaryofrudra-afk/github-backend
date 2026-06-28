import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import type { VehicleDocument, VehicleDocType, VehicleDocStatus, Crane } from '../../types';
import {
  FileText, Plus, Pencil, Trash2, AlertTriangle, AlertCircle,
  CheckCircle2, IndianRupee, Eye, Upload, BadgeCheck,
} from 'lucide-react';

type StatusFilter = 'all' | 'expiring' | 'expired';

interface DocTypeMeta { value: VehicleDocType; label: string; short: string; }

const DOC_TYPES: DocTypeMeta[] = [
  { value: 'rc', label: 'RC (Registration)', short: 'RC' },
  { value: 'insurance', label: 'Insurance', short: 'INS' },
  { value: 'fitness', label: 'Fitness Certificate', short: 'FIT' },
  { value: 'pollution', label: 'Pollution (PUC)', short: 'PUC' },
  { value: 'permit', label: 'Permit', short: 'PRM' },
  { value: 'road_tax', label: 'Road Tax', short: 'TAX' },
  { value: 'emi', label: 'EMI / Loan', short: 'EMI' },
  { value: 'other', label: 'Other', short: 'DOC' },
];

const TYPE_LABEL = Object.fromEntries(DOC_TYPES.map(t => [t.value, t.label])) as Record<VehicleDocType, string>;
const TYPE_SHORT = Object.fromEntries(DOC_TYPES.map(t => [t.value, t.short])) as Record<VehicleDocType, string>;

const MAX_DOC_BYTES = 8 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function statusOf(doc: VehicleDocument): VehicleDocStatus {
  if (doc.status) return doc.status;
  const dl = daysUntil(doc.expiryDate);
  if (dl === null) return 'valid';
  if (dl < 0) return 'expired';
  if (dl <= 30) return 'expiring';
  return 'valid';
}

const STATUS_PILL: Record<VehicleDocStatus, string> = {
  valid: 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  expiring: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  expired: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
};
const STATUS_DOT: Record<VehicleDocStatus, string> = {
  valid: 'bg-green-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
};

function expiryLabel(doc: VehicleDocument): string {
  const dl = daysUntil(doc.expiryDate);
  if (!doc.expiryDate) return 'No expiry';
  if (dl === null) return String(doc.expiryDate);
  if (dl < 0) return `Expired ${Math.abs(dl)}d ago`;
  if (dl === 0) return 'Due today';
  return `${dl}d left`;
}

interface EditingDoc {
  id?: string;
  craneReg: string;
  docType: VehicleDocType;
  title: string;
  docNumber: string;
  issueDate: string;
  expiryDate: string;
  amount: string;
  notes: string;
  fileId?: string | null;
  newFile?: { name: string; type: string; data: string } | null;
}

function blankDoc(craneReg: string): EditingDoc {
  return {
    craneReg, docType: 'insurance', title: '', docNumber: '',
    issueDate: '', expiryDate: '', amount: '', notes: '', fileId: null, newFile: null,
  };
}

export function DocumentsPage({ active }: { active: boolean }) {
  const { state, setState, showToast } = useApp();
  const { cranes, vehicleDocuments } = state;

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [openReg, setOpenReg] = useState<string | null>(null);     // vehicle detail modal
  const [editing, setEditing] = useState<EditingDoc | null>(null); // add/edit form modal
  const [viewer, setViewer] = useState<{ src: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    api.getVehicleDocuments()
      .then(docs => setState(prev => ({ ...prev, vehicleDocuments: docs })))
      .catch(() => { /* keep current */ });
  };

  // Group documents by vehicle registration.
  const docsByReg = useMemo(() => {
    const map: Record<string, VehicleDocument[]> = {};
    for (const d of vehicleDocuments) {
      (map[d.craneReg] ||= []).push(d);
    }
    return map;
  }, [vehicleDocuments]);

  const expiredCount = vehicleDocuments.filter(d => statusOf(d) === 'expired').length;
  const expiringCount = vehicleDocuments.filter(d => statusOf(d) === 'expiring').length;

  // Drive the sidebar badge (nc-diag) with the count needing attention.
  useEffect(() => {
    const el = document.getElementById('nc-diag');
    if (el) {
      const n = expiredCount + expiringCount;
      el.textContent = n > 0 ? String(n) : '';
    }
  }, [expiredCount, expiringCount]);

  const openVehicle = (reg: string) => setOpenReg(reg);

  const startAdd = (reg: string) => {
    setEditing(blankDoc(reg));
  };

  const startEdit = (doc: VehicleDocument) => {
    setEditing({
      id: doc.id,
      craneReg: doc.craneReg,
      docType: doc.docType,
      title: doc.title || '',
      docNumber: doc.docNumber || '',
      issueDate: doc.issueDate || '',
      expiryDate: doc.expiryDate || '',
      amount: doc.amount != null ? String(doc.amount) : '',
      notes: doc.notes || '',
      fileId: doc.fileId || null,
      newFile: null,
    });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    if (file.size > MAX_DOC_BYTES) { showToast('Document must be under 8 MB', 'error'); return; }
    const data = await fileToBase64(file);
    setEditing({ ...editing, newFile: { name: file.name, type: file.type, data } });
  };

  const saveDoc = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      let fileId = editing.fileId || null;
      // Upload a freshly attached scan, if any.
      if (editing.newFile) {
        const created = await api.createFile({
          ownerKey: editing.craneReg,
          name: editing.newFile.name,
          type: editing.newFile.type,
          data: editing.newFile.data,
          size: String(editing.newFile.data.length),
          timestamp: new Date().toISOString(),
        }) as { id: string };
        fileId = created.id;
      }
      const payload: Partial<VehicleDocument> = {
        craneReg: editing.craneReg,
        docType: editing.docType,
        title: editing.title,
        docNumber: editing.docNumber,
        issueDate: editing.issueDate || null,
        expiryDate: editing.expiryDate || null,
        amount: editing.amount ? Number(editing.amount) : null,
        fileId,
        notes: editing.notes,
      };
      if (editing.id) {
        await api.updateVehicleDocument(editing.id, payload);
        showToast('Document updated');
      } else {
        await api.createVehicleDocument(payload);
        showToast('Document added');
      }
      setEditing(null);
      refresh();
    } catch {
      showToast('Failed to save document', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (doc: VehicleDocument) => {
    if (!confirm(`Delete this ${TYPE_LABEL[doc.docType]} document?`)) return;
    try {
      await api.deleteVehicleDocument(doc.id);
      showToast('Document deleted');
      refresh();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const markPaid = async (doc: VehicleDocument) => {
    try {
      await api.markEmiPaid(doc.id);
      showToast('EMI marked paid — next due date set');
      refresh();
    } catch {
      showToast('Failed to update EMI', 'error');
    }
  };

  const viewScan = async (doc: VehicleDocument) => {
    if (!doc.fileId) return;
    try {
      const files = await api.getFiles(doc.craneReg) as Array<{ id: string; name: string; data: string }>;
      const f = files.find(x => x.id === doc.fileId);
      if (f?.data) setViewer({ src: f.data, name: f.name });
      else showToast('Scan not found', 'error');
    } catch {
      showToast('Failed to load scan', 'error');
    }
  };

  // Vehicles to show (respecting the status filter).
  const visibleCranes = cranes.filter((c: Crane) => {
    if (filter === 'all') return true;
    return (docsByReg[c.reg] || []).some(d => statusOf(d) === filter);
  });

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'expiring', label: 'Expiring' },
    { id: 'expired', label: 'Expired' },
  ];

  const openDocs = openReg ? (docsByReg[openReg] || []) : [];

  return (
    <div className={`page documents-page ${active ? 'active' : ''}`} id="page-diagnostics">
      <PageHeader
        title="Documents"
        subtitle="Vehicle papers & RTO compliance"
        icon={<FileText size={20} />}
        iconBgClass="bg-blue-500"
      />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Expired"
            value={expiredCount}
            colorClass="text-red-600 dark:text-red-400"
            bgClass="bg-red-500/10 dark:bg-red-500/20"
          />
          <StatCard
            icon={<AlertCircle size={18} />}
            label="Expiring (≤30d)"
            value={expiringCount}
            colorClass="text-amber-600 dark:text-amber-400"
            bgClass="bg-amber-500/10 dark:bg-amber-500/20"
          />
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Total Documents"
            value={vehicleDocuments.length}
            colorClass="text-blue-600 dark:text-blue-400"
            bgClass="bg-blue-500/10 dark:bg-blue-500/20"
          />
        </div>

      <div className="mt-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                filter === f.id
                  ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 shadow-sm'
                  : 'bg-[var(--bg4)] text-[var(--t3)] border-[var(--border)] hover:border-blue-500/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {!cranes.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">No vehicles yet. Add assets in Fleet to start tracking their documents.</p>
            </div>
          ) : visibleCranes.map((crane: Crane) => {
            const docs = docsByReg[crane.reg] || [];
            const worst = docs.some(d => statusOf(d) === 'expired') ? 'expired'
              : docs.some(d => statusOf(d) === 'expiring') ? 'expiring' : 'valid';
            return (
              <article
                key={crane.reg}
                onClick={() => openVehicle(crane.reg)}
                className="cursor-pointer bg-[var(--bg4)] rounded-2xl p-5 border border-[var(--border)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col group"
              >
                <header className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-[var(--t1)] truncate">{crane.reg}</h3>
                    <div className="text-[11px] font-medium text-[var(--t3)] truncate">{crane.make} {crane.model}</div>
                  </div>
                  {docs.length > 0 && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase ${STATUS_PILL[worst as VehicleDocStatus]}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[worst as VehicleDocStatus]}`} />
                      {worst === 'valid' ? 'OK' : worst}
                    </div>
                  )}
                </header>

                {docs.length ? (
                  <section className="flex flex-wrap gap-2 mb-4 flex-1 content-start">
                    {docs.map(d => {
                      const st = statusOf(d);
                      return (
                        <span key={d.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${STATUS_PILL[st]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />
                          {TYPE_SHORT[d.docType]}
                        </span>
                      );
                    })}
                  </section>
                ) : (
                  <div className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 mb-4 flex-1 flex items-center justify-center text-[var(--t4)] text-xs font-medium">
                    No documents yet
                  </div>
                )}

                <footer className="mt-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); startAdd(crane.reg); }}
                    className="w-full h-10 bg-[var(--bg4)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--t1)] hover:bg-[var(--bg5)] transition active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Plus size={14} className="text-[var(--t4)]" />
                    Add Document
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Per-vehicle document list ─────────────────────────────────────── */}
      <Modal
        open={!!openReg}
        onClose={() => setOpenReg(null)}
        title={openReg ? `${openReg} — Documents` : ''}
        subtitle="RC, Insurance, Fitness, Pollution, Permit, Tax & EMI"
        maxWidth="640px"
        footer={
          <button
            onClick={() => openReg && startAdd(openReg)}
            className="h-10 px-4 rounded-xl bg-[var(--accent)] text-white text-xs font-bold flex items-center gap-2 hover:bg-[var(--accent-solid)]"
          >
            <Plus size={16} /> Add Document
          </button>
        }
      >
        {openDocs.length === 0 ? (
          <p className="text-[var(--t3)] text-sm py-6 text-center">No documents recorded for this vehicle yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {openDocs.map(d => {
              const st = statusOf(d);
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--t1)]">{TYPE_LABEL[d.docType]}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL[st]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />
                        {st}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--t3)] mt-0.5 truncate">
                      {d.docNumber ? `#${d.docNumber} · ` : ''}
                      {d.docType === 'emi' ? 'Next due ' : 'Expires '}
                      {d.expiryDate || '—'} · {expiryLabel(d)}
                      {d.amount != null ? ` · ₹${d.amount.toLocaleString('en-IN')}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.fileId && (
                      <button title="View scan" onClick={() => viewScan(d)} className="h-8 w-8 grid place-items-center rounded-lg border border-[var(--border)] text-[var(--t3)] hover:bg-[var(--bg5)]">
                        <Eye size={15} />
                      </button>
                    )}
                    {d.docType === 'emi' && (
                      <button title="Mark EMI paid" onClick={() => markPaid(d)} className="h-8 w-8 grid place-items-center rounded-lg border border-[var(--border)] text-green-600 dark:text-green-400 hover:bg-green-500/10 dark:hover:bg-green-500/20">
                        <BadgeCheck size={15} />
                      </button>
                    )}
                    <button title="Edit" onClick={() => startEdit(d)} className="h-8 w-8 grid place-items-center rounded-lg border border-[var(--border)] text-[var(--t3)] hover:bg-[var(--bg5)]">
                      <Pencil size={15} />
                    </button>
                    <button title="Delete" onClick={() => deleteDoc(d)} className="h-8 w-8 grid place-items-center rounded-lg border border-[var(--border)] text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Add / edit document form ──────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit Document' : 'Add Document'}
        subtitle={editing ? editing.craneReg : ''}
        maxWidth="560px"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--t1)] hover:bg-[var(--bg5)]">Cancel</button>
            <button onClick={saveDoc} disabled={saving} className="h-10 px-4 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent-solid)] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="Document Type">
              <select
                value={editing.docType}
                onChange={e => setEditing({ ...editing, docType: e.target.value as VehicleDocType })}
                className="doc-input"
              >
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Document No.">
                <input className="doc-input" value={editing.docNumber} onChange={e => setEditing({ ...editing, docNumber: e.target.value })} placeholder="Policy / Cert no." />
              </Field>
              <Field label="Title (optional)">
                <input className="doc-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. ICICI Lombard" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={editing.docType === 'emi' ? 'Start Date' : 'Issue Date'}>
                <input type="date" className="doc-input" value={editing.issueDate} onChange={e => setEditing({ ...editing, issueDate: e.target.value })} />
              </Field>
              <Field label={editing.docType === 'emi' ? 'Next Due Date' : 'Expiry Date'}>
                <input type="date" className="doc-input" value={editing.expiryDate} onChange={e => setEditing({ ...editing, expiryDate: e.target.value })} />
              </Field>
            </div>

            {(editing.docType === 'emi' || editing.docType === 'road_tax') && (
              <Field label={editing.docType === 'emi' ? 'Installment Amount (₹)' : 'Tax Amount (₹)'}>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t4)]" />
                  <input type="number" className="doc-input pl-8" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} placeholder="0" />
                </div>
              </Field>
            )}

            <Field label="Notes (optional)">
              <textarea className="doc-input min-h-[60px] resize-y" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Any extra details" />
            </Field>

            <Field label="Scan / Photo (optional)">
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => fileRef.current?.click()} className="h-10 px-3 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--t1)] hover:bg-[var(--bg5)] flex items-center gap-2">
                  <Upload size={14} className="text-[var(--t4)]" />
                  {editing.newFile ? 'Change File' : editing.fileId ? 'Replace File' : 'Upload File'}
                </button>
                {(editing.newFile || editing.fileId) && (
                  <span className="text-[11px] text-[var(--t3)] truncate max-w-[180px]">
                    {editing.newFile ? editing.newFile.name : 'Existing scan attached'}
                  </span>
                )}
                {(editing.newFile || editing.fileId) && (
                  <button type="button" onClick={() => setEditing({ ...editing, newFile: null, fileId: null })} className="text-[11px] font-bold text-red-600">Remove</button>
                )}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPickFile} />
              </div>
            </Field>
          </div>
        )}
      </Modal>

      {/* ── Scan viewer ───────────────────────────────────────────────────── */}
      <Modal open={!!viewer} onClose={() => setViewer(null)} title={viewer?.name || 'Document'} maxWidth="720px">
        {viewer && (
          viewer.src.startsWith('data:application/pdf') || viewer.name.toLowerCase().endsWith('.pdf') ? (
            <iframe src={viewer.src} title={viewer.name} className="w-full h-[70vh] rounded-lg border border-[var(--border)]" />
          ) : (
            <img src={viewer.src} alt={viewer.name} className="max-h-[70vh] mx-auto rounded-lg" />
          )
        )}
      </Modal>

      <style>{`
        .doc-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg3);
          color: var(--t1);
          font-size: 13px;
          font-weight: 500;
          outline: none;
        }
        textarea.doc-input { height: auto; padding: 10px 12px; }
        .doc-input:focus { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
