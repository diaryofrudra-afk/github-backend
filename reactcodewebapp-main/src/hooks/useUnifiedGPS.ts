import { useState, useEffect, useCallback } from 'react';
import type { BlackbuckVehicle, TrakNTellVehicle } from '../types';
import { getToken } from '../services/api';

// Unified vehicle type that works with both providers
export interface UnifiedVehicle {
  registration_number: string;
  vehicle_id?: string;
  device_id?: string;
  status: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  last_updated?: string;
  engine_on?: boolean;
  ignition_status?: string;
  ignition_lock?: boolean;
  ignition?: string;              // "on" | "off" | "unknown"
  signal?: string;
  address?: string;
  // Network / Signal
  gsm_signal?: number;
  network_status?: string;
  is_gsm_working?: boolean;
  is_gps_working?: boolean;
  // Device Health
  main_voltage?: number;
  backup_voltage?: number;
  battery_charge?: string;
  is_main_power_low?: boolean;
  // GPS Quality (TnT)
  heading?: number;
  altitude?: number;
  gps_satellites?: number;
  hdop?: number;
  // Distance & Hours (TnT)
  odometer?: number;
  today_km?: number;
  engine_hours?: number;
  today_engine_hours?: number;
  idle_duration?: string;
  stop_duration?: string;
  // Driver (TnT)
  driver_name?: string;
  driver_mobile?: string;
  // Fuel (TnT)
  fuel_percentage?: number;
  fuel_litres?: number;
  // Alerts (TnT)
  is_panic?: boolean;
  is_towing?: boolean;
  is_overspeeding?: boolean;
  is_harsh_braking?: boolean;
  is_harsh_acceleration?: boolean;
  is_inside_geofence?: boolean;
  // Security / Sensors (TnT)
  immobilizer?: string;
  temperature?: number;
  temperature2?: number;
  door_status?: string;
  ac_status?: string;
  rpm?: number;
  // SLI Crane Sensors (TnT)
  sli_duty?: number;
  sli_angle?: number;
  sli_radius?: number;
  sli_length?: number;
  sli_load?: number;
  sli_swl?: number;
  sli_overload?: number;
  battery_charge_status?: string;
  sos_button?: string;
  ain_sensors?: { label: string; value: unknown; units: string }[];
  // J1939 CAN Bus (TnT)
  j1939_hour_meter?: number;
  j1939_coolant_temp?: number;
  j1939_oil_pressure?: number;
  j1939_fuel_level?: number;
  j1939_engine_speed?: number;
  j1939_fuel_consumption?: number;
  j1939_mil?: boolean;
  j1939_stop_indicator?: boolean;
  j1939_battery_potential?: number;
  j1939_trans_oil_temp?: number;
  j1939_urea_level?: number;
  j1939_water_in_fuel?: boolean;
  // Ignition / Trip state strings (TnT)
  ignition_on_since?: string;
  ignition_off_since?: string;
  parked_since?: string;
  trip_distance?: number;
  trip_avg_speed?: number;
  provider: 'blackbuck' | 'trakntell';
}

export function useUnifiedGPS(opts?: { pollInterval?: number }) {
  const { pollInterval } = opts || {};
  const [vehicles, setVehicles] = useState<UnifiedVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blackbuckCount, setBlackbuckCount] = useState(0);
  const [trakntellCount, setTrakntellCount] = useState(0);

  const fetchVehicles = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      // Fetch from both providers in parallel
      const [blackbuckResp, trakntellResp] = await Promise.allSettled([
        fetch('/api/gps/blackbuck', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/gps/trakntell/vehicles', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const unifiedVehicles: UnifiedVehicle[] = [];
      let bbCount = 0;
      let tntCount = 0;

      // Process Blackbuck vehicles
      if (blackbuckResp.status === 'fulfilled' && blackbuckResp.value.ok) {
        const blackbuckData = await blackbuckResp.value.json();
        console.log('[GPS] Blackbuck response:', {
          hasVehicles: !!blackbuckData.vehicles,
          vehicleCount: blackbuckData.vehicles?.length,
          error: blackbuckData.error,
        });
        if (blackbuckData.vehicles && !blackbuckData.error) {
          const bbVehicles = blackbuckData.vehicles.map((v: BlackbuckVehicle) => ({
            ...v,
            provider: 'blackbuck' as const,
          }));
          unifiedVehicles.push(...bbVehicles);
          bbCount = bbVehicles.length;
        }
      } else {
        console.log('[GPS] Blackbuck failed:', blackbuckResp.status === 'rejected' ? blackbuckResp.reason : `HTTP ${blackbuckResp.value.status}`);
      }

      // Process Trak N Tell vehicles
      if (trakntellResp.status === 'fulfilled' && trakntellResp.value.ok) {
        const trakntellData = await trakntellResp.value.json();
        if (trakntellData.vehicles && !trakntellData.error) {
          const tntVehicles = trakntellData.vehicles.map((v: TrakNTellVehicle) => ({
            ...v,
            provider: 'trakntell' as const,
          }));
          unifiedVehicles.push(...tntVehicles);
          tntCount = tntVehicles.length;
        }
      }

      setVehicles(unifiedVehicles);
      setBlackbuckCount(bbCount);
      setTrakntellCount(tntCount);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch GPS data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Optional polling
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;
    const id = setInterval(fetchVehicles, pollInterval);
    return () => clearInterval(id);
  }, [fetchVehicles, pollInterval]);

  return {
    vehicles,
    loading,
    error,
    refetch: fetchVehicles,
    blackbuckCount,
    trakntellCount,
    totalVehicles: blackbuckCount + trakntellCount,
  };
}
