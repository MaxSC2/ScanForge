import { create } from 'zustand';
import type { AiChatMessage, AiConfig, AgentStatus } from '../services/ai/types';
import { AgentOrchestrator } from '../services/ai/orchestrator';

const AI_CONFIG_KEY = 'scanforge.ai.config';

function getSavedConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as AiConfig) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: AiConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

interface AgentState {
  config: AiConfig | null;
  status: AgentStatus;
  messages: AiChatMessage[];
  error: string | null;
  orchestrator: AgentOrchestrator | null;

  setConfig: (config: AiConfig) => void;
  clearConfig: () => void;
  sendMessage: (text: string) => Promise<void>;
  abort: () => void;
}

let messageIdCounter = 0;
function nextMessageId() {
  return `ai-msg-${Date.now()}-${++messageIdCounter}`;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  config: getSavedConfig(),
  status: 'idle',
  messages: [],
  error: null,
  orchestrator: null,

  setConfig: (config) => {
    saveConfig(config);
    const orchestrator = new AgentOrchestrator(config);

    orchestrator.on('status', (status) => {
      set({ status });
    });

    set({ config, orchestrator, error: null });
  },

  clearConfig: () => {
    localStorage.removeItem(AI_CONFIG_KEY);
    set({ config: null, orchestrator: null, status: 'idle', messages: [], error: null });
  },

  sendMessage: async (text) => {
    const { config, orchestrator } = get();
    if (!config || !orchestrator) {
      set({ error: 'AI не настроен. Укажите API ключ в настройках.' });
      return;
    }

    const userMsg: AiChatMessage = {
      id: nextMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], error: null, status: 'thinking' }));

    try {
      const response = await orchestrator.run(text);

      const assistantMsg: AiChatMessage = {
        id: nextMessageId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      set((s) => ({ messages: [...s.messages, assistantMsg], status: 'done' }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ status: 'idle' });
        return;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nextMessageId(),
            role: 'assistant',
            content: `Ошибка: ${errMsg}`,
            timestamp: Date.now(),
          },
        ],
        status: 'error',
        error: errMsg,
      }));
    }
  },

  abort: () => {
    get().orchestrator?.abort();
    set({ status: 'idle' });
  },
}));
