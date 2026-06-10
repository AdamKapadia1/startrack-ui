import type { Satellite } from '../types';

interface Props {
  satellites: Satellite[];
}

function elevColor(elevation: number) {
  if (elevation >= 60) return '#1D9E75';
  if (elevation >= 30) return '#F59E0B';
  return '#6B7280';
}

export function SatelliteList({ satellites }: Props) {
  const sorted = [...satellites].sort((a, b) => b.elevation - a.elevation);

  return (
    <div className="panel sat-list-panel">
      <div className="panel-header">
        <span className="panel-title">Visible Satellites</span>
        <span className="panel-subtitle">{satellites.length} tracked</span>
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
                <th>Range km</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
