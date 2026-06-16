import { useState, useEffect, useRef } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import type { SavedLocation }    from '../hooks/useProfile';

interface Props {
  location:       LocationSettings;
  savedLocations: SavedLocation[];
  onSwitch:       (loc: SavedLocation) => void;
  onManage:       () => void;
  flashing:       boolean;
  gpsAccuracy?:   number | null;
  agoText:        string;
}

function isActive(saved: SavedLocation, current: LocationSettings): boolean {
  return Math.abs(saved.lat - current.lat) < 0.005 && Math.abs(saved.lon - current.lon) < 0.005;
}

export function LocationSwitcher({ location, savedLocations, onSwitch, onManage, flashing, gpsAccuracy, agoText }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="loc-switcher-wrap" ref={ref}>
      <button
        className={`header-location header-location-btn${flashing ? ' header-location-flash' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Switch location"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {location.name}&nbsp;|&nbsp;
        {Math.abs(location.lat).toFixed(2)}°{location.lat >= 0 ? 'N' : 'S'},&nbsp;
        {Math.abs(location.lon).toFixed(2)}°{location.lon >= 0 ? 'E' : 'W'}
        {gpsAccuracy !== null && gpsAccuracy !== undefined && (
          <span
            className="gps-accuracy"
            style={{ color: gpsAccuracy < 50 ? '#00d4ff' : gpsAccuracy < 200 ? '#ffb800' : '#4a6080' }}
          >
            ±{gpsAccuracy}m
          </span>
        )}
        {agoText && <span className="header-ago">&nbsp;· {agoText}</span>}
        <svg
          className={`loc-switcher-chevron${open ? ' loc-switcher-chevron--open' : ''}`}
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="loc-switcher-dropdown">
          {savedLocations.length === 0 ? (
            <div className="loc-switcher-empty">No saved locations yet</div>
          ) : (
            savedLocations.map(saved => {
              const active = isActive(saved, location);
              return (
                <button
                  key={saved.id}
                  className={`loc-switcher-item${active ? ' loc-switcher-item--active' : ''}`}
                  onClick={() => { onSwitch(saved); setOpen(false); }}
                >
                  <div className="loc-switcher-item-top">
                    <span className="loc-switcher-item-label">{saved.label}</span>
                    {saved.is_default && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffb800" stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    )}
                    {active && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div className="loc-switcher-item-coords">
                    {saved.name !== saved.label ? `${saved.name} · ` : ''}
                    {Math.abs(saved.lat).toFixed(2)}°{saved.lat >= 0 ? 'N' : 'S'},&nbsp;
                    {Math.abs(saved.lon).toFixed(2)}°{saved.lon >= 0 ? 'E' : 'W'}
                  </div>
                </button>
              );
            })
          )}

          <div className="loc-switcher-divider" />
          <button className="loc-switcher-manage" onClick={() => { onManage(); setOpen(false); }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Manage locations
          </button>
        </div>
      )}
    </div>
  );
}
