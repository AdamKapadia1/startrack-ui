import { Skeleton } from './Skeleton';

interface Props {
  recommendation: string;
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

export function AIRecommendation({ recommendation, loading }: Props) {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <Skeleton width="100%" height="14px" />
          <Skeleton width="90%"  height="14px" />
          <Skeleton width="70%"  height="14px" />
        </div>
      )}

      {first && (
        <p className="ai-text-first">{parseBold(first)}</p>
      )}
      {rest && (
        <p className="ai-text-rest">{parseBold(rest)}</p>
      )}
    </div>
  );
}
