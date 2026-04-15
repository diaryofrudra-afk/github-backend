# Trip History Implementation Code Snippets

## Backend: suprwise/gps/service.py - fetch_blackbuck_trip_history()

```python
async def fetch_blackbuck_trip_history(user_id: str, truck_no: str, from_time: int, to_time: int) -> TripHistoryResponse:
    """
    Fetch historical trip GPS points for a single Blackbuck vehicle.
    Uses the /api/portal/getTimeline endpoint with correct parameter names.
    """
    creds = await _get_user_credentials(user_id)
    if not creds or not creds.get("auth_token"):
        return TripHistoryResponse(
            provider="blackbuck",
            vehicle=truck_no,
            error="No Blackbuck credentials configured."
        )

    token = creds["auth_token"]
    url = f"https://api-fms.blackbuck.com/fmsiot/api/portal/getTimeline?truck_number={truck_no}&from_timestamp={from_time}&to_timestamp={to_time}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_build_headers(token))
            
            if resp.status_code == 401:
                return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error="Blackbuck token expired. Please update your GPS credentials in Settings.")
            
            if resp.status_code == 403:
                return TripHistoryResponse(
                    provider="blackbuck", 
                    vehicle=truck_no, 
                    error="Trip History API not enabled. Contact Blackbuck Support (+91 8046481828) and request: 'Enable /api/portal/getTimeline access for fleet ID 5599426 to use trip history and playback features.'"
                )
            
            if resp.status_code != 200:
                error_msg = f"Blackbuck API error: {resp.status_code}"
                try:
                    err_data = resp.json()
                    if "error" in err_data and "message" in err_data["error"]:
                        error_msg = err_data["error"]["message"]
                except:
                    pass
                return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error=error_msg)

            data = resp.json()
            raw_list = data.get("list", data.get("data", []))
            
            points = []
            for item in raw_list:
                try:
                    lat = float(item.get("latitude", 0.0) or 0.0)
                    lng = float(item.get("longitude", 0.0) or 0.0)
                    if lat == 0.0 and lng == 0.0:
                        continue
                        
                    speed = float(item.get("current_speed", 0.0) or 0.0)
                    
                    ts = item.get("last_updated_on")
                    if ts:
                        try:
                            timestamp = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            timestamp = item.get("last_updated_on_format", "")
                    else:
                        timestamp = item.get("last_updated_on_format", "")
                        
                    address = item.get("address", "")
                    
                    points.append(TripPoint(lat=lat, lng=lng, speed=speed, timestamp=timestamp, address=address))
                except Exception:
                    pass

            return TripHistoryResponse(
                points=points,
                total=len(points),
                provider="blackbuck",
                vehicle=truck_no
            )

    except httpx.TimeoutException:
        return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error="Connection timed out.")
    except Exception as e:
        return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error=f"History fetch failed: {str(e)}")
```

## Backend: suprwise/gps/service.py - fetch_trip_history()

```python
async def fetch_trip_history(
    user_id: str,
    provider: str,
    vehicle_id: str,
    from_time: int = 0,
    to_time: int = 0,
    from_date: str = "",
    to_date: str = "",
) -> TripHistoryResponse:
    """
    Unified wrapper for fetching trip history from any GPS provider.
    Routes to the appropriate provider-specific function.
    """
    if provider.lower() == "blackbuck":
        return await fetch_blackbuck_trip_history(
            user_id=user_id,
            truck_no=vehicle_id,
            from_time=from_time,
            to_time=to_time,
        )
    elif provider.lower() == "trakntell":
        return TripHistoryResponse(
            provider="trakntell",
            vehicle=vehicle_id,
            error="Trak N Tell trip history endpoint not yet implemented via unified wrapper.",
        )
    else:
        return TripHistoryResponse(
            provider=provider,
            vehicle=vehicle_id,
            error=f"Unknown GPS provider: {provider}",
        )
```

## Backend: suprwise/gps/router.py

```python
@router.get("/trip-history")
async def get_unified_trip_history(
    provider: str,
    vehicle_id: str,
    from_time: int = 0,
    to_time: int = 0,
    from_date: str = "",
    to_date: str = "",
    user=Depends(get_current_user),
):
    """
    Unified endpoint for fetching trip history from any GPS provider.
    
    For Blackbuck:
      - Use: provider=blackbuck, vehicle_id=<truck_no>, from_time=<ms>, to_time=<ms>
      - Ignores: from_date, to_date
      
    For Trak N Tell:
      - Use: provider=trakntell, vehicle_id=<vehicle_id>, from_date=<dd/MM/yyyy HH:mm>, to_date=<dd/MM/yyyy HH:mm>
      - Ignores: from_time, to_time
    """
    return await fetch_trip_history(
        user_id=user["user_id"],
        provider=provider,
        vehicle_id=vehicle_id,
        from_time=from_time,
        to_time=to_time,
        from_date=from_date,
        to_date=to_date,
    )
```

## Frontend: reactcodewebapp-main/src/services/api.ts

```typescript
async getTripHistory(params: {
  provider: string
  vehicle_id: string
  from_time?: number
  to_time?: number
  from_date?: string
  to_date?: string
}): Promise<TripHistoryResponse> {
  return this.get(`/gps/trip-history`, params)
}
```

Where `TripHistoryResponse` type:
```typescript
interface TripHistoryResponse {
  points: TripPoint[]
  total: number
  provider: string
  vehicle: string
  error?: string | null
}

interface TripPoint {
  lat: number
  lng: number
  speed: number
  timestamp: string
  address: string
}
```

## Frontend: reactcodewebapp-main/src/pages/GPS/GPSRightPanel.tsx

```tsx
// Line 99: Changed from window.open to calling modal function
onClick={() => onHistory(vehicle)}
```

## Frontend: reactcodewebapp-main/src/pages/GPS/GPSPageNew.tsx - Trip History Modal

```tsx
// State added
const [tripHistoryDate, setTripHistoryDate] = useState('')
const [tripHistoryFrom, setTripHistoryFrom] = useState('00:00')
const [tripHistoryTo, setTripHistoryTo] = useState('23:59')
const [tripPoints, setTripPoints] = useState<TripPoint[]>([])
const [playbackIndex, setPlaybackIndex] = useState(0)
const [isPlaying, setIsPlaying] = useState(false)
const [playbackSpeed, setPlaybackSpeed] = useState(1)

// Function added
const fetchTripHistory = async () => {
  if (!tripHistoryDate || !tripHistoryFrom || !tripHistoryTo) {
    alert('Please set start date and time range')
    return
  }

  try {
    const fromDateTime = new Date(`${tripHistoryDate}T${tripHistoryFrom}`)
    const toDateTime = new Date(`${tripHistoryDate}T${tripHistoryTo}`)
    
    const result = await api.getTripHistory({
      provider: historyVehicle!.provider,
      vehicle_id: historyVehicle!.registration_number || historyVehicle!.vehicle_id,
      from_time: Math.floor(fromDateTime.getTime()),
      to_time: Math.floor(toDateTime.getTime()),
    })

    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }

    setTripPoints(result.points)
    setPlaybackIndex(0)
    setIsPlaying(false)
  } catch (error) {
    console.error('Failed to fetch trip history:', error)
    alert('Failed to fetch trip history')
  }
}

// Modal rendering for Blackbuck
{historyVehicle && historyVehicle.provider === 'blackbuck' && (
  <Modal open={!!historyVehicle} onClose={() => setHistoryVehicle(null)}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
      <h2>Trip History - {historyVehicle?.registration_number}</h2>
      
      <div>
        <label>Date: </label>
        <input 
          type="date" 
          value={tripHistoryDate} 
          onChange={(e) => setTripHistoryDate(e.target.value)} 
        />
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <div>
          <label>From Time: </label>
          <input 
            type="time" 
            value={tripHistoryFrom} 
            onChange={(e) => setTripHistoryFrom(e.target.value)} 
          />
        </div>
        <div>
          <label>To Time: </label>
          <input 
            type="time" 
            value={tripHistoryTo} 
            onChange={(e) => setTripHistoryTo(e.target.value)} 
          />
        </div>
      </div>
      
      <button onClick={fetchTripHistory}>Fetch Trip History</button>
      
      {tripPoints.length > 0 && (
        <div>
          <h3>Trip Points: {tripPoints.length}</h3>
          {tripPoints.map((point, idx) => (
            <div key={idx} style={{ fontSize: '12px', padding: '5px' }}>
              {point.timestamp} - Lat: {point.lat}, Lng: {point.lng}, Speed: {point.speed}
            </div>
          ))}
        </div>
      )}
    </div>
  </Modal>
)}
```

## Frontend: reactcodewebapp-main/vite.config.ts

```typescript
// Updated proxy target
proxy: {
  '/api': {
    target: 'http://127.0.0.1:8002',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '/api'),
  }
}
```
