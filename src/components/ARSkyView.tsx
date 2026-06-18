import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Satellite } from '../types';
import { getConstellation, CONSTELLATION_COLORS } from '../utils/constellation';

// FOV constants (degrees)
const FOV_H      = 60;   // total: ±30° horizontal
const FOV_V      = 40;   // total: ±20° vertical
const MAX_LABELS = 15;
const SMOOTH_N   = 5;    // moving average window

function isMobileDevice(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 'ontouchstart' in window;
}

function normAngle(a: number): number {
  a = ((a % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

function circularMean(angles: number[]): number {
  if (!angles.length) return 0;
  const sinSum = angles.reduce((s, a) => s + Math.sin(a * Math.PI / 180), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos(a * Math.PI / 180), 0);
  return ((Math.atan2(sinSum, cosSum) * 180 / Math.PI) + 360) % 360;
}

const CARDINALS = [
  { label: 'N', az: 0 }, { label: 'NE', az: 45 }, { label: 'E', az: 90 },
  { label: 'SE', az: 135 }, { label: 'S', az: 180 }, { label: 'SW', az: 225 },
  { label: 'W', az: 270 }, { label: 'NW', az: 315 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

interface ProjectedSat extends Satellite {
  x: number; y: number;
  inView: boolean; dist: number;
  color: string; isTarget: boolean;
}

function Reticle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={28} fill="none" stroke="rgba(0,212,255,0.25)" strokeWidth="1"/>
      <line x1={-36} y1={0}  x2={-30} y2={0}  stroke="rgba(0,212,255,0.7)" strokeWidth="1.5"/>
      <line x1={30}  y1={0}  x2={36}  y2={0}  stroke="rgba(0,212,255,0.7)" strokeWidth="1.5"/>
      <line x1={0} y1={-36} x2={0} y2={-30}   stroke="rgba(0,212,255,0.7)" strokeWidth="1.5"/>
      <line x1={0} y1={30}  x2={0} y2={36}    stroke="rgba(0,212,255,0.7)" strokeWidth="1.5"/>
      <circle r={2.5} fill="rgba(0,212,255,0.7)"/>
    </g>
  );
}

function SatLabel({ s }: { s: ProjectedSat }) {
  const label = s.satname.replace('STARLINK-', 'SL-').slice(0, 14);
  const size  = s.isTarget ? 13 : 10;
  const color = s.isTarget ? '#fbbf24' : 'rgba(255,255,255,0.9)';
  const dotR  = s.isTarget ? 6 : s.dist < 5 ? 4 : 3;

  return (
    <g transform={`translate(${s.x},${s.y})`}>
      {s.isTarget && (
        <circle r={22} fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.85"
          strokeDasharray="4 4"/>
      )}
      {!s.isTarget && s.dist < 5 && (
        <circle r={16} fill="none" stroke={s.color} strokeWidth="1.5" opacity="0.6"/>
      )}
      <circle r={dotR} fill={s.color} opacity="0.95"/>
      {/* text with black stroke for readability */}
      <text x={8} y={-9} fontSize={size} fontFamily="'JetBrains Mono',monospace"
        fontWeight={s.isTarget ? '700' : '400'}
        stroke="rgba(0,0,0,0.75)" strokeWidth="3" paintOrder="stroke" fill={color}>
        {label}
      </text>
      <text x={8} y={-9} fontSize={size} fontFamily="'JetBrains Mono',monospace"
        fontWeight={s.isTarget ? '700' : '400'} fill={color}>
        {label}
      </text>
      <text x={8} y={-9 + size + 2} fontSize={8} fontFamily="'JetBrains Mono',monospace"
        fill="rgba(255,255,255,0.5)">
        {s.elevation.toFixed(0)}°
      </text>
    </g>
  );
}

function TargetArrow({
  target, w, h,
}: { target: ProjectedSat; w: number; h: number }) {
  const dAz  = normAngle(target.azimuth - 0);
  const dEl  = target.elevation - 0;
  // angle in SVG space: right = 0°, up = -90°
  const rad  = Math.atan2(-(target.y - h / 2), target.x - w / 2);
  const edge = Math.min(w, h) / 2 - 50;
  const ax   = w / 2 + edge * Math.cos(rad);
  const ay   = h / 2 + edge * Math.sin(rad);
  const deg  = rad * 180 / Math.PI;
  void dAz; void dEl;

  return (
    <g transform={`translate(${ax},${ay}) rotate(${deg})`}>
      <polygon points="14,0 -7,-8 -7,8" fill="#fbbf24" opacity="0.9"/>
      <text x={-30} y={5} fontSize={9} fill="#fbbf24"
        fontFamily="'JetBrains Mono',monospace" textAnchor="middle">
        {target.elevation.toFixed(0)}°
      </text>
    </g>
  );
}

function ARCardinals({
  heading, w, h,
}: { heading: number; w: number; h: number }) {
  return (
    <>
      {CARDINALS.map(({ label, az }) => {
        const dAz = normAngle(az - heading);
        if (Math.abs(dAz) > FOV_H / 2 + 10) return null;
        const x = w / 2 + (dAz / (FOV_H / 2)) * (w / 2);
        return (
          <text key={label} x={x} y={h - 24}
            fill="rgba(255,255,255,0.4)" fontSize={11}
            fontFamily="'JetBrains Mono',monospace"
            textAnchor="middle">
            {label}
          </text>
        );
      })}
    </>
  );
}

// ── Compass fallback view (no camera) ─────────────────────────────────────────

interface CompassProps {
  sorted:           Satellite[];
  heading:          number;
  pitch:            number;
  initialSatellite: Satellite | null | undefined;
}

function CompassView({ sorted, heading, pitch, initialSatellite }: CompassProps) {
  const CX = 130, CY = 130, R = 100;
  const D2R = Math.PI / 180;

  return (
    <div className="ar-compass-view">
      <div className="ar-compass-label">Compass Sky View · {Math.round(heading)}° hdg · {Math.round(pitch)}° tilt</div>
      <svg width={260} height={260} className="ar-compass-svg">
        <defs>
          <radialGradient id="arCmpBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d2318"/>
            <stop offset="100%" stopColor="#060f0b"/>
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="url(#arCmpBg)" stroke="rgba(0,212,255,0.18)" strokeWidth="1"/>
        {[30, 60].map(e => (
          <circle key={e} cx={CX} cy={CY} r={R * (1 - e / 90)}
            fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="0.75" strokeDasharray="3 3"/>
        ))}
        {/* Cardinal labels */}
        {CARDINALS.map(({ label, az }) => {
          const dAz = normAngle(az - heading);
          const rad = dAz * D2R;
          const pr  = R + 12;
          const px  = CX + pr * Math.sin(rad);
          const py  = CY - pr * Math.cos(rad);
          const isN = label === 'N';
          return (
            <text key={label} x={px} y={py + 3}
              fill={isN ? '#00d4ff' : 'rgba(255,255,255,0.35)'}
              fontSize={isN ? 11 : 8}
              fontFamily="'JetBrains Mono',monospace"
              fontWeight={isN ? '700' : '400'}
              textAnchor="middle">
              {label}
            </text>
          );
        })}
        {/* Heading needle */}
        <line
          x1={CX} y1={CY}
          x2={CX + (R - 20) * Math.sin(0)} y2={CY - (R - 20) * Math.cos(0)}
          stroke="rgba(0,212,255,0.45)" strokeWidth="1.5"
        />
        {/* Observer */}
        <circle cx={CX} cy={CY} r={4} fill="#00d4ff" opacity="0.8"/>
        {/* Satellites */}
        {sorted.map(s => {
          const dAz = normAngle(s.azimuth - heading);
          const r   = R * (1 - s.elevation / 90);
          const rad = dAz * D2R;
          const sx  = CX + r * Math.sin(rad);
          const sy  = CY - r * Math.cos(rad);
          const color = CONSTELLATION_COLORS[getConstellation(s.satname, s.constellation)] ?? '#00d4ff';
          const isTarget = s.satname === initialSatellite?.satname;
          return (
            <g key={s.satname}>
              {isTarget && (
                <circle cx={sx} cy={sy} r={9} fill="none" stroke="#fbbf24" strokeWidth="1.5"
                  strokeDasharray="3 3"/>
              )}
              <circle cx={sx} cy={sy} r={isTarget ? 5 : 3} fill={color} opacity="0.9"/>
            </g>
          );
        })}
      </svg>

      {/* Satellite list */}
      <div className="ar-compass-list">
        {sorted.slice(0, 8).map(s => {
          const color = CONSTELLATION_COLORS[getConstellation(s.satname, s.constellation)] ?? '#00d4ff';
          const isTarget = s.satname === initialSatellite?.satname;
          const az = s.azimuth;
          const cardDir = CARDINALS.reduce((best, c) => {
            const d = Math.abs(normAngle(az - c.az));
            const bd = Math.abs(normAngle(az - best.az));
            return d < bd ? c : best;
          }).label;
          return (
            <div key={s.satname} className={`ar-list-row${isTarget ? ' ar-list-row--target' : ''}`}>
              <span className="ar-list-dot" style={{ background: color }}/>
              <span className="ar-list-name">
                {s.satname.replace('STARLINK-', 'SL-').slice(0, 16)}
              </span>
              <span className="ar-list-meta">{cardDir} · {s.elevation.toFixed(0)}° el</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  satellites:        Satellite[];
  onClose:           () => void;
  initialSatellite?: Satellite | null;
}

type Phase = 'loading' | 'ios-prompt' | 'ar' | 'compass' | 'desktop';

export function ARSkyView({ satellites, onClose, initialSatellite }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headHist  = useRef<number[]>([]);
  const pitchHist = useRef<number[]>([]);
  const mobile    = isMobileDevice();

  const [phase,      setPhase]      = useState<Phase>('loading');
  const [fallback,   setFallback]   = useState(false);
  const [camFailed,  setCamFailed]  = useState(false);
  const [heading,    setHeading]    = useState(0);
  const [pitch,      setPitch]      = useState(0);
  const [oriActive,  setOriActive]  = useState(false);
  const [size,       setSize]       = useState({ w: window.innerWidth, h: window.innerHeight });

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Resize tracking
  useEffect(() => {
    function onResize() { setSize({ w: window.innerWidth, h: window.innerHeight }); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Device orientation listener (activated when oriActive flips to true)
  useEffect(() => {
    if (!oriActive) return;
    function onOri(e: DeviceOrientationEvent) {
      // webkitCompassHeading on iOS, or derive from alpha on Android
      const rawHead  = (e as any).webkitCompassHeading ?? ((360 - (e.alpha ?? 0)) % 360);
      // beta=90 → camera pointing at horizon; beta→0 → camera pointing up
      const rawPitch = 90 - (e.beta ?? 90);

      headHist.current.push(rawHead);
      if (headHist.current.length > SMOOTH_N) headHist.current.shift();
      pitchHist.current.push(rawPitch);
      if (pitchHist.current.length > SMOOTH_N) pitchHist.current.shift();

      setHeading(circularMean(headHist.current));
      setPitch(pitchHist.current.reduce((a, b) => a + b, 0) / pitchHist.current.length);
    }
    window.addEventListener('deviceorientation', onOri, true);
    return () => window.removeEventListener('deviceorientation', onOri, true);
  }, [oriActive]);

  // Camera + initial phase setup
  useEffect(() => {
    if (!mobile) {
      setPhase('desktop');
      return;
    }

    // Start camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setCamFailed(true);
        setFallback(true);
      });

    // Check if iOS orientation permission is needed
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setPhase('ios-prompt');
    } else {
      // Android or other: start directly, no permission needed
      setOriActive(true);
      setPhase(fallback ? 'compass' : 'ar');
    }

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  // When fallback toggle changes after initial load, update phase
  useEffect(() => {
    if (phase === 'loading' || phase === 'desktop' || phase === 'ios-prompt') return;
    setPhase(fallback || camFailed ? 'compass' : 'ar');
  }, [fallback, camFailed, phase]);

  async function handleIOSPermission() {
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      if (result === 'granted') {
        setOriActive(true);
        setPhase(camFailed ? 'compass' : 'ar');
      } else {
        setOriActive(false);
        setFallback(true);
        setPhase('compass');
      }
    } catch {
      setFallback(true);
      setPhase('compass');
    }
  }

  function skipToCompass() {
    setFallback(true);
    setPhase('compass');
  }

  // ── Satellite projection ────────────────────────────────────────────────────
  const sorted: Satellite[] = satellites
    .filter(s => s.elevation > 0)
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, MAX_LABELS);

  const projected: ProjectedSat[] = sorted.map(s => {
    const dAz    = normAngle(s.azimuth - heading);
    const dEl    = s.elevation - pitch;
    const x      = size.w / 2 + (dAz / (FOV_H / 2)) * (size.w / 2);
    const y      = size.h / 2 - (dEl / (FOV_V / 2)) * (size.h / 2);
    const inView = Math.abs(dAz) < FOV_H / 2 && Math.abs(dEl) < FOV_V / 2;
    const dist   = Math.hypot(dAz, dEl);
    const color  = CONSTELLATION_COLORS[getConstellation(s.satname, s.constellation)] ?? '#00d4ff';
    const isTarget = s.satname === initialSatellite?.satname;
    return { ...s, x, y, inView, dist, color, isTarget };
  });

  const inView  = projected.filter(p => p.inView);
  const target  = initialSatellite
    ? projected.find(p => p.satname === initialSatellite.satname) ?? null
    : null;

  // ── Controls bar ────────────────────────────────────────────────────────────
  const controls = (
    <div className="ar-controls">
      <button className="ar-close-btn" onClick={onClose} aria-label="Close AR sky view">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div className="ar-heading-badge">
        {oriActive
          ? `${Math.round(heading)}° hdg · ${Math.round(pitch)}° tilt`
          : 'Sensors inactive'}
      </div>
      {mobile && !camFailed && (
        <button
          className="ar-toggle-btn"
          onClick={() => setFallback(f => !f)}
          aria-label={fallback ? 'Switch to camera view' : 'Switch to compass view'}
        >
          {fallback ? '📷 Camera' : '🧭 Compass'}
        </button>
      )}
    </div>
  );

  // ── Render phases ───────────────────────────────────────────────────────────

  if (phase === 'desktop') {
    return createPortal(
      <div className="ar-overlay ar-overlay--center">
        <div className="ar-message-card">
          <div className="ar-message-icon">🔭</div>
          <div className="ar-message-title">AR Sky View</div>
          <p className="ar-message-text">
            AR Sky View overlays satellite positions on your camera feed using motion sensors.
            It requires a mobile device — use the Sky Map on desktop.
          </p>
          <button className="ar-message-close" onClick={onClose}>Close</button>
        </div>
      </div>,
      document.body,
    );
  }

  if (phase === 'loading') {
    return createPortal(
      <div className="ar-overlay ar-overlay--center">
        <div className="ar-message-card">
          <div className="ar-message-icon">📡</div>
          <div className="ar-message-title">Starting camera…</div>
        </div>
      </div>,
      document.body,
    );
  }

  if (phase === 'ios-prompt') {
    return createPortal(
      <div className="ar-overlay ar-overlay--center">
        <div className="ar-message-card">
          <div className="ar-message-icon">🧭</div>
          <div className="ar-message-title">Enable motion sensors</div>
          <p className="ar-message-text">
            Point your phone at the sky to overlay satellite positions on the camera feed.
            Motion sensors are needed to track where you're looking.
          </p>
          <button className="ar-permission-btn" onClick={handleIOSPermission}>
            Enable sensors
          </button>
          <button className="ar-permission-skip" onClick={skipToCompass}>
            Skip — use compass only
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // Compass fallback
  if (phase === 'compass') {
    return createPortal(
      <div className="ar-overlay">
        <CompassView
          sorted={sorted}
          heading={heading}
          pitch={pitch}
          initialSatellite={initialSatellite}
        />
        {controls}
      </div>,
      document.body,
    );
  }

  // Full AR view
  return createPortal(
    <div className="ar-overlay">
      <video
        ref={videoRef}
        className="ar-video"
        autoPlay
        playsInline
        muted
      />
      <svg
        className="ar-svg"
        width={size.w}
        height={size.h}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Horizon line */}
        <line
          x1={0} y1={size.h / 2}
          x2={size.w} y2={size.h / 2}
          stroke="rgba(0,212,255,0.12)" strokeWidth="1"
          strokeDasharray="6 10"
        />
        {/* Elevation guides: +30° and -10° */}
        {[30, -10].map(el => {
          const dEl = el - pitch;
          const fy  = size.h / 2 - (dEl / (FOV_V / 2)) * (size.h / 2);
          if (fy < 0 || fy > size.h) return null;
          return (
            <g key={el}>
              <line x1={0} y1={fy} x2={size.w} y2={fy}
                stroke="rgba(0,212,255,0.07)" strokeWidth="0.75" strokeDasharray="4 12"/>
              <text x={8} y={fy - 4} fill="rgba(0,212,255,0.3)"
                fontSize={9} fontFamily="'JetBrains Mono',monospace">
                {el > 0 ? `+${el}°` : `${el}°`}
              </text>
            </g>
          );
        })}
        {/* Cardinal labels along bottom */}
        <ARCardinals heading={heading} w={size.w} h={size.h}/>
        {/* Satellite labels */}
        {inView.map(s => <SatLabel key={s.satname} s={s}/>)}
        {/* Centre reticle */}
        <Reticle cx={size.w / 2} cy={size.h / 2}/>
        {/* Target direction arrow (when target is outside FOV) */}
        {target && !target.inView && (
          <TargetArrow target={target} w={size.w} h={size.h}/>
        )}
      </svg>
      {controls}
    </div>,
    document.body,
  );
}
