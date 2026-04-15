import type {
  AppState,
  Crane,
  Operator,
  Camera,
  Client,
  Invoice,
  Payment,
  CreditNote,
  Quotation,
  Proforma,
  Challan,
  Notification,
  FuelEntry,
  TimesheetEntry,
  ComplianceRecord,
  OwnerProfile,
  EngineStatusRecord,
  EngineStatusDuration,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE || '/api';
const API_BASE = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
const isProxy = !BASE.startsWith('http');

// ── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('suprwise_token');
}

export function setToken(token: string): void {
  localStorage.setItem('suprwise_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('suprwise_token');
}

// ── Core request helper ──────────────────────────────────────────────────────

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = isProxy ? `${BASE}${path}` : `${API_BASE}${path}`;
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
      if (typeof detail === 'string') throw new Error(detail);
      if (Array.isArray(detail)) throw new Error(detail.map((d: any) => d.msg).join(', '));
      throw new Error(String(detail) || `HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth response type ───────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user_id: string;
  tenant_id: string;
  role: string;
  phone: string;
  email?: string;
  email_verified?: boolean;
}

export interface MeResponse {
  user_id: string;
  tenant_id: string;
  role: string;
  phone: string;
  email?: string;
  email_verified?: boolean;
}

export interface TripPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  address: string;
}

export interface TripHistoryResponse {
  points: TripPoint[];
  total: number;
  provider: string; // "blackbuck" | "trakntell"
  vehicle: string;
  error?: string | null;
}

// ── Maintenance entry type (inline since MaintenanceRecord is a nested map) ──

type MaintenanceEntry = { id: string; date: string; type: string; cost?: number; notes?: string };

// ── API object ───────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapToSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

// ── API object ───────────────────────────────────────────────────────────────

export const api = {

  // Auth
  login(phone: string, password: string, email?: string): Promise<AuthResponse> {
    return request('POST', '/auth/login', { phone, password, email });
  },
  register(phone: string, password: string, role: string, company_name?: string, tenant_code?: string, email?: string): Promise<AuthResponse> {
    return request('POST', '/auth/register', { phone, password, role, company_name, tenant_code, email });
  },
  googleAuth(credential: string): Promise<AuthResponse> {
    return request('POST', '/auth/google', { credential });
  },
  me(): Promise<MeResponse> {
    return request('GET', '/auth/me');
  },
  // Test login (bypass OTP for dev)
  testLogin(): Promise<AuthResponse> {
    return request('POST', '/auth/test-login');
  },

  // Sync
  exportAll(): Promise<AppState> {
    return request('GET', '/sync/export');
  },
  importAll(data: AppState): Promise<void> {
    return request('POST', '/sync/import', data);
  },

  // Cranes
  getCranes(): Promise<Crane[]> {
    return request('GET', '/cranes');
  },
  createCrane(c: Omit<Crane, 'id'>): Promise<Crane> {
    return request('POST', '/cranes', mapToSnakeCase(c));
  },
  updateCrane(id: string, c: Partial<Crane>): Promise<Crane> {
    return request('PUT', `/cranes/${id}`, mapToSnakeCase(c));
  },
  deleteCrane(id: string): Promise<void> {
    return request('DELETE', `/cranes/${id}`);
  },

  // Operators
  getOperators(): Promise<Operator[]> {
    return request('GET', '/operators');
  },
  createOperator(o: Omit<Operator, 'id'>): Promise<Operator> {
    return request('POST', '/operators', mapToSnakeCase(o));
  },
  updateOperator(id: string, o: Partial<Operator>): Promise<Operator> {
    return request('PUT', `/operators/${id}`, mapToSnakeCase(o));
  },
  deleteOperator(id: string): Promise<void> {
    return request('DELETE', `/operators/${id}`);
  },
  getOperatorProfile(operatorId: string): Promise<Record<string, string>> {
    return request('GET', `/operators/${operatorId}/profile`);
  },
  updateOperatorProfile(operatorId: string, data: Record<string, string>): Promise<Record<string, string>> {
    return request('PUT', `/operators/${operatorId}/profile`, data);
  },
  getMyOperatorProfile(): Promise<Record<string, string>> {
    return request('GET', '/operators/me/profile');
  },
  updateMyOperatorProfile(data: Record<string, string>): Promise<Record<string, string>> {
    return request('PUT', '/operators/me/profile', data);
  },

  // Fuel logs
  getFuelLogs(): Promise<Record<string, FuelEntry[]>> {
    return request('GET', '/fuel-logs');
  },
  createFuelLog(data: { crane_reg: string } & Omit<FuelEntry, 'id'>): Promise<FuelEntry> {
    return request('POST', '/fuel-logs', mapToSnakeCase(data));
  },
  updateFuelLog(id: string, data: Partial<FuelEntry>): Promise<FuelEntry> {
    return request('PUT', `/fuel-logs/${id}`, mapToSnakeCase(data));
  },
  deleteFuelLog(id: string): Promise<void> {
    return request('DELETE', `/fuel-logs/${id}`);
  },

  // Cameras
  getCameras(): Promise<Camera[]> {
    return request('GET', '/cameras');
  },
  createCamera(c: Omit<Camera, 'id'>): Promise<Camera> {
    return request('POST', '/cameras', mapToSnakeCase(c));
  },
  updateCamera(id: string, c: Partial<Camera>): Promise<Camera> {
    return request('PUT', `/cameras/${id}`, mapToSnakeCase(c));
  },
  deleteCamera(id: string): Promise<void> {
    return request('DELETE', `/cameras/${id}`);
  },

  // Clients
  getClients(): Promise<Client[]> {
    return request('GET', '/clients');
  },
  createClient(c: Omit<Client, 'id'>): Promise<Client> {
    return request('POST', '/clients', mapToSnakeCase(c));
  },
  updateClient(id: string, c: Partial<Client>): Promise<Client> {
    return request('PUT', `/clients/${id}`, mapToSnakeCase(c));
  },
  deleteClient(id: string): Promise<void> {
    return request('DELETE', `/clients/${id}`);
  },

  // Invoices
  getInvoices(): Promise<Invoice[]> {
    return request('GET', '/invoices');
  },
  createInvoice(inv: Omit<Invoice, 'id'>): Promise<Invoice> {
    return request('POST', '/invoices', mapToSnakeCase(inv));
  },
  updateInvoice(id: string, inv: Partial<Invoice>): Promise<Invoice> {
    return request('PUT', `/invoices/${id}`, mapToSnakeCase(inv));
  },
  deleteInvoice(id: string): Promise<void> {
    return request('DELETE', `/invoices/${id}`);
  },

  // Payments
  getPayments(): Promise<Payment[]> {
    return request('GET', '/payments');
  },
  createPayment(p: Omit<Payment, 'id'>): Promise<Payment> {
    return request('POST', '/payments', mapToSnakeCase(p));
  },
  updatePayment(id: string, p: Partial<Payment>): Promise<Payment> {
    return request('PUT', `/payments/${id}`, mapToSnakeCase(p));
  },
  deletePayment(id: string): Promise<void> {
    return request('DELETE', `/payments/${id}`);
  },

  // Credit notes
  getCreditNotes(): Promise<CreditNote[]> {
    return request('GET', '/credit-notes');
  },
  createCreditNote(cn: Omit<CreditNote, 'id'>): Promise<CreditNote> {
    return request('POST', '/credit-notes', mapToSnakeCase(cn));
  },
  updateCreditNote(id: string, cn: Partial<CreditNote>): Promise<CreditNote> {
    return request('PUT', `/credit-notes/${id}`, mapToSnakeCase(cn));
  },
  deleteCreditNote(id: string): Promise<void> {
    return request('DELETE', `/credit-notes/${id}`);
  },

  // Quotations
  getQuotations(): Promise<Quotation[]> {
    return request('GET', '/quotations');
  },
  createQuotation(q: Omit<Quotation, 'id'>): Promise<Quotation> {
    return request('POST', '/quotations', mapToSnakeCase(q));
  },
  updateQuotation(id: string, q: Partial<Quotation>): Promise<Quotation> {
    return request('PUT', `/quotations/${id}`, mapToSnakeCase(q));
  },
  deleteQuotation(id: string): Promise<void> {
    return request('DELETE', `/quotations/${id}`);
  },
  convertQuotation(id: string): Promise<Proforma> {
    return request('POST', `/quotations/${id}/convert`);
  },

  // Proformas
  getProformas(): Promise<Proforma[]> {
    return request('GET', '/proformas');
  },
  createProforma(p: Omit<Proforma, 'id'>): Promise<Proforma> {
    return request('POST', '/proformas', mapToSnakeCase(p));
  },
  updateProforma(id: string, p: Partial<Proforma>): Promise<Proforma> {
    return request('PUT', `/proformas/${id}`, mapToSnakeCase(p));
  },
  deleteProforma(id: string): Promise<void> {
    return request('DELETE', `/proformas/${id}`);
  },
  convertProforma(id: string): Promise<Invoice> {
    return request('POST', `/proformas/${id}/convert`);
  },

  // Challans
  getChallans(): Promise<Challan[]> {
    return request('GET', '/challans');
  },
  createChallan(c: Omit<Challan, 'id'>): Promise<Challan> {
    return request('POST', '/challans', mapToSnakeCase(c));
  },
  updateChallan(id: string, c: Partial<Challan>): Promise<Challan> {
    return request('PUT', `/challans/${id}`, mapToSnakeCase(c));
  },
  deleteChallan(id: string): Promise<void> {
    return request('DELETE', `/challans/${id}`);
  },

  // Timesheets
  getTimesheets(): Promise<Record<string, TimesheetEntry[]>> {
    return request('GET', '/timesheets');
  },
  createTimesheet(data: any): Promise<unknown> {
    return request('POST', '/timesheets', mapToSnakeCase(data));
  },
  deleteTimesheet(id: string): Promise<void> {
    return request('DELETE', `/timesheets/${id}`);
  },

  // Maintenance
  getMaintenance(): Promise<Record<string, MaintenanceEntry[]>> {
    return request('GET', '/maintenance');
  },
  createMaintenance(data: { crane_reg: string } & Omit<MaintenanceEntry, 'id'>): Promise<MaintenanceEntry> {
    return request('POST', '/maintenance', mapToSnakeCase(data));
  },
  updateMaintenance(id: string, data: Partial<MaintenanceEntry>): Promise<MaintenanceEntry> {
    return request('PUT', `/maintenance/${id}`, mapToSnakeCase(data));
  },
  deleteMaintenance(id: string): Promise<void> {
    return request('DELETE', `/maintenance/${id}`);
  },

  // Files
  getFiles(ownerKey: string): Promise<unknown[]> {
    return request('GET', `/files?owner_key=${encodeURIComponent(ownerKey)}`);
  },
  createFile(data: any): Promise<unknown> {
    return request('POST', '/files', mapToSnakeCase(data));
  },
  deleteFile(id: string): Promise<void> {
    return request('DELETE', `/files/${id}`);
  },

  // Notifications
  getNotifications(): Promise<Notification[]> {
    return request('GET', '/notifications');
  },
  createNotification(n: Omit<Notification, 'id'>): Promise<Notification> {
    return request('POST', '/notifications', mapToSnakeCase(n));
  },
  updateNotification(id: string, n: Partial<Notification>): Promise<Notification> {
    return request('PUT', `/notifications/${id}`, mapToSnakeCase(n));
  },
  deleteNotification(id: string): Promise<void> {
    return request('DELETE', `/notifications/${id}`);
  },

  // Compliance
  async getCompliance(crane_reg?: string): Promise<Record<string, ComplianceRecord>> {
    const qs = crane_reg ? `?crane_reg=${encodeURIComponent(crane_reg)}` : '';
    // Backend returns a flat array: [{crane_reg, insurance_date, insurance_notes, fitness_date, fitness_notes, ...}]
    const rows: any[] = await request('GET', `/compliance${qs}`);
    const result: Record<string, ComplianceRecord> = {};
    for (const row of rows) {
      const key = row.crane_reg as string;
      if (!key) continue;
      result[key] = {
        insurance: row.insurance_date ? { date: row.insurance_date, notes: row.insurance_notes || '' } : undefined,
        fitness: row.fitness_date ? { date: row.fitness_date, notes: row.fitness_notes || '' } : undefined,
      };
    }
    return result;
  },
  upsertCompliance(crane_reg: string, data: ComplianceRecord): Promise<unknown> {
    const body = {
      insurance_date: data.insurance?.date ?? null,
      insurance_notes: data.insurance?.notes ?? '',
      fitness_date: data.fitness?.date ?? null,
      fitness_notes: data.fitness?.notes ?? '',
    };
    return request('PUT', `/compliance/${encodeURIComponent(crane_reg)}`, body);
  },

  // Attendance
  getAttendance(opts?: { operator_key?: string; date?: string }): Promise<any[]> {
    const qs = new URLSearchParams(opts as any).toString();
    return request('GET', `/attendance${qs ? '?' + qs : ''}`);
  },
  markAttendance(data: { operator_key: string; date: string; status?: string; marked_by?: string }): Promise<any> {
    return request('POST', '/attendance', mapToSnakeCase(data));
  },
  unmarkAttendance(operator_key: string, date: string): Promise<void> {
    return request('DELETE', `/attendance?operator_key=${encodeURIComponent(operator_key)}&date=${encodeURIComponent(date)}`);
  },


  // Diagnostics
  getDiagnostics(): Promise<Record<string, unknown>> {
    return request('GET', '/diagnostics');
  },
  upsertDiagnostics(crane_reg: string, data: unknown): Promise<unknown> {
    return request('PUT', `/diagnostics/${encodeURIComponent(crane_reg)}`, data);
  },

  // Owner profile
  getOwnerProfile(): Promise<OwnerProfile> {
    return request('GET', '/owner-profile');
  },
  updateOwnerProfile(data: Partial<OwnerProfile>): Promise<OwnerProfile> {
    return request('PUT', '/owner-profile', mapToSnakeCase(data));
  },

  // Password
  changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    return request('PUT', '/auth/change-password', { old_password: oldPassword, new_password: newPassword });
  },

  // SMS OTP
  sendSmsOtp(phone: string, purpose?: string): Promise<{ success: boolean; message: string; otp_id?: string; expires_in_minutes?: number }> {
    return request('POST', '/sms-otp/send', { phone, purpose: purpose || 'registration' });
  },
  verifySmsOtp(phone: string, otp: string, purpose?: string): Promise<{ success: boolean; message: string; phone?: string; purpose?: string }> {
    return request('POST', '/sms-otp/verify', { phone, otp, purpose: purpose || 'registration' });
  },

  // OTP Login
  sendLoginOtp(phone: string): Promise<{ success: boolean; message: string; expires_in_minutes: number }> {
    return request('POST', '/auth/login-with-otp', { phone });
  },
  verifyLoginOtp(phone: string, otp: string): Promise<AuthResponse> {
    return request('POST', '/auth/verify-login-otp', { phone, otp });
  },
  registerWithOtp(phone: string, name: string, email: string, otp: string): Promise<AuthResponse> {
    return request('POST', '/auth/register-with-otp', { phone, name, email, otp });
  },

  // Trip History
  getBlackbuckTripHistory(truckNo: string, fromMs: number, toMs: number): Promise<TripHistoryResponse> {
    return request('GET', `/gps/blackbuck/trip-history?truck_no=${encodeURIComponent(truckNo)}&from_time=${fromMs}&to_time=${toMs}`);
  },
  getTrakNTellTripHistory(vehicleId: string, fromDate: string, toDate: string): Promise<TripHistoryResponse> {
    return request('GET', `/gps/trakntell/trip-history?vehicle_id=${encodeURIComponent(vehicleId)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`);
  },
  getTripHistory(provider: string, vehicleId: string, fromMs?: number, toMs?: number, fromDate?: string, toDate?: string): Promise<TripHistoryResponse> {
    const params = new URLSearchParams({
      provider,
      vehicle_id: vehicleId,
    });
    if (fromMs !== undefined) params.append('from_time', String(fromMs));
    if (toMs !== undefined) params.append('to_time', String(toMs));
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    return request('GET', `/gps/trip-history?${params.toString()}`);
  },

  // Engine Status History
  getEngineStatusHistory(params?: {
    crane_reg?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<EngineStatusRecord[]> {
    const query = new URLSearchParams();
    if (params?.crane_reg) query.append('crane_reg', params.crane_reg);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    return request('GET', `/engine-status/history?${query.toString()}`);
  },

  exportEngineStatusHistory(params?: {
    crane_reg?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<string> {
    const query = new URLSearchParams();
    if (params?.crane_reg) query.append('crane_reg', params.crane_reg);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return request('GET', `/engine-status/export?${query.toString()}`);
  },

  getEngineStatusDurations(crane_reg: string, start_date: string, end_date: string): Promise<EngineStatusDuration[]> {
    return request('GET', `/engine-status/durations/${encodeURIComponent(crane_reg)}?start_date=${start_date}&end_date=${end_date}`);
  },
};
