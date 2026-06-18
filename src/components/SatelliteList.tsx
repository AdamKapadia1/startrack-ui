import type { Satellite } from '../types';
import { Skeleton } from './Skeleton';
import { formatDistance } from '../utils/units';

interface Props {
  satellites:          Satellite[];
  onSelectSatellite:   (sat: Satellite) => void;
  favourites?:         string[];
  onToggleFavourite?:  (name: string) => void;
  loading?:            boolean;
  fullHeight?:         boolean;
  units?:              'metric' | 'imperial';
}

function elevColor(elevation: number) {
  if (elevation >= 60) return '#00d4ff';
  if (elevation >= 30) return '#ffb800';
  return '#4a6080';
}

function dopplerColor(hz: number | null, kHz: number | null): string {
  if (hz === null) return 'var(--text-muted)';
  if (kHz === 0)   return 'var(--text-dim)';
  return (hz > 0) ? '#00d4ff' : '#ff4444';
}

function dopplerVal(hz: number | null, kHz: number | null): string {
  if (hz === null) return '—';
  if (kHz === 0)   return '0';
  const val = (hz / 1000).toFixed(1);
  return hz > 0 ? `+${val}` : `${val}`;
}

function StarBtn({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className={`star-btn${active ? ' star-btn--active' : ''}`}
      onClick={onClick}
      aria-label={active ? 'Remove from favourites' : 'Add to favourites'}
      title={active ? 'Remove from favourites' : 'Add to favourites'}
    >
      <svg width="13" height="13" viewBox="0 0 24 24"
        fill={active ? '#fbbf24' : 'none'}
        stroke={active ? '#fbbf24' : 'currentColor'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  );
}

export function SatelliteList({
  satellites, onSelectSatellite, favourites = [], onToggleFavourite,
  loading, fullHeight, units = 'metric',
}: Props) {
  const favSet  = new Set(favourites);
  const favSats = [...satellites].filter(s => favSet.has(s.satname)).sort((a, b) => b.elevation - a.elevation);
  const restSats = [...satellites].filter(s => !favSet.has(s.satname)).sort((a, b) => b.elevation - a.elevation);
  const sorted   = [...favSats, ...restSats];

  const hasAnyDoppler = sorted.some(s => s.dopplerShiftKHz !== null);

  if (loading) {
    return (
      <div className={`sat-list-section${fullHeight ? ' sat-list-full' : ''}`}>
        <div className="section-label">
          Visible Satellites
          <span className="sat-count-badge">—</span>
        </div>
        <div className="sat-table-wrap">
          <table className="sat-table">
            <thead>
              <tr>
                <th></th><th>Name</th><th>El°</th><th className="col-az">Az°</th><th>Range</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map(i => (
                <tr key={i}>
                  <td><Skeleton width="16px" height="16px" /></td>
                  <td><Skeleton width="120px" height="12px" /></td>
                  <td><Skeleton width="36px"  height="12px" /></td>
                  <td className="col-az"><Skeleton width="36px" height="12px" /></td>
                  <td><Skeleton width="48px"  height="12px" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`sat-list-section${fullHeight ? ' sat-list-full' : ''}`}>
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
                <th></th>
                <th>Name</th>
                <th>El°</th>
                <th className="col-az">Az°</th>
                <th>Range</th>
                {hasAnyDoppler && <th>Ku-band Doppler</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((sat, i) => {
                const isFav    = favSet.has(sat.satname);
                const isFirst  = i === 0;
                const isDivider = !isFav && i === favSats.length && favSats.length > 0;
                return (
                  <>
                    {isDivider && (
                      <tr key={`divider`} className="fav-divider-row">
                        <td colSpan={hasAnyDoppler ? 6 : 5}>
                          <div className="fav-divider"/>
                        </td>
                      </tr>
                    )}
                    {isFirst && isFav && (
                      <tr key="fav-label" className="fav-label-row">
                        <td colSpan={hasAnyDoppler ? 6 : 5}>
                          <span className="fav-section-label">FAVOURITES</span>
                        </td>
                      </tr>
                    )}
                    <tr key={sat.satname + i}>
                      <td className="sat-star-cell">
                        {onToggleFavourite && (
                          <StarBtn
                            active={isFav}
                            onClick={e => { e.stopPropagation(); onToggleFavourite(sat.satname); }}
                          />
                        )}
                      </td>
                      <td className="sat-name sat-name-link" onClick={() => onSelectSatellite(sat)}>{sat.satname}</td>
                      <td style={{ color: elevColor(sat.elevation), fontWeight: 600 }}>
                        {sat.elevation.toFixed(1)}
                      </td>
                      <td className="col-az sat-dim">{sat.azimuth.toFixed(1)}</td>
                      <td className="sat-dim">{formatDistance(sat.range, units)}</td>
                      {hasAnyDoppler && (
                        <td style={{
                          color:      dopplerColor(sat.dopplerShiftHz, sat.dopplerShiftKHz),
                          fontFamily: 'var(--mono)',
                          fontSize:   '10px',
                          fontWeight: 600,
                          textAlign:  'right',
                        }}>
                          {dopplerVal(sat.dopplerShiftHz, sat.dopplerShiftKHz)}
                          {sat.dopplerShiftHz !== null && (
                            <span className="doppler-unit"> kHz</span>
                          )}
                        </td>
                      )}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
