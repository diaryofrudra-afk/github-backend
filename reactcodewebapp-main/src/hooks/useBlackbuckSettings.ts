import { useState, useCallback } from 'react';
import { getToken } from '../services/api';

interface BlackbuckSettings {
  configured: boolean;
  token_preview: string;
  fleet_owner_id: string;
  updated_at?: string;
}

interface BlackbuckHealth {
  configured: boolean;
  token_preview: string;
  fleet_owner_id: string;
  vehicle_count: number;
  last_error: string;
}

export function useBlackbuckSettings() {
  const [credentials, setCredentials] = useState<BlackbuckSettings | null>(null);
  const [health, setHealth] = useState<BlackbuckHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCredentials = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/gps/blackbuck/credentials', {
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
      const r = await fetch('/api/gps/blackbuck/health', {
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

  const saveCredentials = useCallback(async (auth_token: string, fleet_owner_id: string) => {
    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/gps/blackbuck/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ auth_token, fleet_owner_id }),
      });
      if (r.ok) {
        await fetchCredentials();
        await fetchHealth();
        return true;
      } else {
        const err = await r.json();
        setError(err.detail || 'Failed to save credentials');
        return false;
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchCredentials, fetchHealth]);

  const deleteCredentials = useCallback(async () => {
    const token = getToken();
    if (!token) return false;
    try {
      const r = await fetch('/api/gps/blackbuck/credentials', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setCredentials({ configured: false, token_preview: '', fleet_owner_id: '', updated_at: '' });
        setHealth({ configured: false, token_preview: '', fleet_owner_id: '', vehicle_count: 0, last_error: '' });
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
    saving,
    fetchCredentials,
    fetchHealth,
    saveCredentials,
    deleteCredentials,
    setError,
  };
}
