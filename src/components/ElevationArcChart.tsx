import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceArea,
} from 'recharts';

interface Props {
  satellite:     string;
  peakElevation: number;
  peakTime:      number;  // UTC seconds of peak
  duration:      number;  // seconds
}

interface DataPoint { t: number; el: number; }

function generateArc(peakEl: number, durationSecs: number, points = 24): DataPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const frac = i / (points - 1);
    const t    = frac * durationSecs;
    const el   = Math.max(0, peakEl * Math.sin(Math.PI * frac));
    return { t: parseFloat((t / 60).toFixed(2)), el: parseFloat(el.toFixed(1)) };
  });
}

function formatBST(utc: number): string {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function passScore(el: number): number {
  return Math.round(40 + (el / 90) * 60);
}

function qualityInfo(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: '#00d4ff' };
  if (score >= 70) return { label: 'Good',      color: '#14b8a6' };
  if (score >= 50) return { label: 'Fair',       color: '#ffb800' };
  return              { label: 'Poor',      color: '#4a6080' };
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: DataPoint = payload[0].payload;
  return (
    <div className="arc-tooltip">
      <div>{d.t.toFixed(1)} min</div>
      <div style={{ color: '#00d4ff', fontWeight: 700 }}>{d.el.toFixed(1)}°</div>
    </div>
  );
}

export function ElevationArcChart({ satellite, peakElevation, peakTime, duration }: Props) {
  const data       = generateArc(peakElevation, duration);
  const peakMinute = parseFloat(((duration / 2) / 60).toFixed(2));
  const durationM  = (duration / 60).toFixed(1);
  const score      = passScore(peakElevation);
  const quality    = qualityInfo(score);
  const yMax       = Math.min(90, Math.ceil(peakElevation / 10) * 10 + 10);

  return (
    <div className="arc-chart-wrap">
      {/* Header row */}
      <div className="arc-chart-hdr">
        <span className="arc-chart-title">{satellite} · {durationM} min pass</span>
        <span className="arc-chart-badge" style={{ color: quality.color, borderColor: quality.color }}>
          {quality.label} · {score} pts
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 20, left: 28 }}>
          <defs>
            <linearGradient id="arcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.35}/>
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1a2e24" vertical={false}/>

          {/* Optimal zone (60°+) */}
          {peakElevation >= 60 && (
            <ReferenceArea
              y1={60} y2={yMax}
              fill="#00d4ff" fillOpacity={0.06}
              label={{ value: 'Optimal', position: 'insideTopLeft', fill: '#00d4ff', fontSize: 8, dy: 2 }}
            />
          )}

          {/* 10° minimum threshold */}
          <ReferenceLine
            y={10} stroke="#ffb800" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: 'Min 10°', position: 'insideBottomRight', fill: '#ffb800', fontSize: 8 }}
          />

          {/* Peak moment */}
          <ReferenceLine
            x={peakMinute} stroke="#00d4ff" strokeDasharray="4 3" strokeWidth={1}
            label={{
              value: `${peakElevation.toFixed(0)}° at ${formatBST(peakTime)}`,
              position: 'top', fill: '#00d4ff', fontSize: 8,
            }}
          />

          <XAxis
            dataKey="t"
            type="number"
            domain={[0, parseFloat(durationM)]}
            tickFormatter={v => `${v.toFixed(0)}m`}
            tick={{ fill: '#3a4f47', fontSize: 9, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#1a2e24' }}
            tickLine={false}
            label={{ value: 'Minutes from start', position: 'insideBottom', fill: '#3a4f47', fontSize: 8, dy: 14 }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={v => `${v}°`}
            tick={{ fill: '#3a4f47', fontSize: 9, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#1a2e24' }}
            tickLine={false}
            width={24}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00d4ff', strokeWidth: 1, strokeDasharray: '3 3' }}/>

          <Area
            type="monotone"
            dataKey="el"
            stroke="#00d4ff"
            strokeWidth={2}
            fill="url(#arcGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#00d4ff', stroke: '#fff', strokeWidth: 1 }}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
