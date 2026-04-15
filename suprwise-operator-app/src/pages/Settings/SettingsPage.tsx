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

export function SettingsModal() {
  const { state, setState, showToast, user, userRole, settingsOpen, setSettingsOpen } = useApp();
  const profile = state.ownerProfile;
  const fileRef = useRef<HTMLInputElement>(null);
  const opFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OwnerProfile>({ ...profile });
  const [saving, setSaving] = useState(false);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [opPhoto, setOpPhoto] = useState('');
  const [opPhotoSaving, setOpPhotoSaving] = useState(false);

  const [cropSrc, setCropSrc] = useState('');
  const [cropTarget, setCropTarget] = useState<'owner' | 'operator' | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    if (userRole === 'owner') {
      api.getOwnerProfile()
        .then(p => {
          const mapped: OwnerProfile = {
            name: p.name || '',
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
        .then(p => setOpPhoto(p.photo || ''))
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

  const handleSaveOpPhoto = async () => {
    setOpPhotoSaving(true);
    try {
      await api.updateMyOperatorProfile({ photo: opPhoto });
      showToast('Profile photo saved');
    } catch {
      showToast('Failed to save photo', 'error');
    } finally {
      setOpPhotoSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateOwnerProfile(form);
      setState(prev => ({ ...prev, ownerProfile: form }));
      showToast('Profile saved');
    } catch {
      showToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!pwNew) return showToast('Enter a new password', 'error');
    if (pwNew !== pwConfirm) return showToast('Passwords do not match', 'error');
    if (pwNew.length < 4) return showToast('Password too short', 'error');
    setPwSaving(true);
    try {
      await api.changePassword(pwOld, pwNew);
      showToast('Password updated');
      setPwOld(''); setPwNew(''); setPwConfirm('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change password', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const onClose = () => setSettingsOpen(false);
  const initials = (form.name || user || '—').slice(0, 2).toUpperCase();

  const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' };

  // ── Operator content ──
  const operatorContent = () => {
    const opInitials = (user || '—').slice(0, 2).toUpperCase();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Photo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {opPhoto ? (
            <img src={opPhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {opInitials}
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
        <button className="btn-sm accent" onClick={handleSaveOpPhoto} disabled={opPhotoSaving} style={{ alignSelf: 'flex-start' }}>
          {opPhotoSaving ? 'Saving...' : 'Save Photo'}
        </button>

        {/* Password */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Change Password</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div><label className="lbl">Current</label><input className="inp" type="password" value={pwOld} onChange={e => setPwOld(e.target.value)} /></div>
            <div><label className="lbl">New</label><input className="inp" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} /></div>
            <div><label className="lbl">Confirm</label><input className="inp" type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} /></div>
          </div>
          <button className="btn-sm accent" onClick={handlePasswordChange} disabled={pwSaving} style={{ alignSelf: 'flex-start' }}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </div>

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
            {initials}
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
          <div><label className="lbl">Full Name</label><input className="inp" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Your name" /></div>
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

      {/* Password */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Change Password</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div><label className="lbl">Current</label><input className="inp" type="password" value={pwOld} onChange={e => setPwOld(e.target.value)} /></div>
          <div><label className="lbl">New</label><input className="inp" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} /></div>
          <div><label className="lbl">Confirm</label><input className="inp" type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} /></div>
        </div>
        <button className="btn-sm accent" onClick={handlePasswordChange} disabled={pwSaving} style={{ alignSelf: 'flex-start' }}>
          {pwSaving ? 'Updating...' : 'Update Password'}
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
