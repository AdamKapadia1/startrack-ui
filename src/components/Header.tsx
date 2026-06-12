import { useState, useEffect, useRef } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import type { WsStatus } from '../hooks/useWebSocket';
import { NotificationSetup } from './NotificationSetup';

interface StatusCfg { label: string; color: string; pulse: boolean }

const STATUS: Record<WsStatus, StatusCfg> = {
  connecting:   { label: 'CONNECTING',   color: '#F59E0B', pulse: true  },
  live:         { label: 'LIVE',         color: '#1D9E75', pulse: true  },
  reconnecting: { label: 'RECONNECTING', color: '#F59E0B', pulse: true  },
  polling:      { label: 'POLLING',      color: '#6B7280', pulse: false },
  offline:      { label: 'OFFLINE',      color: '#EF4444', pulse: false },
};

function useAgoText(date: Date | null): string {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!date) { setText(''); return; }
    const d = date;
    function tick() {
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      setText(s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);
  return text;
}

interface Props {
  location:       LocationSettings;
  onOpenSettings: () => void;
  wsStatus:       WsStatus;
  lastUpdated:    Date | null;
  gpsAccuracy?:   number | null;
}

export function Header({ location, onOpenSettings, wsStatus, lastUpdated, gpsAccuracy }: Props) {
  const cfg      = STATUS[wsStatus] ?? STATUS.connecting;
  const agoText  = useAgoText(lastUpdated);
  const [flashing, setFlashing] = useState(false);
  const prevName = useRef(location.name);

  useEffect(() => {
    if (location.name !== prevName.current) {
      prevName.current = location.name;
      setFlashing(true);
      const id = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(id);
    }
  }, [location.name]);

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">StarTrack AI</span>
        <span
          className="status-pill"
          style={{
            borderColor: `${cfg.color}44`,
            background:  `${cfg.color}18`,
          }}
        >
          <span
            className="status-dot"
            style={{
              background: cfg.color,
              animation:  cfg.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{ color: cfg.color, fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px' }}>
            {cfg.label}
          </span>
        </span>
      </div>

      <div className={`header-location${flashing ? ' header-location-flash' : ''}`}>
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
            style={{
              color: gpsAccuracy < 50 ? '#1D9E75' : gpsAccuracy < 200 ? '#F59E0B' : '#6B7280',
            }}
          >
            ±{gpsAccuracy}m
          </span>
        )}
        {agoText && (
          <span className="header-ago">&nbsp;· {agoText}</span>
        )}
      </div>

      <div className="header-actions">
        <NotificationSetup />
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
