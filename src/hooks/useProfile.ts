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

export function useProfile(userId: string | null | undefined) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading,   setLoading]   = useState(false);

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

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

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

  return { locations, loading, addLocation, removeLocation, refetch: fetchLocations };
}
