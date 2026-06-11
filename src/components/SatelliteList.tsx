import type { Satellite } from '../types';

interface Props {
  satellites: Satellite[];
}

function elevColor(elevation: number) {
  if (elevation >= 60) return '#1D9E75';
  if (elevation >= 30) return '#F59E0B';
  return '#6B7280';
}

// Uses raw Hz for 1-decimal kHz display; uses integer kHz only for zero check
function dopplerColor(hz: number | null, kHz: number | null): string {
  if (hz === null) return 'var(--text-muted)';
  if (kHz === 0)   return 'var(--text-dim)';      // grey at zero crossing
  return (hz > 0) ? '#1D9E75' : '#EF4444';
}

function dopplerLabel(hz: number | null, kHz: number | null): string {
  if (hz === null) return '—';
  if (kHz === 0)   return '0 kHz';
  const val = (hz / 1000).toFixed(1);
  return hz > 0 ? `+${val} kHz` : `${val} kHz`;
}

export function SatelliteList({ satellites }: Props) {
  const sorted = [...satellites].sort((a, b) => b.elevation - a.elevation);
  const hasAnyDoppler = sorted.some(s => s.dopplerShiftKHz !== null);

  return (
    <div className="sat-list-section">
      <div className="section-label">
        Visible Satellites
        <span className="sat-count-badge">{satellites.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="sat-empty">No satellites above horizon</div>
      ) : (
        <div className="sat-table-wrap">
          <table className="sat-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>El°</th>
                <th>Az°</th>
                <th>km</th>
                {hasAnyDoppler && <th>Ku-band Doppler</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((sat, i) => (
                <tr key={i}>
                  <td className="sat-name">{sat.satname}</td>
                  <td style={{ color: elevColor(sat.elevation), fontWeight: 600 }}>
                    {sat.elevation.toFixed(1)}
                  </td>
                  <td className="sat-dim">{sat.azimuth.toFixed(1)}</td>
                  <td className="sat-dim">{sat.range.toLocaleString()}</td>
                  {hasAnyDoppler && (
                    <td style={{
                      color:      dopplerColor(sat.dopplerShiftHz, sat.dopplerShiftKHz),
                      fontFamily: 'var(--mono)',
                      fontSize:   '10px',
                      fontWeight: 600,
                      textAlign:  'right',
                    }}>
                      {dopplerLabel(sat.dopplerShiftHz, sat.dopplerShiftKHz)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
