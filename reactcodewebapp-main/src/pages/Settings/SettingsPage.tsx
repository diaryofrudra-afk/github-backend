import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { verifyGST } from '../../services/gst';
import type { OwnerProfile } from '../../types';
import type { GSTDetails } from '../../types/gst';

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
  const opAadhaarRef = useRef<HTMLInputElement>(null);
  const opLicenseRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OwnerProfile>({ ...profile });
  const [saving, setSaving] = useState(false);

  const [opPhoto, setOpPhoto] = useState('');
  const [opAadhaarDoc, setOpAadhaarDoc] = useState('');
  const [opLicenseDoc, setOpLicenseDoc] = useState('');
  const [opSaving, setOpSaving] = useState(false);

  const [cropSrc, setCropSrc] = useState('');
  const [cropTarget, setCropTarget] = useState<'owner' | 'operator' | null>(null);
  const [gstVerifying, setGstVerifying] = useState(false);

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
            address: p.address || '',
            city: p.city || '',
            state: p.state || '',
            pincode: p.pincode || '',
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
        .then(p => {
          setOpPhoto(p.photo || '');
          setOpAadhaarDoc((p as Record<string, string>).aadhaar_doc || '');
          setOpLicenseDoc((p as Record<string, string>).license_doc || '');
        })
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

  const handleOperatorDocumentSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'aadhaar' | 'license',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return showToast('Document must be under 8 MB', 'error');
    const base64 = await fileToBase64(file);
    if (target === 'aadhaar') setOpAadhaarDoc(base64);
    if (target === 'license') setOpLicenseDoc(base64);
    e.target.value = '';
  };

  const handleSaveOperatorProfile = async () => {
    setOpSaving(true);
    try {
      await api.updateMyOperatorProfile({
        photo: opPhoto,
        aadhaar_doc: opAadhaarDoc,
        license_doc: opLicenseDoc,
      });
      showToast('Documents saved');
    } catch {
      showToast('Failed to save documents', 'error');
    } finally {
      setOpSaving(false);
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

  const handleGstVerified = (_gstin: string, details: GSTDetails) => {
    setForm(prev => ({
      ...prev,
      gst: _gstin,
      company: details.legal_name || details.trade_name || prev.company,
      address: details.principal_place_of_business?.address || prev.address,
      city: details.principal_place_of_business?.city || prev.city,
      state: details.principal_place_of_business?.state || prev.state,
      pincode: details.principal_place_of_business?.pincode || prev.pincode,
    }));
    showToast('Profile autofilled from GSTIN', 'success');
  };

  const onClose = () => {
    setSettingsOpen(false);
  };
  const initials = (form.name || user || '—').slice(0, 2).toUpperCase();

  // ── Input component ──
  const InputField = ({ label, value, onChange, type = 'text', placeholder, rightElement }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; rightElement?: React.ReactNode;
  }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: '4px' }}>{label}</label>
        {rightElement}
      </div>
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
    const renderPreview = (value: string, label: string) => {
      if (!value) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: '11px' }}>No document uploaded</div>
          </div>
        );
      }

      if (value.startsWith('data:image/')) {
        return (
          <img
            src={value}
            alt={label}
            style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border)' }}
          />
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>{label}</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Document uploaded</div>
        </div>
      );
    };

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
        </div>

        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '6px' }}>Identity Documents</h3>
            <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Upload Aadhaar and driving licence for verification.</div>
          </div>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {renderPreview(opAadhaarDoc, 'Aadhaar Card')}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-sm outline" onClick={() => opAadhaarRef.current?.click()} style={{ fontSize: '11px', fontWeight: 600 }}>
                  {opAadhaarDoc ? 'Replace Aadhaar' : 'Upload Aadhaar'}
                </button>
                {opAadhaarDoc && (
                  <button className="btn-sm outline" style={{ fontSize: '11px', color: 'var(--red)' }} onClick={() => setOpAadhaarDoc('')}>
                    Remove
                  </button>
                )}
              </div>
              <input ref={opAadhaarRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleOperatorDocumentSelected(e, 'aadhaar')} />
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {renderPreview(opLicenseDoc, 'Driving Licence')}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-sm outline" onClick={() => opLicenseRef.current?.click()} style={{ fontSize: '11px', fontWeight: 600 }}>
                  {opLicenseDoc ? 'Replace Licence' : 'Upload Licence'}
                </button>
                {opLicenseDoc && (
                  <button className="btn-sm outline" style={{ fontSize: '11px', color: 'var(--red)' }} onClick={() => setOpLicenseDoc('')}>
                    Remove
                  </button>
                )}
              </div>
              <input ref={opLicenseRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleOperatorDocumentSelected(e, 'license')} />
            </div>
          </div>
          <button className="btn-sm accent" onClick={handleSaveOperatorProfile} disabled={opSaving} style={{ marginTop: '4px', fontSize: '11px', fontWeight: 700 }}>
            {opSaving ? 'Saving...' : 'SAVE DOCUMENTS'}
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
          <div style={{ gridColumn: 'span 2' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: '4px' }}>Address</label>
              </div>
              <textarea
                className="inp"
                value={form.address}
                onChange={e => f('address', e.target.value)}
                placeholder="Street, locality, area"
                rows={2}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg4)', fontSize: '14px', color: 'var(--t1)', outline: 'none', resize: 'vertical', minHeight: '64px' }}
              />
            </div>
          </div>
          <InputField label="Pincode" value={form.pincode} onChange={v => f('pincode', v)} placeholder="e.g. 400001" />
          <div style={{ gridColumn: 'span 2' }}>
            <InputField
              label="GSTIN"
              value={form.gst}
              onChange={v => f('gst', v)}
              placeholder="Enter GSTIN Number"
              rightElement={
                <button
                  type="button"
                  className="btn-sm accent"
                  style={{ padding: '2px 8px', fontSize: 9, height: 'auto' }}
                  disabled={gstVerifying || !form.gst}
                  onClick={async () => {
                    setGstVerifying(true);
                    const res = await verifyGST(form.gst);
                    setGstVerifying(false);
                    if (res.success && res.data) {
                      handleGstVerified(form.gst, res.data);
                    } else {
                      showToast(res.error || 'GST verification failed', 'error');
                    }
                  }}
                >
                  {gstVerifying ? 'Verifying...' : 'Verify GST'}
                </button>
              }
            />
          </div>
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
