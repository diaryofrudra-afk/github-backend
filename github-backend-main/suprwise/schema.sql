CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'operator')),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

CREATE TABLE IF NOT EXISTS owner_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL DEFAULT '',
    role_title TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    gst TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    default_limit TEXT NOT NULL DEFAULT '8',
    photo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cranes (
    id TEXT PRIMARY KEY,
    reg TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    make TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    capacity TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    rate REAL NOT NULL DEFAULT 0,
    ot_rate REAL,
    daily_limit REAL DEFAULT 8,
    operator TEXT NOT NULL DEFAULT '',
    site TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(reg, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_cranes_tenant ON cranes(tenant_id);

CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license TEXT NOT NULL DEFAULT '',
    aadhaar TEXT NOT NULL DEFAULT '',
    assigned TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    salary REAL NOT NULL DEFAULT 0.0,
    working_days REAL NOT NULL DEFAULT 26.0,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(phone, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_operators_tenant ON operators(tenant_id);

CREATE TABLE IF NOT EXISTS operator_profiles (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES operators(id),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    photo TEXT NOT NULL DEFAULT '',
    bank TEXT NOT NULL DEFAULT '',
    ifsc TEXT NOT NULL DEFAULT '',
    account TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    UNIQUE(operator_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS fuel_logs (
    id TEXT PRIMARY KEY,
    crane_reg TEXT NOT NULL,
    date TEXT NOT NULL,
    litres REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    odometer REAL,
    type TEXT NOT NULL DEFAULT 'Diesel',
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_fuel_crane ON fuel_logs(crane_reg, tenant_id);

CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    reg TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'embed',
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_cameras_tenant ON cameras(tenant_id);

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gstin TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    contact_person TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT,
    client_id TEXT NOT NULL,
    asset_reg TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    paid_amount REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id, tenant_id);

CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id, tenant_id);

CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    valid_until TEXT,
    client_id TEXT NOT NULL,
    asset_reg TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);

CREATE TABLE IF NOT EXISTS proformas (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    client_id TEXT NOT NULL,
    asset_reg TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    quotation_id TEXT,
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_proformas_tenant ON proformas(tenant_id);

CREATE TABLE IF NOT EXISTS challans (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    client_id TEXT NOT NULL,
    asset_reg TEXT NOT NULL DEFAULT '',
    site TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'dispatched',
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_challans_tenant ON challans(tenant_id);

CREATE TABLE IF NOT EXISTS timesheets (
    id TEXT PRIMARY KEY,
    crane_reg TEXT NOT NULL DEFAULT '',
    operator_key TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    hours_decimal REAL NOT NULL,
    operator_id TEXT,
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_timesheets_operator ON timesheets(operator_key, tenant_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date, tenant_id);

CREATE TABLE IF NOT EXISTS compliance (
    id TEXT PRIMARY KEY,
    crane_reg TEXT NOT NULL,
    insurance_date TEXT,
    insurance_notes TEXT NOT NULL DEFAULT '',
    fitness_date TEXT,
    fitness_notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(crane_reg, tenant_id)
);

CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    crane_reg TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    cost REAL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_crane ON maintenance(crane_reg, tenant_id);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    timestamp TEXT NOT NULL DEFAULT '',
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_key, tenant_id);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_key TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    timestamp TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_key, tenant_id);

CREATE TABLE IF NOT EXISTS diagnostics (
    id TEXT PRIMARY KEY,
    crane_reg TEXT NOT NULL,
    health TEXT NOT NULL DEFAULT 'offline',
    snapshot TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(crane_reg, tenant_id)
);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    operator_key TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    marked_by TEXT NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(operator_key, date, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_operator ON attendance(operator_key, tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date, tenant_id);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS advance_payments (
    id TEXT PRIMARY KEY,
    operator_key TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    FOREIGN KEY(operator_key, tenant_id) REFERENCES operators(phone, tenant_id) ON DELETE CASCADE
);
