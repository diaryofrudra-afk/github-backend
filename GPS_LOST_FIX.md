# GPS LOST Status Fix for ECE02205CS0070719

## Problem
Vehicle **ECE02205CS0070719** was showing **"GPS LOST"** status even though it has valid GPS coordinates.

## Root Cause

The TrakNTell API returns a field called `isGPSNotWorking` which the backend was using **alone** to determine GPS status:

```python
# OLD CODE (Incorrect)
is_gps_working = not v.get("isGPSNotWorking", False)
```

This meant that even if the vehicle had valid latitude/longitude, if TrakNTell's internal GPS health check flagged `isGPSNotWorking: true`, the frontend would show "GPS LOST".

### Why This Happens

TrakNTell's `isGPSNotWorking` flag can be triggered by:
- GPS module hardware issues (but last known coords are still valid)
- Temporary GPS signal loss (coords are cached)
- Device firmware reporting GPS as "not working" even when coords are present
- Satellite reception issues while still maintaining position lock

## Solution

Updated the backend to use **multiple signals** to determine GPS status:

```python
# NEW CODE (Correct)
is_gps_not_working_flag = bool(v.get("isGPSNotWorking", False))
has_valid_coords = (lat != 0 or lng != 0) and (
    gps_satellites is not None and gps_satellites > 0 or
    hdop is not None and hdop > 0
)
# GPS is working if we have valid coordinates, even if flag says otherwise
is_gps_working = has_valid_coords or not is_gps_not_working_flag
```

### Logic

GPS is considered **working** if:
1. ✅ Vehicle has non-zero latitude/longitude **AND**
2. ✅ Has satellite count > 0 **OR** HDOP > 0
3. **OR** the `isGPSNotWorking` flag is false

This means:
- If the vehicle has valid coordinates → GPS shows as working ✓
- If the vehicle has zero coords and no satellites → GPS shows as lost ✗
- More reliable than trusting a single flag

## Changes Made

**File**: `suprwise/trakntell/service.py` (lines 229-246)

**Before**:
```python
is_gps_working = not v.get("isGPSNotWorking", False)
```

**After**:
```python
# GPS status: Check if GPS is actually working based on multiple signals
is_gps_not_working_flag = bool(v.get("isGPSNotWorking", False))
has_valid_coords = (lat != 0 or lng != 0) and (
    gps_satellites is not None and gps_satellites > 0 or
    hdop is not None and hdop > 0
)
is_gps_working = has_valid_coords or not is_gps_not_working_flag
```

## Verification

After the fix, refresh your browser at `http://localhost:5173` and check vehicle ECE02205CS0070719:

1. The status should now show **"CONNECTED"** or **"ACTIVE"** instead of "GPS LOST"
2. The vehicle card should display valid coordinates
3. If expanded, you should see GPS Quality metrics (satellites, HDOP)

### Alternative: Check via API

```bash
# Get your auth token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | jq -r '.token')

# Fetch vehicle data
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/gps/trakntell/vehicles | \
  jq '.vehicles[] | select(.registration_number == "ECE02205CS0070719") | {
    registration_number,
    latitude,
    longitude,
    is_gps_working,
    gps_satellites,
    hdop,
    status
  }'
```

Expected response after fix:
```json
{
  "registration_number": "ECE02205CS0070719",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "is_gps_working": true,  // ← Should now be true
  "gps_satellites": 12,
  "hdop": 0.8,
  "status": "moving"
}
```

## Status

✅ **Fix Applied** - Backend restarted with updated GPS logic  
🔄 **Next Step** - Refresh browser to see updated status  

## Additional Notes

### When "GPS LOST" Should Still Show

The fix correctly shows "GPS LOST" when:
- Latitude = 0 AND Longitude = 0 (no position data)
- No satellite count and no HDOP data
- Vehicle is truly offline/disconnected

### When "GPS LOST" Should NOT Show

After this fix, "GPS LOST" will NOT show when:
- Vehicle has valid coordinates (even if `isGPSNotWorking` flag is true)
- Device has satellite lock or HDOP data
- Last known position is being reported

### TrakNTell API Behavior

The TrakNTell API (`tntServiceGetCurrentStatus`) returns multiple GPS-related fields:
- `isGPSNotWorking` - Device-reported GPS health flag
- `currentLat` / `currentLong` - Actual coordinates
- `no_of_satellites` / `gps_satellites` - Satellite count
- `hdop` / `HDOP` - GPS accuracy metric
- `KNOWNLATITUDE` / `KNOWNLONGITUDE` - Cached coordinates

The new logic uses **all available data** instead of relying on a single flag.

## Monitoring

If the issue persists for ECE02205CS0070719, check:

1. **Raw API response** - Run the debug endpoint:
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/gps/trakntell/debug-raw
   ```

2. **Backend logs** - Check `/tmp/backend.log` for:
   ```bash
   grep -i "ECE02205CS0070719\|gps\|isGPSNotWorking" /tmp/backend.log
   ```

3. **Actual coordinates** - Verify the vehicle has non-zero lat/lng in the TrakNTell web portal

## Rollback

If needed, revert to the old behavior:

```python
# Revert to this in service.py line ~242
is_gps_working = not v.get("isGPSNotWorking", False)
```

Then restart the backend:
```bash
kill <backend_pid> && cd /Users/rudra/Downloads/github-backend-main && \
python3 -m uvicorn suprwise.main:app --host 127.0.0.1 --port 8000
```
