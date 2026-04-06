# Blackbuck GPS Integration — Complete Solution

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Suprwise App                            │
│                                                                 │
│  User A (owner) ──► GPS Settings UI ──► PUT /api/gps/blackbuck/credentials
│       │                                    │                     │
│       │                                    ▼                     │
│       │                          Encrypt token (Fernet)           │
│       │                                    │                     │
│       │                                    ▼                     │
│       │                     blackbuck_credentials table           │
│       │                        (scoped to user_id)                │
│       │                                    │                     │
│       ▼                                    ▼                     │
│  GET /api/gps/blackbuck ──► Decrypt token ──► Blackbuck API     │
│                                    │                              │
│                                    ▼                              │
│                          8 vehicles with:                        │
│                          - GPS coordinates                       │
│                          - Engine ON/OFF status                   │
│                          - Signal strength                       │
│                          - Ignition lock                         │
│                          - Full address                          │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

### Per-User Isolation
- **Table**: `blackbuck_credentials` has `user_id TEXT NOT NULL UNIQUE REFERENCES users(id)`
- **Each user** can only see/edit their own credentials
- **Operators** cannot access owner's Blackbuck data
- **Different owners** on the same Suprwise deployment cannot see each other's Blackbuck accounts

### Encryption at Rest
- **Algorithm**: Fernet (AES-128-CBC with random IV)
- **Key derivation**: SHA-256 of `JWT_SECRET` → 32-byte Fernet key
- **Stored value**: `auth_token_encrypted` (base64-encoded ciphertext)
- **Even if DB is leaked**, tokens cannot be decrypted without `JWT_SECRET`

### API Access Control
- `GET /api/gps/blackbuck` — requires valid JWT, returns data for authenticated user only
- `GET /api/gps/blackbuck/health` — returns health for authenticated user only
- `PUT /api/gps/blackbuck/credentials` — stores credentials for authenticated user only
- `DELETE /api/gps/blackbuck/credentials` — deletes credentials for authenticated user only
- **No endpoint exposes other users' credentials**

## Files Changed

### Backend
| File | Change |
|------|--------|
| `suprwise/schema.sql` | Added `blackbuck_credentials` table with user-scoped encryption |
| `suprwise/config.py` | Added `BLACKBUCK_AUTH_TOKEN`, `BLACKBUCK_FLEET_OWNER_ID` settings |
| `suprwise/gps/service.py` | Rewritten: httpx API calls + per-user credential resolution |
| `suprwise/gps/router.py` | Added credential CRUD endpoints with user isolation |
| `suprwise/gps/models.py` | Added `engine_on`, `ignition_status`, `signal`, `address` fields |
| `suprwise/gps/crypto.py` | **NEW** — Fernet encryption/decryption |
| `suprwise/gps/test_gps_integration.py` | **NEW** — 12 tests for GPS service |
| `suprwise/gps/test_user_credentials.py` | **NEW** — 6 tests for per-user isolation |
| `requirements.txt` | Added `cryptography` package |
| `.env` | Stores fallback Blackbuck credentials |

### Frontend
| File | Change |
|------|--------|
| `src/hooks/useBlackbuckSettings.ts` | **NEW** — credential management hook |
| `src/pages/GPS/GPSPage.tsx` | Added settings panel, engine/signal columns, status indicators |

## How It Works

### 1. User logs in to Suprwise
### 2. User navigates to GPS page
### 3. User clicks "Settings" → enters Blackbuck token + fleet owner ID
### 4. Backend validates token against Blackbuck API
### 5. Token is encrypted with Fernet and stored in `blackbuck_credentials` table
### 6. GPS page fetches live data using the user's decrypted credentials
### 7. Other users cannot access this data — scoped to `user_id`

## Token Refresh
When the Blackbuck token expires:
1. GPS page shows error banner with "Update Token" button
2. User gets new token from Blackbuck DevTools
3. User pastes new token in Settings → Save & Test
4. Old encrypted token is replaced

## Testing
```bash
# Backend tests (18 total, all passing)
cd github-backend-main
python3 suprwise/gps/test_gps_integration.py
python3 suprwise/gps/test_user_credentials.py

# Frontend type check
cd reactcodewebapp-main
npx tsc --noEmit
```

## AWS Deployment
Set these environment variables:
```
JWT_SECRET=<your-secret>
BLACKBUCK_AUTH_TOKEN=<fallback-token>
BLACKBUCK_FLEET_OWNER_ID=<fallback-fleet-id>
```

No Playwright, no Chrome, no browser dependencies — pure HTTP API calls.
