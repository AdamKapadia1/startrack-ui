export type HorizonPresetKey = 'flat' | 'suburban' | 'urban' | 'valley' | 'custom';

export interface HorizonSettings {
  preset: HorizonPresetKey;
  // 8 values for N, NE, E, SE, S, SW, W, NW (0-30°), used only when preset === 'custom'
  custom: number[];
}

export const HORIZON_PRESET_VALUES: Record<Exclude<HorizonPresetKey, 'custom'>, number> = {
  flat:     0,
  suburban: 5,
  urban:    15,
  valley:   20,
};

export const HORIZON_PRESET_INFO: Record<HorizonPresetKey, { label: string; description: string }> = {
  flat:     { label: 'Flat horizon (default)', description: 'Clear view in all directions' },
  suburban: { label: 'Suburban',               description: 'Some trees/buildings (~5° obstruction)' },
  urban:    { label: 'Urban',                  description: 'City buildings nearby (~15° obstruction)' },
  valley:   { label: 'Valley/Hills',           description: 'Significant terrain blocking (~20° obstruction)' },
  custom:   { label: 'Custom',                 description: 'Set manually' },
};

export const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const COMPASS_AZIMUTHS = [0, 45, 90, 135, 180, 225, 270, 315];

export const DEFAULT_HORIZON_SETTINGS: HorizonSettings = {
  preset: 'flat',
  custom: new Array(8).fill(5),
};

const STORAGE_KEY = 'startrack-horizon-profile';

export function loadHorizonSettings(): HorizonSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HORIZON_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed?.preset && Array.isArray(parsed.custom) && parsed.custom.length === 8) {
      return parsed;
    }
  } catch { /* ignore malformed storage */ }
  return DEFAULT_HORIZON_SETTINGS;
}

export function saveHorizonSettings(settings: HorizonSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Per-10°-bucket minimum elevation (36 values), matching the backend's HorizonProfile shape.
export function resolveHorizonProfile(settings: HorizonSettings): number[] {
  if (settings.preset !== 'custom') {
    return new Array(36).fill(HORIZON_PRESET_VALUES[settings.preset]);
  }
  // Each bucket takes the value of its nearest compass anchor (circular distance)
  return Array.from({ length: 36 }, (_, i) => {
    const az = i * 10;
    let nearest = 0, nearestDist = Infinity;
    COMPASS_AZIMUTHS.forEach((anchorAz, idx) => {
      const diff = Math.abs(az - anchorAz);
      const dist = Math.min(diff, 360 - diff);
      if (dist < nearestDist) { nearestDist = dist; nearest = idx; }
    });
    return settings.custom[nearest];
  });
}

// Query string fragment for pass-prediction API calls, e.g. "&horizon=urban" or "&horizonCustom=0,0,5,...".
// Flat is the backend default, so it's omitted entirely.
export function horizonQueryParam(settings: HorizonSettings): string {
  if (settings.preset === 'flat') return '';
  if (settings.preset !== 'custom') return `&horizon=${settings.preset}`;
  return `&horizonCustom=${resolveHorizonProfile(settings).join(',')}`;
}
