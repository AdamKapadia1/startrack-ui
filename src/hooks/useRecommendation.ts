import { useState, useEffect, useCallback } from 'react';

export interface Pass {
  startUTC: number;
  maxUTC: number;
  endUTC: number;
  maxEl: number;
  duration?: number;
  satname?: string;
}

export interface RecommendationData {
  recommendation: string;
  satname?: string;
  topPasses: Pass[];
}

export function useRecommendation() {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${base}/api/recommendation`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RecommendationData = await res.json();
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
    const id = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, loading, error };
}
