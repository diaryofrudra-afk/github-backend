import { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
      setCamType((cam.type as 'embed' | 'rtsp' | 'hls' | 'image') || 'embed');
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

  const typeBadgeColors: Record<string, string> = {
    embed: 'var(--accent-s)', rtsp: 'var(--amber-s)', hls: 'var(--green-s)', image: 'var(--violet-s)',
  };

  const renderFeed = (cam: Camera) => {
    if (!cam.url) {
      return (
        <div className="cam-feed-placeholder">
          <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.3 }}>
            <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span>No URL configured</span>
        </div>
      );
    }
    if (cam.type === 'embed') {
      return <iframe src={cam.url} allowFullScreen loading="lazy" title={cam.label} />;
    }
    if (cam.type === 'image') {
      return <img src={cam.url} alt={cam.label} loading="lazy" />;
    }
    return (
      <div className="cam-feed-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span style={{ fontSize: 10, textAlign: 'center', padding: '0 12px' }}>{cam.url}</span>
        <span>{cam.type === 'rtsp' ? 'RTSP — use VLC or NVR' : 'HLS stream'}</span>
      </div>
    );
  };

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-cameras">
      {/* Section bar */}
      <div className="section-bar" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">Camera Feeds</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Live feeds and recordings per asset</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-sm accent" onClick={() => openCameraModal()}>
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {' '}Add Feed
          </button>
        </div>
      </div>

      {/* Camera list */}
      <div id="camera-list">
        {!cameras.length ? (
          <div className="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <h4>No Camera Feeds</h4>
            <p>Add IP camera, RTSP stream, or embed URL per asset</p>
          </div>
        ) : (
          Object.keys(byAsset).map(reg => {
            const cams = byAsset[reg];
            const crane = cranes.find(c => c.reg === reg);
            return (
              <div key={reg} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{reg}</span>
                  {crane && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{[crane.make, crane.model].filter(Boolean).join(' ')}</span>}
                  <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>{cams.length} feed{cams.length > 1 ? 's' : ''}</span>
                </div>
                <div className="camera-grid">
                  {cams.map(cam => (
                    <div key={cam.id} className="cam-card">
                      <div className="cam-feed">{renderFeed(cam)}</div>
                      <div className="cam-info">
                        <div>
                          <div className="cam-label">{cam.label || 'Unnamed Feed'}</div>
                          <div className="cam-reg">{cam.reg || '—'}{cam.notes ? ` · ${cam.notes}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="cam-type-badge" style={{ background: typeBadgeColors[cam.type || 'embed'] || 'var(--bg5)' }}>{cam.type || 'embed'}</span>
                          <div className="cam-actions">
                            <button className="btn-icon-sm acc" style={{ width: 26, height: 26 }} title="Edit" onClick={() => openCameraModal(cam.id)}>✎</button>
                            <button className="btn-icon-sm red" style={{ width: 26, height: 26 }} title="Delete" onClick={() => deleteCamera(cam.id)}>×</button>
                          </div>
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

      {/* Camera Modal */}
      {modalOpen && (
        <div className="overlay active" id="ov-camera" onClick={e => { if ((e.target as HTMLElement).id === 'ov-camera') setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit Camera Feed' : 'Add Camera Feed'}</div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Label *</label><input className="form-input" value={camLabel} onChange={e => setCamLabel(e.target.value)} placeholder="e.g. Front View, Boom Cam" /></div>
              <div className="form-row"><label className="form-label">Asset</label>
                <select className="form-select" value={camAsset} onChange={e => setCamAsset(e.target.value)}>
                  <option value="">— No specific asset —</option>
                  {cranes.map(c => <option key={c.reg} value={c.reg}>{c.reg}{c.make ? ' · ' + c.make : ''}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Feed Type</label>
                <select className="form-select" value={camType} onChange={e => setCamType(e.target.value as typeof camType)}>
                  <option value="embed">Embed (iFrame)</option>
                  <option value="rtsp">RTSP</option>
                  <option value="hls">HLS</option>
                  <option value="image">Image Snapshot</option>
                </select>
              </div>
              <div className="form-row"><label className="form-label">URL</label><input className="form-input" value={camUrl} onChange={e => setCamUrl(e.target.value)} placeholder="rtsp:// or https://" /></div>
              <div className="form-row"><label className="form-label">Notes</label><input className="form-input" value={camNotes} onChange={e => setCamNotes(e.target.value)} placeholder="Location, angle, etc." /></div>
            </div>
            <div className="modal-foot"><button className="btn-primary" onClick={saveCamera}>Save Feed</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
