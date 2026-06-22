import { useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { DocumentEditor } from './editor/DocumentEditor';
import { InvoicesTab } from './BillingTabs/InvoicesTab';
import { QuotationsTab } from './BillingTabs/QuotationsTab';
import { ProformasTab } from './BillingTabs/ProformasTab';
import { ChallansTab } from './BillingTabs/ChallansTab';
import { PaymentsTab } from './BillingTabs/PaymentsTab';
import { CreditNotesTab } from './BillingTabs/CreditNotesTab';
import { ClientsTab } from './BillingTabs/ClientsTab';
import { GSTTab } from './BillingTabs/GSTTab';
import { AgeingTab } from './BillingTabs/AgeingTab';
import './billing.css';

type BillTab = 'invoices' | 'quotations' | 'proformas' | 'challans' | 'payments' | 'credits' | 'clients' | 'gst' | 'ageing';

type BillingView =
  | 'list'
  | 'new-invoice'
  | 'edit-invoice'
  | 'new-quotation'
  | 'edit-quotation';

const TABS: Array<{ id: BillTab; label: string }> = [
  { id: 'invoices',   label: 'Invoices'      },
  { id: 'quotations', label: 'Estimates'     },
  { id: 'proformas',  label: 'Proformas'     },
  { id: 'challans',   label: 'Challans'      },
  { id: 'payments',   label: 'Payments'      },
  { id: 'credits',    label: 'Credit Notes'  },
  { id: 'clients',    label: 'Clients'       },
  { id: 'gst',        label: 'GST Filing'    },
  { id: 'ageing',     label: 'Ageing'        },
];

function tabCount(id: BillTab, state: ReturnType<typeof useApp>['state']): number {
  const map: Partial<Record<BillTab, number>> = {
    invoices:   state.invoices.length,
    quotations: state.quotations.length,
    proformas:  state.proformas.length,
    challans:   state.challans.length,
    payments:   state.payments.length,
    credits:    state.creditNotes.length,
    clients:    state.clients.length,
  };
  return map[id] ?? 0;
}

/* ---- Simple Payment Modal ---- */
interface AddPaymentModalProps {
  invoices: ReturnType<typeof useApp>['state']['invoices'];
  onSave: (data: { invoiceId: string; date: string; amount: number; method: string; reference: string }) => void;
  onClose: () => void;
}

function AddPaymentModal({ invoices, onSave, onClose }: AddPaymentModalProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');

  const handleSave = () => {
    if (!invoiceId || !date || !amount) return;
    onSave({ invoiceId, date, amount: parseFloat(amount), method, reference });
  };

  return (
    <div className="bl-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bl-modal">
        <div className="bl-modal-title">Record Payment</div>
        <div className="bl-form-row">
          <label>Invoice</label>
          <select className="bl-form-select" value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
            <option value="">Select invoice…</option>
            {invoices.filter(i => i.status !== 'paid').map(i => (
              <option key={i.id} value={i.id}>{i.number} — ₹{i.total}</option>
            ))}
          </select>
        </div>
        <div className="bl-form-row-2">
          <div className="bl-form-row">
            <label>Date</label>
            <input type="date" className="bl-form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="bl-form-row">
            <label>Amount (₹)</label>
            <input type="number" className="bl-form-input" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="bl-form-row-2">
          <div className="bl-form-row">
            <label>Method</label>
            <select className="bl-form-select" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="">Select…</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="bl-form-row">
            <label>Reference</label>
            <input className="bl-form-input" placeholder="Cheque no. / UTR…" value={reference} onChange={e => setReference(e.target.value)} />
          </div>
        </div>
        <div className="bl-modal-actions">
          <button className="bl-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="bl-modal-save" onClick={handleSave} disabled={!invoiceId || !date || !amount}>
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- BillingPage ---- */
export function BillingPage({ active }: { active: boolean }) {
  const { state, setState, save, showToast } = useApp();
  const { invoices, quotations, proformas, challans, payments, creditNotes, clients } = state;

  const [activeTab, setActiveTab] = useState<BillTab>('invoices');
  const [view, setView] = useState<BillingView>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const goList = () => { setView('list'); setEditingId(null); };

  const openNewInvoice = () => {
    setEditingId(null);
    setView('new-invoice');
  };

  const openEditInvoice = (id: string) => {
    setEditingId(id);
    setView('edit-invoice');
    setActiveTab('invoices');
  };

  const openNewQuotation = () => {
    setEditingId(null);
    setView('new-quotation');
  };

  const openEditQuotation = (id: string) => {
    setEditingId(id);
    setView('edit-quotation');
    setActiveTab('quotations');
  };

  const nextInvoiceNumber = `INV-${String(invoices.length + 1).padStart(4, '0')}`;
  const nextQuotationNumber = `QT-${String(quotations.length + 1).padStart(4, '0')}`;

  /* ---- Editor views (full-page replacement) ----
     Wrapped in a `.page` container gated by `active` so the editor is hidden
     by the global `.page:not(.active)` rule when the user switches to another
     page (Fleet/GPS) without closing it — otherwise its elements bleed through. */
  let editorEl: ReactNode = null;
  if (view === 'new-invoice') {
    editorEl = (
      <DocumentEditor
        kind="invoice"
        mode="create"
        defaultNumber={nextInvoiceNumber}
        onCancel={goList}
        onSaved={() => { goList(); setActiveTab('invoices'); }}
      />
    );
  } else if (view === 'edit-invoice' && editingId) {
    const inv = invoices.find(i => i.id === editingId);
    editorEl = (
      <DocumentEditor
        kind="invoice"
        mode="edit"
        documentId={editingId}
        defaultNumber={inv?.number || nextInvoiceNumber}
        onCancel={goList}
        onSaved={goList}
      />
    );
  } else if (view === 'new-quotation') {
    editorEl = (
      <DocumentEditor
        kind="quotation"
        mode="create"
        defaultNumber={nextQuotationNumber}
        onCancel={goList}
        onSaved={() => { goList(); setActiveTab('quotations'); }}
      />
    );
  } else if (view === 'edit-quotation' && editingId) {
    const qt = quotations.find(q => q.id === editingId);
    editorEl = (
      <DocumentEditor
        kind="quotation"
        mode="edit"
        documentId={editingId}
        defaultNumber={qt?.number || nextQuotationNumber}
        onCancel={goList}
        onSaved={goList}
      />
    );
  }

  if (editorEl) {
    return (
      <div className={`page billing-page ${active ? 'active' : ''}`} id="page-billing">
        {editorEl}
      </div>
    );
  }

  /* ---- Delete helpers ---- */
  const deleteInvoice = (id: string) => {
    setState(prev => ({ ...prev, invoices: prev.invoices.filter(i => i.id !== id) }));
    save();
    showToast('Invoice deleted');
  };

  const deleteQuotation = (id: string) => {
    setState(prev => ({ ...prev, quotations: prev.quotations.filter(q => q.id !== id) }));
    save();
    showToast('Quotation deleted');
  };

  const deleteProforma = (id: string) => {
    setState(prev => ({ ...prev, proformas: prev.proformas.filter(p => p.id !== id) }));
    save();
    showToast('Proforma deleted');
  };

  const deleteChallan = (id: string) => {
    setState(prev => ({ ...prev, challans: prev.challans.filter(c => c.id !== id) }));
    save();
    showToast('Challan deleted');
  };

  const deletePayment = (id: string) => {
    setState(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
    save();
    showToast('Payment deleted');
  };

  const deleteCreditNote = (id: string) => {
    setState(prev => ({ ...prev, creditNotes: prev.creditNotes.filter(c => c.id !== id) }));
    save();
    showToast('Credit note deleted');
  };

  /* ---- Convert quotation to invoice ---- */
  const convertQuotation = (id: string) => {
    const qt = quotations.find(q => q.id === id);
    if (!qt) return;
    const newInv = {
      ...qt,
      id: String(Date.now()),
      number: nextInvoiceNumber,
      dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })(),
      status: 'draft' as const,
      paidAmount: 0,
    };
    setState(prev => ({
      ...prev,
      invoices: [...prev.invoices, newInv],
      quotations: prev.quotations.map(q => q.id === id ? { ...q, status: 'accepted' as const } : q),
    }));
    save();
    showToast(`Converted to invoice ${newInv.number}`);
    setActiveTab('invoices');
  };

  /* ---- Add payment ---- */
  const addPayment = (data: { invoiceId: string; date: string; amount: number; method: string; reference: string }) => {
    const payment = {
      id: String(Date.now()),
      invoiceId: data.invoiceId,
      date: data.date,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
    };
    setState(prev => ({ ...prev, payments: [...prev.payments, payment] }));
    save();
    setShowPaymentModal(false);
    showToast(`Payment of ₹${data.amount} recorded`);
  };

  /* ---- List view ---- */
  return (
    <div className={`page billing-page ${active ? 'active' : ''}`} id="page-billing">

      {/* Header */}
      <header className="bl-header">
        <div className="bl-header-left">
          <h2>Billing</h2>
          <p>Manage invoices, payments, and GST compliance</p>
        </div>
        <div className="bl-header-actions">
          <button
            className="btn-sm outline"
            onClick={openNewQuotation}
            style={{ height: 40, padding: '0 18px', borderRadius: 12, fontWeight: 700 }}
          >
            New Estimate
          </button>
          <button
            className="btn-sm accent"
            onClick={openNewInvoice}
            style={{ height: 40, padding: '0 18px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Invoice
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bl-tab-bar">
        {TABS.map(t => {
          const count = tabCount(t.id, state);
          return (
            <button
              key={t.id}
              className={`bl-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {count > 0 && <span className="bl-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'invoices' && (
        <InvoicesTab
          invoices={invoices}
          payments={payments}
          creditNotes={creditNotes}
          clients={clients}
          onNew={openNewInvoice}
          onEdit={openEditInvoice}
          onDelete={deleteInvoice}
        />
      )}

      {activeTab === 'quotations' && (
        <QuotationsTab
          quotations={quotations}
          clients={clients}
          onNew={openNewQuotation}
          onEdit={openEditQuotation}
          onDelete={deleteQuotation}
          onConvert={convertQuotation}
        />
      )}

      {activeTab === 'proformas' && (
        <ProformasTab
          proformas={proformas}
          clients={clients}
          onDelete={deleteProforma}
        />
      )}

      {activeTab === 'challans' && (
        <ChallansTab
          challans={challans}
          clients={clients}
          onDelete={deleteChallan}
        />
      )}

      {activeTab === 'payments' && (
        <PaymentsTab
          payments={payments}
          invoices={invoices}
          onDelete={deletePayment}
          onAddPayment={() => setShowPaymentModal(true)}
        />
      )}

      {activeTab === 'credits' && (
        <CreditNotesTab
          creditNotes={creditNotes}
          invoices={invoices}
          onDelete={deleteCreditNote}
        />
      )}

      {activeTab === 'clients' && (
        <ClientsTab
          clients={clients}
          invoices={invoices}
          payments={payments}
          creditNotes={creditNotes}
        />
      )}

      {activeTab === 'gst' && (
        <GSTTab invoices={invoices} />
      )}

      {activeTab === 'ageing' && (
        <AgeingTab
          invoices={invoices}
          payments={payments}
          creditNotes={creditNotes}
          clients={clients}
          onViewInvoice={openEditInvoice}
        />
      )}

      {/* Add Payment modal */}
      {showPaymentModal && (
        <AddPaymentModal
          invoices={invoices}
          onSave={addPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
