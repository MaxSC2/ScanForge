/** localStorage key used to persist the memory array as JSON. */
const MEMORY_KEY = 'scanforge.ai.memory';

/** A single persisted memory entry with a unique key, value, and creation/update timestamp. */
interface MemoryEntry {
  key: string;
  value: string;
  timestamp: number;
}

function loadAll(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: MemoryEntry[]) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(entries));
}

/**
 * Saves a key-value fact to long-term memory. Entries are stored in localStorage
 * as a JSON array of {@link MemoryEntry} objects under the key `scanforge.ai.memory`.
 * If the key already exists, its value and timestamp are overwritten.
 *
 * @param key - Unique identifier for the fact (e.g. "project_name", "ocr_engine").
 * @param value - The fact content to remember.
 * @returns A confirmation message including the first 100 characters of the value.
 */
export function memorySave(key: string, value: string): string {
  const entries = loadAll();
  const existing = entries.findIndex(e => e.key === key);
  const entry: MemoryEntry = { key, value, timestamp: Date.now() };

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  saveAll(entries);
  return `Saved: "${key}" = "${value.slice(0, 100)}${value.length > 100 ? '…' : ''}"`;
}

/**
 * Retrieves saved memories from persistent storage. With no query, returns all entries.
 * With a query string, performs a case-insensitive match against both key and value fields.
 *
 * @param query - Optional keyword to filter memories by.
 * @returns A JSON-stringified array of matching memory entries, or a "no memories" message.
 */
export function memoryRecall(query?: string): string {
  const entries = loadAll();

  if (entries.length === 0) return 'No memories saved yet.';

  if (!query) {
    return JSON.stringify(
      entries.map(e => ({ key: e.key, value: e.value.length > 120 ? e.value.slice(0, 120) + '…' : e.value })),
      null,
      2,
    );
  }

  const q = query.toLowerCase();
  const matched = entries.filter(
    e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
  );

  if (matched.length === 0) return `No memories matching "${query}".`;

  return JSON.stringify(
    matched.map(e => ({ key: e.key, value: e.value.length > 200 ? e.value.slice(0, 200) + '…' : e.value })),
    null,
    2,
  );
}

/**
 * Deletes a single memory entry by its key.
 *
 * @param key - The key of the memory to remove.
 * @returns A confirmation message, or a "not found" message if the key did not exist.
 */
export function memoryDelete(key: string): string {
  const entries = loadAll();
  const filtered = entries.filter(e => e.key !== key);
  if (filtered.length === entries.length) return `No memory found with key "${key}".`;
  saveAll(filtered);
  return `Deleted memory: "${key}"`;
}

/**
 * Builds a string summarizing all saved memories for injection into the system prompt.
 * Each memory is formatted as "- key: value" with values truncated to 200 characters.
 * Returns an empty string if no memories exist.
 */
export function getMemoryContext(): string {
  const entries = loadAll();
  if (entries.length === 0) return '';
  const lines = entries.map(e => `- ${e.key}: ${e.value.replace(/\n/g, ' ').slice(0, 200)}`);
  return `\n\nSaved knowledge:\n${lines.join('\n')}`;
}
