import { useRef, useState } from 'react';
import { Book } from 'lucide-react';
import { PlusIcon, SearchIcon, Trash2Icon } from '../icons';
import { useGlossaryStore } from '../stores/useGlossaryStore';
import { AccordionSection } from '../features/inspector/inspectorShared';

export function GlossaryPanel() {
  const entries = useGlossaryStore((s) => s.entries);
  const addEntry = useGlossaryStore((s) => s.addEntry);
  const updateEntry = useGlossaryStore((s) => s.updateEntry);
  const removeEntry = useGlossaryStore((s) => s.removeEntry);
  const search = useGlossaryStore((s) => s.search);
  const importJSON = useGlossaryStore((s) => s.importJSON);
  const exportJSON = useGlossaryStore((s) => s.exportJSON);

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState('');
  const [translated, setTranslated] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim() ? search(query) : entries;

  const handleAdd = () => {
    if (!source.trim() || !translated.trim()) return;
    addEntry(source.trim(), translated.trim(), 'en→ru');
    setSource('');
    setTranslated('');
    setShowForm(false);
  };

  const handleUpdate = (id: string) => {
    if (!source.trim() || !translated.trim()) return;
    updateEntry(id, { source: source.trim(), translated: translated.trim() });
    setSource('');
    setTranslated('');
    setEditingId(null);
  };

  const startEdit = (entry: { id: string; source: string; translated: string }) => {
    setEditingId(entry.id);
    setSource(entry.source);
    setTranslated(entry.translated);
    setShowForm(false);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSource('');
    setTranslated('');
  };

  return (
    <AccordionSection title="Глоссарий" icon={<Book size={12} />}>
      <div className="space-y-2">
        <div className="relative">
          <SearchIcon size={10} className="pointer-events-none absolute left-2 top-1.5 text-zinc-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск в глоссарии..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1 pl-6 pr-2 text-[10px] text-zinc-300 placeholder-zinc-600"
          />
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => importRef.current?.click()}
            className="flex-1 rounded border border-zinc-800 py-1 text-[9px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Импорт JSON
          </button>
          <button
            onClick={() => {
              const json = exportJSON();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'glossary.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 rounded border border-zinc-800 py-1 text-[9px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Экспорт JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                importJSON(await file.text());
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Ошибка импорта');
              }
              e.target.value = '';
            }}
          />
        </div>

        {filtered.length > 0 && (
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-1 rounded-md px-2 py-1 text-[10px] transition-colors hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-200">
                    {entry.source}
                  </div>
                  <div className="text-zinc-400">
                    {entry.translated}
                  </div>
                  <span className="text-[9px] text-zinc-600">
                    {entry.language}
                  </span>
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(entry)}
                    className="rounded p-0.5 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-200"
                    aria-label="Редактировать"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeEntry(entry.id)}
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
            {query.trim() ? 'Ничего не найдено' : 'Глоссарий пуст'}
          </p>
        )}

        {(showForm || editingId) && (
          <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Исходный текст"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600"
            />
            <input
              type="text"
              value={translated}
              onChange={(e) => setTranslated(e.target.value)}
              placeholder="Перевод"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600"
            />
            <div className="flex gap-1">
              <button
                onClick={editingId ? () => handleUpdate(editingId) : handleAdd}
                className="flex-1 rounded-md bg-indigo-500/20 px-2 py-1 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30"
              >
                {editingId ? 'Сохранить' : 'Добавить'}
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

        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-800 py-1.5 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            <PlusIcon size={10} />
            <span>Добавить запись</span>
          </button>
        )}
      </div>
    </AccordionSection>
  );
}
