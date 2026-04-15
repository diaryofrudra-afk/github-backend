const BASE = import.meta.env.VITE_API_BASE || '/api';
const API_BASE = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
// Detect if running in Android emulator (10.0.2.2 maps to host machine)
function isAndroidEmulator() {
    try {
        const ua = navigator.userAgent;
        // Capacitor adds "Capacitor" to the UA string on Android
        return /Capacitor/i.test(ua) && /Android/i.test(ua);
    }
    catch {
        return false;
    }
}
const isProxy = !BASE.startsWith('http') && !isAndroidEmulator();
const ACTUAL_API_BASE = isAndroidEmulator() ? 'http://10.0.2.2:8000' : (isProxy ? '' : API_BASE);
// ── Token helpers ────────────────────────────────────────────────────────────
export function getToken() {
    return localStorage.getItem('suprwise_token');
}
export function setToken(token) {
    localStorage.setItem('suprwise_token', token);
}
export function clearToken() {
    localStorage.removeItem('suprwise_token');
}
// ── Core request helper ──────────────────────────────────────────────────────
async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    const url = isProxy ? `${BASE}${path}` : `${ACTUAL_API_BASE}${path}`;
    if (!isProxy) {
        headers['Accept'] = 'application/json';
    }
    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        mode: isProxy ? undefined : 'cors',
    });
    if (res.status === 401) {
        // Don't clear token for auth endpoints (login, verify-otp, register)
        const authEndpoints = ['/auth/login', '/auth/verify-login-otp', '/auth/register', '/sms-otp/send', '/sms-otp/verify'];
        const isAuthEndpoint = authEndpoints.some(ep => path.includes(ep));
        if (!isAuthEndpoint) {
            clearToken();
            window.location.reload();
            throw new Error('Session expired');
        }
    }
    if (!res.ok) {
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            const detail = json.detail;
            if (typeof detail === 'string')
                throw new Error(detail);
            if (Array.isArray(detail))
                throw new Error(detail.map((d) => d.msg).join(', '));
            throw new Error(String(detail) || `HTTP ${res.status}`);
        }
        catch (e) {
            if (e instanceof Error)
                throw e;
            throw new Error(text || `HTTP ${res.status}`);
        }
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
// ── API object ───────────────────────────────────────────────────────────────
// ── Helpers ──────────────────────────────────────────────────────────────────
function mapToSnakeCase(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        out[snake] = v;
    }
    return out;
}
// ── API object ───────────────────────────────────────────────────────────────
export const api = {
    // Auth
    login(phone, password, email) {
        return request('POST', '/auth/login', { phone, password, email });
    },
    register(phone, password, role, company_name, tenant_code, email) {
        return request('POST', '/auth/register', { phone, password, role, company_name, tenant_code, email });
    },
    googleAuth(credential) {
        return request('POST', '/auth/google', { credential });
    },
    me() {
        return request('GET', '/auth/me');
    },
    // Sync
    exportAll() {
        return request('GET', '/sync/export');
    },
    importAll(data) {
        return request('POST', '/sync/import', data);
    },
    // Cranes
    getCranes() {
        return request('GET', '/cranes');
    },
    createCrane(c) {
        return request('POST', '/cranes', mapToSnakeCase(c));
    },
    updateCrane(id, c) {
        return request('PUT', `/cranes/${id}`, mapToSnakeCase(c));
    },
    deleteCrane(id) {
        return request('DELETE', `/cranes/${id}`);
    },
    // Operators
    getOperators() {
        return request('GET', '/operators');
    },
    createOperator(o) {
        return request('POST', '/operators', mapToSnakeCase(o));
    },
    updateOperator(id, o) {
        return request('PUT', `/operators/${id}`, mapToSnakeCase(o));
    },
    deleteOperator(id) {
        return request('DELETE', `/operators/${id}`);
    },
    getOperatorProfile(operatorId) {
        return request('GET', `/operators/${operatorId}/profile`);
    },
    updateOperatorProfile(operatorId, data) {
        return request('PUT', `/operators/${operatorId}/profile`, data);
    },
    getMyOperatorProfile() {
        return request('GET', '/operators/me/profile');
    },
    updateMyOperatorProfile(data) {
        return request('PUT', '/operators/me/profile', data);
    },
    // Fuel logs
    getFuelLogs() {
        return request('GET', '/fuel-logs');
    },
    createFuelLog(data) {
        return request('POST', '/fuel-logs', mapToSnakeCase(data));
    },
    updateFuelLog(id, data) {
        return request('PUT', `/fuel-logs/${id}`, mapToSnakeCase(data));
    },
    deleteFuelLog(id) {
        return request('DELETE', `/fuel-logs/${id}`);
    },
    // Cameras
    getCameras() {
        return request('GET', '/cameras');
    },
    createCamera(c) {
        return request('POST', '/cameras', mapToSnakeCase(c));
    },
    updateCamera(id, c) {
        return request('PUT', `/cameras/${id}`, mapToSnakeCase(c));
    },
    deleteCamera(id) {
        return request('DELETE', `/cameras/${id}`);
    },
    // Clients
    getClients() {
        return request('GET', '/clients');
    },
    createClient(c) {
        return request('POST', '/clients', mapToSnakeCase(c));
    },
    updateClient(id, c) {
        return request('PUT', `/clients/${id}`, mapToSnakeCase(c));
    },
    deleteClient(id) {
        return request('DELETE', `/clients/${id}`);
    },
    // Invoices
    getInvoices() {
        return request('GET', '/invoices');
    },
    createInvoice(inv) {
        return request('POST', '/invoices', mapToSnakeCase(inv));
    },
    updateInvoice(id, inv) {
        return request('PUT', `/invoices/${id}`, mapToSnakeCase(inv));
    },
    deleteInvoice(id) {
        return request('DELETE', `/invoices/${id}`);
    },
    // Payments
    getPayments() {
        return request('GET', '/payments');
    },
    createPayment(p) {
        return request('POST', '/payments', mapToSnakeCase(p));
    },
    updatePayment(id, p) {
        return request('PUT', `/payments/${id}`, mapToSnakeCase(p));
    },
    deletePayment(id) {
        return request('DELETE', `/payments/${id}`);
    },
    // Credit notes
    getCreditNotes() {
        return request('GET', '/credit-notes');
    },
    createCreditNote(cn) {
        return request('POST', '/credit-notes', mapToSnakeCase(cn));
    },
    updateCreditNote(id, cn) {
        return request('PUT', `/credit-notes/${id}`, mapToSnakeCase(cn));
    },
    deleteCreditNote(id) {
        return request('DELETE', `/credit-notes/${id}`);
    },
    // Quotations
    getQuotations() {
        return request('GET', '/quotations');
    },
    createQuotation(q) {
        return request('POST', '/quotations', mapToSnakeCase(q));
    },
    updateQuotation(id, q) {
        return request('PUT', `/quotations/${id}`, mapToSnakeCase(q));
    },
    deleteQuotation(id) {
        return request('DELETE', `/quotations/${id}`);
    },
    convertQuotation(id) {
        return request('POST', `/quotations/${id}/convert`);
    },
    // Proformas
    getProformas() {
        return request('GET', '/proformas');
    },
    createProforma(p) {
        return request('POST', '/proformas', mapToSnakeCase(p));
    },
    updateProforma(id, p) {
        return request('PUT', `/proformas/${id}`, mapToSnakeCase(p));
    },
    deleteProforma(id) {
        return request('DELETE', `/proformas/${id}`);
    },
    convertProforma(id) {
        return request('POST', `/proformas/${id}/convert`);
    },
    // Challans
    getChallans() {
        return request('GET', '/challans');
    },
    createChallan(c) {
        return request('POST', '/challans', mapToSnakeCase(c));
    },
    updateChallan(id, c) {
        return request('PUT', `/challans/${id}`, mapToSnakeCase(c));
    },
    deleteChallan(id) {
        return request('DELETE', `/challans/${id}`);
    },
    // Timesheets
    getTimesheets() {
        return request('GET', '/timesheets');
    },
    createTimesheet(data) {
        return request('POST', '/timesheets', mapToSnakeCase(data));
    },
    deleteTimesheet(id) {
        return request('DELETE', `/timesheets/${id}`);
    },
    // Maintenance
    getMaintenance() {
        return request('GET', '/maintenance');
    },
    createMaintenance(data) {
        return request('POST', '/maintenance', mapToSnakeCase(data));
    },
    updateMaintenance(id, data) {
        return request('PUT', `/maintenance/${id}`, mapToSnakeCase(data));
    },
    deleteMaintenance(id) {
        return request('DELETE', `/maintenance/${id}`);
    },
    // Files
    getFiles(ownerKey) {
        return request('GET', `/files?owner_key=${encodeURIComponent(ownerKey)}`);
    },
    createFile(data) {
        return request('POST', '/files', mapToSnakeCase(data));
    },
    deleteFile(id) {
        return request('DELETE', `/files/${id}`);
    },
    // Notifications
    getNotifications() {
        return request('GET', '/notifications');
    },
    createNotification(n) {
        return request('POST', '/notifications', mapToSnakeCase(n));
    },
    updateNotification(id, n) {
        return request('PUT', `/notifications/${id}`, mapToSnakeCase(n));
    },
    deleteNotification(id) {
        return request('DELETE', `/notifications/${id}`);
    },
    // Compliance
    getCompliance(crane_reg) {
        const qs = crane_reg ? `?crane_reg=${encodeURIComponent(crane_reg)}` : '';
        return request('GET', `/compliance${qs}`);
    },
    upsertCompliance(crane_reg, data) {
        const body = {
            insurance_date: data.insurance?.date ?? null,
            insurance_notes: data.insurance?.notes ?? '',
            fitness_date: data.fitness?.date ?? null,
            fitness_notes: data.fitness?.notes ?? '',
        };
        return request('PUT', `/compliance/${encodeURIComponent(crane_reg)}`, body);
    },
    // Attendance
    getAttendance(opts) {
        const qs = new URLSearchParams(opts).toString();
        return request('GET', `/attendance${qs ? '?' + qs : ''}`);
    },
    markAttendance(data) {
        return request('POST', '/attendance', mapToSnakeCase(data));
    },
    unmarkAttendance(operator_key, date) {
        return request('DELETE', `/attendance?operator_key=${encodeURIComponent(operator_key)}&date=${encodeURIComponent(date)}`);
    },
    // Diagnostics
    getDiagnostics() {
        return request('GET', '/diagnostics');
    },
    upsertDiagnostics(crane_reg, data) {
        return request('PUT', `/diagnostics/${encodeURIComponent(crane_reg)}`, data);
    },
    // Owner profile
    getOwnerProfile() {
        return request('GET', '/owner-profile');
    },
    updateOwnerProfile(data) {
        return request('PUT', '/owner-profile', mapToSnakeCase(data));
    },
    // Password
    changePassword(oldPassword, newPassword) {
        return request('PUT', '/auth/change-password', { old_password: oldPassword, new_password: newPassword });
    },
    // SMS OTP
    sendSmsOtp(phone, purpose) {
        return request('POST', '/sms-otp/send', { phone, purpose: purpose || 'registration' });
    },
    verifySmsOtp(phone, otp, purpose) {
        return request('POST', '/sms-otp/verify', { phone, otp, purpose: purpose || 'registration' });
    },
    // OTP Login
    sendLoginOtp(phone) {
        return request('POST', '/auth/login-with-otp', { phone });
    },
    verifyLoginOtp(phone, otp) {
        return request('POST', '/auth/verify-login-otp', { phone, otp });
    },
    registerWithOtp(phone, name, email, otp) {
        return request('POST', '/auth/register-with-otp', { phone, name, email, otp });
    },
};
//# sourceMappingURL=api.js.map