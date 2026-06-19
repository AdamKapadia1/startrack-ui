import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props   { children: ReactNode }
interface State   { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[StarTrack] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        background: '#050d09',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'monospace',
      }}>
        <div style={{
          background: '#0a1a12',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff4444"
            strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.8 }}>
            <path d="M12 2L2 19h20L12 2z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <circle cx="12" cy="16" r="0.5" fill="#ff4444"/>
          </svg>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8f5f0', marginBottom: '8px' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: '12px', color: '#4a6080', lineHeight: 1.6, marginBottom: '8px' }}>
            StarTrack encountered an error. Refresh the page to reconnect.
          </div>
          {this.state.message && (
            <div style={{ fontSize: '10px', color: '#ff4444', fontFamily: 'monospace', marginBottom: '16px',
              background: 'rgba(239,68,68,0.08)', padding: '8px', borderRadius: '6px', wordBreak: 'break-all' }}>
              {this.state.message}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px',
              background: 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.4)',
              borderRadius: '8px',
              color: '#00d4ff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
}
