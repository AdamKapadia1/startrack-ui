import type { Pass } from '../hooks/useRecommendation';

function toGCalTime(utc: number): string {
  return new Date(utc * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function passScore(el: number): number {
  return Math.round(40 + (el / 90) * 60);
}

function makeCalendarUrl(pass: Pass, locationName: string): string {
  const start   = toGCalTime(pass.startUTC);
  const end     = toGCalTime(pass.endUTC ?? pass.startUTC + 600);
  const satname = pass.satname ?? 'Starlink';
  const elDeg   = Math.round(pass.maxEl);
  const score   = passScore(pass.maxEl);

  const text    = encodeURIComponent(`StarTrack: ${satname} Pass (${elDeg}°)`);
  const details = encodeURIComponent(
    `Starlink satellite pass over ${locationName}. ` +
    `Max elevation: ${elDeg}°. Signal score: ${score} pts. ` +
    `Connect via StarTrack AI: https://startrackv1-ui.vercel.app`,
  );
  const loc = encodeURIComponent(locationName);

  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${text}&dates=${start}/${end}&details=${details}&location=${loc}`
  );
}

// ── Single-pass calendar button ────────────────────────────────────────────────

interface CalBtnProps {
  pass:         Pass;
  locationName: string;
}

export function CalendarButton({ pass, locationName }: CalBtnProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(makeCalendarUrl(pass, locationName), '_blank', 'noopener');
  }

  return (
    <button
      className="cal-btn"
      onClick={handleClick}
      title="Add to Google Calendar"
      aria-label="Add pass to Google Calendar"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
    </button>
  );
}

// ── Bulk export button (top 3 passes) ─────────────────────────────────────────

interface BulkProps {
  passes:       Pass[];
  locationName: string;
}

export function BulkExportButton({ passes, locationName }: BulkProps) {
  if (!passes.length) return null;

  function handleClick() {
    passes.slice(0, 3).forEach(pass => {
      window.open(makeCalendarUrl(pass, locationName), '_blank', 'noopener');
    });
  }

  return (
    <button className="bulk-cal-btn" onClick={handleClick}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
      Export top 3 passes to Calendar
    </button>
  );
}
