import { useState, useEffect, useCallback } from 'react';
import type { BlackbuckVehicle, TrakNTellVehicle } from '../types';
import { getToken } from '../services/api';

// Unified vehicle type that works with both providers
export interface UnifiedVehicle {
  registration_number: string;
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
