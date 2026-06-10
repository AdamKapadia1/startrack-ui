interface Props { lastUpdated: Date | null; }

export function Footer({ lastUpdated }: Props) {
  const mins = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <footer className="footer">
      <span className="footer-text">
        N2YO data{mins !== null ? ` · refreshed ${mins}m ago` : ''}
      </span>
      <span className="footer-text">SGP4 propagation · satellite.js</span>
      <span className="footer-text">Agents: orbital · signal · scheduler · alert</span>
    </footer>
  );
}
