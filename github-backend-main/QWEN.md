# Suprwise Backend — Fleet Management API

## Project Overview

**Suprwise Backend** is a FastAPI-based REST API for a crane and heavy equipment fleet management platform. It provides multi-tenant, role-based data isolation for managing cranes, operators, billing, fuel, GPS tracking, cameras, compliance, maintenance, and more.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | FastAPI 0.115 (Python async) |
| **Database** | SQLite via `aiosqlite` |
| **Authentication** | JWT (pyjwt) + bcrypt password hashing |
| **HTTP Client** | httpx (async HTTP) |
| **Encryption** | Fernet (cryptography) for sensitive data at rest |
| **Web Scraping** | Playwright + BeautifulSoup (Blackbuck GPS token extraction) |

### Architecture

- **Multi-tenancy** — Every data table is scoped to a `tenant_id`. Tenants are created at owner registration.
- **Role-based access** — Two roles: `owner` (full access) and `operator` (limited access). JWT encodes user role, tenant, and phone.
- **Feature routers** — Each domain module (`auth`, `cranes`, `operators`, `billing`, `gps`, etc.) has its own FastAPI router with `models.py`, `router.py`, and optionally `service.py`.
- **Single DB connection** — Global async SQLite connection initialized at app startup via lifespan context manager.

### Project Structure

```
suprwise/
├── main.py              # FastAPI app entry point, CORS, router registration
├── database.py          # Global aiosqlite connection, init/close, schema loading
├── config.py            # Pydantic Settings (reads .env via pydantic-settings)
├── schema.sql           # Complete SQLite schema (all tables, indexes, FKs)
├── auth/                # JWT auth: register, login, change password, /me
├── cranes/              # Crane CRUD (registration, type, capacity, rates)
├── operators/           # Operator management + profiles
├── billing/             # Invoices, payments, credit notes, quotations, proformas, challans
├── timesheets/          # Operator timesheet logging
├── fuel/                # Per-crane fuel log entries
├── cameras/             # Camera feed management (embed/stream)
├── clients/             # Client/company management
├── compliance/          # Insurance, fitness tracking, regulatory
├── maintenance/         # Equipment maintenance records
├── diagnostics/         # Vehicle diagnostics + health snapshots
├── attendance/          # Operator attendance tracking
├── gps/                 # GPS tracking + Blackbuck API integration (per-user encrypted credentials)
├── files/               # File storage
├── notifications/       # User notifications
├── owner_profile/       # Owner profile management
├── tenants/             # Multi-tenant management
└── sync/                # Data synchronization

src/                     # TypeScript utilities (text layout / pretext rendering)
data/                    # SQLite database (suprwise.db) — git-ignored
```

## Building and Running

### Prerequisites

- **Python 3.11+**
- `pip` (Python package manager)
- (Optional) `playwright` for Blackbuck token extraction automation

### Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env: set DB_PATH, JWT_SECRET, CORS_ORIGINS, and optional Blackbuck credentials
```

### Run

```bash
uvicorn suprwise.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive Swagger docs at `http://localhost:8000/docs`.

### TypeScript Utilities

The `src/` directory contains TypeScript code for text layout/rendering. Build with:

```bash
npm install
npm run build   # Runs tsc
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | Path to SQLite database | `./data/suprwise.db` |
| `JWT_SECRET` | JWT signing secret (64-char random string) | `change-me` |
| `JWT_EXPIRY_DAYS` | Token expiration | `30` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `BLACKBUCK_AUTH_TOKEN` | Blackbuck GPS API auth token (optional) | — |
| `BLACKBUCK_FLEET_OWNER_ID` | Blackbuck fleet owner identifier (optional) | — |
| `BLACKBUCK_USERNAME` | Legacy Blackbuck username (deprecated) | — |
| `BLACKBUCK_PASSWORD` | Legacy Blackbuck password (deprecated) | — |

## Key API Endpoints

All routes are prefixed with `/api/`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user (creates tenant if owner) |
| `POST` | `/api/auth/register-operator` | Owner registers an operator under their tenant |
| `POST` | `/api/auth/login` | Authenticate (JWT doesn't verify password, uses phone) |
| `GET` | `/api/auth/me` | Get current user session |
| `PUT` | `/api/auth/change-password` | Change user password |
| `GET/POST/PUT/DELETE` | `/api/cranes` | Crane CRUD |
| `GET/POST/PUT/DELETE` | `/api/operators` | Operator CRUD |
| `GET/POST/PUT/DELETE` | `/api/timesheets` | Timesheet management |
| `GET/POST/PUT/DELETE` | `/api/billing/*` | Invoices, payments, credit notes, quotations, proformas, challans |
| `GET/POST/PUT/DELETE` | `/api/fuel` | Fuel log entries |
| `GET/POST/PUT/DELETE` | `/api/cameras` | Camera management |
| `GET/POST/PUT/DELETE` | `/api/clients` | Client management |
| `GET/POST/PUT/DELETE` | `/api/compliance` | Compliance records |
| `GET/POST/PUT/DELETE` | `/api/maintenance` | Maintenance records |
| `GET/POST/PUT/DELETE` | `/api/attendance` | Attendance tracking |
| `GET/POST/PUT/DELETE` | `/api/gps` | GPS tracking data |
| `GET/PUT/DELETE` | `/api/gps/blackbuck` | Blackbuck GPS integration |
| `GET/POST/PUT/DELETE` | `/api/notifications` | User notifications |
| `GET/POST/PUT/DELETE` | `/api/diagnostics` | Vehicle diagnostics |
| `GET/POST/PUT/DELETE` | `/api/owner-profile` | Owner profile management |
| `GET/POST/PUT/DELETE` | `/api/tenants` | Multi-tenant management |
| `GET/POST/PUT/DELETE` | `/api/sync` | Data synchronization |
| `GET` | `/api/export/all` | Export all data |
| `GET` | `/api/health` | Health check |
| `GET` | `/` | API info |

## Development Conventions

### Backend Patterns

- **Router pattern** — Each feature module exports a FastAPI `APIRouter` from `router.py`. All routers are imported and included in `main.py`.
- **Async/await throughout** — All DB operations use `aiosqlite`. No blocking calls.
- **Pydantic models** — Request/response validation via Pydantic models defined in each module's `models.py`.
- **JWT middleware** — Protected routes use `Depends(get_current_user)` from `auth/dependencies.py` to extract and validate the JWT bearer token.
- **Multi-tenant isolation** — Data is scoped per `tenant_id`. Queries always filter by the authenticated user's tenant.
- **Database** — Single global connection (not a pool). Initialized at startup via `lifespan` context manager. Schema is loaded from `schema.sql` on every startup (uses `CREATE TABLE IF NOT EXISTS`).

### Security

- **Password hashing** — bcrypt for user passwords.
- **JWT tokens** — Signed with `JWT_SECRET`. Contains `user_id`, `tenant_id`, `role`, and `phone`.
- **Blackbuck credentials** — Encrypted at rest using Fernet (AES-128-CBC). Scoped to `user_id` so no other user can access them.

### Testing

GPS module has dedicated test files:
```bash
python3 suprwise/gps/test_gps_integration.py
python3 suprwise/gps/test_user_credentials.py
```

No global test suite configured yet (no `pytest.ini` or `conftest.py`).

### Git

- `.gitignore` excludes `venv/`, `data/`, `__pycache__/`, `*.pyc`, and `.env`.
- The database file (`data/suprwise.db`) is not tracked.
