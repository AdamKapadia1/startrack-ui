import { useState, useEffect } from 'react';
import { ElevationArcChart } from './ElevationArcChart';

const SITE     = 'https://startrack-delta.vercel.app';
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://web-production-98c0d.up.railway.app';

interface PassInfo {
  satelliteName:   string;
  timeStr:         string;
  el:              number;
  loc:             string;
  score:           number | null;
  quality:         string | null;
  durationSeconds: number | null;
  viewCount:       number | null;
}

function estimateDuration(peakEl: number): number {
  return Math.round(200 + (peakEl / 90) * 400);
}

function qualityFromEl(el: number): { label: string; color: string } {
  if (el >= 60) return { label: 'Excellent', color: '#00d4ff' };
  if (el >= 30) return { label: 'Good',      color: '#00ff88' };
  return              { label: 'Fair',       color: '#ffb800' };
}

function formatBST(d: Date): string {
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London',
  }) + ' BST';
}

function useCountdown(startMs: number, endMs: number) {
  const [text, setText] = useState('');

  useEffect(() => {
    function tick() {
      const now = Date.now();
      if (now > endMs) { setText('This pass has ended'); return; }
      const target = now < startMs ? startMs : endMs;
      const prefix = now < startMs ? 'Starts in' : 'In progress, ends in';
      const diff   = Math.max(0, target - now);
      const mins   = Math.floor(diff / 60_000);
      const secs   = Math.floor((diff % 60_000) / 1_000);
      setText(`${prefix} ${mins}m ${secs.toString().padStart(2, '0')}s`);
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [startMs, endMs]);

  return text;
}

function fromUrlParams(): PassInfo {
  const p = new URLSearchParams(window.location.search);
  return {
    satelliteName:   p.get('sat')   ?? 'Unknown Satellite',
    timeStr:         p.get('time')  ?? '',
    el:              parseFloat(p.get('el') ?? '0'),
    loc:             p.get('loc')   ?? 'Unknown Location',
    score:           p.get('score') ? parseFloat(p.get('score')!) : null,
    quality:         null,
    durationSeconds: null,
    viewCount:       null,
  };
}

export function PassLandingPage() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  const [passInfo,  setPassInfo]  = useState<PassInfo>(id ? {
    satelliteName: '', timeStr: '', el: 0, loc: '', score: null,
    quality: null, durationSeconds: null, viewCount: null,
  } : fromUrlParams());
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'done' | 'error'>(id ? 'loading' : 'done');

  // Fetch from ID
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/share/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setPassInfo({
          satelliteName:   d.satellite_name  ?? 'Unknown Satellite',
          timeStr:         d.pass_time       ?? '',
          el:              Number(d.max_elevation ?? 0),
          loc:             d.location_label  ?? 'Unknown Location',
          score:           d.signal_score    ?? null,
          quality:         d.quality         ?? null,
          durationSeconds: d.duration_seconds ?? null,
          viewCount:       d.view_count      ?? null,
        });
        setFetchState('done');
      })
      .catch(() => {
        // Fallback to URL params if API fails
        setPassInfo(fromUrlParams());
        setFetchState('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update meta tags for social sharing
  useEffect(() => {
    if (fetchState !== 'done') return;
    const { satelliteName, timeStr, el, loc, score, quality } = passInfo;
    const d        = timeStr ? new Date(timeStr) : null;
    const dateStr  = d ? d.toLocaleDateString('en-GB',  { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : '';
    const timeOnly = d ? d.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '';
    const fmtFull  = d ? d.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }) : '';
    const qLabel   = quality ?? (el >= 60 ? 'Excellent' : el >= 30 ? 'Good' : 'Fair');

    document.title = `${satelliteName} Pass Alert | StarTrack AI`;

    function setMeta(selector: string, content: string) {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const match = selector.match(/meta\[([^=]+)="([^"]+)"\]/);
        if (match) { el.setAttribute(match[1], match[2]); }
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }

    const ogTitle  = `${satelliteName} passes at ${Math.round(el)}° | StarTrack AI`;
    const ogDesc   = `${satelliteName} will pass overhead at ${Math.round(el)}° elevation over ${loc}${fmtFull ? ` at ${fmtFull}` : ''}. Track it live.`;
    const cardUrl  = `${API_BASE}/api/pass-card?` + new URLSearchParams({
      sat:     satelliteName,
      date:    dateStr,
      time:    timeOnly,
      el:      String(Math.round(el * 10) / 10),
      quality: qLabel,
      loc,
      ...(score !== null ? { score: String(score) } : {}),
    });

    const shareUrl = id ? `${SITE}/pass?id=${id}` : `${SITE}/pass?sat=${encodeURIComponent(satelliteName)}&time=${encodeURIComponent(timeStr)}&el=${Math.round(el)}&loc=${encodeURIComponent(loc)}`;

    setMeta('meta[property="og:url"]',          shareUrl);
    setMeta('meta[property="og:title"]',        ogTitle);
    setMeta('meta[property="og:description"]',  ogDesc);
    setMeta('meta[property="og:image"]',        cardUrl);
    setMeta('meta[property="og:image:width"]',  '1200');
    setMeta('meta[property="og:image:height"]', '630');
    setMeta('meta[property="og:image:type"]',   'image/png');
    setMeta('meta[name="twitter:card"]',        'summary_large_image');
    setMeta('meta[name="twitter:title"]',       ogTitle);
    setMeta('meta[name="twitter:description"]', ogDesc);
    setMeta('meta[name="twitter:image"]',       cardUrl);
    setMeta('meta[name="description"]',         ogDesc);
  }, [fetchState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fetchState === 'loading') {
    return (
      <div className="pass-landing">
        <div className="pass-landing-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading pass…</div>
        </div>
      </div>
    );
  }

  if (fetchState === 'error' && !passInfo.satelliteName) {
    return (
      <div className="pass-landing">
        <div className="pass-landing-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 13 }}>Pass not found or link has expired.</div>
        </div>
      </div>
    );
  }

  const { satelliteName, timeStr, el, loc, score, quality, durationSeconds, viewCount } = passInfo;

  const startDate  = timeStr ? new Date(timeStr) : new Date();
  const startMs    = startDate.getTime();
  const duration   = durationSeconds ?? estimateDuration(el);
  const endMs      = startMs + duration * 1_000;
  const peakTime   = Math.floor(startMs / 1_000 + duration / 2);

  const qualityObj = quality
    ? { label: quality, color: el >= 60 ? '#00d4ff' : el >= 30 ? '#00ff88' : '#ffb800' }
    : qualityFromEl(el);
  const countdown  = useCountdown(startMs, endMs);
  const isPast     = Date.now() > endMs;

  const shareUrl   = id ? `${SITE}/pass?id=${id}`
    : `${SITE}/pass?sat=${encodeURIComponent(satelliteName)}&time=${encodeURIComponent(timeStr)}&el=${Math.round(el)}&loc=${encodeURIComponent(loc)}${score !== null ? `&score=${score}` : ''}`;
  const tweetText  = `🛰 ${satelliteName} passes overhead at ${Math.round(el)}°, ${qualityObj.label} pass! Track it live: ${shareUrl} #StarTrack`;

  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="pass-landing">
      <div className="pass-landing-card">

        {/* Satellite icon */}
        <div className="pass-landing-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.4">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>

        <div className="pass-landing-heading">Satellite Pass Alert</div>

        <div className="pass-landing-satname">{satelliteName}</div>

        {/* Details */}
        <div className="pass-landing-details">
          <div className="pass-landing-row">
            <span className="pass-landing-label">Date &amp; Time</span>
            <span className="pass-landing-value">{formatBST(startDate)}</span>
          </div>
          <div className="pass-landing-row">
            <span className="pass-landing-label">Max Elevation</span>
            <span className="pass-landing-value" style={{ color: qualityObj.color }}>
              {el.toFixed(1)}°&nbsp;
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{qualityObj.label}</span>
            </span>
          </div>
          <div className="pass-landing-row">
            <span className="pass-landing-label">Location</span>
            <span className="pass-landing-value">{loc}</span>
          </div>
          <div className="pass-landing-row">
            <span className="pass-landing-label">Duration</span>
            <span className="pass-landing-value">~{Math.round(duration / 60)} min</span>
          </div>
          {score !== null && (
            <div className="pass-landing-row">
              <span className="pass-landing-label">Signal Score</span>
              <span className="pass-landing-value" style={{
                color: score >= 70 ? '#00d4ff' : score >= 50 ? '#ffb800' : '#ff4444',
              }}>
                {score}/100
              </span>
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className={`pass-landing-countdown${isPast ? ' past' : ''}`}>
          {countdown || '—'}
        </div>

        {/* Elevation arc chart */}
        <div className="pass-landing-chart">
          <ElevationArcChart
            satellite={satelliteName}
            peakElevation={el}
            peakTime={peakTime}
            duration={duration}
          />
        </div>

        {/* CTA buttons */}
        <div className="pass-landing-buttons">
          <a href={SITE} className="pass-landing-btn pass-landing-btn--primary">
            Open StarTrack
          </a>
          <a
            href={`${SITE}?highlight=${encodeURIComponent(satelliteName)}`}
            className="pass-landing-btn pass-landing-btn--secondary"
          >
            Track this satellite
          </a>
        </div>

        {/* Share row */}
        <div className="pass-landing-share">
          <button className="share-opt" onClick={copyLink}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
          <button
            className="share-opt"
            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener,noreferrer')}
          >
            Post to X
          </button>
          <button
            className="share-opt"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener,noreferrer')}
          >
            WhatsApp
          </button>
        </div>

        {/* Footer */}
        <div className="pass-landing-footer">
          Powered by <strong>StarTrack AI</strong>.{' '}
          <a href={SITE} className="pass-landing-link">{SITE.replace('https://', '')}</a>
          {viewCount !== null && viewCount > 0 && (
            <span className="pass-landing-views"> · Viewed {viewCount} {viewCount === 1 ? 'time' : 'times'}</span>
          )}
        </div>
      </div>
    </div>
  );
}
