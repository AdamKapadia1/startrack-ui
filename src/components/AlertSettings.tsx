import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { Pass } from '../hooks/useRecommendation';
import { usePassHistory } from '../hooks/usePassHistory';

const API_BASE   = import.meta.env.VITE_API_URL ?? '';
const NTFY_TOPIC = 'startrack-tring-alerts';
const NTFY_URL   = `https://ntfy.sh/${NTFY_TOPIC}`;

const MINUTE_STEPS = [2, 5, 10, 15, 20, 30];

export interface AlertConfig {
  minElevation:            number;
  alertMinutesBefore:      number;
  enabled:                 boolean;
  favouriteSatellitesOnly: boolean;
  favouriteSatelliteNames: string[];
}

const ELEVATION_LABELS: [number, string][] = [
  [30, 'Low'], [45, 'Med'], [60, 'High'], [75, 'V.High'], [89, 'Overhead'],
];

function passScore(el: number): number { return Math.round(40 + (el / 90) * 60); }
function qualityLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: '#00d4ff' };
  if (score >= 70) return { label: 'Good',      color: '#14b8a6' };
  if (score >= 50) return { label: 'Fair',       color: '#ffb800' };
  return              { label: 'Poor',      color: '#4a6080' };
}
function formatBST(utc: number): string {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

interface Props {
  passes:     Pass[];
  favourites?: string[];
}

export function AlertSettings({ passes, favourites = [] }: Props) {
  const [open,      setOpen]      = useState(false);
  const [config,    setConfig]    = useState<AlertConfig>({
    minElevation:            60,
    alertMinutesBefore:      10,
    enabled:                 true,
    favouriteSatellitesOnly: false,
    favouriteSatelliteNames: [],
  });
  const [minuteIdx, setMinuteIdx] = useState(2);
  const [method,    setMethod]    = useState<'ntfy' | 'browser'>('ntfy');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>('default');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [now,       setNow]       = useState(Math.floor(Date.now() / 1000));
  const dropdownRef    = useRef<HTMLDivElement>(null);
  const alertedPassRef = useRef<number | null>(null);
  const { logEvent }   = usePassHistory();

  // Fetch settings from API
  useEffect(() => {
    fetch(`${API_BASE}/api/notifications/settings`)
      .then(r => r.json())
      .then((cfg: AlertConfig) => {
        setConfig(cfg);
        const idx = MINUTE_STEPS.findIndex(v => v >= cfg.alertMinutesBefore);
        setMinuteIdx(idx >= 0 ? idx : 2);
      })
      .catch(() => {});
  }, []);

  // QR code
  useEffect(() => {
    QRCode.toDataURL(NTFY_URL, { width: 100, margin: 1, color: { dark: '#00d4ff', light: '#0a0f0c' } })
      .then(setQrDataUrl).catch(() => {});
  }, []);

  // Browser permission check
  useEffect(() => {
    if ('Notification' in window) setBrowserPerm(Notification.permission);
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const effectiveMinutes = MINUTE_STEPS[minuteIdx];
  const favMode          = config.enabled && config.favouriteSatellitesOnly;
  const noFavourites     = favMode && favourites.length === 0;
  const canSave          = !noFavourites;

  // Bell shaking if pass is imminent
  const imminentPass = passes.find(p => {
    if (!config.enabled) return false;
    if (favMode) return favourites.includes(p.satname ?? '') && p.startUTC > now && (p.startUTC - now) <= config.alertMinutesBefore * 60;
    return p.maxEl >= config.minElevation && p.startUTC > now && (p.startUTC - now) <= config.alertMinutesBefore * 60;
  });
  const bellShaking = config.enabled && !!imminentPass;

  // Log 'alerted' once per unique pass when the alert window opens
  useEffect(() => {
    if (!bellShaking || !imminentPass) return;
    if (alertedPassRef.current === imminentPass.startUTC) return;
    alertedPassRef.current = imminentPass.startUTC;
    logEvent({
      satelliteName: imminentPass.satname ?? 'Starlink',
      passTime:      new Date(imminentPass.startUTC * 1000).toISOString(),
      maxElevation:  imminentPass.maxEl,
      eventType:     'alerted',
    });
  }, [bellShaking, imminentPass?.startUTC]); // eslint-disable-line react-hooks/exhaustive-deps

  // Upcoming passes that meet threshold
  const upcomingAlerts = favMode
    ? passes.filter(p => favourites.includes(p.satname ?? '') && p.startUTC > now).slice(0, 3)
    : passes.filter(p => p.maxEl >= config.minElevation && p.startUTC > now).slice(0, 3);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const body: AlertConfig = {
      ...config,
      alertMinutesBefore:      effectiveMinutes,
      favouriteSatelliteNames: favourites,
    };
    try {
      const r = await fetch(`${API_BASE}/api/notifications/settings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      setConfig(await r.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  }

  async function requestBrowserNotif() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') setMethod('browser');
  }

  function alertCountdown(pass: Pass): string {
    const alertFiresAt = pass.startUTC - effectiveMinutes * 60;
    const secsUntil    = alertFiresAt - now;
    if (secsUntil <= 0) return 'Alert firing now';
    const m = Math.floor(secsUntil / 60);
    const s = secsUntil % 60;
    return `Alert in ${m}m ${s.toString().padStart(2, '0')}s`;
  }

  return (
    <div className="notif-wrap" ref={dropdownRef}>
      {/* Bell button */}
      <button
        className={`icon-btn alert-bell-btn${bellShaking ? ' bell-shaking' : ''}`}
        aria-label="Alert settings"
        onClick={() => setOpen(o => !o)}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.8"
          style={{ color: config.enabled ? 'var(--green)' : 'var(--text-muted)' }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {config.enabled && (
          <span className="bell-dot" style={{ background: bellShaking ? '#ffb800' : 'var(--green)' }} />
        )}
      </button>

      {open && (
        <div className="alert-panel">
          <div className="alert-panel-title">Notification Settings</div>

          {/* Enable/disable toggle */}
          <div className="alert-row">
            <span className="alert-row-label">Enable pass alerts</span>
            <button
              className={`alert-toggle${config.enabled ? ' on' : ''}`}
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              aria-label={config.enabled ? 'Disable alerts' : 'Enable alerts'}
            >
              <span className="alert-toggle-thumb" />
            </button>
          </div>

          {/* Settings — greyed out when disabled */}
          <div className={config.enabled ? '' : 'alert-disabled'}>

            {/* Favourites-only toggle */}
            <div className="alert-row alert-fav-row">
              <div className="alert-fav-label-wrap">
                <span className="alert-row-label">Only alert for my favourite satellites</span>
                <span className="alert-fav-hint">Alerts on any pass, ignoring elevation</span>
              </div>
              <button
                className={`alert-toggle${config.favouriteSatellitesOnly ? ' on' : ''}`}
                onClick={() => setConfig(c => ({ ...c, favouriteSatellitesOnly: !c.favouriteSatellitesOnly }))}
                disabled={!config.enabled}
                aria-label="Toggle favourites-only mode"
              >
                <span className="alert-toggle-thumb" />
              </button>
            </div>

            {/* Favourites confirmation / warning */}
            {config.favouriteSatellitesOnly && (
              <div className={`alert-fav-status${noFavourites ? ' alert-fav-status--warn' : ''}`}>
                {noFavourites ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    No favourite satellites yet — star some in the satellite list first.
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Alerting for: {favourites.join(', ')}
                  </>
                )}
              </div>
            )}

            {/* Minutes before slider */}
            <div className="alert-slider-wrap">
              <div className="alert-slider-label">
                Alert me <strong>{effectiveMinutes} minutes</strong> before
              </div>
              <input
                type="range" className="alert-slider"
                min="0" max={MINUTE_STEPS.length - 1} step="1"
                value={minuteIdx}
                onChange={e => setMinuteIdx(Number(e.target.value))}
                disabled={!config.enabled}
              />
              <div className="alert-slider-ticks">
                {MINUTE_STEPS.map(v => <span key={v}>{v}m</span>)}
              </div>
            </div>

            {/* Elevation slider — greyed out in favourites-only mode */}
            <div className={config.favouriteSatellitesOnly ? 'alert-disabled' : ''}>
              <div className="alert-slider-wrap">
                <div className="alert-slider-label">
                  Passes above <strong>{config.minElevation}°</strong>
                  {config.favouriteSatellitesOnly && (
                    <span className="alert-fav-override"> (overridden by favourites mode)</span>
                  )}
                </div>
                <input
                  type="range" className="alert-slider"
                  min="30" max="89" step="1"
                  value={config.minElevation}
                  onChange={e => setConfig(c => ({ ...c, minElevation: Number(e.target.value) }))}
                  disabled={!config.enabled || config.favouriteSatellitesOnly}
                />
                <div className="alert-slider-ticks">
                  {ELEVATION_LABELS.map(([, l]) => <span key={l}>{l}</span>)}
                </div>
              </div>
            </div>

            {/* Notification method */}
            <div className="alert-method-wrap">
              <div className="alert-slider-label">Notification method</div>
              <div className="alert-method-btns">
                <button
                  className={`alert-method-btn${method === 'ntfy' ? ' active' : ''}`}
                  onClick={() => setMethod('ntfy')}
                  disabled={!config.enabled}
                >ntfy.sh (recommended)</button>
                <button
                  className={`alert-method-btn${method === 'browser' ? ' active' : ''}`}
                  onClick={() => { setMethod('browser'); if (browserPerm !== 'granted') requestBrowserNotif(); }}
                  disabled={!config.enabled}
                >Browser</button>
              </div>
            </div>

            {method === 'ntfy' && (
              <div className="alert-ntfy-wrap">
                {qrDataUrl && (
                  <img src={qrDataUrl} className="alert-qr" width={90} height={90} alt="ntfy QR code" />
                )}
                <div className="alert-ntfy-info">
                  <div className="alert-ntfy-topic">{NTFY_TOPIC}</div>
                  <div className="alert-ntfy-hint">Install ntfy app → subscribe to topic</div>
                  <a href={NTFY_URL} target="_blank" rel="noopener noreferrer" className="alert-ntfy-link">
                    Open ntfy.sh →
                  </a>
                </div>
              </div>
            )}

            {method === 'browser' && (
              <div className="alert-browser-wrap">
                {browserPerm === 'granted' && (
                  <div className="alert-browser-status ok">Browser notifications enabled</div>
                )}
                {browserPerm === 'denied' && (
                  <div className="alert-browser-status denied">Blocked. Allow in browser settings</div>
                )}
                {browserPerm === 'default' && (
                  <button className="alert-browser-req" onClick={requestBrowserNotif}>
                    Enable browser notifications
                  </button>
                )}
              </div>
            )}

            {/* Upcoming alerts */}
            {upcomingAlerts.length > 0 && (
              <div className="alert-upcoming">
                <div className="alert-upcoming-title">
                  {config.favouriteSatellitesOnly ? 'Upcoming favourite passes' : 'Upcoming alerts'}
                </div>
                {upcomingAlerts.map((pass, i) => {
                  const score = passScore(pass.maxEl);
                  const q     = qualityLabel(score);
                  const secsAway = pass.startUTC - now;
                  const minsAway = Math.max(0, Math.floor(secsAway / 60));
                  return (
                    <div key={i} className="alert-upcoming-item">
                      <div className="alert-upcoming-sat">
                        {config.favouriteSatellitesOnly && <span className="alert-fav-star">★ </span>}
                        {(pass.satname ?? 'Starlink').replace('STARLINK-', 'SL-')}
                      </div>
                      <div className="alert-upcoming-meta">
                        {formatBST(pass.startUTC)} · {Math.round(pass.maxEl)}° ·{' '}
                        <span style={{ color: q.color }}>{q.label}</span>
                        {minsAway > 0 && <span className="alert-upcoming-away"> · in {minsAway}m</span>}
                      </div>
                      <div className="alert-upcoming-countdown">{alertCountdown(pass)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save */}
          <button
            className={`alert-save-btn${saved ? ' saved' : ''}`}
            onClick={save}
            disabled={saving || !canSave}
            title={noFavourites ? 'Star some satellites first to use this mode' : undefined}
          >
            {saved ? '✓ Alert settings saved' : saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
}
