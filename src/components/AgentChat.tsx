import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, LoaderCircle, Send, Sparkles } from 'lucide-react';
import { BotIcon, SquareIcon, XIcon } from '../icons';
import { useAgentStore } from '../stores/useAgentStore';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import { useJobStore } from '../stores/useJobStore';
import { renderPageToBlob } from '../features/export/renderExport';
import type { AiContentPart } from '../services/ai/types';
import { useAutoSuggest } from '../hooks/useAutoSuggest';

function renderText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="my-1 overflow-x-auto rounded-md bg-zinc-950 p-2 text-[10px] text-zinc-300">
            <code>{codeContent}</code>
          </pre>,
        );
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 pl-2">
          <span className="text-zinc-600">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 pl-2">
          <span className="w-4 text-right text-zinc-600">{line.match(/^(\d+)\.\s/)?.[1]}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>,
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-2 text-[12px] font-semibold text-zinc-200">{renderInline(line.slice(3))}</h3>,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="mt-1 text-[11px] font-semibold text-zinc-300">{renderInline(line.slice(4))}</h4>,
      );
      continue;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-2 border-zinc-700 pl-2 text-zinc-500">{renderInline(line.slice(2))}</blockquote>,
      );
      continue;
    }

    elements.push(<div key={`p-${i}`}>{renderInline(line)}</div>);
  }

  if (inCodeBlock && codeContent) {
    elements.push(
      <pre key="code-end" className="my-1 overflow-x-auto rounded-md bg-zinc-950 p-2 text-[10px] text-zinc-300">
        <code>{codeContent}</code>
      </pre>,
    );
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      parts.push(<strong key={idx++} className="font-semibold text-zinc-100">{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
    if (italicMatch) {
      parts.push(<em key={idx++} className="italic">{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={idx++} className="rounded bg-zinc-800 px-1 text-[10px] text-indigo-300">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={idx++} href={linkMatch[2]} className="text-indigo-400 underline" target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>,
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderMessageContent(content: string | AiContentPart[], role: string, status: string) {
  if (typeof content === 'string') {
    if (role === 'user') return content;
    return content ? (
      <div className="space-y-0.5">{renderText(content)}</div>
    ) : (status === 'thinking' || status === 'awaiting_tool' ? (
      <span className="inline-flex items-center gap-1 text-zinc-600">
        <LoaderCircle size={10} className="animate-spin" />
        Думает...
      </span>
    ) : '');
  }

  return (
    <div className="space-y-2">
      {content.map((part, i) =>
        part.type === 'text' ? (
          <div key={i} className="space-y-0.5">{renderText(part.text)}</div>
        ) : part.type === 'image_url' ? (
          <img
            key={i}
            src={part.image_url.url}
            alt="Attached page"
            className="max-h-48 w-auto rounded-lg border border-zinc-700"
          />
        ) : null,
      )}
    </div>
  );
}

export function AgentChat() {
  const messages = useAgentStore((s) => s.messages);
  const status = useAgentStore((s) => s.status);
  const error = useAgentStore((s) => s.error);
  const config = useAgentStore((s) => s.config);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const abort = useAgentStore((s) => s.abort);
  const activePage = usePageStore((s) => s.getActivePage());
  const activePageId = usePageStore((s) => s.activePageId);
  const queueOcr = useJobStore((s) => s.queueOcrJobs);
  const queueTranslate = useJobStore((s) => s.queueTranslationJobs);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const deleteRegion = useRegionStore((s) => s.deleteRegion);

  const [input, setInput] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const doAutoNumber = useCallback((pageId: string) => {
    const page = usePageStore.getState().pages.find((p) => p.id === pageId);
    if (!page) return;
    const sorted = [...page.regions].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      updateRegion(pageId, sorted[i].id, { order: i + 1 });
    }
  }, [updateRegion]);

  const suggestions = useAutoSuggest({
    queueOcr: (pageId, regionIds) => queueOcr(regionIds ? [{ pageId, regionIds }] : [{ pageId }]),
    queueTranslate: (pageId, regionIds) => queueTranslate(regionIds ? [{ pageId, regionIds }] : [{ pageId }]),
    autoNumber: doAutoNumber,
    deleteRegion,
  });

  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.id));

  const dismissSuggestion = (id: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(id));
  };

  const resetDismissed = () => setDismissedSuggestions(new Set());

  useEffect(() => {
    resetDismissed();
  }, [activePageId]);

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

  const handleAttachPage = async () => {
    if (!activePage || status === 'thinking' || attaching) return;
    setAttaching(true);
    try {
      const { blob } = await renderPageToBlob(activePage);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const parts: AiContentPart[] = [
        { type: 'text', text: 'Анализируй эту страницу' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ];

      void sendMessage(parts);
    } catch {
      // silent fail
    } finally {
      setAttaching(false);
    }
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
        {visibleSuggestions.length > 0 && (
          <div className="space-y-1 rounded-xl border border-indigo-900/30 bg-indigo-500/5 p-2">
            <div className="flex items-center gap-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-indigo-400">
              <Sparkles size={10} />
              Рекомендации
            </div>
            {visibleSuggestions.map((s) => (
              <div key={s.id} className="group flex items-start gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors hover:bg-indigo-500/10">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.priority === 'high' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                <span className="flex-1 text-zinc-300">
                  <button onClick={s.action} className="font-medium text-indigo-300 hover:text-indigo-200">{s.label}</button>
                  <span className="ml-1 text-zinc-500">{s.description}</span>
                </span>
                <button
                  onClick={() => dismissSuggestion(s.id)}
                  className="shrink-0 rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                >
                  <XIcon size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && visibleSuggestions.length === 0 && (
          <div className="pt-6 text-center text-[11px] text-zinc-600">
            Спросите AI что-нибудь вроде «Отсканируй первую страницу» или «Сколько всего страниц?»
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group relative rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
              msg.role === 'user'
                ? 'ml-6 bg-indigo-500/10 text-zinc-200'
                : 'mr-6 border border-zinc-800 bg-zinc-900/60 text-zinc-300'
            }`}
          >
            {renderMessageContent(msg.content, msg.role, status)}
            {msg.role === 'assistant' && typeof msg.content === 'string' && msg.content && (
              <button
                onClick={() => navigator.clipboard?.writeText(msg.content as string)}
                className="absolute right-1.5 top-1.5 rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                title="Копировать"
              >
                <Copy size={10} />
              </button>
            )}
          </div>
        ))}

        {error && (
          <div className="mr-6 rounded-xl border border-red-900/50 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-1 border-t border-zinc-800 p-2">
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
          <>
            <button
              type="button"
              onClick={handleAttachPage}
              disabled={!activePage || attaching}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              title="Прикрепить текущую страницу"
            >
              {attaching ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-30"
              title="Отправить"
            >
              <Send size={13} />
            </button>
          </>
        )}
      </form>
    </div>
  );
}
