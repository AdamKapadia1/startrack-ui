import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export interface PassHistoryEntry {
  id:               number;
  user_id:          string;
  satellite_name:   string;
  norad_id:         string | null;
  location_label:   string | null;
  lat:              number | null;
  lon:              number | null;
  pass_time:        string;
  max_elevation:    number;
  duration_seconds: number | null;
  signal_score:     number | null;
  quality:          string | null;
  event_type:       'viewed' | 'alerted' | 'shared' | 'calendar_export';
  created_at:       string;
}

export interface LogEventParams {
  satelliteName:   string;
  noradId?:        string;
  locationLabel?:  string;
  lat?:            number;
  lon?:            number;
  passTime:        string;
  maxElevation:    number;
  durationSeconds?: number;
  signalScore?:    number;
  quality?:        string;
  eventType:       'viewed' | 'alerted' | 'shared' | 'calendar_export';
}

export function usePassHistory() {
  const { user } = useAuth();
  const [history,  setHistory]  = useState<PassHistoryEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [hasMore,  setHasMore]  = useState(false);

  const logEvent = useCallback(async (event: LogEventParams) => {
    if (!user || !supabase) return;
    await supabase.from('user_pass_history').insert({
      user_id:          user.id,
      satellite_name:   event.satelliteName,
      norad_id:         event.noradId        ?? null,
      location_label:   event.locationLabel  ?? null,
      lat:              event.lat            ?? null,
      lon:              event.lon            ?? null,
      pass_time:        event.passTime,
      max_elevation:    event.maxElevation,
      duration_seconds: event.durationSeconds ?? null,
      signal_score:     event.signalScore    ?? null,
      quality:          event.quality        ?? null,
      event_type:       event.eventType,
    });
  }, [user]);

  const fetchHistory = useCallback(async (searchTerm?: string, limit = 50, offset = 0) => {
    if (!user || !supabase) return;
    setLoading(true);

    let query = supabase
      .from('user_pass_history')
      .select('*')
      .eq('user_id', user.id)
      .order('pass_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchTerm?.trim()) {
      query = query.ilike('satellite_name', `%${searchTerm.trim()}%`);
    }

    const { data } = await query;
    const rows = (data ?? []) as PassHistoryEntry[];

    if (offset === 0) {
      setHistory(rows);
    } else {
      setHistory(prev => [...prev, ...rows]);
    }
    setHasMore(rows.length === limit);
    setLoading(false);
  }, [user]);

  return { history, loading, hasMore, logEvent, fetchHistory };
}
