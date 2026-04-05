# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Suprwise is a fleet management SaaS platform for crane/heavy equipment operators in India. It has two sub-projects:

- `github-backend-main/` — Python FastAPI backend with SQLite
- `reactcodewebapp-main/` — React 19 + TypeScript + Vite frontend

---

## Backend (github-backend-main)

### Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server (port 8000)
uvicorn suprwise.main:app --reload --host 0.0.0.0 --port 8000

# Test Fast2SMS integration (sends a real SMS)
python3 test_fast2sms.py +91XXXXXXXXXX

# API docs (when server is running)
# http://localhost:8000/docs
```

### Architecture

Entry point: `suprwise/main.py` — initializes FastAPI, registers all 22 route modules, runs DB migrations via lifespan context.

**Module structure** (each module follows the same pattern):
- `router.py` — FastAPI endpoints
- `models.py` — Pydantic request/response schemas
- `service.py` — Business logic + DB queries

**Key modules:**
- `auth/` — JWT login, direct registration (phone + password), login by phone or email
- `gps/` — Blackbuck GPS integration for real-time vehicle tracking
- `billing/` — Invoices, quotations, proformas, credit notes, challans
- `sms_otp/` — SMS OTP via Fast2SMS REST API; OTPs stored in local `sms_otps` SQLite table
- `sync/` — Full data export/import for offline-first sync

**Database:** SQLite (async via `aiosqlite`). Schema in `suprwise/schema.sql`. Auto-migration on startup adds missing columns to existing DBs. WAL mode enabled. Default path: `./data/suprwise.db`.

**Authentication:** JWT tokens (30-day default), bcrypt passwords, role-based (`owner` vs `operator`), multi-tenant (tenant isolation at DB level).

### Required Environment Variables

See `.env.example`. Critical ones:
- `JWT_SECRET` — must be changed in production
- `FAST2SMS_API_KEY` — required for SMS OTP (get from fast2sms.com dashboard)
- `BLACKBUCK_AUTH_TOKEN` + `BLACKBUCK_FLEET_OWNER_ID` — for GPS features
- `SMTP_*` — optional, retained in config but email OTP feature has been removed

---

## Frontend (reactcodewebapp-main)

### Commands

```bash
npm install

npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

Set `VITE_API_BASE` env var for the API URL (defaults to `/api` proxy).

### Architecture

**State management:** Single `AppContext` (React Context) holds all app state — no Redux. The full state shape is typed as `AppState` in `src/types/index.ts`.

**Routing:** Role-based rendering in `App.tsx` — `owner` role sees fleet management pages, `operator` role sees logging/attendance pages.

**API layer:** `src/services/api.ts` — centralized client with 40+ methods. Automatically converts camelCase ↔ snake_case between frontend and backend. Bearer JWT stored in `localStorage` as `suprwise_token`. On 401, token is cleared and page reloads.

**Pages:**
- Owner: Fleet, Operators, Earnings, Attendance, Analytics (Chart.js), Billing, GPS (Leaflet maps), Fuel, Cameras, Diagnostics
- Operator: Logger (time tracking), OpHistory, Attendance

**Key patterns:**
- All domain types are defined in `src/types/index.ts` — add new types there
- Charts use `react-chartjs-2` with Chart.js
- Maps use `leaflet` for GPS tracking
- CSS uses CSS variables for theming (pitch black dark theme)

---

## Key Integration Notes

- The GPS integration uses Blackbuck's API. Token files (`blackbuck_token.json`, `blackbuck_cookies.json`) are gitignored but may appear in the gps/ directory during development.
- SMS OTP uses Fast2SMS (no AWS/Lambda). OTPs are generated locally, stored in the `sms_otps` SQLite table with expiry + attempt-limit enforcement, and sent via Fast2SMS REST API. No DLT registration required for the Quick SMS route.
- Registration is a single step: `POST /auth/register` with phone + password (+ optional email/company). No email OTP flow.
- The `sync/` endpoints (`exportAll`/`importAll`) allow full data portability — used for backup and offline scenarios.
- India-specific: GST calculations in billing, Aadhaar/license fields for operators.
