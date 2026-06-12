import { useState, useEffect, useRef, useCallback } from 'react';
import type { ApiResponse, SatellitePosition } from '../types';
import type { WeatherData } from './useWeather';

export type WsStatus = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'offline';

// Derive WebSocket URL from VITE_API_URL at module init
const WS_URL = (() => {
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (!api) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return api.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
})();

const MAX_RETRIES  = 5;
const BASE_DELAY   = 1_000; // ms, doubles each retry up to 30 s
const WS_RETRY_MS  = 60_000; // retry WS from polling mode every 60 s

export function useWebSocket() {
  const [satData,       setSatData]       = useState<ApiResponse | null>(null);
  const [weather,       setWeather]       = useState<WeatherData | null>(null);
  const [positions,     setPositions]     = useState<SatellitePosition[]>([]);
  const [posLastUpdate, setPosLastUpdate] = useState<Date | null>(null);
  const [status,        setStatus]        = useState<WsStatus>('connecting');
  const [lastUpdate,    setLastUpdate]    = useState<Date | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);
  const retriesRef   = useRef(0);
  const reconnTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const pollTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRetryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted      = useRef(true);

  // REST fallback — kicks in after MAX_RETRIES failed reconnects
  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    setStatus('polling');

    async function poll() {
      if (!mounted.current) return;
      try {
        const base = import.meta.env.VITE_API_URL ?? '';
        const res  = await fetch(`${base}/api/satellites/visible`);
        if (!res.ok) return;
        const json: ApiResponse = await res.json();
        setSatData(json);
        setLastUpdate(new Date());
      } catch { /* network down, stay in polling state */ }
    }

    poll();
    pollTimer.current = setInterval(poll, 30_000);
  }, []);

  const connect = useCallback(() => {
    if (!mounted.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted.current) return;
        retriesRef.current = 0;
        setStatus('live');
        // Kill REST fallback and WS retry timer if WS reconnected
        if (pollTimer.current)    { clearInterval(pollTimer.current);    pollTimer.current    = null; }
        if (wsRetryTimer.current) { clearInterval(wsRetryTimer.current); wsRetryTimer.current = null; }
      };

      ws.onmessage = event => {
        if (!mounted.current) return;
        // Confirm live status on every received message — guards against state drift
        setStatus('live');
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'satellites') {
            setSatData(msg.data as ApiResponse);
            setLastUpdate(new Date());
          } else if (msg.type === 'weather') {
            setWeather(msg.data as WeatherData);
          } else if (msg.type === 'positions') {
            setPositions(msg.satellites as SatellitePosition[]);
            setPosLastUpdate(new Date());
          }
        } catch { /* malformed message — ignore */ }
      };

      ws.onclose = () => {
        if (!mounted.current) return;
        wsRef.current = null;
        retriesRef.current++;

        if (retriesRef.current > MAX_RETRIES) {
          startPolling();
          // Retry WebSocket every 60 s while in polling mode
          if (!wsRetryTimer.current) {
            wsRetryTimer.current = setInterval(() => {
              if (!mounted.current) return;
              retriesRef.current = 0;
              connect();
            }, WS_RETRY_MS);
          }
          return;
        }

        const delay = Math.min(BASE_DELAY * Math.pow(2, retriesRef.current - 1), 30_000);
        setStatus('reconnecting');
        reconnTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close(); // onclose fires after this
    } catch {
      // If WebSocket constructor throws (e.g. bad URL in test env), go straight to polling
      startPolling();
    }
  }, [startPolling]);

  useEffect(() => {
    mounted.current = true;
    connect();

    return () => {
      mounted.current = false;
      if (reconnTimer.current)  clearTimeout(reconnTimer.current);
      if (pollTimer.current)    clearInterval(pollTimer.current);
      if (wsRetryTimer.current) clearInterval(wsRetryTimer.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [connect]);

  return { satData, weather, positions, posLastUpdate, status, lastUpdate };
}
