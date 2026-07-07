import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { PlusIcon, SearchIcon, Trash2Icon } from '../icons';
import { memoryDelete, memorySave } from '../services/ai/memory';
import { AccordionSection } from '../features/inspector/inspectorShared';

interface MemoryEntry {
  key: string;
  value: string;
  timestamp: number;
}

const MEMORY_KEY = 'scanforge.ai.memory';

function loadAll(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editingExistingKey, setEditingExistingKey] = useState<string | null>(null);

  const refresh = () => setMemories(loadAll());

  useEffect(() => { refresh(); }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? memories.filter((m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q))
    : memories;

  const handleSave = () => {
    if (!editKey.trim() || !editValue.trim()) return;
    memorySave(editKey.trim(), editValue.trim());
    refresh();
    cancelForm();
  };

  const handleEdit = (entry: MemoryEntry) => {
    setEditingExistingKey(entry.key);
    setEditKey(entry.key);
    setEditValue(entry.value);
    setShowForm(false);
  };

  const handleDelete = (key: string) => {
    memoryDelete(key);
    refresh();
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingExistingKey(null);
    setEditKey('');
    setEditValue('');
  };

  return (
    <AccordionSection title="Память AI" icon={<Brain size={12} />}>
      <div className="space-y-2">
        <div className="relative">
          <SearchIcon size={10} className="pointer-events-none absolute left-2 top-1.5 text-zinc-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск в памяти..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1 pl-6 pr-2 text-[10px] text-zinc-300 placeholder-zinc-600"
          />
        </div>

        {filtered.length > 0 && (
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {filtered.map((entry) => (
              <div
                key={entry.key}
                className="group flex items-start gap-1 rounded-md px-2 py-1 text-[10px] transition-colors hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-200">{entry.key}</div>
                  <div className="text-zinc-400 line-clamp-2">{entry.value}</div>
                  <span className="text-[9px] text-zinc-600">
                    {new Date(entry.timestamp).toLocaleString('ru')}
                  </span>
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="rounded p-0.5 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-200"
                    aria-label="Редактировать"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(entry.key)}
                    className="rounded p-0.5 text-zinc-600 hover:bg-red-500/20 hover:text-red-400"
                    aria-label="Удалить"
                  >
                    <Trash2Icon size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="py-1 text-center text-[10px] text-zinc-600">
            {q ? 'Ничего не найдено' : 'Память пуста'}
          </p>
        )}

        {(showForm || editingExistingKey) && (
          <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
            <input
              type="text"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              placeholder="Ключ"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600"
            />
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Значение (факт, предпочтение, конвенция)"
              rows={2}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600 resize-none"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                className="flex-1 rounded-md bg-indigo-500/20 px-2 py-1 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30"
              >
                {editingExistingKey ? 'Сохранить' : 'Добавить'}
              </button>
              <button
                onClick={cancelForm}
                className="rounded-md px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {!showForm && !editingExistingKey && (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-800 py-1.5 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            <PlusIcon size={10} />
            <span>Добавить факт</span>
          </button>
        )}
      </div>
    </AccordionSection>
  );
}
