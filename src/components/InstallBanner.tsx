import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'startrack-install-dismissed';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroid, setShowAndroid]       = useState(false);
  const [showIOS, setShowIOS]               = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      // Show iOS instructions (no beforeinstallprompt on Safari)
      const isStandalone = ('standalone' in navigator) && (navigator as any).standalone;
      if (!isStandalone) setShowIOS(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShowAndroid(false);
    setShowIOS(false);
    setDeferredPrompt(null);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setDeferredPrompt(null);
  }

  if (!showAndroid && !showIOS) return null;

  return (
    <div className="install-banner">
      <span className="install-icon">📡</span>
      <span className="install-text">
        {showIOS
          ? 'Install StarTrack AI: tap Share → Add to Home Screen'
          : 'Install StarTrack AI on your home screen for instant satellite tracking'}
      </span>
      {showAndroid && (
        <button className="install-btn" onClick={handleInstall}>Install</button>
      )}
      <button className="install-dismiss icon-btn" onClick={dismiss} aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
