# Session Notes — April 7, 2026

## OTP Generation (Phone: 9010719021)

### How OTP Works
- Stored in SQLite: `github-backend-main/data/suprwise.db` → `sms_otps` table
- Phone format: **without** `+91` prefix (e.g., `"9010719021"`)
- Single-use: OTP is **deleted** after successful verification
- Expires after 10 minutes or 3 failed attempts

### Generate OTP (quick command)
```bash
cd github-backend-main && python3 -c "
import sqlite3, random, string
from datetime import datetime, timezone, timedelta

conn = sqlite3.connect('./data/suprwise.db')
cursor = conn.cursor()
cursor.execute('DELETE FROM sms_otps WHERE phone = ?', ('9010719021',))
otp = ''.join(random.choices(string.digits, k=6))
expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
otp_id = f'9010719021:{otp}:{int(datetime.now(timezone.utc).timestamp())}'
cursor.execute('INSERT INTO sms_otps (id, phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?, ?)',
    (otp_id, '9010719021', otp, 'login', expires_at))
conn.commit()
print(f'OTP: {otp}')
conn.close()
"
```

### Common Issues
- **"Expired" error** → OTP was already consumed or time ran out. Generate a new one.
- **Phone format mismatch** → Frontend sends `9010719021`, backend must match exactly (no `+91`).

---

## Trak N Tell GPS Integration

### Architecture (Updated April 7, 2026)
- **Service**: Direct HTTP API call to `tntServiceGetCurrentStatus` (NOT Playwright scraping)
- **Endpoint**: `https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus`
- **Credentials**: Encrypted and stored in `trakntell_credentials` table
- **Required cookies**: `JSESSIONID` + `tnt_s` from Chrome while logged into Trak N Tell

### API Response Structure
```json
{
  "response": [{
    "nick_name": "ECE02205CS0070719",
    "KNOWNLOCATION": "Basanaputi, Ganjam, Southern Division, Odisha 761002, India",
    "KNOWNLATITUDE": 19.290402,
    "KNOWNLONGITUDE": 84.948072,
    "currentLat": 19.290402,
    "currentLong": 84.948072,
    "speed": "0",
    "ignition": 0,
    "ignition_value": "Off",
    "isIgnitionOn": false,
    "isIgnitionOff": true,
    "engine_hour": 0.0
  }]
}
```

### Ignition/Engine Status Extraction (Priority Order)
1. `ignition_value` → "On" / "Off" (string)
2. `ignition` → 1 / 0 (number)
3. `isIgnitionOn` → true/false (boolean)
4. `isIgnitionOff` → true/false (boolean)

**Mapped to**: `ignition: "on" | "off" | "unknown"`

### Coordinate Fields (fallback order)
- **Latitude**: `currentLat` → `latitude` → `KNOWNLATITUDE`
- **Longitude**: `currentLong` → `longitude` → `KNOWNLONGITUDE`

### Current Vehicle (April 7, 2026)
| Field | Value |
|-------|-------|
| Registration | ECE02205CS0070719 |
| 🔑 Engine | **OFF** |
| 📊 Status | stopped |
| ⚡ Speed | 0 km/h |
| 📡 GSM Signal | **11 (LOST)** — `isGSMNotWorking: true` |
| 🔌 Main Power | **0.41V** (⚠️ LOW) |
| 🔋 Backup | 0.0V |
| 🔋 Battery Charge | Off |
| 🛰️ GPS | **LOST** — `isGPSNotWorking: true` |
| **Latitude** | **19.290402** |
| **Longitude** | **84.948072** |
| Location | Basanaputi, Ganjam, Southern Division, Odisha 761002, India |
| Last Updated | Apr 03 |

### Network Status Mapping
| GSM Signal | Status | Meaning |
|-----------|--------|---------|
| 0 or `isGSMNotWorking=true` | 🔴 **lost** | No network connection |
| 1-9 | 🟡 **weak** | Poor signal |
| 10-14 | 🟡 **fair** | Acceptable |
| 15-31 | 🟢 **good** | Strong signal |

## Live GPS Page (GPSPage.tsx) — Unified Features

### Unified Settings Panel (Tabs)
- **🚛 Blackbuck tab**: Auth Token + Fleet Owner ID
- **📡 Trak N Tell tab**: User ID + User ID Encrypt + Org ID + JSESSIONID + tnt_s
- Both providers can be configured from the same settings gear icon

### Unified Vehicle Table Columns
1. Registration
2. Provider (Blackbuck / Trak N Tell badge)
3. Status (moving/stopped with colored dot)
4. **Engine / Ignition** (🟢 ENGINE ON / 🔴 ENGINE OFF)
5. Speed
6. **Network / Power** (GSM signal badge + voltage + GPS status)
7. Coordinates
8. Last Updated

### Interactive Map (Leaflet)
- Shows all vehicles with colored markers (🟢 moving, 🔴 stopped, 🟡 idle)
- Click markers for popup: Engine, Status, Speed, GSM Signal, Power, GPS, Location, Coordinates
- "Open in Google Maps" link in popup
- Auto-fits bounds to show all vehicles
- Toggle show/hide

### Status Bar
- Shows connection status for both providers
- Engine-on count (e.g., "1/1 engine on")
- Provider breakdown (e.g., "0 Blackbuck, 1 Trak N Tell")

### Credentials (Encrypted)
- **Trak N Tell user_id**: `7008693400`
- **orgid**: `f0391b0f72adb6e723d6ea77ea29c849`
- **JSESSIONID** format: `E25E18B1A61379B61189805CA0B1537C` (32-char hex)
- **tnt_s** format: `s=<hex>&v=1`

### Extract Fresh JSESSIONID
1. Open Chrome → https://web.trakntell.com → Log in
2. DevTools (Cmd+Option+I) → Application → Cookies → `https://web.trakntell.com`
3. Copy `JSESSIONID` and `tnt_s` values
4. Update via Suprwise GPS settings page or manually in DB

### Manual Credential Update
```python
cd github-backend-main && python3 -c "
import sqlite3
from suprwise.trakntell.crypto import encrypt_token

conn = sqlite3.connect('./data/suprwise.db')
cursor = conn.cursor()
cursor.execute('SELECT id FROM users WHERE phone = ?', ('9010719021',))
user_id = cursor.fetchone()[0]

JSESSIONID = '<paste_value>'
TNT_S = '<paste_value>'

cursor.execute('''
    UPDATE trakntell_credentials
    SET sessionid_encrypted = ?, tnt_s_encrypted = ?, updated_at = datetime('now')
    WHERE user_id = ?
''', (encrypt_token(JSESSIONID), encrypt_token(TNT_S), user_id))
conn.commit()
conn.close()
print('✅ Updated')
"
```

---

## Backend Server

### Start Command
```bash
cd github-backend-main
python3 -m uvicorn suprwise.main:app --host 0.0.0.0 --port 8000 --reload
```

### Key Files Modified
| File | Change |
|------|--------|
| `suprwise/trakntell/service.py` | Replaced Playwright scraping with direct API call to `tntServiceGetCurrentStatus` |
| `suprwise/database.py` | Fixed `trakntell_credentials` migration — column existence check (lines 57-82) |
| `extract_trakntell_session.py` | Created — JSESSIONID extraction helper |
| `suprwise/gps/router.py` | Added unified `/sync-to-fleet` endpoint for both providers |
| `reactcodewebapp-main/src/pages/Fleet/VehicleCard.tsx` | Added edit button (amber pencil icon) |
| `reactcodewebapp-main/src/pages/Fleet/FleetPage.tsx` | Added edit modal + handler + `onEdit` prop |

## Unified Fleet Sync (GPS → Fleet)

### Backend: `POST /api/gps/sync-to-fleet`
- Syncs **both** Blackbuck + Trak N Tell vehicles to the `cranes` table
- UPSERT: matches by normalized reg (spaces removed, uppercase)
- Existing → updates status + notes with GPS data
- New → inserts crane with provider details
- Returns: `{ ok: true, added: N, updated: N }`

### Frontend: GPSPage "Add to Fleet" button
- Calls `/api/gps/sync-to-fleet` (unified)
- Toast: "X vehicles added, Y updated"

## Fleet Edit Functionality

### Edit Button (VehicleCard)
- 🟡 Amber pencil icon on each card
- Opens modal with all fields pre-filled

### Editable Fields
- Registration, Type, Make, Model, Capacity, Year, Rate, OT Rate, Daily Limit, Site

### Save Flow
- `api.updateCrane(id, { ... })` → updates backend
- Updates local state → shows success toast

### Known DB Migration Fix
The `trakntell_credentials` table migration now safely checks for column existence before `ALTER TABLE`:
```python
cursor = await _db.execute("PRAGMA table_info(trakntell_credentials)")
tnt_cols = [r[1] for r in await cursor.fetchall()]
if "sessionid_encrypted" not in tnt_cols:
    await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN sessionid_encrypted TEXT")
if "tnt_s_encrypted" not in tnt_cols:
    await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN tnt_s_encrypted TEXT")
```

---

## API Endpoints (Quick Reference)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/verify-login-otp` | POST | No | Verify OTP → get JWT token |
| `/api/gps/trakntell/vehicles` | GET | Yes | Fetch Trak N Tell vehicles |
| `/api/gps/trakntell/credentials` | GET | Yes | Check credential status |
| `/api/gps/trakntell/credentials` | PUT | Yes | Save new credentials |
| `/api/sms-otp/send` | POST | No | Send OTP via Fast2SMS |
| `/api/sms-otp/verify` | POST | No | Verify SMS OTP |
