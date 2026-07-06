import { useState } from 'react';
import { Trash2Icon } from '../icons';
import type { TextStyleRecord } from '../types';
import { useProjectDomainStore } from '../stores/useProjectDomainStore';

const COMMON_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Helvetica', 'Impact', 'Inter', 'Noto Sans', 'Noto Sans JP',
  'Noto Sans SC', 'Noto Serif', 'Roboto', 'Segoe UI', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana',
];

interface TextStyleEditorProps {
  style: TextStyleRecord | null;
  onClose: () => void;
}

export function TextStyleEditor({ style, onClose }: TextStyleEditorProps) {
  const upsertTextStyle = useProjectDomainStore((s) => s.upsertTextStyle);
  const deleteTextStyle = useProjectDomainStore((s) => s.deleteTextStyle);
  const projectId = useProjectDomainStore((s) => s.projectId);

  const [name, setName] = useState(style?.name ?? '');
  const [fontFamily, setFontFamily] = useState(style?.fontFamily ?? 'Arial');
  const [fontSize, setFontSize] = useState(style?.fontSize ?? 28);
  const [lineHeight, setLineHeight] = useState(style?.lineHeight ?? 1.15);
  const [letterSpacing, setLetterSpacing] = useState(style?.letterSpacing ?? 0);
  const [align, setAlign] = useState(style?.align ?? 'center');
  const [fill, setFill] = useState(style?.fill ?? '#ffffff');
  const [stroke, setStroke] = useState(style?.stroke ?? '#111111');
  const [strokeWidth, setStrokeWidth] = useState(style?.strokeWidth ?? 3);
  const [saving, setSaving] = useState(false);
  const [customFont, setCustomFont] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!projectId) return;
    setSaving(true);
    try {
      await upsertTextStyle({
        id: style?.id ?? crypto.randomUUID(),
        projectId,
        name: name.trim(),
        fontFamily: showCustom ? customFont.trim() || fontFamily : fontFamily,
        fontSize,
        lineHeight,
        letterSpacing,
        align: align as 'left' | 'center' | 'right',
        fill,
        stroke,
        strokeWidth,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!style?.id) return;
    await deleteTextStyle(style.id);
    onClose();
  };

  const inputClass =
    'w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {style ? 'Редактировать стиль' : 'Новый стиль'}
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мой стиль"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Шрифт</label>
          {showCustom ? (
            <input
              type="text"
              value={customFont}
              onChange={(e) => setCustomFont(e.target.value)}
              placeholder="Введите название шрифта..."
              className={inputClass}
            />
          ) : (
            <select
              value={fontFamily}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setShowCustom(true);
                  return;
                }
                setFontFamily(e.target.value);
              }}
              className={inputClass}
            >
              {COMMON_FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value="__custom__">Другой...</option>
            </select>
          )}
          {showCustom && (
            <button
              onClick={() => setShowCustom(false)}
              className="mt-1 text-[9px] text-indigo-400 hover:text-indigo-300"
            >
              Выбрать из списка
            </button>
          )}
          <div
            className="mt-1.5 rounded bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200"
            style={{ fontFamily: showCustom ? customFont || fontFamily : fontFamily }}
          >
            Aa Бб 012
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Размер</label>
            <input
              type="number"
              min={6}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Межстрочный</label>
            <input
              type="number"
              min={0.5}
              max={3}
              step={0.05}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Межбуквенный</label>
            <input
              type="number"
              min={-5}
              max={20}
              step={0.5}
              value={letterSpacing}
              onChange={(e) => setLetterSpacing(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Выравнивание</label>
            <select
              value={align}
              onChange={(e) => setAlign(e.target.value)}
              className={inputClass}
            >
              <option value="left">Влево</option>
              <option value="center">Центр</option>
              <option value="right">Вправо</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Цвет текста</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-zinc-800 bg-transparent"
              />
              <input
                type="text"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-200"
              />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">Обводка</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={stroke}
                onChange={(e) => setStroke(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-zinc-800 bg-transparent"
              />
              <input
                type="text"
                value={stroke}
                onChange={(e) => setStroke(e.target.value)}
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-200"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-0.5 block text-[9px] font-medium text-zinc-500">
            Толщина обводки: {strokeWidth}px
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="slider h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 rounded-md bg-indigo-500/20 px-3 py-1.5 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-40"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Отмена
          </button>
          {style?.id && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2Icon size={10} />
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
