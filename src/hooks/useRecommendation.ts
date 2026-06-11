import { useState, useEffect, useCallback } from 'react';
import type { LocationSettings } from './useLocation';

export interface Pass {
  startUTC: number;
  maxUTC:   number;
  endUTC:   number;
  maxEl:    number;
  duration?: number;
  satname?:  string;
}

export interface RecommendationData {
  recommendation: string;
  satname?:   string;
  topPasses:  Pass[];
  today?:     Pass[];
  tomorrow?:  Pass[];
  thisWeek?:  Pass[];
  bestPass?:  Pass | null;
}

export function useRecommendation(location: LocationSettings) {
  const [data, setData]       = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const { lat, lon, alt, name } = location;

  const fetchData = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL ?? '';
      const params = `?lat=${lat}&lon=${lon}&alt=${alt}&name=${encodeURIComponent(name)}`;
      const res = await fetch(`${base}/api/recommendation${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RecommendationData = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, alt, name]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, loading, error };
}
