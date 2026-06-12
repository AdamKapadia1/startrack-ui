import { useState, useEffect } from 'react';
import type { ApiResponse } from '../types';
import type { LocationSettings } from './useLocation';
import { DEFAULT_LOCATION } from './useLocation';
import { useWebSocket } from './useWebSocket';
import type { WsStatus } from './useWebSocket';

function isDefaultLoc(loc: LocationSettings): boolean {
  return (
    Math.abs(loc.lat - DEFAULT_LOCATION.lat) < 0.001 &&
    Math.abs(loc.lon - DEFAULT_LOCATION.lon) < 0.001
  );
}

export function useSatellites(location: LocationSettings) {
  // WebSocket provides real-time updates for the default (Tring) location
  const { satData: wsData, positions, posLastUpdate, status, lastUpdate: wsLastUpdate } = useWebSocket();

  // For custom locations, layer a REST poll on top
  const [restData,        setRestData]        = useState<ApiResponse | null>(null);
  const [restLastUpdated, setRestLastUpdated] = useState<Date | null>(null);

  const isDefault = isDefaultLoc(location);

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

  // Custom location data takes precedence over WS default-location data
  const data        = restData ?? wsData;
  const lastUpdated = restData ? restLastUpdated : wsLastUpdate;

  return {
    data,
    loading:      !data,
    error:        null as string | null,
    lastUpdated,
    status:       (restData ? 'polling' : status) as WsStatus,
    // Positions are WS-only (default location); null for custom locations
    positions:    isDefault ? positions : [],
    posLastUpdate: isDefault ? posLastUpdate : null,
  };
}
