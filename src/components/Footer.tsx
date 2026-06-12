import { APP_VERSION } from './ChangelogPanel';

interface Props {
  lastUpdated:     Date | null;
  onOpenChangelog: () => void;
}

export function Footer({ lastUpdated, onOpenChangelog }: Props) {
  const mins = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <footer className="footer">
      <span className="footer-text">
        N2YO data{mins !== null ? ` · refreshed ${mins}m ago` : ''}
      </span>
      <span className="footer-text">SGP4 propagation · satellite.js</span>
      <span className="footer-text">
        StarTrack AI ·{' '}
        <button className="footer-version-badge" onClick={onOpenChangelog}>
          v{APP_VERSION}
        </button>
      </span>
    </footer>
  );
}
