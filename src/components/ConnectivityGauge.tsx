import { useState, useEffect } from 'react';
import type { Satellite, ScoreBreakdown } from '../types';

interface Props {
  satellites:     Satellite[];
  lastUpdated:    Date | null;
  signalScore?:   number;
  scoreBreakdown?: ScoreBreakdown;
}

const R    = 32;
const C    = 40;
const CIRC = 2 * Math.PI * R;

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

export function ConnectivityGauge({ satellites, lastUpdated, signalScore, scoreBreakdown }: Props) {
  const [secsAgo, setSecsAgo]         = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => setSecsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Use API-provided score if available, else fall back to local computation
  const score = signalScore ?? (satellites.length === 0 ? 0 : Math.min(100, Math.round(
    satellites.length * 6 +
    (satellites.reduce((s, x) => s + x.elevation, 0) / satellites.length) * 0.4 +
    (Math.max(...satellites.map(s => s.elevation)) > 60 ? 15 : 8)
  )));

  const color = scoreColor(score);
  const label = scoreLabel(score);
  const dash  = (score / 100) * CIRC;
  const count = satellites.length;

  const bd = scoreBreakdown;

  return (
    <div className="gauge-section">
      <div
        className="gauge-wrap"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ cursor: bd ? 'help' : 'default' }}
      >
        <svg className="gauge-svg" viewBox="0 0 80 80">
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
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

        {showTooltip && bd && (
          <div className="score-tooltip">
            <div className="score-tooltip-title">Score Breakdown</div>
            <div className="score-tooltip-row">
              <span>Elevation</span><span>{bd.elevation}<em>/50</em></span>
            </div>
            <div className="score-tooltip-row">
              <span>Cloud Cover</span><span>{bd.cloud}<em>/20</em></span>
            </div>
            <div className="score-tooltip-row">
              <span>Visibility</span><span>{bd.visibility}<em>/15</em></span>
            </div>
            <div className="score-tooltip-row">
              <span>Wind</span><span>{bd.wind}<em>/10</em></span>
            </div>
            <div className="score-tooltip-row">
              <span>Range</span><span>{bd.range}<em>/5</em></span>
            </div>
            <div className="score-tooltip-total">
              <span>Total</span><span>{score}<em>/100</em></span>
            </div>
          </div>
        )}
      </div>

      <div className="gauge-info">
        <div className="gauge-status" style={{ color }}>{label}</div>
        <div className="gauge-sub">{count} sat{count !== 1 ? 's' : ''} · {label.toLowerCase()} signal</div>
        <div className="gauge-updated">
          {lastUpdated ? `Updated ${secsAgo}s ago` : 'Waiting for data…'}
        </div>
        {bd && (
          <div className="gauge-updated" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v1M12 12v4" strokeLinecap="round"/>
            </svg>
            Hover for breakdown
          </div>
        )}
      </div>
    </div>
  );
}
