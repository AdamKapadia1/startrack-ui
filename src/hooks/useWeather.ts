import { useState, useEffect, useCallback } from 'react';
import type { LocationSettings } from './useLocation';

export interface WeatherData {
  temp:               number;
  description:        string;
  cloudCover:         number;
  windSpeed:          number;
  visibility:         number;
  isGoodForSatellites: boolean;
}

export function useWeather(location: LocationSettings) {
  const [data, setData]       = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const { lat, lon } = location;

  const fetchData = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL ?? '';
      const params = `?lat=${lat}&lon=${lon}`;
      const res  = await fetch(`${base}/api/weather${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeatherData = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10 * 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, loading, error };
}
