import { useState } from 'react';
import type { Satellite } from '../types';
import type { Pass } from '../hooks/useRecommendation';

interface Props {
  satellites: Satellite[];
  cloudCover?: number;
  passes?: Pass[];
}

const CX = 210, CY = 210, R = 175;

const CLOUD_BLOBS = [
  { rx: -0.55, ry: -0.55 }, { rx:  0.05, ry: -0.65 }, { rx:  0.55, ry: -0.45 },
  { rx: -0.72, ry: -0.10 }, { rx: -0.15, ry: -0.20 }, { rx:  0.35, ry: -0.10 },
  { rx:  0.65, ry:  0.30 }, { rx: -0.40, ry:  0.55 }, { rx:  0.10, ry:  0.62 },
  { rx: -0.62, ry:  0.40 }, { rx:  0.30, ry:  0.45 }, { rx:  0.55, ry:  0.05 },
];

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
  svgX:    number;
  svgY:    number;
  onClose: () => void;
}

function SatPopup({ sat, passes, svgX, svgY, onClose }: PopupProps) {
  const altKm = Math.round(sat.range * Math.sin(sat.elevation * Math.PI / 180));
  const isDtc = sat.satname.includes('[DTC]');

  const nextPass = passes.find(p =>
    p.satname === sat.satname ||
    p.satname?.toUpperCase().startsWith(sat.satname.toUpperCase()),
  );

  // Map SVG coords (0-420) to percentage for positioning within sky-svg-wrap
  const leftPct = svgX / 420;
  const topPct  = svgY / 420;

  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    // Horizontal: if dot is in right 55%, anchor right; else anchor left
    ...(leftPct > 0.55
      ? { right: `${Math.round((1 - leftPct) * 100) + 3}%` }
      : { left:  `${Math.round(leftPct * 100) + 3}%` }),
    // Vertical: if dot is in bottom 55%, anchor bottom; else anchor top
    ...(topPct > 0.55
      ? { bottom: `${Math.round((1 - topPct) * 100) + 3}%` }
      : { top:    `${Math.round(topPct * 100) + 3}%` }),
  };

  const dHz = sat.dopplerShiftHz;
  const dopplerColor = dHz === null ? 'var(--text-muted)'
    : dHz > 0 ? '#1D9E75'
    : dHz < 0 ? '#EF4444'
    : '#6B7280';
  const dopplerLabel = dHz === null ? '—'
    : dHz === 0 ? '0 kHz'
    : `${(dHz / 1000).toFixed(1)} kHz`;

  return (
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
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SkyMap({ satellites, cloudCover = 0, passes = [] }: Props) {
  const [selected, setSelected] = useState<{ sat: Satellite; x: number; y: number } | null>(null);

  const cloudOpacity = cloudCover > 30 ? Math.min(0.45, ((cloudCover - 30) / 70) * 0.55) : 0;

  function handleSatClick(e: React.MouseEvent, sat: Satellite) {
    e.stopPropagation();
    const { x, y } = toXY(sat.azimuth, sat.elevation);
    setSelected(prev => prev?.sat.satname === sat.satname ? null : { sat, x, y });
  }

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
            <g clipPath="url(#skyClip)" opacity={cloudOpacity}>
              {CLOUD_BLOBS.map((pos, i) => (
                <ellipse key={i} cx={CX + pos.rx * R} cy={CY + pos.ry * R} rx={40} ry={26} fill="#9ca3af"/>
              ))}
            </g>
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

          {satellites.map((sat) => {
            const { x, y }  = toXY(sat.azimuth, sat.elevation);
            const color      = dotColor(sat.elevation);
            const isSelected = selected?.sat.satname === sat.satname;
            const lx         = x < CX ? x + 9 : x - 9;
            const anchor     = x < CX ? 'start' : 'end';
            // CSS cx/cy transition — animates position smoothly when satellite data updates
            const circleStyle = { transition: 'cx 2s ease, cy 2s ease' } as React.CSSProperties;
            return (
              <g
                key={sat.satname}
                filter="url(#glow)"
                style={{ cursor: 'pointer' }}
                onClick={e => handleSatClick(e, sat)}
              >
                {/* enlarged transparent hit area */}
                <circle style={{ ...circleStyle, cx: x, cy: y } as React.CSSProperties} r="14" fill="transparent"/>
                <circle style={{ ...circleStyle, cx: x, cy: y } as React.CSSProperties} r="9"  fill={color} opacity={isSelected ? 0.28 : 0.12}/>
                <circle
                  style={{ ...circleStyle, cx: x, cy: y } as React.CSSProperties}
                  r="5" fill={color} opacity="0.95"
                  stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 1 : 0}
                />
                <text x={lx} y={y - 7} fill="rgba(122,145,135,0.9)" fontSize="9" fontFamily="monospace" textAnchor={anchor}>
                  {shortName(sat.satname)}
                </text>
                <text x={lx} y={y + 3} fill={color} fontSize="8" fontFamily="monospace" textAnchor={anchor} opacity="0.8">
                  {sat.elevation.toFixed(0)}°
                </text>
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="5"  fill="#3b82f6" opacity="0.9" filter="url(#glow)"/>
          <circle cx={CX} cy={CY} r="10" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3"/>
          <text x={CX} y={CY + 20} textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="monospace" opacity="0.8">You</text>

          <g>
            <rect x={332} y={37} width={50} height={19} rx={5} fill="rgba(0,0,0,0.55)"/>
            <text x={357} y={50} textAnchor="middle" fill={badgeColor(cloudCover)} fontSize="10" fontFamily="monospace" fontWeight="600">
              {String.fromCodePoint(0x2601)} {cloudCover}%
            </text>
          </g>
        </svg>

        {selected && (
          <SatPopup
            sat={selected.sat}
            passes={passes}
            svgX={selected.x}
            svgY={selected.y}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      <div className="sky-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#1D9E75' }}/> High signal</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#34d399' }}/> Good</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#6B7280' }}/> Weak</span>
      </div>
    </div>
  );
}
