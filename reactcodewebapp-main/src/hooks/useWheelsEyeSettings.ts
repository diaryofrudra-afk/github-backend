import { useState, useCallback } from 'react';
import { getToken } from '../services/api';

interface WheelsEyeSettings {
  configured: boolean;
  token_preview: string;
  has_vehicles_api?: boolean;
  updated_at?: string;
}

interface WheelsEyeHealth {
  configured: boolean;
  phone_preview: string;
  vehicle_count: number;
  last_error: string;
}

export function useWheelsEyeSettings() {
  const [credentials, setCredentials] = useState<WheelsEyeSettings | null>(null);
  const [health, setHealth] = useState<WheelsEyeHealth | null>(null);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/gps/wheelseye/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setCredentials(data);
      }
    } catch (e) {
      console.error('Failed to fetch credentials:', e);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/gps/wheelseye/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setHealth(data);
      }
    } catch (e) {
      console.error('Failed to fetch health:', e);
    }
  }, []);

  const deleteCredentials = useCallback(async () => {
    const token = getToken();
    if (!token) return false;
    try {
      const r = await fetch('/api/gps/wheelseye/credentials', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setCredentials({ configured: false, token_preview: '' });
        setHealth({ configured: false, phone_preview: '', vehicle_count: 0, last_error: '' });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }, []);

  return {
    credentials,
    health,
    loading,
    error,
    fetchCredentials,
    fetchHealth,
    deleteCredentials,
    setError,
  };
}
