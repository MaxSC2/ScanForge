import { useEffect, useRef, type ReactNode } from 'react';

interface MenuItem {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-44 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 backdrop-blur-sm"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/15'
              : 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
          }`}
        >
          {item.icon && <span className="w-4 flex-none flex items-center justify-center">{item.icon}</span>}
          <span className="flex-1 text-left">{item.label}</span>
          {item.shortcut && (
            <span className="text-[10px] text-zinc-500 ml-4">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}
