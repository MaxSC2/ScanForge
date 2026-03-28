import type { ReactNode } from 'react';
import { Languages, ScanText, Settings2, WandSparkles } from 'lucide-react';
import {
  type OcrEngineId,
  type ProjectSourceLanguage,
  type ProjectTargetLanguage,
  type TranslationProviderId,
} from '../../types';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';

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
  { value: 'windows', label: 'Windows OCR' },
  { value: 'mock', label: 'Превью OCR' },
  { value: 'tesseract', label: 'Tesseract (позже)' },
  { value: 'paddle', label: 'Paddle (позже)' },
  { value: 'manga-ocr', label: 'Manga OCR (позже)' },
];

const TRANSLATION_PROVIDER_OPTIONS: Array<{
  value: TranslationProviderId;
  label: string;
}> = [
  { value: 'local', label: 'Локальный черновик' },
  { value: 'mock', label: 'Превью-черновик' },
  { value: 'remote', label: 'Удаленный (позже)' },
];

export function ProjectSettingsPanel() {
  const loading = useProjectDomainStore((state) => state.loading);
  const settings = useProjectDomainStore((state) => state.settings);
  const updateSettings = useProjectDomainStore((state) => state.updateSettings);
  const ocrOverwrite = useEditorStore((state) => state.ocrOverwrite);
  const translationOverwrite = useEditorStore((state) => state.translationOverwrite);
  const setOcrOverwrite = useEditorStore((state) => state.setOcrOverwrite);
  const setTranslationOverwrite = useEditorStore((state) => state.setTranslationOverwrite);

  const disabled = loading || !settings;

  return (
    <section className="px-3 py-3.5">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 size={12} className="text-zinc-500" />
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
              icon={<Languages size={11} className="text-zinc-500" />}
              value={settings.sourceLanguage}
              disabled={disabled}
              options={SOURCE_LANGUAGE_OPTIONS}
              onChange={(value) =>
                void updateSettings({ sourceLanguage: value as ProjectSourceLanguage })
              }
            />

            <SelectField
              label="Цель"
              icon={<Languages size={11} className="text-zinc-500" />}
              value={settings.targetLanguage}
              disabled={disabled}
              options={TARGET_LANGUAGE_OPTIONS}
              onChange={(value) =>
                void updateSettings({ targetLanguage: value as ProjectTargetLanguage })
              }
            />

            <SelectField
              label="OCR"
              icon={<ScanText size={11} className="text-zinc-500" />}
              value={settings.ocrEngine}
              disabled={disabled}
              options={OCR_ENGINE_OPTIONS}
              onChange={(value) => void updateSettings({ ocrEngine: value as OcrEngineId })}
            />

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
          </div>

          <div className="grid grid-cols-1 gap-3">
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
