import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Satellite } from '../types';
import type { LocationSettings } from '../hooks/useLocation';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Fix Leaflet default icon path in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl;

// ISS marker — pulsing orange dot via CSS
const ISS_ICON = L.divIcon({
  className: 'iss-map-icon',
  html: '<div class="iss-marker-outer"><div class="iss-marker-inner"></div></div>',
  iconSize:   [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -18],
});

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

interface TrackPt { lat: number; lon: number; }

interface Props {
  satellites:        Satellite[];
  location:          LocationSettings;
  onSelectSatellite: (sat: Satellite) => void;
  onOpenSkyMap?:     () => void;
  onOpenSettings?:   () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ISS_FACTS = [
  'The ISS travels at 28,000 km/h, completing an orbit every 92 minutes',
  'It has been continuously inhabited since November 2000 — over 24 years',
  'The station is 109 metres wide and 73 metres long — the size of a football pitch',
  'Astronauts aboard experience 16 sunrises and 16 sunsets every day',
  'The ISS orbits at approximately 420 km above Earth\'s surface',
  'Its total mass is around 420,000 kg — heavier than 300 cars',
  'The ISS is the single largest structure humans have ever placed in orbit',
  'Crew members exercise for 2 hours daily to prevent muscle and bone deterioration',
];

const CREW_FLAGS: Record<string, string> = {
  Kononenko: '🇷🇺', Chub: '🇷🇺', Grebenkin: '🇷🇺',
  Dyson:     '🇺🇸', Dominick: '🇺🇸', Barratt: '🇺🇸',
  Epps:      '🇺🇸', Wilmore: '🇺🇸', Williams: '🇺🇸',
  Pettit:    '🇺🇸', Rubio: '🇺🇸', Mann: '🇺🇸', Cassada: '🇺🇸',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getFlag(name: string): string {
  for (const [surname, flag] of Object.entries(CREW_FLAGS)) {
    if (name.includes(surname)) return flag;
  }
  return '🌍';
}

function splitAtDateline(pts: TrackPt[]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && Math.abs(pts[i].lon - pts[i - 1].lon) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push([pts[i].lat, pts[i].lon]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
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

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ISSLeafletMap({ issLat, issLon, userLat, userLon, altKm, speedKmS, past, future }: {
  issLat:   number; issLon:   number;
  userLat:  number; userLon:  number;
  altKm:    number | null;
  speedKmS: number | null;
  past:     TrackPt[];
  future:   TrackPt[];
}) {
  const pastSegs   = splitAtDateline(past);
  const futureSegs = splitAtDateline(future);

  return (
    <MapContainer
      center={[issLat, issLon]}
      zoom={2}
      style={{ height: '280px', width: '100%' }}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      <RecenterMap lat={issLat} lon={issLon} />

      {/* Past 5 min — faded dashed */}
      {pastSegs.map((seg, i) => (
        <Polyline key={`p${i}`} positions={seg}
          color="rgba(255,140,0,0.35)" weight={2} dashArray="4,5" />
      ))}

      {/* Future 20 min — solid */}
      {futureSegs.map((seg, i) => (
        <Polyline key={`f${i}`} positions={seg}
          color="#ff8c00" weight={2.5} opacity={0.85} />
      ))}

      {/* User location */}
      <Circle center={[userLat, userLon]} radius={150000}
        color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={1.5} />

      {/* ISS */}
      <Marker position={[issLat, issLon]} icon={ISS_ICON}>
        <Popup closeButton={false} className="iss-map-popup">
          <div className="iss-popup-title">ISS</div>
          {altKm    != null && <div className="iss-popup-row">Alt: {altKm} km</div>}
          {speedKmS != null && <div className="iss-popup-row">Speed: {speedKmS} km/s</div>}
        </Popup>
      </Marker>
    </MapContainer>
  );
}

function ISSPassTimeline({ passes }: { passes: NextPass[] }) {
  const now     = Math.floor(Date.now() / 1000);
  const span24h = 24 * 3600;
  const W       = 1000;
  const best    = passes.length > 0
    ? passes.reduce((a, b) => b.maxEl > a.maxEl ? b : a, passes[0])
    : null;

  return (
    <div className="iss-timeline-wrap">
      <svg viewBox={`0 0 ${W} 34`} width="100%" preserveAspectRatio="none">
        <rect width={W} height={34} fill="var(--bg-tertiary)" rx="3" />
        {([0, 6, 12, 18, 24] as number[]).map(h => {
          const x = (h / 24) * W;
          return (
            <g key={h}>
              <line x1={x} y1={0} x2={x} y2={34} stroke="var(--border)" strokeWidth="1" />
              <text x={x + 5} y={30} fontSize="20" fill="var(--text-tertiary)">{h}h</text>
            </g>
          );
        })}
        {passes.map((p, i) => {
          const sf = Math.max(0, (p.startUTC - now) / span24h);
          const ef = Math.min(1, (p.endUTC   - now) / span24h);
          if (sf >= 1 || ef <= 0) return null;
          const color = p.maxEl >= 40 ? '#22c55e' : p.maxEl >= 20 ? '#f59e0b' : '#6b7280';
          return (
            <rect key={i} x={sf * W} y={4} width={Math.max(6, (ef - sf) * W)} height={20}
              fill={color} rx="2" opacity="0.88">
              <title>{formatBST(p.startUTC)} BST · max {p.maxEl}° · {Math.round(p.duration / 60)} min</title>
            </rect>
          );
        })}
        <polygon points="0,0 10,0 0,10" fill="rgba(255,255,255,0.65)" />
      </svg>
      <div className="iss-timeline-meta">
        {passes.length === 0 ? (
          <span>No passes in the next 24 hours</span>
        ) : (
          <>
            <span>
              {passes.length} pass{passes.length !== 1 ? 'es' : ''} in 24 h
              {best && <> · best {formatBST(best.startUTC)} BST ({best.maxEl}°)</>}
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
  const [pastTrack,    setPastTrack]    = useState<TrackPt[]>([]);
  const [futureTrack,  setFutureTrack]  = useState<TrackPt[]>([]);
  const [crewExpanded, setCrewExpanded] = useState(false);

  const issTle    = satellites.find(s =>
    s.satname.toUpperCase().includes('ISS') ||
    s.satname.toUpperCase().includes('ZARYA'),
  );
  const isOverhead = !!issTle;

  const nowSecs      = Math.floor(Date.now() / 1000);
  const passes       = info?.nextPasses ?? [];
  const currentPass  = passes.find(p => p.startUTC <= nowSecs && p.endUTC > nowSecs) ?? null;
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
        if (r.ok) {
          const d = await r.json();
          setPastTrack(d.past   ?? []);
          setFutureTrack(d.future ?? []);
        }
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
            <span>ISS IS OVERHEAD NOW</span>
          </div>
          <div className="iss-overhead-meta">
            {peakEl != null && <span>Peaking at <strong>{peakEl}°</strong> elevation</span>}
            {direction && <span> — <strong>{direction}</strong></span>}
            {approxMins != null && approxMins > 0 && (
              <span> · approx. <strong>{approxMins} min</strong> visible</span>
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
                Look <strong>{direction}</strong> at <strong>{Math.round(issTle.elevation)}°</strong> elevation —{' '}
                {elevationHint(issTle.elevation)}.
              </p>
              <p className="iss-overhead-tip">
                The ISS appears as a bright, steadily moving point of light. No telescope required.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="iss-banner">
            {info?.nasaImageUrl ? (
              <img
                src={info.nasaImageUrl}
                alt="International Space Station exterior"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div className="iss-photo-placeholder">ISS photo unavailable</div>
            )}
            {info?.nasaImageTitle && (
              <div className="iss-photo-credit">Credit: {info.nasaImageTitle}</div>
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
                <button className="iss-reminder-btn" onClick={onOpenSettings}>
                  🔔 Set a reminder
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LIVE TELEMETRY ── */}
      <div className="iss-sec-header">Live Telemetry</div>
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
      </div>

      {/* ── GROUND TRACK ── */}
      <div className="iss-sec-header">Ground Track</div>
      <div className="iss-map-wrap">
        {issLat != null && issLon != null ? (
          <ISSLeafletMap
            issLat={issLat} issLon={issLon}
            userLat={location.lat} userLon={location.lon}
            altKm={info?.altitudeKm ?? null}
            speedKmS={info?.speedKmS ?? null}
            past={pastTrack} future={futureTrack}
          />
        ) : (
          <div className="iss-map-placeholder">Acquiring ISS position…</div>
        )}
      </div>

      {/* ── LIVE FROM THE ISS ── */}
      <div className="iss-sec-header">Live from the ISS</div>
      <div className="iss-live-section">
        <div className="iss-live-cards">
          {([
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="7" width="20" height="14" rx="1"/><polyline points="17 2 12 7 7 2"/>
                </svg>
              ),
              title:    'NASA+',
              subtitle: 'Official NASA streaming — free, no ads',
              note:     'Covers ISS events, spacewalks and launches live',
              href:     'https://plus.nasa.gov',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              ),
              title:    'Sen.com 4K',
              subtitle: 'Commercial 4K camera mounted on the ISS',
              note:     'Ultra HD Earth views when feed is active',
              href:     'https://sen.com',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              ),
              title:    'NASA on YouTube',
              subtitle: 'Live streams of ISS events and spacewalks',
              note:     'Subscribe for live event notifications',
              href:     'https://www.youtube.com/@NASA',
            },
          ] as const).map(card => (
            <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer"
              className="iss-live-card">
              <div className="iss-live-card-icon">{card.icon}</div>
              <div className="iss-live-card-title">{card.title}</div>
              <div className="iss-live-card-subtitle">{card.subtitle}</div>
              <div className="iss-live-card-note">{card.note}</div>
              <span className="iss-live-card-open">Open ↗</span>
            </a>
          ))}
        </div>
        <div className="iss-live-disclaimer">
          The original NASA HDEV exterior camera experiment ended in 2019.
          Live exterior feeds are now available intermittently via Sen.com
          and during scheduled NASA events.
        </div>
      </div>

      {/* ── VISIBILITY WINDOW ── */}
      <div className="iss-sec-header">Visibility Window</div>
      <div className="iss-timeline-section">
        {!loading && <ISSPassTimeline passes={passes} />}
      </div>

      {/* ── CREW ── */}
      {!loading && info && info.crewCount > 0 && (
        <>
          <div className="iss-sec-header">Crew</div>
          <div className="iss-body">
            <div className="iss-crew-collapsible">
              <button className="iss-crew-toggle" onClick={() => setCrewExpanded(x => !x)}>
                {info.crewCount} aboard — {crewExpanded ? 'hide' : 'show'}
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
          </div>
        </>
      )}

      {/* ── TRACK BUTTON ── */}
      <div className="iss-body">
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
