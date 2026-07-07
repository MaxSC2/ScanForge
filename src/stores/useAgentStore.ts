import { create } from 'zustand';
import type { AiChatMessage, AiConfig, AgentStatus, AiContentPart } from '../services/ai/types';
import { AgentOrchestrator } from '../services/ai/orchestrator';

const AI_CONFIG_KEY = 'scanforge.ai.config';
const AI_MESSAGES_KEY = 'scanforge.ai.messages';
const MAX_SAVED_MESSAGES = 50;

function getSaved<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setSaved(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — ignore
  }
}

function getSavedConfig(): AiConfig | null {
  return getSaved<AiConfig>(AI_CONFIG_KEY);
}

function getSavedMessages(): AiChatMessage[] {
  return getSaved<AiChatMessage[]>(AI_MESSAGES_KEY) || [];
}

interface AgentState {
  config: AiConfig | null;
  status: AgentStatus;
  messages: AiChatMessage[];
  error: string | null;
  orchestrator: AgentOrchestrator | null;
  systemPrompt: string;

  setConfig: (config: AiConfig, systemPrompt?: string) => void;
  clearConfig: () => void;
  sendMessage: (content: string | AiContentPart[]) => Promise<void>;
  abort: () => void;
}

let messageIdCounter = 0;
function nextMessageId() {
  return `ai-msg-${Date.now()}-${++messageIdCounter}`;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  config: getSavedConfig(),
  status: 'idle',
  messages: getSavedMessages(),
  error: null,
  orchestrator: null,
  systemPrompt: '',

  setConfig: (config, systemPrompt) => {
    setSaved(AI_CONFIG_KEY, config);
    const savedMessages = getSavedMessages();

    const savedAiMessages = savedMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      toolCallId: m.toolCalls?.[0]?.id,
      name: m.toolCalls?.[0]?.name,
    }));

    const orchestrator = new AgentOrchestrator(config, savedAiMessages, systemPrompt);

    orchestrator.on('status', (status) => {
      set({ status });
    });

    set({ config, orchestrator, systemPrompt: systemPrompt ?? '', error: null });
  },

  clearConfig: () => {
    localStorage.removeItem(AI_CONFIG_KEY);
    localStorage.removeItem(AI_MESSAGES_KEY);
    set({ config: null, orchestrator: null, status: 'idle', messages: [], error: null });
  },

  sendMessage: async (content) => {
    const { config, orchestrator } = get();
    if (!config || !orchestrator) {
      set({ error: 'AI не настроен. Укажите API ключ в настройках.' });
      return;
    }

    const textToSend = typeof content === 'string' ? content : content.map(p => p.type === 'text' ? p.text : '[Image]').join('\n');

    const userMsg: AiChatMessage = {
      id: nextMessageId(),
      role: 'user',
      content: typeof content === 'string' ? content : content as unknown as string,
      timestamp: Date.now(),
    };

    const assistantId = nextMessageId();

    set((s) => ({
      messages: [...s.messages, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }],
      error: null,
      status: 'thinking',
    }));

    orchestrator.onToken = (token: string) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + token } : m,
        ),
      }));
    };

    try {
      const response = await orchestrator.run(textToSend);

      set((s) => {
        const updated = s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: response || m.content } : m,
        );
        const trimmed = updated.slice(-MAX_SAVED_MESSAGES);
        setSaved(AI_MESSAGES_KEY, trimmed);
        return { messages: updated, status: 'done' };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ status: 'idle' });
        return;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      set((s) => {
        const updated = s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: `Ошибка: ${errMsg}` } : m,
        );
        const trimmed = updated.slice(-MAX_SAVED_MESSAGES);
        setSaved(AI_MESSAGES_KEY, trimmed);
        return { messages: updated, status: 'error', error: errMsg };
      });
    }
  },

  abort: () => {
    get().orchestrator?.abort();
    set({ status: 'idle' });
  },
}));
