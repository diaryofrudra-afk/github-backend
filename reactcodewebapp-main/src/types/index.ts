export type Theme = 'dark' | 'light';
export type PageId =
  | 'fleet' | 'operators' | 'earnings' | 'attendance'
  | 'analytics' | 'billing' | 'clients' | 'gps' | 'fuel' | 'cameras'
  | 'diagnostics' | 'logger' | 'op-history' | 'op-attendance'
  | 'engine-status' | 'gst-verification';

export interface Crane {
  id: string;
  reg: string;
  type: string;
  make?: string;
  model?: string;
  capacity?: string;
  year?: string;
  rate: number;
  otRate?: number;
  ot_rate?: number;
  dailyLimit?: number;
  daily_limit?: number;
  operator?: string;
  site?: string;
  status?: string;
  notes?: string;
  emi?: number;
  fixedExpenses?: number;
  fixed_expenses?: number;
}

export interface Operator {
  id: string;
  name: string;
  phone: string;
  license?: string;
  aadhaar?: string;
  assigned?: string;
  status?: string;
  temp_password?: string;
}

export interface OperatorProfile {
  [operatorId: string]: {
    photo?: string;
    aadhaar_doc?: string;
    license_doc?: string;
    bank?: string;
    ifsc?: string;
    account?: string;
    address?: string;
    name?: string;
    salary?: number;
    workingDays?: number;
  };
}

export interface OwnerProfile {
  name: string;
  roleTitle: string;
  role_title?: string;
  phone: string;
  email: string;
  company: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gst: string;
  website: string;
  defaultLimit: string;
  default_limit?: string;
  photo?: string;
}

export interface FuelEntry {
  id: string;
  crane_reg?: string;
  date: string;
  litres: number;
  cost: number;
  odometer?: number;
  type?: string;
  notes?: string;
}

export interface Camera {
  id: string;
  reg: string;
  label: string;
  url: string;
  type?: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contact_person?: string;
}

export interface InvoiceItem {
  description: string;
  hsn?: string;
  gstRate?: number;
  qty: number;
  rate: number;
  amount: number;
  cgst?: number;
  sgst?: number;
  discount?: number;
  unit?: string;
  imageUrl?: string;
}

export interface InvoiceShipping {
  enabled?: boolean;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface InvoiceAdvancedOptions {
  hsnView?: 'default' | 'combined';
  displayUnit?: 'merge' | 'separate';
  showTaxSummary?: 'show' | 'hide';
  hidePlaceOfSupply?: boolean;
  showHsnSummary?: boolean;
  addOriginalImages?: boolean;
  showThumbnails?: boolean;
  showDescriptionFullWidth?: boolean;
  hideSubtotalGroup?: boolean;
  showSku?: boolean;
  showSerialNumbers?: boolean;
  displayBatchDetails?: boolean;
  numberFormat?: 'indian' | 'international';
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  due_date?: string;
  validUntil?: string;
  valid_until?: string;
  clientId: string;
  client_id?: string;
  assetReg?: string;
  asset_reg?: string;
  items: InvoiceItem[];
  subtotal: number;
  sgst: number;
  cgst: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';
  paidAmount?: number;
  paid_amount?: number;
  notes?: string;
  terms?: string[];
  signatureUrl?: string;
  signature_url?: string;
  discount?: number;
  additionalCharges?: number;
  additional_charges?: number;
  totalInWords?: string;
  total_in_words?: string;
  customFields?: Record<string, string>;
  custom_fields?: Record<string, string>;
  advancedOptions?: InvoiceAdvancedOptions;
  advanced_options?: InvoiceAdvancedOptions;
  shipping?: InvoiceShipping;
  currency?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoice_id?: string;
  date: string;
  amount: number;
  method?: string;
  reference?: string;
}

export interface CreditNote {
  id: string;
  number: string;
  date: string;
  invoiceId: string;
  invoice_id?: string;
  amount: number;
  reason?: string;
}

export interface Quotation {
  id: string;
  number: string;
  date: string;
  validUntil?: string;
  valid_until?: string;
  clientId: string;
  client_id?: string;
  assetReg?: string;
  asset_reg?: string;
  items: InvoiceItem[];
  subtotal: number;
  sgst: number;
  cgst: number;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes?: string;
  terms?: string[];
}

export interface Proforma {
  id: string;
  number: string;
  date: string;
  clientId: string;
  client_id?: string;
  assetReg?: string;
  asset_reg?: string;
  items: InvoiceItem[];
  subtotal: number;
  sgst: number;
  cgst: number;
  total: number;
  status: string;
  quotationId?: string;
  quotation_id?: string;
  notes?: string;
}

export interface Challan {
  id: string;
  number: string;
  date: string;
  clientId: string;
  client_id?: string;
  assetReg?: string;
  asset_reg?: string;
  site?: string;
  items: InvoiceItem[];
  status: string;
  notes?: string;
}

export interface TimesheetEntry {
  id: string;
  date: string;
  startTime: string;
  start_time?: string;
  endTime: string;
  end_time?: string;
  hoursDecimal: number;
  hours_decimal?: number;
  operatorId?: string;
  operator_id?: string;
  crane_reg?: string;
  operator_key?: string;
  notes?: string;
}

export interface ComplianceRecord {
  insurance?: { date: string; notes?: string };
  fitness?: { date: string; notes?: string };
}

export interface MaintenanceRecord {
  [reg: string]: Array<{ id: string; date: string; type: string; cost?: number; notes?: string }>;
}

export interface Notification {
  id: string;
  user_key?: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
  read?: boolean;
}


export interface BlackbuckVehicle {
  registration_number: string;
  status: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  last_updated?: string;
  engine_on?: boolean;
  ignition_status?: string;
  ignition_lock?: boolean;
  signal?: string;
  address?: string;
  [key: string]: unknown;
}

export interface WheelsEyeVehicle {
  registration_number: string;
  status: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  last_updated?: string;
  engine_on?: boolean;
  ignition_status?: string;
  signal?: string;
  address?: string;
  [key: string]: unknown;
}

export interface BlackbuckData {
  vehicles: BlackbuckVehicle[];
  error?: string;
  is_mock?: boolean;
  [key: string]: unknown;
}

export interface TrakNTellData {
  iframe_url?: string;
  error?: string;
  vehicles?: TrakNTellVehicle[];
  [key: string]: unknown;
}

export interface TrakNTellVehicle {
  registration_number: string;
  vehicle_id?: string;
  status: string;
  ignition?: string;           // "on" | "off" | "unknown" — ENGINE status
  latitude?: number;
  longitude?: number;
  speed?: number;
  last_updated?: string;
  address?: string;
  // Network / Signal
  gsm_signal?: number;         // GSM signal strength (0-31)
  network_status?: string;     // "good" | "fair" | "weak" | "lost"
  is_gsm_working?: boolean;
  is_gps_working?: boolean;
  // Device Health
  main_voltage?: number;
  backup_voltage?: number;
  battery_charge?: string;
  is_main_power_low?: boolean;

  // ── SLI Crane Sensors ──
  sli_duty?: number;
  sli_angle?: number;
  sli_radius?: number;
  sli_length?: number;
  sli_load?: number;
  sli_swl?: number;
  sli_overload?: number;
  battery_charge_status?: string;
  sos_button?: string;
  ain_sensors?: Array<{ label: string; value: unknown; units: string }>;

  // ── J1939 CAN Bus ──
  j1939_hour_meter?: number;
  j1939_coolant_temp?: number;
  j1939_oil_pressure?: number;
  j1939_fuel_level?: number;
  j1939_engine_speed?: number;
  j1939_fuel_consumption?: number;
  j1939_mil?: boolean;
  j1939_stop_indicator?: boolean;
  j1939_battery_potential?: number;
  j1939_trans_oil_temp?: number;
  j1939_urea_level?: number;
  j1939_water_in_fuel?: boolean;

  // ── Other Sensors ──
  temperature?: number;
  temperature2?: number;
  rpm?: number;
  fuel_percentage?: number;
  fuel_litres?: number;

  // ── GPS Quality ──
  heading?: number;
  altitude?: number;
  gps_satellites?: number;
  hdop?: number;

  [key: string]: unknown;
}

export interface AttendanceRecord {
  id: string;
  operator_key: string;
  date: string;
  status: string;
  marked_by: string;
}

export interface AppState {
  cranes: Crane[];
  operators: Operator[];
  operatorProfiles: OperatorProfile;
  ownerProfile: OwnerProfile;
  fuelLogs: Record<string, FuelEntry[]>;
  cameras: Camera[];
  integrations: { fuel: Record<string, unknown>; cameras: Record<string, unknown> };
  advancePayments: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  quotations: Quotation[];
  proformas: Proforma[];
  challans: Challan[];
  files: Record<string, unknown[]>;
  timesheets: Record<string, TimesheetEntry[]>;
  compliance: Record<string, ComplianceRecord>;
  attendance: AttendanceRecord[];
  maintenance: MaintenanceRecord;
  notifications: Notification[];
  opNotifications: Record<string, Notification[]>;
}

export interface EngineStatusRecord {
  id: string;
  crane_reg: string;
  engine_on: boolean;
  previous_status: boolean | null;
  changed_at: string;
  source: string;
  location_lat: number | null;
  location_lng: number | null;
  speed: number | null;
  address: string | null;
  tenant_id: string;
}

export interface EngineStatusDuration {
  status: 'ON' | 'OFF';
  start_time: string;
  end_time: string;
  duration_seconds: number;
}
