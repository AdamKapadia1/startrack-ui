import { useState, useEffect, useRef } from 'react';
import type { Satellite } from '../types';
import { getConstellation, CONSTELLATION_COLORS } from '../utils/constellation';

const API_BASE   = import.meta.env.VITE_API_URL ?? 'https://web-production-98c0d.up.railway.app';
const SITE       = 'https://startrack-delta.vercel.app';
const REFRESH_MS = 30_000;

const CX = 60, CY = 60, R = 50;

function toXY(az: number, el: number) {
  const r     = R * (1 - el / 90);
  const angle = (az - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function dotColor(name: string, constellation?: string | null): string {
  const c = getConstellation(name, constellation);
  return CONSTELLATION_COLORS[c] ?? '#4a8fa8';
}

interface SatData {
  satellites:   Satellite[];
  signalScore:  number;
}

export function EmbedWidget() {
  const params  = new URLSearchParams(window.location.search);
  const lat     = parseFloat(params.get('lat') ?? '51.7957');
  const lon     = parseFloat(params.get('lon') ?? '-0.6572');
  const alt     = parseFloat(params.get('alt') ?? '148');
  const compact = params.get('compact') === '1';

  const [data,    setData]    = useState<SatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSec, setLastSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    try {
      const r = await fetch(
        `${API_BASE}/api/satellites/visible?lat=${lat}&lon=${lon}&alt=${alt}`,
      );
      if (!r.ok) throw new Error('fetch failed');
      const json = await r.json();
      setData({ satellites: json.satellites ?? [], signalScore: json.signalScore ?? 0 });
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
      setLastSec(0);
    }
  }

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown to next refresh
  useEffect(() => {
    const id = setInterval(() => setLastSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const sats      = data?.satellites ?? [];
  const overhead  = sats.length;
  const bestEl    = sats.reduce((m, s) => Math.max(m, s.elevation), 0);
  const score     = data?.signalScore ?? 0;
  const scoreColor = score >= 70 ? '#00d4ff' : score >= 40 ? '#ffb800' : '#4a6080';
  const secsLeft  = Math.max(0, Math.round(REFRESH_MS / 1000) - lastSec);

  const topSats = [...sats]
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, 40);

  if (compact) {
    // Ultra-compact single-line badge mode
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#080c14', borderRadius: 8,
        padding: '6px 12px', fontFamily: 'monospace',
        border: '1px solid #1a2d45', color: '#c8dff0',
        fontSize: 12, width: 'fit-content',
      }}>
        <span style={{ color: '#00ff88', fontWeight: 700 }}>{overhead}</span>
        <span style={{ color: '#4a6080' }}>sats</span>
        <span style={{ color: '#1a2d45' }}>|</span>
        <span style={{ color: scoreColor, fontWeight: 700 }}>{score}</span>
        <span style={{ color: '#4a6080' }}>signal</span>
        <span style={{ color: '#1a2d45' }}>|</span>
        <a href={SITE} target="_blank" rel="noopener noreferrer"
          style={{ color: '#00d4ff', textDecoration: 'none', fontSize: 10 }}>
          StarTrack
        </a>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 200,
      background: 'linear-gradient(160deg, #0d1f3c 0%, #080c14 100%)',
      borderRadius: 8, overflow: 'hidden', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column',
      border: '1px solid #1a2d45', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 0',
      }}>
        <span style={{ color: '#00d4ff', fontSize: 10, fontWeight: 700, letterSpacing: '1px' }}>
          STARTRACK<sup style={{ fontSize: 7 }}>AI</sup>
        </span>
        <span style={{ color: '#2a4050', fontSize: 9 }}>
          {loading ? 'loading…' : `↻ ${secsLeft}s`}
        </span>
      </div>

      {/* Main row: stats + sky map */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '4px 12px 0', gap: 8 }}>

        {/* Stats column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Satellites overhead */}
          <div>
            <div style={{ color: '#3a5a70', fontSize: 9, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Overhead</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ color: '#00ff88', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {loading ? '—' : overhead}
              </span>
              <span style={{ color: '#3a5a70', fontSize: 10 }}>sats</span>
            </div>
          </div>

          {/* Best elevation */}
          <div>
            <div style={{ color: '#3a5a70', fontSize: 9, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Best El</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{
                fontSize: 20, fontWeight: 700, lineHeight: 1,
                color: bestEl >= 60 ? '#00d4ff' : bestEl >= 30 ? '#ffb800' : '#4a6080',
              }}>
                {loading ? '—' : `${bestEl.toFixed(0)}°`}
              </span>
            </div>
          </div>

          {/* Signal score */}
          <div>
            <div style={{ color: '#3a5a70', fontSize: 9, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Signal</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ color: scoreColor, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                {loading ? '—' : score}
              </span>
              <span style={{ color: '#3a5a70', fontSize: 9 }}>/100</span>
            </div>
          </div>
        </div>

        {/* Mini sky map */}
        <div style={{ flexShrink: 0 }}>
          <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
            <defs>
              <radialGradient id="wBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#0d2318"/>
                <stop offset="100%" stopColor="#060f0b"/>
              </radialGradient>
            </defs>
            {/* Background */}
            <circle cx={CX} cy={CY} r={R} fill="url(#wBg)" stroke="rgba(0,212,255,0.15)" strokeWidth="1"/>
            {/* Rings at 30°, 60° */}
            {[R * (30/90), R * (60/90)].map((r, i) => (
              <circle key={i} cx={CX} cy={CY} r={r}
                fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="0.75" strokeDasharray="2 2"/>
            ))}
            {/* Crosshairs */}
            <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(0,212,255,0.06)" strokeWidth="0.5"/>
            <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(0,212,255,0.06)" strokeWidth="0.5"/>
            {/* Satellites */}
            {topSats.map((s, i) => {
              const { x, y } = toXY(s.azimuth, s.elevation);
              const color    = dotColor(s.satname, s.constellation);
              const isIss    = getConstellation(s.satname, s.constellation) === 'ISS';
              return (
                <circle key={i} cx={x} cy={y} r={isIss ? 4 : 2}
                  fill={color} opacity={s.elevation >= 30 ? 0.9 : 0.45}/>
              );
            })}
            {/* Observer */}
            <circle cx={CX} cy={CY} r="2.5" fill="#3b82f6" opacity="0.9"/>
          </svg>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 12px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: '#1e3a50', fontSize: 9 }}>
          {lat.toFixed(2)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
        </span>
        <a
          href={SITE}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2a4a5a', fontSize: 9, textDecoration: 'none' }}
        >
          Powered by StarTrack AI →
        </a>
      </div>
    </div>
  );
}
