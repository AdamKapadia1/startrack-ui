const KM_TO_MI = 0.621371;

export function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${Math.round(km * KM_TO_MI).toLocaleString()} mi`;
  return `${Math.round(km).toLocaleString()} km`;
}

export function formatAltitude(km: number, units: 'metric' | 'imperial'): string {
  return formatDistance(km, units);
}

export function formatSpeed(kmPerSec: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${(kmPerSec * KM_TO_MI).toFixed(2)} mi/s`;
  return `${kmPerSec.toFixed(2)} km/s`;
}
