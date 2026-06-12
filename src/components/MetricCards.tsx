import { useState, useEffect } from 'react';
import type { Satellite } from '../types';
import type { Pass } from '../hooks/useRecommendation';
import { CONSTELLATION_LABELS } from '../utils/constellation';

interface Props {
  satellites:          Satellite[];
  topPasses:           Pass[];
  activeConstellation: string;
}

function useNextPassCountdown(topPasses: Pass[]): string {
  const [display, setDisplay] = useState('--:--');

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const next = topPasses.find(p => p.startUTC > now);
      if (!next) { setDisplay('--:--'); return; }

      const diff = next.startUTC - now;
      if (diff > 24 * 3600) { setDisplay('--:--'); return; }

      if (diff >= 3600) {
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        setDisplay(`${h}h ${m}m`);
      } else {
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        setDisplay(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [topPasses]);

  return display;
}

function signalScore(satellites: Satellite[]): number {
  if (!satellites.length) return 0;
  const best       = Math.max(...satellites.map(s => s.elevation));
  const elevScore  = Math.max(0, Math.min(40, (best / 85) * 40));
  const countBonus = satellites.length > 50 ? 10 : satellites.length > 10 ? 5 : 0;
  return Math.min(100, Math.round(elevScore + countBonus + 28)); // 28 ≈ average weather baseline
}

export function MetricCards({ satellites, topPasses, activeConstellation }: Props) {
  const countdown = useNextPassCountdown(topPasses);

  const count      = satellites.length;
  const bestEl     = count > 0 ? Math.max(...satellites.map(s => s.elevation)) : 0;
  const score      = signalScore(satellites);
  const filterLabel = activeConstellation === 'ALL'
    ? 'All constellations'
    : CONSTELLATION_LABELS[activeConstellation] ?? `${activeConstellation} only`;

  return (
    <div className="metric-grid">
      <div className="metric-card">
        <div className="metric-label">Satellites Overhead</div>
        <div className={`metric-value${count > 0 ? ' metric-value--green' : ''}`}>{count}</div>
        <div className="metric-sublabel">{filterLabel}</div>
        <div className="metric-context">of ~6,000 Starlink satellites</div>
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
