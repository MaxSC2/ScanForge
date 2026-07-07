const MEMORY_KEY = 'scanforge.ai.memory';

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

export function memoryDelete(key: string): string {
  const entries = loadAll();
  const filtered = entries.filter(e => e.key !== key);
  if (filtered.length === entries.length) return `No memory found with key "${key}".`;
  saveAll(filtered);
  return `Deleted memory: "${key}"`;
}

export function getMemoryContext(): string {
  const entries = loadAll();
  if (entries.length === 0) return '';
  const lines = entries.map(e => `- ${e.key}: ${e.value.replace(/\n/g, ' ').slice(0, 200)}`);
  return `\n\nSaved knowledge:\n${lines.join('\n')}`;
}
