import { useState } from 'react';

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);

  function toggle(i: number) { setExpanded(prev => prev === i ? null : i); }

  const sections: { title: string; content: React.ReactNode }[] = [
    {
      title: 'What is StarTrack?',
      content: (
        <p className="help-p">
          StarTrack shows every Starlink, OneWeb, ISS, and GPS satellite currently above your horizon in real time,
          using SGP4 orbital mechanics. An AI model analyses orbital data and local weather to predict your best
          connectivity windows and alert you before the strongest passes.
        </p>
      ),
    },
    {
      title: 'Understanding the sky map',
      content: (
        <>
          <p className="help-p">The circular map shows your sky as if lying flat looking straight up:</p>
          <ul className="help-ul">
            <li><strong>Three rings</strong> — 30°, 60°, and 90° (zenith) elevation</li>
            <li><strong>Each dot</strong> — one satellite above your horizon right now</li>
            <li><strong>Higher = stronger signal</strong> — less atmosphere to pass through</li>
            <li><span className="help-badge help-badge--green">Bright green</span> — high signal (Starlink)</li>
            <li><span className="help-badge help-badge--blue">Blue</span> — OneWeb</li>
            <li><span className="help-badge help-badge--white">White</span> — ISS (larger dot)</li>
            <li><span className="help-badge help-badge--amber">Amber</span> — GPS</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Signal score explained',
      content: (
        <>
          <p className="help-p">A 0–100 score calculated from:</p>
          <ul className="help-ul">
            <li><strong>Elevation</strong> — up to 40 pts (max at 85°+)</li>
            <li><strong>Cloud cover</strong> — up to 20 pts</li>
            <li><strong>Visibility</strong> — up to 15 pts</li>
            <li><strong>Wind speed</strong> — up to 10 pts</li>
            <li><strong>Range</strong> — up to 5 pts</li>
            <li><strong>Satellite count bonus</strong> — up to 10 pts</li>
          </ul>
          <div className="help-badge-row">
            <span className="help-badge help-badge--green">70+ = Good</span>
            <span className="help-badge help-badge--amber">50–69 = Moderate</span>
            <span className="help-badge help-badge--grey">Below 50 = Poor</span>
          </div>
          <p className="help-p" style={{ marginTop: '8px' }}>
            Scores above 80% cloud cover are capped at 70 — heavy cloud degrades signal quality significantly.
          </p>
        </>
      ),
    },
    {
      title: 'Pass predictions',
      content: (
        <>
          <p className="help-p">
            A <strong>pass</strong> is when a satellite rises above the horizon, crosses the sky, and sets again —
            typically 3–8 minutes. StarTrack predicts passes for the next 7 days.
          </p>
          <ul className="help-ul">
            <li>Passes above <strong>60°</strong> give the shortest signal path — best quality</li>
            <li>Times shown in <strong>BST</strong> (British Summer Time)</li>
            <li>Click any row to see the <strong>elevation arc chart</strong></li>
            <li>Use <strong>Cal</strong> to add the pass to your phone calendar (.ics)</li>
            <li>Use the <strong>share icon</strong> to send a pass link via Twitter, WhatsApp, or copy link</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Doppler shift',
      content: (
        <>
          <p className="help-p">
            As a satellite approaches you, its signal frequency shifts <em>higher</em> (+kHz) —
            like a car horn as it nears. As it moves away, frequency drops below zero (−kHz).
          </p>
          <p className="help-p" style={{ marginTop: '8px' }}>
            The <strong>zero crossing</strong> on the Doppler chart marks peak elevation —
            the closest point of the pass and strongest signal moment.
          </p>
        </>
      ),
    },
    {
      title: 'Notifications setup',
      content: (
        <>
          <p className="help-p" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
            📱 ntfy.sh (phone — recommended)
          </p>
          <ol className="help-ol">
            <li>Install the free <code className="help-code">ntfy</code> app (iOS or Android)</li>
            <li>Tap "Subscribe to topic" → enter <code className="help-code">startrack-alerts</code></li>
            <li>Open the bell icon in StarTrack header and enable alerts</li>
          </ol>
          <p className="help-p" style={{ fontWeight: 600, color: 'var(--text)', margin: '12px 0 6px' }}>
            🔔 Browser notifications
          </p>
          <ol className="help-ol">
            <li>Click the <strong>bell icon</strong> in the StarTrack header</li>
            <li>Click "Enable browser notifications" and allow the permission</li>
            <li>StarTrack will notify you 5 minutes before each high-elevation pass</li>
          </ol>
        </>
      ),
    },
    {
      title: 'FAQ',
      content: (
        <div className="help-faq">
          {[
            {
              q: 'Why does the satellite count change so much?',
              a: 'Satellites orbit at ~7.5 km/s completing a full orbit every ~95 minutes. The count shows only those above 0° right now — this changes constantly as they rise and set.',
            },
            {
              q: 'What is Direct-to-Cell?',
              a: 'Newer Starlink Gen 2 satellites connect directly to standard smartphones — no ground dish or special equipment needed. Like a cell tower in orbit.',
            },
            {
              q: 'How accurate are the positions?',
              a: 'Positions use SGP4 orbital mechanics with TLE data from CelesTrak, updated every 6 hours. Typical accuracy within 1–2 km.',
            },
            {
              q: 'Why is my signal score not 100?',
              a: 'A perfect score needs 85°+ elevation, completely clear skies, and excellent visibility simultaneously. Typical good conditions score 65–80.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="help-faq-item">
              <div className="help-faq-q">{q}</div>
              <div className="help-faq-a">{a}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      {open && <div className="help-overlay" onClick={onClose}/>}
      <div className={`help-panel${open ? ' open' : ''}`}>
        <div className="help-hdr">
          <span className="help-title">Help &amp; Guide</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close help">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="help-body">
          {sections.map((sec, i) => (
            <div key={i} className="help-section">
              <button className="help-sec-btn" onClick={() => toggle(i)}>
                <span className="help-sec-title">{sec.title}</span>
                <svg
                  className="help-sec-arrow"
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: expanded === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {expanded === i && (
                <div className="help-sec-content">{sec.content}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
