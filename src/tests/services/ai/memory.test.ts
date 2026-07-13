import { afterEach, describe, expect, it } from 'vitest';
import { memorySave, memoryRecall, memoryDelete, getMemoryContext } from '../../../services/ai/memory';

const MEMORY_KEY = 'scanforge.ai.memory';

describe('memory module', () => {
  afterEach(() => {
    localStorage.removeItem(MEMORY_KEY);
  });

  describe('memorySave', () => {
    it('saves a new memory entry', () => {
      const result = memorySave('project_name', 'My Manga');
      expect(result).toContain('My Manga');
      const data = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '[]');
      expect(data).toHaveLength(1);
      expect(data[0].key).toBe('project_name');
      expect(data[0].value).toBe('My Manga');
    });

    it('overwrites existing key', () => {
      memorySave('key1', 'value1');
      memorySave('key1', 'value2');
      const data = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '[]');
      expect(data).toHaveLength(1);
      expect(data[0].value).toBe('value2');
    });

    it('truncates long values in response message', () => {
      const longValue = 'A'.repeat(200);
      const result = memorySave('long', longValue);
      expect(result).toContain('…');
    });
  });

  describe('memoryRecall', () => {
    it('returns message when no memories exist', () => {
      expect(memoryRecall()).toBe('No memories saved yet.');
    });

    it('returns all entries when no query', () => {
      memorySave('key1', 'value1');
      memorySave('key2', 'value2');
      const result = memoryRecall();
      expect(result).toContain('key1');
      expect(result).toContain('key2');
    });

    it('filters by query case-insensitively', () => {
      memorySave('ProjectName', 'My Project');
      memorySave('OtherKey', 'Some other value');
      const result = memoryRecall('project');
      expect(result).toContain('ProjectName');
      expect(result).not.toContain('OtherKey');
    });

    it('returns not-found message for non-matching query', () => {
      memorySave('key1', 'value1');
      expect(memoryRecall('nonexistent')).toContain('No memories matching');
    });
  });

  describe('memoryDelete', () => {
    it('deletes existing memory', () => {
      memorySave('key1', 'value1');
      const result = memoryDelete('key1');
      expect(result).toContain('Deleted');
      expect(JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '[]')).toHaveLength(0);
    });

    it('returns not-found for non-existent key', () => {
      const result = memoryDelete('nonexistent');
      expect(result).toContain('No memory found');
    });
  });

  describe('getMemoryContext', () => {
    it('returns empty string when no memories', () => {
      expect(getMemoryContext()).toBe('');
    });

    it('formats memories as bullet list', () => {
      memorySave('lang', 'ja');
      memorySave('engine', 'manga-ocr');
      const ctx = getMemoryContext();
      expect(ctx).toContain('Saved knowledge');
      expect(ctx).toContain('- lang: ja');
      expect(ctx).toContain('- engine: manga-ocr');
    });
  });
});
