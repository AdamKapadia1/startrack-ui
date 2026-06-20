import { useState, useEffect, useRef, useCallback } from 'react';

export interface LocationSettings {
  name: string;
  lat:  number;
  lon:  number;
  alt:  number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function syncObserverToServer(loc: LocationSettings) {
  fetch(`${API_BASE}/api/notifications/location`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ lat: loc.lat, lon: loc.lon, alt: loc.alt, name: loc.name }),
  }).catch(() => {});
}

export type GeoPermState = 'checking' | 'prompt' | 'granted' | 'denied' | 'declined';
export type GpsStatus    = 'idle' | 'locating' | 'active' | 'error';

export const DEFAULT_LOCATION: LocationSettings = {
  name: 'Tring, Hertfordshire',
  lat:  51.7957,
  lon:  -0.6572,
  alt:  148,
};

const STORAGE_KEY    = 'startrack-location';
const DECLINED_KEY   = 'startrack-perm-declined';
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout:            10_000,
  maximumAge:         60_000,
};

function loadSaved(): LocationSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULT_LOCATION, ...JSON.parse(s) } : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'StarTrackAI/1.0 (startrackv1-ui.vercel.app)' } },
    );
    const data = await res.json();
    const a    = data.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality ?? 'Current location';
  } catch {
    return 'Current location';
  }
}

function persist(loc: LocationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function useLocation() {
  const [location,    setLocation]    = useState<LocationSettings>(loadSaved);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus,   setGpsStatus]   = useState<GpsStatus>('idle');
  const [permState,   setPermState]   = useState<GeoPermState>('checking');

  const watchIdRef  = useRef<number | null>(null);
  const lastPosRef  = useRef<{ lat: number; lon: number } | null>(null);
  const watchingRef = useRef(false);

  // ── Watch position (runs after initial fix) ───────────────────────────────
  const startWatch = useCallback(() => {
    if (watchingRef.current || !navigator.geolocation) return;
    watchingRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));

        if (lastPosRef.current) {
          const dist = haversineKm(lastPosRef.current.lat, lastPosRef.current.lon, latitude, longitude);
          if (dist < 1) return; // less than 1km — no update needed
        }
        lastPosRef.current = { lat: latitude, lon: longitude };

        const lat4 = parseFloat(latitude.toFixed(4));
        const lon4 = parseFloat(longitude.toFixed(4));

        // Update coordinates immediately, then re-geocode name
        setLocation(prev => {
          const updated = { ...prev, lat: lat4, lon: lon4, alt: Math.round(altitude ?? prev.alt) };
          persist(updated);
          return updated;
        });

        const name = await reverseGeocode(latitude, longitude);
        setLocation(prev => {
          const updated = { ...prev, name };
          persist(updated);
          syncObserverToServer(updated);
          return updated;
        });
      },
      err => console.warn('[gps] watch error:', err.message),
      GEO_OPTIONS,
    );
  }, []);

  // ── Request a one-shot fix then start watching ────────────────────────────
  const requestGPS = useCallback(async () => {
    if (!navigator.geolocation) { setPermState('denied'); return; }
    setGpsStatus('locating');

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        setGpsStatus('active');
        setPermState('granted');
        lastPosRef.current = { lat: latitude, lon: longitude };

        const name   = await reverseGeocode(latitude, longitude);
        const newLoc: LocationSettings = {
          name,
          lat: parseFloat(latitude.toFixed(4)),
          lon: parseFloat(longitude.toFixed(4)),
          alt: Math.round(altitude ?? 0),
        };
        persist(newLoc);
        setLocation(newLoc);
        syncObserverToServer(newLoc);
        startWatch();
      },
      err => {
        setGpsStatus('error');
        setPermState(err.code === 1 /* PERMISSION_DENIED */ ? 'denied' : 'prompt');
      },
      GEO_OPTIONS,
    );
  }, [startWatch]);

  // ── On mount: check permission and auto-request if already granted ────────
  useEffect(() => {
    if (localStorage.getItem(DECLINED_KEY) === '1') {
      setPermState('declined');
      return;
    }

    if (!navigator.geolocation) {
      setPermState('denied');
      return;
    }

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then(result => {
          if (result.state === 'granted') {
            setPermState('granted');
            requestGPS();
          } else if (result.state === 'denied') {
            setPermState('denied');
          } else {
            setPermState('prompt');
          }
          // Re-check if user changes browser permission setting
          result.onchange = () => {
            if (result.state === 'granted') { setPermState('granted'); requestGPS(); }
            if (result.state === 'denied')  { setPermState('denied'); }
          };
        })
        .catch(() => setPermState('prompt')); // permissions API unsupported (Safari)
    } else {
      setPermState('prompt'); // Safari: show banner, wait for user gesture
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── "Not now" ─────────────────────────────────────────────────────────────
  function declineGPS() {
    localStorage.setItem(DECLINED_KEY, '1');
    setPermState('declined');
  }

  // ── Manual save (from SettingsPanel) ─────────────────────────────────────
  function saveLocation(loc: LocationSettings) {
    persist(loc);
    setLocation(loc);
    syncObserverToServer(loc);
    // Stop GPS tracking when user manually sets a location
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current  = null;
      watchingRef.current = false;
    }
    setGpsAccuracy(null);
    setGpsStatus('idle');
  }

  function resetLocation() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DECLINED_KEY);
    setLocation(DEFAULT_LOCATION);
    setGpsAccuracy(null);
    setGpsStatus('idle');
    setPermState('prompt');
  }

  return {
    location,
    saveLocation,
    resetLocation,
    gpsAccuracy,
    gpsStatus,
    permState,
    requestGPS,
    declineGPS,
  };
}
