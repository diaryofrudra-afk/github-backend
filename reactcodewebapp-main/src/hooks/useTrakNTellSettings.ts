import { useState, useCallback } from 'react';
import { getToken } from '../services/api';

interface TrakNTellCredentials {
  configured: boolean;
  user_id_preview: string;
  updated_at?: string;
  has_sessionid?: boolean;
}

interface TrakNTellHealth {
  configured: boolean;
  user_id_preview: string;
  vehicle_count: number;
  last_error: string;
}

export function useTrakNTellSettings() {
  const [credentials, setCredentials] = useState<TrakNTellCredentials | null>(null);
  const [health, setHealth] = useState<TrakNTellHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCredentials = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/gps/trakntell/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setCredentials(data);
      }
    } catch (e) {
      console.error('Failed to fetch Trak N Tell credentials:', e);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/gps/trakntell/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setHealth(data);
      }
    } catch (e) {
      console.error('Failed to fetch Trak N Tell health:', e);
    }
  }, []);

  const saveCredentials = useCallback(async (user_id: string, user_id_encrypt: string, orgid: string, sessionid: string = '', tnt_s: string = '') => {
    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/gps/trakntell/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id, user_id_encrypt, orgid, sessionid, tnt_s }),
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
      const r = await fetch('/api/gps/trakntell/credentials', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setCredentials({ configured: false, user_id_preview: '', updated_at: '' });
        setHealth({ configured: false, user_id_preview: '', vehicle_count: 0, last_error: '' });
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
    error,
    saving,
    fetchCredentials,
    fetchHealth,
    saveCredentials,
    deleteCredentials,
    setError,
  };
}
