import { useState, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const BASE = import.meta.env.VITE_API_URL ?? '';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };

    setMessages(prev => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok || !res.body) throw new Error('Network error');

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
                  content:     data.error ? 'Sorry, I couldn\'t get a response. Please try again.' : last.content,
                  isStreaming: false,
                };
                return updated;
              });
              setIsStreaming(false);
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content:     'Sorry, I couldn\'t connect to the AI. Please try again.',
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, clearHistory };
}
