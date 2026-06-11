import { useState } from 'react';

export interface LocationSettings {
  name: string;
  lat:  number;
  lon:  number;
  alt:  number;
}

export const DEFAULT_LOCATION: LocationSettings = {
  name: 'Tring, Hertfordshire',
  lat:  51.7957,
  lon:  -0.6572,
  alt:  148,
};

const STORAGE_KEY = 'startrack-location';

export function useLocation() {
  const [location, setLocation] = useState<LocationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_LOCATION, ...JSON.parse(stored) } : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });

  function saveLocation(loc: LocationSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    setLocation(loc);
  }

  function resetLocation() {
    localStorage.removeItem(STORAGE_KEY);
    setLocation(DEFAULT_LOCATION);
  }

  return { location, saveLocation, resetLocation };
}
