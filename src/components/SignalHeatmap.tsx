import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface HeatmapDay {
  date:        string;
  avgScore:    number;
  sampleCount: number;
}

const DAYS_BACK = 91; // ~13 full weeks

function scoreToColor(score: number | null): string {
  if (score === null) return 'var(--bg-card)';
  if (score < 40)  return '#1a2d45';
  if (score < 60)  return '#2a4a6a';
  if (score < 75)  return '#3d7a9e';
  if (score < 90)  return '#4a9eff';
  return '#00ff88';
}

function dateLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long',
  });
}

// Build a padded 91-day grid starting from Monday of 13 weeks ago
function buildGrid(data: HeatmapDay[]): (HeatmapDay | null)[] {
  const map = new Map(data.map(d => [d.date, d]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Snap end to Sunday so the grid ends on a full week boundary
  const end = new Date(today);
  const endDow = end.getDay(); // 0=Sun…6=Sat
  end.setDate(end.getDate() + (7 - endDow) % 7); // advance to next Sunday (or keep if already Sun)

  // Start = 13 weeks before end (Monday)
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS_BACK + 1);

  const grid: (HeatmapDay | null)[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = cur.toISOString().split('T')[0];
    grid.push(map.get(key) ?? (cur <= today ? null : undefined as any));
    cur.setDate(cur.getDate() + 1);
  }
  return grid;
}

function buildMonthLabels(grid: (HeatmapDay | null)[]): { col: number; label: string }[] {
  const labels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  grid.forEach((_, i) => {
    const col = Math.floor(i / 7);
    const dayOfWeek = i % 7;
    if (dayOfWeek !== 0) return;
    const date = new Date(Date.now() - (DAYS_BACK - 1 - i) * 86_400_000);
    if (date.getMonth() !== lastMonth) {
      lastMonth = date.getMonth();
      labels.push({ col, label: date.toLocaleDateString('en-GB', { month: 'short' }) });
    }
  });
  return labels;
}

export function SignalHeatmap() {
  const [days,    setDays]    = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: HeatmapDay } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/insights/heatmap?days=${DAYS_BACK}`)
      .then(r => r.ok ? r.json() : { days: [] })
      .then(d => setDays(Array.isArray(d.days) ? d.days : []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, []);

  const grid       = buildGrid(days);
  const weeks      = Math.ceil(grid.length / 7);
  const daysWithData = days.filter(d => d.avgScore != null);

  // Summary stats
  const best = daysWithData.reduce<HeatmapDay | null>((a, d) => (!a || d.avgScore > a.avgScore) ? d : a, null);
  const weeklyAvgs = Array.from({ length: weeks }, (_, wi) => {
    const slice = grid.slice(wi * 7, wi * 7 + 7).filter(Boolean) as HeatmapDay[];
    if (!slice.length) return null;
    return slice.reduce((s, d) => s + d.avgScore, 0) / slice.length;
  });
  const bestWeekIdx = weeklyAvgs.reduce<number | null>((bi, avg, i) => {
    if (avg === null) return bi;
    return (bi === null || avg > (weeklyAvgs[bi] ?? 0)) ? i : bi;
  }, null);

  // Empty state
  if (!loading && daysWithData.length < 7) {
    return (
      <div className="signal-heatmap">
        <div className="heatmap-empty">
          Your signal heatmap will build up as StarTrack collects more data — check back in a few days.
        </div>
      </div>
    );
  }

  const DOW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  const CELL = 12;   // px
  const GAP  = 3;    // px
  const STEP = CELL + GAP;
  const LEFT_OFFSET = 32; // for DOW labels
  const TOP_OFFSET  = 20; // for month labels
  const svgW = LEFT_OFFSET + weeks * STEP;
  const svgH = TOP_OFFSET + 7 * STEP;

  const monthLabels = buildMonthLabels(grid);

  return (
    <div className="signal-heatmap">
      {/* Summary header */}
      {!loading && (
        <div className="heatmap-summary">
          {best && (
            <span>Best day: <strong>{dateLabel(best.date)}</strong> · {best.avgScore}/100</span>
          )}
          {best && bestWeekIdx !== null && <span className="heatmap-summary-sep">·</span>}
          {bestWeekIdx !== null && weeklyAvgs[bestWeekIdx] !== null && (
            <span>Best week: <strong>week {bestWeekIdx + 1}</strong> · {Math.round(weeklyAvgs[bestWeekIdx]!)}/100 avg</span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="heatmap-grid-wrap" onMouseLeave={() => setTooltip(null)}>
        <svg
          width={svgW}
          height={svgH}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Month labels */}
          {monthLabels.map(({ col, label }) => (
            <text
              key={col}
              x={LEFT_OFFSET + col * STEP}
              y={13}
              className="heatmap-label-text"
            >{label}</text>
          ))}

          {/* Day-of-week labels */}
          {DOW_LABELS.map((lbl, row) => lbl ? (
            <text
              key={row}
              x={LEFT_OFFSET - 4}
              y={TOP_OFFSET + row * STEP + CELL - 2}
              textAnchor="end"
              className="heatmap-label-text"
            >{lbl}</text>
          ) : null)}

          {/* Cells */}
          {grid.map((day, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            const x   = LEFT_OFFSET + col * STEP;
            const y   = TOP_OFFSET  + row * STEP;
            const color = day ? scoreToColor(day.avgScore) : 'var(--bg-raised, #0d1520)';
            return (
              <rect
                key={i}
                x={x} y={y}
                width={CELL} height={CELL}
                rx={2} ry={2}
                fill={color}
                className={day ? 'heatmap-cell heatmap-cell--has-data' : 'heatmap-cell'}
                onMouseEnter={day ? e => {
                  const svgEl = (e.target as SVGRectElement).closest('svg')!;
                  const rect  = svgEl.getBoundingClientRect();
                  setTooltip({
                    x: rect.left + x + CELL / 2,
                    y: rect.top  + y,
                    day,
                  });
                } : undefined}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="heatmap-tooltip"
            style={{
              position: 'fixed',
              left:     tooltip.x,
              top:      tooltip.y - 6,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <strong>{dateLabel(tooltip.day.date)}</strong>
            <span>{tooltip.day.avgScore}/100 avg</span>
            <span className="heatmap-tooltip-count">{tooltip.day.sampleCount} reading{tooltip.day.sampleCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span>Less</span>
        {[null, 20, 50, 70, 85, 95].map((v, i) => (
          <span
            key={i}
            className="heatmap-legend-cell"
            style={{ background: scoreToColor(v) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
