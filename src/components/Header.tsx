import type { LocationSettings } from '../hooks/useLocation';

interface Props {
  location:       LocationSettings;
  onOpenSettings: () => void;
}

export function Header({ location, onOpenSettings }: Props) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">StarTrack AI</span>
        <span className="live-pill">
          <span className="live-pill-dot" />
          Live
        </span>
      </div>

      <div className="header-location">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {location.name}&nbsp;|&nbsp;
        {Math.abs(location.lat).toFixed(2)}°{location.lat >= 0 ? 'N' : 'S'},&nbsp;
        {Math.abs(location.lon).toFixed(2)}°{location.lon >= 0 ? 'E' : 'W'}&nbsp;|&nbsp;
        Alt {location.alt}m
      </div>

      <div className="header-actions">
        <button className="icon-btn" aria-label="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
        <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5"  cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="19" cy="12" r="1.5"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
