export const CONSTELLATIONS = ['ALL', 'STARLINK', 'ONEWEB', 'ISS', 'GPS'] as const;

export function getConstellation(name: string): string {
  if (name.includes('STARLINK')) return 'STARLINK';
  if (name.includes('ONEWEB'))   return 'ONEWEB';
  if (name.includes('ISS') || name.includes('ZARYA')) return 'ISS';
  if (name.includes('GPS') || name.includes('NAVSTAR')) return 'GPS';
  return 'OTHER';
}

export const CONSTELLATION_COLORS: Record<string, string> = {
  STARLINK: '#1D9E75',
  ONEWEB:   '#4A90D9',
  ISS:      '#FFFFFF',
  GPS:      '#F5A623',
  OTHER:    '#6B7280',
};

export const CONSTELLATION_LABELS: Record<string, string> = {
  STARLINK: 'Starlink only',
  ONEWEB:   'OneWeb only',
  ISS:      'ISS only',
  GPS:      'GPS only',
};
