export const CONSTELLATIONS = ['ALL', 'STARLINK', 'ONEWEB', 'ISS', 'GPS', 'GALILEO', 'GLONASS'] as const;

// Prefer the backend-tagged constellation field (reliable for satellites whose
// name doesn't contain the constellation, e.g. GLONASS birds named "COSMOS ...").
// Falls back to name matching only when the field is missing (older cached data, WS edge cases).
export function getConstellation(name: string, constellation?: string | null): string {
  if (constellation) return constellation.toUpperCase();
  if (name.includes('STARLINK')) return 'STARLINK';
  if (name.includes('ONEWEB'))   return 'ONEWEB';
  if (name.includes('ISS') || name.includes('ZARYA')) return 'ISS';
  if (name.includes('GPS') || name.includes('NAVSTAR')) return 'GPS';
  if (name.includes('GALILEO') || name.includes('GSAT')) return 'GALILEO';
  if (name.includes('GLONASS') || name.includes('COSMOS')) return 'GLONASS';
  return 'OTHER';
}

export const CONSTELLATION_COLORS: Record<string, string> = {
  STARLINK: '#00ff88',  // matrix green
  ONEWEB:   '#00d4ff',  // ice blue
  ISS:      '#e8f4fd',  // near white
  GPS:      '#ffb800',  // amber
  GALILEO:  '#b888d4',  // muted lavender
  GLONASS:  '#d4a888',  // muted orange-brown
  OTHER:    '#4a6080',  // muted blue-grey
};

export const CONSTELLATION_LABELS: Record<string, string> = {
  STARLINK: 'Starlink only',
  ONEWEB:   'OneWeb only',
  ISS:      'ISS only',
  GPS:      'GPS only',
  GALILEO:  'Galileo only',
  GLONASS:  'GLONASS only',
};
