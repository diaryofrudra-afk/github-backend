# Unified GPS Integration — Blackbuck + Trak N Tell

## Overview
This document describes the integration of Trak N Tell GPS data into the unified vehicle table alongside Blackbuck vehicles.

## What Changed

### Backend Changes

#### 1. **Trak N Tell Service** (`github-backend-main/suprwise/trakntell/service.py`)
- Added `fetch_trakntell_vehicle_data()` function to fetch actual vehicle data via HTTP API
- Updated credential storage to include `sessionid_encrypted` for JSESSIONID cookie-based authentication
- Added vehicle data mapping function `_map_trakntell_vehicle()` to normalize Trak N Tell response format
- Updated `_get_user_credentials()` to decrypt and return sessionid
- Database query now fetches 4 fields instead of 3: `user_id`, `user_id_encrypt`, `orgid`, `sessionid`

#### 2. **Trak N Tell Router** (`github-backend-main/suprwise/trakntell/router.py`)
- Added new endpoint: `GET /api/gps/trakntell/vehicles` — returns live vehicle data
- Updated `TrakNTellCredentialsInput` model to include optional `sessionid` field
- Updated `set_trakntell_credentials()` to pass sessionid to service layer

#### 3. **Database Schema** (`github-backend-main/suprwise/database.py`)
- Added `sessionid_encrypted TEXT` column to `trakntell_credentials` table
- Includes migration script (`ALTER TABLE`) for existing databases

### Frontend Changes

#### 1. **New Unified GPS Hook** (`reactcodewebapp-main/src/hooks/useUnifiedGPS.ts`)
- **NEW FILE** — Merges vehicles from both Blackbuck and Trak N Tell
- Fetches from both APIs in parallel using `Promise.allSettled()`
- Adds `provider: 'blackbuck' | 'trakntell` field to each vehicle
- Returns unified vehicle list with counts per provider
- Handles errors gracefully (one provider failing doesn't break the other)

#### 2. **Trak N Tell Page** (`reactcodewebapp-main/src/pages/TrakNTell/TrakNTellPage.tsx`)
- Replaced iframe display with unified vehicle table
- Added JSESSIONID input field to settings form
- Updated status bar to show vehicle counts from both providers
- Table columns: Registration, Provider, Status, Speed, Signal, Coordinates, Last Updated
- Provider badges: Blue for Blackbuck, Green for Trak N Tell
- Status indicators with color coding and pulse animations

#### 3. **GPS Page** (`reactcodewebapp-main/src/pages/GPS/GPSPage.tsx`)
- Updated to use `useUnifiedGPS()` hook instead of `useBlackbuck()`
- Status bar now shows combined vehicle count: "X Blackbuck, Y Trak N Tell"
- Engine-on count still works (Blackbuck-only field)
- All sync/refetch operations now fetch from both providers

#### 4. **Trak N Tell Settings Hook** (`reactcodewebapp-main/src/hooks/useTrakNTellSettings.ts`)
- Updated `saveCredentials()` to accept optional `sessionid` parameter
- Added `has_sessionid` field to credentials interface

## How It Works

### Data Flow

```
[User saves credentials]
    ↓
Frontend: saveCredentials(userId, userIdEncrypt, orgid, sessionid)
    ↓
Backend: PUT /api/gps/trakntell/credentials
    ↓
Backend: Encrypts all 4 values with Fernet → stores in DB
    ↓
[User views GPS page]
    ↓
Frontend: useUnifiedGPS() fetches in parallel:
    - GET /api/gps/blackbuck
    - GET /api/gps/trakntell/vehicles
    ↓
Backend (Blackbuck): Returns vehicles from Blackbuck API
Backend (Trak N Tell): 
    - Decrypts credentials (including sessionid)
    - Makes HTTP GET to Trak N Tell API with JSESSIONID cookie
    - Maps response to unified format
    ↓
Frontend: Merges both vehicle lists → adds provider field
    ↓
UI: Displays unified table with provider badges
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/gps/blackbuck` | Blackbuck vehicles (existing) |
| `GET` | `/api/gps/trakntell/vehicles` | **NEW** — Trak N Tell vehicles |
| `GET` | `/api/gps/trakntell/iframe-url` | Trak N Tell iframe URL (legacy, still available) |

### Vehicle Data Structure

Both providers return vehicles in this unified format:

```typescript
interface UnifiedVehicle {
  registration_number: string;
  status: string; // "moving" | "stopped" | "signal_lost" | "unknown"
  latitude?: number;
  longitude?: number;
  speed?: number;
  last_updated?: string;
  engine_on?: boolean; // Blackbuck only
  ignition_status?: string; // Blackbuck only
  signal?: string;
  address?: string;
  provider: 'blackbuck' | 'trakntell'; // Identifies data source
}
```

## Setup Instructions

### For Users with Trak N Tell

1. **Get Credentials:**
   - Log in to Trak N Tell web interface
   - Open DevTools → Network tab
   - Find the API call that loads vehicle data
   - Extract these values:
     - `u` parameter (User ID)
     - `userIdEncrypt` parameter
     - `orgid` parameter
     - `JSESSIONID` cookie (from Application → Cookies)

2. **Save in Suprwise:**
   - Go to Trak N Tell page → Click "Settings"
   - Enter all 4 values
   - Click "Save Credentials"
   - Vehicles will appear in the unified table

### For Users with Blackbuck Only

No changes needed — existing Blackbuck integration works as before. Vehicles will show "Blackbuck" provider badge.

### For Users with Both Providers

Both sets of credentials can be saved. The unified table will show vehicles from both sources with appropriate provider badges.

## Testing

To test the integration:

1. **Backend:**
   ```bash
   cd github-backend-main
   uvicorn suprwise.main:app --reload
   ```

2. **Frontend:**
   ```bash
   cd reactcodewebapp-main
   npm run dev
   ```

3. **Verify:**
   - Open browser to `http://localhost:5173`
   - Navigate to GPS or Trak N Tell page
   - Check network tab for parallel API calls
   - Verify vehicle table shows provider badges
   - Test saving new credentials

## Error Handling

- If one provider fails, the other still displays
- Expired sessions show clear error messages
- Invalid credentials prevent saving with validation
- Empty states guide users to configure credentials

## Future Enhancements

- [ ] Auto-refresh vehicle data every 30 seconds
- [ ] WebSocket support for real-time Trak N Tell updates
- [ ] Vehicle filtering by provider
- [ ] Map view with both providers' vehicles
- [ ] Sync Trak N Tell vehicles to fleet (like Blackbuck's sync-to-fleet)
- [ ] Auto-extract JSESSIONID from iframe using postMessage

## Migration Notes

- Existing Trak N Tell credentials (without sessionid) will continue to work
- They'll only show iframe URL (legacy mode) until sessionid is added
- Database migration is backward-compatible (new column is nullable)
- No data loss during upgrade

## Files Modified

### Backend (4 files)
- `suprwise/trakntell/service.py` — Vehicle data fetching logic
- `suprwise/trakntell/router.py` — New `/vehicles` endpoint
- `suprwise/database.py` — Schema migration
- `suprwise/schema.sql` — Updated table definition

### Frontend (5 files)
- `src/hooks/useUnifiedGPS.ts` — **NEW** — Unified data hook
- `src/pages/TrakNTell/TrakNTellPage.tsx` — Vehicle table UI
- `src/pages/GPS/GPSPage.tsx` — Unified vehicle display
- `src/hooks/useTrakNTellSettings.ts` — Sessionid support
- `src/types/index.ts` — No changes needed (compatible types)

## Support

For issues or questions:
1. Check backend logs for API errors
2. Verify credentials are correct in DevTools
3. Ensure JSESSIONID is not expired
4. Review network tab for failed requests
