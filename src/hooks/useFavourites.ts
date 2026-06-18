import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

const LS_KEY      = 'startrack-favourites';
const GUEST_KEY   = 'startrack-guest-key';

function getGuestKey(): string {
  let key = localStorage.getItem(GUEST_KEY);
  if (!key) {
    key = 'guest_' + Math.random().toString(36).slice(2);
    localStorage.setItem(GUEST_KEY, key);
  }
  return key;
}

function lsGet(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); }
  catch { return []; }
}

function lsSet(favs: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(favs));
}

export function useFavourites() {
  const { user } = useAuth();
  const [favourites, setFavourites] = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);

  const ownerFilter = useCallback(() => {
    return user
      ? { user_id: user.id }
      : { guest_key: getGuestKey() };
  }, [user]);

  const loadFavourites = useCallback(async () => {
    setLoading(true);

    // No Supabase configured — localStorage only
    if (!supabase) {
      setFavourites(lsGet());
      setLoading(false);
      return;
    }

    const filter = ownerFilter();
    let query = supabase.from('favourite_satellites').select('satellite_name');
    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('guest_key', (filter as { guest_key: string }).guest_key);
    }
    const { data } = await query;
    setFavourites((data ?? []).map((d: { satellite_name: string }) => d.satellite_name));
    setLoading(false);
  }, [user, ownerFilter]);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

  const toggleFavourite = async (satelliteName: string, noradId?: string) => {
    const isFav = favourites.includes(satelliteName);

    // localStorage path (no Supabase)
    if (!supabase) {
      const next = isFav
        ? favourites.filter(f => f !== satelliteName)
        : [...favourites, satelliteName];
      lsSet(next);
      setFavourites(next);
      return;
    }

    const filter = ownerFilter();
    if (isFav) {
      let query = supabase.from('favourite_satellites').delete().eq('satellite_name', satelliteName);
      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.eq('guest_key', (filter as { guest_key: string }).guest_key);
      }
      await query;
      setFavourites(prev => prev.filter(f => f !== satelliteName));
    } else {
      await supabase.from('favourite_satellites').insert({
        ...filter,
        satellite_name: satelliteName,
        norad_id:       noradId ?? null,
      });
      setFavourites(prev => [...prev, satelliteName]);
    }
  };

  const isFavourite = (satelliteName: string) => favourites.includes(satelliteName);

  return { favourites, loading, toggleFavourite, isFavourite, refresh: loadFavourites };
}
