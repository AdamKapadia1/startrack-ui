import { useState, useEffect } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import type { Satellite, SatellitePosition } from '../types';
import type { LocationSettings } from '../hooks/useLocation';
import { getConstellation, CONSTELLATION_COLORS } from '../utils/constellation';
import { PassShare } from './PassShare';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const D2R      = Math.PI / 180;

// Mini sky map constants (200×200 viewBox)
const CX = 100, CY = 100, R = 82;

// ── Types ──────────────────────────────────────────────────────────────────────
interface TleData {
  name:         string;
  noradId:      number;
  epoch:        string;
  inclination:  number;
  raan:         number;
  eccentricity: number;
  period:       number;
  meanAltitude: number;
}

export interface SatPass {
  satname:  string;
  startUTC: number;
  maxUTC:   number;
  endUTC:   number;
  maxEl:    number;
  duration: number;
  score:    number;
}

interface Props {
  satellite:     Satellite | null;
  allSatellites: Satellite[];
  positions:     SatellitePosition[];
  location:      LocationSettings;
  onClose:       () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toXY(az: number, el: number) {
  const r   = ((90 - el) / 90) * R;
  const rad = az * D2R;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function formatBST(utc: number): string {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function formatDateBST(utc: number): string {
  return new Date(utc * 1000).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London',
  });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function qualityInfo(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: '#00d4ff' };
  if (score >= 70) return { label: 'Good',      color: '#00d4ff' };
  if (score >= 50) return { label: 'Fair',       color: '#ffb800' };
  return              { label: 'Poor',       color: '#4a6080' };
}

function downloadICS(pass: SatPass, satname: string) {
  const start = new Date(pass.startUTC * 1000);
  const end   = new Date(pass.endUTC   * 1000);
  const pad   = (n: number) => n.toString().padStart(2, '0');
  const fmt   = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${satname}: ${Math.round(pass.maxEl)}° pass`,
    `DESCRIPTION:Signal score: ${pass.score}/100. Duration: ${formatDuration(pass.duration)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${satname.replace(/\s+/g, '-')}.ics`; a.click();
  URL.revokeObjectURL(url);
}

// ── Section 1: Mini sky map ────────────────────────────────────────────────────
function MiniSkyMap({ sat, pos }: { sat: Satellite; pos: SatellitePosition | undefined }) {
  const el    = pos?.elevation ?? sat.elevation;
  const az    = pos?.azimuth   ?? sat.azimuth;
  const { x, y } = toXY(az, el);
  const color = CONSTELLATION_COLORS[getConstellation(sat.satname)] ?? '#00d4ff';
  const isIss = getConstellation(sat.satname) === 'ISS';
  const dotR  = isIss ? 8 : 5;

  return (
    <div className="mini-skymap-wrap">
      <svg viewBox="0 0 200 200" className="mini-skymap-svg">
        <defs>
          <radialGradient id="sdMiniBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#0d2318"/>
            <stop offset="100%" stopColor="#060f0b"/>
          </radialGradient>
          <filter id="sdMiniGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="url(#sdMiniBg)" stroke="rgba(0,212,255,0.2)" strokeWidth="1"/>
        {[30, 60].map(e => (
          <circle key={e} cx={CX} cy={CY} r={((90 - e) / 90) * R}
            fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="0.75" strokeDasharray="3 3"
          />
        ))}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(0,212,255,0.08)" strokeWidth="0.5"/>
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(0,212,255,0.08)" strokeWidth="0.5"/>
        {(['N', 'S', 'E', 'W'] as const).map((d, i) => {
          const px = [CX, CX, CX + R + 8, CX - R - 8][i];
          const py = [CY - R - 6, CY + R + 13, CY + 3, CY + 3][i];
          return <text key={d} x={px} y={py} textAnchor="middle" fill="#2a4038" fontSize="8" fontFamily="monospace">{d}</text>;
        })}
        {/* Observer */}
        <circle cx={CX} cy={CY} r="3" fill="#3b82f6" opacity="0.9"/>
        {/* Satellite */}
        <circle cx={x} cy={y} r={dotR + 4} fill="transparent"/>
        <circle cx={x} cy={y} r={dotR + 2} fill={color} opacity="0.15" filter="url(#sdMiniGlow)"/>
        <circle cx={x} cy={y} r={dotR}     fill={color} opacity="0.95" filter="url(#sdMiniGlow)"/>
        {/* Label */}
        <text x={x < CX ? x + 9 : x - 9} y={y - 7}
          textAnchor={x < CX ? 'start' : 'end'}
          fill="rgba(122,145,135,0.9)" fontSize="7" fontFamily="monospace">
          {sat.satname.replace('STARLINK-', 'SL-').slice(0, 12)}
        </text>
      </svg>
      <div className="mini-skymap-pos">El: {el.toFixed(1)}° · Az: {az.toFixed(1)}°</div>
    </div>
  );
}

// ── Section 2: Live telemetry ──────────────────────────────────────────────────
function TelemetryGrid({ sat, pos }: { sat: Satellite; pos: SatellitePosition | undefined }) {
  const el    = pos?.elevation ?? sat.elevation;
  const range = pos?.range     ?? sat.range;
  const dHz   = sat.dopplerShiftHz;
  const dKHz  = sat.dopplerShiftKHz;
  const altKm = Math.round(range * Math.sin(el * D2R));

  const elColor = el >= 60 ? '#00d4ff' : el >= 30 ? '#ffb800' : '#4a6080';
  const dColor  = dHz === null ? '#4a6080' : dHz > 0 ? '#00d4ff' : dHz < 0 ? '#ff4444' : '#4a6080';
  const dLabel  = dHz === null ? '—'
    : dKHz === 0 ? '0 kHz'
    : `${dHz > 0 ? '+' : ''}${(dHz / 1000).toFixed(1)} kHz`;

  const cards: { label: string; value: string; color: string; span?: boolean }[] = [
    { label: 'Elevation',     value: `${el.toFixed(1)}°`,            color: elColor },
    { label: 'Range',         value: `${range.toLocaleString()} km`, color: '#9ca3af' },
    { label: 'Ku Doppler',    value: dLabel,                         color: dColor },
    { label: 'Est. Altitude', value: `~${altKm.toLocaleString()} km`, color: '#9ca3af' },
    { label: 'Orbital Speed', value: '~7.5 km/s',                    color: '#9ca3af', span: true },
  ];

  return (
    <div className="telemetry-grid">
      {cards.map(c => (
        <div key={c.label} className={`telemetry-card${c.span ? ' telemetry-card--span' : ''}`}>
          <div className="telemetry-label">{c.label}</div>
          <div className="telemetry-value" style={{ color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Section 3: Orbital elements ────────────────────────────────────────────────
const TIPS: Record<string, string> = {
  inclination:  'The tilt of the orbit relative to the equator',
  raan:         "The orbit's rotation around Earth's axis",
  eccentricity: 'How circular the orbit is (0 = perfect circle)',
  period:       'Time for one complete orbit',
  altitude:     "Average height above Earth's surface",
};

function OrbitalElements({ data, loading }: { data: TleData | null; loading: boolean }) {
  if (loading) return <div className="sd-loading">Loading orbital data…</div>;
  if (!data)   return <div className="sd-loading">No TLE data available for this satellite</div>;

  const epoch = new Date(data.epoch).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });

  const rows = [
    { label: 'NORAD ID',      value: data.noradId.toString(),                  tip: '' },
    { label: 'Inclination',   value: `${data.inclination.toFixed(3)}°`,         tip: TIPS.inclination },
    { label: 'RAAN',          value: `${data.raan.toFixed(3)}°`,                tip: TIPS.raan },
    { label: 'Eccentricity',  value: data.eccentricity.toFixed(7),              tip: TIPS.eccentricity },
    { label: 'Period',        value: `${data.period.toFixed(1)} min`,           tip: TIPS.period },
    { label: 'Mean Altitude', value: `${data.meanAltitude.toLocaleString()} km`, tip: TIPS.altitude },
    { label: 'TLE Epoch',     value: epoch,                                      tip: '' },
  ];

  return (
    <div className="orbital-table">
      {rows.map(r => (
        <div key={r.label} className="orbital-row">
          <span className="orbital-label">
            {r.label}
            {r.tip && <span className="orbital-tip" title={r.tip}>?</span>}
          </span>
          <span className="orbital-value">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section 4: Pass timeline ───────────────────────────────────────────────────
function PassTimeline({ passes, loading, satname, locationName }: { passes: SatPass[]; loading: boolean; satname: string; locationName: string }) {
  if (loading) return <div className="sd-loading">Calculating passes…</div>;
  if (!passes.length) return <div className="sd-loading">No passes found in the next 7 days</div>;

  return (
    <div className="pass-timeline">
      {passes.map(p => {
        const q       = qualityInfo(p.score);
        const elColor = p.maxEl >= 60 ? '#00d4ff' : p.maxEl >= 30 ? '#ffb800' : '#4a6080';
        return (
          <div key={p.startUTC} className="pass-item">
            <div className="pass-item-time">
              <span className="pass-item-date">{formatDateBST(p.startUTC)}</span>
              <span className="pass-item-times">{formatBST(p.startUTC)} → {formatBST(p.endUTC)}</span>
            </div>
            <div className="pass-item-stats">
              <span className="pass-item-el" style={{ color: elColor }}>{Math.round(p.maxEl)}°</span>
              <span className="pass-item-dur">{formatDuration(p.duration)}</span>
              <span className="pass-quality-badge" style={{ color: q.color, borderColor: `${q.color}55` }}>
                {q.label}
              </span>
              <button className="pass-cal-btn" onClick={() => downloadICS(p, satname)} title="Export to calendar">
                Cal
              </button>
              <PassShare
                startUTC={p.startUTC}
                maxEl={p.maxEl}
                satname={satname}
                locationName={locationName}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section 5: Elevation profile chart ────────────────────────────────────────
interface ArcPt { label: string; el: number }

function ElevationChart({ pass }: { pass: SatPass }) {
  const points = 28;
  const data: ArcPt[] = Array.from({ length: points }, (_, i) => {
    const frac = i / (points - 1);
    return {
      label: formatBST(pass.startUTC + frac * pass.duration),
      el:    parseFloat(Math.max(0, pass.maxEl * Math.sin(Math.PI * frac)).toFixed(1)),
    };
  });
  const yMax = Math.min(90, Math.ceil(pass.maxEl / 10) * 10 + 10);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 26, left: 28 }}>
        <defs>
          <linearGradient id="sdArcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#0d1520" vertical={false}/>
        <ReferenceLine y={10} stroke="#ffb800" strokeDasharray="4 3" strokeWidth={1}/>
        <XAxis dataKey="label"
          tick={{ fill: '#3a4f47', fontSize: 8, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#0d1520' }} tickLine={false}
          interval={Math.floor(points / 4) - 1}
          label={{ value: 'Time (BST)', position: 'insideBottom', fill: '#3a4f47', fontSize: 8, dy: 18 }}
        />
        <YAxis domain={[0, yMax]} tickFormatter={v => `${v}°`}
          tick={{ fill: '#3a4f47', fontSize: 8, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#0d1520' }} tickLine={false} width={26}
        />
        <Tooltip
          formatter={(v: unknown) => [`${Number(v).toFixed(1)}°`, 'Elevation']}
          contentStyle={{ background: '#0d1520', border: '1px solid #1a2d45', borderRadius: 6, fontSize: 10 }}
          labelStyle={{ color: '#6b7280' }}
        />
        <Area type="monotone" dataKey="el" stroke="#00d4ff" strokeWidth={2}
          fill="url(#sdArcGrad)" dot={false}
          activeDot={{ r: 4, fill: '#00d4ff', stroke: '#fff', strokeWidth: 1 }}
          animationDuration={800} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Section 6: Doppler profile chart ──────────────────────────────────────────
interface DopplerPt { label: string; d: number }

function DopplerChart({ pass }: { pass: SatPass }) {
  const maxD   = Math.round(15 + (pass.maxEl / 90) * 55); // kHz estimate based on elevation
  const points = 28;
  const peakLabel = formatBST(pass.maxUTC);

  const data: DopplerPt[] = Array.from({ length: points }, (_, i) => {
    const frac = i / (points - 1);
    return {
      label: formatBST(pass.startUTC + frac * pass.duration),
      d:     parseFloat((maxD * Math.cos(Math.PI * frac)).toFixed(1)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 26, left: 34 }}>
        <defs>
          <linearGradient id="sdDopplerGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#00d4ff"/>
            <stop offset="50%"  stopColor="#4a5568"/>
            <stop offset="100%" stopColor="#ff4444"/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#0d1520" vertical={false}/>
        <ReferenceLine y={0} stroke="#2d3748" strokeWidth={1}/>
        <ReferenceLine x={peakLabel} stroke="#00d4ff" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: 'Peak El', position: 'top', fill: '#00d4ff', fontSize: 8 }}
        />
        <XAxis dataKey="label"
          tick={{ fill: '#3a4f47', fontSize: 8, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#0d1520' }} tickLine={false}
          interval={Math.floor(points / 4) - 1}
          label={{ value: 'Time (BST)', position: 'insideBottom', fill: '#3a4f47', fontSize: 8, dy: 18 }}
        />
        <YAxis tickFormatter={v => `${v > 0 ? '+' : ''}${v}`}
          tick={{ fill: '#3a4f47', fontSize: 8, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#0d1520' }} tickLine={false} width={32}
          label={{ value: 'kHz', angle: -90, position: 'insideLeft', fill: '#3a4f47', fontSize: 8, dx: 4 }}
        />
        <Tooltip
          formatter={(v: unknown) => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n} kHz`, 'Doppler']; }}
          contentStyle={{ background: '#0d1520', border: '1px solid #1a2d45', borderRadius: 6, fontSize: 10 }}
          labelStyle={{ color: '#6b7280' }}
        />
        <Line type="monotone" dataKey="d"
          stroke="url(#sdDopplerGrad)" strokeWidth={2}
          dot={false} activeDot={{ r: 3, fill: '#fff', strokeWidth: 1 }}
          animationDuration={800} animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SatelliteDetail({ satellite, allSatellites, positions, location, onClose }: Props) {
  const [tleData,       setTleData]       = useState<TleData | null>(null);
  const [passes,        setPasses]        = useState<SatPass[]>([]);
  const [tleLoading,    setTleLoading]    = useState(false);
  const [passesLoading, setPassesLoading] = useState(false);

  const satname = satellite?.satname;

  useEffect(() => {
    if (!satname) return;
    setTleData(null); setPasses([]); setTleLoading(true); setPassesLoading(true);

    fetch(`${API_BASE}/api/satellites/tle?name=${encodeURIComponent(satname)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setTleData(d))
      .catch(() => setTleData(null))
      .finally(() => setTleLoading(false));

    const { lat, lon } = location;
    fetch(`${API_BASE}/api/satellites/passes?name=${encodeURIComponent(satname)}&lat=${lat}&lon=${lon}&alt=148`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPasses(Array.isArray(d) ? d : []))
      .catch(() => setPasses([]))
      .finally(() => setPassesLoading(false));
  }, [satname, location.lat, location.lon]);

  if (!satellite) return null;

  // Use freshest live data available
  const liveSat    = allSatellites.find(s => s.satname === satellite.satname) ?? satellite;
  const pos        = positions.find(p => p.satname === satellite.satname);
  const isOverhead = allSatellites.some(s => s.satname === satellite.satname);
  const c          = getConstellation(satellite.satname);
  const cColor     = CONSTELLATION_COLORS[c] ?? '#4a6080';
  const isDtc      = satellite.satname.includes('[DTC]');
  const nextPass   = passes[0];

  return (
    <>
      {/* Backdrop */}
      <div className="sat-detail-overlay" onClick={onClose}/>

      {/* Panel */}
      <div className="sat-detail-panel">

        {/* Header */}
        <div className="sat-detail-header">
          <div className="sat-detail-hdr-left">
            <div className="sat-detail-name">{satellite.satname}</div>
            <div className="sat-detail-badges">
              {c !== 'OTHER' && (
                <span className="sat-const-badge"
                  style={{ background: `${cColor}20`, border: `1px solid ${cColor}40`, color: cColor }}
                >
                  {c}
                </span>
              )}
              {isDtc && <span className="sat-dtc-badge">Direct-to-Cell</span>}
              <span className={`sat-status-badge${isOverhead ? ' sat-status-badge--live' : ''}`}>
                {isOverhead ? 'OVERHEAD NOW' : 'NOT VISIBLE'}
              </span>
            </div>
          </div>
          <div className="sat-detail-hdr-right">
            {nextPass && (
              <PassShare
                startUTC={nextPass.startUTC}
                maxEl={nextPass.maxEl}
                satname={satellite.satname}
                locationName={location.name}
                className="sat-detail-share"
              />
            )}
            <button className="sat-detail-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="sat-detail-content">

          {/* § 1 — Current Position */}
          {isOverhead && (
            <div className="sd-section">
              <div className="sd-section-title">Current Position</div>
              <MiniSkyMap sat={liveSat} pos={pos}/>
            </div>
          )}

          {/* § 2 — Live Telemetry */}
          <div className="sd-section">
            <div className="sd-section-title">Live Telemetry</div>
            <TelemetryGrid sat={liveSat} pos={pos}/>
          </div>

          {/* § 3 — Orbital Elements */}
          <div className="sd-section">
            <div className="sd-section-title">Orbital Elements</div>
            <OrbitalElements data={tleData} loading={tleLoading}/>
          </div>

          {/* § 4 — Upcoming Passes */}
          <div className="sd-section">
            <div className="sd-section-title">Upcoming Passes: Next 7 Days</div>
            <PassTimeline passes={passes} loading={passesLoading} satname={satellite.satname} locationName={location.name}/>
          </div>

          {/* § 5 — Elevation profile */}
          {nextPass && (
            <div className="sd-section">
              <div className="sd-section-title">
                Next Pass: Elevation Profile
                <span className="sd-section-sub">{formatBST(nextPass.startUTC)} BST</span>
              </div>
              <ElevationChart pass={nextPass}/>
            </div>
          )}

          {/* § 6 — Doppler profile */}
          {nextPass && (
            <div className="sd-section">
              <div className="sd-section-title">
                Doppler Shift Profile
                <span className="sd-section-sub">Ku-band · estimated</span>
              </div>
              <DopplerChart pass={nextPass}/>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
