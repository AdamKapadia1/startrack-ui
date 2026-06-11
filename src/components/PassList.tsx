import type { Pass } from '../hooks/useRecommendation';
import { CalendarButton, BulkExportButton } from './CalendarExport';

interface Props {
  passes:       Pass[];
  satname:      string;
  locationName: string;
}

function elevColor(el: number) {
  if (el >= 60) return 'var(--green)';
  if (el >= 30) return 'var(--amber)';
  return 'var(--grey)';
}

function passScore(el: number): number {
  return Math.round(40 + (el / 90) * 60);
}

function formatTime(utc: number) {
  return new Date(utc * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function shortName(name: string) {
  return name.replace('STARLINK-', 'SL-').replace('SPACE STATION', 'ISS').slice(0, 14);
}

export function PassList({ passes, satname, locationName }: Props) {
  if (!passes.length) {
    return <div className="pass-empty">No passes in the next 7 days</div>;
  }

  return (
    <>
      <BulkExportButton passes={passes} locationName={locationName} />
      <div className="pass-list-head">
        <span>Satellite</span>
        <span>Elevation</span>
        <span>Score</span>
        <span>Time</span>
        <span></span>
      </div>
      <div className="pass-list-body">
        {passes.map((pass, i) => {
          const color = elevColor(pass.maxEl);
          const score = passScore(pass.maxEl);
          const pct   = `${Math.round((pass.maxEl / 90) * 100)}%`;
          return (
            <div key={i} className="pass-row">
              <div className="pass-name">{shortName(pass.satname ?? satname)}</div>
              <div className="pass-bar-wrap">
                <div className="pass-bar" style={{ width: pct, background: color }}/>
              </div>
              <div className="pass-score" style={{ color }}>{score} pts</div>
              <div className="pass-time">{formatTime(pass.startUTC)}</div>
              <CalendarButton pass={pass} locationName={locationName} />
            </div>
          );
        })}
      </div>
    </>
  );
}
