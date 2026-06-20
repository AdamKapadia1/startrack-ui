import { useState, useEffect } from 'react';
import type { Satellite, ScoreBreakdown } from '../types';
import type { Pass, RecommendationData } from '../hooks/useRecommendation';
import { getConstellation } from '../utils/constellation';

interface Props {
  satellites:      Satellite[];
  signalScore?:    number;
  scoreBreakdown?: ScoreBreakdown;
  lastUpdated:     Date | null;
  recData:         RecommendationData | null;
  recLoading:      boolean;
  starlinkSat:     Satellite | null;
  topSat:          Satellite | null;
  topPasses:       Pass[];
  onViewSkyMap:    () => void;
}

const RING_R    = 32;
const RING_C    = 40;
const RING_CIRC = 2 * Math.PI * RING_R;

function ringColor(score: number): string {
  if (score >= 70) return '#3dd68c';
  if (score >= 40) return '#ffb800';
  return '#ff4444';
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Poor';
}

function useAgoSecs(date: Date | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!date) return;
    const tick = () => setSecs(Math.round((Date.now() - date.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [date]);
  return secs;
}

function useNextPassCountdown(passes: Pass[]): string {
  const [display, setDisplay] = useState('--:--');
  useEffect(() => {
    const tick = () => {
      const now  = Math.floor(Date.now() / 1000);
      const next = passes.find(p => p.startUTC > now);
      if (!next) { setDisplay('--:--'); return; }
      const diff = next.startUTC - now;
      if (diff > 24 * 3600) { setDisplay('>24h'); return; }
      if (diff >= 3600) {
        setDisplay(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`);
      } else {
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        setDisplay(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [passes]);
  return display;
}

export function MobileOverview({
  satellites, signalScore, scoreBreakdown, lastUpdated,
  recData, recLoading, starlinkSat, topSat, topPasses, onViewSkyMap,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const secsAgo  = useAgoSecs(lastUpdated);
  const countdown = useNextPassCountdown(topPasses);

  const score = signalScore ?? 0;
  const color = ringColor(score);
  const label = scoreLabel(score);
  const dash  = (score / 100) * RING_CIRC;
  const count = satellites.length;
  const bd    = scoreBreakdown;

  const sl  = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'STARLINK').length;
  const ow  = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'ONEWEB').length;
  const gps = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GPS').length;
  const gal = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GALILEO').length;
  const glo = satellites.filter(s => getConstellation(s.satname, s.constellation) === 'GLONASS').length;

  const bestEl = topSat ? topSat.elevation.toFixed(1) : '0.0';

  const updatedStr = lastUpdated
    ? secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`
    : 'Waiting...';

  const recommendation = recData?.recommendation ?? '';

  const todayCount    = recData?.today?.length    ?? 0;
  const tomorrowCount = recData?.tomorrow?.length ?? 0;
  const passLine = todayCount > 0
    ? `${todayCount} pass${todayCount > 1 ? 'es' : ''} today`
    : tomorrowCount > 0
      ? `${tomorrowCount} pass${tomorrowCount > 1 ? 'es' : ''} tomorrow`
      : '';

  return (
    <div className="mobile-overview">

      {/* 1. Hero status card */}
      <div
        className="mob-hero-card"
        onClick={() => bd && setShowBreakdown(v => !v)}
        style={{ cursor: bd ? 'pointer' : 'default' }}
        role={bd ? 'button' : undefined}
        aria-label={bd ? (showBreakdown ? 'Close signal breakdown' : 'Open signal breakdown') : undefined}
      >
        <div className="mob-hero-ring-wrap">
          <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
            <circle
              cx={RING_C} cy={RING_C} r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="7"
            />
            <circle
              cx={RING_C} cy={RING_C} r={RING_R}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${RING_CIRC}`}
              transform={`rotate(-90 ${RING_C} ${RING_C})`}
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
            />
          </svg>
          <div className="mob-hero-ring-center">
            <span className="mob-hero-ring-num" style={{ color }}>{score}</span>
          </div>
        </div>

        <div className="mob-hero-info">
          <div className="mob-hero-status" style={{ color }}>{label} signal</div>
          <div className="mob-hero-sats">{count} satellites overhead</div>
          <div className="mob-hero-updated">Updated {updatedStr}</div>
          {bd && (
            <div className="mob-hero-hint">
              {showBreakdown ? 'Tap to close' : 'Tap for breakdown'}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown panel */}
      {showBreakdown && bd && (
        <div className="mob-breakdown-panel">
          <div className="mob-bk-row"><span>Elevation</span><span>{bd.elevation}<em>/50</em></span></div>
          <div className="mob-bk-row"><span>Cloud cover</span><span>{bd.cloud}<em>/20</em></span></div>
          <div className="mob-bk-row"><span>Visibility</span><span>{bd.visibility}<em>/15</em></span></div>
          <div className="mob-bk-row"><span>Wind</span><span>{bd.wind}<em>/10</em></span></div>
          <div className="mob-bk-row"><span>Range</span><span>{bd.range}<em>/5</em></span></div>
          <div className="mob-bk-row mob-bk-row--total">
            <span>Total</span>
            <span>{score}<em>/100</em></span>
          </div>
        </div>
      )}

      {/* 2. AI recommendation card */}
      <div className="mob-ai-card">
        <div className="mob-ai-head">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#a78bfa', flexShrink: 0 }}>
            <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2Z"/>
          </svg>
          <span className="mob-ai-label">AI RECOMMENDATION</span>
        </div>

        {recLoading && !recommendation ? (
          <div className="mob-ai-loading">
            <div className="skeleton" style={{ height: 12, width: '92%', borderRadius: 4, marginBottom: 6 }}/>
            <div className="skeleton" style={{ height: 12, width: '72%', borderRadius: 4 }}/>
          </div>
        ) : (
          <p className="mob-ai-text">{recommendation}</p>
        )}

        {passLine && (
          <p className="mob-ai-secondary">{passLine}</p>
        )}

        {starlinkSat && (
          <div className="mob-ai-dtc">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4.5 16.5c-1.5 1.5-1.5 4 0 5.5s4 1.5 5.5 0l10-10c1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0"/>
              <path d="M8 8l8 8"/>
            </svg>
            <span>{starlinkSat.satname} at {starlinkSat.elevation.toFixed(1)}°, Direct-to-Cell active</span>
          </div>
        )}
      </div>

      {/* 3. Stats grid */}
      <div className="mob-stats-grid">
        <div className="mob-stats-card">
          <div className="mob-stats-label">BEST ELEVATION NOW</div>
          <div className="mob-stats-value">
            {bestEl}<span className="mob-stats-unit">°</span>
          </div>
        </div>
        <div className="mob-stats-card">
          <div className="mob-stats-label">NEXT PEAK PASS</div>
          <div className="mob-stats-value">{countdown}</div>
        </div>
      </div>

      {/* 4. Constellation mono row */}
      {count > 0 && (
        <div className="mob-const-row" aria-label="Constellation breakdown">
          {sl  > 0 && <span>SL {sl}</span>}
          {ow  > 0 && <><span className="mob-const-sep" aria-hidden="true">·</span><span>OW {ow}</span></>}
          {gps > 0 && <><span className="mob-const-sep" aria-hidden="true">·</span><span>GPS {gps}</span></>}
          {gal > 0 && <><span className="mob-const-sep" aria-hidden="true">·</span><span>GAL {gal}</span></>}
          {glo > 0 && <><span className="mob-const-sep" aria-hidden="true">·</span><span>GLO {glo}</span></>}
        </div>
      )}

      {/* 5. Sky map link bar */}
      <button className="mob-skymap-bar" onClick={onViewSkyMap}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l3 3"/>
        </svg>
        View live sky map
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ marginLeft: 'auto' }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

    </div>
  );
}
