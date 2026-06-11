import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const NTFY_TOPIC = 'startrack-tring-alerts';
const NTFY_URL   = `https://ntfy.sh/${NTFY_TOPIC}`;

export function NotificationSetup() {
  const [open, setOpen]           = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied]       = useState(false);
  const dropdownRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(NTFY_URL, {
      width: 120,
      margin: 1,
      color: { dark: '#1D9E75', light: '#0a0f0c' },
    }).then(setQrDataUrl).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function copyTopic() {
    await navigator.clipboard.writeText(NTFY_TOPIC).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="notif-wrap" ref={dropdownRef}>
      <button
        className="icon-btn"
        aria-label="Notifications"
        onClick={() => setOpen(o => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-title">Pass Alerts</div>

          <div className="notif-section">
            <div className="notif-label">Get alerts on this device</div>
            <div className="notif-steps">
              <div className="notif-step"><span className="notif-num">1</span> Download the <strong>ntfy</strong> app (iOS / Android)</div>
              <div className="notif-step"><span className="notif-num">2</span> Scan the QR code below or enter the topic manually</div>
              <div className="notif-step"><span className="notif-num">3</span> You'll get notified when a high-elevation pass is approaching</div>
            </div>
          </div>

          {qrDataUrl && (
            <div className="notif-qr-wrap">
              <img src={qrDataUrl} alt="ntfy QR code" className="notif-qr" width={120} height={120} />
              <div className="notif-qr-label">Scan to subscribe</div>
            </div>
          )}

          <div className="notif-section">
            <div className="notif-label">Or enter topic manually</div>
            <div className="notif-topic-row">
              <span className="notif-topic">{NTFY_TOPIC}</span>
              <button className="notif-copy-btn" onClick={copyTopic}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <a className="notif-link" href={NTFY_URL} target="_blank" rel="noopener noreferrer">
            Open in browser →
          </a>
        </div>
      )}
    </div>
  );
}
