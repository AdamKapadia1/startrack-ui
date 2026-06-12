import { useState, useEffect } from 'react';
import { ElevationArcChart } from './ElevationArcChart';

const SITE = 'https://startrackv1-ui.vercel.app';

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
      const prefix = now < startMs ? 'Starts in' : 'In progress — ends in';
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

export function PassLandingPage() {
  const params  = new URLSearchParams(window.location.search);
  const satname = params.get('sat')   ?? 'Unknown Satellite';
  const timeStr = params.get('time')  ?? '';
  const el      = parseFloat(params.get('el') ?? '0');
  const loc     = params.get('loc')   ?? 'Unknown Location';
  const score   = params.get('score') ? parseFloat(params.get('score')!) : null;

  // Update document meta tags for this specific pass (for social sharing)
  useEffect(() => {
    const formattedTime = timeStr
      ? new Date(timeStr).toLocaleString('en-GB', {
          timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
        })
      : '';

    document.title = `${satname} Pass Alert — StarTrack AI`;

    function setMeta(selector: string, content: string) {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    }

    const ogTitle   = `${satname} passes at ${Math.round(el)}° — StarTrack AI`;
    const ogDesc    = `${satname} will pass overhead at ${Math.round(el)}° elevation over ${loc}${formattedTime ? ` at ${formattedTime}` : ''}. Track it live on StarTrack AI.`;
    const twDesc    = `${satname} overhead at ${Math.round(el)}° over ${loc}${formattedTime ? ` at ${formattedTime}` : ''}. Track it live.`;

    setMeta('meta[property="og:title"]',          ogTitle);
    setMeta('meta[property="og:description"]',    ogDesc);
    setMeta('meta[name="twitter:title"]',         ogTitle);
    setMeta('meta[name="twitter:description"]',   twDesc);
    setMeta('meta[name="description"]',           ogDesc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startDate = timeStr ? new Date(timeStr) : new Date();
  const startMs   = startDate.getTime();
  const duration  = estimateDuration(el);
  const endMs     = startMs + duration * 1_000;
  const peakTime  = Math.floor(startMs / 1_000 + duration / 2);

  const quality   = qualityFromEl(el);
  const countdown = useCountdown(startMs, endMs);
  const isPast    = Date.now() > endMs;

  const scoreParam = score !== null ? `&score=${score}` : '';
  const shareUrl   = `${SITE}/pass?sat=${encodeURIComponent(satname)}&time=${encodeURIComponent(timeStr)}&el=${Math.round(el)}&loc=${encodeURIComponent(loc)}${scoreParam}`;
  const tweetText  = `🛰 ${satname} passes overhead at ${Math.round(el)}° — ${quality.label} pass! Track it live: ${shareUrl} #StarTrack`;

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

        <div className="pass-landing-satname">{satname}</div>

        {/* Details */}
        <div className="pass-landing-details">
          <div className="pass-landing-row">
            <span className="pass-landing-label">Date &amp; Time</span>
            <span className="pass-landing-value">{formatBST(startDate)}</span>
          </div>
          <div className="pass-landing-row">
            <span className="pass-landing-label">Max Elevation</span>
            <span className="pass-landing-value" style={{ color: quality.color }}>
              {el.toFixed(1)}°&nbsp;
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{quality.label}</span>
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
            satellite={satname}
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
            href={`${SITE}?highlight=${encodeURIComponent(satname)}`}
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
          Powered by <strong>StarTrack AI</strong> —{' '}
          <a href={SITE} className="pass-landing-link">{SITE.replace('https://', '')}</a>
        </div>
      </div>
    </div>
  );
}
