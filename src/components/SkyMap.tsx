import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Satellite, SatellitePosition } from '../types';
import type { Pass } from '../hooks/useRecommendation';

interface Props {
  satellites:    Satellite[];
  cloudCover?:   number;
  passes?:       Pass[];
  positions?:    SatellitePosition[];
  posLastUpdate?: Date | null;
}

const CX = 210, CY = 210, R = 175;

function toXY(az: number, el: number) {
  const r   = ((90 - el) / 90) * R;
  const rad = (az * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function dotColor(el: number) {
  if (el >= 60) return '#1D9E75';
  if (el >= 30) return '#34d399';
  return '#6B7280';
}

function badgeColor(cc: number) {
  if (cc < 30) return '#1D9E75';
  if (cc < 70) return '#F59E0B';
  return '#EF4444';
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

interface PopupProps {
  sat:     Satellite;
  passes:  Pass[];
  onClose: () => void;
}

function SatPopup({ sat, passes, onClose }: PopupProps) {
  const altKm = Math.round(sat.range * Math.sin(sat.elevation * Math.PI / 180));
  const isDtc = sat.satname.includes('[DTC]');

  const nextPass = passes.find(p =>
    p.satname === sat.satname ||
    p.satname?.toUpperCase().startsWith(sat.satname.toUpperCase()),
  );

  const style: React.CSSProperties = {
    position: 'fixed',
    bottom:   '80px',
    right:    '20px',
    zIndex:   1000,
    minWidth: '200px',
    maxWidth: '260px',
  };

  const dHz = sat.dopplerShiftHz;
  const dopplerColor = dHz === null ? 'var(--text-muted)'
    : dHz > 0 ? '#1D9E75'
    : dHz < 0 ? '#EF4444'
    : '#6B7280';
  const dopplerLabel = dHz === null ? '—'
    : dHz === 0 ? '0 kHz'
    : `${(dHz / 1000).toFixed(1)} kHz`;

  return createPortal(
    <div className="sat-popup" style={style} onClick={e => e.stopPropagation()}>
      <button className="sat-popup-close icon-btn" onClick={onClose} aria-label="Close">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div className="sat-popup-name">
        {sat.satname}
        {isDtc && <span className="dtc-badge">DTC</span>}
      </div>

      <div className="sat-popup-rows">
        <div className="sat-popup-row">
          <span>Elevation</span>
          <span style={{ color: dotColor(sat.elevation) }}>{sat.elevation.toFixed(1)}°</span>
        </div>
        <div className="sat-popup-row">
          <span>Azimuth</span><span>{sat.azimuth.toFixed(1)}°</span>
        </div>
        <div className="sat-popup-row">
          <span>Range</span><span>{sat.range.toLocaleString()} km</span>
        </div>
        <div className="sat-popup-row">
          <span>Altitude</span><span>~{altKm.toLocaleString()} km</span>
        </div>
        <div className="sat-popup-row">
          <span>Speed</span><span>~7.5 km/s</span>
        </div>
        <div className="sat-popup-row">
          <span>Ku-band</span>
          <span style={{ color: dopplerColor, fontWeight: 600 }}>{dopplerLabel}</span>
        </div>
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

// ── Trail + animation state ───────────────────────────────────────────────────

interface TrailPos { el: number; az: number; }

// ── Main component ────────────────────────────────────────────────────────────

export function SkyMap({ satellites, cloudCover = 0, passes = [], positions = [], posLastUpdate }: Props) {
  const [selected, setSelected] = useState<{ sat: Satellite; x: number; y: number } | null>(null);

  // Trails: name → last 3 positions (oldest first), not including current
  const trailRef = useRef<Map<string, TrailPos[]>>(new Map());
  // Track previous satellite names to detect entering/exiting
  const prevNamesRef = useRef<Set<string>>(new Set());
  // Satellites currently fading out (below horizon since last update)
  const [fadingOut, setFadingOut] = useState<Map<string, TrailPos>>(new Map());
  // Satellites currently fading in (just appeared)
  const [enteringNames, setEnteringNames] = useState<Set<string>>(new Set());
  // "Xs ago" display
  const [secsAgo, setSecsAgo] = useState<number | null>(null);

  // Use positions (5s) when available, fall back to satellites (30s)
  const displaySats: (SatellitePosition & { dopplerShiftHz?: number | null })[] =
    positions.length > 0
      ? positions.filter(p => p.elevation >= 30)
      : satellites.filter(s => s.elevation >= 30).map(s => ({
          satname:         s.satname,
          elevation:       s.elevation,
          azimuth:         s.azimuth,
          range:           s.range,
          dopplerShiftKHz: s.dopplerShiftKHz,
          dopplerShiftHz:  s.dopplerShiftHz,
        }));

  // Update trails and entering/exiting state whenever displaySats changes
  useEffect(() => {
    if (displaySats.length === 0 && prevNamesRef.current.size === 0) return;

    const currentNames = new Set(displaySats.map(s => s.satname));

    // Detect entering satellites
    const newEntering = new Set<string>();
    for (const name of currentNames) {
      if (!prevNamesRef.current.has(name)) newEntering.add(name);
    }
    if (newEntering.size > 0) {
      setEnteringNames(prev => new Set([...prev, ...newEntering]));
      // Clear entering state after 1.2s (animation duration)
      const id = setTimeout(() => {
        setEnteringNames(prev => {
          const next = new Set(prev);
          for (const n of newEntering) next.delete(n);
          return next;
        });
      }, 1200);
      return () => clearTimeout(id);
    }

    // Detect exiting satellites: save their last trail position
    const newFading = new Map<string, TrailPos>();
    for (const name of prevNamesRef.current) {
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
      }, 1200);
    }

    // Update trails: append current position to each satellite's history
    for (const sat of displaySats) {
      const existing = trailRef.current.get(sat.satname) ?? [];
      trailRef.current.set(
        sat.satname,
        [...existing, { el: sat.elevation, az: sat.azimuth }].slice(-4),
      );
    }

    prevNamesRef.current = currentNames;
  }, [positions, displaySats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Xs ago" ticker
  useEffect(() => {
    if (!posLastUpdate) return;
    setSecsAgo(0);
    const id = setInterval(() => {
      setSecsAgo(Math.round((Date.now() - posLastUpdate.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [posLastUpdate]);

  const cloudOpacity = cloudCover / 100 * 0.3;

  function handleSatClick(e: React.MouseEvent, satname: string) {
    e.stopPropagation();
    const full = satellites.find(s => s.satname === satname);
    if (!full) return;
    const { x, y } = toXY(full.azimuth, full.elevation);
    setSelected(prev => prev?.sat.satname === satname ? null : { sat: full, x, y });
  }

  const ageColor = secsAgo === null ? '#3a4f47'
    : secsAgo < 10 ? '#1D9E75'
    : secsAgo < 30 ? '#F59E0B'
    : '#EF4444';

  return (
    <div className="sky-section">
      <div className="sky-svg-wrap">
        <svg
          className="sky-svg"
          viewBox="0 0 420 420"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => setSelected(null)}
        >
          <defs>
            <radialGradient id="skyBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#0d2318"/>
              <stop offset="100%" stopColor="#060f0b"/>
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <clipPath id="skyClip">
              <circle cx={CX} cy={CY} r={R}/>
            </clipPath>
          </defs>

          <circle cx={CX} cy={CY} r={R} fill="url(#skyBg)" stroke="rgba(29,158,117,0.2)" strokeWidth="1"/>

          {cloudOpacity > 0 && (
            <circle cx={CX} cy={CY} r={R} fill="#9ca3af" opacity={cloudOpacity}/>
          )}

          {[30, 60].map(el => {
            const r = ((90 - el) / 90) * R;
            return (
              <g key={el}>
                <circle cx={CX} cy={CY} r={r} fill="none" stroke="rgba(29,158,117,0.15)" strokeWidth="0.75" strokeDasharray="4 3"/>
                <text x={CX + 3} y={CY - r + 11} fill="rgba(58,79,71,0.9)" fontSize="8" fontFamily="monospace">{el}°</text>
              </g>
            );
          })}

          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(29,158,117,0.1)" strokeWidth="0.75"/>
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(29,158,117,0.1)" strokeWidth="0.75"/>

          {[
            { label: 'N', x: CX,          y: CY - R - 10 },
            { label: 'S', x: CX,          y: CY + R + 18 },
            { label: 'E', x: CX + R + 12, y: CY + 4 },
            { label: 'W', x: CX - R - 12, y: CY + 4 },
          ].map(({ label, x, y }) => (
            <text key={label} x={x} y={y} textAnchor="middle" fill="#3a4f47" fontSize="11" fontFamily="monospace" fontWeight="600">
              {label}
            </text>
          ))}

          {/* Fading-out ghosts */}
          {Array.from(fadingOut.entries()).map(([name, pos]) => {
            const { x, y } = toXY(pos.az, pos.el);
            return (
              <circle key={`exit-${name}`} cx={x} cy={y} r="5"
                fill="#6B7280" opacity="0" className="sat-fading-out"
              />
            );
          })}

          {/* Live satellite dots */}
          {displaySats.map((sat) => {
            const { x, y }  = toXY(sat.azimuth, sat.elevation);
            const color      = dotColor(sat.elevation);
            const isSelected = selected?.sat.satname === sat.satname;
            const isEntering = enteringNames.has(sat.satname);
            const lx         = x < CX ? x + 9 : x - 9;
            const anchor     = x < CX ? 'start' : 'end';
            const trail      = trailRef.current.get(sat.satname) ?? [];

            return (
              <g
                key={sat.satname}
                style={{ cursor: 'pointer' }}
                onClick={e => handleSatClick(e, sat.satname)}
                className={isEntering ? 'sat-entering' : undefined}
              >
                {/* Motion trail: oldest to newest with decreasing opacity */}
                {trail.slice(-3).map((tp, i, arr) => {
                  const opacity = [0.10, 0.18, 0.28][i + (3 - arr.length)];
                  const { x: tx, y: ty } = toXY(tp.az, tp.el);
                  return (
                    <circle key={i} cx={tx} cy={ty} r="2.5" fill={color} opacity={opacity}/>
                  );
                })}

                {/* Hit area */}
                <circle cx={x} cy={y} r="14" fill="transparent"/>
                {/* Glow ring */}
                <circle cx={x} cy={y} r="9" fill={color} opacity={isSelected ? 0.28 : 0.12} filter="url(#glow)"/>
                {/* Main dot */}
                <circle
                  cx={x} cy={y} r="5"
                  fill={color} opacity="0.95"
                  filter="url(#glow)"
                  stroke={isSelected ? '#fff' : 'none'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                {sat.elevation >= 60 && (
                  <>
                    <text x={lx} y={y - 7} fill="rgba(122,145,135,0.9)" fontSize="9" fontFamily="monospace" textAnchor={anchor}>
                      {shortName(sat.satname)}
                    </text>
                    <text x={lx} y={y + 3} fill={color} fontSize="8" fontFamily="monospace" textAnchor={anchor} opacity="0.8">
                      {sat.elevation.toFixed(0)}°
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Observer dot */}
          <circle cx={CX} cy={CY} r="5"  fill="#3b82f6" opacity="0.9" filter="url(#glow)"/>
          <circle cx={CX} cy={CY} r="10" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3"/>
          <text x={CX} y={CY + 20} textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="monospace" opacity="0.8">You</text>

          {/* Cloud cover badge */}
          <g>
            <rect x={332} y={37} width={50} height={19} rx={5} fill="rgba(0,0,0,0.55)"/>
            <text x={357} y={50} textAnchor="middle" fill={badgeColor(cloudCover)} fontSize="10" fontFamily="monospace" fontWeight="600">
              {String.fromCodePoint(0x2601)} {cloudCover}%
            </text>
          </g>

          {/* Position update age indicator */}
          {secsAgo !== null && (
            <text x={CX - R + 4} y={CY + R - 6} fill={ageColor} fontSize="8" fontFamily="monospace" opacity="0.8">
              pos {secsAgo}s ago
            </text>
          )}
        </svg>
      </div>

      {selected && (
        <SatPopup
          sat={selected.sat}
          passes={passes}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="sky-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#1D9E75' }}/> High signal</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#34d399' }}/> Good</span>
      </div>
    </div>
  );
}
