export const APP_VERSION = '1.0.0';

const ENTRIES = [
  {
    version: '1.0.0',
    date:    'June 2026',
    items: [
      'Live satellite tracking with SGP4 orbital mechanics',
      '400+ Starlink satellites tracked in real time',
      'AI-powered pass recommendations via Claude',
      '7-day pass predictions with elevation arc charts',
      'Doppler shift calculations for Ku-band',
      'Weather-adjusted signal scoring (0–100)',
      'GPS auto-detection with Nominatim reverse geocoding',
      'WebSocket live updates every 5 seconds',
      'PWA: installable on iPhone and Android',
      'Constellation filtering (Starlink / OneWeb / ISS / GPS)',
      'Satellite detail panel with orbital elements',
      'Configurable alert system with ntfy.sh and browser notifications',
      'Pass sharing with dedicated landing pages',
      'Onboarding flow for new users',
      'Help panel with FAQ',
      'Dark / light mode toggle',
      'Persistent signal history across page reloads',
      'Chat context injection: AI knows your live conditions',
    ],
  },
];

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function ChangelogPanel({ open, onClose }: Props) {
  return (
    <>
      {open && <div className="changelog-overlay" onClick={onClose}/>}
      <div className={`changelog-panel${open ? ' open' : ''}`}>
        <div className="changelog-hdr">
          <div className="changelog-hdr-left">
            <span className="changelog-title">StarTrack AI</span>
            <span className="changelog-version-pill">v{APP_VERSION}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close changelog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="changelog-body">
          <div className="changelog-timeline">
            {ENTRIES.map(entry => (
              <div key={entry.version} className="cl-entry">
                <div className="cl-dot"/>
                <div className="cl-content">
                  <div className="cl-header">
                    <span className="cl-version">v{entry.version}</span>
                    <span className="cl-date">{entry.date}</span>
                  </div>
                  <ul className="cl-items">
                    {entry.items.map(item => (
                      <li key={item} className="cl-item">
                        <span className="cl-bullet"/>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
