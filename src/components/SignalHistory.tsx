import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, type DotProps,
} from 'recharts';
import { SIGNAL_HISTORY_KEY } from '../hooks/useSatellites';
import type { SignalHistoryPoint } from '../hooks/useSatellites';

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function loadHistory(): SignalHistoryPoint[] {
  try {
    const raw = localStorage.getItem(SIGNAL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface Props {
  signalScore?: number;
}

export function SignalHistory({ signalScore }: Props) {
  const [data, setData] = useState<SignalHistoryPoint[]>(() => loadHistory());
  const isMobile        = useIsMobile();

  // Re-read localStorage whenever a new score arrives
  useEffect(() => {
    if (signalScore == null) return;
    setData(loadHistory());
  }, [signalScore]);

  const hours   = isMobile ? 24 : 48;
  const label   = `Signal History — Last ${hours} Hours`;
  const cutoff  = Date.now() - hours * 60 * 60 * 1_000;

  const chartData = useMemo(() =>
    data
      .filter(d => d.timestamp >= cutoff)
      .map(d => ({ time: formatTime(d.timestamp), score: d.score })),
    [data, cutoff],
  );

  const ticks = useMemo(() => {
    if (chartData.length === 0) return [];
    if (chartData.length <= 4) return chartData.map(d => d.time);
    const n = chartData.length - 1;
    return [0, Math.round(n / 3), Math.round(2 * n / 3), n].map(i => chartData[i].time);
  }, [chartData]);

  function LatestDot(props: DotProps & { index?: number }) {
    const { cx, cy, index } = props;
    if (index !== chartData.length - 1 || cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={4} fill="#00d4ff" stroke="var(--bg-primary)" strokeWidth={1.5}/>;
  }

  function clearHistory() {
    try { localStorage.removeItem(SIGNAL_HISTORY_KEY); } catch { /* ignore */ }
    setData([]);
  }

  if (!data.length) {
    return (
      <div className="history-section">
        <div className="section-label">{label}</div>
        <div className="history-empty">No history yet — data appears after the first satellite scan.</div>
      </div>
    );
  }

  return (
    <div className="history-section">
      <div className="section-label">{label}</div>
      <div className="history-chart-wrap">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" vertical={false}/>
            <XAxis
              dataKey="time"
              ticks={ticks}
              tick={{ fill: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              width={36}
              label={{ value: 'Signal', angle: -90, position: 'insideLeft', fill: 'var(--text-tertiary)', fontSize: 8, dx: 10 }}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              itemStyle={{ color: '#00d4ff' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              dot={<LatestDot/>}
              activeDot={{ r: 3, fill: '#00d4ff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <button className="history-clear-btn" onClick={clearHistory}>Clear history</button>
    </div>
  );
}
