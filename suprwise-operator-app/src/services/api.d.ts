import type { AppState, Crane, Operator, Camera, Client, Invoice, Payment, CreditNote, Quotation, Proforma, Challan, Notification, FuelEntry, TimesheetEntry, ComplianceRecord, OwnerProfile } from '../types';
export declare function getToken(): string | null;
export declare function setToken(token: string): void;
export declare function clearToken(): void;
export interface AuthResponse {
    token: string;
    user_id: string;
    tenant_id: string;
    role: string;
    phone: string;
    email: string;
    email_verified: boolean;
}
export interface MeResponse {
    user_id: string;
    tenant_id: string;
    role: string;
    phone: string;
    email: string;
    email_verified: boolean;
}
type MaintenanceEntry = {
    id: string;
    date: string;
    type: string;
    cost?: number;
    notes?: string;
};
export declare const api: {
    login(phone: string, password: string, email?: string): Promise<AuthResponse>;
    register(phone: string, password: string, role: string, company_name?: string, tenant_code?: string, email?: string): Promise<AuthResponse>;
    googleAuth(credential: string): Promise<AuthResponse>;
    me(): Promise<MeResponse>;
    exportAll(): Promise<AppState>;
    importAll(data: AppState): Promise<void>;
    getCranes(): Promise<Crane[]>;
    createCrane(c: Omit<Crane, "id">): Promise<Crane>;
    updateCrane(id: string, c: Partial<Crane>): Promise<Crane>;
    deleteCrane(id: string): Promise<void>;
    getOperators(): Promise<Operator[]>;
    createOperator(o: Omit<Operator, "id">): Promise<Operator>;
    updateOperator(id: string, o: Partial<Operator>): Promise<Operator>;
    deleteOperator(id: string): Promise<void>;
    getOperatorProfile(operatorId: string): Promise<Record<string, string>>;
    updateOperatorProfile(operatorId: string, data: Record<string, string>): Promise<Record<string, string>>;
    getMyOperatorProfile(): Promise<Record<string, string>>;
    updateMyOperatorProfile(data: Record<string, string>): Promise<Record<string, string>>;
    getFuelLogs(): Promise<Record<string, FuelEntry[]>>;
    createFuelLog(data: {
        crane_reg: string;
    } & Omit<FuelEntry, "id">): Promise<FuelEntry>;
    updateFuelLog(id: string, data: Partial<FuelEntry>): Promise<FuelEntry>;
    deleteFuelLog(id: string): Promise<void>;
    getCameras(): Promise<Camera[]>;
    createCamera(c: Omit<Camera, "id">): Promise<Camera>;
    updateCamera(id: string, c: Partial<Camera>): Promise<Camera>;
    deleteCamera(id: string): Promise<void>;
    getClients(): Promise<Client[]>;
    createClient(c: Omit<Client, "id">): Promise<Client>;
    updateClient(id: string, c: Partial<Client>): Promise<Client>;
    deleteClient(id: string): Promise<void>;
    getInvoices(): Promise<Invoice[]>;
    createInvoice(inv: Omit<Invoice, "id">): Promise<Invoice>;
    updateInvoice(id: string, inv: Partial<Invoice>): Promise<Invoice>;
    deleteInvoice(id: string): Promise<void>;
    getPayments(): Promise<Payment[]>;
    createPayment(p: Omit<Payment, "id">): Promise<Payment>;
    updatePayment(id: string, p: Partial<Payment>): Promise<Payment>;
    deletePayment(id: string): Promise<void>;
    getCreditNotes(): Promise<CreditNote[]>;
    createCreditNote(cn: Omit<CreditNote, "id">): Promise<CreditNote>;
    updateCreditNote(id: string, cn: Partial<CreditNote>): Promise<CreditNote>;
    deleteCreditNote(id: string): Promise<void>;
    getQuotations(): Promise<Quotation[]>;
    createQuotation(q: Omit<Quotation, "id">): Promise<Quotation>;
    updateQuotation(id: string, q: Partial<Quotation>): Promise<Quotation>;
    deleteQuotation(id: string): Promise<void>;
    convertQuotation(id: string): Promise<Proforma>;
    getProformas(): Promise<Proforma[]>;
    createProforma(p: Omit<Proforma, "id">): Promise<Proforma>;
    updateProforma(id: string, p: Partial<Proforma>): Promise<Proforma>;
    deleteProforma(id: string): Promise<void>;
    convertProforma(id: string): Promise<Invoice>;
    getChallans(): Promise<Challan[]>;
    createChallan(c: Omit<Challan, "id">): Promise<Challan>;
    updateChallan(id: string, c: Partial<Challan>): Promise<Challan>;
    deleteChallan(id: string): Promise<void>;
    getTimesheets(): Promise<Record<string, TimesheetEntry[]>>;
    createTimesheet(data: any): Promise<unknown>;
    deleteTimesheet(id: string): Promise<void>;
    getMaintenance(): Promise<Record<string, MaintenanceEntry[]>>;
    createMaintenance(data: {
        crane_reg: string;
    } & Omit<MaintenanceEntry, "id">): Promise<MaintenanceEntry>;
    updateMaintenance(id: string, data: Partial<MaintenanceEntry>): Promise<MaintenanceEntry>;
    deleteMaintenance(id: string): Promise<void>;
    getFiles(ownerKey: string): Promise<unknown[]>;
    createFile(data: any): Promise<unknown>;
    deleteFile(id: string): Promise<void>;
    getNotifications(): Promise<Notification[]>;
    createNotification(n: Omit<Notification, "id">): Promise<Notification>;
    updateNotification(id: string, n: Partial<Notification>): Promise<Notification>;
    deleteNotification(id: string): Promise<void>;
    getCompliance(crane_reg?: string): Promise<Record<string, ComplianceRecord>>;
    upsertCompliance(crane_reg: string, data: ComplianceRecord): Promise<unknown>;
    getAttendance(opts?: {
        operator_key?: string;
        date?: string;
    }): Promise<any[]>;
    markAttendance(data: {
        operator_key: string;
        date: string;
        status?: string;
        marked_by?: string;
    }): Promise<any>;
    unmarkAttendance(operator_key: string, date: string): Promise<void>;
    getDiagnostics(): Promise<Record<string, unknown>>;
    upsertDiagnostics(crane_reg: string, data: unknown): Promise<unknown>;
    getOwnerProfile(): Promise<OwnerProfile>;
    updateOwnerProfile(data: Partial<OwnerProfile>): Promise<OwnerProfile>;
    changePassword(oldPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
    sendSmsOtp(phone: string, purpose?: string): Promise<{
        success: boolean;
        message: string;
        otp_id?: string;
        expires_in_minutes?: number;
    }>;
    verifySmsOtp(phone: string, otp: string, purpose?: string): Promise<{
        success: boolean;
        message: string;
        phone?: string;
        purpose?: string;
    }>;
    sendLoginOtp(phone: string): Promise<{
        success: boolean;
        message: string;
        expires_in_minutes: number;
    }>;
    verifyLoginOtp(phone: string, otp: string): Promise<AuthResponse>;
    registerWithOtp(phone: string, name: string, email: string, otp: string): Promise<AuthResponse>;
};
export {};
//# sourceMappingURL=api.d.ts.map