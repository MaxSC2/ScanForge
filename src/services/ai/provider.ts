import type { AiConfig, AiMessage, ToolCall, ToolDefinition } from './types';

export interface AiProvider {
  chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }>;
}

/* ─── OpenAI ─── */

class OpenAIProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(normalizeMessage),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const res = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      toolCalls: (choice?.message?.tool_calls ?? []).map((tc: Record<string, unknown>) => ({
        id: tc.id as string,
        name: (tc.function as Record<string, string>).name,
        arguments: JSON.parse((tc.function as Record<string, string>).arguments),
      })),
    };
  }
}

/* ─── Anthropic ─── */

class AnthropicProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: messages.map(normalizeMessage),
    };
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const content = json.content ?? [];
    const textBlocks = content.filter((b: { type: string }) => b.type === 'text');
    const toolBlocks = content.filter((b: { type: string }) => b.type === 'tool_use');

    return {
      content: textBlocks.map((b: { text: string }) => b.text).join('\n'),
      toolCalls: toolBlocks.map((b: { id: string; name: string; input: Record<string, unknown> }) => ({
        id: b.id,
        name: b.name,
        arguments: b.input,
      })),
    };
  }
}

/* ─── Ollama ─── */

class OllamaProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(normalizeMessage),
      options: {
        num_predict: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    };
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const res = await fetch(`${this.config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    return {
      content: json.message?.content ?? '',
      toolCalls: (json.message?.tool_calls ?? []).map((tc: Record<string, unknown>) => ({
        id: tc.id as string ?? `ollama-${Date.now()}`,
        name: (tc.function as Record<string, string>).name,
        arguments: (tc.function as Record<string, unknown>).arguments as Record<string, unknown>,
      })),
    };
  }
}

/* ─── Factory ─── */

export function createAiProvider(config: AiConfig): AiProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
  }
}

function normalizeMessage(msg: AiMessage): Record<string, unknown> {
  if (msg.role === 'tool') {
    return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId };
  }
  return { role: msg.role, content: msg.content };
}
