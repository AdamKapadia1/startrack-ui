import { useState, useRef, useEffect } from 'react';
import { usePassHistory } from '../hooks/usePassHistory';

const SITE     = 'https://startrack-delta.vercel.app';
const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface Props {
  startUTC:     number;
  maxEl:        number;
  satname:      string;
  locationName: string;
  className?:   string;
  // Optional extra pass data for richer share records
  durationSeconds?: number;
  signalScore?:     number;
  noradId?:         string;
}

function qualityLabel(el: number) {
  if (el >= 60) return 'Excellent';
  if (el >= 30) return 'Good';
  return 'Fair';
}

function estimatedScore(el: number) {
  return Math.round(40 + (el / 90) * 60);
}

function shareText(satname: string, el: number, shareUrl: string) {
  const q = el >= 60 ? 'nearly directly overhead' : el >= 30 ? 'at a good angle' : 'at low elevation';
  return `🛰 ${satname} passes overhead at ${Math.round(el)}°, ${q}! Track it live: ${shareUrl} #StarTrack`;
}

export function PassShare({ startUTC, maxEl, satname, locationName, className = '', durationSeconds, signalScore, noradId }: Props) {
  const [open,     setOpen]     = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const cachedUrl = useRef<string | null>(null);
  const { logEvent } = usePassHistory();

  function logShared(url: string) {
    logEvent({
      satelliteName: satname,
      locationLabel: locationName,
      passTime:      new Date(startUTC * 1000).toISOString(),
      maxElevation:  maxEl,
      eventType:     'shared',
    });
    return url;
  }

  useEffect(() => {
    // Reset cached URL when the pass changes
    cachedUrl.current = null;
  }, [startUTC, satname]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  async function getShareUrl(): Promise<string> {
    if (cachedUrl.current) return cachedUrl.current;
    setCreating(true);
    try {
      const r = await fetch(`${API_BASE}/api/share/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          satelliteName:   satname,
          noradId:         noradId         ?? null,
          passTime:        new Date(startUTC * 1000).toISOString(),
          maxElevation:    maxEl,
          durationSeconds: durationSeconds ?? null,
          quality:         qualityLabel(maxEl),
          locationLabel:   locationName,
          signalScore:     signalScore     ?? estimatedScore(maxEl),
        }),
      });
      if (!r.ok) throw new Error('share create failed');
      const { url } = await r.json();
      cachedUrl.current = url;
      return url;
    } catch {
      // Fallback to parameter-based URL if backend is unavailable
      const iso = new Date(startUTC * 1000).toISOString();
      const url = `${SITE}/pass?sat=${encodeURIComponent(satname)}&time=${encodeURIComponent(iso)}&el=${Math.round(maxEl)}&loc=${encodeURIComponent(locationName)}`;
      cachedUrl.current = url;
      return url;
    } finally {
      setCreating(false);
    }
  }

  function stop(e: React.MouseEvent) { e.stopPropagation(); }
  function toggle(e: React.MouseEvent) { e.stopPropagation(); setOpen(o => !o); }

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = await getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShared(url);
    } catch { /* clipboard unavailable */ }
  }

  async function nativeShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = await getShareUrl();
    navigator.share?.({ title: `${satname} Pass`, text: shareText(satname, maxEl, url), url }).catch(() => {});
    logShared(url);
    setOpen(false);
  }

  async function tweet(e: React.MouseEvent) {
    e.stopPropagation();
    const url = await getShareUrl();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(satname, maxEl, url))}`, '_blank', 'noopener,noreferrer');
    logShared(url);
    setOpen(false);
  }

  async function whatsapp(e: React.MouseEvent) {
    e.stopPropagation();
    const url = await getShareUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText(satname, maxEl, url))}`, '_blank', 'noopener,noreferrer');
    logShared(url);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`pass-share-wrap ${className}`} onClick={stop}>
      <button className="pass-share-btn" onClick={toggle} title="Share this pass" aria-label="Share pass">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="18" cy="5"  r="3"/>
          <circle cx="6"  cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>

      {open && (
        <div className="pass-share-dropdown" onClick={stop}>
          <button className="share-opt" onClick={copyLink} disabled={creating}>
            {creating ? 'Creating link…' : copied ? '✓ Copied!' : 'Copy link'}
          </button>
          {'share' in navigator && (
            <button className="share-opt" onClick={nativeShare} disabled={creating}>Share…</button>
          )}
          <button className="share-opt" onClick={tweet}     disabled={creating}>Post to X</button>
          <button className="share-opt" onClick={whatsapp}  disabled={creating}>WhatsApp</button>
        </div>
      )}
    </div>
  );
}
