import { useState, useEffect } from 'react';
import type { Satellite } from '../types';
import type { LocationSettings } from '../hooks/useLocation';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  nextPasses:     NextPass[];
  nasaImageUrl:   string | null;
  nasaImageTitle: string | null;
}

interface TrackPoint { lat: number; lon: number; }

interface Props {
  satellites:        Satellite[];
  location:          LocationSettings;
  onSelectSatellite: (sat: Satellite) => void;
  onOpenSkyMap?:     () => void;
  onOpenSettings?:   () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ISS_FACTS = [
  'The ISS travels at 28,000 km/h — fast enough to circle Earth in 92 minutes',
  'The ISS has been continuously inhabited since November 2000',
  'The station is roughly the size of a football pitch at 109 × 73 metres',
  'Astronauts aboard experience 16 sunrises and sunsets every day',
  'The ISS orbits at approximately 420 km altitude above Earth',
  'The total mass of the ISS is around 420,000 kg',
  'The ISS is the largest structure humans have ever put in space',
  'Astronauts exercise 2 hours every day to prevent muscle and bone loss',
];

const CREW_FLAGS: Record<string, string> = {
  Kononenko: '🇷🇺', Chub: '🇷🇺', Grebenkin: '🇷🇺',
  Dyson:     '🇺🇸', Dominick: '🇺🇸', Barratt: '🇺🇸',
  Epps:      '🇺🇸', Wilmore: '🇺🇸', Williams: '🇺🇸',
  Pettit:    '🇺🇸', Rubio: '🇺🇸', Mann: '🇺🇸',
};

// Simplified continent outlines in [lon, lat] pairs (equirectangular)
const CONTINENTS: [number, number][][] = [
  // North America
  [[-168,70],[-140,60],[-130,54],[-124,47],[-117,32],[-90,15],[-80,25],[-80,30],[-75,44],[-65,44],[-55,50],[-65,60],[-80,70],[-100,70],[-135,60],[-155,57],[-163,61]],
  // Greenland
  [[-75,82],[-20,82],[-18,70],[-42,58],[-75,70]],
  // South America
  [[-80,12],[-60,12],[-50,5],[-36,-4],[-35,-34],[-55,-54],[-75,-50],[-80,-10]],
  // Europe
  [[-10,36],[4,36],[10,57],[15,58],[25,70],[35,70],[28,60],[18,40],[-8,44]],
  // Africa
  [[-18,15],[42,12],[50,-10],[36,-34],[18,-34],[12,-5],[0,5],[0,15]],
  // Asia (main body)
  [[26,70],[50,72],[100,72],[140,72],[155,58],[140,42],[120,22],[100,10],[75,18],[60,24],[50,30],[42,36],[26,40]],
  // Indian subcontinent
  [[68,22],[85,22],[80,8]],
  // Australia
  [[115,-22],[153,-22],[154,-32],[148,-42],[138,-34],[127,-32]],
  // Antarctica strip
  [[-180,-67],[-180,-90],[180,-90],[180,-67]],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAP_W = 320;
const MAP_H = 160;

function projX(lon: number) { return (lon + 180) / 360 * MAP_W; }
function projY(lat: number) { return (90 - lat) / 180 * MAP_H; }

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

function getRegion(lat: number, lon: number): string {
  if (lat > 66)  return 'the Arctic';
  if (lat < -60) return 'Antarctica';
  if (lat >= 15 && lat <= 75 && lon >= -130 && lon <= -60)  return 'North America';
  if (lat >= -55 && lat <= 15 && lon >= -82 && lon <= -35)  return 'South America';
  if (lat >= 35 && lat <= 72 && lon >= -15 && lon <= 45)    return 'Europe';
  if (lat >= -35 && lat <= 35 && lon >= -18 && lon <= 52)   return 'Africa';
  if (lat >= 0 && lat <= 75 && lon >= 45 && lon <= 150)     return 'Asia';
  if (lat >= -45 && lat <= 0 && lon >= 110 && lon <= 155)   return 'Australia';
  if (lon >= -80 && lon <= 20)  return 'the Atlantic Ocean';
  if (lon > 20 && lon <= 110)   return 'the Indian Ocean';
  return 'the Pacific Ocean';
}

function getFlag(name: string): string {
  for (const [surname, flag] of Object.entries(CREW_FLAGS)) {
    if (name.includes(surname)) return flag;
  }
  return '🌍';
}

function buildTrackSegments(pts: TrackPoint[]): string[] {
  const segs: string[][] = [];
  let cur: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && Math.abs(pts[i].lon - pts[i - 1].lon) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(`${projX(pts[i].lon).toFixed(1)},${projY(pts[i].lat).toFixed(1)}`);
  }
  if (cur.length > 1) segs.push(cur);
  return segs.map(s => s.join(' '));
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

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
    function tick() { setSecs(Math.max(0, endUTC! - Math.floor(Date.now() / 1000))); }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endUTC]);
  return secs;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CrewAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return <div className="iss-crew-avatar" title={name}>{initials}</div>;
}

function ISSWorldMap({ issLat, issLon, userLat, userLon, track }: {
  issLat: number; issLon: number;
  userLat: number; userLon: number;
  track: TrackPoint[];
}) {
  const now      = new Date();
  const hourUTC  = now.getUTCHours() + now.getUTCMinutes() / 60;
  const lonSun   = (12 - hourUTC) * 15;
  const lonNight = lonSun >= 0 ? lonSun - 180 : lonSun + 180;
  const nL = lonNight - 90;
  const nR = lonNight + 90;

  const issX  = projX(issLon);
  const issY  = projY(issLat);
  const usrX  = projX(userLon);
  const usrY  = projY(userLat);
  const segs  = buildTrackSegments(track);

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" style={{ display: 'block' }}>
      {/* Ocean */}
      <rect width={MAP_W} height={MAP_H} fill="#0c1a33" />

      {/* Lat/lon grid */}
      {([-60, -30, 0, 30, 60] as number[]).map(lat => (
        <line key={`lat${lat}`} x1={0} y1={projY(lat)} x2={MAP_W} y2={projY(lat)}
          stroke="#19305a" strokeWidth="0.5" />
      ))}
      {([-150,-120,-90,-60,-30,0,30,60,90,120,150] as number[]).map(lon => (
        <line key={`lon${lon}`} x1={projX(lon)} y1={0} x2={projX(lon)} y2={MAP_H}
          stroke="#19305a" strokeWidth="0.5" />
      ))}

      {/* Continents */}
      {CONTINENTS.map((poly, i) => (
        <polygon key={i}
          points={poly.map(([lo, la]) => `${projX(lo).toFixed(1)},${projY(la).toFixed(1)}`).join(' ')}
          fill="#243d2c" stroke="#365040" strokeWidth="0.5" />
      ))}

      {/* Night shading */}
      {nL >= -180 && nR <= 180 ? (
        <rect x={projX(nL)} y={0} width={projX(nR) - projX(nL)} height={MAP_H}
          fill="rgba(0,0,8,0.48)" />
      ) : nL < -180 ? (
        <>
          <rect x={0} y={0} width={projX(nR)} height={MAP_H} fill="rgba(0,0,8,0.48)" />
          <rect x={projX(nL + 360)} y={0} width={MAP_W - projX(nL + 360)} height={MAP_H} fill="rgba(0,0,8,0.48)" />
        </>
      ) : (
        <>
          <rect x={projX(nL)} y={0} width={MAP_W - projX(nL)} height={MAP_H} fill="rgba(0,0,8,0.48)" />
          <rect x={0} y={0} width={projX(nR - 360)} height={MAP_H} fill="rgba(0,0,8,0.48)" />
        </>
      )}

      {/* 30-min ground track */}
      {segs.map((pts, i) => (
        <polyline key={i} points={pts} fill="none"
          stroke="rgba(255,140,0,0.55)" strokeWidth="1.5" strokeDasharray="3,3" />
      ))}

      {/* User location */}
      <circle cx={usrX} cy={usrY} r="4" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <circle cx={usrX} cy={usrY} r="2.5" fill="#3b82f6" opacity="0.9" />

      {/* ISS glowing dot */}
      <circle cx={issX} cy={issY} r="12" fill="rgba(255,140,0,0.12)">
        <animate attributeName="r" values="8;16;8" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.12;0.04;0.12" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={issX} cy={issY} r="4" fill="#ff8c00" />
      <circle cx={issX} cy={issY} r="1.8" fill="#fff" opacity="0.9" />
      <text x={issX + 6} y={issY - 4} fontSize="7" fill="#ff8c00" fontWeight="bold">ISS</text>
    </svg>
  );
}

function ISSPassTimeline({ passes }: { passes: NextPass[] }) {
  const now      = Math.floor(Date.now() / 1000);
  const span24h  = 24 * 3600;
  const W        = 1000;
  const best     = passes.length > 0
    ? passes.reduce((a, b) => b.maxEl > a.maxEl ? b : a, passes[0])
    : null;

  return (
    <div className="iss-timeline-wrap">
      <div className="iss-timeline-label">Visibility — next 24 hours</div>
      <svg viewBox={`0 0 ${W} 34`} width="100%" preserveAspectRatio="none">
        <rect width={W} height={34} fill="var(--bg-tertiary)" rx="3" />
        {([0,6,12,18,24] as number[]).map(h => {
          const x = (h / 24) * W;
          return (
            <g key={h}>
              <line x1={x} y1={0} x2={x} y2={34} stroke="var(--border)" strokeWidth="1" />
              <text x={x + 5} y={30} fontSize="22" fill="var(--text-tertiary)">{h}h</text>
            </g>
          );
        })}
        {passes.map((pass, i) => {
          const sf = Math.max(0, (pass.startUTC - now) / span24h);
          const ef = Math.min(1, (pass.endUTC   - now) / span24h);
          if (sf >= 1 || ef <= 0) return null;
          const color = pass.maxEl >= 40 ? '#22c55e' : pass.maxEl >= 20 ? '#f59e0b' : '#6b7280';
          return (
            <rect key={i} x={sf * W} y={4} width={Math.max(6, (ef - sf) * W)} height={20}
              fill={color} rx="2" opacity="0.85">
              <title>{formatBST(pass.startUTC)} BST · max {pass.maxEl}° · {Math.round(pass.duration / 60)} min</title>
            </rect>
          );
        })}
        <polygon points="0,0 10,0 0,10" fill="rgba(255,255,255,0.7)" />
      </svg>
      <div className="iss-timeline-summary">
        {passes.length === 0 ? (
          <span>No passes in the next 24 hours</span>
        ) : (
          <>
            <span><strong>{passes.length}</strong> pass{passes.length !== 1 ? 'es' : ''} in 24 h
            {best && <> · best <strong>{formatBST(best.startUTC)}</strong> BST (<strong>{best.maxEl}°</strong>)</>}
            </span>
            <div className="iss-timeline-legend">
              <span className="dot-green" /><span>≥40°</span>
              <span className="dot-amber" /><span>20–39°</span>
              <span className="dot-gray"  /><span>&lt;20°</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ISSFactsTicker() {
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % ISS_FACTS.length); setVisible(true); }, 500);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="iss-facts-ticker">
      <span className="iss-facts-icon">🛸</span>
      <span className="iss-facts-text" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        {ISS_FACTS[idx]}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ISSCard({ satellites, location, onSelectSatellite, onOpenSkyMap, onOpenSettings }: Props) {
  const [info,         setInfo]         = useState<ISSInfo | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [track,        setTrack]        = useState<TrackPoint[]>([]);
  const [crewExpanded, setCrewExpanded] = useState(false);

  const issTle    = satellites.find(s =>
    s.satname.toUpperCase().includes('ISS') ||
    s.satname.toUpperCase().includes('ZARYA'),
  );
  const isOverhead = !!issTle;

  const nowSecs     = Math.floor(Date.now() / 1000);
  const passes      = info?.nextPasses ?? [];
  const currentPass = passes.find(p => p.startUTC <= nowSecs && p.endUTC > nowSecs) ?? null;
  const upcomingPass = passes.find(p => p.startUTC > nowSecs) ?? null;

  const visibleEndUTC = isOverhead && currentPass ? currentPass.endUTC : null;
  const nextStartUTC  = !isOverhead && upcomingPass ? upcomingPass.startUTC : null;

  const visibleForSecs = useRemainingSeconds(visibleEndUTC);
  const passCountdown  = useCountdown(nextStartUTC);

  const approxMins = visibleEndUTC
    ? Math.round(visibleForSecs / 60)
    : (currentPass?.duration != null ? Math.round(currentPass.duration / 60) : null);

  const direction = issTle ? azimuthToDirection(issTle.azimuth) : null;
  const peakEl    = currentPass?.maxEl ?? (issTle ? Math.round(issTle.elevation) : null);

  const issLat = info?.currentLat ?? null;
  const issLon = info?.currentLon ?? null;
  const region = issLat != null && issLon != null ? getRegion(issLat, issLon) : null;

  // Poll info every 10 s
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
    const id = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [location.lat, location.lon, location.alt]);

  // Poll ground track every 30 s
  useEffect(() => {
    async function loadTrack() {
      try {
        const r = await fetch(`${API_BASE}/api/iss/track`);
        if (r.ok) { const d = await r.json(); setTrack(d.points ?? []); }
      } catch { /* keep empty */ }
    }
    loadTrack();
    const id = setInterval(loadTrack, 30_000);
    return () => clearInterval(id);
  }, []);

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
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px 6px 0 0', display: 'block' }}
              />
            )}
            {!info?.nasaImageUrl && (
              <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--bg-tertiary)', borderRadius: '6px 6px 0 0',
                color: 'var(--text-tertiary)', fontSize: '13px' }}>
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

          {!loading && upcomingPass && (
            <div className="iss-next-pass-block">
              <div className="iss-next-pass">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>
                  Next pass: {formatDate(upcomingPass.startUTC)} at{' '}
                  <strong>{formatBST(upcomingPass.startUTC)}</strong> BST · peaking at{' '}
                  <strong>{upcomingPass.maxEl}°</strong>
                </span>
              </div>
              {passCountdown && (
                <div className="iss-pass-countdown">Pass in <strong>{passCountdown}</strong></div>
              )}
              {onOpenSettings && (
                <button className="iss-reminder-btn" onClick={onOpenSettings}>🔔 Set a reminder</button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── WORLD MAP + VIDEO ── */}
      {issLat != null && issLon != null && (
        <div className="iss-world-map">
          <ISSWorldMap
            issLat={issLat} issLon={issLon}
            userLat={location.lat} userLon={location.lon}
            track={track}
          />
          <div className="iss-video-wrap">
            <a href="https://www.youtube.com/watch?v=_tPnFNaM-LQ" target="_blank" rel="noopener noreferrer"
              className="iss-video-btn">
              📺 Watch live Earth view from ISS
            </a>
            {region && (
              <div className="iss-video-note">
                NASA streams live HD video 24/7 — currently over {region}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PASS TIMELINE ── */}
      {!loading && (
        <div className="iss-timeline-section">
          <ISSPassTimeline passes={passes} />
        </div>
      )}

      {/* ── BODY: telemetry + crew ── */}
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

        {/* Collapsible crew with flags */}
        {!loading && info && info.crewCount > 0 && (
          <div className="iss-crew-collapsible">
            <button className="iss-crew-toggle" onClick={() => setCrewExpanded(x => !x)}>
              {info.crewCount} aboard — {crewExpanded ? 'hide crew' : 'show crew'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: crewExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {crewExpanded && (
              <div className="iss-crew-section">
                <div className="iss-crew-list">
                  {info.crew.map(name => (
                    <div key={name} className="iss-crew-member">
                      <CrewAvatar name={name} />
                      <span className="iss-crew-name">{getFlag(name)} {name}</span>
                    </div>
                  ))}
                </div>
                <div className="iss-crew-attribution">Crew data via Open Notify API</div>
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

      {/* ── FACTS TICKER ── */}
      <ISSFactsTicker />
    </div>
  );
}
