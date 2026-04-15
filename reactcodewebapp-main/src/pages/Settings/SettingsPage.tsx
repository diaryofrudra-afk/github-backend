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
        .catch(() => { });
    } else if (userRole === 'operator') {
      api.getMyOperatorProfile()
        .then(p => setOpPhoto(p.photo || ''))
        .catch(() => { });
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

  // ── Input component ──
  const InputField = ({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', marginLeft: '4px' }}>{label}</label>
      <input
        className="inp"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg4)', fontSize: '14px', color: 'var(--t1)', outline: 'none', transition: 'border-color 0.2s' }}
      />
    </div>
  );

  // ── Operator content ──
  const operatorContent = () => {
    const opInitials = (user || '—').slice(0, 2).toUpperCase();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            {opPhoto ? (
              <img src={opPhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-s)' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                {opInitials}
              </div>
            )}
          </div>
          <button className="btn-sm outline" onClick={() => opFileRef.current?.click()} style={{ fontSize: '11px', fontWeight: 600 }}>
            {opPhoto ? 'Change Photo' : 'Upload Photo'}
          </button>
          <input ref={opFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'operator')} />
          {opPhoto && (
            <button className="btn-sm accent" onClick={handleSaveOpPhoto} disabled={opPhotoSaving} style={{ fontSize: '11px' }}>
              {opPhotoSaving ? 'Saving...' : 'Save Photo'}
            </button>
          )}
        </div>

        {/* Change Password */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '16px' }}>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InputField label="Current Password" value={pwOld} onChange={setPwOld} type="password" placeholder="••••••" />
            <InputField label="New Password" value={pwNew} onChange={setPwNew} type="password" placeholder="••••••" />
            <InputField label="Confirm New Password" value={pwConfirm} onChange={setPwConfirm} type="password" placeholder="••••••" />
          </div>
          <button className="btn-sm accent" onClick={handlePasswordChange} disabled={pwSaving} style={{ marginTop: '16px', fontSize: '11px', fontWeight: 700 }}>
            {pwSaving ? 'Updating...' : 'UPDATE PASSWORD'}
          </button>
        </div>
      </div>
    );
  };

  // ── Owner content ──
  const ownerContent = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            {form.photo ? (
              <img src={form.photo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-s)' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                {initials}
              </div>
            )}
            {/* Score badge */}
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', border: '2px solid var(--bg2)' }}>
              90
            </div>
          </div>
          <button className="btn-sm outline" onClick={() => fileRef.current?.click()} style={{ fontSize: '11px', fontWeight: 600 }}>
            {form.photo ? 'Change Photo' : 'Upload Photo'}
          </button>
          {form.photo && (
            <button className="btn-sm outline" style={{ fontSize: '11px', color: 'var(--red)' }} onClick={() => f('photo', '')}>Remove</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'owner')} />
        </div>

        {/* Change Password */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '16px' }}>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InputField label="Current Password" value={pwOld} onChange={setPwOld} type="password" placeholder="••••••" />
            <InputField label="New Password" value={pwNew} onChange={setPwNew} type="password" placeholder="••••••" />
            <InputField label="Confirm New Password" value={pwConfirm} onChange={setPwConfirm} type="password" placeholder="••••••" />
          </div>
          <button className="btn-sm accent" onClick={handlePasswordChange} disabled={pwSaving} style={{ marginTop: '16px', fontSize: '11px', fontWeight: 700 }}>
            {pwSaving ? 'Updating...' : 'UPDATE PASSWORD'}
          </button>
        </div>
      </div>

      {/* Right Column */}
      <div>
        {/* Business Profile */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '3px', height: '20px', background: 'var(--accent)', borderRadius: '2px', display: 'inline-block' }} />
            Business Profile
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <InputField label="Full Name" value={form.name} onChange={v => f('name', v)} placeholder="Your name" />
          </div>
          <InputField label="Role / Title" value={form.roleTitle} onChange={v => f('roleTitle', v)} placeholder="e.g. Owner" />
          <InputField label="Phone" value={form.phone || user || ''} onChange={v => f('phone', v)} placeholder="9010719021" />
          <div style={{ gridColumn: 'span 2' }}>
            <InputField label="Email" value={form.email} onChange={v => f('email', v)} type="email" placeholder="email@example.com" />
          </div>
          <InputField label="Company Name" value={form.company} onChange={v => f('company', v)} placeholder="Company / firm name" />
          <InputField label="Website" value={form.website} onChange={v => f('website', v)} type="url" placeholder="https://..." />
          <InputField label="City" value={form.city} onChange={v => f('city', v)} placeholder="Mumbai" />
          <InputField label="State" value={form.state} onChange={v => f('state', v)} placeholder="Maharashtra" />
          <InputField label="GSTIN" value={form.gst} onChange={v => f('gst', v)} placeholder="Enter GSTIN Number" />
          <InputField label="Daily Hour Limit" value={form.defaultLimit} onChange={v => f('defaultLimit', v)} type="number" placeholder="8" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn-sm accent" onClick={handleSave} disabled={saving} style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 2px 8px var(--accent-s)' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Modal open={settingsOpen} onClose={onClose} title="Account Settings" subtitle="Manage your business profile and security preferences" className="settings-modal">
        {userRole === 'operator' ? operatorContent() : ownerContent()}

        {/* Footer Banner */}
        <div style={{ marginTop: '24px', padding: '12px 16px', borderRadius: '8px', background: 'var(--bg4)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 700 }}>i</span>
          <span style={{ fontSize: '12px', color: 'var(--t2)' }}>Your information is encrypted and protected under our security guidelines.</span>
        </div>
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
