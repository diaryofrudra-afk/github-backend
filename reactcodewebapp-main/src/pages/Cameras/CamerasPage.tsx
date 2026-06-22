import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/ui/Modal';
import type { Camera } from '../../types';

export function CamerasPage({ active }: { active: boolean }) {
  const { state, setState, showToast, save } = useApp();
  const { cameras, cranes } = state;

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [camLabel, setCamLabel] = useState('');
  const [camUrl, setCamUrl] = useState('');
  const [camAsset, setCamAsset] = useState('');
  const [camType, setCamType] = useState<'embed' | 'rtsp' | 'hls' | 'image'>('embed');
  const [camNotes, setCamNotes] = useState('');

  const openCameraModal = (id?: string) => {
    if (id) {
      const cam = cameras.find(c => c.id === id);
      if (!cam) return;
      setEditId(id);
      setCamLabel(cam.label || '');
      setCamUrl(cam.url || '');
      setCamAsset(cam.reg || '');
      setCamType((cam.type as any) || 'embed');
      setCamNotes(cam.notes || '');
    } else {
      setEditId(null);
      setCamLabel(''); setCamUrl(''); setCamAsset(''); setCamType('embed'); setCamNotes('');
    }
    setModalOpen(true);
  };

  const saveCamera = () => {
    if (!camLabel.trim()) return showToast('Camera label required', 'error');
    const cam: Camera = {
      id: editId || String(Date.now()),
      reg: camAsset || '—',
      label: camLabel.trim(),
      url: camUrl.trim(),
      type: camType,
      notes: camNotes.trim(),
    };
    setState(prev => {
      if (editId) {
        return { ...prev, cameras: prev.cameras.map(c => c.id === editId ? cam : c) };
      }
      return { ...prev, cameras: [...prev.cameras, cam] };
    });
    save();
    setModalOpen(false);
    showToast(`${editId ? 'Updated' : 'Added'}: ${camLabel.trim()}`, 'success');
  };

  const deleteCamera = (id: string) => {
    if (!confirm('Delete this camera feed?')) return;
    setState(prev => ({ ...prev, cameras: prev.cameras.filter(c => c.id !== id) }));
    save();
  };

  // Group by asset reg
  const byAsset: Record<string, Camera[]> = {};
  cameras.forEach(cam => {
    const key = cam.reg || '—';
    if (!byAsset[key]) byAsset[key] = [];
    byAsset[key].push(cam);
  });

  const renderFeed = (cam: Camera) => {
    if (!cam.url) {
      return (
        <div style={{ width: '100%', height: '100%', background: 'var(--bg5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--t3)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
          <span style={{ fontSize: 12, fontWeight: 600 }}>No URL configured</span>
        </div>
      );
    }
    if (cam.type === 'embed') {
      return <iframe src={cam.url} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen loading="lazy" title={cam.label} />;
    }
    if (cam.type === 'image') {
      return <img src={cam.url} alt={cam.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />;
    }
    return (
      <div style={{ width: '100%', height: '100%', background: 'var(--bg5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--t1)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{cam.type?.toUpperCase()} Stream</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{cam.url}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`page cameras-page ${active ? 'active' : ''}`} id="page-cameras">
      <header className="page-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="header-left">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', margin: 0 }}>Cameras</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Live monitoring and recordings</p>
        </div>
        
        <div className="header-actions">
          <button className="btn-sm accent" onClick={() => openCameraModal()} style={{ height: 42, padding: '0 20px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Feed
          </button>
        </div>
      </header>

      <div id="camera-list">
        {!cameras.length ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg4)', borderRadius: 24, border: '1px dashed var(--border)' }}>
            <p style={{ color: 'var(--t2)' }}>No camera feeds added. Connect IP cameras to your assets to enable monitoring.</p>
          </div>
        ) : (
          Object.keys(byAsset).map(reg => {
            const cams = byAsset[reg];
            const crane = cranes.find(c => c.reg === reg);
            return (
              <div key={reg} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: '6px 16px', background: 'var(--accent-s)', border: '1px solid var(--accent)', borderRadius: 10, color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>{reg}</div>
                  {crane && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{crane.make} {crane.model}</div>}
                  <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>{cams.length} feeds</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
                  {cams.map(cam => (
                    <div key={cam.id} style={{ background: 'var(--bg4)', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border)', transition: 'all 0.3s ease' }}>
                      <div style={{ height: 240, background: '#000', position: 'relative' }}>
                        {renderFeed(cam)}
                        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{cam.type?.toUpperCase()}</div>
                      </div>
                      <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>{cam.label}</h4>
                          <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{cam.notes || 'No extra notes'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openCameraModal(cam.id)} style={{ background: 'var(--bg5)', border: 'none', color: 'var(--t3)', borderRadius: 10, padding: 8, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                          <button onClick={() => deleteCamera(cam.id)} style={{ background: 'var(--bg5)', border: 'none', color: 'var(--red)', borderRadius: 10, padding: 8, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Camera' : 'Add Camera'}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Camera Label</label>
              <input type="text" value={camLabel} onChange={e => setCamLabel(e.target.value)} className="inp" placeholder="e.g. Rear View, Dashboard" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Linked Asset</label>
              <select value={camAsset} onChange={e => setCamAsset(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none', background: 'var(--bg4)' }}>
                <option value="">No specific asset</option>
                {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg} ({c.make})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Feed URL / Stream</label>
              <input type="text" value={camUrl} onChange={e => setCamUrl(e.target.value)} className="inp" placeholder="https://... or rtsp://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Feed Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['embed', 'image', 'rtsp', 'hls'] as const).map(t => (
                  <button key={t} onClick={() => setCamType(t)} style={{ padding: '10px', borderRadius: 10, border: '1px solid', borderColor: camType === t ? 'var(--accent)' : 'var(--border)', background: camType === t ? 'var(--accent-s)' : 'var(--bg4)', color: camType === t ? 'var(--accent)' : 'var(--t2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>{t}</button>
                ))}
              </div>
            </div>
            <button className="btn-sm accent" onClick={saveCamera} style={{ width: '100%', height: 48, borderRadius: 12, marginTop: 10, fontWeight: 800, fontSize: 15 }}>Save Camera Feed</button>
         </div>
      </Modal>
    </div>
  );
}
