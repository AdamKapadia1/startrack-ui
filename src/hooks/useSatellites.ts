import { useState, useEffect, useRef } from 'react';
import type { ApiResponse } from '../types';
import type { LocationSettings } from './useLocation';
import { DEFAULT_LOCATION } from './useLocation';
import { useWebSocket } from './useWebSocket';
import type { WsStatus } from './useWebSocket';

export const SIGNAL_HISTORY_KEY = 'startrack-signal-history';
const HISTORY_MAX     = 200;
const MIN_INTERVAL_MS = 60_000;

export interface SignalHistoryPoint {
  timestamp: number;
  score:     number;
  elevation: number;
}

function isDefaultLoc(loc: LocationSettings): boolean {
  // 0.05° ≈ 5 km — treats GPS-varying Tring coords as "default" to avoid pointless REST polls
  return (
    Math.abs(loc.lat - DEFAULT_LOCATION.lat) < 0.05 &&
    Math.abs(loc.lon - DEFAULT_LOCATION.lon) < 0.05
  );
}

export function useSatellites(location: LocationSettings) {
  // WebSocket provides real-time updates for the default (Tring) location
  const { satData: wsData, positions, posLastUpdate, status, lastUpdate: wsLastUpdate } = useWebSocket();

  // For custom locations, layer a REST poll on top
  const [restData,        setRestData]        = useState<ApiResponse | null>(null);
  const [restLastUpdated, setRestLastUpdated] = useState<Date | null>(null);

  const isDefault   = isDefaultLoc(location);
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    if (isDefault) { setRestData(null); return; }

    let cancelled = false;

    async function fetchRest() {
      try {
        const base = import.meta.env.VITE_API_URL ?? '';
        const { lat, lon, alt, name } = location;
        const params = `?lat=${lat}&lon=${lon}&alt=${alt}&name=${encodeURIComponent(name)}`;
        const res = await fetch(`${base}/api/satellites/visible${params}`);
        if (!res.ok || cancelled) return;
        const json: ApiResponse = await res.json();
        setRestData(json);
        setRestLastUpdated(new Date());
      } catch { /* ignore */ }
    }

    fetchRest();
    const id = setInterval(fetchRest, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [location.lat, location.lon, location.alt, location.name, isDefault]);

  // Persist signal history to localStorage (max 200 pts, 1-min minimum interval)
  useEffect(() => {
    const score = (restData ?? wsData)?.signalScore;
    if (!score) return;
    const now = Date.now();
    if (now - lastSaveRef.current < MIN_INTERVAL_MS) return;
    lastSaveRef.current = now;

    const maxEl = (restData ?? wsData)?.satellites?.[0]?.elevation ?? 0;
    const point: SignalHistoryPoint = { timestamp: now, score, elevation: maxEl };
    try {
      const raw     = localStorage.getItem(SIGNAL_HISTORY_KEY);
      const history: SignalHistoryPoint[] = raw ? JSON.parse(raw) : [];
      history.push(point);
      if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
      localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history));
    } catch { /* storage unavailable */ }
  }, [restData, wsData]);

  // Custom location data takes precedence over WS default-location data
  const data        = restData ?? wsData;
  const lastUpdated = restData ? restLastUpdated : wsLastUpdate;

  return {
    data,
    loading:      !data,
    error:        null as string | null,
    lastUpdated,
    // Always reflect the real WebSocket status — REST polling is supplementary
    status:       status as WsStatus,
    // Positions are WS-only (default location); null for custom locations
    positions:    isDefault ? positions : [],
    posLastUpdate: isDefault ? posLastUpdate : null,
  };
}
