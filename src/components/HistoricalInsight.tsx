import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const API_BASE     = import.meta.env.VITE_API_URL ?? 'https://web-production-98c0d.up.railway.app';
const DATA_GOAL    = 500; // show progress toward this point count

interface HourScore { hour: number; avgScore: number; }

interface PatternData {
  available:    true;
  insight:      string;
  bestHours:    HourScore[];
  worstHours:   HourScore[];
  trend:        string;
  hourlyScores: HourScore[];
}

interface PatternUnavailable {
  available:   false;
  message:     string;
  dataPoints?: number;
}

type PatternResult = PatternData | PatternUnavailable;

// Strips all dash variants used as clause separators (em dash U+2014, en dash U+2013,
// horizontal bar U+2015, minus sign U+2212) in spaced and unspaced forms.
function sanitiseDashes(text: string): string {
  return text
    .replace(/ *[—–―−] */g, ', ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function fmtHour(h: number): string {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function HistoricalInsight() {
  const [result,  setResult]  = useState<PatternResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [netError, setNetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNetError(null);

    fetch(`${API_BASE}/api/insights/patterns`)
      .then(async r => {
        // Always parse JSON — even error responses from our API carry available:false
        const json = await r.json().catch(() => null);
        if (!json) throw new Error(`HTTP ${r.status} — no JSON body`);
        return json as PatternResult;
      })
      .then((d: PatternResult) => { if (!cancelled) { setResult(d); setLoading(false); } })
      .catch((e: Error) => {
        if (!cancelled) { setNetError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="insight-section">
        <div className="section-label"><span>Pattern Insight</span></div>
        <div className="insight-body insight-loading">
          <div className="skeleton" style={{ height: 12, width: '80%', borderRadius: 4, marginBottom: 8 }}/>
          <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4, marginBottom: 8 }}/>
          <div className="skeleton" style={{ height: 80, borderRadius: 4 }}/>
        </div>
      </div>
    );
  }

  // ── Genuine network failure (fetch threw — no response at all) ────────────────
  if (netError && !result) {
    return (
      <div className="insight-section">
        <div className="section-label">Pattern Insight</div>
        <div className="insight-body insight-unavail">
          <p className="insight-unavail-text" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            Could not load pattern data.
          </p>
        </div>
      </div>
    );
  }

  // ── Building / insufficient data ──────────────────────────────────────────────
  if (!result || !result.available) {
    const pts     = result?.dataPoints ?? 0;
    const pct     = Math.min(100, Math.round((pts / DATA_GOAL) * 100));
    return (
      <div className="insight-section">
        <div className="section-label"><span>Pattern Insight</span></div>
        <div className="insight-body insight-unavail">
          <div className="insight-building-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="insight-unavail-text">
            Building your personal insights. Check back in a few days.
          </p>
          <p className="insight-unavail-sub">
            {pts.toLocaleString()} data points collected. Patterns appear after ~{DATA_GOAL.toLocaleString()}
          </p>
          <div className="insight-progress-bar-wrap">
            <div className="insight-progress-bar-track">
              <div className="insight-progress-bar-fill" style={{ width: `${pct}%` }}/>
            </div>
            <span className="insight-progress-label">{pct}%</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Full analysis ─────────────────────────────────────────────────────────────
  const bestSet  = new Set(result.bestHours.map(b => b.hour));
  const worstSet = new Set(result.worstHours.map(w => w.hour));

  function barColor(hour: number): string {
    if (bestSet.has(hour))  return '#4a8a6a';
    if (worstSet.has(hour)) return '#7a3a3a';
    return '#1a3050';
  }

  return (
    <div className="insight-section">
      <div className="section-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-purple)" style={{ flexShrink: 0 }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>Pattern Insight</span>
      </div>

      <div className="insight-body">
        <p className="insight-text">{sanitiseDashes(result.insight)}</p>

        <div className="insight-trend">
          <span className="insight-trend-label">7-day trend</span>
          <span
            className="insight-trend-value"
            style={{
              color: result.trend.startsWith('improving') ? 'var(--accent-secondary)'
                   : result.trend.startsWith('declining')  ? 'var(--accent-danger)'
                   : 'var(--text-secondary)',
            }}
          >
            {result.trend}
          </span>
        </div>

        <div className="insight-chart-wrap">
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={result.hourlyScores} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={7}>
              <XAxis
                dataKey="hour"
                tickFormatter={fmtHour}
                ticks={[0, 6, 12, 18, 23]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 8, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 8, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                tickCount={3}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: 5,
                  fontSize: 10,
                }}
                formatter={(v: unknown) => [`${v}/100`, 'Avg signal']}
                labelFormatter={(h: unknown) => `${fmtHour(Number(h))} (${h}:00)`}
              />
              <Bar dataKey="avgScore" radius={[2, 2, 0, 0]}>
                {result.hourlyScores.map(entry => (
                  <Cell key={entry.hour} fill={barColor(entry.hour)}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="insight-chart-legend">
            <span><span className="insight-legend-dot" style={{ background: '#4a8a6a' }}/> Best hours</span>
            <span><span className="insight-legend-dot" style={{ background: '#7a3a3a' }}/> Weakest hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
