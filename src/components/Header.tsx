import { useState, useEffect, useRef } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import type { WsStatus } from '../hooks/useWebSocket';
import type { Pass } from '../hooks/useRecommendation';
import { AlertSettings } from './AlertSettings';

interface StatusCfg { label: string; color: string; pulse: boolean }

const STATUS: Record<WsStatus, StatusCfg> = {
  connecting:   { label: 'Connecting', color: '#ffb800', pulse: true  },
  live:         { label: 'Live',       color: '#00d4ff', pulse: true  },
  reconnecting: { label: 'Connecting', color: '#ffb800', pulse: true  },
  polling:      { label: 'Refreshing', color: '#4a6080', pulse: false },
  offline:      { label: 'Offline',    color: '#ff4444', pulse: false },
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
  onOpenHelp:     () => void;
  onToggleTheme:  () => void;
  theme:          string;
  wsStatus:       WsStatus;
  lastUpdated:    Date | null;
  gpsAccuracy?:   number | null;
  topPasses:      Pass[];
}

export function Header({ location, onOpenSettings, onOpenHelp, onToggleTheme, theme, wsStatus, lastUpdated, gpsAccuracy, topPasses }: Props) {
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
        <span className="header-logo">STARTRACK<sup>AI</sup></span>
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
              color: gpsAccuracy < 50 ? '#00d4ff' : gpsAccuracy < 200 ? '#ffb800' : '#4a6080',
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
        <AlertSettings passes={topPasses} />
        <button
          className="icon-btn"
          title="Test WebSocket connection (check browser console)"
          aria-label="Test WebSocket"
          onClick={() => {
            console.log('[WS-TEST] Opening test connection to wss://web-production-98c0d.up.railway.app …');
            const ws = new WebSocket('wss://web-production-98c0d.up.railway.app');
            ws.onopen  = () => { console.log('[WS-TEST] ✅ OPENED'); ws.close(); };
            ws.onerror = (e)  => console.log('[WS-TEST] ❌ ERROR', e);
            ws.onclose = (e)  => console.log(`[WS-TEST] CLOSED — code=${e.code} reason=${e.reason || '(none)'} wasClean=${e.wasClean}`);
            ws.onmessage = (e) => console.log('[WS-TEST] MESSAGE (first)', typeof e.data === 'string' ? e.data.slice(0, 120) : e.data);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </button>
        <button className="icon-btn" aria-label="Help" onClick={onOpenHelp}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
        <button className="icon-btn" aria-label="Toggle theme" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1"     x2="12" y2="3"/>
              <line x1="12" y1="21"    x2="12" y2="23"/>
              <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1"  y1="12"    x2="3"  y2="12"/>
              <line x1="21" y1="12"    x2="23" y2="12"/>
              <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
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
