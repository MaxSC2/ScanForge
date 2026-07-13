import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEMES, type ThemeId, type Theme } from './types';

interface ThemeState {
  themeId: ThemeId;
  theme: Theme;
  setTheme: (id: ThemeId) => void;
}

function resolveTheme(id: ThemeId): Theme {
  return THEMES[id] ?? THEMES.dark;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--theme-bg', c.bg);
  root.style.setProperty('--theme-bg-alt', c.bgAlt);
  root.style.setProperty('--theme-border', c.border);
  root.style.setProperty('--theme-surface', c.surface);
  root.style.setProperty('--theme-surface-hover', c.surfaceHover);
  root.style.setProperty('--theme-text', c.text);
  root.style.setProperty('--theme-text-muted', c.textMuted);
  root.style.setProperty('--theme-text-dim', c.textDim);
  root.style.setProperty('--theme-accent', c.accent);
  root.style.setProperty('--theme-accent-muted', c.accentMuted);
  root.style.setProperty('--theme-danger', c.danger);
  root.style.setProperty('--theme-success', c.success);
  root.style.setProperty('--theme-warning', c.warning);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => {
      const themeId: ThemeId = 'dark';
      const theme = resolveTheme(themeId);
      applyTheme(theme);
      return {
        themeId,
        theme,
        setTheme: (id: ThemeId) => {
          const theme = resolveTheme(id);
          applyTheme(theme);
          set({ themeId: id, theme });
        },
      };
    },
    { name: 'scanforge-theme' },
  ),
);
