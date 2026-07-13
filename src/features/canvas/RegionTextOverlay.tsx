import { useEffect, useRef, useState, useMemo } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';
import { createDefaultTextStyle } from '../../types';
import type { TextStyleRecord } from '../../types';

function resolveOverlayStyle(
  region: { textStyleId?: string },
  styles: TextStyleRecord[],
  defaultId?: string,
  projectId?: string,
): TextStyleRecord {
  return (
    styles.find((s) => s.id === region.textStyleId) ??
    styles.find((s) => s.id === defaultId) ??
    (projectId ? createDefaultTextStyle(projectId) : styles[0]) ??
    { id: '', projectId: '', name: '', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28, lineHeight: 1.15, letterSpacing: 0, align: 'center', fill: '#ffffff', stroke: '#111111', strokeWidth: 3 }
  );
}

export function RegionTextOverlay() {
  const editingRegionId = useEditorStore((s) => s.editingRegionId);
  const setEditingRegionId = useEditorStore((s) => s.setEditingRegionId);
  const zoom = useEditorStore((s) => s.zoom);
  const stagePosition = useEditorStore((s) => s.stagePosition);
  const activePageId = usePageStore((s) => s.activePageId);
  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const textStyles = useProjectDomainStore((s) => s.textStyles);
  const defaultStyleId = useProjectDomainStore((s) => s.settings?.defaultTextStyleId);
  const projectId = useProjectDomainStore((s) => s.projectId);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const region = activePage?.regions.find((r) => r.id === editingRegionId);
  const overlayStyle = useMemo(
    () => (region ? resolveOverlayStyle(region, textStyles, defaultStyleId, projectId ?? undefined) : null),
    [region, textStyles, defaultStyleId, projectId],
  );

  const [value, setValue] = useState('');

  useEffect(() => {
    if (region) {
      setValue(region.translatedText);
    }
  }, [region]);

  useEffect(() => {
    if (editingRegionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingRegionId]);

  const commit = () => {
    if (editingRegionId && activePageId) {
      updateRegion(activePageId, editingRegionId, { translatedText: value });
    }
    setEditingRegionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditingRegionId(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
  };

  if (!editingRegionId || !region || !overlayStyle) return null;

  const left = region.x * zoom + stagePosition.x;
  const top = region.y * zoom + stagePosition.y;
  const width = region.width * zoom;
  const height = region.height * zoom;

  const textShadow = overlayStyle.strokeWidth > 0
    ? `0 0 ${overlayStyle.strokeWidth}px ${overlayStyle.stroke}`
    : 'none';

  return (
    <div
      className="absolute z-40"
      style={{
        left,
        top,
        width,
        height,
      }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-full w-full resize-none rounded border border-indigo-500 bg-zinc-900/95 p-2 outline-none shadow-lg shadow-black/40 backdrop-blur placeholder-zinc-600"
        style={{
          fontFamily: overlayStyle.fontFamily,
          fontSize: `${Math.max(8, Math.round(overlayStyle.fontSize * zoom))}px`,
          lineHeight: overlayStyle.lineHeight,
          letterSpacing: `${overlayStyle.letterSpacing}px`,
          textAlign: overlayStyle.align,
          color: overlayStyle.fill,
          textShadow,
        }}
        placeholder="Введите перевод..."
        spellCheck={false}
      />
      <div className="pointer-events-none absolute bottom-1 right-2 text-[8px] text-zinc-600">
        Enter ✓ &bull; Esc ✗
      </div>
    </div>
  );
}
