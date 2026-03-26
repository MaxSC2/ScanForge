import type { ReactNode } from 'react';
import { Languages, ScanText, Settings2, WandSparkles } from 'lucide-react';
import {
  type OcrEngineId,
  type ProjectSourceLanguage,
  type ProjectTargetLanguage,
  type TranslationProviderId,
} from '../../types';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';

const SOURCE_LANGUAGE_OPTIONS: Array<{ value: ProjectSourceLanguage; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'en', label: 'English' },
];

const TARGET_LANGUAGE_OPTIONS: Array<{ value: ProjectTargetLanguage; label: string }> = [
  { value: 'ru', label: 'Russian' },
  { value: 'en', label: 'English' },
];

const OCR_ENGINE_OPTIONS: Array<{ value: OcrEngineId; label: string }> = [
  { value: 'windows', label: 'Windows OCR' },
  { value: 'mock', label: 'Preview OCR' },
  { value: 'tesseract', label: 'Tesseract (later)' },
  { value: 'paddle', label: 'Paddle (later)' },
  { value: 'manga-ocr', label: 'Manga OCR (later)' },
];

const TRANSLATION_PROVIDER_OPTIONS: Array<{
  value: TranslationProviderId;
  label: string;
}> = [
  { value: 'local', label: 'Local draft' },
  { value: 'mock', label: 'Preview draft' },
  { value: 'remote', label: 'Remote (later)' },
];

export function ProjectSettingsPanel() {
  const loading = useProjectDomainStore((state) => state.loading);
  const settings = useProjectDomainStore((state) => state.settings);
  const updateSettings = useProjectDomainStore((state) => state.updateSettings);

  const disabled = loading || !settings;

  return (
    <section className="border-b border-zinc-800/70 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Settings2 size={12} className="text-zinc-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Pipeline Settings
        </h3>
      </div>

      {!settings ? (
        <p className="text-[11px] text-zinc-600">
          Save or auto-save the project once to initialize pipeline settings.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Source"
            icon={<Languages size={11} className="text-zinc-500" />}
            value={settings.sourceLanguage}
            disabled={disabled}
            options={SOURCE_LANGUAGE_OPTIONS}
            onChange={(value) =>
              void updateSettings({ sourceLanguage: value as ProjectSourceLanguage })
            }
          />

          <SelectField
            label="Target"
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
            label="Translate"
            icon={<WandSparkles size={11} className="text-zinc-500" />}
            value={settings.translationProvider}
            disabled={disabled}
            options={TRANSLATION_PROVIDER_OPTIONS}
            onChange={(value) =>
              void updateSettings({ translationProvider: value as TranslationProviderId })
            }
          />
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
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="input-field h-8 bg-zinc-950/70 text-[11px] disabled:opacity-50"
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
