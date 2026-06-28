import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { Client } from '../../types';
import type { GSTDetails } from '../../types/gst';
import { verifyGST } from '../../services/gst';
import { Modal } from '../../components/ui/Modal';

export function ClientsPage({ active }: { active: boolean }) {
  const { state, setState, showToast, userRole } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [gstVerifying, setGstVerifying] = useState(false);

  const filteredClients = useMemo(() => {
    return (state.clients || []).filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || '').includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.clients, searchTerm]);

  function openModal(client?: Client) {
    if (client) {
      setEditingClient(client);
      setName(client.name);
      setGstin(client.gstin || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
      setCity(client.city || '');
      setStateName(client.state || '');
      setPincode(client.pincode || '');
      setContactPerson(client.contactPerson || client.contact_person || '');
    } else {
      setEditingClient(null);
      setName(''); setGstin(''); setPhone(''); setEmail(''); setAddress(''); setCity(''); setStateName(''); setPincode(''); setContactPerson('');
    }
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return showToast('Client name is required', 'error');
    const clientData: Omit<Client, 'id'> = { name, gstin, phone, email, address, city, state: stateName, pincode, contactPerson };
    try {
      if (editingClient) {
        const updated = await api.updateClient(editingClient.id, clientData);
        setState(prev => ({ ...prev, clients: prev.clients.map(c => c.id === editingClient.id ? updated : c) }));
        showToast('Client updated');
      } else {
        const created = await api.createClient(clientData);
        setState(prev => ({ ...prev, clients: [...prev.clients, created] }));
        showToast('Client added');
      }
      setIsModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save client', 'error');
    }
  }

  function handleGstVerified(details: GSTDetails) {
    const ppob = details.principal_place_of_business;
    setName(prev => details.legal_name || details.trade_name || prev);
    if (ppob?.address) setAddress(ppob.address);
    if (ppob?.city) setCity(ppob.city);
    if (ppob?.state) setStateName(ppob.state);
    if (ppob?.pincode) setPincode(ppob.pincode);
    showToast('Client details autofilled from GSTIN', 'success');
  }

  async function handleVerifyGst() {
    if (!gstin.trim()) return;
    setGstVerifying(true);
    try {
      const res = await verifyGST(gstin);
      if (res.success && res.data) {
        handleGstVerified(res.data);
      } else {
        showToast(res.error || 'GST verification failed', 'error');
      }
    } finally {
      setGstVerifying(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      await api.deleteClient(id);
      setState(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id) }));
      showToast('Client deleted');
    } catch {
      showToast('Deletion failed', 'error');
    }
  }

  return (
    <div className={`page clients-page ${active ? 'active' : ''}`} id="page-clients">
      <header className="page-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="header-left">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', margin: 0 }}>Clients</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Manage customer profiles and contacts</p>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="fleet-search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 12, padding: '8px 16px', width: 280, border: '1px solid transparent', transition: 'all 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input 
              type="text" 
              placeholder="Search clients..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--t1)', width: '100%' }}
            />
          </div>
          
          {userRole === 'owner' && (
            <button className="btn-sm accent" onClick={() => openModal()} style={{ height: 42, padding: '0 20px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Client
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg4)', borderRadius: 24, padding: 24, border: '1px solid var(--border)', display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Clients</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', lineHeight: 1 }}>{state.clients.length}</div>
          </div>
        </div>
      </div>

      <div id="clients-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {filteredClients.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', background: 'var(--bg4)', borderRadius: 24, border: '1px dashed var(--border)' }}>
            <p style={{ color: 'var(--t2)' }}>{searchTerm ? 'No clients match your search' : 'No clients registered yet.'}</p>
          </div>
        ) : (
          filteredClients.map(client => {
            const initials = client.name.slice(0, 2).toUpperCase();
            return (
              <div key={client.id} style={{ background: 'var(--bg4)', borderRadius: 24, padding: 24, border: '1px solid var(--border)', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-grd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800 }}>
                      {initials}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>{client.name}</h3>
                      <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{client.gstin || 'No GSTIN'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openModal(client)} style={{ background: 'var(--bg5)', border: 'none', color: 'var(--t3)', borderRadius: 10, padding: 8, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button onClick={() => handleDelete(client.id)} style={{ background: 'var(--bg5)', border: 'none', color: 'var(--red)', borderRadius: 10, padding: 8, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
                  </div>
                </div>

                <div style={{ padding: 16, background: 'var(--bg5)', borderRadius: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Contact Info</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{client.phone || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{client.email || '—'}</div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span style={{ flex: 1 }}>{client.address ? `${client.address}, ${client.city}` : 'No address'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? 'Edit Client' : 'Add Client'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Company Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="inp" placeholder="e.g. Reliance Projects" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>GSTIN</label>
              <button type="button" className="btn-sm accent" disabled={gstVerifying || !gstin.trim()} onClick={handleVerifyGst} style={{ padding: '4px 12px', fontSize: 11, height: 'auto', borderRadius: 8 }}>
                {gstVerifying ? 'Verifying…' : 'Verify GST'}
              </button>
            </div>
            <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} className="inp" placeholder="27AAAAA0000A1Z5" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="inp" placeholder="Street, area" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="inp" placeholder="City" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>State</label>
              <input type="text" value={stateName} onChange={e => setStateName(e.target.value)} className="inp" placeholder="State" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Pincode</label>
              <input type="text" value={pincode} onChange={e => setPincode(e.target.value)} className="inp" placeholder="000000" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="inp" placeholder="+91" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Contact Person</label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="inp" placeholder="Name" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
          </div>
          <button className="btn-sm accent" onClick={handleSave} style={{ width: '100%', height: 48, borderRadius: 12, marginTop: 10, fontWeight: 800, fontSize: 15 }}>{editingClient ? 'Save Changes' : 'Register Client'}</button>
        </div>
      </Modal>
    </div>
  );
}
