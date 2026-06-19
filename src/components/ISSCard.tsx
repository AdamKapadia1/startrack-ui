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
  crew:           string[];
  crewCount:      number;
  altitudeKm:     number | null;
  speedKmS:       number | null;
  currentLat:     number | null;
  currentLon:     number | null;
  nextPass:       NextPass | null;
  nasaImageUrl:   string | null;
  nasaImageTitle: string | null;
}

interface Props {
  satellites:        Satellite[];
  location:          LocationSettings;
  onSelectSatellite: (sat: Satellite) => void;
  onOpenSkyMap?:     () => void;
  onOpenSettings?:   () => void;
}

function azimuthToDirection(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}

function elevationHint(el: number): string {
  if (el >= 40) return 'high in the sky, easy to spot';
  if (el >= 20) return 'mid-sky, look carefully';
  return 'low on the horizon, may be hard to see';
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
      if (secs === 0) { setText('now'); return; }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      if (h > 0) setText(`${h}h ${m}m`);
      else if (m > 0) setText(`${m}m ${s}s`);
      else setText(`${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetUTC]);
  return text;
}

function useRemainingSeconds(endUTC: number | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!endUTC) { setSecs(0); return; }
    function tick() { setSecs(Math.max(0, endUTC - Math.floor(Date.now() / 1000))); }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endUTC]);
  return secs;
}

function CrewAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="iss-crew-avatar" title={name}>{initials}</div>
  );
}

export function ISSCard({ satellites, location, onSelectSatellite, onOpenSkyMap, onOpenSettings }: Props) {
  const [info,         setInfo]         = useState<ISSInfo | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [crewExpanded, setCrewExpanded] = useState(false);

  const issTle = satellites.find(s =>
    s.satname.toUpperCase().includes('ISS') ||
    s.satname.toUpperCase().includes('ZARYA')
  );
  const isOverhead = !!issTle;

  const nowSecs       = Math.floor(Date.now() / 1000);
  const visibleEndUTC = isOverhead && info?.nextPass?.endUTC && info.nextPass.endUTC > nowSecs
    ? info.nextPass.endUTC : null;
  const nextStartUTC  = !isOverhead && info?.nextPass?.startUTC ? info.nextPass.startUTC : null;

  const visibleForSecs = useRemainingSeconds(visibleEndUTC);
  const passCountdown  = useCountdown(nextStartUTC);

  const approxMins = visibleEndUTC
    ? Math.round(visibleForSecs / 60)
    : (info?.nextPass?.duration != null ? Math.round(info.nextPass.duration / 60) : null);

  const direction = issTle ? azimuthToDirection(issTle.azimuth) : null;
  const peakEl    = info?.nextPass?.maxEl ?? (issTle ? Math.round(issTle.elevation) : null);

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

  return (
    <div className="iss-card">

      {/* ── TOP: overhead alert OR photo + next pass ── */}
      {isOverhead ? (
        <div className="iss-overhead-alert">
          <div className="iss-overhead-header">
            <span className="iss-overhead-icon">🛰</span>
            <span>THE ISS IS OVERHEAD RIGHT NOW</span>
          </div>

          <div className="iss-overhead-meta">
            {peakEl != null && <span>Peaking at <strong>{peakEl}°</strong> elevation</span>}
            {direction && <span> — <strong>{direction}</strong> from you</span>}
            {approxMins != null && approxMins > 0 && (
              <span> · visible for approximately <strong>{approxMins} min</strong></span>
            )}
          </div>

          {visibleForSecs > 0 && (
            <div className="iss-visible-countdown">
              <div className="iss-countdown-label">Visible for</div>
              <div className="iss-countdown-value">
                {Math.floor(visibleForSecs / 60)}m{' '}
                {String(visibleForSecs % 60).padStart(2, '0')}s
              </div>
            </div>
          )}

          {direction && issTle && (
            <div className="iss-overhead-guidance">
              <p>
                Go outside and look <strong>{direction}</strong>.{' '}
                At <strong>{Math.round(issTle.elevation)}°</strong> elevation it will be{' '}
                <strong>{elevationHint(issTle.elevation)}</strong>.
              </p>
              <p className="iss-overhead-tip">
                The ISS appears as a bright moving star — no telescope needed.
                Moving steadily across the sky over several minutes.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="iss-banner">
            {info?.nasaImageUrl && (
              <img
                src={info.nasaImageUrl}
                alt={info.nasaImageTitle || 'International Space Station'}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
                style={{
                  width: '100%', height: '200px', objectFit: 'cover',
                  borderRadius: '6px 6px 0 0', display: 'block',
                }}
              />
            )}
            {!info?.nasaImageUrl && (
              <div style={{
                width: '100%', height: '100px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-tertiary)', borderRadius: '6px 6px 0 0',
                color: 'var(--text-tertiary)', fontSize: '13px',
              }}>
                No photo available
              </div>
            )}
            {info?.nasaImageTitle && (
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', padding: '4px 8px', fontStyle: 'italic' }}>
                📷 {info.nasaImageTitle} — NASA
              </div>
            )}
            <div className="iss-banner-overlay">
              <div className="iss-banner-top">
                <span className="iss-label">International Space Station</span>
              </div>
            </div>
          </div>

          {!loading && info?.nextPass && (
            <div className="iss-next-pass-block">
              <div className="iss-next-pass">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>
                  Next pass: {formatDate(info.nextPass.startUTC)} at{' '}
                  <strong>{formatBST(info.nextPass.startUTC)}</strong> BST · peaking at{' '}
                  <strong>{info.nextPass.maxEl}°</strong>
                </span>
              </div>
              {passCountdown && (
                <div className="iss-pass-countdown">
                  Pass in <strong>{passCountdown}</strong>
                </div>
              )}
              {onOpenSettings && (
                <button className="iss-reminder-btn" onClick={onOpenSettings}>
                  🔔 Set a reminder
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── BODY: telemetry + crew (always shown) ── */}
      <div className="iss-body">
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

        {/* Collapsible crew — collapsed by default */}
        {!loading && info && info.crewCount > 0 && (
          <div className="iss-crew-collapsible">
            <button
              className="iss-crew-toggle"
              onClick={() => setCrewExpanded(x => !x)}
            >
              {info.crewCount} aboard — {crewExpanded ? 'hide crew' : 'show crew'}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                style={{ transform: crewExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {crewExpanded && (
              <div className="iss-crew-section">
                <div className="iss-crew-avatars">
                  {info.crew.map(name => <CrewAvatar key={name} name={name} />)}
                </div>
                <div className="iss-crew-names">{info.crew.join(' · ')}</div>
              </div>
            )}
          </div>
        )}

        <button
          className={`iss-track-btn${isOverhead ? ' iss-track-btn--overhead' : ''}`}
          onClick={() => {
            if (isOverhead && onOpenSkyMap) { onOpenSkyMap(); return; }
            if (issTle) onSelectSatellite(issTle);
          }}
          disabled={!issTle && !isOverhead}
          title={issTle ? (isOverhead ? 'Open sky map' : 'Open ISS detail panel') : 'ISS not currently overhead'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          {isOverhead ? 'Open sky map →' : issTle ? 'Track live →' : 'Not visible right now'}
        </button>
      </div>
    </div>
  );
}
