# Suprwise — Fleet Management Platform

## Project Overview

**Suprwise** is a full-stack fleet management application for crane and heavy equipment operations. It provides two complementary parts:

| Component | Path | Tech Stack |
|-----------|------|------------|
| **Frontend (React Web App)** | `reactcodewebapp-main/` | React 19, TypeScript, Vite, Chart.js |
| **Backend (REST API)** | `github-backend-main/` | FastAPI (Python), SQLite, JWT auth |

### Key Features

- **Fleet Management** — Register, track, and manage cranes (registration, type, capacity, rates, site assignments)
- **Operator Management** — Operator profiles, assignments, timesheets, and attendance tracking
- **Billing & Invoicing** — Invoices, payments, credit notes, quotations, proformas, challans (GST-compliant with SGST/CGST)
- **Fuel Tracking** — Per-vehicle fuel log entries (litres, cost, odometer)
- **GPS & Cameras** — Vehicle GPS tracking integration and camera feed management
- **Diagnostics & Maintenance** — Equipment maintenance records and diagnostics
- **Compliance** — Insurance, fitness tracking, and other regulatory compliance
- **Role-Based Access** — Separate dashboards for **owners** (full access) and **operators** (logger, history, attendance)
- **Export** — XLSX (SheetJS) and PDF (jsPDF) export capabilities

---

## Architecture

### Frontend (`reactcodewebapp-main/`)

- **Framework:** React 19 with TypeScript, built with Vite
- **Styling:** CSS custom properties (CSS variables) with dark/light theme support
- **Routing:** Client-side page management via `AppContext` (no React Router; pages are conditionally rendered)
- **Key Directories:**
  - `src/components/` — Reusable UI components (layout, forms, tables, modals)
  - `src/pages/` — Feature pages (Fleet, Operators, Earnings, Attendance, Analytics, Billing, GPS, Fuel, Cameras, Diagnostics, Logger, OpHistory)
  - `src/services/` — API client (`api.ts`) that proxies to the backend at `localhost:8000`
  - `src/context/` — Global state management via React Context (`AppContext`)
  - `src/types/` — TypeScript type definitions for all domain entities (`AppState`, `Crane`, `Operator`, `Invoice`, etc.)
  - `src/hooks/` — Custom React hooks
  - `src/lib/` — Utility libraries
  - `src/utils/` — Helper functions

### Backend (`github-backend-main/`)

- **Framework:** FastAPI (Python async)
- **Database:** SQLite via `aiosqlite`
- **Authentication:** JWT-based (pyjwt + bcrypt for password hashing)
- **Multi-tenancy:** Tenant-aware data isolation via the `/tenants` module
- **Key Directories:**
  - `suprwise/` — Main Python package
    - `main.py` — FastAPI app entry point with lifespan management
    - `database.py` — Database connection and initialization
    - `config.py` — Settings via `pydantic-settings` (reads from `.env`)
    - `schema.sql` — Database schema
    - `auth/`, `cranes/`, `operators/`, `billing/`, `fuel/`, `cameras/`, `clients/`, `timesheets/`, `compliance/`, `maintenance/`, `files/`, `notifications/`, `diagnostics/`, `owner_profile/`, `tenants/`, `sync/`, `gps/`, `attendance/` — Feature-specific routers
  - `src/` — TypeScript utility code (text layout / pretext rendering engine using Canvas + React)
  - `data/` — SQLite database file (`suprwise.db`)

---

## Building and Running

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.11+** and pip
- (Optional) `pip install playwright && playwright install` for browser automation

### Backend

```bash
cd github-backend-main

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment (copy and edit .env.example)
cp .env.example .env
# Edit .env: set DB_PATH, JWT_SECRET, CORS_ORIGINS

# 3. Run the server
uvicorn suprwise.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd reactcodewebapp-main

# 1. Install dependencies
npm install

# 2. Start the dev server (proxies API requests to localhost:8000)
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview

# 5. Lint
npm run lint
```

The dev server runs on `http://localhost:5173` by default.

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Example |
|---|---|---|
| `DB_PATH` | Path to the SQLite database | `./data/suprwise.db` |
| `JWT_SECRET` | Secret key for JWT signing | (use a 64-char random string) |
| `JWT_EXPIRY_DAYS` | Token expiration in days | `30` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:4173` |

---

## API Endpoints

The backend exposes RESTful API endpoints under `/api/`. Key routes include:

- `POST /api/auth/login` — Authenticate user
- `POST /api/auth/register` — Register new user
- `GET /api/auth/me` — Get current user session
- `GET/POST/PUT/DELETE /api/cranes` — Crane CRUD
- `GET/POST/PUT/DELETE /api/operators` — Operator CRUD
- `GET/POST/PUT/DELETE /api/timesheets` — Timesheet management
- `GET/POST/PUT/DELETE /api/billing/*` — Invoices, payments, credit notes, quotations, proformas, challans
- `GET/POST/PUT/DELETE /api/fuel` — Fuel log entries
- `GET/POST/PUT/DELETE /api/cameras` — Camera management
- `GET/POST/PUT/DELETE /api/clients` — Client management
- `GET/POST/PUT/DELETE /api/compliance` — Compliance records
- `GET/POST/PUT/DELETE /api/maintenance` — Maintenance records
- `GET/POST/PUT/DELETE /api/attendance` — Attendance tracking
- `GET/POST/PUT/DELETE /api/gps` — GPS tracking data
- `GET/POST/PUT/DELETE /api/notifications` — User notifications
- `GET/POST/PUT/DELETE /api/diagnostics` — Vehicle diagnostics
- `GET/POST/PUT/DELETE /api/owner-profile` — Owner profile management
- `GET/POST/PUT/DELETE /api/tenants` — Multi-tenant management
- `GET/POST/PUT/DELETE /api/sync` — Data synchronization
- `GET /api/export/all` — Export all data

---

## Development Conventions

### Frontend

- **TypeScript** is used throughout with strict mode
- **Type definitions** are centralized in `src/types/index.ts`
- **API calls** go through the centralized `src/services/api.ts` client
- **State management** uses React Context (`AppContext`) rather than Redux/Zustand
- **Error boundaries** wrap each page component
- **CSS custom properties** (`--bg`, `--accent`, `--t1`, etc.) for theming
- **Responsive design** with mobile drawer navigation and collapsible sidebar

### Backend

- **FastAPI router pattern** — each feature module has its own `router.py`
- **Async/await** throughout (`aiosqlite` for DB operations)
- **Pydantic models** for request/response validation
- **JWT middleware** for authentication on protected routes
- **Multi-tenant isolation** — data is scoped per tenant

---

## Git History

- Latest commit: `UI/UX overhaul: responsive design, custom icons, pitch black dark theme, smooth sidebar animations`
- The project is actively maintained with focus on modernization and UX improvements
