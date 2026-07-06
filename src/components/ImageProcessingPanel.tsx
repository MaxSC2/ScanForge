import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AccordionSection,
} from '../features/inspector/inspectorShared';
import { usePageStore } from '../stores/usePageStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useToastStore } from '../stores/useToastStore';
import {
  previewProcessedImage,
  processImage,
  type ImageProcessOptions,
} from '../utils/imageProcessing';

const DEFAULT_OPTIONS: ImageProcessOptions = {
  brightness: 0,
  contrast: 0,
  denoise: false,
  deskew: 0,
  sharpen: 0,
  threshold: null,
  grayscale: false,
};

export function ImageProcessingPanel() {
  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const updatePageImage = usePageStore((s) => s.updatePageImage);
  const touch = useProjectStore((s) => s.touch);
  const pushToast = useToastStore((s) => s.push);

  const [options, setOptions] = useState<ImageProcessOptions>({ ...DEFAULT_OPTIONS });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const generatePreview = useCallback(async (url: string, opts: ImageProcessOptions) => {
    setProcessing(true);
    try {
      const result = await previewProcessedImage(url, opts);
      setPreviewUrl(result);
    } catch {
      setPreviewUrl(null);
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (!activePage) {
      setPreviewUrl(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      generatePreview(activePage.imageUrl, options);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activePage, options, generatePreview]);

  const handleReset = () => {
    setOptions({ ...DEFAULT_OPTIONS });
  };

  const handleApply = async () => {
    if (!activePage) return;
    setApplying(true);
    try {
      const result = await processImage(activePage.imageUrl, options);
      await updatePageImage(activePage.id, result);
      touch();
      pushToast('Изображение обработано', 'success');
    } catch {
      pushToast('Ошибка обработки изображения', 'error');
    } finally {
      setApplying(false);
    }
  };

  const updateOption = <K extends keyof ImageProcessOptions>(
    key: K,
    value: ImageProcessOptions[K],
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = Object.keys(DEFAULT_OPTIONS).some((key) => {
    const k = key as keyof ImageProcessOptions;
    return options[k] !== DEFAULT_OPTIONS[k];
  });

  const previewImage = processing
    ? null
    : previewUrl ?? activePage?.imageUrl ?? null;

  return (
    <AccordionSection
      title="Обработка изображения"
      icon={<RefreshCw size={12} />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="relative flex items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-32 w-full object-contain"
            />
          ) : (
            <div className="flex h-20 items-center justify-center">
              {processing ? (
                <span className="text-[10px] text-zinc-600">Обработка...</span>
              ) : (
                <span className="text-[10px] text-zinc-600">Нет изображения</span>
              )}
            </div>
          )}
          {processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60">
              <span className="text-[10px] text-zinc-400">Обработка...</span>
            </div>
          )}
        </div>

        <SliderField
          label="Яркость"
          min={-100}
          max={100}
          value={options.brightness ?? 0}
          onChange={(v) => updateOption('brightness', v)}
        />

        <SliderField
          label="Контраст"
          min={-100}
          max={100}
          value={options.contrast ?? 0}
          onChange={(v) => updateOption('contrast', v)}
        />

        <SliderField
          label="Резкость"
          min={0}
          max={100}
          value={options.sharpen ?? 0}
          onChange={(v) => updateOption('sharpen', v)}
        />

        <ToggleField
          label="Оттенки серого"
          value={options.grayscale ?? false}
          onChange={(v) => updateOption('grayscale', v)}
        />

        <ToggleField
          label="Шумоподавление"
          value={options.denoise ?? false}
          onChange={(v) => updateOption('denoise', v)}
        />

        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Поворот
            </span>
            <input
              type="number"
              min={-45}
              max={45}
              step={0.5}
              value={options.deskew ?? 0}
              onChange={(e) => {
                const v = Math.min(45, Math.max(-45, Number(e.target.value)));
                updateOption('deskew', v);
              }}
              className="input-field h-8 w-full text-center text-[11px] tabular-nums"
            />
          </label>

          <label className="flex-1">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Порог
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => updateOption('threshold', options.threshold === null ? 128 : null)}
                className={`rounded-md border px-2 py-1 text-[9px] font-medium transition-colors ${
                  options.threshold !== null
                    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {options.threshold !== null ? 'Вкл' : 'Выкл'}
              </button>
              {options.threshold !== null && (
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={options.threshold}
                  onChange={(e) => updateOption('threshold', Number(e.target.value))}
                  className="slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-500"
                />
              )}
            </div>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex-1 rounded-lg border border-zinc-800 px-3 py-2 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Сброс
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !activePage || !hasChanges}
            className="flex-1 rounded-lg bg-indigo-500/20 px-3 py-2 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applying ? 'Применение...' : 'Применить'}
          </button>
        </div>
      </div>
    </AccordionSection>
  );
}

function SliderField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-500"
      />
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`rounded-md border px-2.5 py-1 text-[9px] font-medium transition-colors ${
          value
            ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
            : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
        }`}
      >
        {value ? 'Вкл' : 'Выкл'}
      </button>
    </div>
  );
}
