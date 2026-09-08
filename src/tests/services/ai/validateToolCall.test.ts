import { describe, expect, it } from 'vitest';
import { validateToolCall } from '../../../services/ai/tools';
import type { ToolCall } from '../../../services/ai/types';

describe('validateToolCall', () => {
  it('accepts a valid tool call with all required params', () => {
    const call: ToolCall = {
      id: '1',
      name: 'add_region',
      arguments: { pageId: 'p1', x: 10, y: 20, width: 100, height: 50 },
    };
    expect(validateToolCall(call)).toBeNull();
  });

  it('rejects unknown tool names', () => {
    const call: ToolCall = {
      id: '2',
      name: 'delete_database',
      arguments: {},
    };
    expect(validateToolCall(call)).toContain('Unknown tool');
  });

  it('rejects missing required parameters', () => {
    const call: ToolCall = {
      id: '3',
      name: 'add_region',
      arguments: { pageId: 'p1' }, // no x/y/width/height
    };
    expect(validateToolCall(call)).toContain('Missing required parameter');
  });

  it('rejects unknown parameters', () => {
    const call: ToolCall = {
      id: '4',
      name: 'add_region',
      arguments: { pageId: 'p1', x: 1, y: 2, width: 3, height: 4, evil: true },
    };
    expect(validateToolCall(call)).toContain('Unknown parameter');
  });

  it('rejects enum violations', () => {
    const call: ToolCall = {
      id: '5',
      name: 'add_region',
      arguments: { pageId: 'p1', x: 1, y: 2, width: 3, height: 4, kind: 'alien' },
    };
    expect(validateToolCall(call)).toContain('not in allowed values');
  });

  it('accepts valid OCR call with pageIds', () => {
    const call: ToolCall = {
      id: '6',
      name: 'ocr_page',
      arguments: { pageIds: ['p1', 'p2'] },
    };
    expect(validateToolCall(call)).toBeNull();
  });
});