import { useState } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import { DEFAULT_LOCATION } from '../hooks/useLocation';

export const ONBOARDING_KEY = 'startrack-onboarded';

interface Props {
  onComplete: (loc: LocationSettings) => void;
}

interface NominatimResult {
  display_name: string;
  lat:          string;
  lon:          string;
  altitude?:    string;
}

function shortName(s: string) {
  return s.split(',').map(p => p.trim()).slice(0, 2).join(', ');
}

function SatSVG() {
  return (
    <svg width="72" height="72" viewBox="0 0 80 80" fill="none">
      <rect x="28" y="28" width="24" height="24" rx="3" fill="#1D9E75" opacity="0.9"/>
      {/* left panel */}
      <rect x="4"  y="34" width="22" height="12" rx="2" fill="#0d1f17" stroke="#1D9E75" strokeWidth="1.5"/>
      <line x1="15" y1="34" x2="15" y2="46" stroke="#1D9E75" strokeWidth="0.8" opacity="0.6"/>
      {/* right panel */}
      <rect x="54" y="34" width="22" height="12" rx="2" fill="#0d1f17" stroke="#1D9E75" strokeWidth="1.5"/>
      <line x1="65" y1="34" x2="65" y2="46" stroke="#1D9E75" strokeWidth="0.8" opacity="0.6"/>
      {/* dish */}
      <ellipse cx="40" cy="22" rx="7" ry="5" fill="none" stroke="#4ade80" strokeWidth="1.5"/>
      <line x1="40" y1="27" x2="40" y2="28" stroke="#4ade80" strokeWidth="1.5"/>
      {/* signal rings */}
      <path d="M56 15 Q61 20 56 25" stroke="#1D9E75" strokeWidth="1.2" fill="none" opacity="0.5"/>
      <path d="M59 12 Q67 20 59 28" stroke="#1D9E75" strokeWidth="1"   fill="none" opacity="0.3"/>
    </svg>
  );
}

export function Onboarding({ onComplete }: Props) {
  const [step,         setStep]         = useState(1);
  const [leaving,      setLeaving]      = useState(false);
  const [chosenLoc,    setChosenLoc]    = useState<LocationSettings | null>(null);
  const [notifMethod,  setNotifMethod]  = useState<string | null>(null);
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<NominatimResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [searchError,  setSearchError]  = useState('');
  const [locConfirmed, setLocConfirmed] = useState('');
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setLeaving(true);
    setTimeout(() => onComplete(chosenLoc ?? DEFAULT_LOCATION), 350);
  }

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'StarTrackAI/1.0 (startrackv1-ui.vercel.app)' } },
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      if (!data.length) setSearchError('No results found — try a different search');
    } catch {
      setSearchError('Search failed — check your connection');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: NominatimResult) {
    const name = shortName(r.display_name);
    const loc: LocationSettings = {
      name,
      lat: parseFloat(parseFloat(r.lat).toFixed(4)),
      lon: parseFloat(parseFloat(r.lon).toFixed(4)),
      alt: 0,
    };
    setChosenLoc(loc);
    setResults([]);
    setQuery('');
    setLocConfirmed(name);
  }

  function handleGPS() {
    if (!navigator.geolocation) { setSearchError('GPS not supported — search for your city'); return; }
    setGpsLoading(true);
    setSearchError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, altitude } = pos.coords;
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'StarTrackAI/1.0' } },
          );
          const data = await res.json();
          const a    = data.address ?? {};
          const name = a.city ?? a.town ?? a.village ?? a.suburb ?? 'Current location';
          setChosenLoc({ name, lat: parseFloat(latitude.toFixed(4)), lon: parseFloat(longitude.toFixed(4)), alt: Math.round(altitude ?? 0) });
          setLocConfirmed(name);
        } catch {
          setChosenLoc({ name: 'Current location', lat: parseFloat(latitude.toFixed(4)), lon: parseFloat(longitude.toFixed(4)), alt: Math.round(altitude ?? 0) });
          setLocConfirmed('Current location');
        }
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setSearchError('GPS access denied — search for your city instead');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function requestBrowserNotif() {
    if (!('Notification' in window)) { setNotifMethod('browser-denied'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { setNotifMethod('browser'); setNotifGranted(true); }
    else                     setNotifMethod('browser-denied');
  }

  const TOTAL = 4;
  const overlayClass = `ob-overlay${leaving ? ' ob-overlay--out' : ''}`;

  function Dots() {
    return (
      <div className="ob-dots">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={`ob-dot${i + 1 === step ? ' ob-dot--active' : i + 1 < step ? ' ob-dot--done' : ''}`}/>
        ))}
      </div>
    );
  }

  function BackBtn({ to }: { to: number }) {
    return (
      <button className="ob-back" onClick={() => setStep(to)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>
    );
  }

  // ── Step 1: Welcome ─────────────────────────────────────────────────────────
  if (step === 1) return (
    <div className={overlayClass}>
      <div className="ob-card" key="1">
        <div className="ob-sat-icon"><SatSVG/></div>
        <h1 className="ob-heading">Welcome to StarTrack AI</h1>
        <p className="ob-sub">Real-time satellite tracking powered by AI</p>
        <div className="ob-features">
          {[
            { icon: '🛰', title: 'Track 400+ satellites live overhead',   desc: 'Every satellite above your horizon, right now' },
            { icon: '🤖', title: 'AI tells you your best connectivity windows', desc: 'Best times for Starlink signal quality' },
            { icon: '📱', title: 'Works anywhere — your exact GPS location', desc: 'No account needed' },
          ].map(f => (
            <div key={f.icon} className="ob-feature">
              <span className="ob-feature-icon">{f.icon}</span>
              <div>
                <div className="ob-feature-title">{f.title}</div>
                <div className="ob-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="ob-btn-primary" onClick={() => setStep(2)}>Get Started</button>
        <button className="ob-btn-skip"    onClick={finish}>Skip</button>
        <Dots/>
      </div>
    </div>
  );

  // ── Step 2: Location ─────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className={overlayClass}>
      <div className="ob-card" key="2">
        <BackBtn to={1}/>
        <h2 className="ob-heading">Where are you?</h2>
        <p className="ob-sub">StarTrack works best with your exact location</p>

        <button className="ob-btn-primary ob-gps-btn" onClick={handleGPS} disabled={gpsLoading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {gpsLoading ? 'Locating…' : 'Use my GPS location'}
        </button>

        <div className="ob-divider"><span>or search for your city</span></div>

        <div className="ob-search-row">
          <input
            className="ob-input"
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setResults([]); setSearchError(''); }}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="City, town or postcode…"
          />
          <button className="ob-search-btn" onClick={doSearch} disabled={searching || !query.trim()}>
            {searching ? '…' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="ob-results">
            {results.map((r, i) => (
              <button key={i} className="ob-result-btn" onClick={() => selectResult(r)}>
                {shortName(r.display_name)}
              </button>
            ))}
          </div>
        )}
        {searchError  && <div className="ob-error">{searchError}</div>}
        {locConfirmed && <div className="ob-confirmed">✓ Location set to {locConfirmed}</div>}

        {locConfirmed
          ? <button className="ob-btn-primary" style={{ marginTop: '12px' }} onClick={() => setStep(3)}>Continue →</button>
          : <button className="ob-btn-skip" onClick={() => { setChosenLoc(DEFAULT_LOCATION); setStep(3); }}>
              Use default location (Tring, UK)
            </button>
        }
        <Dots/>
      </div>
    </div>
  );

  // ── Step 3: Notifications ────────────────────────────────────────────────────
  if (step === 3) return (
    <div className={overlayClass}>
      <div className="ob-card" key="3">
        <BackBtn to={2}/>
        <h2 className="ob-heading">Never miss a great pass</h2>
        <p className="ob-sub">Get alerts before high-elevation satellites pass overhead</p>

        <div className="ob-notif-cards">
          <div className={`ob-notif-card${notifMethod === 'ntfy' ? ' ob-notif-card--active' : ''}`} onClick={() => setNotifMethod('ntfy')}>
            <div className="ob-notif-icon">📱</div>
            <div className="ob-notif-title">Phone notifications via ntfy.sh</div>
            <div className="ob-notif-desc">No account needed — just install the free app</div>
            {notifMethod === 'ntfy' && (
              <div className="ob-ntfy-box">
                <code className="ob-ntfy-topic">startrack-alerts</code>
                <div className="ob-ntfy-inst">Install ntfy app → subscribe to the topic above</div>
              </div>
            )}
          </div>
          <div
            className={`ob-notif-card${notifMethod === 'browser' || notifMethod === 'browser-denied' ? ' ob-notif-card--active' : ''}`}
            onClick={requestBrowserNotif}
          >
            <div className="ob-notif-icon">🔔</div>
            <div className="ob-notif-title">Browser notifications</div>
            <div className="ob-notif-desc">Works on desktop and Android Chrome</div>
            {notifGranted               && <div className="ob-ntfy-inst ob-ntfy-ok">✓ Enabled</div>}
            {notifMethod === 'browser-denied' && <div className="ob-ntfy-inst ob-ntfy-err">Permission denied — enable in browser settings</div>}
          </div>
        </div>

        <button className="ob-btn-primary" onClick={() => setStep(4)}>Continue →</button>
        <button className="ob-btn-skip"    onClick={() => setStep(4)}>I'll set this up later</button>
        <Dots/>
      </div>
    </div>
  );

  // ── Step 4: Ready ────────────────────────────────────────────────────────────
  return (
    <div className={overlayClass}>
      <div className="ob-card" key="4">
        <div className="ob-ready-check">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="24" fill="rgba(29,158,117,0.12)" stroke="#1D9E75" strokeWidth="1.5"/>
            <path d="M14 26 L22 34 L38 18" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="ob-heading">You're all set!</h2>
        <p className="ob-sub">StarTrack is ready to track satellites for you</p>

        <div className="ob-summary">
          <div className="ob-summary-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{chosenLoc?.name ?? DEFAULT_LOCATION.name}</span>
          </div>
          {notifMethod && notifMethod !== 'browser-denied'
            ? (
              <div className="ob-summary-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span>{notifMethod === 'ntfy' ? 'ntfy.sh phone alerts active' : 'Browser notifications enabled'}</span>
              </div>
            )
            : (
              <div className="ob-summary-row ob-summary-row--dim">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span>No notifications set up</span>
              </div>
            )
          }
        </div>

        <button className="ob-btn-primary" onClick={finish}>Launch StarTrack</button>
        <Dots/>
      </div>
    </div>
  );
}
