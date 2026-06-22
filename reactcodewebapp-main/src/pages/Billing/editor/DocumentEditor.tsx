import { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { fmtINR, todayISO } from '../../../utils';
import { numberToIndianWords } from '../../../utils/numberToWords';
import type { Invoice, InvoiceItem, Quotation } from '../../../types';
import { api } from '../../../services/api';
import { LineItemRow } from './LineItemRow';
import type { LineRow } from './LineItemRow';
import { TotalsSidebar } from './TotalsSidebar';
import { TermsList } from './TermsList';
import {
  ChevronLeftIcon, PlusIcon,
  TruckIcon, BuildingIcon, ChevronDownIcon,
} from './icons';
import { useDocumentDraft, useDraftRestorePrompt, readDraft, clearDraft } from './useDocumentDraft';
import './editor.css';

export type EditorKind = 'invoice' | 'quotation';
export type EditorMode = 'create' | 'edit';

interface Props {
  kind: EditorKind;
  mode: EditorMode;
  documentId?: string;
  defaultNumber: string;
  onCancel: () => void;
  onSaved: () => void;
}

interface DraftPayload {
  number: string;
  date: string;
  dueOrValid: string;
  clientId: string;
  assetReg: string;
  notes: string;
  shippingEnabled: boolean;
  shippingAddress: string;
  rows: LineRow[];
  terms: string[];
  discount: number;
  additionalCharges: number;
  summariseQty: boolean;
}

const INVOICE_TERMS: string[] = [
  'Payment is due within the agreed credit period from the invoice date.',
  'Late payments may attract interest at 1.5% per month or as agreed.',
  'GST is charged as per applicable Government rates.',
  'All disputes are subject to the local jurisdiction of our registered office.',
  'Goods/services once delivered will not be taken back.',
  'Bank transfer details are listed at the bottom of this invoice.',
  'Please mention the invoice number while making the payment.',
  'A signed delivery challan accompanies any goods supplied.',
];

const QUOTATION_TERMS: string[] = [
  'This quotation is valid until the date mentioned above.',
  'GST will be charged additionally where applicable.',
  'Any scope changes after approval may affect the final amount.',
  'The final invoice will be issued based on mutually approved work and pricing.',
  'Payment terms will follow the agreed billing arrangement.',
  'Any taxes or statutory charges not mentioned will be extra if applicable.',
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankRow(): LineRow {
  return {
    key: uid(),
    description: '',
    details: '',
    hsn: '9954',
    gstRate: 18,
    qty: 1,
    rate: 0,
    unit: 'hours',
  };
}

function defaultDueOrValid(kind: EditorKind) {
  const d = new Date();
  d.setDate(d.getDate() + (kind === 'quotation' ? 15 : 7));
  return d.toISOString().slice(0, 10);
}

export function DocumentEditor({ kind, mode, documentId, defaultNumber, onCancel, onSaved }: Props) {
  const { state, setState, save, showToast } = useApp();
  const { clients, cranes, invoices, quotations } = state;

  const existing = useMemo(() => {
    if (!documentId) return undefined;
    return kind === 'invoice'
      ? invoices.find(i => i.id === documentId)
      : quotations.find(q => q.id === documentId);
  }, [documentId, kind, invoices, quotations]);

  const seedRows = useMemo<LineRow[]>(() => {
    const items = existing?.items as InvoiceItem[] | undefined;
    if (Array.isArray(items) && items.length) {
      return items.map(it => ({
        key: uid(),
        description: (it.description || '').split('\n')[0] || '',
        details: (it.description || '').split('\n').slice(1).join('\n'),
        hsn: it.hsn || '9954',
        gstRate: typeof it.gstRate === 'number' ? it.gstRate : 18,
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
        unit: it.unit || 'hours',
        imageUrl: it.imageUrl,
        discount: it.discount,
      }));
    }
    return [blankRow()];
  }, [existing]);

  const [number, setNumber] = useState(existing?.number || defaultNumber);
  const [date, setDate] = useState(existing?.date || todayISO());
  const [dueOrValid, setDueOrValid] = useState(
    (kind === 'invoice'
      ? (existing as Invoice | undefined)?.dueDate || (existing as Invoice | undefined)?.due_date
      : (existing as Quotation | undefined)?.validUntil || (existing as Quotation | undefined)?.valid_until)
    || defaultDueOrValid(kind)
  );
  const [clientId, setClientId] = useState(existing?.clientId || existing?.client_id || '');
  const [assetReg, setAssetReg] = useState(existing?.assetReg || existing?.asset_reg || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [shippingEnabled, setShippingEnabled] = useState(
    Boolean((existing as Invoice | undefined)?.shipping?.enabled)
  );
  const [shippingAddress, setShippingAddress] = useState(
    (existing as Invoice | undefined)?.shipping?.address || ''
  );
  const [terms, setTerms] = useState<string[]>(
    existing?.terms?.length ? existing.terms : (kind === 'invoice' ? INVOICE_TERMS : QUOTATION_TERMS)
  );
  const [rows, setRows] = useState<LineRow[]>(seedRows);
  const [discount, setDiscount] = useState((existing as Invoice | undefined)?.discount || 0);
  const [additionalCharges, setAdditionalCharges] = useState(
    (existing as Invoice | undefined)?.additionalCharges || 0
  );
  const [summariseQty, setSummariseQty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [restoredOnce, setRestoredOnce] = useState(false);
  const restorePrompt = useDraftRestorePrompt(kind, documentId);

  // Drag state for line items
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overPos, setOverPos] = useState<'above' | 'below'>('above');

  const draftEnabled = restoredOnce || !restorePrompt.hasDraft;
  const draftPayload: DraftPayload = useMemo(() => ({
    number, date, dueOrValid, clientId, assetReg, notes,
    shippingEnabled, shippingAddress,
    rows, terms, discount, additionalCharges, summariseQty,
  }), [number, date, dueOrValid, clientId, assetReg, notes, shippingEnabled, shippingAddress, rows, terms, discount, additionalCharges, summariseQty]);

  useDocumentDraft(kind, documentId, draftPayload, draftEnabled);

  const restoreDraft = () => {
    const draft = readDraft<DraftPayload>(kind, documentId);
    if (draft) {
      setNumber(draft.number);
      setDate(draft.date);
      setDueOrValid(draft.dueOrValid);
      setClientId(draft.clientId);
      setAssetReg(draft.assetReg);
      setNotes(draft.notes);
      setShippingEnabled(draft.shippingEnabled);
      setShippingAddress(draft.shippingAddress);
      setRows(draft.rows.length ? draft.rows : [blankRow()]);
      setTerms(draft.terms);
      setDiscount(draft.discount || 0);
      setAdditionalCharges(draft.additionalCharges || 0);
      setSummariseQty(draft.summariseQty ?? true);
    }
    setRestoredOnce(true);
    restorePrompt.consume();
  };
  const discardDraft = () => {
    restorePrompt.dismiss();
    setRestoredOnce(true);
  };

  // Calculations
  const lineCalcs = useMemo(() => rows.map(r => {
    const baseAmount = (Number(r.qty) || 0) * (Number(r.rate) || 0);
    const discountFactor = 1 - (Number(r.discount) || 0) / 100;
    const amount = Math.round(baseAmount * discountFactor * 100) / 100;
    const gst = Math.round(amount * (Number(r.gstRate) || 0) / 100 * 100) / 100;
    const cgst = Math.round((gst / 2) * 100) / 100;
    const sgst = gst - cgst;
    return { amount, cgst, sgst, gst };
  }), [rows]);

  const subtotal = useMemo(() => lineCalcs.reduce((s, c) => s + c.amount, 0), [lineCalcs]);
  const cgstTotal = useMemo(() => lineCalcs.reduce((s, c) => s + c.cgst, 0), [lineCalcs]);
  const sgstTotal = useMemo(() => lineCalcs.reduce((s, c) => s + c.sgst, 0), [lineCalcs]);
  const gstTotal = cgstTotal + sgstTotal;
  const grandTotal = useMemo(
    () => Math.max(0, subtotal + gstTotal - discount + additionalCharges),
    [subtotal, gstTotal, discount, additionalCharges]
  );
  const amountInWords = useMemo(() => numberToIndianWords(grandTotal) || 'Zero Rupees Only', [grandTotal]);
  // numberToIndianWords already returns "... Rupees Only"

  const updateRow = (key: string, patch: Partial<LineRow>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows(prev => [...prev, blankRow()]);
  const removeRow = (key: string) =>
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));
  const duplicateRow = (key: string) => setRows(prev => {
    const idx = prev.findIndex(r => r.key === key);
    if (idx < 0) return prev;
    const next = [...prev];
    next.splice(idx + 1, 0, { ...prev[idx], key: uid() });
    return next;
  });

  // Drag for line items
  const onItemDragStart = (e: React.DragEvent, i: number) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const onItemDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setOverIdx(i);
    setOverPos(above ? 'above' : 'below');
  };
  const onItemDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null); setOverIdx(null); return;
    }
    setRows(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      let target = i;
      if (dragIdx < i) target -= 1;
      if (overPos === 'below') target += 1;
      target = Math.max(0, Math.min(next.length, target));
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null); setOverIdx(null);
  };
  const onItemDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  const buildDoc = (): Invoice | Quotation => {
    const items: InvoiceItem[] = rows.map((r, i) => {
      const base = (Number(r.qty) || 0) * (Number(r.rate) || 0);
      const amt = Math.round(base * (1 - (r.discount || 0) / 100) * 100) / 100;
      const desc = r.details.trim() ? `${r.description}\n${r.details}` : r.description;
      return {
        description: desc,
        hsn: r.hsn,
        gstRate: r.gstRate,
        qty: r.qty,
        rate: r.rate,
        amount: amt,
        cgst: lineCalcs[i].cgst,
        sgst: lineCalcs[i].sgst,
        discount: r.discount,
        unit: r.unit,
        imageUrl: r.imageUrl,
      };
    });
    const baseDoc = {
      id: existing?.id || String(Date.now()),
      number: number.trim(),
      date,
      clientId,
      assetReg,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      cgst: Math.round(cgstTotal * 100) / 100,
      sgst: Math.round(sgstTotal * 100) / 100,
      total: Math.round(grandTotal * 100) / 100,
      notes,
      terms,
    };
    if (kind === 'invoice') {
      return {
        ...baseDoc,
        dueDate: dueOrValid,
        status: (existing?.status as Invoice['status']) || 'draft',
        discount,
        additionalCharges,
        totalInWords: amountInWords,
        shipping: shippingEnabled
          ? { enabled: true, address: shippingAddress }
          : undefined,
      } as Invoice;
    }
    return {
      ...baseDoc,
      validUntil: dueOrValid,
      status: (existing?.status as Quotation['status']) || 'draft',
    } as Quotation;
  };

  const persist = async (status?: 'draft' | 'sent') => {
    if (!clientId) { showToast('Select a client', 'error'); return; }
    if (rows.every(r => !r.description.trim() && !r.qty && !r.rate)) {
      showToast('Add at least one line item', 'error'); return;
    }
    const doc = buildDoc();
    if (status) (doc as Invoice).status = status as never;
    setSaving(true);
    try {
      if (kind === 'invoice') {
        if (mode === 'edit') {
          const updated = await api.updateInvoice(doc.id, doc as Invoice);
          setState(prev => ({
            ...prev,
            invoices: prev.invoices.map(i => i.id === doc.id ? updated : i)
          }));
        } else {
          const created = await api.createInvoice(doc as Omit<Invoice, 'id'>);
          setState(prev => ({
            ...prev,
            invoices: [...prev.invoices, created]
          }));
        }
      } else {
        if (mode === 'edit') {
          const updated = await api.updateQuotation(doc.id, doc as Quotation);
          setState(prev => ({
            ...prev,
            quotations: prev.quotations.map(q => q.id === doc.id ? updated : q)
          }));
        } else {
          const created = await api.createQuotation(doc as Omit<Quotation, 'id'>);
          setState(prev => ({
            ...prev,
            quotations: [...prev.quotations, created]
          }));
        }
      }
      save();
      clearDraft(kind, documentId);
      showToast(`${kind === 'invoice' ? 'Invoice' : 'Quotation'} ${doc.number} saved — ${fmtINR(doc.total)}`);
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save document', 'error');
    } finally {
      setSaving(false);
    }
  };

  const titleText = kind === 'invoice'
    ? (mode === 'edit' ? 'Edit Invoice' : 'Create Invoice')
    : (mode === 'edit' ? 'Edit Quotation' : 'Create Quotation');

  const numberLabel = kind === 'invoice' ? 'INVOICE NUMBER' : 'ESTIMATE NUMBER';
  const dueLabel = kind === 'invoice' ? 'DUE DATE' : 'VALID UNTIL';

  return (
    <div className="de-shell editor-active de-compact">
      {restorePrompt.hasDraft && !restoredOnce && (
        <div className="de-restore-banner">
          <div>An unsaved draft was found for this {kind}.</div>
          <div className="actions">
            <button onClick={discardDraft}>Discard</button>
            <button className="primary" onClick={restoreDraft}>Restore</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="de-topbar">
        <button className="de-back" onClick={onCancel}>
          <ChevronLeftIcon /> Back
        </button>
        <div className="de-title">
          <h2>{titleText}</h2>
          <span className="draft-chip">● Draft</span>
        </div>
        <div className="de-actions">
          <button className="de-btn" onClick={() => persist('draft')} disabled={saving}>Save draft</button>
          <button className="de-btn primary" onClick={() => persist('sent')} disabled={saving}>Save &amp; Close</button>
        </div>
      </div>

      <div className="de-body">
        <div className="de-main">

          {/* Details */}
          <div className="de-card">
            <div className="de-grid-3">
              <div>
                <label className="de-label">{numberLabel}</label>
                <input className="de-input" value={number} onChange={e => setNumber(e.target.value)} />
              </div>
              <div>
                <label className="de-label">DATE</label>
                <input className="de-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className="de-label">{dueLabel}</label>
                <input className="de-input" type="date" value={dueOrValid} onChange={e => setDueOrValid(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="de-grid-2">
            <div className="de-pick-card">
              <div className="pc-head">
                <span className="label">Client</span>
                <span className="meta">{kind === 'invoice' ? 'Bill to' : 'Estimate for'}</span>
              </div>
              <div className="pc-row">
                <div className="pc-icon"><BuildingIcon /></div>
                <select value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Select a client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="de-pick-card">
              <div className="pc-head">
                <span className="label">Asset</span>
                <span className="meta">Equipment</span>
              </div>
              <div className="pc-row">
                <div className="pc-icon"><TruckIcon /></div>
                <select value={assetReg} onChange={e => setAssetReg(e.target.value)}>
                  <option value="">Select an asset</option>
                  {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="de-card">
            <div className="de-section-head">
              <h3>Line items</h3>
              <span className="meta">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="de-items-table">
              <div></div>
              <div>DESCRIPTION</div>
              <div>HSN</div>
              <div>QTY / HOURS</div>
              <div>RATE (₹)</div>
              <div className="amount-col">AMOUNT (₹)</div>
              <div></div>
            </div>
            <div className="de-item-list">
              {rows.map((r, i) => (
                <LineItemRow
                  key={r.key}
                  index={i}
                  row={r}
                  amount={lineCalcs[i].amount}
                  dragging={dragIdx === i}
                  dropAbove={overIdx === i && dragIdx !== i && overPos === 'above'}
                  dropBelow={overIdx === i && dragIdx !== i && overPos === 'below'}
                  onChange={patch => updateRow(r.key, patch)}
                  onDuplicate={() => duplicateRow(r.key)}
                  onDelete={() => removeRow(r.key)}
                  onDragStart={e => onItemDragStart(e, i)}
                  onDragOver={e => onItemDragOver(e, i)}
                  onDrop={e => onItemDrop(e, i)}
                  onDragEnd={onItemDragEnd}
                />
              ))}
            </div>
            <div className="de-item-footer">
              <span className="meta" />
              <button className="de-add-line" onClick={addRow}><PlusIcon /> Add line item</button>
            </div>
          </div>

          {/* Terms — estimate (compact list, always visible) */}
          {kind === 'quotation' && (
            <div className="de-card">
              <div className="de-section-head">
                <h3>Terms &amp; conditions</h3>
                <span className="meta">Shown on the estimate PDF</span>
              </div>
              <TermsList terms={terms} onChange={setTerms} />
            </div>
          )}

          {/* More options — invoice only (Shipping / Notes / Terms / Advanced) */}
          {kind === 'invoice' && (
            <div className="de-more">
              <button
                type="button"
                className={`de-more-head${moreOpen ? ' open' : ''}`}
                onClick={() => setMoreOpen(o => !o)}
              >
                <span>More options</span>
                <span className="de-more-sub">Shipping · Notes · Terms · Advanced</span>
                <ChevronDownIcon />
              </button>
              {moreOpen && (
                <div className="de-more-body">
                  {/* Shipping */}
                  <div className="de-card">
                    <div className="de-section-head">
                      <h3>Shipping</h3>
                      <label style={{ fontSize: 12, color: 'var(--de-text-soft)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={shippingEnabled}
                          onChange={e => setShippingEnabled(e.target.checked)}
                          style={{ accentColor: 'var(--de-accent)' }}
                        />
                        Include shipping address
                      </label>
                    </div>
                    {shippingEnabled && (
                      <textarea
                        className="de-textarea"
                        rows={2}
                        placeholder="Ship-to address (street, city, state, pin)"
                        value={shippingAddress}
                        onChange={e => setShippingAddress(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Notes */}
                  <div className="de-card">
                    <h3>Notes</h3>
                    <textarea
                      className="de-textarea"
                      rows={3}
                      placeholder="Internal notes or remarks shown on the PDF"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Terms */}
                  <div className="de-card">
                    <div className="de-section-head">
                      <h3>Terms &amp; conditions</h3>
                      <span className="meta">Editable defaults for PDF</span>
                    </div>
                    <TermsList terms={terms} onChange={setTerms} />
                  </div>

                  {/* Advanced */}
                  <div className="de-card">
                    <h3>Advanced</h3>
                    <p className="hint" style={{ marginBottom: 10 }}>Toggle GST and layout behaviour for the PDF.</p>
                    <div className="de-grid-2">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={summariseQty}
                          onChange={e => setSummariseQty(e.target.checked)}
                          style={{ accentColor: 'var(--de-accent)' }}
                        /> Show HSN summary on PDF
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: 'var(--de-accent)' }} />
                        Show place of supply
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: 'var(--de-accent)' }} />
                        Show tax summary
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right rail */}
        <div className="de-rail">
          <TotalsSidebar
            subtotal={subtotal}
            totalGst={gstTotal}
            cgst={cgstTotal}
            sgst={sgstTotal}
            total={grandTotal}
            itemCount={rows.length}
            discount={discount}
            additionalCharges={additionalCharges}
            summariseQty={summariseQty}
            onDiscountChange={setDiscount}
            onAdditionalChange={setAdditionalCharges}
            onSummariseChange={setSummariseQty}
          />
        </div>
      </div>
    </div>
  );
}
