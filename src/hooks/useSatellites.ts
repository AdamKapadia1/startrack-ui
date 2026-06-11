import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../types';
import type { LocationSettings } from './useLocation';

export function useSatellites(location: LocationSettings) {
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { lat, lon, alt, name } = location;

  const fetchData = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL ?? '';
      const params = `?lat=${lat}&lon=${lon}&alt=${alt}&name=${encodeURIComponent(name)}`;
      const res = await fetch(`${base}/api/satellites/visible${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, alt, name]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, loading, error, lastUpdated };
}
