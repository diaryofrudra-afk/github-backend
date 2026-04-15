import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { ImageCropper } from '../../components/ui/ImageCropper';
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
export function SettingsModal() {
    const { state, setState, showToast, user, userRole, settingsOpen, setSettingsOpen } = useApp();
    const profile = state.ownerProfile;
    const fileRef = useRef(null);
    const opFileRef = useRef(null);
    const [form, setForm] = useState({ ...profile });
    const [saving, setSaving] = useState(false);
    const [pwOld, setPwOld] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [opPhoto, setOpPhoto] = useState('');
    const [opPhotoSaving, setOpPhotoSaving] = useState(false);
    const [cropSrc, setCropSrc] = useState('');
    const [cropTarget, setCropTarget] = useState(null);
    useEffect(() => {
        if (!settingsOpen)
            return;
        if (userRole === 'owner') {
            api.getOwnerProfile()
                .then(p => {
                const mapped = {
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
        }
        else if (userRole === 'operator') {
            api.getMyOperatorProfile()
                .then(p => setOpPhoto(p.photo || ''))
                .catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsOpen]);
    const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
    const handleFileSelected = async (e, target) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024)
            return showToast('Image must be under 5 MB', 'error');
        const base64 = await fileToBase64(file);
        setCropSrc(base64);
        setCropTarget(target);
        e.target.value = '';
    };
    const handleCropped = (croppedBase64) => {
        if (cropTarget === 'owner') {
            setForm(prev => ({ ...prev, photo: croppedBase64 }));
        }
        else if (cropTarget === 'operator') {
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
        }
        catch {
            showToast('Failed to save photo', 'error');
        }
        finally {
            setOpPhotoSaving(false);
        }
    };
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateOwnerProfile(form);
            setState(prev => ({ ...prev, ownerProfile: form }));
            showToast('Profile saved');
        }
        catch {
            showToast('Failed to save profile', 'error');
        }
        finally {
            setSaving(false);
        }
    };
    const handlePasswordChange = async () => {
        if (!pwNew)
            return showToast('Enter a new password', 'error');
        if (pwNew !== pwConfirm)
            return showToast('Passwords do not match', 'error');
        if (pwNew.length < 4)
            return showToast('Password too short', 'error');
        setPwSaving(true);
        try {
            await api.changePassword(pwOld, pwNew);
            showToast('Password updated');
            setPwOld('');
            setPwNew('');
            setPwConfirm('');
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to change password', 'error');
        }
        finally {
            setPwSaving(false);
        }
    };
    const onClose = () => setSettingsOpen(false);
    const initials = (form.name || user || '—').slice(0, 2).toUpperCase();
    const sectionStyle = { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' };
    // ── Operator content ──
    const operatorContent = () => {
        const opInitials = (user || '—').slice(0, 2).toUpperCase();
        return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: [opPhoto ? (_jsx("img", { src: opPhoto, alt: "", style: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' } })) : (_jsx("div", { style: { width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }, children: opInitials })), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: [_jsx("button", { className: "btn-sm outline", onClick: () => opFileRef.current?.click(), style: { fontSize: 11 }, children: opPhoto ? 'Change Photo' : 'Upload Photo' }), opPhoto && (_jsx("button", { className: "btn-sm outline", style: { fontSize: 11, color: 'var(--error, #e53e3e)' }, onClick: () => setOpPhoto(''), children: "Remove" })), _jsx("input", { ref: opFileRef, type: "file", accept: "image/*", style: { display: 'none' }, onChange: e => handleFileSelected(e, 'operator') })] })] }), _jsx("button", { className: "btn-sm accent", onClick: handleSaveOpPhoto, disabled: opPhotoSaving, style: { alignSelf: 'flex-start' }, children: opPhotoSaving ? 'Saving...' : 'Save Photo' }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: 'var(--t1)' }, children: "Change Password" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }, children: [_jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Current" }), _jsx("input", { className: "inp", type: "password", value: pwOld, onChange: e => setPwOld(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "New" }), _jsx("input", { className: "inp", type: "password", value: pwNew, onChange: e => setPwNew(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Confirm" }), _jsx("input", { className: "inp", type: "password", value: pwConfirm, onChange: e => setPwConfirm(e.target.value) })] })] }), _jsx("button", { className: "btn-sm accent", onClick: handlePasswordChange, disabled: pwSaving, style: { alignSelf: 'flex-start' }, children: pwSaving ? 'Updating...' : 'Update Password' })] }), _jsxs("div", { style: { fontSize: 12, color: 'var(--t3)' }, children: ["Signed in as ", _jsx("strong", { style: { color: 'var(--t1)' }, children: user }), " (Operator)"] })] }));
    };
    // ── Owner content ──
    const ownerContent = () => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: [form.photo ? (_jsx("img", { src: form.photo, alt: "", style: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' } })) : (_jsx("div", { style: { width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }, children: initials })), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: [_jsx("button", { className: "btn-sm outline", onClick: () => fileRef.current?.click(), style: { fontSize: 11 }, children: form.photo ? 'Change Photo' : 'Upload Photo' }), form.photo && (_jsx("button", { className: "btn-sm outline", style: { fontSize: 11, color: 'var(--error, #e53e3e)' }, onClick: () => f('photo', ''), children: "Remove" })), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: 'none' }, onChange: e => handleFileSelected(e, 'owner') })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: 'var(--t1)' }, children: "Business Profile" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }, children: [_jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Full Name" }), _jsx("input", { className: "inp", value: form.name, onChange: e => f('name', e.target.value), placeholder: "Your name" })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Role / Title" }), _jsx("input", { className: "inp", value: form.roleTitle, onChange: e => f('roleTitle', e.target.value), placeholder: "e.g. Owner" })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Phone" }), _jsx("input", { className: "inp", value: form.phone || user || '', onChange: e => f('phone', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Email" }), _jsx("input", { className: "inp", type: "email", value: form.email, onChange: e => f('email', e.target.value), placeholder: "email@example.com" })] }), _jsxs("div", { style: { gridColumn: 'span 2' }, children: [_jsx("label", { className: "lbl", children: "Company Name" }), _jsx("input", { className: "inp", value: form.company, onChange: e => f('company', e.target.value), placeholder: "Company / firm name" })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "City" }), _jsx("input", { className: "inp", value: form.city, onChange: e => f('city', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "State" }), _jsx("input", { className: "inp", value: form.state, onChange: e => f('state', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "GSTIN" }), _jsx("input", { className: "inp", value: form.gst, onChange: e => f('gst', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Website" }), _jsx("input", { className: "inp", value: form.website, onChange: e => f('website', e.target.value), placeholder: "https://..." })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Daily Hour Limit" }), _jsx("input", { className: "inp", type: "number", value: form.defaultLimit, onChange: e => f('defaultLimit', e.target.value), placeholder: "8" })] })] }), _jsx("button", { className: "btn-sm accent", onClick: handleSave, disabled: saving, style: { alignSelf: 'flex-start' }, children: saving ? 'Saving...' : 'Save Profile' })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: 'var(--t1)' }, children: "Change Password" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }, children: [_jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Current" }), _jsx("input", { className: "inp", type: "password", value: pwOld, onChange: e => setPwOld(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "New" }), _jsx("input", { className: "inp", type: "password", value: pwNew, onChange: e => setPwNew(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "lbl", children: "Confirm" }), _jsx("input", { className: "inp", type: "password", value: pwConfirm, onChange: e => setPwConfirm(e.target.value) })] })] }), _jsx("button", { className: "btn-sm accent", onClick: handlePasswordChange, disabled: pwSaving, style: { alignSelf: 'flex-start' }, children: pwSaving ? 'Updating...' : 'Update Password' })] }), _jsxs("div", { style: { fontSize: 12, color: 'var(--t3)' }, children: ["Signed in as ", _jsx("strong", { style: { color: 'var(--t1)' }, children: user })] })] }));
    return (_jsxs(_Fragment, { children: [_jsx(Modal, { open: settingsOpen, onClose: onClose, title: "Settings", children: userRole === 'operator' ? operatorContent() : ownerContent() }), _jsx(Modal, { open: !!cropSrc, onClose: () => { setCropSrc(''); setCropTarget(null); }, title: "Adjust Photo", children: cropSrc && (_jsx(ImageCropper, { src: cropSrc, onCrop: handleCropped, onCancel: () => { setCropSrc(''); setCropTarget(null); } })) })] }));
}
//# sourceMappingURL=SettingsPage.js.map