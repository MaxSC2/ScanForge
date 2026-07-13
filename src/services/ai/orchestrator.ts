import type { AiConfig, AiMessage, AgentStatus } from './types';
import { createAiProvider, type AiProvider } from './provider';
import { TOOL_DEFINITIONS, dispatchTool } from './tools';
import { getMemoryContext } from './memory';

/** Maximum number of non-system messages to retain in the sliding context window. */
const MAX_CONTEXT_MESSAGES = 30;

/** Base system prompt injected into every conversation. Defines tool capabilities, behavior rules, and language. */
const SYSTEM_PROMPT = `You are an AI assistant integrated into ScanForge, a scanlation/manga editing application.
You can analyze pages, run OCR, translate text, create and modify regions, stitch pages, and export results.

Available tools:
- ocr_page / translate_page: Process pages through the OCR/translation pipeline
- add_region / update_region / delete_region: Manage regions on pages
- batch_update_regions: Modify multiple regions at once
- auto_number_regions: Re-order regions by their visual position
- stitch_pages: Combine multiple pages into one
- export_page: Export a page as rendered PNG
- get_page_info / list_pages / search_project: Explore the project metadata
- undo / redo: History management
- graph_query / graph_path / graph_explain: Query the project knowledge graph for code architecture, dependencies, and relationships
- memory_save / memory_recall: Store and retrieve facts across sessions (project conventions, user preferences)
- analyze_project: Get project statistics (pages, regions by kind/status, job queue)
- find_overlaps: Detect overlapping regions (layout quality check)
- find_issues: Find problematic regions (failed OCR/translation, missing text)
- start_plan / plan_step: Create and track multi-step task plans. Use start_plan first, then execute each step, calling plan_step after each one.

When a user asks to do something, call the appropriate tool(s). If multiple steps are needed
(e.g. "OCR page 3 and translate it"), make multiple tool calls in sequence.
If a tool returns data in JSON, read it and summarize for the user.

For architecture questions ("how does X work?", "what calls Y?", "trace the flow"), use the graph tools first — they reveal code structure without reading every file. Only fall back to file reading if the graph doesn't cover the code (e.g. TypeScript files, which need a manual build).

You have long-term memory: use memory_save to remember important facts about the project or user preferences, and memory_recall to retrieve them on session start. Always check memory at the beginning of a conversation.

Keep responses concise in Russian.`;

/**
 * Orchestrates AI agent conversations. Manages the message loop, injects memory context,
 * enforces a sliding window for context trimming, and handles streaming token emission.
 * Each `run()` call sends a user message and drives tool-call iterations up to MAX_ITERATIONS.
 */
export class AgentOrchestrator {
  private provider: AiProvider;
  private messages: AiMessage[] = [];
  private aborted = false;
  private _status: AgentStatus = 'idle';
  private onStatusChange?: (status: AgentStatus) => void;
  private onMessage?: (message: string) => void;
  private customSystemPrompt?: string;
  onToken?: (token: string) => void;

  /**
   * @param config - Provider configuration (model, API key, endpoint).
   * @param savedMessages - Previously persisted conversation history to restore (system messages are skipped).
   * @param customSystemPrompt - Optional override of the default system prompt, appended before SYSTEM_PROMPT.
   */
  constructor(config: AiConfig, savedMessages?: AiMessage[], customSystemPrompt?: string) {
    this.provider = createAiProvider(config);
    this.customSystemPrompt = customSystemPrompt;
    const base = this.buildSystemPrompt();
    this.messages.push({ role: 'system', content: base });
    if (savedMessages) {
      for (const msg of savedMessages) {
        if (msg.role === 'system') continue;
        const m: AiMessage = { role: msg.role, content: msg.content };
        if (msg.role === 'tool') {
          m.toolCallId = msg.toolCallId;
          m.name = msg.name;
        }
        this.messages.push(m);
      }
    }
    this.trimContext();
  }

  /** Builds the final system prompt — either the default SYSTEM_PROMPT or a custom one merged with the default. */
  private buildSystemPrompt(): string {
    const base = this.customSystemPrompt
      ? `${this.customSystemPrompt}\n\n---\n\n${SYSTEM_PROMPT}`
      : SYSTEM_PROMPT;
    return base;
  }

  /**
   * Sliding-window context trimmer. When non-system messages exceed MAX_CONTEXT_MESSAGES,
   * older messages are condensed into a synthetic "[Previous context summary]" system message,
   * preserving the most recent user + assistant + tool exchange.
   */
  private trimContext() {
    const systemIdx = this.messages.findIndex(m => m.role === 'system');
    const system = systemIdx >= 0 ? [this.messages[systemIdx]] : [];
    const rest = systemIdx >= 0 ? this.messages.slice(systemIdx + 1) : this.messages;

    if (rest.length <= MAX_CONTEXT_MESSAGES) return;

    const compressed = [];
    let userCount = 0;
    for (let i = rest.length - 1; i >= 0; i--) {
      const m = rest[i];
      if (m.role === 'user') {
        compressed.unshift(m);
        userCount++;
      } else if (m.role === 'assistant' || m.role === 'tool') {
        if (userCount > 0 || compressed.length === 0) {
          compressed.unshift(m);
        }
      }
    }

    const summary = rest.slice(0, Math.max(0, rest.length - MAX_CONTEXT_MESSAGES));
    const summaryText = summary
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => m.role === 'user' ? `User: ${m.content.slice(0, 100)}` : `Assistant: ${m.content.slice(0, 100)}`)
      .join('\n');

    this.messages = [
      ...system,
      ...(summaryText ? [{ role: 'system' as const, content: `[Previous context summary:\n${summaryText}\n]` }] : []),
      ...compressed.slice(-MAX_CONTEXT_MESSAGES),
    ];
  }

  /** Returns the current agent status (idle | thinking | awaiting_tool | done). */
  get status() {
    return this._status;
  }

  /** Registers a callback for status-change or message events. */
  on(event: 'status', handler: (status: AgentStatus) => void): void;
  on(event: 'message', handler: (message: string) => void): void;
  on(event: string, handler: unknown) {
    if (event === 'status') this.onStatusChange = handler as (status: AgentStatus) => void;
    if (event === 'message') this.onMessage = handler as (message: string) => void;
  }

  /** Signals the agent to stop as soon as possible. The current provider call will be rejected with AbortError. */
  abort() {
    this.aborted = true;
  }

  /**
   * Injects long-term memory (from `getMemoryContext`) into the system prompt.
   * The memory block is appended to the existing system prompt on every `run()` call
   * so the model is aware of persisted facts from the start of the turn.
   */
  private injectMemoryContext() {
    const memoryCtx = getMemoryContext();
    if (!memoryCtx) return;
    const sysIdx = this.messages.findIndex(m => m.role === 'system' && typeof m.content === 'string' && !m.content.startsWith('[Previous context'));
    if (sysIdx >= 0) {
      const base = this.buildSystemPrompt() + memoryCtx;
      this.messages[sysIdx] = { role: 'system', content: base };
    }
  }

  /**
   * Runs the agent loop: injects memory, appends the user message, then iteratively
   * calls the provider (with streaming via `onToken`), dispatches any tool calls,
   * and loops until the model returns a text-only response or MAX_ITERATIONS is reached.
   *
   * @param userMessage - The user's input text.
   * @returns The final assistant response text, or a default "done" message in Russian.
   * @throws DOMException('AbortError') if `abort()` was called mid-execution.
   */
  async run(userMessage: string): Promise<string> {
    this.aborted = false;
    this.injectMemoryContext();
    this.messages.push({ role: 'user', content: userMessage });

    let fullResponse = '';
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS && !this.aborted) {
      iterations++;

      this.setStatus('thinking');
      const result = await this.provider.chat(this.messages, TOOL_DEFINITIONS, undefined, this.onToken);

      if (this.aborted) throw new DOMException('Agent cancelled', 'AbortError');

      if (result.content) {
        fullResponse += result.content;
        this.messages.push({ role: 'assistant', content: result.content });
        this.onMessage?.(result.content);
      }

      if (result.toolCalls.length === 0) break;

      if (result.content) {
        this.setStatus('awaiting_tool');
      }

      for (const toolCall of result.toolCalls) {
        if (this.aborted) throw new DOMException('Agent cancelled', 'AbortError');

        this.onMessage?.(`⚙️ Calling ${toolCall.name}...`);

        let output: string;
        try {
          output = await dispatchTool(toolCall);
        } catch (error) {
          output = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }

        this.messages.push({
          role: 'tool',
          content: output,
          toolCallId: toolCall.id,
          name: toolCall.name,
        });
      }
    }

    this.setStatus('done');
    return fullResponse || 'Готово. Задачи выполнены.';
  }

  /** Updates the internal status and fires the status-change callback. */
  private setStatus(status: AgentStatus) {
    this._status = status;
    this.onStatusChange?.(status);
  }
}
