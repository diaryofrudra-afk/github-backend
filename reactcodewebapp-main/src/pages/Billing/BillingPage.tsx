import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, todayISO } from '../../utils';
import type { Client, Invoice, Payment, CreditNote, Quotation, Challan, InvoiceItem } from '../../types';

type BillTab = 'invoices' | 'quotations' | 'proforma' | 'challans' | 'clients' | 'payments' | 'credits' | 'gst' | 'ageing' | 'pnl' | 'ledger';

function getFY() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return y + '-' + String(y + 1).slice(2);
}

export function BillingPage({ active }: { active: boolean }) {
  const { state, setState, showToast, save } = useApp();
  const { invoices, clients, payments, creditNotes, quotations, proformas, challans, cranes, timesheets, ownerProfile, fuelLogs } = state;

  const [activeTab, setActiveTab] = useState<BillTab>('invoices');

  // Client modal
  const [clientModal, setClientModal] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [clName, setClName] = useState('');
  const [clContact, setClContact] = useState('');
  const [clGstin, setClGstin] = useState('');
  const [clAddress, setClAddress] = useState('');
  const [clCity, setClCity] = useState('');
  const [clState, setClState] = useState('');
  const [clPhone, setClPhone] = useState('');
  const [clEmail, setClEmail] = useState('');

  // Invoice modal
  const [invModal, setInvModal] = useState(false);
  const [invDate, setInvDate] = useState(todayISO());
  const [invDue, setInvDue] = useState('');
  const [invClientId, setInvClientId] = useState('');
  const [invAsset, setInvAsset] = useState('');
  const [invFrom, setInvFrom] = useState('');
  const [invTo, setInvTo] = useState('');
  const [invNotes, setInvNotes] = useState('');

  // Payment modal
  const [payModal, setPayModal] = useState(false);
  const [payInvId, setPayInvId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');

  // Credit note modal
  const [cnModal, setCnModal] = useState(false);
  const [cnInvId, setCnInvId] = useState('');
  const [cnAmount, setCnAmount] = useState('');
  const [cnDate, setCnDate] = useState(todayISO());
  const [cnReason, setCnReason] = useState('');

  // Quotation modal
  const [qtModal, setQtModal] = useState(false);
  const [qtDate, setQtDate] = useState(todayISO());
  const [qtValid, setQtValid] = useState('');
  const [qtClientId, setQtClientId] = useState('');
  const [qtAsset, setQtAsset] = useState('');
  const [qtNotes, setQtNotes] = useState('');
  const [qtItems, setQtItems] = useState<Array<{ desc: string; hrs: number; rate: number }>>([]);
  const [qtItemDesc, setQtItemDesc] = useState('');
  const [qtItemHrs, setQtItemHrs] = useState('');
  const [qtItemRate, setQtItemRate] = useState('');

  // Challan modal
  const [chModal, setChModal] = useState(false);
  const [chDate, setChDate] = useState(todayISO());
  const [chClientId, setChClientId] = useState('');
  const [chAsset, setChAsset] = useState('');
  const [chSite, setChSite] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chNotes, setChNotes] = useState('');

  // Ledger asset
  const [ledgerReg, setLedgerReg] = useState(cranes.length ? cranes[0].reg : '');

  // Helpers
  const getClient = (id: string | number) => clients.find(c => String(c.id) === String(id));
  const getInvPayments = (invId: string | number) => payments.filter(p => String(p.invoiceId) === String(invId));
  const getInvCredits = (invId: string | number) => creditNotes.filter(c => String(c.invoiceId) === String(invId));
  const getInvPaid = (invId: string | number) => getInvPayments(invId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const getInvCredited = (invId: string | number) => getInvCredits(invId).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const getInvBalance = (inv: Invoice) => inv.total - getInvPaid(inv.id) - getInvCredited(inv.id);
  const getInvStatus = (inv: Invoice) => {
    const bal = getInvBalance(inv);
    if (bal <= 0) return 'paid';
    if (getInvPaid(inv.id) > 0 || getInvCredited(inv.id) > 0) return 'partial';
    if (inv.dueDate && new Date(inv.dueDate) < new Date()) return 'overdue';
    return 'pending';
  };

  const nextInvNum = () => {
    const fy = getFY();
    const prefix = (ownerProfile.company || 'SUP').replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase();
    const n = invoices.filter(i => (i.number || '').includes(fy)).length + 1;
    return prefix + '/' + fy + '-' + String(n).padStart(4, '0');
  };
  const nextQTNum = () => { const fy = getFY(); const n = quotations.filter(q => (q.number || '').includes(fy)).length + 1; return 'QT/' + fy + '-' + String(n).padStart(4, '0'); };
const nextCNNum = () => { const fy = getFY(); const n = creditNotes.filter(c => (c.number || '').includes(fy)).length + 1; return 'CN/' + fy + '-' + String(n).padStart(4, '0'); };
  const nextCHNum = () => { const fy = getFY(); const n = challans.filter(c => (c.number || '').includes(fy)).length + 1; return 'DC/' + fy + '-' + String(n).padStart(4, '0'); };

  // KPIs
  const totalInv = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + getInvPaid(i.id), 0);
  const totalCredited = invoices.reduce((s, i) => s + getInvCredited(i.id), 0);
  const totalPending = totalInv - totalPaid - totalCredited;
  const totalGST = invoices.reduce((s, i) => s + (i.sgst || 0) + (i.cgst || 0), 0);
  const pendingCount = invoices.filter(i => getInvStatus(i) !== 'paid').length;

  // Invoice preview helper
  const getInvPreview = () => {
    if (!invAsset) return null;
    const crane = cranes.find(c => c.reg === invAsset);
    if (!crane || !crane.operator) return null;
    const opTs = (timesheets[crane.operator] || []).filter(e => {
      if (!invFrom && !invTo) return true;
      const d = (e as { dateISO?: string; date: string }).dateISO || e.date;
      return (!invFrom || d >= invFrom) && (!invTo || d <= invTo);
    });
    let sub = 0, sgst = 0, cgst = 0;
    opTs.forEach(e => {
      const h = Number(e.hoursDecimal) || 0;
      const sgstVal = Math.round(h * (Number(crane.rate) || 0) * 0.09 * 100) / 100;
      const cgstVal = sgstVal;
      sub += h * (Number(crane.rate) || 0);
      sgst += sgstVal;
      cgst += cgstVal;
    });
    return { entries: opTs.length, sub, sgst, cgst, total: sub + sgst + cgst };
  };
  const invPreview = invAsset ? getInvPreview() : null;

  // Quotation totals
  const qtSubtotal = qtItems.reduce((s, it) => s + it.hrs * it.rate, 0);
  const qtSGST = Math.round(qtSubtotal * 0.09 * 100) / 100;
  const qtCGST = qtSGST;

  // Handlers
  const openClientModal = (id?: string) => {
    const cl = id ? clients.find(c => String(c.id) === id) : null;
    setEditClientId(id || null);
    setClName(cl?.name || '');
    setClContact(cl?.contactPerson || '');
    setClGstin(cl?.gstin || '');
    setClAddress(cl?.address || '');
    setClCity(cl?.city || '');
    setClState(cl?.state || '');
    setClPhone(cl?.phone || '');
    setClEmail(cl?.email || '');
    setClientModal(true);
  };

  const saveClient = () => {
    if (!clName.trim()) return showToast('Client name is required', 'error');
    const data: Partial<Client> & { name: string } = {
      name: clName.trim(), contactPerson: clContact.trim(), gstin: clGstin.trim().toUpperCase(),
      address: clAddress.trim(), city: clCity.trim(), state: clState.trim(), phone: clPhone.trim(), email: clEmail.trim()
    };
    setState(prev => {
      if (editClientId) {
        return { ...prev, clients: prev.clients.map(c => String(c.id) === editClientId ? { ...c, ...data } : c) };
      }
      return { ...prev, clients: [...prev.clients, { ...data, id: String(Date.now()) }] };
    });
    save();
    setClientModal(false);
    showToast(editClientId ? 'Client updated.' : 'Client added.');
  };

  const deleteClient = (id: string) => {
    if (!confirm('Remove this client?')) return;
    setState(prev => ({ ...prev, clients: prev.clients.filter(c => String(c.id) !== id) }));
    save();
    showToast('Client removed.');
  };

  const openInvModal = () => {
    const due = new Date(); due.setDate(due.getDate() + 30);
    setInvDate(todayISO()); setInvDue(due.toISOString().slice(0, 10));
    setInvClientId(''); setInvAsset(''); setInvFrom(''); setInvTo(''); setInvNotes('');
    setInvModal(true);
  };

  const saveInvoice = () => {
    if (!invClientId) return showToast('Select a client', 'error');
    if (!invAsset) return showToast('Select an asset', 'error');
    const crane = cranes.find(c => c.reg === invAsset);
    if (!crane || !crane.operator) return showToast('Asset has no operator', 'error');
    const opTs = (timesheets[crane.operator] || []).filter(e => {
      if (!invFrom && !invTo) return true;
      const d = (e as { dateISO?: string; date: string }).dateISO || e.date;
      return (!invFrom || d >= invFrom) && (!invTo || d <= invTo);
    });
    if (!opTs.length) return showToast('No timesheet entries in this period', 'error');
    let subtotal = 0, sgst = 0, cgst = 0;
    const items: InvoiceItem[] = opTs.map(e => {
      const h = Number(e.hoursDecimal) || 0;
      const rate = Number(crane.rate) || 0;
      const sub = h * rate;
      const sg = Math.round(sub * 0.09 * 100) / 100;
      const cg = sg;
      subtotal += sub; sgst += sg; cgst += cg;
      return { description: `${e.date} ${e.startTime}–${e.endTime}`, qty: h, rate, amount: sub };
    });
    const inv: Invoice = {
      id: String(Date.now()), number: nextInvNum(), date: invDate || todayISO(), dueDate: invDue,
      clientId: invClientId, assetReg: invAsset, items, subtotal, sgst, cgst,
      total: subtotal + sgst + cgst, status: 'draft', paidAmount: 0, notes: invNotes.trim()
    };
    setState(prev => ({ ...prev, invoices: [...prev.invoices, inv] }));
    save();
    setInvModal(false);
    showToast(`Invoice ${inv.number} created — ${fmtINR(inv.total)}`);
  };

  const deleteInvoice = (id: string) => {
    if (!confirm('Delete this invoice and all associated payments/credits?')) return;
    setState(prev => ({
      ...prev,
      invoices: prev.invoices.filter(i => i.id !== id),
      payments: prev.payments.filter(p => p.invoiceId !== id),
      creditNotes: prev.creditNotes.filter(c => c.invoiceId !== id),
    }));
    save();
    showToast('Invoice deleted.');
  };

  const openPayModal = (invId: string) => {
    const inv = invoices.find(i => i.id === invId); if (!inv) return;
    const bal = getInvBalance(inv);
    setPayInvId(invId);
    setPayAmount(bal > 0 ? String(Math.round(bal)) : '');
    setPayDate(todayISO()); setPayMethod('UPI'); setPayRef('');
    setPayModal(true);
  };

  const savePayment = () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return showToast('Enter a valid amount', 'error');
    const inv = invoices.find(i => i.id === payInvId); if (!inv) return;
    const p: Payment = { id: String(Date.now()), invoiceId: inv.id, date: payDate || todayISO(), amount: amt, method: payMethod, reference: payRef.trim() };
    setState(prev => ({ ...prev, payments: [...prev.payments, p] }));
    save();
    setPayModal(false);
    showToast(`Payment of ${fmtINR(amt)} recorded against ${inv.number}`);
  };

  const openCNModal = (invId: string) => {
    setCnInvId(invId); setCnAmount(''); setCnDate(todayISO()); setCnReason('');
    setCnModal(true);
  };

  const saveCreditNote = () => {
    const amt = Number(cnAmount);
    if (!amt || amt <= 0) return showToast('Enter credit amount', 'error');
    if (!cnReason.trim()) return showToast('Enter a reason', 'error');
    const inv = invoices.find(i => i.id === cnInvId); if (!inv) return;
    const cn: CreditNote = { id: String(Date.now()), number: nextCNNum(), date: cnDate || todayISO(), invoiceId: inv.id, amount: amt, reason: cnReason.trim() };
    setState(prev => ({ ...prev, creditNotes: [...prev.creditNotes, cn] }));
    save();
    setCnModal(false);
    showToast(`Credit note ${cn.number} issued — ${fmtINR(amt)}`);
  };

  const openQtModal = () => {
    const valid = new Date(); valid.setDate(valid.getDate() + 15);
    setQtDate(todayISO()); setQtValid(valid.toISOString().slice(0, 10));
    setQtClientId(''); setQtAsset(''); setQtNotes(''); setQtItems([]);
    setQtItemDesc(''); setQtItemHrs(''); setQtItemRate('');
    setQtModal(true);
  };

  const addQtItem = () => {
    if (!qtItemDesc.trim() || !Number(qtItemHrs) || !Number(qtItemRate))
      return showToast('Fill description, hours and rate', 'error');
    setQtItems(prev => [...prev, { desc: qtItemDesc.trim(), hrs: Number(qtItemHrs), rate: Number(qtItemRate) }]);
    setQtItemDesc(''); setQtItemHrs(''); setQtItemRate('');
  };

  const saveQuotation = () => {
    if (!qtClientId) return showToast('Select a client', 'error');
    if (!qtAsset) return showToast('Select an asset', 'error');
    if (!qtItems.length) return showToast('Add at least one line item', 'error');
    let subtotal = 0; qtItems.forEach(it => subtotal += it.hrs * it.rate);
    const sgst = Math.round(subtotal * 0.09 * 100) / 100;
    const cgst = sgst;
    const qt: Quotation = {
      id: String(Date.now()), number: nextQTNum(), date: qtDate || todayISO(), validUntil: qtValid,
      clientId: qtClientId, assetReg: qtAsset,
      items: qtItems.map(it => ({ description: it.desc, qty: it.hrs, rate: it.rate, amount: it.hrs * it.rate })),
      subtotal, sgst, cgst, total: subtotal + sgst + cgst, status: 'draft', notes: qtNotes.trim()
    };
    setState(prev => ({ ...prev, quotations: [...prev.quotations, qt] }));
    save();
    setQtModal(false);
    showToast(`Quotation ${qt.number} created — ${fmtINR(qt.total)}`);
  };

  const updateQtStatus = (id: string, status: Quotation['status']) => {
    setState(prev => ({ ...prev, quotations: prev.quotations.map(q => q.id === id ? { ...q, status } : q) }));
    save();
    showToast(`Quotation → ${status}`);
  };

  const convertQtToInvoice = (qtId: string) => {
    const qt = quotations.find(q => q.id === qtId); if (!qt) return;
    const due = new Date(); due.setDate(due.getDate() + 30);
    const inv: Invoice = {
      id: String(Date.now()), number: nextInvNum(), date: todayISO(), dueDate: due.toISOString().slice(0, 10),
      clientId: qt.clientId, assetReg: qt.assetReg, items: qt.items,
      subtotal: qt.subtotal, sgst: qt.sgst, cgst: qt.cgst, total: qt.total,
      status: 'draft', paidAmount: 0, notes: `Converted from ${qt.number}${qt.notes ? ' · ' + qt.notes : ''}`
    };
    setState(prev => ({
      ...prev,
      invoices: [...prev.invoices, inv],
      quotations: prev.quotations.map(q => q.id === qtId ? { ...q, status: 'accepted' as const } : q),
    }));
    save();
    showToast(`Invoice ${inv.number} created from ${qt.number}`);
  };

  const deleteQuotation = (id: string) => {
    if (!confirm('Remove this quotation?')) return;
    setState(prev => ({ ...prev, quotations: prev.quotations.filter(q => q.id !== id) }));
    save();
  };

  const convertPfToInvoice = (pfId: string) => {
    const pf = proformas.find(p => p.id === pfId); if (!pf) return;
    const due = new Date(); due.setDate(due.getDate() + 30);
    const inv: Invoice = {
      id: String(Date.now()), number: nextInvNum(), date: todayISO(), dueDate: due.toISOString().slice(0, 10),
      clientId: pf.clientId, assetReg: pf.assetReg, items: pf.items,
      subtotal: pf.subtotal, sgst: pf.sgst, cgst: pf.cgst, total: pf.total,
      status: 'draft', paidAmount: 0, notes: `From proforma ${pf.number}`
    };
    setState(prev => ({
      ...prev,
      invoices: [...prev.invoices, inv],
      proformas: prev.proformas.map(p => p.id === pfId ? { ...p, status: 'converted' } : p),
    }));
    save();
    showToast(`Invoice ${inv.number} created from ${pf.number}`);
  };

  const openChModal = () => {
    setChDate(todayISO()); setChClientId(''); setChAsset(''); setChSite(''); setChDesc(''); setChNotes('');
    setChModal(true);
  };

  const saveChallan = () => {
    if (!chClientId) return showToast('Select a client', 'error');
    if (!chAsset) return showToast('Select an asset', 'error');
    const ch: Challan = {
      id: String(Date.now()), number: nextCHNum(), date: chDate || todayISO(),
      clientId: chClientId, assetReg: chAsset, site: chSite.trim(),
      items: [{ description: chDesc.trim(), qty: 1, rate: 0, amount: 0 }],
      status: 'dispatched', notes: chNotes.trim()
    };
    setState(prev => ({ ...prev, challans: [...prev.challans, ch] }));
    save();
    setChModal(false);
    showToast(`Challan ${ch.number} issued`);
  };

  const updateChallanStatus = (id: string, status: string) => {
    setState(prev => ({ ...prev, challans: prev.challans.map(c => c.id === id ? { ...c, status } : c) }));
    save();
    showToast(`Challan → ${status}`);
  };

  const deleteChallan = (id: string) => {
    if (!confirm('Remove this challan?')) return;
    setState(prev => ({ ...prev, challans: prev.challans.filter(c => c.id !== id) }));
    save();
  };

  const tabs: Array<{ id: BillTab; label: string }> = [
    { id: 'invoices', label: `Invoices (${invoices.length})` },
    { id: 'quotations', label: `Quotations (${quotations.length})` },
    { id: 'proforma', label: 'Proforma' },
    { id: 'challans', label: 'Challans' },
    { id: 'clients', label: `Clients (${clients.length})` },
    { id: 'payments', label: 'Payments' },
    { id: 'credits', label: 'Credit Notes' },
    { id: 'gst', label: 'GST' },
    { id: 'ageing', label: 'Ageing' },
    { id: 'pnl', label: 'P&L' },
    { id: 'ledger', label: 'Ledger' },
  ];

  const renderInvoicesTab = () => (
    <div>
      {!invoices.length ? (
        <div className="empty-state"><h4>No Invoices</h4><p>Create your first GST invoice from timesheet data.</p></div>
      ) : (
        [...invoices].reverse().map(inv => {
          const cl = getClient(inv.clientId);
          const st = getInvStatus(inv);
          const bal = getInvBalance(inv);
          const paid = getInvPaid(inv.id);
          return (
            <div key={inv.id} className={`inv-card ${st}`}>
              <div className="inv-head">
                <div>
                  <div className="inv-num">{inv.number}</div>
                  <div className="inv-client">{cl ? cl.name : '—'} · {inv.assetReg || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`inv-status ${st}`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />
                    {st === 'paid' ? 'Paid' : st === 'partial' ? 'Partial' : st === 'overdue' ? 'Overdue' : 'Pending'}
                  </span>
                  <div style={{ fontSize: 9, color: 'var(--t4)', marginTop: 3 }}>{inv.date}</div>
                </div>
              </div>
              <div className="inv-body">
                <div className="inv-col"><div className="inv-col-lbl">Subtotal</div><div className="inv-col-val">{fmtINR(inv.subtotal)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">SGST 9%</div><div className="inv-col-val">{fmtINR(inv.sgst)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">CGST 9%</div><div className="inv-col-val">{fmtINR(inv.cgst)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Total</div><div className="inv-col-val accent">{fmtINR(inv.total)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Paid</div><div className="inv-col-val green">{fmtINR(paid)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Balance</div><div className={`inv-col-val ${bal > 0 ? 'amber' : 'green'}`}>{fmtINR(bal)}</div></div>
                <div className="inv-actions">
                  {st !== 'paid' && <button className="ca-btn c-grn" onClick={() => openPayModal(inv.id)} title="Record payment">Pay</button>}
                  {st !== 'paid' && <button className="ca-btn c-amb" onClick={() => openCNModal(inv.id)} title="Credit note">CN</button>}
                  <button className="ca-btn c-red" onClick={() => deleteInvoice(inv.id)} title="Delete">Del</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderClientsTab = () => (
    <div>
      {!clients.length ? (
        <div className="empty-state"><h4>No Clients</h4><p>Add your first client to start invoicing.</p></div>
      ) : (
        clients.map(cl => {
          const clInvs = invoices.filter(i => String(i.clientId) === String(cl.id));
          const totalBilled = clInvs.reduce((s, i) => s + i.total, 0);
          void (totalBilled - clInvs.reduce((s, i) => s + getInvPaid(i.id) + getInvCredited(i.id), 0));
          const initials = cl.name.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={cl.id} className="client-card">
              <div className="client-av">{initials}</div>
              <div className="client-info">
                <div className="client-name">{cl.name}</div>
                <div className="client-meta">
                  {cl.gstin && <span>GSTIN: {cl.gstin}</span>}
                  {cl.city && <span>{cl.city}</span>}
                  {cl.phone && <span>{cl.phone}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="ca-btn c-acc" onClick={() => openClientModal(String(cl.id))}>Edit</button>
                <button className="ca-btn c-red" onClick={() => deleteClient(String(cl.id))}>Del</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderPaymentsTab = () => (
    !payments.length ? (
      <div className="empty-msg">No payments recorded yet.</div>
    ) : (
      <div className="bill-table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
          <tbody>
            {[...payments].reverse().map(p => {
              const inv = invoices.find(i => i.id === p.invoiceId);
              const cl = inv ? getClient(inv.clientId) : null;
              return (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{inv ? inv.number : '—'}</td>
                  <td>{cl ? cl.name : '—'}</td>
                  <td><span className="bill-badge" style={{ background: 'var(--green-s)', color: 'var(--green)', borderColor: 'var(--green-g)' }}>{fmtINR(p.amount)}</span></td>
                  <td style={{ fontSize: 10 }}>{p.method}</td>
                  <td style={{ fontSize: 10 }}>{p.reference || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const renderCreditsTab = () => (
    !creditNotes.length ? (
      <div className="empty-msg">No credit notes issued yet.</div>
    ) : (
      <div className="bill-table-wrap">
        <table className="data-table">
          <thead><tr><th>CN #</th><th>Date</th><th>Invoice</th><th>Amount</th><th>Reason</th></tr></thead>
          <tbody>
            {[...creditNotes].reverse().map(cn => {
              const inv = invoices.find(i => i.id === cn.invoiceId);
              return (
                <tr key={cn.id}>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>{cn.number}</td>
                  <td>{cn.date}</td>
                  <td style={{ color: 'var(--accent)' }}>{inv ? inv.number : '—'}</td>
                  <td><span className="bill-badge" style={{ background: 'var(--red-s)', color: 'var(--red)' }}>{fmtINR(cn.amount)}</span></td>
                  <td style={{ fontSize: 10 }}>{cn.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const renderGSTTab = () => {
    const totalSGST = invoices.reduce((s, i) => s + (i.sgst || 0), 0);
    const totalCGST = invoices.reduce((s, i) => s + (i.cgst || 0), 0);
    const totalGSTAmt = totalSGST + totalCGST;
    const creditedGST = creditNotes.reduce((s, cn) => { const gstRate = 0.18; return s + Math.round(cn.amount * gstRate / (1 + gstRate) * 100) / 100; }, 0);
    const netGST = totalGSTAmt - creditedGST;
    const monthly: Record<string, { subtotal: number; sgst: number; cgst: number; total: number; count: number }> = {};
    invoices.forEach(inv => {
      const m = (inv.date || '').slice(0, 7); if (!m) return;
      if (!monthly[m]) monthly[m] = { subtotal: 0, sgst: 0, cgst: 0, total: 0, count: 0 };
      monthly[m].subtotal += inv.subtotal || 0; monthly[m].sgst += inv.sgst || 0;
      monthly[m].cgst += inv.cgst || 0; monthly[m].total += inv.total || 0; monthly[m].count++;
    });
    const months = Object.keys(monthly).sort().reverse();
    return (
      <div>
        <div className="gst-grid">
          <div className="gst-cell"><div className="gst-cell-lbl">Total SGST (9%)</div><div className="gst-cell-val" style={{ color: 'var(--accent)' }}>{fmtINR(totalSGST)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Total CGST (9%)</div><div className="gst-cell-val" style={{ color: 'var(--accent)' }}>{fmtINR(totalCGST)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Credit Note GST</div><div className="gst-cell-val" style={{ color: 'var(--red)' }}>{fmtINR(creditedGST)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Net GST Liability</div><div className="gst-cell-val" style={{ color: netGST > 0 ? 'var(--amber)' : 'var(--green)' }}>{fmtINR(netGST)}</div></div>
        </div>
        <div className="bill-table-wrap">
          <table className="data-table">
            <thead><tr><th>Month</th><th>Invoices</th><th>Taxable Value</th><th>SGST 9%</th><th>CGST 9%</th><th>Invoice Total</th></tr></thead>
            <tbody>
              {!months.length ? <tr><td colSpan={6} className="empty-msg">No invoices yet.</td></tr> :
                months.map(m => {
                  const d = monthly[m];
                  return <tr key={m}><td style={{ fontWeight: 600 }}>{m}</td><td>{d.count}</td><td>{fmtINR(d.subtotal)}</td><td style={{ color: 'var(--accent)' }}>{fmtINR(d.sgst)}</td><td style={{ color: 'var(--accent)' }}>{fmtINR(d.cgst)}</td><td><span className="bill-badge">{fmtINR(d.total)}</span></td></tr>;
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderQuotationsTab = () => (
    <div>
      {!quotations.length ? (
        <div className="empty-state"><h4>No Quotations</h4><p>Create a quotation to send estimates to clients.</p></div>
      ) : (
        [...quotations].reverse().map(qt => {
          const cl = getClient(qt.clientId);
          const st = qt.status || 'draft';
          const expired = qt.validUntil && new Date(qt.validUntil) < new Date() && st !== 'accepted';
          return (
            <div key={qt.id} className="inv-card">
              <div className="inv-head">
                <div>
                  <div className="inv-num">{qt.number}</div>
                  <div className="inv-client">{cl ? cl.name : '—'} · {qt.assetReg || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="inv-status">{st.charAt(0).toUpperCase() + st.slice(1)}</span>
                  {expired && <div style={{ fontSize: 8, color: 'var(--red)' }}>EXPIRED</div>}
                  <div style={{ fontSize: 9, color: 'var(--t4)', marginTop: 3 }}>{qt.date}</div>
                </div>
              </div>
              <div className="inv-body">
                <div className="inv-col"><div className="inv-col-lbl">Items</div><div className="inv-col-val">{qt.items?.length || 0}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Subtotal</div><div className="inv-col-val">{fmtINR(qt.subtotal)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Total</div><div className="inv-col-val accent">{fmtINR(qt.total)}</div></div>
                <div className="inv-actions">
                  {(st === 'draft' || st === 'sent') && <button className="btn-sm accent" style={{ padding: '3px 8px', fontSize: 8 }} onClick={() => updateQtStatus(qt.id, st === 'draft' ? 'sent' : 'accepted')}>{st === 'draft' ? 'Mark Sent' : 'Accept'}</button>}
                  {st === 'accepted' && <button className="btn-sm green" style={{ padding: '3px 8px', fontSize: 8 }} onClick={() => convertQtToInvoice(qt.id)}>→ Invoice</button>}
                  <button className="ca-btn c-red" onClick={() => deleteQuotation(qt.id)}>Del</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderProformaTab = () => (
    <div>
      {!proformas.length ? (
        <div className="empty-state"><h4>No Proforma Invoices</h4><p>Proformas are auto-generated when quotations are accepted.</p></div>
      ) : (
        [...proformas].reverse().map(pf => {
          const cl = getClient(pf.clientId);
          const converted = pf.status === 'converted';
          return (
            <div key={pf.id} className={`inv-card ${converted ? 'paid' : 'pending'}`}>
              <div className="inv-head">
                <div>
                  <div className="inv-num">{pf.number}</div>
                  <div className="inv-client">{cl ? cl.name : '—'} · {pf.assetReg || ''}</div>
                </div>
                <span className={`inv-status ${converted ? 'paid' : 'pending'}`}>{converted ? 'Invoiced' : 'Pending'}</span>
              </div>
              <div className="inv-body">
                <div className="inv-col"><div className="inv-col-lbl">Total</div><div className="inv-col-val accent">{fmtINR(pf.total)}</div></div>
                <div className="inv-col"><div className="inv-col-lbl">Date</div><div className="inv-col-val">{pf.date}</div></div>
                <div className="inv-actions">
                  {!converted && <button className="btn-sm green" style={{ padding: '3px 8px', fontSize: 8 }} onClick={() => convertPfToInvoice(pf.id)}>→ Invoice</button>}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderChallansTab = () => (
    <div>
      {!challans.length ? (
        <div className="empty-state"><h4>No Delivery Challans</h4><p>Issue a challan when dispatching equipment to a client site.</p></div>
      ) : (
        [...challans].reverse().map(ch => {
          const cl = getClient(ch.clientId);
          const st = ch.status || 'dispatched';
          return (
            <div key={ch.id} className="inv-card">
              <div className="inv-head">
                <div>
                  <div className="inv-num">{ch.number}</div>
                  <div className="inv-client">{cl ? cl.name : '—'} · {ch.assetReg || ''}</div>
                </div>
                <span className="inv-status">{st.charAt(0).toUpperCase() + st.slice(1)}</span>
              </div>
              <div className="inv-body">
                {ch.site && <div className="inv-col"><div className="inv-col-lbl">Site</div><div className="inv-col-val">{ch.site}</div></div>}
                <div className="inv-col"><div className="inv-col-lbl">Date</div><div className="inv-col-val">{ch.date}</div></div>
                <div className="inv-actions">
                  {st === 'dispatched' && <button className="btn-sm green" style={{ padding: '3px 8px', fontSize: 8 }} onClick={() => updateChallanStatus(ch.id, 'delivered')}>Delivered</button>}
                  {st === 'delivered' && <button className="btn-sm accent" style={{ padding: '3px 8px', fontSize: 8 }} onClick={() => updateChallanStatus(ch.id, 'returned')}>Returned</button>}
                  <button className="ca-btn c-red" onClick={() => deleteChallan(ch.id)}>Del</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderLedgerTab = () => {
    const activeLedgerReg = ledgerReg || (cranes.length ? cranes[0].reg : '');
    const crane = cranes.find(c => c.reg === activeLedgerReg);
    const opTs = crane && crane.operator ? (timesheets[crane.operator] || []) : [];
    let grandSub = 0, grandGST = 0, grandTotal = 0, totalHrs = 0;
    opTs.forEach(e => {
      const h = Number(e.hoursDecimal) || 0;
      if (crane) {
        const sub = h * (Number(crane.rate) || 0);
        const gst = sub * 0.18;
        grandSub += sub; grandGST += gst; grandTotal += sub + gst; totalHrs += h;
      }
    });
    return (
      <div>
        <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase' }}>Asset:</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {cranes.filter(c => c.operator && c.rate).map(c => (
              <span key={c.reg} className={`fpill${activeLedgerReg === c.reg ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setLedgerReg(c.reg)}>{c.reg}</span>
            ))}
          </div>
        </div>
        {crane && crane.operator && crane.rate ? (
          <div>
            <div className="bill-summary">
              <div className="bill-sum-label">Asset Ledger — {crane.reg}</div>
              <div className="bill-sum-amount">{fmtINR(grandTotal)}</div>
              <div className="bill-sum-meta">{opTs.length} ENTRIES · Subtotal: {fmtINR(grandSub)} · GST 18%: {fmtINR(grandGST)}</div>
            </div>
            <div className="bill-table-wrap">
              <table className="data-table">
                <thead><tr><th>Date / Shift</th><th>Hours</th><th>Subtotal</th><th>SGST 9%</th><th>CGST 9%</th><th>Total</th></tr></thead>
                <tbody>
                  {!opTs.length ? <tr><td colSpan={6} className="empty-msg">No logs yet.</td></tr> :
                    opTs.map(e => {
                      const h = Number(e.hoursDecimal) || 0;
                      const sub = h * (Number(crane.rate) || 0);
                      const sgst = Math.round(sub * 0.09 * 100) / 100;
                      const cgst = sgst;
                      return (
                        <tr key={e.id}>
                          <td>{e.date} {e.startTime}→{e.endTime}</td>
                          <td><span className="hours-badge">{h}h</span></td>
                          <td>{fmtINR(sub)}</td>
                          <td style={{ fontSize: 10, color: 'var(--t3)' }}>{fmtINR(sgst)}</td>
                          <td style={{ fontSize: 10, color: 'var(--t3)' }}>{fmtINR(cgst)}</td>
                          <td><span className="bill-badge">{fmtINR(sub + sgst + cgst)}</span></td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="empty-msg">Select an active asset with billing configured.</p>
        )}
      </div>
    );
  };

  const renderAgeingTab = () => {
    const now = new Date();
    const buckets = [{ label: 'Current (0–30d)', min: 0, max: 30 }, { label: '31–60d', min: 31, max: 60 }, { label: '61–90d', min: 61, max: 90 }, { label: '91–120d', min: 91, max: 120 }, { label: '120+d', min: 121, max: 9999 }];
    const clientData = clients.map(cl => {
      const clInvs = invoices.filter(i => String(i.clientId) === String(cl.id));
      const ageData = buckets.map(b => ({ ...b, amount: 0 }));
      let totalDue = 0;
      clInvs.forEach(inv => {
        const bal = getInvBalance(inv); if (bal <= 0) return;
        const invDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
        const days = Math.max(0, Math.floor((now.getTime() - invDate.getTime()) / 86400000));
        const bucket = ageData.find(b => days >= b.min && days <= b.max);
        if (bucket) bucket.amount += bal;
        totalDue += bal;
      });
      return { client: cl, totalDue, ageData };
    }).filter(d => d.totalDue > 0).sort((a, b) => b.totalDue - a.totalDue);
    const grandTotal = clientData.reduce((s, d) => s + d.totalDue, 0);
    return (
      <div>
        <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--t2)' }}>Total outstanding: <strong style={{ color: 'var(--t1)' }}>{fmtINR(grandTotal)}</strong> across <strong>{clientData.length}</strong> clients</div>
        {!clientData.length ? <div className="empty-msg">No outstanding dues. All invoices are settled.</div> : (
          <div className="bill-table-wrap">
            <table className="data-table">
              <thead><tr><th>Client</th><th>0–30d</th><th>31–60d</th><th>61–90d</th><th>91–120d</th><th>120d+</th><th>Total Due</th></tr></thead>
              <tbody>
                {clientData.map(d => (
                  <tr key={String(d.client.id)}>
                    <td style={{ fontWeight: 600 }}>{d.client.name}</td>
                    {d.ageData.map((b, i) => (
                      <td key={i} style={{ color: b.amount > 0 ? (i >= 2 ? 'var(--red)' : i >= 1 ? 'var(--amber)' : 'var(--t2)') : 'var(--t4)' }}>{b.amount > 0 ? fmtINR(b.amount) : '—'}</td>
                    ))}
                    <td><span className="bill-badge">{fmtINR(d.totalDue)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderPnLTab = () => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.subtotal, 0);
    const totalGSTCollected = invoices.reduce((s, i) => s + (i.sgst || 0) + (i.cgst || 0), 0);
    let fuelCost = 0; Object.values(fuelLogs).forEach(logs => (logs || []).forEach(e => fuelCost += Number(e.cost) || 0));
    const creditTotal = creditNotes.reduce((s, cn) => s + (Number(cn.amount) || 0), 0);
    const totalCosts = fuelCost;
    const grossProfit = totalInvoiced - totalCosts;
    const netProfit = grossProfit - creditTotal;
    const margin = totalInvoiced > 0 ? Math.round(grossProfit / totalInvoiced * 100) : 0;
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <div className="gst-cell"><div className="gst-cell-lbl">Total Invoiced</div><div className="gst-cell-val" style={{ color: 'var(--accent)' }}>{fmtINR(totalInvoiced)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Fuel Costs</div><div className="gst-cell-val" style={{ color: 'var(--red)' }}>{fmtINR(fuelCost)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Gross Profit</div><div className="gst-cell-val" style={{ color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtINR(grossProfit)}</div></div>
          <div className="gst-cell"><div className="gst-cell-lbl">Margin</div><div className="gst-cell-val" style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>{margin}%</div></div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t4)' }}>GST Collected: {fmtINR(totalGSTCollected)} · Net Profit (after credits): {fmtINR(netProfit)}</div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'invoices': return renderInvoicesTab();
      case 'clients': return renderClientsTab();
      case 'payments': return renderPaymentsTab();
      case 'credits': return renderCreditsTab();
      case 'gst': return renderGSTTab();
      case 'quotations': return renderQuotationsTab();
      case 'proforma': return renderProformaTab();
      case 'challans': return renderChallansTab();
      case 'ledger': return renderLedgerTab();
      case 'ageing': return renderAgeingTab();
      case 'pnl': return renderPnLTab();
      default: return null;
    }
  };

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-billing">
      {/* Header */}
      <div className="section-bar" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title">Billing & Invoicing</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>GST-compliant invoices · Client ledger · Payment tracking</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-sm accent" onClick={openInvModal}>+ Invoice</button>
          <button className="btn-sm accent" onClick={openQtModal}>+ Quotation</button>
          <button className="btn-sm outline" onClick={openChModal}>+ Challan</button>
          <button className="btn-sm green" onClick={() => openClientModal()}>+ Client</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="bill-kpi-row" style={{ marginBottom: 14 }}>
        <div className="bill-kpi"><div className="bill-kpi-val" style={{ color: 'var(--accent)' }}>{fmtINR(totalInv)}</div><div className="bill-kpi-lbl">Total Invoiced</div><div className="bill-kpi-sub">{invoices.length} invoices</div></div>
        <div className="bill-kpi"><div className="bill-kpi-val" style={{ color: 'var(--green)' }}>{fmtINR(totalPaid)}</div><div className="bill-kpi-lbl">Collected</div><div className="bill-kpi-sub">{payments.length} payments</div></div>
        <div className="bill-kpi"><div className="bill-kpi-val" style={{ color: totalPending > 0 ? 'var(--amber)' : 'var(--t3)' }}>{fmtINR(totalPending)}</div><div className="bill-kpi-lbl">Outstanding</div><div className="bill-kpi-sub">{pendingCount} pending</div></div>
        <div className="bill-kpi"><div className="bill-kpi-val" style={{ color: 'var(--red)' }}>{fmtINR(totalCredited)}</div><div className="bill-kpi-lbl">Credit Notes</div><div className="bill-kpi-sub">{creditNotes.length} issued</div></div>
        <div className="bill-kpi"><div className="bill-kpi-val" style={{ color: 'var(--violet)' }}>{fmtINR(totalGST)}</div><div className="bill-kpi-lbl">GST Liability</div><div className="bill-kpi-sub">SGST + CGST @ 18%</div></div>
      </div>

      {/* Tabs */}
      <div className="bill-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`bill-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ marginTop: 14 }}>{renderActiveTab()}</div>

      {/* ── Client Modal ── */}
      {clientModal && (
        <div className="overlay active" id="ov-client" onClick={e => { if ((e.target as HTMLElement).id === 'ov-client') setClientModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editClientId ? 'Edit Client' : 'Add Client'}</div>
              <button className="modal-close" onClick={() => setClientModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Name *</label><input className="form-input" value={clName} onChange={e => setClName(e.target.value)} placeholder="Client name" /></div>
              <div className="form-row"><label className="form-label">Contact Person</label><input className="form-input" value={clContact} onChange={e => setClContact(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">GSTIN</label><input className="form-input" value={clGstin} onChange={e => setClGstin(e.target.value.toUpperCase())} placeholder="22XXXXX..." /></div>
              <div className="form-row"><label className="form-label">Address</label><input className="form-input" value={clAddress} onChange={e => setClAddress(e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-row"><label className="form-label">City</label><input className="form-input" value={clCity} onChange={e => setClCity(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">State</label><input className="form-input" value={clState} onChange={e => setClState(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-row"><label className="form-label">Phone</label><input className="form-input" value={clPhone} onChange={e => setClPhone(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Email</label><input className="form-input" value={clEmail} onChange={e => setClEmail(e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveClient}>Save Client</button></div>
          </div>
        </div>
      )}

      {/* ── Invoice Modal ── */}
      {invModal && (
        <div className="overlay active" id="ov-invoice" onClick={e => { if ((e.target as HTMLElement).id === 'ov-invoice') setInvModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Create Invoice</div>
              <button className="modal-close" onClick={() => setInvModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={invDate} onChange={e => setInvDate(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Due Date</label><input type="date" className="form-input" value={invDue} onChange={e => setInvDue(e.target.value)} /></div>
              </div>
              <div className="form-row"><label className="form-label">Client *</label>
                <select className="form-select" value={invClientId} onChange={e => setInvClientId(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}{c.gstin ? ' · ' + c.gstin : ''}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Asset *</label>
                <select className="form-select" value={invAsset} onChange={e => setInvAsset(e.target.value)}>
                  <option value="">Select asset…</option>
                  {cranes.filter(c => c.rate).map(c => <option key={c.reg} value={c.reg}>{c.reg} · ₹{c.rate}/hr</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-row"><label className="form-label">From Date</label><input type="date" className="form-input" value={invFrom} onChange={e => setInvFrom(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">To Date</label><input type="date" className="form-input" value={invTo} onChange={e => setInvTo(e.target.value)} /></div>
              </div>
              {invPreview && (
                <div style={{ background: 'var(--bg4)', borderRadius: 'var(--rmd)', padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Invoice Preview</div>
                  <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                    {invPreview.entries} entries<br />
                    Subtotal: {fmtINR(invPreview.sub)}<br />
                    SGST: {fmtINR(invPreview.sgst)} · CGST: {fmtINR(invPreview.cgst)}<br />
                    <strong>Total: {fmtINR(invPreview.total)}</strong>
                  </div>
                </div>
              )}
              <div className="form-row"><label className="form-label">Notes</label><textarea className="form-input" value={invNotes} onChange={e => setInvNotes(e.target.value)} rows={2} /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveInvoice}>Create Invoice</button></div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {payModal && (
        <div className="overlay active" id="ov-payment" onClick={e => { if ((e.target as HTMLElement).id === 'ov-payment') setPayModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button className="modal-close" onClick={() => setPayModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Amount *</label><input type="number" className="form-input" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Method</label>
                <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option>UPI</option><option>NEFT</option><option>IMPS</option><option>Cheque</option><option>Cash</option>
                </select>
              </div>
              <div className="form-row"><label className="form-label">Reference</label><input className="form-input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UTR / Cheque no." /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={savePayment}>Record Payment</button></div>
          </div>
        </div>
      )}

      {/* ── Credit Note Modal ── */}
      {cnModal && (
        <div className="overlay active" id="ov-credit" onClick={e => { if ((e.target as HTMLElement).id === 'ov-credit') setCnModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Issue Credit Note</div>
              <button className="modal-close" onClick={() => setCnModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Amount *</label><input type="number" className="form-input" value={cnAmount} onChange={e => setCnAmount(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={cnDate} onChange={e => setCnDate(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Reason *</label><input className="form-input" value={cnReason} onChange={e => setCnReason(e.target.value)} /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveCreditNote}>Issue Credit Note</button></div>
          </div>
        </div>
      )}

      {/* ── Quotation Modal ── */}
      {qtModal && (
        <div className="overlay active" id="ov-quotation" onClick={e => { if ((e.target as HTMLElement).id === 'ov-quotation') setQtModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Create Quotation</div>
              <button className="modal-close" onClick={() => setQtModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={qtDate} onChange={e => setQtDate(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Valid Until</label><input type="date" className="form-input" value={qtValid} onChange={e => setQtValid(e.target.value)} /></div>
              </div>
              <div className="form-row"><label className="form-label">Client *</label>
                <select className="form-select" value={qtClientId} onChange={e => setQtClientId(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Asset *</label>
                <select className="form-select" value={qtAsset} onChange={e => { setQtAsset(e.target.value); const cr = cranes.find(c => c.reg === e.target.value); if (cr?.rate) setQtItemRate(String(cr.rate)); }}>
                  <option value="">Select asset…</option>
                  {cranes.filter(c => c.rate).map(c => <option key={c.reg} value={c.reg}>{c.reg} · ₹{c.rate}/hr</option>)}
                </select>
              </div>
              <div style={{ background: 'var(--bg4)', borderRadius: 'var(--rmd)', padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>Add Line Item</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'flex-end' }}>
                  <input className="form-input" placeholder="Description" value={qtItemDesc} onChange={e => setQtItemDesc(e.target.value)} />
                  <input className="form-input" type="number" placeholder="Hours" value={qtItemHrs} onChange={e => setQtItemHrs(e.target.value)} />
                  <input className="form-input" type="number" placeholder="Rate" value={qtItemRate} onChange={e => setQtItemRate(e.target.value)} />
                  <button className="btn-sm accent" onClick={addQtItem}>Add</button>
                </div>
                {qtItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11 }}>
                    <span style={{ flex: 1 }}>{it.desc}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{it.hrs}h × ₹{it.rate}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtINR(it.hrs * it.rate)}</span>
                    <button className="ca-btn c-red" style={{ width: 22, height: 22 }} onClick={() => setQtItems(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                {qtItems.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.8 }}>
                    Subtotal: {fmtINR(qtSubtotal)} · SGST: {fmtINR(qtSGST)} · CGST: {fmtINR(qtCGST)}<br />
                    <strong>Total: {fmtINR(qtSubtotal + qtSGST + qtCGST)}</strong>
                  </div>
                )}
              </div>
              <div className="form-row"><label className="form-label">Notes</label><textarea className="form-input" value={qtNotes} onChange={e => setQtNotes(e.target.value)} rows={2} /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveQuotation}>Create Quotation</button></div>
          </div>
        </div>
      )}

      {/* ── Challan Modal ── */}
      {chModal && (
        <div className="overlay active" id="ov-challan" onClick={e => { if ((e.target as HTMLElement).id === 'ov-challan') setChModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Issue Delivery Challan</div>
              <button className="modal-close" onClick={() => setChModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Date</label><input type="date" className="form-input" value={chDate} onChange={e => setChDate(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Client *</label>
                <select className="form-select" value={chClientId} onChange={e => setChClientId(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Asset *</label>
                <select className="form-select" value={chAsset} onChange={e => { setChAsset(e.target.value); const cr = cranes.find(c => c.reg === e.target.value); if (cr) setChDesc([cr.make, cr.model, cr.capacity ? cr.capacity + ' capacity' : ''].filter(Boolean).join(' ') + ' with operator'); }}>
                  <option value="">Select asset…</option>
                  {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg}{c.make ? ' · ' + c.make : ''}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Site</label><input className="form-input" value={chSite} onChange={e => setChSite(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Description</label><input className="form-input" value={chDesc} onChange={e => setChDesc(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Notes</label><textarea className="form-input" value={chNotes} onChange={e => setChNotes(e.target.value)} rows={2} /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveChallan}>Issue Challan</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
