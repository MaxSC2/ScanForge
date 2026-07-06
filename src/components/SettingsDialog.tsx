import { useEffect, useRef, useState } from 'react';
import {
  BotIcon,
  BoxIcon,
  EyeIcon,
  EyeOffIcon,
  Grid3X3Icon,
  KeyboardIcon,
  LayersIcon,
  LanguagesIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  ScanTextIcon,
  SettingsIcon,
  XIcon,
  ZoomInIcon,
} from '../icons';
import { useAgentStore } from '../stores/useAgentStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';
import { useProjectStore } from '../stores/useProjectStore';
import { usePersistenceStore } from '../stores/usePersistenceStore';
import { SNAP_THRESHOLD, GRID_STEP } from '../utils/snapping';

type SettingsTab = 'editor' | 'pipeline' | 'shortcuts' | 'ai';

const SECTIONS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Инструменты',
    items: [
      { keys: ['V'], label: 'Инструмент «Выбор»' },
      { keys: ['R'], label: 'Инструмент «Регион»' },
      { keys: ['H'], label: 'Инструмент «Панорама»' },
      { keys: ['G'], label: 'Переключить сетку' },
    ],
  },
  {
    title: 'Регионы',
    items: [
      { keys: ['Del'], label: 'Удалить выбранный регион' },
      { keys: ['Tab'], label: 'Следующий регион' },
      { keys: ['Shift+Tab'], label: 'Предыдущий регион' },
      { keys: ['Ctrl+D'], label: 'Дублировать регион' },
      { keys: ['↑ ↓ ← →'], label: 'Сдвинуть регион на 1px' },
      { keys: ['Shift+↑ ↓ ← →'], label: 'Сдвинуть регион на 10px' },
      { keys: ['Alt+↑ ↓ ← →'], label: 'Изменить размер региона' },
    ],
  },
  {
    title: 'OCR и перевод',
    items: [
      { keys: ['Ctrl+Shift+O'], label: 'Запустить OCR' },
      { keys: ['Ctrl+Shift+T'], label: 'Запустить перевод' },
    ],
  },
  {
    title: 'Экспорт и склейка',
    items: [
      { keys: ['Ctrl+Shift+E'], label: 'Экспорт рендера в PNG' },
      { keys: ['Ctrl+M'], label: 'Склеить выбранные страницы' },
    ],
  },
  {
    title: 'Масштаб',
    items: [
      { keys: ['Ctrl++'], label: 'Приблизить' },
      { keys: ['Ctrl+-'], label: 'Отдалить' },
      { keys: ['Ctrl+0'], label: 'Сброс масштаба' },
      { keys: ['Ctrl+Shift+1'], label: 'Реальный размер (1:1)' },
      { keys: ['Ctrl+Shift+W'], label: 'По ширине' },
      { keys: ['Ctrl+Shift+F'], label: 'По странице' },
    ],
  },
  {
    title: 'Панели',
    items: [
      { keys: ['Ctrl+B'], label: 'Переключить боковую панель' },
      { keys: ['Ctrl+I'], label: 'Переключить инспектор' },
      { keys: ['Ctrl+.'], label: 'Фокус-режим' },
      { keys: ['Ctrl+Shift+.'], label: 'Чистый режим' },
      { keys: ['Ctrl+Shift+H'], label: 'Оверлеи регионов' },
    ],
  },
  {
    title: 'История',
    items: [
      { keys: ['Ctrl+Z'], label: 'Отменить' },
      { keys: ['Ctrl+Shift+Z'], label: 'Повторить' },
    ],
  },
  {
    title: 'Навигация',
    items: [
      { keys: ['← / ↑ / PageUp'], label: 'Предыдущая страница' },
      { keys: ['→ / ↓ / Space'], label: 'Следующая страница' },
      { keys: ['Esc'], label: 'Выйти из чистого режима / снять выделение' },
    ],
  },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('editor');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const pointerHandler = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', pointerHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('pointerdown', pointerHandler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 pt-10 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/98 shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3.5">
          <SettingsIcon size={16} className="text-zinc-500" />
          <h2 className="flex-1 text-sm font-semibold text-zinc-100">Настройки</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800/60 px-3 pt-2">
          <SettingsTabButton
            active={tab === 'editor'}
            icon={<ZoomInIcon size={12} />}
            label="Редактор"
            onClick={() => setTab('editor')}
          />
          <SettingsTabButton
            active={tab === 'pipeline'}
            icon={<ScanTextIcon size={12} />}
            label="Пайплайн"
            onClick={() => setTab('pipeline')}
          />
          <SettingsTabButton
            active={tab === 'shortcuts'}
            icon={<KeyboardIcon size={12} />}
            label="Горячие клавиши"
            onClick={() => setTab('shortcuts')}
          />
          <SettingsTabButton
            active={tab === 'ai'}
            icon={<BotIcon size={12} />}
            label="AI"
            onClick={() => setTab('ai')}
          />
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {tab === 'editor' && <EditorSettings />}
          {tab === 'pipeline' && <PipelineSettings />}
          {tab === 'ai' && <AiSettings />}
          {tab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </div>
    </div>
  );
}

function SettingsTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-zinc-900 text-zinc-200'
          : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Editor Settings ─── */

function EditorSettings() {
  const store = useEditorStore();
  const projectMeta = useProjectStore((s) => s.meta);

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Project Info */}
      <SettingsSection title="Проект">
        <SettingsRow label="Название">
          <span className="text-[11px] text-zinc-300">{projectMeta.name}</span>
        </SettingsRow>
        <SettingsRow label="Файл">
          <span className="truncate text-[11px] text-zinc-500">
            {projectMeta.localProjectId ?? 'Не сохранён'}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* View Defaults */}
      <SettingsSection title="Отображение">
        <ToggleRow
          label="Показывать сетку"
          value={store.gridVisible}
          onChange={() => store.toggleGrid()}
        />
        <ToggleRow
          label="Подписи регионов"
          value={store.labelsVisible}
          onChange={() => store.toggleLabels()}
        />
        <ToggleRow
          label="Оверлеи регионов"
          value={store.regionOverlaysVisible}
          onChange={() => store.toggleRegionOverlays()}
        />
        <ToggleRow
          label="Миникарта"
          value={store.minimapVisible}
          onChange={() => store.toggleMinimap()}
        />
      </SettingsSection>

      {/* Snap Settings */}
      <SettingsSection title="Привязка (Snap)">
        <ToggleRow
          label="Привязывать к сетке (G)"
          value={store.gridVisible}
          onChange={() => store.toggleGrid()}
        />
        <SettingsRow label="Шаг сетки">
          <span className="text-[11px] text-zinc-300">{GRID_STEP}px</span>
        </SettingsRow>
        <SettingsRow label="Порог срабатывания">
          <span className="text-[11px] text-zinc-300">{SNAP_THRESHOLD}px</span>
        </SettingsRow>
      </SettingsSection>

      {/* OCR / Translation Defaults */}
      <SettingsSection title="Обработка">
        <ToggleRow
          label="Перезаписывать при OCR"
          value={store.ocrOverwrite}
          onChange={() => store.toggleOcrOverwrite()}
        />
        <ToggleRow
          label="Перезаписывать при переводе"
          value={store.translationOverwrite}
          onChange={() => store.toggleTranslationOverwrite()}
        />
      </SettingsSection>

      {/* Persistence Status */}
      <SettingsSection title="Автосохранение">
        <AutoSaveStatus />
      </SettingsSection>
    </div>
  );
}

/* ─── Pipeline Settings ─── */

function PipelineSettings() {
  const domain = useProjectDomainStore();

  const ocrEngines = [
    { id: 'mock' as const, label: 'Тестовый (mock)' },
    { id: 'windows' as const, label: 'Windows OCR' },
    { id: 'tesseract' as const, label: 'Tesseract' },
    { id: 'paddle' as const, label: 'PaddleOCR' },
    { id: 'manga-ocr' as const, label: 'MangaOCR' },
  ] as const;

  const translationProviders = [
    { id: 'mock' as const, label: 'Тестовый (mock)' },
    { id: 'local' as const, label: 'Локальный' },
    { id: 'remote' as const, label: 'Удалённый' },
  ] as const;

  const sourceLanguages = [
    { id: 'ja' as const, label: 'Японский' },
    { id: 'zh' as const, label: 'Китайский' },
    { id: 'ko' as const, label: 'Корейский' },
    { id: 'en' as const, label: 'Английский' },
    { id: 'auto' as const, label: 'Автоопределение' },
  ] as const;

  const targetLanguages = [
    { id: 'ru' as const, label: 'Русский' },
    { id: 'en' as const, label: 'Английский' },
  ] as const;

  if (!domain.settings) {
    return (
      <div className="p-5 text-center text-[11px] text-zinc-500">
        Настройки пайплайна недоступны (проект не загружен).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <SettingsSection title="OCR">
        <SelectRow
          label="Движок OCR"
          value={domain.settings.ocrEngine}
          options={ocrEngines.map((e) => ({ value: e.id, label: e.label }))}
          onChange={(value) =>
            domain.updateSettings({ ocrEngine: value as typeof domain.settings.ocrEngine })
          }
        />
      </SettingsSection>

      <SettingsSection title="Перевод">
        <SelectRow
          label="Провайдер"
          value={domain.settings.translationProvider}
          options={translationProviders.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(value) =>
            domain.updateSettings({
              translationProvider: value as typeof domain.settings.translationProvider,
            })
          }
        />
      </SettingsSection>

      <SettingsSection title="Языки">
        <SelectRow
          label="Исходный язык"
          value={domain.settings.sourceLanguage}
          options={sourceLanguages.map((l) => ({ value: l.id, label: l.label }))}
          onChange={(value) =>
            domain.updateSettings({
              sourceLanguage: value as typeof domain.settings.sourceLanguage,
            })
          }
        />
        <SelectRow
          label="Целевой язык"
          value={domain.settings.targetLanguage}
          options={targetLanguages.map((l) => ({ value: l.id, label: l.label }))}
          onChange={(value) =>
            domain.updateSettings({
              targetLanguage: value as typeof domain.settings.targetLanguage,
            })
          }
        />
      </SettingsSection>

      {/* Text Styles */}
      <SettingsSection title="Текстовые стили">
        {domain.textStyles.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Стили текста не созданы.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {domain.textStyles.map((style) => {
              const isDefault = domain.settings?.defaultTextStyleId === style.id;
              return (
                <div
                  key={style.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isDefault
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : 'border-zinc-800 bg-zinc-900/40'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-200">{style.name}</span>
                    <div className="flex items-center gap-1.5">
                      {isDefault ? (
                        <span className="text-[9px] text-indigo-400">По умолчанию</span>
                      ) : (
                        <button
                          onClick={() =>
                            domain.updateSettings({ defaultTextStyleId: style.id })
                          }
                          className="text-[9px] text-zinc-600 hover:text-zinc-300"
                        >
                          Сделать умолч.
                        </button>
                      )}
                      <span className="text-[9px] text-zinc-600">
                        {style.fontSize}px
                      </span>
                    </div>
                  </div>
                  <div
                    className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
                    style={{
                      fontFamily: style.fontFamily,
                      fontSize: `${Math.min(style.fontSize, 24)}px`,
                      fontStyle: 'normal',
                      lineHeight: style.lineHeight,
                      letterSpacing: `${style.letterSpacing}px`,
                      textAlign: style.align,
                      color: style.fill,
                      WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
                      textShadow:
                        style.strokeWidth > 0
                          ? `${style.strokeWidth}px 0 ${style.stroke}, -${style.strokeWidth}px 0 ${style.stroke}, 0 ${style.strokeWidth}px ${style.stroke}, 0 -${style.strokeWidth}px ${style.stroke}`
                          : 'none',
                    }}
                  >
                    Аа Бб Вв Гг Дд — 123
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

/* ─── AI Tab ─── */

function AiSettings() {
  const config = useAgentStore((s) => s.config);
  const setConfig = useAgentStore((s) => s.setConfig);
  const clearConfig = useAgentStore((s) => s.clearConfig);

  const [provider, setProvider] = useState(config?.provider ?? 'openai');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? '');
  const [model, setModel] = useState(config?.model ?? 'gpt-4o');
  const [maxTokens, setMaxTokens] = useState(config?.maxTokens ?? 4096);
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.7);

  const inputClass =
    'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none';

  const handleSave = () => {
    if (!apiKey.trim() && provider !== 'ollama') return;
    setConfig({
      provider: provider as 'openai' | 'anthropic' | 'ollama',
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || getDefaultBaseUrl(provider),
      model: model.trim() || getDefaultModel(provider),
      maxTokens,
      temperature,
    });
  };

  const handleClear = () => {
    clearConfig();
    setApiKey('');
    setBaseUrl('');
    setModel('gpt-4o');
    setMaxTokens(4096);
    setTemperature(0.7);
  };

  function getDefaultBaseUrl(p: string): string {
    if (p === 'ollama') return 'http://localhost:11434/v1';
    if (p === 'anthropic') return 'https://api.anthropic.com/v1';
    return 'https://api.openai.com/v1';
  }

  function getDefaultModel(p: string): string {
    if (p === 'ollama') return 'llama3.2';
    if (p === 'anthropic') return 'claude-sonnet-4-20250514';
    return 'gpt-4o';
  }

  return (
    <div className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Провайдер
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={inputClass}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (локальный)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            API ключ
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'ollama' ? 'Не требуется для локального API' : 'sk-...'}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Base URL (опционально)
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === 'ollama'
                ? 'http://localhost:11434/v1'
                : provider === 'anthropic'
                  ? 'https://api.anthropic.com/v1'
                  : 'https://api.openai.com/v1'
            }
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Модель
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={
              provider === 'ollama'
                ? 'llama3.2'
                : provider === 'anthropic'
                  ? 'claude-sonnet-4-20250514'
                  : 'gpt-4o'
            }
            className={inputClass}
          />
          <span className="text-[9px] text-zinc-600">
            Полное имя модели, например: gpt-4o, claude-sonnet-4-20250514, llama3.2
          </span>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Max tokens
            </label>
            <input
              type="number"
              min={1}
              max={128000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Temperature
            </label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() && provider !== 'ollama'}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
          >
            Сохранить
          </button>

          {config && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-zinc-800 px-4 py-2 text-[11px] text-zinc-500 transition-colors hover:text-red-400"
            >
              Сбросить
            </button>
          )}
        </div>

        {config && (
          <div className="rounded-lg border border-emerald-900/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300">
            AI настроен: {config.provider} / {config.model}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shortcuts Tab ─── */

function ShortcutsTab() {
  return (
    <div className="p-5">
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {section.title}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900"
              >
                <span className="text-[11px] text-zinc-300">{item.label}</span>
                <span className="ml-4 flex flex-none items-center gap-1">
                  {item.keys.map((keyCombo) => (
                    <kbd
                      key={keyCombo}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400"
                    >
                      {keyCombo}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Shared UI Primitives ─── */

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <button
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? 'bg-indigo-500' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-200"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AutoSaveStatus() {
  const saveState = usePersistenceStore((s) => s.saveState);
  const lastSavedAt = usePersistenceStore((s) => s.lastSavedAt);

  const statusLabel =
    saveState === 'saving'
      ? 'Сохранение...'
      : saveState === 'pending'
        ? 'Ожидание...'
        : saveState === 'error'
          ? 'Ошибка'
          : lastSavedAt
            ? `Сохранено ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(lastSavedAt)}`
            : 'Готов';

  const statusColor =
    saveState === 'saving'
      ? 'text-indigo-400'
      : saveState === 'error'
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-zinc-400">Статус</span>
      <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
    </div>
  );
}
