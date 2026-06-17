import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface SavedLocation {
  id:         string;
  label:      string;
  name:       string;
  lat:        number;
  lon:        number;
  alt:        number;
  is_default: boolean;
  created_at: string;
}

export interface AccountSettings {
  timezone:                    string;
  units:                       'metric' | 'imperial';
  default_elevation_threshold: number;
}

const DEFAULT_SETTINGS: AccountSettings = {
  timezone:                    'Europe/London',
  units:                       'metric',
  default_elevation_threshold: 10,
};

export function useProfile(userId: string | null | undefined) {
  const [locations,       setLocations]       = useState<SavedLocation[]>([]);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(DEFAULT_SETTINGS);
  const [loading,         setLoading]         = useState(false);

  const fetchLocations = useCallback(async () => {
    if (!supabase || !userId) { setLocations([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at',  { ascending: true });
    setLocations((data as SavedLocation[]) ?? []);
    setLoading(false);
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!supabase || !userId) { setAccountSettings(DEFAULT_SETTINGS); return; }
    const { data } = await supabase
      .from('user_profiles')
      .select('timezone, units, default_elevation_threshold')
      .eq('id', userId)
      .single();
    if (data) {
      setAccountSettings({
        timezone:                    data.timezone                    ?? 'Europe/London',
        units:                       (data.units                      ?? 'metric') as 'metric' | 'imperial',
        default_elevation_threshold: data.default_elevation_threshold ?? 10,
      });
    }
  }, [userId]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);
  useEffect(() => { loadProfile(); },   [loadProfile]);

  async function addLocation(params: { label: string; name: string; lat: number; lon: number; alt: number }) {
    if (!supabase || !userId) return;
    const isFirst = locations.length === 0;
    const { data } = await supabase
      .from('saved_locations')
      .insert({ ...params, user_id: userId, is_default: isFirst })
      .select()
      .single();
    if (data) setLocations(prev => [...prev, data as SavedLocation]);
  }

  async function removeLocation(id: string) {
    if (!supabase) return;
    await supabase.from('saved_locations').delete().eq('id', id);
    setLocations(prev => prev.filter(l => l.id !== id));
  }

  async function updateAccountSettings(settings: Partial<AccountSettings>) {
    if (!supabase || !userId) return { data: null, error: new Error('Not authenticated') };
    const merged = { ...accountSettings, ...settings };
    const payload = {
      id:                          userId,
      timezone:                    merged.timezone,
      units:                       merged.units,
      default_elevation_threshold: merged.default_elevation_threshold,
    };
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(payload)
      .select()
      .single();
    if (!error && data) {
      setAccountSettings({
        timezone:                    data.timezone                    ?? 'Europe/London',
        units:                       (data.units                      ?? 'metric') as 'metric' | 'imperial',
        default_elevation_threshold: data.default_elevation_threshold ?? 10,
      });
    }
    return { data, error };
  }

  return {
    locations, loading, accountSettings,
    addLocation, removeLocation,
    updateAccountSettings,
    refetch: fetchLocations,
  };
}
