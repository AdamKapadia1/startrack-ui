import { useState, useEffect } from 'react';
import type { Satellite } from '../types';
import type { Pass } from '../hooks/useRecommendation';
import { CONSTELLATION_LABELS, getConstellation } from '../utils/constellation';
import { Skeleton } from './Skeleton';

interface Props {
  satellites:          Satellite[];
  topPasses:           Pass[];
  activeConstellation: string;
  loading?:            boolean;
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


export function MetricCards({ satellites, topPasses, activeConstellation, loading }: Props) {
  const countdown = useNextPassCountdown(topPasses);

  if (loading) {
    return (
      <div className="metric-grid">
        {[0, 1, 2].map(i => (
          <div key={i} className="metric-card">
            <Skeleton height="12px" width="70%" />
            <div style={{ margin: '8px 0 4px' }}>
              <Skeleton height="40px" width="60%" />
            </div>
            <Skeleton height="10px" width="80%" />
          </div>
        ))}
      </div>
    );
  }

  const count      = satellites.length;
  const bestEl     = count > 0 ? Math.max(...satellites.map(s => s.elevation)) : 0;
  const filterLabel = activeConstellation === 'ALL'
    ? 'All constellations'
    : CONSTELLATION_LABELS[activeConstellation] ?? `${activeConstellation} only`;

  const slCount  = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'STARLINK').length;
  const owCount  = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'ONEWEB').length;
  const gpsCount = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GPS').length;
  const issCount = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'ISS').length;
  const galCount = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GALILEO').length;
  const gloCount = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GLONASS').length;

  const contextParts: string[] = [];
  if (slCount  > 0) contextParts.push(`SL ${slCount}`);
  if (owCount  > 0) contextParts.push(`OW ${owCount}`);
  if (gpsCount > 0) contextParts.push(`GPS ${gpsCount}`);
  if (issCount > 0) contextParts.push(`ISS ${issCount}`);
  if (galCount > 0) contextParts.push(`GAL ${galCount}`);
  if (gloCount > 0) contextParts.push(`GLO ${gloCount}`);
  const contextText = contextParts.join(' · ') || 'No satellites tracked';

  return (
    <div className="metric-grid">
      <div className="metric-card">
        <div className="metric-label">Satellites Overhead</div>
        <div className={`metric-value${count > 0 ? ' metric-value--green' : ''}`}>{count}</div>
        <div className="metric-sublabel">{filterLabel}</div>
        <div className="metric-context">{contextText}</div>
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

    </div>
  );
}
