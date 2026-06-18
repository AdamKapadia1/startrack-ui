import type { Satellite } from '../types';
import { CONSTELLATIONS, getConstellation } from '../utils/constellation';

interface Props {
  satellites: Satellite[];
  active:     string;
  onChange:   (c: string) => void;
  favourites?: string[];
}

export function ConstellationFilter({ satellites, active, onChange, favourites = [] }: Props) {
  function countFor(c: string): number {
    if (c === 'ALL') return satellites.length;
    return satellites.filter(s => getConstellation(s.satname, s.constellation) === c).length;
  }

  const favVisibleCount = satellites.filter(s => favourites.includes(s.satname)).length;

  return (
    <div className="constellation-filter">
      {favVisibleCount > 0 && (
        <button
          className={`const-pill const-pill--fav${active === 'FAVOURITES' ? ' const-pill--active' : ''}`}
          onClick={() => onChange('FAVOURITES')}
        >
          ★ FAV
          <span className="const-pill-count">{favVisibleCount}</span>
        </button>
      )}
      {CONSTELLATIONS.map(c => {
        const count    = countFor(c);
        const isActive = active === c;
        return (
          <button
            key={c}
            className={`const-pill${isActive ? ' const-pill--active' : ''}`}
            onClick={() => onChange(c)}
          >
            {c}
            <span className="const-pill-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
