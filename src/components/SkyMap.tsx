import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Satellite, SatellitePosition } from '../types';
import type { Pass } from '../hooks/useRecommendation';
import { getConstellation } from '../utils/constellation';

interface Props {
  satellites:          Satellite[];
  cloudCover?:         number;
  passes?:             Pass[];
  positions?:          SatellitePosition[];
  posLastUpdate?:      Date | null;
  activeConstellation: string;
  loading?:            boolean;
  compact?:            boolean;
}

const CX = 210, CY = 210, R = 175;
const MIN_EL = 10; // Only render satellites above this elevation

function toXY(az: number, el: number) {
  const r     = R * (1 - el / 90);
  const angle = (az - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

// Muted radar-style palette — no saturated glow colours
function dotStyle(name: string, el: number): { color: string; opacity: number; r: number } {
  const c = getConstellation(name);
  switch (c) {
    case 'STARLINK':
      return el >= 60
        ? { color: '#6fb894', opacity: 0.85, r: 3 }
        : { color: '#5a8a6e', opacity: 0.60, r: 2 };
    case 'ONEWEB':
      return { color: '#4a7a9e', opacity: 0.60, r: 2 };
    case 'ISS':
      return { color: '#ffffff', opacity: 0.90, r: 4 };
    case 'GPS':
      return { color: '#a8915a', opacity: 0.60, r: 2 };
    default:
      return { color: '#6a7a8a', opacity: 0.50, r: 2 };
  }
}

function elevColor(el: number): string {
  if (el >= 60) return '#6fb894';
  if (el >= 30) return '#5a8a9e';
  return '#4a6080';
}

function shortName(name: string) {
  return name.replace('STARLINK-', 'SL-').replace('ONEWEB-', 'OW-').slice(0, 12);
}

function formatPassTime(utc: number): string {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

// ── Satellite detail popup ────────────────────────────────────────────────────

interface PopupProps { sat: Satellite; passes: Pass[]; onClose: () => void; }

function SatPopup({ sat, passes, onClose }: PopupProps) {
  const altKm   = Math.round(sat.range * Math.sin(sat.elevation * Math.PI / 180));
  const isDtc   = sat.satname.includes('[DTC]');
  const nextPass = passes.find(p =>
    p.satname === sat.satname ||
    p.satname?.toUpperCase().startsWith(sat.satname.toUpperCase()),
  );
  const dHz = sat.dopplerShiftHz;
  const dopplerColor = dHz === null ? 'var(--text-tertiary)'
    : dHz > 0 ? '#6fb894' : dHz < 0 ? '#c46a6a' : '#4a6080';
  const dopplerLabel = dHz === null ? '—'
    : dHz === 0 ? '0 kHz'
    : `${(dHz / 1000).toFixed(1)} kHz`;

  return createPortal(
    <div
      className="sat-popup"
      style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 1000, minWidth: '200px', maxWidth: '260px' }}
      onClick={e => e.stopPropagation()}
    >
      <button className="sat-popup-close icon-btn" onClick={onClose} aria-label="Close">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div className="sat-popup-name">{sat.satname}{isDtc && <span className="dtc-badge">DTC</span>}</div>
      <div className="sat-popup-rows">
        <div className="sat-popup-row"><span>Elevation</span><span style={{ color: elevColor(sat.elevation) }}>{sat.elevation.toFixed(1)}°</span></div>
        <div className="sat-popup-row"><span>Azimuth</span><span>{sat.azimuth.toFixed(1)}°</span></div>
        <div className="sat-popup-row"><span>Range</span><span>{sat.range.toLocaleString()} km</span></div>
        <div className="sat-popup-row"><span>Altitude</span><span>~{altKm.toLocaleString()} km</span></div>
        <div className="sat-popup-row"><span>Speed</span><span>~7.5 km/s</span></div>
        <div className="sat-popup-row"><span>Ku-band</span><span style={{ color: dopplerColor, fontWeight: 600 }}>{dopplerLabel}</span></div>
        {nextPass && (
          <div className="sat-popup-row sat-popup-pass">
            <span>Next pass</span>
            <span>{formatPassTime(nextPass.startUTC)} · {Math.round(nextPass.maxEl)}°</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Trail position store ──────────────────────────────────────────────────────
interface TrailPos { el: number; az: number; }

// ── Main component ────────────────────────────────────────────────────────────

export function SkyMap({
  satellites, cloudCover = 0, passes = [], positions = [],
  posLastUpdate, activeConstellation, loading, compact = false,
}: Props) {
  const [selected, setSelected] = useState<{ sat: Satellite } | null>(null);

  // Trail: name → last 3 positions (oldest first), not including current
  const trailRef    = useRef<Map<string, TrailPos[]>>(new Map());
  const prevNames   = useRef<Set<string>>(new Set());
  const [fadingOut, setFadingOut] = useState<Map<string, TrailPos>>(new Map());
  const [secsAgo,   setSecsAgo]   = useState<number | null>(null);

  // "pos Xs ago" ticker
  useEffect(() => {
    if (!posLastUpdate) return;
    setSecsAgo(0);
    const id = setInterval(() => {
      setSecsAgo(Math.round((Date.now() - posLastUpdate.getTime()) / 1000));
    }, 1_000);
    return () => clearInterval(id);
  }, [posLastUpdate]);

  // Merge positions + satellites data, filtered to MIN_EL
  const allSats: (SatellitePosition & { dopplerShiftHz?: number | null })[] =
    positions.length > 0
      ? positions.filter(p => p.elevation >= MIN_EL)
      : satellites.filter(s => s.elevation >= MIN_EL).map(s => ({
          satname:         s.satname,
          elevation:       s.elevation,
          azimuth:         s.azimuth,
          range:           s.range,
          dopplerShiftKHz: s.dopplerShiftKHz,
          dopplerShiftHz:  s.dopplerShiftHz,
        }));

  // Total above horizon (before MIN_EL filter) for the "Showing X of Y" label
  const totalAboveHorizon = positions.length > 0
    ? positions.filter(p => p.elevation >= 0).length
    : satellites.filter(s => s.elevation >= 0).length;

  const renderSats = activeConstellation === 'ALL'
    ? allSats
    : allSats.filter(s => getConstellation(s.satname) === activeConstellation);

  // Update trails and fading-out ghosts
  useEffect(() => {
    const currentNames = new Set(allSats.map(s => s.satname));

    const newFading = new Map<string, TrailPos>();
    for (const name of prevNames.current) {
      if (!currentNames.has(name)) {
        const trail = trailRef.current.get(name);
        const last  = trail && trail.length > 0 ? trail[trail.length - 1] : null;
        if (last) newFading.set(name, last);
        trailRef.current.delete(name);
      }
    }
    if (newFading.size > 0) {
      setFadingOut(prev => new Map([...prev, ...newFading]));
      setTimeout(() => {
        setFadingOut(prev => {
          const next = new Map(prev);
          for (const n of newFading.keys()) next.delete(n);
          return next;
        });
      }, 1_200);
    }

    for (const sat of allSats) {
      const existing = trailRef.current.get(sat.satname) ?? [];
      trailRef.current.set(
        sat.satname,
        [...existing, { el: sat.elevation, az: sat.azimuth }].slice(-4),
      );
    }
    prevNames.current = currentNames;
  }, [positions, allSats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(e: React.MouseEvent, satname: string) {
    e.stopPropagation();
    const full = satellites.find(s => s.satname === satname);
    if (!full) return;
    setSelected(prev => prev?.sat.satname === satname ? null : { sat: full });
  }

  const ageColor = secsAgo === null ? '#2a4060'
    : secsAgo < 10 ? '#4a7a5e'
    : secsAgo < 30 ? '#7a6a3a'
    : '#7a3a3a';

  // Skeleton dot positions for loading state
  const SKEL = [
    { az: 30, el: 55 }, { az: 80, el: 70 }, { az: 130, el: 40 },
    { az: 200, el: 60 }, { az: 270, el: 45 }, { az: 330, el: 65 },
  ];

  // Legend items
  const LEGEND = [
    { color: '#5a8a6e', label: 'Starlink' },
    { color: '#4a7a9e', label: 'OneWeb' },
    { color: '#ffffff', label: 'ISS' },
    { color: '#a8915a', label: 'GPS' },
  ];

  return (
    <div className="sky-section">
      <div className={`sky-svg-wrap${compact ? ' sky-svg-compact' : ''}`}>
        <svg
          className="sky-svg"
          viewBox="0 0 420 420"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => setSelected(null)}
        >
          <defs>
            {/* Radar grid pattern */}
            <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse" x={CX % 40} y={CY % 40}>
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(74,128,160,0.04)" strokeWidth="1"/>
            </pattern>
            <clipPath id="skyClip">
              <circle cx={CX} cy={CY} r={R}/>
            </clipPath>
          </defs>

          {/* ── Background ── */}
          <circle cx={CX} cy={CY} r={R} fill="#060a10"/>
          <rect x={CX - R} y={CY - R} width={R * 2} height={R * 2} fill="url(#radarGrid)" clipPath="url(#skyClip)"/>

          {/* Cloud cover overlay */}
          {cloudCover > 30 && (
            <circle cx={CX} cy={CY} r={R} fill="#1a2a3a" opacity={cloudCover / 100 * 0.18} clipPath="url(#skyClip)"/>
          )}

          {/* ── Elevation rings (solid, no dash) ── */}
          {[30, 60].map(el => {
            const r = R * (1 - el / 90);
            return (
              <g key={el}>
                <circle cx={CX} cy={CY} r={r} fill="none" stroke="#1a3050" strokeWidth="0.75" opacity="0.5"/>
                <text x={CX + 3} y={CY - r + 10} fill="#2a4060" fontSize="8" fontFamily="JetBrains Mono, monospace">{el}°</text>
              </g>
            );
          })}

          {/* ── Cross hairs ── */}
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#1a3050" strokeWidth="0.75" opacity="0.6"/>
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#1a3050" strokeWidth="0.75" opacity="0.6"/>

          {/* ── Outer ring ── */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1a3050" strokeWidth="1" opacity="0.8"/>

          {/* ── Compass labels ── */}
          {[
            { label: 'N', x: CX,          y: CY - R - 10 },
            { label: 'S', x: CX,          y: CY + R + 18 },
            { label: 'E', x: CX + R + 13, y: CY + 4      },
            { label: 'W', x: CX - R - 13, y: CY + 4      },
          ].map(({ label, x, y }) => (
            <text key={label} x={x} y={y} textAnchor="middle"
              fill="#3a5878" fontSize="11" fontFamily="JetBrains Mono, monospace"
              fontWeight="400" letterSpacing="2">
              {label}
            </text>
          ))}

          {/* ── Skeleton loading dots ── */}
          {loading && satellites.length === 0 && SKEL.map((d, i) => {
            const { x, y } = toXY(d.az, d.el);
            return (
              <circle key={`skel-${i}`} cx={x} cy={y} r="2"
                fill="#3a5878" className="sat-skel-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            );
          })}

          {/* ── Fading-out ghosts ── */}
          <g clipPath="url(#skyClip)">
            {Array.from(fadingOut.entries())
              .filter(([name]) => activeConstellation === 'ALL' || getConstellation(name) === activeConstellation)
              .map(([name, pos]) => {
                const { x, y } = toXY(pos.az, pos.el);
                const { color } = dotStyle(name, pos.el);
                return <circle key={`exit-${name}`} cx={x} cy={y} r={2} fill={color} opacity={0} className="sat-fading-out"/>;
              })}
          </g>

          {/* ── Live satellite dots — CSS-transitioned transforms prevent position jumps ── */}
          <g clipPath="url(#skyClip)">
            {renderSats.map(sat => {
              const { x, y }    = toXY(sat.azimuth, sat.elevation);
              const ds          = dotStyle(sat.satname, sat.elevation);
              const isSelected  = selected?.sat.satname === sat.satname;
              const trail       = trailRef.current.get(sat.satname) ?? [];
              const prevPos     = trail.length > 0 ? trail[trail.length - 1] : null;
              const lxOff       = x < CX ? 7 : -7;
              const anchor      = x < CX ? 'start' : 'end';

              // Forward orbit trail for high-elevation satellites
              let trailLine: React.ReactNode = null;
              if (sat.elevation >= 60 && prevPos) {
                const { x: px, y: py } = toXY(prevPos.az, prevPos.el);
                const dx = x - px, dy = y - py;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0.5) {
                  const ext = 20;
                  trailLine = (
                    <line
                      x1={0} y1={0}
                      x2={(dx / len) * ext} y2={(dy / len) * ext}
                      stroke={ds.color} strokeWidth={0.8} opacity={0.18}
                    />
                  );
                }
              }

              return (
                <g
                  key={sat.satname}
                  style={{
                    // CSS transform for smooth animated movement — 5s matches position broadcast interval
                    transform: `translate(${x}px, ${y}px)`,
                    transition: 'transform 5s linear',
                    cursor: 'pointer',
                  }}
                  onClick={e => handleClick(e, sat.satname)}
                >
                  {trailLine}

                  {/* Large invisible hit area */}
                  <circle cx={0} cy={0} r={12} fill="transparent"/>

                  {/* Selection ring */}
                  {isSelected && (
                    <circle cx={0} cy={0} r={ds.r + 4} fill="none" stroke="#8a9ab8" strokeWidth={0.8} opacity={0.6}/>
                  )}

                  {/* Main dot — no glow filter */}
                  <circle cx={0} cy={0} r={ds.r} fill={ds.color} opacity={ds.opacity}/>

                  {/* Label only above 70° and not in compact mode */}
                  {!compact && sat.elevation >= 70 && (
                    <text
                      x={lxOff} y={-ds.r - 3}
                      fill="#4a6080" fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor={anchor} opacity="0.85"
                    >
                      {shortName(sat.satname)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Observer dot (muted purple, no pulsing ring) ── */}
          <circle cx={CX} cy={CY} r={4} fill="#8a7ab8" opacity="0.9"/>
          <circle cx={CX} cy={CY} r={8} fill="none" stroke="#8a7ab8" strokeWidth="0.75" opacity="0.25"/>
          <text x={CX} y={CY + 20} textAnchor="middle" fill="#8a7ab8" fontSize="8"
            fontFamily="JetBrains Mono, monospace" letterSpacing="1" opacity="0.7">
            YOU
          </text>

          {/* ── Position age indicator (bottom-left) ── */}
          {secsAgo !== null && (
            <text x={CX - R + 5} y={CY + R - 7} fill={ageColor} fontSize="8"
              fontFamily="JetBrains Mono, monospace" opacity="0.7">
              pos {secsAgo}s ago
            </text>
          )}

          {/* ── Legend (bottom-right, hidden in compact mode) ── */}
          {!compact && (activeConstellation === 'ALL' ? (() => {
            const lx = CX + R - 6;
            const ly = CY + R - 6;
            const rowH = 13, pad = 6;
            const rows = LEGEND;
            const boxH = rows.length * rowH + pad * 1.5;
            const boxW = 64;
            return (
              <g transform={`translate(${lx - boxW}, ${ly - boxH})`}>
                <rect width={boxW} height={boxH} rx={3} fill="rgba(6,10,16,0.85)" stroke="#1a3050" strokeWidth="0.5"/>
                {rows.map((item, i) => (
                  <g key={item.label} transform={`translate(${pad}, ${pad + i * rowH})`}>
                    <circle cx={3} cy={0} r={3} fill={item.color} opacity={0.8}/>
                    <text x={9} y={3.5} fill="#3a5878" fontSize="9" fontFamily="JetBrains Mono, monospace">{item.label}</text>
                  </g>
                ))}
              </g>
            );
          })() : (() => {
            const { color } = dotStyle(activeConstellation, 45);
            return (
              <g transform={`translate(${CX + R - 70}, ${CY + R - 22})`}>
                <rect width={66} height={16} rx={3} fill="rgba(6,10,16,0.85)" stroke="#1a3050" strokeWidth="0.5"/>
                <circle cx={9} cy={8} r={3} fill={color} opacity={0.8}/>
                <text x={16} y={11.5} fill="#3a5878" fontSize="9" fontFamily="JetBrains Mono, monospace">{activeConstellation} only</text>
              </g>
            );
          })())}
        </svg>
      </div>

      {/* Showing X of Y indicator */}
      <div className="sky-density-note">
        {renderSats.length} of {totalAboveHorizon} satellites visible (above {MIN_EL}°)
      </div>

      {selected && (
        <SatPopup sat={selected.sat} passes={passes} onClose={() => setSelected(null)}/>
      )}
    </div>
  );
}
