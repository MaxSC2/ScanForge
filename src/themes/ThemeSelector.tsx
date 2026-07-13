import { THEMES, type ThemeId } from './types';
import { useThemeStore } from './store';

export function ThemeSelector() {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, theme]) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition-colors ${
            themeId === id
              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <span
            className="h-4 w-4 rounded-full border border-zinc-700"
            style={{ backgroundColor: theme.colors.accent }}
          />
          {theme.name}
        </button>
      ))}
    </div>
  );
}
