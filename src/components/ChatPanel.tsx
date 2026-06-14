import { useState, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useChat } from '../hooks/useChat';
import type { LiveContext } from '../hooks/useChat';

// ── Markdown / content renderer ───────────────────────────────────────────────

function renderContent(text: string): React.ReactNode {
  // Split on **bold** spans, then highlight satellite names inside them
  const segments = text.split(/(\*\*[^*\n]+\*\*)/g);
  const nodes: React.ReactNode[] = [];

  segments.forEach((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      const inner = seg.slice(2, -2);
      const isSat = /^(STARLINK|ONEWEB|ISS|GPS|NAVSTAR)/i.test(inner);
      nodes.push(
        isSat
          ? <span key={i} className="chat-sat-name">{inner}</span>
          : <strong key={i}>{inner}</strong>,
      );
    } else {
      // Inside plain text, still highlight bare satellite names
      const parts = seg.split(/(STARLINK-\d+|ONEWEB-\d+|ISS|GPS\s+\w+)/g);
      parts.forEach((p, j) => {
        const isSat = /^(STARLINK-\d+|ONEWEB-\d+|ISS)$/.test(p);
        nodes.push(isSat ? <span key={`${i}-${j}`} className="chat-sat-name">{p}</span> : p);
      });
    }
  });

  return <>{nodes}</>;
}

// ── Voice input ───────────────────────────────────────────────────────────────

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-GB';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    recRef.current = r;
    r.start();
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle, supported };
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const BASE_CHIPS = [
  { icon: '🛰', text: "When's the next pass above 70° elevation?" },
  { icon: '📡', text: "Is my signal good enough for a video call right now?" },
  { icon: '🌤', text: "Will cloud cover affect my connection later today?" },
  { icon: '⚡', text: "Which satellite has the strongest Doppler shift right now?" },
  { icon: '📱', text: "Can my phone connect to Starlink directly?" },
  { icon: '🎯', text: "Best time this week for large file downloads?" },
];

function getChips(ctx?: LiveContext): typeof BASE_CHIPS {
  const extra: typeof BASE_CHIPS = [];
  if (ctx?.signalScore && ctx.signalScore < 50) {
    extra.unshift({ icon: '📉', text: "Signal is low — when will it improve?" });
  }
  if (ctx?.hasDtcSat) {
    extra.unshift({ icon: '📲', text: "There's a DTC satellite overhead — how do I connect?" });
  }
  return [...extra, ...BASE_CHIPS].slice(0, 6);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open:     boolean;
  onClose:  () => void;
  context?: LiveContext;
}

export function ChatPanel({ open, onClose, context }: Props) {
  const { messages, sendMessage, isStreaming, clearHistory } = useChat(context);
  const [input,    setInput]    = useState('');
  const bottomRef               = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const chips                   = getChips(context);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 280);
  }, [open]);

  // Cmd+K / Ctrl+K closes; Esc closes
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-grow textarea
  function adjustHeight() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    sendMessage(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const { listening, toggle: toggleVoice, supported: voiceSupported } = useVoiceInput(
    text => { setInput(text); setTimeout(adjustHeight, 0); },
  );

  return (
    <div className={`chat-panel${open ? ' open' : ''}`} role="dialog" aria-label="StarTrack AI chat">

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent-purple)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span className="chat-header-title">StarTrack AI</span>
          {context && (
            <span className="chat-live-badge">
              <span className="chat-live-dot"/>
              {context.satelliteCount} sats · {context.signalScore}/100
            </span>
          )}
        </div>
        <div className="chat-header-actions">
          <span className="chat-shortcut-hint">esc to close</span>
          {messages.length > 0 && (
            <button className="icon-btn" onClick={clearHistory} title="Clear conversation" style={{ opacity: 0.55 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="chat-welcome-title">Ask StarTrack AI</div>
            {context && (
              <div className="chat-welcome-stats">
                <span className="chat-stat"><span style={{ color: 'var(--accent-primary)' }}>{context.satelliteCount}</span> satellites overhead</span>
                <span className="chat-stat-sep">·</span>
                <span className="chat-stat">best at <span style={{ color: 'var(--accent-secondary)' }}>{context.bestElevation}°</span></span>
                <span className="chat-stat-sep">·</span>
                <span className="chat-stat">signal <span style={{ color: context.signalScore >= 70 ? 'var(--accent-secondary)' : context.signalScore >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>{context.signalScore}/100</span></span>
              </div>
            )}
            <p className="chat-welcome-label">Ask me anything about your satellite connection</p>
            <div className="chat-chips">
              {chips.map(c => (
                <button key={c.text} className="chat-chip" onClick={() => sendMessage(c.text)}>
                  <span className="chat-chip-icon">{c.icon}</span>
                  {c.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="chat-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
              )}
              <div className="chat-bubble">
                {msg.isStreaming && msg.content === '' ? (
                  <span className="chat-typing"><span/><span/><span/></span>
                ) : (
                  <>
                    {renderContent(msg.content || '—')}
                    {msg.isStreaming && <span className="chat-cursor"/>}
                  </>
                )}
              </div>
              <div className="chat-ts">{formatTime(msg.timestamp)}</div>
            </div>
          ))
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestion chips after conversation starts */}
      {messages.length > 0 && !isStreaming && messages[messages.length - 1]?.role === 'assistant' && (
        <div className="chat-quick-chips">
          <button className="chat-quick-chip" onClick={() => sendMessage("When's the next pass above 70°?")}>Next 70°+ pass</button>
          <button className="chat-quick-chip" onClick={() => sendMessage("Is my signal strong enough for a video call?")}>Video call?</button>
          <button className="chat-quick-chip" onClick={() => sendMessage("What satellite is at the best elevation right now?")}>Best sat now</button>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          rows={1}
          onChange={e => { setInput(e.target.value); adjustHeight(); }}
          onKeyDown={onKeyDown}
          placeholder="Ask anything — when's the next pass above 70°?"
          disabled={isStreaming}
          aria-label="Chat input"
        />
        {voiceSupported && (
          <button
            className={`chat-voice-btn${listening ? ' chat-voice-btn--active' : ''}`}
            onClick={toggleVoice}
            title={listening ? 'Stop recording' : 'Voice input'}
            aria-label={listening ? 'Stop recording' : 'Voice input'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        )}
        <button
          className="chat-send-btn"
          onClick={submit}
          disabled={!input.trim() || isStreaming}
          aria-label="Send message"
        >
          {isStreaming ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
