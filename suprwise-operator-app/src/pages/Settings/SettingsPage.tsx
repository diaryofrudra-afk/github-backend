import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import type { OwnerProfile } from '../../types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getInitials(name: string): React.ReactNode {
  if (!name || name === '—') return <span className="material-symbols-outlined">person</span>;
  // If it's just a number (phone), show icon
  if (/^\+?\d+$/.test(name.replace(/\s/g, ''))) return <span className="material-symbols-outlined">person</span>;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SettingsModal() {
  const { state, setState, showToast, user, userRole, settingsOpen, setSettingsOpen } = useApp();
  const profile = state.ownerProfile;
  const fileRef = useRef<HTMLInputElement>(null);
  const opFileRef = useRef<HTMLInputElement>(null);
  const opAadhaarRef = useRef<HTMLInputElement>(null);
  const opLicenseRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OwnerProfile>({ ...profile });
  const [saving, setSaving] = useState(false);

  const [opPhoto, setOpPhoto] = useState('');
  const [opAadhaar, setOpAadhaar] = useState('');
  const [opLicense, setOpLicense] = useState('');
  const [opDocSaving, setOpDocSaving] = useState(false);

  const [cropSrc, setCropSrc] = useState('');
  const [cropTarget, setCropTarget] = useState<'owner' | 'operator' | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    if (userRole === 'owner') {
      api.getOwnerProfile()
        .then(p => {
          const mapped: OwnerProfile = {
            name: p.name || '',
            firstName: p.first_name || p.firstName || '',
            lastName: p.last_name || p.lastName || '',
            roleTitle: p.role_title || p.roleTitle || '',
            phone: p.phone || '',
            email: p.email || '',
            company: p.company || '',
            city: p.city || '',
            state: p.state || '',
            gst: p.gst || '',
            website: p.website || '',
            defaultLimit: p.default_limit || p.defaultLimit || '8',
            photo: p.photo || '',
          };
          setForm(mapped);
          setState(prev => ({ ...prev, ownerProfile: mapped }));
        })
        .catch(() => {});
    } else if (userRole === 'operator') {
      api.getMyOperatorProfile()
        .then(p => {
          const pf = p.photo || '';
          const aadhaar = p.aadhaar || '';
          const license = p.license || '';
          setOpPhoto(pf);
          setOpAadhaar(aadhaar);
          setOpLicense(license);

          const uid = user || '';
          setState(prev => {
            const newProfiles = { ...prev.operatorProfiles };
            newProfiles[uid] = {
              ...newProfiles[uid],
              photo: pf,
              aadhaar,
              license,
            };
            return { ...prev, operatorProfiles: newProfiles };
          });
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  const f = (key: keyof OwnerProfile, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, target: 'owner' | 'operator') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast('Image must be under 5 MB', 'error');
    const base64 = await fileToBase64(file);
    setCropSrc(base64);
    setCropTarget(target);
    e.target.value = '';
  };

  const handleCropped = (croppedBase64: string) => {
    if (cropTarget === 'owner') {
      setForm(prev => ({ ...prev, photo: croppedBase64 }));
    } else if (cropTarget === 'operator') {
      setOpPhoto(croppedBase64);
    }
    setCropSrc('');
    setCropTarget(null);
  };

  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>, target: 'aadhaar' | 'license') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return showToast('File must be under 8 MB', 'error');
    const base64 = await fileToBase64(file);
    if (target === 'aadhaar') setOpAadhaar(base64);
    else setOpLicense(base64);
    e.target.value = '';
  };

  const handleSaveOpProfile = async () => {
    setOpDocSaving(true);
    try {
      await api.updateMyOperatorProfile({ 
        photo: opPhoto,
        aadhaar: opAadhaar,
        license: opLicense,
      });
      
      const uid = user || '';
      setState(prev => {
        // Update operatorProfiles map
        const newProfiles = { ...prev.operatorProfiles };
        newProfiles[uid] = {
          ...newProfiles[uid],
          photo: opPhoto,
          aadhaar: opAadhaar,
          license: opLicense,
        };

        return { ...prev, operatorProfiles: newProfiles };
      });

      showToast('Profile updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save profile', 'error');
    } finally {
      setOpDocSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateOwnerProfile(form);
      setState(prev => ({ ...prev, ownerProfile: form }));
      showToast('Profile saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onClose = () => setSettingsOpen(false);

  const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' };

  // ── Operator content ──
  const operatorContent = () => {
    const name = user || '—';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Photo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {opPhoto ? (
            <img src={opPhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {getInitials(name)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="btn-sm outline" onClick={() => opFileRef.current?.click()} style={{ fontSize: 11 }}>
              {opPhoto ? 'Change Photo' : 'Upload Photo'}
            </button>
            {opPhoto && (
              <button className="btn-sm outline" style={{ fontSize: 11, color: 'var(--error, #e53e3e)' }} onClick={() => setOpPhoto('')}>Remove</button>
            )}
            <input ref={opFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'operator')} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Identity Documents</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="lbl">Aadhaar Card</label>
              <button className="btn-sm outline" onClick={() => opAadhaarRef.current?.click()} style={{ fontSize: 11, alignSelf: 'flex-start' }}>
                {opAadhaar ? 'Replace Aadhaar' : 'Upload Aadhaar'}
              </button>
              {opAadhaar && (
                <button className="btn-sm outline" style={{ fontSize: 11, color: 'var(--error, #e53e3e)', alignSelf: 'flex-start' }} onClick={() => setOpAadhaar('')}>
                  Remove Aadhaar
                </button>
              )}
              {opAadhaar && (
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {opAadhaar.startsWith('data:image/') ? 'Image uploaded' : 'File uploaded'}
                </div>
              )}
              <input ref={opAadhaarRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleDocumentSelected(e, 'aadhaar')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="lbl">Driving Licence</label>
              <button className="btn-sm outline" onClick={() => opLicenseRef.current?.click()} style={{ fontSize: 11, alignSelf: 'flex-start' }}>
                {opLicense ? 'Replace Licence' : 'Upload Licence'}
              </button>
              {opLicense && (
                <button className="btn-sm outline" style={{ fontSize: 11, color: 'var(--error, #e53e3e)', alignSelf: 'flex-start' }} onClick={() => setOpLicense('')}>
                  Remove Licence
                </button>
              )}
              {opLicense && (
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {opLicense.startsWith('data:image/') ? 'Image uploaded' : 'File uploaded'}
                </div>
              )}
              <input ref={opLicenseRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleDocumentSelected(e, 'license')} />
            </div>
          </div>
        </div>

        <button className="btn-sm accent" onClick={handleSaveOpProfile} disabled={opDocSaving} style={{ alignSelf: 'flex-start' }}>
          {opDocSaving ? 'Saving...' : 'Save Documents'}
        </button>

        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Signed in as <strong style={{ color: 'var(--t1)' }}>{user}</strong> (Operator)</div>
      </div>
    );
  };

  // ── Owner content ──
  const ownerContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Photo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {form.photo ? (
          <img src={form.photo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            {getInitials(form.name || user || '—')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button className="btn-sm outline" onClick={() => fileRef.current?.click()} style={{ fontSize: 11 }}>
            {form.photo ? 'Change Photo' : 'Upload Photo'}
          </button>
          {form.photo && (
            <button className="btn-sm outline" style={{ fontSize: 11, color: 'var(--error, #e53e3e)' }} onClick={() => f('photo', '')}>Remove</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'owner')} />
        </div>
      </div>

      {/* Business Profile */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Business Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div><label className="lbl">First Name</label><input className="inp" value={form.firstName || ''} onChange={e => f('firstName', e.target.value)} placeholder="First name" /></div>
          <div><label className="lbl">Last Name</label><input className="inp" value={form.lastName || ''} onChange={e => f('lastName', e.target.value)} placeholder="Last name" /></div>
          <div style={{ gridColumn: 'span 2' }}><label className="lbl">Full Name (Display Name)</label><input className="inp" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Your name" /></div>
          <div><label className="lbl">Role / Title</label><input className="inp" value={form.roleTitle} onChange={e => f('roleTitle', e.target.value)} placeholder="e.g. Owner" /></div>
          <div><label className="lbl">Phone</label><input className="inp" value={form.phone || user || ''} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="lbl">Email</label><input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" /></div>
          <div style={{ gridColumn: 'span 2' }}><label className="lbl">Company Name</label><input className="inp" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company / firm name" /></div>
          <div><label className="lbl">City</label><input className="inp" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="lbl">State</label><input className="inp" value={form.state} onChange={e => f('state', e.target.value)} /></div>
          <div><label className="lbl">GSTIN</label><input className="inp" value={form.gst} onChange={e => f('gst', e.target.value)} /></div>
          <div><label className="lbl">Website</label><input className="inp" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://..." /></div>
          <div><label className="lbl">Daily Hour Limit</label><input className="inp" type="number" value={form.defaultLimit} onChange={e => f('defaultLimit', e.target.value)} placeholder="8" /></div>
        </div>
        <button className="btn-sm accent" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--t3)' }}>Signed in as <strong style={{ color: 'var(--t1)' }}>{user}</strong></div>
    </div>
  );

  return (
    <>
      <Modal open={settingsOpen} onClose={onClose} title="Settings">
        {userRole === 'operator' ? operatorContent() : ownerContent()}
      </Modal>

      <Modal open={!!cropSrc} onClose={() => { setCropSrc(''); setCropTarget(null); }} title="Adjust Photo">
        {cropSrc && (
          <ImageCropper
            src={cropSrc}
            onCrop={handleCropped}
            onCancel={() => { setCropSrc(''); setCropTarget(null); }}
          />
        )}
      </Modal>
    </>
  );
}
