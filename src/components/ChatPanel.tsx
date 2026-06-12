import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useChat } from '../hooks/useChat';
import type { LiveContext } from '../hooks/useChat';

function getDynamicSuggestions(ctx?: LiveContext): string[] {
  const out: string[] = [];
  if (ctx) {
    if (ctx.signalScore > 70) {
      out.push('Signal looks good — what can I do right now?');
    } else if (ctx.signalScore < 50 && ctx.signalScore > 0) {
      out.push('Signal is weak — when will it improve?');
    }
    if (ctx.hasDtcSat) {
      out.push('Can I connect directly with my phone right now?');
    }
  }
  out.push('When is my best pass this week?');
  if (out.length < 4) out.push('Which satellite is closest overhead?');
  if (out.length < 4) out.push('Will cloud cover affect my connection tonight?');
  return out.slice(0, 4);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  context?: LiveContext;
}

export function ChatPanel({ open, onClose, context }: Props) {
  const { messages, sendMessage, isStreaming, clearHistory } = useChat(context);
  const [input, setInput] = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);
  const suggestions       = getDynamicSuggestions(context);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submit();
  }

  return (
    <div className={`chat-panel${open ? ' open' : ''}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span className="chat-header-title">Ask StarTrack AI</span>
        </div>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button className="icon-btn" onClick={clearHistory} title="Clear chat" style={{ opacity: 0.6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close chat">
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
          <div className="chat-suggestions">
            <p className="chat-suggestions-label">Ask me anything about your satellite connection</p>
            {suggestions.map(s => (
              <button key={s} className="chat-suggestion-chip" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
              <div className="chat-bubble">
                {msg.content || (msg.isStreaming ? '' : '—')}
                {msg.isStreaming && msg.content === '' && (
                  <span className="chat-typing">
                    <span/><span/><span/>
                  </span>
                )}
                {msg.isStreaming && msg.content !== '' && (
                  <span className="chat-cursor"/>
                )}
              </div>
              <div className="chat-ts">{formatTime(msg.timestamp)}</div>
            </div>
          ))
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything — when's the next pass? Is signal good now?"
          disabled={isStreaming}
        />
        <button
          className="chat-send-btn"
          onClick={submit}
          disabled={!input.trim() || isStreaming}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
