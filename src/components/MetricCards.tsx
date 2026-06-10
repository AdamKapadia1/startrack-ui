import { useState, useEffect } from 'react';
import type { Satellite } from '../types';
import type { Pass } from '../hooks/useRecommendation';

interface Props {
  satellites: Satellite[];
  topPasses: Pass[];
}

function useCountdown(targetUTC: number | null): string {
  const [display, setDisplay] = useState('--:--');

  useEffect(() => {
    if (!targetUTC) { setDisplay('--:--'); return; }
    const tick = () => {
      const diff = targetUTC - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setDisplay('0:00'); return; }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setDisplay(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [targetUTC]);

  return display;
}

function signalScore(satellites: Satellite[]): number {
  if (!satellites.length) return 0;
  const best = Math.max(...satellites.map(s => s.elevation));
  const avg  = satellites.reduce((s, x) => s + x.elevation, 0) / satellites.length;
  return Math.min(100, Math.round(satellites.length * 6 + avg * 0.4 + (best > 60 ? 15 : best > 30 ? 8 : 0)));
}

export function MetricCards({ satellites, topPasses }: Props) {
  const now = Math.floor(Date.now() / 1000);
  const nextPass = topPasses.find(p => p.startUTC > now) ?? null;
  const countdown = useCountdown(nextPass?.startUTC ?? null);

  const count    = satellites.length;
  const bestEl   = count > 0 ? Math.max(...satellites.map(s => s.elevation)) : 0;
  const score    = signalScore(satellites);

  return (
    <div className="metric-grid">
      <div className="metric-card">
        <div className="metric-label">Satellites Overhead</div>
        <div className={`metric-value${count > 0 ? ' metric-value--green' : ''}`}>{count}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Best Elevation Now</div>
        <div className="metric-value">
          {bestEl.toFixed(1)}<span className="metric-unit">°</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Next Peak Pass</div>
        <div className="metric-value">{countdown}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Signal Score</div>
        <div className={`metric-value${score >= 60 ? ' metric-value--green' : ''}`}>
          {score}<span className="metric-unit">/100</span>
        </div>
      </div>
    </div>
  );
}
