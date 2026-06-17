import { useState, useRef } from 'react';
import type { LocationSettings } from '../hooks/useLocation';

const EMBED_SITE = 'https://startrack-delta.vercel.app';

interface Props {
  open:     boolean;
  onClose:  () => void;
  location: LocationSettings;
}

function buildCode(lat: string, lon: string): string {
  const src = `${EMBED_SITE}/embed?lat=${lat}&lon=${lon}`;
  return `<iframe\n  src="${src}"\n  width="320"\n  height="200"\n  frameborder="0"\n  style="border-radius:8px;border:none;"\n  title="StarTrack Live Satellite Data"\n></iframe>`;
}

export function EmbedCodePanel({ open, onClose, location }: Props) {
  const [lat,    setLat]    = useState(location.lat.toFixed(4));
  const [lon,    setLon]    = useState(location.lon.toFixed(4));
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const code    = buildCode(lat, lon);
  const previewSrc = `${EMBED_SITE}/embed?lat=${lat}&lon=${lon}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <>
      {open && <div className="settings-overlay" onClick={onClose} />}
      <div className={`embed-panel${open ? ' open' : ''}`}>
        <div className="settings-hdr">
          <span className="settings-title">Get Embed Code</span>
          <button className="settings-close icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="embed-panel-body">
          <p className="embed-desc">
            Embed a live satellite feed on your website. The widget auto-refreshes every 30 seconds and shows satellites overhead, best elevation, and signal score for your location.
          </p>

          {/* Location inputs */}
          <div className="embed-loc-row">
            <div className="embed-loc-field">
              <label className="embed-loc-label">Latitude</label>
              <input
                className="embed-loc-input"
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={lat}
                onChange={e => setLat(e.target.value)}
              />
            </div>
            <div className="embed-loc-field">
              <label className="embed-loc-label">Longitude</label>
              <input
                className="embed-loc-input"
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={lon}
                onChange={e => setLon(e.target.value)}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="embed-preview-wrap">
            <div className="embed-preview-label">Preview</div>
            <div className="embed-preview-frame">
              <iframe
                ref={iframeRef}
                src={previewSrc}
                width="320"
                height="200"
                frameBorder="0"
                title="StarTrack Embed Preview"
                style={{ borderRadius: 8, border: 'none', display: 'block' }}
              />
            </div>
          </div>

          {/* Code block */}
          <div className="embed-code-wrap">
            <div className="embed-code-label">
              <span>Embed code</span>
              <button
                className={`embed-copy-btn${copied ? ' copied' : ''}`}
                onClick={copyCode}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="embed-code-block">{code}</pre>
          </div>

          <p className="embed-desc" style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>
            The widget links back to StarTrack AI so your visitors can explore the full live dashboard.
          </p>
        </div>
      </div>
    </>
  );
}
