import type { Satellite } from '../types';

interface Props {
  satellites: Satellite[];
  cloudCover?: number;
}

const CX = 210, CY = 210, R = 175;

// Pre-computed cloud blob positions (fraction of R from centre, within unit disc)
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

export function SkyMap({ satellites, cloudCover = 0 }: Props) {
  const cloudOpacity = cloudCover > 30 ? Math.min(0.45, ((cloudCover - 30) / 70) * 0.55) : 0;

  return (
    <div className="sky-section">
      <div className="sky-svg-wrap">
        <svg className="sky-svg" viewBox="0 0 420 420" preserveAspectRatio="xMidYMid meet">
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

          {/* Sky disc */}
          <circle cx={CX} cy={CY} r={R} fill="url(#skyBg)" stroke="rgba(29,158,117,0.2)" strokeWidth="1"/>

          {/* Cloud cover overlay — clipped to sky disc, opacity scales with cloudCover */}
          {cloudOpacity > 0 && (
            <g clipPath="url(#skyClip)" opacity={cloudOpacity}>
              {CLOUD_BLOBS.map((pos, i) => (
                <ellipse
                  key={i}
                  cx={CX + pos.rx * R}
                  cy={CY + pos.ry * R}
                  rx={40} ry={26}
                  fill="#9ca3af"
                />
              ))}
            </g>
          )}

          {/* Elevation rings */}
          {[30, 60].map(el => {
            const r = ((90 - el) / 90) * R;
            return (
              <g key={el}>
                <circle cx={CX} cy={CY} r={r} fill="none" stroke="rgba(29,158,117,0.15)" strokeWidth="0.75" strokeDasharray="4 3"/>
                <text x={CX + 3} y={CY - r + 11} fill="rgba(58,79,71,0.9)" fontSize="8" fontFamily="monospace">{el}°</text>
              </g>
            );
          })}

          {/* Cross-hairs */}
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(29,158,117,0.1)" strokeWidth="0.75"/>
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(29,158,117,0.1)" strokeWidth="0.75"/>

          {/* Cardinal labels */}
          {[
            { label: 'N', x: CX,        y: CY - R - 10 },
            { label: 'S', x: CX,        y: CY + R + 18 },
            { label: 'E', x: CX + R + 12, y: CY + 4 },
            { label: 'W', x: CX - R - 12, y: CY + 4 },
          ].map(({ label, x, y }) => (
            <text key={label} x={x} y={y} textAnchor="middle" fill="#3a4f47" fontSize="11" fontFamily="monospace" fontWeight="600">
              {label}
            </text>
          ))}

          {/* Satellites */}
          {satellites.map((sat, i) => {
            const { x, y } = toXY(sat.azimuth, sat.elevation);
            const color     = dotColor(sat.elevation);
            const lx        = x < CX ? x + 9 : x - 9;
            const anchor    = x < CX ? 'start' : 'end';
            return (
              <g key={i} filter="url(#glow)">
                <title>{sat.satname} · El {sat.elevation}° Az {sat.azimuth}°</title>
                <circle cx={x} cy={y} r="9"  fill={color} opacity="0.12"/>
                <circle cx={x} cy={y} r="5"  fill={color} opacity="0.95"/>
                <text x={lx} y={y - 7} fill="rgba(122,145,135,0.9)" fontSize="9" fontFamily="monospace" textAnchor={anchor}>
                  {shortName(sat.satname)}
                </text>
                <text x={lx} y={y + 3} fill={color} fontSize="8" fontFamily="monospace" textAnchor={anchor} opacity="0.8">
                  {sat.elevation.toFixed(0)}°
                </text>
              </g>
            );
          })}

          {/* You marker */}
          <circle cx={CX} cy={CY} r="5"  fill="#3b82f6" opacity="0.9" filter="url(#glow)"/>
          <circle cx={CX} cy={CY} r="10" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3"/>
          <text x={CX} y={CY + 20} textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="monospace" opacity="0.8">You</text>

          {/* Weather badge — top-right of sky disc */}
          <g>
            <rect x={332} y={37} width={50} height={19} rx={5} fill="rgba(0,0,0,0.55)"/>
            <text x={357} y={50} textAnchor="middle" fill={badgeColor(cloudCover)} fontSize="10" fontFamily="monospace" fontWeight="600">
              {String.fromCodePoint(0x2601)} {cloudCover}%
            </text>
          </g>
        </svg>
      </div>

      <div className="sky-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#1D9E75' }}/> High signal</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#34d399' }}/> Good</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#6B7280' }}/> Weak</span>
      </div>
    </div>
  );
}
