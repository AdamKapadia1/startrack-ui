import { useState } from 'react';

export interface GroundTrackPoint {
  lat:   number;
  lon:   number;
  altKm?: number;
  time:  string;
}

interface Props {
  points:             GroundTrackPoint[];
  observerLat:        number;
  observerLon:        number;
  footprintRadiusKm?: number;
  loading?:           boolean;
}

// Simplified continent outlines as [lon, lat] pairs
const LAND: [number, number][][] = [
  // North America
  [[-167,71],[-140,70],[-130,54],[-124,46],[-125,37],[-117,32],[-105,20],[-87,15],[-77,8],
   [-77,25],[-80,32],[-74,40],[-70,43],[-60,46],[-52,47],[-57,52],[-64,63],[-78,73],
   [-100,73],[-130,70],[-167,71]],
  // Greenland
  [[-73,83],[-35,83],[-20,72],[-44,59],[-52,68],[-73,83]],
  // South America
  [[-80,9],[-65,-5],[-50,-5],[-35,-8],[-40,-21],[-43,-23],[-52,-33],[-58,-38],[-65,-55],
   [-68,-55],[-72,-48],[-72,-38],[-76,-10],[-78,5],[-80,9]],
  // Europe
  [[-10,36],[-5,36],[0,39],[3,44],[8,44],[15,44],[18,40],[20,38],[26,40],[28,41],
   [37,47],[30,50],[24,57],[22,58],[28,59],[30,65],[20,71],[10,71],[-5,62],[-10,52],
   [-8,44],[-8,38],[-10,36]],
  // Africa
  [[-17,15],[-15,8],[-8,5],[0,4],[8,4],[14,4],[15,8],[27,0],[37,-5],[40,0],[42,12],
   [44,10],[43,14],[38,22],[37,30],[33,31],[25,22],[15,22],[10,15],[0,5],[-5,5],[-17,15]],
  // Asia + Russia
  [[28,41],[36,36],[36,30],[40,28],[50,24],[57,22],[60,22],[68,22],[72,22],[72,8],[80,8],
   [80,13],[90,22],[98,10],[104,2],[108,10],[120,22],[120,30],[124,40],[130,42],[135,46],
   [140,50],[150,60],[162,60],[165,62],[170,65],[170,72],[150,72],[135,72],[100,78],
   [90,78],[60,72],[45,70],[40,68],[30,70],[28,71],[30,65],[28,59],[24,57],[22,58],
   [27,54],[32,47],[37,47],[40,46],[40,38],[28,41]],
  // Australia
  [[114,-22],[122,-18],[130,-12],[136,-12],[140,-18],[145,-18],[148,-20],[150,-24],
   [153,-27],[150,-38],[147,-39],[143,-38],[140,-36],[132,-32],[129,-34],[118,-28],[114,-22]],
  // Antarctica
  [[-180,-70],[180,-70],[180,-90],[-180,-90],[-180,-70]],
];

// Equirectangular: viewBox "0 0 360 180"
function toSvg(lon: number, lat: number): [number, number] {
  return [lon + 180, 90 - lat];
}

function landPoints(coords: [number, number][]): string {
  return coords.map(([lon, lat]) => toSvg(lon, lat).join(',')).join(' ');
}

// Break track into segments at antimeridian crossings (|Δlon| > 180)
function splitTrack(pts: GroundTrackPoint[]): GroundTrackPoint[][] {
  if (!pts.length) return [];
  const segs: GroundTrackPoint[][] = [];
  let cur: GroundTrackPoint[]      = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].lon - pts[i - 1].lon) > 180) {
      segs.push(cur);
      cur = [pts[i]];
    } else {
      cur.push(pts[i]);
    }
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function segPath(seg: GroundTrackPoint[]): string {
  return seg.map((p, i) => {
    const [x, y] = toSvg(p.lon, p.lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function GroundTrackMap({ points, observerLat, observerLon, footprintRadiusKm, loading }: Props) {
  const [showFootprint, setShowFootprint] = useState(false);

  const segments   = splitTrack(points);
  const currentPos = points[0] ?? null;
  const [obX, obY] = toSvg(observerLon, observerLat);

  // Footprint ellipse in SVG units (equirectangular: 1 unit = 1 degree)
  // ry is constant (latitude); rx expands at higher latitudes (lon compression)
  const footprintEllipse = (showFootprint && footprintRadiusKm && currentPos)
    ? (() => {
        const KM_PER_DEG = 111.32;
        const ry = footprintRadiusKm / KM_PER_DEG;
        const rx = footprintRadiusKm / (KM_PER_DEG * Math.max(0.1, Math.cos(currentPos.lat * Math.PI / 180)));
        const [cx, cy] = toSvg(currentPos.lon, currentPos.lat);
        return { cx, cy, rx, ry };
      })()
    : null;

  return (
    <div className="groundtrack-wrap">
      <svg
        viewBox="0 0 360 180"
        preserveAspectRatio="none"
        className="groundtrack-svg"
        aria-label="Satellite ground track"
      >
        {/* Ocean background */}
        <rect x="0" y="0" width="360" height="180" fill="#060d1a" />

        {/* Graticule */}
        {/* Equator */}
        <line x1="0" y1="90" x2="360" y2="90"
          stroke="rgba(0,212,255,0.14)" strokeWidth="0.35" strokeDasharray="2 3" />
        {/* Tropics ±23.5° */}
        {[66.5, 113.5].map(y => (
          <line key={y} x1="0" y1={y} x2="360" y2={y}
            stroke="rgba(255,184,0,0.08)" strokeWidth="0.25" strokeDasharray="3 5" />
        ))}
        {/* Arctic/Antarctic circles ±66.5° */}
        {[23.5, 156.5].map(y => (
          <line key={y} x1="0" y1={y} x2="360" y2={y}
            stroke="rgba(100,180,255,0.06)" strokeWidth="0.2" strokeDasharray="4 7" />
        ))}
        {/* Prime meridian + 180° */}
        {[180, 90, 270].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="180"
            stroke="rgba(0,212,255,0.06)" strokeWidth="0.2" strokeDasharray="2 5" />
        ))}

        {/* Continents */}
        {LAND.map((coords, i) => (
          <polygon
            key={i}
            points={landPoints(coords)}
            fill="rgba(26,58,92,0.6)"
            stroke="rgba(0,160,210,0.22)"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        ))}

        {/* Ground track lines */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={segPath(seg)}
            fill="none"
            stroke="rgba(0,212,255,0.75)"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Loading shimmer overlay */}
        {loading && (
          <rect x="0" y="0" width="360" height="180"
            fill="rgba(8,12,20,0.6)" />
        )}

        {/* Coverage footprint */}
        {footprintEllipse && (
          <ellipse
            cx={footprintEllipse.cx}
            cy={footprintEllipse.cy}
            rx={footprintEllipse.rx}
            ry={footprintEllipse.ry}
            fill="rgba(0,212,255,0.08)"
            stroke="rgba(0,212,255,0.3)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1.5"
          />
        )}

        {/* Observer location */}
        <circle cx={obX} cy={obY} r="1.8"
          fill="#a78bfa" stroke="rgba(167,139,250,0.45)" strokeWidth="0.8" />

        {/* Current satellite position */}
        {currentPos && (() => {
          const [sx, sy] = toSvg(currentPos.lon, currentPos.lat);
          return (
            <>
              <circle cx={sx} cy={sy} r="4" fill="rgba(0,212,255,0.15)" />
              <circle cx={sx} cy={sy} r="2.2" fill="#00d4ff" />
            </>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="groundtrack-legend">
        <span className="groundtrack-legend-item">
          <span className="groundtrack-legend-line" />
          Ground track · next 100 min
        </span>
        <span className="groundtrack-legend-item">
          <svg width="9" height="9"><circle cx="4.5" cy="4.5" r="3.5" fill="#00d4ff"/></svg>
          Satellite now
        </span>
        <span className="groundtrack-legend-item">
          <svg width="9" height="9"><circle cx="4.5" cy="4.5" r="3.5" fill="#a78bfa"/></svg>
          Observer
        </span>
        {footprintRadiusKm != null && (
          <label className="groundtrack-legend-item groundtrack-footprint-toggle">
            <input
              type="checkbox"
              checked={showFootprint}
              onChange={e => setShowFootprint(e.target.checked)}
            />
            Coverage footprint{showFootprint ? ` · ~${footprintRadiusKm.toLocaleString()} km` : ''}
          </label>
        )}
        {loading && <span className="groundtrack-legend-item" style={{ color: 'var(--text-muted)' }}>Calculating…</span>}
      </div>
    </div>
  );
}
