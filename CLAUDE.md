# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Suprwise is a fleet management SaaS platform for crane/heavy equipment operators in India. This repository contains both the Python FastAPI backend (`github-backend-main/`) and the React frontend (`reactcodewebapp-main/`).

---

## Backend (`github-backend-main/`)

### Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server (port 8000)
uvicorn suprwise.main:app --reload --host 0.0.0.0 --port 8000

# API docs (Swagger UI, when server is running)
# http://localhost:8000/docs

# Run available test suites
python3 suprwise/auth/test_otp.py              # 18 tests: OTP, password hashing, auth models
python3 suprwise/gps/test_gps_integration.py   # 12 tests: Blackbuck GPS service
python3 suprwise/gps/test_user_credentials.py  # 6 tests: per-user credential isolation
python3 test_fast2sms.py +91XXXXXXXXXX         # Live SMS send test (sends a real SMS)
```

No test framework configured (no pytest.ini, conftest.py). No linting configuration.

### Architecture

**Entry point:** `suprwise/main.py` — initializes FastAPI, registers all route modules, runs DB migrations via lifespan context (`init_db()` on startup, `close_db()` on shutdown).

**Module structure** — each module under `suprwise/` follows this pattern:
- `router.py` — FastAPI endpoints
- `models.py` — Pydantic v2 request/response schemas
- `service.py` — Business logic + raw aiosqlite queries (no ORM)

**Modules:**
- `auth/` — Register (owner creates tenant; operator links to existing tenant), login by phone or email+password, passwordless OTP login, Google OAuth, password reset via OTP, JWT creation/decode
- `sms_otp/` — SMS OTP generation, storage in `sms_otps` table, delivery via Fast2SMS Quick SMS route (route=q); falls back to console logging in dev. Phone stored without `+91` prefix (e.g. `"9010719021"`)
- `email_otp/` — Email OTP via SMTP (renamed from `email/` to avoid Python stdlib conflict); used for password reset and email verification
- `operators/` — Operator profiles with Aadhaar/license fields (India-specific)
- `cranes/` — Equipment/asset management
- `fuel/` — Fuel consumption logging
- `timesheets/` — Work hours tracking per crane+operator
- `attendance/` — Daily attendance with UNIQUE(operator_key, date, tenant_id)
- `clients/` — Customer management with GST fields
- `billing/` — Invoices, quotations, proformas, credit notes, challans; GST (SGST/CGST) calculations
- `payments/` — Payment recording against invoices
- `cameras/` — Camera URL/stream configuration
- `maintenance/` — Equipment maintenance logs
- `compliance/` — Insurance and fitness certificate tracking
- `diagnostics/` — Equipment health snapshots
- `gps/` — Blackbuck GPS integration; per-user encrypted credentials in `blackbuck_credentials` table; `POST /api/gps/sync-to-fleet` syncs both Blackbuck + Trak N Tell vehicles to `cranes` table
- `trakntell/` — Trak N Tell GPS; direct HTTP call to `tntServiceGetCurrentStatus` endpoint (not Playwright); per-user encrypted JSESSIONID + tnt_s cookies in `trakntell_credentials`
- `owner_profile/` — Fleet owner company profile
- `files/` — Document storage (binary data in SQLite)
- `notifications/` — In-app notifications
- `tenants/` — Tenant info
- `sync/` — Full data export/import (`exportAll`/`importAll`) for offline-first backup

**Database:** SQLite (async via `aiosqlite`), 21 tables. Schema in `suprwise/schema.sql`. Auto-migration on startup adds missing columns via `PRAGMA table_info` checks — no Alembic. WAL mode + FK enforcement enabled. Default path: `./data/suprwise.db`.

**Authentication:**
- JWT (30-day default), bcrypt passwords, role-based (`owner` vs `operator`)
- `auth/dependencies.py` exports `get_current_user` and `require_owner` FastAPI dependencies — use on all protected endpoints
- Multi-tenant: all DB queries must filter by `user["tenant_id"]` from the JWT payload

**GPS credential encryption:** Fernet (AES-128-CBC). Key derived from SHA-256 of `JWT_SECRET` → 32-byte Fernet key. Stored in `blackbuck_credentials.auth_token_encrypted` and `trakntell_credentials.*_encrypted` columns. Token files (`blackbuck_token.json`, `blackbuck_cookies.json`) are gitignored.

**Trak N Tell credential setup:** Get JSESSIONID + tnt_s from Chrome DevTools → Application → Cookies while logged into `https://web.trakntell.com`. Save via `PUT /api/gps/trakntell/credentials`.

### Dev Tips

**Manual OTP generation for testing:**
```bash
cd github-backend-main && python3 -c "
import sqlite3, random, string
from datetime import datetime, timezone, timedelta
conn = sqlite3.connect('./data/suprwise.db')
cursor = conn.cursor()
phone = '9010719021'  # no +91 prefix
cursor.execute('DELETE FROM sms_otps WHERE phone = ?', (phone,))
otp = ''.join(random.choices(string.digits, k=6))
expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
otp_id = f'{phone}:{otp}:{int(datetime.now(timezone.utc).timestamp())}'
cursor.execute('INSERT INTO sms_otps (id, phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?, ?)',
    (otp_id, phone, otp, 'login', expires_at))
conn.commit(); print(f'OTP: {otp}'); conn.close()
"
```

### Required Environment Variables

See `.env.example`. Critical:
- `JWT_SECRET` — must be changed in production; also used as Fernet encryption key for GPS credentials
- `FAST2SMS_API_KEY` — for SMS OTP (fast2sms.com dashboard); ₹0.20/SMS, no DLT registration needed
- `CORS_ORIGINS` — comma-separated allowed origins
- `BLACKBUCK_AUTH_TOKEN` + `BLACKBUCK_FLEET_OWNER_ID` — legacy fallback; newer flow uses per-user DB credentials
- `GOOGLE_CLIENT_ID` — for Google OAuth (`POST /api/auth/google`)
- `SMTP_*` — for email OTP (password reset flow); optional if only using SMS OTP

---

## Frontend (`reactcodewebapp-main/`)

### Commands

```bash
npm install
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint
```

Set `VITE_API_BASE` for the API URL (defaults to `/api` proxy). Set `VITE_GOOGLE_CLIENT_ID` to match `GOOGLE_CLIENT_ID` in backend for Google OAuth.

### Architecture

**State management:** Single `AppContext` (React Context) — no Redux. Full state shape typed as `AppState` in `src/types/index.ts`.

**Routing:** Role-based rendering in `App.tsx` — `owner` sees fleet management pages, `operator` sees logger/attendance.

**API layer:** `src/services/api.ts` — 40+ methods, auto-converts camelCase ↔ snake_case. JWT in `localStorage` as `suprwise_token`. On 401, clears token and reloads.

**GPS:** `src/hooks/useUnifiedGPS.ts` fetches Blackbuck + Trak N Tell in parallel via `Promise.allSettled()`. Each vehicle gets a `provider: 'blackbuck' | 'trakntell'` field.

**Key patterns:**
- All domain types in `src/types/index.ts` — add new types there
- Charts: `react-chartjs-2` + Chart.js
- Maps: `leaflet` for GPS tracking
- CSS: CSS variables for theming (pitch black dark theme)
- Pages — Owner: Fleet, Operators, Earnings, Attendance, Analytics, Billing, GPS, Fuel, Cameras, Diagnostics; Operator: Logger, OpHistory, Attendance
