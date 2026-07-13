import type { ReactNode } from 'react';
import { useState } from 'react';
import { WandSparkles } from 'lucide-react';
import { LanguagesIcon, PlusIcon, ScanTextIcon, SettingsIcon } from '../../icons';
import {
  type InpaintingProviderId,
  type OcrEngineId,
  type ProjectSourceLanguage,
  type ProjectTargetLanguage,
  type TextStyleRecord,
  type TranslationProviderId,
} from '../../types';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';
import { TextStyleEditor } from '../../components/TextStyleEditor';

const SOURCE_LANGUAGE_OPTIONS: Array<{ value: ProjectSourceLanguage; label: string }> = [
  { value: 'auto', label: 'Авто' },
  { value: 'ja', label: 'Японский' },
  { value: 'zh', label: 'Китайский' },
  { value: 'ko', label: 'Корейский' },
  { value: 'en', label: 'Английский' },
];

const TARGET_LANGUAGE_OPTIONS: Array<{ value: ProjectTargetLanguage; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'Английский' },
];

const OCR_ENGINE_OPTIONS: Array<{ value: OcrEngineId; label: string }> = [
  { value: 'paddle', label: 'Paddle OCR (Python, JP/KO/ZH/EN)' },
  { value: 'easyocr', label: 'EasyOCR (Python, 80+ языков)' },
  { value: 'manga-ocr', label: 'Manga OCR (Python, только JP)' },
  { value: 'windows', label: 'Windows OCR' },
  { value: 'mock', label: 'Превью OCR' },
  { value: 'tesseract', label: 'Tesseract (не готов)' },
];

const TRANSLATION_PROVIDER_OPTIONS: Array<{
  value: TranslationProviderId;
  label: string;
}> = [
  { value: 'local', label: 'Локальный черновик' },
  { value: 'offline', label: 'Офлайн-перевод (kuromoji + словарь)' },
  { value: 'deepl', label: 'DeepL API (500k символов/мес бесплатно)' },
  { value: 'libre', label: 'LibreTranslate (self-hosted)' },
  { value: 'ollama', label: 'Ollama (локальная LLM)' },
  { value: 'sakura', label: 'SakuraLLM (JP→RU/EN, манга)' },
  { value: 'mock', label: 'Превью-черновик' },
  { value: 'remote', label: 'Удаленный (позже)' },
];

const INPAINTING_PROVIDER_OPTIONS: Array<{ value: InpaintingProviderId; label: string }> = [
  { value: 'basic', label: 'Базовый (Canvas 2D)' },
  { value: 'iopaint', label: 'LaMA (IOPaint, требует сервер)' },
];

export function ProjectSettingsPanel() {
  const loading = useProjectDomainStore((state) => state.loading);
  const settings = useProjectDomainStore((state) => state.settings);
  const updateSettings = useProjectDomainStore((state) => state.updateSettings);
  const textStyles = useProjectDomainStore((state) => state.textStyles);
  const ocrOverwrite = useEditorStore((state) => state.ocrOverwrite);
  const translationOverwrite = useEditorStore((state) => state.translationOverwrite);
  const setOcrOverwrite = useEditorStore((state) => state.setOcrOverwrite);
  const setTranslationOverwrite = useEditorStore((state) => state.setTranslationOverwrite);
  const [editingStyle, setEditingStyle] = useState<TextStyleRecord | 'new' | null>(null);

  const disabled = loading || !settings;

  return (
    <section className="px-3 py-3.5">
      <div className="mb-3 flex items-center gap-2">
        <SettingsIcon size={12} className="text-zinc-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Настройки пайплайна
        </h3>
      </div>

      {!settings ? (
        <p className="text-[11px] text-zinc-600">
          Сохрани или автосохрани проект хотя бы один раз, чтобы инициализировать настройки пайплайна.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <SelectField
              label="Источник"
              icon={<LanguagesIcon size={11} className="text-zinc-500" />}
              value={settings.sourceLanguage}
              disabled={disabled}
              options={SOURCE_LANGUAGE_OPTIONS}
              onChange={(value) =>
                void updateSettings({ sourceLanguage: value as ProjectSourceLanguage })
              }
            />

            <SelectField
              label="Цель"
              icon={<LanguagesIcon size={11} className="text-zinc-500" />}
              value={settings.targetLanguage}
              disabled={disabled}
              options={TARGET_LANGUAGE_OPTIONS}
              onChange={(value) =>
                void updateSettings({ targetLanguage: value as ProjectTargetLanguage })
              }
            />

            <SelectField
              label="OCR"
              icon={<ScanTextIcon size={11} className="text-zinc-500" />}
              value={settings.ocrEngine}
              disabled={disabled}
              options={OCR_ENGINE_OPTIONS}
              onChange={(value) => void updateSettings({ ocrEngine: value as OcrEngineId })}
            />
            {(settings.ocrEngine === 'manga-ocr' || settings.ocrEngine === 'paddle' || settings.ocrEngine === 'easyocr') && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 p-2 text-[10px] leading-relaxed text-amber-300">
                <p className="mb-1 font-medium">Требуется Python</p>
                <p className="text-amber-400/80">
                  {settings.ocrEngine === 'manga-ocr'
                    ? 'Установи: pip install manga-ocr'
                    : settings.ocrEngine === 'paddle'
                      ? 'Установи: pip install paddleocr'
                      : 'Установи: pip install easyocr'}
                </p>
              </div>
            )}

            <SelectField
              label="Перевод"
              icon={<WandSparkles size={11} className="text-zinc-500" />}
              value={settings.translationProvider}
              disabled={disabled}
              options={TRANSLATION_PROVIDER_OPTIONS}
              onChange={(value) =>
                void updateSettings({ translationProvider: value as TranslationProviderId })
              }
            />
            {settings.translationProvider === 'deepl' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-zinc-500">DeepL API Key</label>
                <input
                  type="password"
                  defaultValue={localStorage.getItem('scanforge.deepl.api_key') ?? ''}
                  onBlur={(e) => localStorage.setItem('scanforge.deepl.api_key', e.target.value)}
                  className="input-field"
                  placeholder="Free tier: api-free.deepl.com"
                />
              </div>
            )}
            {settings.translationProvider === 'libre' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-zinc-500">LibreTranslate URL</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.libre.url') ?? 'http://localhost:5000'}
                  onBlur={(e) => localStorage.setItem('scanforge.libre.url', e.target.value)}
                  className="input-field"
                  placeholder="http://localhost:5000"
                />
              </div>
            )}
            {settings.translationProvider === 'ollama' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-zinc-500">Ollama endpoint</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.ollama.endpoint') ?? 'http://localhost:11434'}
                  onBlur={(e) => localStorage.setItem('scanforge.ollama.endpoint', e.target.value)}
                  className="input-field"
                  placeholder="http://localhost:11434"
                />
                <label className="text-[10px] font-medium text-zinc-500 mt-1">Модель</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.ollama.model') ?? 'llama3.2:1b'}
                  onBlur={(e) => localStorage.setItem('scanforge.ollama.model', e.target.value)}
                  className="input-field"
                  placeholder="llama3.2:1b"
                />
              </div>
            )}

            {settings.translationProvider === 'sakura' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-zinc-500">Ollama endpoint</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.sakura.endpoint') ?? 'http://localhost:11434'}
                  onBlur={(e) => localStorage.setItem('scanforge.sakura.endpoint', e.target.value)}
                  className="input-field"
                  placeholder="http://localhost:11434"
                />
                <label className="text-[10px] font-medium text-zinc-500 mt-1">Модель SakuraLLM</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.sakura.model') ?? 'sakura-1.5b'}
                  onBlur={(e) => localStorage.setItem('scanforge.sakura.model', e.target.value)}
                  className="input-field"
                  placeholder="sakura-1.5b"
                />
                <p className="text-[10px] leading-relaxed text-amber-400/60">
                  SakuraLLM — модель для перевода JP→RU/EN, оптимизированная под мангу.
                  Загрузи: {`ollama pull sakura-1.5b`} (или другую версию)
                </p>
              </div>
            )}

            <SelectField
              label="Inpainting"
              icon={<WandSparkles size={11} className="text-zinc-500" />}
              value={settings.inpaintingProvider}
              disabled={disabled}
              options={INPAINTING_PROVIDER_OPTIONS}
              onChange={(value) =>
                void updateSettings({ inpaintingProvider: value as InpaintingProviderId })
              }
            />
            {settings.inpaintingProvider === 'iopaint' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-zinc-500">IOPaint endpoint</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('scanforge.iopaint.endpoint') ?? 'http://localhost:8080'}
                  onBlur={(e) => localStorage.setItem('scanforge.iopaint.endpoint', e.target.value)}
                  className="input-field"
                  placeholder="http://localhost:8080"
                />
                <p className="text-[10px] leading-relaxed text-amber-400/60">
                  Запусти сервер: {`iopaint run --model=lama --device=cpu --port=8080`}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <ToggleField
              label="Авто-OCR при загрузке"
              description="Запускать OCR автоматически после добавления страниц."
              value={settings?.autoRunOcr ?? false}
              disabled={disabled}
              onChange={(v) => void updateSettings({ autoRunOcr: v })}
            />
            <ToggleField
              label="Перезаписывать OCR"
              description="Заменять существующий исходный текст при повторном запуске."
              value={ocrOverwrite}
              disabled={disabled}
              onChange={setOcrOverwrite}
            />
            <ToggleField
              label="Перезаписывать перевод"
              description="Заменять существующий переведенный текст при повторном запуске."
              value={translationOverwrite}
              disabled={disabled}
              onChange={setTranslationOverwrite}
            />
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Текстовые стили
              </span>
            </div>

            {textStyles.length === 0 ? (
              <p className="text-[10px] text-zinc-600">Стили не загружены.</p>
            ) : (
              <div className="space-y-1">
                {textStyles.map((style) => {
                  const isDefault = settings?.defaultTextStyleId === style.id;
                  return (
                    <div
                      key={style.id}
                      className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] transition-colors hover:bg-zinc-800/50"
                      onClick={() => setEditingStyle(style)}
                    >
                      <span
                        className="h-3 w-3 flex-none rounded"
                        style={{ backgroundColor: style.fill }}
                      />
                      <span className="flex-1 truncate font-medium text-zinc-300">
                        {style.name}
                      </span>
                      {isDefault && (
                        <span className="rounded bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-400">
                          По умолч.
                        </span>
                      )}
                      {!isDefault && settings && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateSettings({ defaultTextStyleId: style.id });
                          }}
                          className="rounded px-1 py-0.5 text-[8px] text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                        >
                          Сделать умолч.
                        </button>
                      )}
                      <span className="text-zinc-500">{style.fontFamily}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setEditingStyle('new')}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-800 py-1.5 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            >
              <PlusIcon size={10} />
              <span>Новый стиль</span>
            </button>

            {editingStyle && (
              <div className="mt-2">
                <TextStyleEditor
                  style={editingStyle === 'new' ? null : editingStyle}
                  onClose={() => setEditingStyle(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SelectField({
  label,
  icon,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="input-field h-9 bg-zinc-950/70 text-[11px] disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-zinc-200">{label}</div>
          <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">{description}</div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
            value
              ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
        >
          {value ? 'Вкл' : 'Выкл'}
        </button>
      </div>
    </div>
  );
}
