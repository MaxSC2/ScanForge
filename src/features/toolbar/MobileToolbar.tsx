import { useState } from 'react';
import {
  FolderOpenIcon,
  SaveIcon,
  MousePointer2Icon,
  SquareIcon,
  HandIcon,
  SettingsIcon,
  Undo2Icon,
  Redo2Icon,
} from '../../icons';
import { useEditorStore, type EditorTool } from '../../stores/useEditorStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { usePageStore } from '../../stores/usePageStore';
import { useToastStore } from '../../stores/useToastStore';
import { useToolbarActions } from './useToolbarActions';
import { useT } from '../../i18n';

interface MobileToolbarProps {
  onOpenSettings: () => void;
  onOpenPages: () => void;
  onOpenInspector: () => void;
}

export function MobileToolbar({ onOpenSettings, onOpenPages, onOpenInspector }: MobileToolbarProps) {
  const t = useT();
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const {
    handleFiles,
    handleSaveProject,
    handleExportActive,
  } = useToolbarActions();

  const fileRef = useState<HTMLInputElement | null>(null);
  const setFileRef = (el: HTMLInputElement | null) => fileRef[1](el);

  const tools: { id: EditorTool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2Icon size={18} />, label: t('tool.select') },
    { id: 'draw', icon: <SquareIcon size={18} />, label: t('tool.draw.short') },
    { id: 'pan', icon: <HandIcon size={18} />, label: t('tool.pan') },
  ];

  return (
    <>
      <input
        ref={setFileRef}
        type="file"
        accept="image/*,.pdf,.cbz,.cbr"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {/* Left: file ops */}
      <button onClick={() => fileRef[0]?.click()} className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors">
        <FolderOpenIcon size={18} />
        <span>{t('toolbar.open.short')}</span>
      </button>

      <button onClick={handleSaveProject} className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors">
        <SaveIcon size={18} />
        <span>{t('toolbar.save.short')}</span>
      </button>

      <div className="h-6 w-px bg-zinc-800" />

      {/* Tools */}
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium transition-colors ${
            tool === t.id
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'text-zinc-400 active:bg-zinc-800 active:text-zinc-200'
          }`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}

      <div className="h-6 w-px bg-zinc-800" />

      {/* Undo/redo */}
      <button onClick={undo} disabled={!canUndo} className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 disabled:opacity-30 transition-colors">
        <Undo2Icon size={16} />
      </button>
      <button onClick={redo} disabled={!canRedo} className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 disabled:opacity-30 transition-colors">
        <Redo2Icon size={16} />
      </button>

      <div className="h-6 w-px bg-zinc-800" />

      {/* Panels */}
      <button onClick={onOpenPages} className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors">
        <span className="text-[14px] font-bold">📄</span>
        <span>Стр.</span>
      </button>

      <button onClick={onOpenInspector} className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors">
        <span className="text-[14px] font-bold">ℹ️</span>
        <span>Инсп.</span>
      </button>

      <button onClick={onOpenSettings} className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-medium text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors">
        <SettingsIcon size={18} />
        <span>{t('view.settings')}</span>
      </button>
    </>
  );
}
