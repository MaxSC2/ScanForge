import type { AiConfig, AiMessage, ToolCall, ToolDefinition } from './types';

export interface AiProvider {
  chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    onToken?: (token: string) => void,
  ): Promise<{ content: string; toolCalls: ToolCall[] }>;
}

/* ─── OpenAI ─── */

class OpenAIProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    onToken?: (token: string) => void,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(normalizeMessage),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: !!onToken,
      stream_options: onToken ? { include_usage: false } : undefined,
    };
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
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

    if (!onToken) {
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

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let content = '';
    let toolCalls: ToolCall[] = [];
    let toolCallBuffer: string | null = null;
    let toolCallName: string | null = null;
    let toolCallId: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              onToken(delta.content);
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) toolCallId = tc.id;
                if (tc.function?.name) toolCallName = tc.function.name;
                if (tc.function?.arguments) {
                  toolCallBuffer = (toolCallBuffer ?? '') + tc.function.arguments;
                }
              }
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (toolCallBuffer && toolCallName) {
      try {
        toolCalls = [{
          id: toolCallId ?? `openai-${Date.now()}`,
          name: toolCallName,
          arguments: JSON.parse(toolCallBuffer),
        }];
      } catch {
        // arguments not valid JSON — return content only
      }
    }

    return { content, toolCalls };
  }
}

/* ─── Anthropic ─── */

class AnthropicProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    onToken?: (token: string) => void,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: messages.map(normalizeMessage),
    };
    if (onToken) body.stream = true;
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(this.config.baseUrl, {
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

    if (!onToken) {
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

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let content = '';
    let toolCalls: ToolCall[] = [];
    let buffer = '';
    let anthToolCallId = '';
    let anthToolCallName = '';
    let anthToolCallBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const type = parsed.type;

            if (type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const text = parsed.delta.text;
              content += text;
              onToken(text);
            }

            if (type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
              anthToolCallId = parsed.content_block.id;
              anthToolCallName = parsed.content_block.name;
            }

            if (type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
              anthToolCallBuffer += parsed.delta.partial_json;
            }

            if (type === 'message_stop') {
              if (anthToolCallBuffer && anthToolCallName) {
                try {
                  toolCalls = [{
                    id: anthToolCallId || `anthropic-${Date.now()}`,
                    name: anthToolCallName,
                    arguments: JSON.parse(anthToolCallBuffer),
                  }];
                } catch {}
              }
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content, toolCalls };
  }
}

/* ─── Ollama ─── */

class OllamaProvider implements AiProvider {
  constructor(private config: AiConfig) {}

  async chat(
    messages: AiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    onToken?: (token: string) => void,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(normalizeMessage),
      stream: !!onToken,
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

    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }

    if (!onToken) {
      const json = await res.json();
      return {
        content: json.message?.content ?? '',
        toolCalls: (json.message?.tool_calls ?? []).map((tc: Record<string, unknown>) => ({
          id: String(tc?.id ?? `ollama-${Date.now()}`),
          name: (tc.function as Record<string, string>).name,
          arguments: (tc.function as Record<string, unknown>).arguments as Record<string, unknown>,
        })),
      };
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let content = '';
    let toolCalls: ToolCall[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              content += parsed.message.content;
              onToken(parsed.message.content);
            }
            if (parsed.message?.tool_calls) {
              toolCalls = parsed.message.tool_calls.map((tc: Record<string, unknown>) => ({
                id: String(tc?.id ?? `ollama-${Date.now()}`),
                name: (tc.function as Record<string, string>).name,
                arguments: (tc.function as Record<string, unknown>).arguments as Record<string, unknown>,
              }));
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content, toolCalls };
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

function normalizeContent(content: string | { type: string; text?: string; image_url?: { url: string } }[]): unknown {
  if (typeof content === 'string') return content;
  return content.map((part) => {
    if (part.type === 'text') return { type: 'text', text: part.text ?? '' };
    if (part.type === 'image_url') return { type: 'image_url', image_url: { url: part.image_url?.url ?? '' } };
    return { type: 'text', text: '' };
  });
}

function normalizeMessage(msg: AiMessage): Record<string, unknown> {
  if (msg.role === 'tool') {
    return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId };
  }
  return { role: msg.role, content: normalizeContent(msg.content) };
}
