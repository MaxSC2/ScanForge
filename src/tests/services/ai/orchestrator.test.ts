import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AiConfig } from '../../../services/ai/types';

vi.mock('../../../services/ai/provider', () => ({
  createAiProvider: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({ content: 'Hello!', toolCalls: [] }),
  })),
}));

vi.mock('../../../services/ai/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: vi.fn().mockResolvedValue('ok'),
}));

vi.mock('../../../services/ai/memory', () => ({
  getMemoryContext: vi.fn().mockReturnValue(null),
}));

// Dynamic import after mocks
const { AgentOrchestrator } = await import('../../../services/ai/orchestrator');
const { createAiProvider } = await import('../../../services/ai/provider');
const { getMemoryContext } = await import('../../../services/ai/memory');

describe('AgentOrchestrator', () => {
  const config: AiConfig = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'sk-test',
    endpoint: 'https://api.openai.com/v1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('builds system prompt with default', () => {
      const orch = new AgentOrchestrator(config);
      // @ts-expect-error private access
      expect(orch.messages[0]?.role).toBe('system');
      // @ts-expect-error private access
      expect(orch.messages[0]?.content).toContain('ScanForge');
    });

    it('appends custom system prompt', () => {
      const orch = new AgentOrchestrator(config, [], 'Custom instructions');
      // @ts-expect-error private access
      expect(orch.messages[0]?.content).toContain('Custom instructions');
      // @ts-expect-error private access
      expect(orch.messages[0]?.content).toContain('ScanForge');
    });

    it('restores saved messages (skips system)', () => {
      const saved = [
        { role: 'system' as const, content: 'old system' },
        { role: 'user' as const, content: 'hello' },
        { role: 'assistant' as const, content: 'hi' },
      ];
      const orch = new AgentOrchestrator(config, saved);
      // @ts-expect-error private access
      const userMsgs = orch.messages.filter((m: { role: string }) => m.role !== 'system');
      expect(userMsgs).toHaveLength(2);
    });
  });

  describe('run', () => {
    it('sends user message and returns response', async () => {
      const orch = new AgentOrchestrator(config);
      const result = await orch.run('Hello');
      expect(result).toBe('Hello!');
    });

    it('injects memory context before run', async () => {
      vi.mocked(getMemoryContext).mockReturnValue('Some memory');
      const orch = new AgentOrchestrator(config);
      await orch.run('Test');
      // Memory context should have been appended to system prompt
      // @ts-expect-error private access
      const sysMsg = orch.messages[0];
      expect(sysMsg.content).toContain('Some memory');
    });

    it('fires status callbacks', async () => {
      const orch = new AgentOrchestrator(config);
      const statuses: string[] = [];
      orch.on('status', (s) => statuses.push(s));
      await orch.run('Hello');
      expect(statuses).toContain('thinking');
      expect(statuses).toContain('done');
    });
  });

  describe('abort', () => {
    it('sets aborted flag', () => {
      const orch = new AgentOrchestrator(config);
      orch.abort();
      // @ts-expect-error private access
      expect(orch.aborted).toBe(true);
    });
  });

  describe('status getter', () => {
    it('returns current status', () => {
      const orch = new AgentOrchestrator(config);
      expect(orch.status).toBe('idle');
    });
  });
});
