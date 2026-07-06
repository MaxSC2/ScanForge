import type { AiConfig, AiMessage, AgentStatus } from './types';
import { createAiProvider, type AiProvider } from './provider';
import { TOOL_DEFINITIONS, dispatchTool } from './tools';

const SYSTEM_PROMPT = `You are an AI assistant integrated into ScanForge, a scanlation/manga editing application.
You can analyze pages, run OCR, translate text, create and modify regions, stitch pages, and export results.

Available tools:
- ocr_page / translate_page: Process pages through the OCR/translation pipeline
- add_region / update_region / delete_region: Manage regions on pages
- batch_update_regions: Modify multiple regions at once
- auto_number_regions: Re-order regions by their visual position
- stitch_pages: Combine multiple pages into one
- export_page: Export a page as rendered PNG
- get_page_info / list_pages / search_project: Explore the project
- undo / redo: History management

When a user asks to do something, call the appropriate tool(s). If multiple steps are needed
(e.g. "OCR page 3 and translate it"), make multiple tool calls in sequence.
If a tool returns data in JSON, read it and summarize for the user.

Keep responses concise in Russian.`;

export class AgentOrchestrator {
  private provider: AiProvider;
  private messages: AiMessage[] = [];
  private aborted = false;
  private _status: AgentStatus = 'idle';
  private onStatusChange?: (status: AgentStatus) => void;
  private onMessage?: (message: string) => void;

  constructor(config: AiConfig) {
    this.provider = createAiProvider(config);
    this.messages.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  get status() {
    return this._status;
  }

  on(event: 'status', handler: (status: AgentStatus) => void): void;
  on(event: 'message', handler: (message: string) => void): void;
  on(event: string, handler: unknown) {
    if (event === 'status') this.onStatusChange = handler as (status: AgentStatus) => void;
    if (event === 'message') this.onMessage = handler as (message: string) => void;
  }

  abort() {
    this.aborted = true;
  }

  async run(userMessage: string): Promise<string> {
    this.aborted = false;
    this.messages.push({ role: 'user', content: userMessage });

    let fullResponse = '';
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS && !this.aborted) {
      iterations++;

      this.setStatus('thinking');
      const result = await this.provider.chat(this.messages, TOOL_DEFINITIONS);

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

  private setStatus(status: AgentStatus) {
    this._status = status;
    this.onStatusChange?.(status);
  }
}
