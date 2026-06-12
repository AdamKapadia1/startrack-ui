import { useState, useEffect, useRef } from 'react';
import type { Pass } from '../hooks/useRecommendation';
import type { AlertConfig } from './AlertSettings';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function passScore(el: number): number { return Math.round(40 + (el / 90) * 60); }

interface Props { passes: Pass[] }

export function CountdownBanner({ passes }: Props) {
  const [settings, setSettings] = useState<AlertConfig>({
    minElevation: 60, alertMinutesBefore: 10, enabled: true,
  });
  const [now,          setNow]          = useState(Math.floor(Date.now() / 1000));
  const [dismissedKey, setDismissedKey] = useState<number | null>(null);
  const notifiedRef = useRef(new Set<number>());

  // Fetch / poll settings every 30 s
  useEffect(() => {
    function fetch_() {
      fetch(`${API_BASE}/api/notifications/settings`)
        .then(r => r.json()).then(setSettings).catch(() => {});
    }
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, []);

  // 1-second clock
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!settings.enabled || !passes.length) return null;

  const imminentPass = passes.find(p =>
    p.maxEl >= settings.minElevation &&
    p.startUTC > now &&
    (p.startUTC - now) <= settings.alertMinutesBefore * 60 &&
    p.startUTC !== dismissedKey
  );

  if (!imminentPass) return null;

  // Fire browser notification once per pass
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    !notifiedRef.current.has(imminentPass.startUTC)
  ) {
    notifiedRef.current.add(imminentPass.startUTC);
    const minsAway = Math.max(1, Math.round((imminentPass.startUTC - now) / 60));
    new Notification('StarTrack Alert', {
      body:  `${imminentPass.satname ?? 'Starlink'} passes at ${Math.round(imminentPass.maxEl)}° in ${minsAway} minute${minsAway === 1 ? '' : 's'}`,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
    });
  }

  const secsLeft = imminentPass.startUTC - now;
  const mins     = Math.floor(secsLeft / 60);
  const secs     = secsLeft % 60;
  const countdown = `${mins}:${secs.toString().padStart(2, '0')}`;
  const score     = passScore(imminentPass.maxEl);

  return (
    <div className="countdown-banner">
      <span className="countdown-icon" aria-hidden>🛰</span>
      <span className="countdown-text">
        <strong>{imminentPass.satname ?? 'Starlink'}</strong> passes overhead in{' '}
        <span className="countdown-timer">{countdown}</span>
        {' '}— signal score {score}/100
      </span>
      <button
        className="countdown-dismiss"
        onClick={() => setDismissedKey(imminentPass.startUTC)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
