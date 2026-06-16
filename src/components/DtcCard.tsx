import type { Satellite } from '../types';

interface Props { satellite: Satellite }

export function DtcCard({ satellite }: Props) {
  return (
    <div className="dtc-card">
      <svg className="dtc-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4.5 16.5c-1.5 1.5-1.5 4 0 5.5s4 1.5 5.5 0l10-10c1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0"/>
        <path d="M8 8l8 8M7.5 3.5L3 8M20.5 16.5L16 21"/>
      </svg>
      <div>
        <div className="dtc-title">{satellite.satname} · Direct-to-Cell capable</div>
        <div className="dtc-body">
          Currently at {satellite.elevation.toFixed(1)}°. Standard cellular devices can connect directly without ground infrastructure.
        </div>
      </div>
    </div>
  );
}
