export const CONSTELLATIONS = ['ALL', 'STARLINK', 'ONEWEB', 'ISS', 'GPS'] as const;

export function getConstellation(name: string): string {
  if (name.includes('STARLINK')) return 'STARLINK';
  if (name.includes('ONEWEB'))   return 'ONEWEB';
  if (name.includes('ISS') || name.includes('ZARYA')) return 'ISS';
  if (name.includes('GPS') || name.includes('NAVSTAR')) return 'GPS';
  return 'OTHER';
}

export const CONSTELLATION_COLORS: Record<string, string> = {
  STARLINK: '#00ff88',  // matrix green
  ONEWEB:   '#00d4ff',  // ice blue
  ISS:      '#e8f4fd',  // near white
  GPS:      '#ffb800',  // amber
  OTHER:    '#4a6080',  // muted blue-grey
};

export const CONSTELLATION_LABELS: Record<string, string> = {
  STARLINK: 'Starlink only',
  ONEWEB:   'OneWeb only',
  ISS:      'ISS only',
  GPS:      'GPS only',
};
