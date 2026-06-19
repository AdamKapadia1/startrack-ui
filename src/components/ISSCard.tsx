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
  iconSize:    [28, 28],
  iconAnchor:  [14, 14],
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

interface PassDetail {
  startUTC:      number;
  maxUTC:        number;
  endUTC:        number;
  maxEl:         number;
  duration:      number;
  startAz:       number | null;
  maxAz:         number | null;
  endAz:         number | null;
  startRangeKm:  number | null;
  maxRangeKm:    number | null;
  endRangeKm:    number | null;
  aosDopplerKhz:  number;
  peakDopplerKhz: number;
  losDopplerKhz:  number;
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
  // Keplerian elements
  inclinationDeg:   number;
  raanDeg:          number;
  eccentricity:     number;
  argPerigeeDeg:    number;
  meanAnomalyDeg:   number;
  meanMotionRevDay: number;
  bstar:            number;
  elementSet:       number;
  revNumber:        number;
  smaKm:            number | null;
  apogeeKm:         number | null;
  perigeeKm:        number | null;
  periodMin:        number | null;
  // ECI state vector
  eciPosX: number; eciPosY: number; eciPosZ: number;
  eciVelX: number; eciVelY: number; eciVelZ: number;
  // Solar
  solarStatus:          'SUNLIT' | 'ECLIPSE';
  timeToTransitionSecs: number | null;
  betaAngleDeg:         number;
  // TLE metadata
  tleEpochUTC:  string;
  tleAgeHours:  number;
  tleLine1:     string;
  tleLine2:     string;
  // Enhanced passes
  passDetails: PassDetail[];
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

function formatSecsHuman(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
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
      {pastSegs.map((seg, i) => (
        <Polyline key={`p${i}`} positions={seg}
          color="rgba(255,140,0,0.35)" weight={2} dashArray="4,5" />
      ))}
      {futureSegs.map((seg, i) => (
        <Polyline key={`f${i}`} positions={seg}
          color="#ff8c00" weight={2.5} opacity={0.85} />
      ))}
      <Circle center={[userLat, userLon]} radius={150000}
        color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={1.5} />
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

// ── Section 1 — Keplerian Elements ────────────────────────────────────────────

function OrbEl({ label, value }: { label: string; value: string }) {
  return (
    <div className="iss-orbital-row">
      <span className="iss-el-label">{label}</span>
      <span className="iss-el-value">{value}</span>
    </div>
  );
}

function ISSKeplerianSection({ info }: { info: ISSInfo }) {
  const epochStr = info.tleEpochUTC
    ? new Date(info.tleEpochUTC).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : '—';

  return (
    <div className="iss-orbital-section">
      <div className="iss-orbital-grid">
        <div className="iss-orbital-col">
          <OrbEl label="NORAD ID"       value="25544" />
          <OrbEl label="INCLINATION"    value={`${info.inclinationDeg.toFixed(4)}°`} />
          <OrbEl label="RAAN"           value={`${info.raanDeg.toFixed(4)}°`} />
          <OrbEl label="ECCENTRICITY"   value={info.eccentricity.toFixed(7)} />
          <OrbEl label="ARG PERIGEE"    value={`${info.argPerigeeDeg.toFixed(4)}°`} />
          <OrbEl label="MEAN ANOMALY"   value={`${info.meanAnomalyDeg.toFixed(4)}°`} />
          <OrbEl label="MEAN MOTION"    value={`${info.meanMotionRevDay.toFixed(8)} rev/day`} />
        </div>
        <div className="iss-orbital-col">
          <OrbEl label="EPOCH"          value={epochStr} />
          <OrbEl label="SEMI-MAJOR AXIS" value={info.smaKm    != null ? `${info.smaKm!.toFixed(3)} km`    : '—'} />
          <OrbEl label="APOLUNE"        value={info.apogeeKm  != null ? `${info.apogeeKm!.toFixed(1)} km`  : '—'} />
          <OrbEl label="PERILUNE"       value={info.perigeeKm != null ? `${info.perigeeKm!.toFixed(1)} km` : '—'} />
          <OrbEl label="PERIOD"         value={info.periodMin  != null ? `${info.periodMin!.toFixed(4)} min` : '—'} />
          <OrbEl label="SPEED"          value={info.speedKmS != null ? `${info.speedKmS.toFixed(3)} km/s` : '—'} />
          <OrbEl label="B* DRAG"        value={info.bstar !== 0 ? info.bstar.toExponential(4) : '—'} />
        </div>
      </div>
      <div className="iss-orbital-source">
        Element set {info.elementSet || '—'} · Rev {info.revNumber ? info.revNumber.toLocaleString() : '—'} · CelesTrak / NORAD 25544
      </div>
    </div>
  );
}

// ── Section 2 — State Vector ──────────────────────────────────────────────────

function ISSStateVectorSection({ info }: { info: ISSInfo }) {
  const latStr = info.currentLat != null ? `${info.currentLat.toFixed(2)}°` : '—';
  const lonStr = info.currentLon != null ? `${info.currentLon.toFixed(2)}°` : '—';
  const altStr = info.altitudeKm != null ? `${info.altitudeKm.toFixed(0)} km` : '—';

  return (
    <div className="iss-sv-section">
      <div className="iss-sv-groups">
        <div className="iss-sv-group">
          <div className="iss-sv-group-label">POSITION ECI (km)</div>
          <div className="iss-sv-row"><span className="iss-sv-key">X</span><span className="iss-sv-val">{info.eciPosX.toFixed(1)}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">Y</span><span className="iss-sv-val">{info.eciPosY.toFixed(1)}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">Z</span><span className="iss-sv-val">{info.eciPosZ.toFixed(1)}</span></div>
        </div>
        <div className="iss-sv-group">
          <div className="iss-sv-group-label">VELOCITY ECI (km/s)</div>
          <div className="iss-sv-row"><span className="iss-sv-key">Vx</span><span className="iss-sv-val">{info.eciVelX.toFixed(4)}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">Vy</span><span className="iss-sv-val">{info.eciVelY.toFixed(4)}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">Vz</span><span className="iss-sv-val">{info.eciVelZ.toFixed(4)}</span></div>
        </div>
        <div className="iss-sv-group">
          <div className="iss-sv-group-label">GEODETIC (WGS-84)</div>
          <div className="iss-sv-row"><span className="iss-sv-key">LAT</span><span className="iss-sv-val">{latStr}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">LON</span><span className="iss-sv-val">{lonStr}</span></div>
          <div className="iss-sv-row"><span className="iss-sv-key">ALT</span><span className="iss-sv-val">{altStr}</span></div>
        </div>
      </div>
      <div className="iss-sv-epoch">Epoch: J2000 ECI · Updated every 10 s</div>
    </div>
  );
}

// ── Section 3 — Pass Geometry Table ──────────────────────────────────────────

function ISSPassGeometrySection({ passDetails }: { passDetails: PassDetail[] }) {
  if (passDetails.length === 0) {
    return (
      <div className="iss-body">
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
          No upcoming passes — observer location required
        </span>
      </div>
    );
  }

  const bestEl = Math.max(...passDetails.map(p => p.maxEl));

  return (
    <div className="iss-pass-geo-wrap">
      <div className="iss-pass-geo-scroll">
        <table className="iss-pass-geo-table">
          <thead>
            <tr>
              <th>#</th>
              <th>AOS BST</th>
              <th>AOS AZ</th>
              <th>MAX EL</th>
              <th>PEAK BST</th>
              <th>LOS BST</th>
              <th>LOS AZ</th>
              <th>DUR</th>
              <th>MAX RANGE</th>
            </tr>
          </thead>
          <tbody>
            {passDetails.map((p, i) => (
              <tr key={i} className={p.maxEl === bestEl ? 'iss-pass-best-row' : ''}>
                <td>{i + 1}</td>
                <td className="iss-pass-time">{formatBST(p.startUTC)}</td>
                <td>{p.startAz != null ? `${p.startAz}°` : '—'}</td>
                <td className="iss-pass-el">{p.maxEl}°</td>
                <td className="iss-pass-time">{formatBST(p.maxUTC)}</td>
                <td className="iss-pass-time">{formatBST(p.endUTC)}</td>
                <td>{p.endAz != null ? `${p.endAz}°` : '—'}</td>
                <td>{Math.round(p.duration / 60)} min</td>
                <td>{p.maxRangeKm != null ? `${p.maxRangeKm.toLocaleString()} km` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="iss-pass-geo-note">
        Times BST · Green row = best pass · Min elevation 5°
      </div>
    </div>
  );
}

// ── Section 4 — Solar Status + Beta Angle ────────────────────────────────────

function ISSSolarBetaSection({ info }: { info: ISSInfo }) {
  const beta        = info.betaAngleDeg ?? 0;
  const clamped     = Math.max(-90, Math.min(90, beta));
  const angleRad    = (90 - clamped) * (Math.PI / 180);
  const R           = 42;
  const nx          = R * Math.cos(angleRad);
  const ny          = -R * Math.sin(angleRad);
  const absBeta     = Math.abs(beta);
  const betaClass   = absBeta > 70 ? 'iss-beta-high' : absBeta > 40 ? 'iss-beta-mid' : 'iss-beta-low';
  const sunlit      = info.solarStatus === 'SUNLIT';

  return (
    <div className="iss-solar-section">
      <div className="iss-beta-panel">
        <div className="iss-beta-label">BETA ANGLE</div>
        <svg viewBox="-60 -55 120 70" className="iss-beta-svg">
          {/* Background arc */}
          <path d="M -42 0 A 42 42 0 0 1 42 0" fill="none" stroke="var(--border)" strokeWidth="7" strokeLinecap="round" />
          {/* Green zone (low beta, |β|<40°) */}
          <path d="M -42 0 A 42 42 0 0 1 42 0" fill="none" stroke="#22c55e" strokeWidth="7"
            strokeLinecap="round" strokeDasharray="44 88" strokeDashoffset="22" opacity="0.25" />
          {/* Tick marks */}
          {[-90, -45, 0, 45, 90].map(deg => {
            const rad = (90 - deg) * Math.PI / 180;
            const x1  = 38 * Math.cos(rad), y1 = -38 * Math.sin(rad);
            const x2  = 46 * Math.cos(rad), y2 = -46 * Math.sin(rad);
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="1.5" />;
          })}
          {/* Labels */}
          <text x="-56" y="14" fontSize="8" fill="var(--text-tertiary)" textAnchor="middle">−90°</text>
          <text x="56"  y="14" fontSize="8" fill="var(--text-tertiary)" textAnchor="middle">+90°</text>
          <text x="0"   y="-49" fontSize="8" fill="var(--text-tertiary)" textAnchor="middle">0°</text>
          {/* Needle */}
          <line x1="0" y1="0" x2={nx.toFixed(1)} y2={ny.toFixed(1)}
            stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="3.5" fill="var(--accent)" />
          <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="3" fill="var(--accent)" />
        </svg>
        <div className={`iss-beta-value ${betaClass}`}>{beta.toFixed(2)}°</div>
        <div className="iss-beta-sub">
          {absBeta > 70 ? 'High beta — prolonged solar exposure'
            : absBeta > 40 ? 'Mid beta — partial eclipse cycles'
            : 'Low beta — standard eclipse cycles'}
        </div>
      </div>

      <div className="iss-illumination-panel">
        <div className="iss-illumination-label">SOLAR ILLUMINATION</div>
        <div className={`iss-solar-badge ${sunlit ? 'iss-solar-sunlit' : 'iss-solar-eclipse'}`}>
          {sunlit ? 'SUNLIT' : 'ECLIPSE'}
        </div>
        {info.timeToTransitionSecs != null && (
          <div className="iss-solar-transition">
            Next {sunlit ? 'eclipse' : 'sunlit'} in {formatSecsHuman(info.timeToTransitionSecs)}
          </div>
        )}
        <div className="iss-solar-desc">
          {sunlit
            ? 'ISS is in direct sunlight. Solar arrays generating full power.'
            : "ISS is in Earth's shadow. Operating on battery reserves."}
        </div>
      </div>
    </div>
  );
}

// ── Section 5 — Amateur Radio Frequencies ────────────────────────────────────

function ISSRadioSection({ passDetails }: { passDetails: PassDetail[] }) {
  const first = passDetails[0] ?? null;

  const formatFreq = (dkHz: number) => {
    const mhz = 145.800 + dkHz / 1000;
    return `${mhz.toFixed(3)} MHz`;
  };

  const signFmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' kHz';

  return (
    <div className="iss-radio-section">
      <div className="iss-radio-ref-grid">
        <div className="iss-radio-ref-row">
          <span className="iss-radio-key">VHF VOICE DOWN</span>
          <span className="iss-radio-val">145.800 MHz</span>
        </div>
        <div className="iss-radio-ref-row">
          <span className="iss-radio-key">VHF APRS DOWN</span>
          <span className="iss-radio-val">145.825 MHz</span>
        </div>
        <div className="iss-radio-ref-row">
          <span className="iss-radio-key">UHF VOICE UP</span>
          <span className="iss-radio-val">437.550 MHz</span>
        </div>
        <div className="iss-radio-ref-row">
          <span className="iss-radio-key">PACKET MODE</span>
          <span className="iss-radio-val">1200 baud AFSK</span>
        </div>
      </div>

      {first ? (
        <>
          <div className="iss-radio-doppler-header">
            DOPPLER — NEXT PASS (145.800 MHz DOWNLINK)
          </div>
          <div className="iss-radio-doppler-cells">
            {([
              { phase: 'AOS',  shift: first.aosDopplerKhz  },
              { phase: 'PEAK', shift: first.peakDopplerKhz },
              { phase: 'LOS',  shift: first.losDopplerKhz  },
            ] as const).map(({ phase, shift }) => (
              <div key={phase} className="iss-radio-doppler-cell">
                <div className="iss-radio-doppler-phase">{phase}</div>
                <div className="iss-radio-doppler-shift">{signFmt(shift as number)}</div>
                <div className="iss-radio-doppler-recv">{formatFreq(shift as number)}</div>
              </div>
            ))}
          </div>
          <div className="iss-radio-note">
            Tune from high to low frequency throughout the pass. Doppler shift ≈ ±3.4 kHz at AOS/LOS.
          </div>
        </>
      ) : (
        <div className="iss-radio-no-pass">Pass data unavailable — location required</div>
      )}
    </div>
  );
}

// ── Section 6 — TLE Quality Indicator ────────────────────────────────────────

function ISSTLEQualitySection({ info }: { info: ISSInfo }) {
  const age   = info.tleAgeHours ?? 0;
  const pct   = age < 6 ? 100 : age < 12 ? 88 : age < 24 ? 70 : age < 48 ? 45 : 15;
  const label = age < 6 ? 'EXCELLENT' : age < 12 ? 'GOOD' : age < 24 ? 'FAIR' : age < 48 ? 'CAUTION' : 'STALE';
  const cls   = age < 6 ? 'qual-ex' : age < 12 ? 'qual-gd' : age < 24 ? 'qual-fa' : 'qual-ca';

  const fmtAge = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 24) return `${h.toFixed(1)} h`;
    return `${(h / 24).toFixed(1)} days`;
  };

  const fmtEpoch = (iso: string) =>
    iso
      ? new Date(iso).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        }) + ' UTC'
      : '—';

  return (
    <div className="iss-tle-quality-section">
      <div className="iss-tle-meta-grid">
        <div className="iss-tle-meta-row">
          <span className="iss-tle-meta-label">TLE AGE</span>
          <span className="iss-tle-meta-value">{age > 0 ? fmtAge(age) : '—'}</span>
        </div>
        <div className="iss-tle-meta-row">
          <span className="iss-tle-meta-label">ELEMENT SET</span>
          <span className="iss-tle-meta-value">{info.elementSet || '—'}</span>
        </div>
        <div className="iss-tle-meta-row">
          <span className="iss-tle-meta-label">EPOCH</span>
          <span className="iss-tle-meta-value">{fmtEpoch(info.tleEpochUTC)}</span>
        </div>
        <div className="iss-tle-meta-row">
          <span className="iss-tle-meta-label">REVOLUTION No.</span>
          <span className="iss-tle-meta-value">{info.revNumber ? info.revNumber.toLocaleString() : '—'}</span>
        </div>
      </div>
      <div className="iss-confidence-row">
        <span className="iss-confidence-label">ACCURACY</span>
        <div className="iss-confidence-track">
          <div className={`iss-confidence-fill ${cls}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`iss-confidence-badge ${cls}`}>{label}</span>
      </div>
      <div className="iss-tle-source">TLE source: CelesTrak · Refreshed every 6 h · NORAD 25544</div>
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

  const hasOrbitalData = info && info.inclinationDeg > 0;

  return (
    <div className="iss-card">

      {/* ── TOP: overhead alert OR photo + next pass ── */}
      {isOverhead ? (
        <div className="iss-overhead-alert">
          <div className="iss-overhead-header"><span>ISS IS OVERHEAD NOW</span></div>
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
                  Set a reminder
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SECTION 1: ORBITAL MECHANICS PANEL ── */}
      <div className="iss-sec-header">Orbital Mechanics</div>
      {!loading && hasOrbitalData ? (
        <ISSKeplerianSection info={info!} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {loading ? 'Loading orbital data…' : 'Orbital data unavailable'}
        </div>
      )}

      {/* ── SECTION 2: STATE VECTOR ── */}
      <div className="iss-sec-header">Positional State Vector</div>
      {!loading && hasOrbitalData ? (
        <ISSStateVectorSection info={info!} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {loading ? 'Acquiring state vector…' : '—'}
        </div>
      )}

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
              title: 'NASA+', subtitle: 'Official NASA streaming — free, no ads',
              note: 'Covers ISS events, spacewalks and launches live', href: 'https://plus.nasa.gov',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              ),
              title: 'Sen.com 4K', subtitle: 'Commercial 4K camera mounted on the ISS',
              note: 'Ultra HD Earth views when feed is active', href: 'https://sen.com',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              ),
              title: 'NASA on YouTube', subtitle: 'Live streams of ISS events and spacewalks',
              note: 'Subscribe for live event notifications', href: 'https://www.youtube.com/@NASA',
            },
          ] as const).map(card => (
            <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer" className="iss-live-card">
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
          Live exterior feeds are now available intermittently via Sen.com and during scheduled NASA events.
        </div>
      </div>

      {/* ── VISIBILITY WINDOW ── */}
      <div className="iss-sec-header">Visibility Window</div>
      <div className="iss-timeline-section">
        {!loading && <ISSPassTimeline passes={passes} />}
      </div>

      {/* ── SECTION 3: PASS GEOMETRY TABLE ── */}
      <div className="iss-sec-header">Pass Geometry</div>
      {!loading ? (
        <ISSPassGeometrySection passDetails={info?.passDetails ?? []} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>Computing passes…</div>
      )}

      {/* ── SECTION 4: SOLAR + BETA ANGLE ── */}
      <div className="iss-sec-header">Solar Status &amp; Beta Angle</div>
      {!loading && hasOrbitalData ? (
        <ISSSolarBetaSection info={info!} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {loading ? 'Computing solar geometry…' : '—'}
        </div>
      )}

      {/* ── SECTION 5: AMATEUR RADIO ── */}
      <div className="iss-sec-header">ARISS Amateur Radio</div>
      {!loading ? (
        <ISSRadioSection passDetails={info?.passDetails ?? []} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>Loading…</div>
      )}

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

      {/* ── SECTION 6: TLE QUALITY ── */}
      <div className="iss-sec-header">TLE Quality Indicator</div>
      {!loading && hasOrbitalData ? (
        <ISSTLEQualitySection info={info!} />
      ) : (
        <div className="iss-body" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {loading ? 'Loading…' : '—'}
        </div>
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
