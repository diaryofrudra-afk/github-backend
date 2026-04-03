import { useState, useEffect, useCallback } from 'react';
import type { BlackbuckData } from '../types';
import { getToken } from '../services/api';

export function useBlackbuck() {
  const [data, setData] = useState<BlackbuckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/gps/blackbuck', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // We send the token as a query parameter for WebSocket auth if the backend supports it,
    // or just rely on the session/cookie if applicable.
    // Given the instructions, I'll just use the URL provided.
    const wsUrl = `${protocol}//${host}/api/gps/ws/blackbuck?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    let reconnectTimer: number;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          setData(update);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onopen = () => {
        console.log('[WS] Live GPS connected');
      };

      ws.onclose = (e) => {
        if (e.code !== 1000) {
          console.log('[WS] Live GPS disconnected, retrying in 5s...');
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      if (ws) ws.close(1000);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { data, loading, error, refetch: fetch_ };
}
