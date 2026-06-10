import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface HistoryPoint {
  computed_at:  string;
  signal_score: number;
  max_elevation: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function SignalHistory() {
  const [data, setData]   = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL ?? '';
    fetch(`${base}/api/history`)
      .then(r => r.json())
      .then((rows: HistoryPoint[]) => { setData(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="history-section">
        <div className="section-label">Signal History — Last 48 Hours</div>
        <div className="history-empty">Loading…</div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="history-section">
        <div className="section-label">Signal History — Last 48 Hours</div>
        <div className="history-empty">No history yet — data appears after the first satellite scan.</div>
      </div>
    );
  }

  const chartData = data.map(d => ({
    time:  formatTime(d.computed_at),
    score: d.signal_score,
  }));

  return (
    <div className="history-section">
      <div className="section-label">Signal History — Last 48 Hours</div>
      <div className="history-chart-wrap">
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,158,117,0.07)" vertical={false}/>
            <XAxis
              dataKey="time"
              tick={{ fill: '#3a4f47', fontSize: 9, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#3a4f47', fontSize: 9, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickCount={3}
            />
            <Tooltip
              contentStyle={{ background: '#0f1512', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#7a9187' }}
              itemStyle={{ color: '#1D9E75' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#1D9E75"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#1D9E75' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
