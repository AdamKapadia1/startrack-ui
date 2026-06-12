import type { GeoPermState } from '../hooks/useLocation';

interface Props {
  permState: GeoPermState;
  onAllow:   () => void;
  onDecline: () => void;
}

export function LocationPermission({ permState, onAllow, onDecline }: Props) {
  if (permState === 'checking' || permState === 'granted' || permState === 'declined') return null;

  if (permState === 'denied') {
    return (
      <div className="loc-perm-bar loc-perm-denied">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Location access denied — tap ··· to set your location manually</span>
      </div>
    );
  }

  return (
    <div className="loc-perm-bar">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span className="loc-perm-text">Allow location access for accurate satellite tracking</span>
      <div className="loc-perm-actions">
        <button className="loc-perm-allow" onClick={onAllow}>Allow</button>
        <button className="loc-perm-decline" onClick={onDecline}>Not now</button>
      </div>
    </div>
  );
}
