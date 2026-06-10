import { useState, useEffect } from 'react';
import type { Satellite } from '../types';

interface Props {
  satellites: Satellite[];
  lastUpdated: Date | null;
}

const R  = 32;
const C  = 40;
const CIRC = 2 * Math.PI * R; // ≈ 201.06

function signalScore(satellites: Satellite[]): number {
  if (!satellites.length) return 0;
  const best = Math.max(...satellites.map(s => s.elevation));
  const avg  = satellites.reduce((s, x) => s + x.elevation, 0) / satellites.length;
  return Math.min(100, Math.round(satellites.length * 6 + avg * 0.4 + (best > 60 ? 15 : best > 30 ? 8 : 0)));
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Poor';
}

export function ConnectivityGauge({ satellites, lastUpdated }: Props) {
  const [secsAgo, setSecsAgo] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => setSecsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const score  = signalScore(satellites);
  const color  = scoreColor(score);
  const label  = scoreLabel(score);
  const dash   = (score / 100) * CIRC;
  const count  = satellites.length;

  return (
    <div className="gauge-section">
      <div className="gauge-wrap">
        <svg className="gauge-svg" viewBox="0 0 80 80">
          {/* track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
          {/* arc */}
          <circle
            cx={C} cy={C} r={R}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-score-num" style={{ color }}>{score}</span>
          <span className="gauge-score-denom">/100</span>
        </div>
      </div>

      <div className="gauge-info">
        <div className="gauge-status" style={{ color }}>{label}</div>
        <div className="gauge-sub">{count} sat{count !== 1 ? 's' : ''} · {label.toLowerCase()} signal</div>
        <div className="gauge-updated">
          {lastUpdated ? `Updated ${secsAgo}s ago` : 'Waiting for data…'}
        </div>
      </div>
    </div>
  );
}
