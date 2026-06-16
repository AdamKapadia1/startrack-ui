import { useState, useRef, useEffect } from 'react';

const SITE = 'https://startrackv1-ui.vercel.app';

interface Props {
  startUTC:     number;
  maxEl:        number;
  satname:      string;
  locationName: string;
  className?:   string;
}

function buildShare(startUTC: number, maxEl: number, satname: string, locationName: string) {
  const d   = new Date(startUTC * 1000);
  const iso = d.toISOString();
  const el  = Math.round(maxEl);
  const url = `${SITE}/pass?sat=${encodeURIComponent(satname)}&time=${encodeURIComponent(iso)}&el=${el}&loc=${encodeURIComponent(locationName)}`;
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const quality = el >= 60 ? 'nearly directly overhead' : el >= 30 ? 'at a good angle' : 'at low elevation';
  const text = `🛰 ${satname} passes overhead at ${el}° on ${date} at ${time} BST, ${quality}! Track it live: ${url} #StarTrack #Starlink`;
  return { url, text };
}

export function PassShare({ startUTC, maxEl, satname, locationName, className = '' }: Props) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const { url, text } = buildShare(startUTC, maxEl, satname, locationName);

  function stop(e: React.MouseEvent) { e.stopPropagation(); }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(o => !o);
  }

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  function nativeShare(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.share?.({ title: `${satname} Pass`, text, url }).catch(() => {});
    setOpen(false);
  }

  function tweet(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  function whatsapp(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
          <button className="share-opt" onClick={copyLink}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
          {'share' in navigator && (
            <button className="share-opt" onClick={nativeShare}>Share…</button>
          )}
          <button className="share-opt" onClick={tweet}>Post to X</button>
          <button className="share-opt" onClick={whatsapp}>WhatsApp</button>
        </div>
      )}
    </div>
  );
}
