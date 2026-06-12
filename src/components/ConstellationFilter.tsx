import type { Satellite } from '../types';
import { CONSTELLATIONS, getConstellation } from '../utils/constellation';

interface Props {
  satellites: Satellite[];
  active:     string;
  onChange:   (c: string) => void;
}

export function ConstellationFilter({ satellites, active, onChange }: Props) {
  function countFor(c: string): number {
    if (c === 'ALL') return satellites.length;
    return satellites.filter(s => getConstellation(s.satname) === c).length;
  }

  return (
    <div className="constellation-filter">
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
