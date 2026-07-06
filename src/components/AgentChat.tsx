import { useState, useRef, useEffect } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { BotIcon, SquareIcon } from '../icons';
import { useAgentStore } from '../stores/useAgentStore';

export function AgentChat() {
  const messages = useAgentStore((s) => s.messages);
  const status = useAgentStore((s) => s.status);
  const error = useAgentStore((s) => s.error);
  const config = useAgentStore((s) => s.config);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const abort = useAgentStore((s) => s.abort);

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === 'thinking') return;
    setInput('');
    void sendMessage(text);
  };

  if (!config) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
          <BotIcon size={22} className="text-zinc-500" />
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-400">AI-агент не настроен</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Укажите API ключ в настройках, чтобы AI мог выполнять задачи
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <BotIcon size={13} className="text-zinc-500" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          AI Агент
        </span>
        {status === 'thinking' || status === 'awaiting_tool' ? (
          <span className="flex items-center gap-1 text-[9px] text-indigo-400">
            <LoaderCircle size={10} className="animate-spin" />
            Думает...
          </span>
        ) : null}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="pt-6 text-center text-[11px] text-zinc-600">
            Спросите AI что-нибудь вроде «Отсканируй первую страницу» или «Сколько всего страниц?»
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
              msg.role === 'user'
                ? 'ml-6 bg-indigo-500/10 text-zinc-200'
                : 'mr-6 border border-zinc-800 bg-zinc-900/60 text-zinc-300'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {error && (
          <div className="mr-6 rounded-xl border border-red-900/50 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 border-t border-zinc-800 p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            status === 'thinking' || status === 'awaiting_tool'
              ? 'Ожидание ответа...'
              : 'Напишите задачу...'
          }
          disabled={status === 'thinking' || status === 'awaiting_tool'}
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 disabled:opacity-50"
        />

        {status === 'thinking' || status === 'awaiting_tool' ? (
          <button
            type="button"
            onClick={abort}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            title="Прервать"
          >
            <SquareIcon size={13} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-30"
            title="Отправить"
          >
            <Send size={13} />
          </button>
        )}
      </form>
    </div>
  );
}
