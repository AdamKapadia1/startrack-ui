import { useState, useEffect, useCallback } from 'react';

export interface WeatherData {
  temp: number;
  description: string;
  cloudCover: number;
  windSpeed: number;
  visibility: number;
  isGoodForSatellites: boolean;
}

export function useWeather() {
  const [data, setData]       = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL ?? '';
      const res  = await fetch(`${base}/api/weather`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeatherData = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10 * 60_000); // refresh every 10 min
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, loading, error };
}
