# Trak N Tell Integration — Setup Guide

## How It Works

Trak N Tell **cannot** be called directly from the browser due to CORS restrictions. The Suprwise backend acts as a **middleman**:

```
[Your Browser] → [Suprwise Backend] → [Trak N Tell API]
                      ↓
              Captures JSESSIONID via Playwright
                      ↓
              Fetches live vehicle data
                      ↓
              Returns data to frontend
```

## Setup Steps

### 1. Install Playwright Browsers

The backend already has Playwright in requirements.txt. Install the browser binaries:

```bash
cd github-backend-main
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure Trak N Tell Credentials

Go to **Trak N Tell page** → Click **Settings** → Enter:

| Field | Description | Example |
|-------|-------------|---------|
| **User ID** | The `u` parameter from iframe URL | `7008693400` |
| **User ID Encrypt** | The `userIdEncrypt` parameter | `ed28b961...` |
| **Org ID** | The `orgid` parameter | `f0391b0f...` |
| **JSESSIONID** | **OPTIONAL** — If you already have it | `ABC123...` |

### 3. How to Get Credentials

#### Method A: From Browser DevTools (Recommended)

1. Open Trak N Tell in Chrome/Firefox
2. Log in with your credentials
3. Open DevTools (F12) → **Network** tab
4. Refresh the page
5. Find any request to `mapsweb.TrakMTell.com`
6. Look at the **Request URL** — it contains:
   ```
   https://mapsweb.TrakMTell.com/tnt/servlet/tntWebCurrentStatus?u=7008693400&userIdEncrypt=ed28b961...&orgid=f0391b0f...
   ```
7. Copy these three values:
   - `u=...` → **User ID**
   - `userIdEncrypt=...` → **User ID Encrypt**
   - `orgid=...` → **Org ID**

#### Method B: Extract JSESSIONID (Optional)

If you want to skip the Playwright auto-capture step:

1. Open DevTools → **Application** tab
2. Go to **Cookies** → `https://mapsweb.TrakMTell.com`
3. Find `JSESSIONID` cookie
4. Copy the value

### 4. Test the Integration

#### Test with CLI Script

```bash
cd github-backend-main

# Test fetching data (requires User ID and Org ID)
python3 -m suprwise.trakntell.fetch_trakntell_data \
  --user-id "7008693400" \
  --orgid "f0391b0f..." \
  --output test_output.json

# View results
cat test_output.json | jq
```

#### Test via API

```bash
# First, save credentials via API
curl -X PUT http://localhost:8000/api/gps/trakntell/credentials \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "7008693400",
    "user_id_encrypt": "ed28b961...",
    "orgid": "f0391b0f...",
    "sessionid": ""
  }'

# Then fetch vehicles
curl http://localhost:8000/api/gps/trakntell/vehicles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq
```

### 5. Verify in UI

1. Open Suprwise frontend
2. Navigate to **Trak N Tell** page
3. You should see your vehicles in the table
4. Status bar shows: "Connected • X vehicles (Y Blackbuck, Z Trak N Tell)"

## Troubleshooting

### Issue: Shows 0 vehicles

**Cause:** Session capture failed or API endpoint mismatch

**Fix:**
1. Check backend logs for errors:
   ```bash
   # Look for Trak N Tell related logs
   tail -f nohup.out | grep -i trakntell
   ```

2. Verify credentials are correct:
   ```bash
   # Check if credentials are saved
   sqlite3 data/suprwise.db "SELECT * FROM trakntell_credentials;"
   ```

3. Test manual capture:
   ```bash
   python3 -m suprwise.trakntell.fetch_trakntell_data \
     --user-id "YOUR_USER_ID" \
     --orgid "YOUR_ORGID" \
     --headful
   ```
   (The `--headful` flag shows the browser window for debugging)

### Issue: Playwright not working

**Fix:**
```bash
# Reinstall Playwright browsers
playwright install chromium

# Verify installation
python3 -c "from playwright.async_api import async_playwright; print('✅ OK')"
```

### Issue: Session expired (401 errors)

**Cause:** Trak N Tell session expired

**Fix:**
- The backend auto-refreshes sessions on each request
- If you provided JSESSIONID manually, it may have expired
- Remove and re-save credentials to trigger fresh capture

### Issue: CORS errors in browser console

**Expected behavior:** The frontend **should not** call Trak N Tell directly.

**Correct flow:**
```
Frontend → Suprwise Backend (/api/gps/trakntell/vehicles) → Trak N Tell API
```

**If you see CORS errors**, check that:
- Frontend is calling `/api/gps/trakntell/vehicles` (not Trak N Tell directly)
- Backend is running and reachable
- No firewall blocking backend requests

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/gps/trakntell/credentials` | Save credentials |
| `GET` | `/api/gps/trakntell/vehicles` | Fetch live vehicles |
| `GET` | `/api/gps/trakntell/iframe-url` | Get iframe URL (legacy) |
| `GET` | `/api/gps/trakntell/health` | Check integration status |
| `DELETE` | `/api/gps/trakntell/credentials` | Remove credentials |

## Architecture

### Session Capture Flow

```
1. User saves credentials via UI
   ↓
2. Backend stores encrypted credentials in DB
   ↓
3. Frontend requests /api/gps/trakntell/vehicles
   ↓
4. Backend checks if JSESSIONID exists in DB
   ↓
5a. If YES: Use existing session → Fetch data
5b. If NO:  Launch Playwright browser → Login → Capture JSESSIONID → Save to DB → Fetch data
   ↓
6. Backend returns vehicle data to frontend
   ↓
7. Frontend displays in unified table
```

### Security

- **All credentials encrypted at rest** using Fernet (AES-128-CBC)
- **Encryption key** derived from JWT_SECRET
- **Per-user isolation** — each user has separate credentials
- **Multi-tenant support** — credentials scoped to tenant_id
- **No raw values exposed** — API returns only previews

## Performance

- **Session caching** — JSESSIONID cached in memory to avoid repeated Playwright launches
- **Cache invalidation** — Cleared on credential update
- **Parallel fetching** — Blackbuck + Trak N Tell fetched simultaneously
- **Timeout handling** — 15-second timeout on all external API calls

## Next Steps

After successful setup:

1. ✅ Verify vehicles appear in the table
2. ✅ Check status indicators (moving/stopped)
3. ✅ Test refresh button
4. ✅ Verify unified view with Blackbuck vehicles
5. ✅ Check error handling (disconnect network, etc.)

## Support

For issues:
1. Check backend logs first
2. Verify credentials with test script
3. Ensure Playwright is installed
4. Review network tab in browser DevTools
5. Check Trak N Tell account has active devices
