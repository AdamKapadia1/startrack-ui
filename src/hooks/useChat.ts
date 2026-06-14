import { useState, useCallback, useEffect } from 'react';

export interface ChatMessage {
  role:        'user' | 'assistant';
  content:     string;
  timestamp:   Date;
  isStreaming?: boolean;
}

export interface LiveContext {
  satelliteCount:   number;
  bestElevation:    number;
  signalScore:      number;
  cloudCover?:      number;
  temp?:            number;
  topSatName?:      string;
  topSatElevation?: number;
  hasDtcSat:        boolean;
}

const BASE         = 'https://web-production-98c0d.up.railway.app';
const STORAGE_KEY  = 'startrack-chat-history';
const MAX_STORED   = 40;

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ role: string; content: string; timestamp: string }>;
    return parsed.map(m => ({
      role:      m.role as 'user' | 'assistant',
      content:   m.content,
      timestamp: new Date(m.timestamp),
    }));
  } catch { return []; }
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    const toSave = msgs
      .filter(m => !m.isStreaming)
      .slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* storage full or unavailable */ }
}

function buildContextNote(ctx: LiveContext): string {
  const weather = [
    ctx.cloudCover != null ? `cloud ${ctx.cloudCover}%` : null,
    ctx.temp != null       ? `temp ${ctx.temp}°C`       : null,
  ].filter(Boolean).join(', ');
  const topSat = ctx.topSatName
    ? `. Top satellite: ${ctx.topSatName} at ${ctx.topSatElevation ?? 0}°`
    : '';
  const dtc = ctx.hasDtcSat ? '. Direct-to-Cell capable satellite currently overhead.' : '';
  return `[Live context: ${ctx.satelliteCount} satellites overhead, best elevation ${ctx.bestElevation}°, signal score ${ctx.signalScore}/100${weather ? `, weather: ${weather}` : ''}${topSat}${dtc}]`;
}

export function useChat(context?: LiveContext) {
  const [messages,    setMessages]    = useState<ChatMessage[]>(() => loadHistory());
  const [isStreaming, setIsStreaming] = useState(false);

  // Persist to localStorage whenever messages change (skip mid-stream state)
  useEffect(() => {
    if (!isStreaming) saveHistory(messages);
  }, [messages, isStreaming]);

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return;

    const contextNote = context ? buildContextNote(context) : '';
    const textWithCtx = contextNote ? `${text}\n\n${contextNote}` : text;
    const history     = messages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };

    setMessages(prev => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: textWithCtx, history }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.chunk) {
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + data.chunk };
                return updated;
              });
            }
            if (data.done || data.error) {
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content:     data.error ? "Sorry, I couldn't get a response. Please try again." : last.content,
                  isStreaming: false,
                };
                return updated;
              });
              setIsStreaming(false);
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err: any) {
      console.error('[chat] fetch error:', err.message);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content:     "Sorry, I couldn't connect to the AI. Check your connection and try again.",
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, context]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { messages, sendMessage, isStreaming, clearHistory };
}
