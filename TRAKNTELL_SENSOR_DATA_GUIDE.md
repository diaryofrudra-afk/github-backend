# TrakNTell Live Load Sensor Data Guide

## Overview
The TrakNTell integration is already fully implemented and supports **live load sensor data** from your vehicles. The system fetches real-time data including:

### 📡 Live Sensor Data (Current Status)
- **SLI Crane Sensors**: Duty, Angle, Radius, Length, Load, SWL (Safe Working Load), Overload
- **Analog Input Sensors**: Up to 24 customizable sensors (ain1-ain24)
- **J1939 CAN Bus**: Engine RPM, coolant temp, oil pressure, fuel level, hour meter, etc.
- **Temperature Sensors**: Up to 2 temperature probes
- **Device Health**: Battery voltage, GSM signal, GPS satellites, HDOP
- **Vehicle Status**: Speed, ignition, odometer, fuel level, alerts

### 📊 Historical Sensor Data
- Time-series sensor readings between any date range
- Boom/crane sensor history with min/max/latest values
- CAN bus historical data
- Alert/event history
- Trip summaries

---

## How to View Live Sensor Data

### Option 1: Via the React Frontend (localhost:5173)

1. **Open the GPS Page**: Navigate to `http://localhost:5173` and go to the GPS tracking page
2. **Find your vehicle**: Look for vehicles with the **TNT** badge (TrakNTell provider)
3. **Click "More data"** on any vehicle card to expand sensor details
4. **View live sensors**:
   - **SLI Crane Monitor**: Shows angle, boom length, radius, duty, load vs SWL bar
   - **CAN / J1939**: Engine RPM, coolant temp, oil pressure, fuel level, etc.
   - **GPS Quality**: Heading, altitude, satellites, HDOP
   - **Fuel**: Fuel percentage with visual bar
   - **Temperature**: Sensor 1 & 2 readings
   - **Alerts**: Panic, towing, overspeed, harsh brake/accel indicators

5. **View historical data**:
   - Click the **"History"** button on the right panel
   - Select tabs: **Sensors**, **CAN / OBD**, **GPS Track**, **Alerts**, **Trips**
   - Choose date range and click **Fetch**

### Option 2: Via API Endpoints

All endpoints require authentication with a JWT token in the `Authorization` header.

#### **Get Live Vehicle Data (includes current sensor readings)**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/gps/trakntell/vehicles
```

This returns all vehicles with **live sensor data** including:
- `sli_duty`, `sli_angle`, `sli_radius`, `sli_length`, `sli_load`, `sli_swl`, `sli_overload`
- `battery_charge_status`, `sos_button`
- `ain_sensors`: Array of all analog input sensors with label, value, units
- `j1939_*`: All CAN bus parameters
- `temperature`, `temperature2`, `rpm`, etc.

#### **Get Historical Sensor Data**
```bash
# Fetch sensor readings for a specific vehicle between dates
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/gps/trakntell/sensors/VEHICLE_ID?from=2025-04-07&to=2025-04-14"
```

#### **Get Historical CAN Bus Data**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/gps/trakntell/can/VEHICLE_ID?from=2025-04-07&to=2025-04-14"
```

#### **Get GPS Track History**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/gps/trakntell/history/VEHICLE_ID?from=2025-04-07&to=2025-04-14"
```

#### **Get Alert History**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/gps/trakntell/alerts/VEHICLE_ID?from=2025-04-07&to=2025-04-14"
```

#### **Get Trip Summary**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/gps/trakntell/trips/VEHICLE_ID?from=2025-04-07&to=2025-04-14"
```

#### **Probe Available Endpoints (Owner Only)**
```bash
# Discover which sensor/CAN/history endpoints your TrakNTell account supports
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/gps/trakntell/probe-endpoints
```

---

## API Response Format

### Live Vehicle Data Example:
```json
{
  "vehicles": [
    {
      "registration_number": "MH01AB1234",
      "provider": "trakntell",
      "status": "moving",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "speed": 45.5,
      "ignition": "on",
      
      // SLI Crane Sensors
      "sli_duty": 75.2,
      "sli_angle": 45.3,
      "sli_radius": 12.5,
      "sli_length": 18.7,
      "sli_load": 2.35,
      "sli_swl": 5.0,
      "sli_overload": 0.0,
      "battery_charge_status": "Charging",
      "sos_button": "Not Pressed",
      
      // Analog Input Sensors
      "ain_sensors": [
        {"label": "Pressure", "value": 120.5, "units": "PSI"},
        {"label": "Temperature", "value": 65.2, "units": "°C"}
      ],
      
      // J1939 CAN Bus
      "j1939_hour_meter": 1250.5,
      "j1939_coolant_temp": 85.0,
      "j1939_oil_pressure": 45.2,
      "j1939_fuel_level": 75.0,
      "j1939_engine_speed": 1800,
      "j1939_fuel_consumption": 12.5,
      "j1939_mil": false,
      "j1939_stop_indicator": false,
      "j1939_battery_potential": 24.5,
      "j1939_trans_oil_temp": 95.0,
      "j1939_urea_level": 60.0,
      "j1939_water_in_fuel": false,
      
      // Other sensors
      "temperature": 32.5,
      "temperature2": 28.3,
      "rpm": 1850,
      "fuel_percentage": 75.0,
      "fuel_litres": 150.5,
      
      // GPS quality
      "heading": 180.5,
      "altitude": 15.0,
      "gps_satellites": 12,
      "hdop": 0.8
    }
  ]
}
```

### Historical Sensor Data Example:
```json
{
  "endpoint": "tntServiceGetSensorData",
  "records": [
    {
      "timestamp": "2025-04-14T10:30:00Z",
      "boom_angle": 45.2,
      "boom_length": 18.5,
      "load": 2.3,
      "swl": 5.0,
      "pressure": 120.5,
      "temperature": 65.2
    },
    ...
  ],
  "count": 150,
  "field_categories": {
    "boom_crane": ["boom_angle", "boom_length", "load", "swl"],
    "can_engine": [],
    "sensors": ["pressure", "temperature"],
    "other": ["timestamp"]
  }
}
```

---

## Troubleshooting

### "No credentials configured"
- You need to save TrakNTell credentials first
- Use the GPS Settings page to enter your TrakNTell login details
- Or use the auto-login feature: `POST /api/gps/trakntell/auto-login`

### "Session expired"
- TrakNTell sessions expire periodically
- Re-login via GPS Settings or use auto-login to refresh credentials

### "Endpoint not found" for historical data
- Different TrakNTell accounts use different API endpoints
- Run the endpoint probe: `GET /api/gps/trakntell/probe-endpoints`
- Or run the discovery script: `python3 trakntell_discover.py --headful`

### No sensor data in response
- Your vehicle may not have sensor hardware installed
- Check with your TrakNTell account administrator if sensors are enabled
- Verify sensor configuration in the TrakNTell web portal

---

## Auto-Refresh / Polling

The frontend (`useUnifiedGPS.ts`) supports automatic polling. To enable:

```typescript
// In your component
const { vehicles, refetch } = useUnifiedGPS({ pollInterval: 30000 }); // 30 seconds
```

This will fetch live sensor data from TrakNTell every 30 seconds automatically.

---

## Architecture

```
Browser (React)
    ↓
Vite Dev Server (localhost:5173)
    ↓ (proxy /api → localhost:8000)
FastAPI Backend (localhost:8000)
    ↓
TrakNTell API (mapsweb.trakmtell.com)
    ↓
Live vehicle + sensor data
```

**Data Flow:**
1. React frontend calls `/api/gps/trakntell/vehicles` (via Vite proxy)
2. FastAPI backend fetches encrypted credentials from SQLite DB
3. Backend calls TrakNTell API with session cookies
4. TrakNTell returns JSON with all vehicle + sensor data
5. Backend parses and returns to frontend
6. Frontend displays sensor data in GPSAssetCard component

---

## Key Files

- **Backend Service**: `suprwise/trakntell/service.py` - Fetches live vehicle + sensor data
- **Backend History**: `suprwise/trakntell/history_service.py` - Historical sensor/CAN/alert data
- **Backend Routes**: `suprwise/trakntell/router.py` - API endpoints
- **Frontend Hook**: `reactcodewebapp-main/src/hooks/useUnifiedGPS.ts` - Fetches live data
- **Frontend Card**: `reactcodewebapp-main/src/pages/GPS/GPSAssetCard.tsx` - Displays sensor data
- **Frontend History**: `reactcodewebapp-main/src/pages/GPS/TnTHistoryPanel.tsx` - Historical data viewer

---

## Next Steps

1. ✅ **Backend is running** on localhost:8000
2. ✅ **Frontend is running** on localhost:5173
3. 🔑 **Ensure TrakNTell credentials are configured** (check GPS Settings)
4. 📡 **View live sensor data** on the GPS page
5. 📊 **Fetch historical data** via the History panel

---

## Quick Test

Test if your TrakNTell integration is working:

```bash
# 1. Get a token (replace with your login)
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  | jq -r '.token')

# 2. Fetch live vehicle data
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/gps/trakntell/vehicles | jq .

# 3. Check health/status
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/gps/trakntell/health | jq .
```
