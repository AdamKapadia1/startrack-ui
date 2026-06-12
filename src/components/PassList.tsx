import { useState, useEffect, useRef } from 'react';
import type { Pass } from '../hooks/useRecommendation';
import { CalendarButton, BulkExportButton } from './CalendarExport';
import { ElevationArcChart } from './ElevationArcChart';
import { PassShare } from './PassShare';
import { Skeleton } from './Skeleton';

interface Props {
  passes:       Pass[];
  satname:      string;
  locationName: string;
  loading?:     boolean;
}

function elevColor(el: number) {
  if (el >= 60) return 'var(--green)';
  if (el >= 30) return 'var(--amber)';
  return 'var(--grey)';
}

function passScore(el: number): number {
  return Math.round(40 + (el / 90) * 60);
}

function qualityInfo(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: '#00d4ff' };
  if (score >= 70) return { label: 'Good',      color: '#00d4ff' };
  if (score >= 50) return { label: 'Fair',       color: '#ffb800' };
  return              { label: 'Poor',      color: '#ff4444' };
}

function formatTime(utc: number) {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function shortName(name: string) {
  return name.replace('STARLINK-', 'SL-').replace('SPACE STATION', 'ISS').slice(0, 14);
}

export function PassList({ passes, satname, locationName, loading }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // Scroll expanded chart into view on mobile
  useEffect(() => {
    if (selectedIdx === null) return;
    const el = chartRefs.current.get(selectedIdx);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIdx]);

  if (loading && !passes.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[0, 1, 2].map(i => (
          <Skeleton key={i} width="100%" height="48px" borderRadius="6px" />
        ))}
      </div>
    );
  }

  if (!passes.length) {
    return <div className="pass-empty">No passes in the next 7 days</div>;
  }

  function toggle(i: number) {
    setSelectedIdx(prev => prev === i ? null : i);
  }

  return (
    <>
      <BulkExportButton passes={passes} locationName={locationName} />
      <div className="pass-list-head">
        <span>Satellite</span>
        <span>Elevation</span>
        <span>Quality</span>
        <span>Time (BST)</span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="pass-list-body">
        {passes.map((pass, i) => {
          const color    = elevColor(pass.maxEl);
          const score    = passScore(pass.maxEl);
          const quality  = qualityInfo(score);
          const pct      = `${Math.round((pass.maxEl / 90) * 100)}%`;
          const dur      = pass.duration ?? (pass.endUTC ? pass.endUTC - pass.startUTC : 0);
          const isOpen   = selectedIdx === i;
          const satLabel = shortName(pass.satname ?? satname);

          return (
            <div key={i} className="pass-row-group">
              {/* ── Pass summary row ── */}
              <div
                className={`pass-row pass-row-clickable${isOpen ? ' pass-row-open' : ''}`}
                onClick={() => toggle(i)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggle(i)}
                aria-expanded={isOpen}
              >
                <div className="pass-name">
                  {satLabel}
                  {dur > 0 && <span className="pass-dur">{formatDuration(dur)}</span>}
                </div>
                <div className="pass-bar-wrap">
                  <div className="pass-bar" style={{ width: pct, background: color }}/>
                </div>
                <div className="pass-quality" style={{ color: quality.color }}>
                  {quality.label}
                </div>
                <div className="pass-time">{formatTime(pass.startUTC)}</div>
                <CalendarButton pass={pass} locationName={locationName} />
                <PassShare
                  startUTC={pass.startUTC}
                  maxEl={pass.maxEl}
                  satname={pass.satname ?? satname}
                  locationName={locationName}
                />
                <div className="pass-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* ── Elevation arc chart (expands below row) ── */}
              <div
                ref={el => { chartRefs.current.set(i, el); }}
                className={`pass-arc-wrap${isOpen ? ' open' : ''}`}
              >
                {isOpen && (
                  <ElevationArcChart
                    satellite={pass.satname ?? satname}
                    peakElevation={pass.maxEl}
                    peakTime={pass.maxUTC}
                    duration={dur > 0 ? dur : 600}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
