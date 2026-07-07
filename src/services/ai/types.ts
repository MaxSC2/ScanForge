export type AiProviderId = 'openai' | 'anthropic' | 'ollama';

export interface AiConfig {
  provider: AiProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | AiContentPart[];
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | AiContentPart[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

export type AgentStatus = 'idle' | 'thinking' | 'awaiting_tool' | 'done' | 'error';

export interface AgentState {
  status: AgentStatus;
  messages: AiChatMessage[];
  error: string | null;
}
