import type { Satellite } from '../types';

interface Props {
  recommendation: string;
  satellites: Satellite[];
  loading: boolean;
}

function parseBold(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  );
}

function splitSentences(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+([\s\S]*)/);
  return m ? [m[1], m[2]] : [text, ''];
}

export function AIRecommendation({ recommendation, satellites, loading }: Props) {
  const starlinkSat = satellites.find(s => s.satname.toUpperCase().includes('STARLINK'));
  const [first, rest] = recommendation ? splitSentences(recommendation) : ['', ''];

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <svg className="ai-panel-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--green)' }}>
          <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2Z"/>
        </svg>
        <span className="ai-panel-eyebrow">AI Recommendation</span>
      </div>

      {loading && !recommendation && (
        <div className="ai-loading"><span className="spinner" /> Analysing passes…</div>
      )}

      {first && (
        <p className="ai-text-first">{parseBold(first)}</p>
      )}
      {rest && (
        <p className="ai-text-rest">{parseBold(rest)}</p>
      )}

      {starlinkSat && (
        <div className="dtc-card">
          <svg className="dtc-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4.5 16.5c-1.5 1.5-1.5 4 0 5.5s4 1.5 5.5 0l10-10c1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0"/>
            <path d="M8 8l8 8M7.5 3.5L3 8M20.5 16.5L16 21"/>
          </svg>
          <div>
            <div className="dtc-title">{starlinkSat.satname} · Direct-to-Cell capable</div>
            <div className="dtc-body">
              Currently at {starlinkSat.elevation.toFixed(1)}° — standard cellular devices can connect directly without ground infrastructure.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
