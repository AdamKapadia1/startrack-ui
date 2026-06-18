import { useState, useEffect } from 'react';
import type { Satellite } from '../types';
import type { LocationSettings } from '../hooks/useLocation';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface NextPass {
  startUTC: number;
  maxUTC:   number;
  endUTC:   number;
  maxEl:    number;
  duration: number;
}

interface ISSInfo {
  crew:          string[];
  crewCount:     number;
  altitudeKm:    number | null;
  speedKmS:      number | null;
  currentLat:    number | null;
  currentLon:    number | null;
  nextPass:      NextPass | null;
  nasaImageUrl:  string;
}

interface Props {
  satellites:        Satellite[];
  location:          LocationSettings;
  onSelectSatellite: (sat: Satellite) => void;
}

function formatBST(utc: number): string {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function formatDate(utc: number): string {
  return new Date(utc * 1000).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London',
  });
}

function useCountdown(targetUTC: number | null): string {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!targetUTC) { setText(''); return; }
    function tick() {
      const secs = Math.max(0, targetUTC! - Math.floor(Date.now() / 1000));
      if (secs === 0) { setText('Passing now'); return; }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      if (h > 0) setText(`in ${h}h ${m}m`);
      else if (m > 0) setText(`in ${m}m ${s}s`);
      else setText(`in ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetUTC]);
  return text;
}

function CrewAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="iss-crew-avatar" title={name}>
      {initials}
    </div>
  );
}

export function ISSCard({ satellites, location, onSelectSatellite }: Props) {
  const [info,        setInfo]        = useState<ISSInfo | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [imgError,    setImgError]    = useState(false);

  const issTle = satellites.find(s =>
    s.satname.toUpperCase().includes('ISS') ||
    s.satname.toUpperCase().includes('ZARYA')
  );
  const isOverhead = !!issTle;

  const countdown = useCountdown(info?.nextPass?.startUTC ?? null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `${API_BASE}/api/iss/info?lat=${location.lat}&lon=${location.lon}&alt=${location.alt ?? 0}`,
        );
        if (!cancelled && r.ok) setInfo(await r.json());
      } catch { /* leave null */ }
      if (!cancelled) setLoading(false);
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [location.lat, location.lon, location.alt]);

  const FALLBACK_IMG = 'https://images-assets.nasa.gov/image/iss054e004111/iss054e004111~medium.jpg';

  return (
    <div className="iss-card">
      {/* Banner image */}
      <div className="iss-banner">
        <img
          src={imgError || !info?.nasaImageUrl ? FALLBACK_IMG : info.nasaImageUrl}
          alt="International Space Station"
          className="iss-banner-img"
          onError={() => setImgError(true)}
        />
        <div className="iss-banner-overlay">
          <div className="iss-banner-top">
            <span className="iss-label">International Space Station</span>
            {isOverhead ? (
              <span className="iss-live-badge iss-live-badge--live">
                <span className="iss-live-dot" /> OVERHEAD NOW
              </span>
            ) : info?.nextPass ? (
              <span className="iss-live-badge">NEXT PASS {countdown}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="iss-body">
        {/* Telemetry row */}
        <div className="iss-telemetry-row">
          <div className="iss-telemetry-cell">
            <span className="iss-tel-label">Altitude</span>
            <span className="iss-tel-value">
              {loading ? '—' : info?.altitudeKm != null ? `${info.altitudeKm} km` : '—'}
            </span>
          </div>
          <div className="iss-telemetry-divider" />
          <div className="iss-telemetry-cell">
            <span className="iss-tel-label">Speed</span>
            <span className="iss-tel-value">
              {loading ? '—' : info?.speedKmS != null ? `${info.speedKmS} km/s` : '—'}
            </span>
          </div>
          <div className="iss-telemetry-divider" />
          <div className="iss-telemetry-cell">
            <span className="iss-tel-label">Crew</span>
            <span className="iss-tel-value">
              {loading ? '—' : info?.crewCount ? `${info.crewCount} aboard` : '—'}
            </span>
          </div>
        </div>

        {/* Crew avatars */}
        {!loading && info && info.crew.length > 0 && (
          <div className="iss-crew-section">
            <div className="iss-crew-avatars">
              {info.crew.map(name => <CrewAvatar key={name} name={name} />)}
            </div>
            <div className="iss-crew-names">
              {info.crew.join(' · ')}
            </div>
          </div>
        )}

        {/* Next pass */}
        {!loading && info?.nextPass && (
          <div className="iss-next-pass">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>
              {formatDate(info.nextPass.startUTC)} at{' '}
              <strong>{formatBST(info.nextPass.startUTC)}</strong> BST · peaking at{' '}
              <strong>{info.nextPass.maxEl}°</strong>
            </span>
          </div>
        )}

        {/* Track live button */}
        <button
          className="iss-track-btn"
          onClick={() => issTle && onSelectSatellite(issTle)}
          disabled={!issTle}
          title={issTle ? 'Open ISS detail panel' : 'ISS not currently overhead'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          {issTle ? 'Track live →' : 'Not visible right now'}
        </button>
      </div>
    </div>
  );
}
