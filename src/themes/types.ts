export interface ThemeColors {
  bg: string;
  bgAlt: string;
  border: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentMuted: string;
  danger: string;
  success: string;
  warning: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export type ThemeId = 'dark' | 'darker' | 'high-contrast';

export const THEMES: Record<ThemeId, Theme> = {
  'dark': {
    id: 'dark',
    name: 'Тёмная',
    colors: {
      bg: '#09090b',
      bgAlt: '#18181b',
      border: '#27272a',
      surface: '#18181b',
      surfaceHover: '#27272a',
      text: '#e4e4e7',
      textMuted: '#a1a1aa',
      textDim: '#71717a',
      accent: '#6366f1',
      accentMuted: 'rgba(99,102,241,0.15)',
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
  },
  'darker': {
    id: 'darker',
    name: 'Ещё темнее',
    colors: {
      bg: '#000000',
      bgAlt: '#0a0a0a',
      border: '#1a1a1a',
      surface: '#0d0d0d',
      surfaceHover: '#1a1a1a',
      text: '#f5f5f5',
      textMuted: '#a3a3a3',
      textDim: '#525252',
      accent: '#818cf8',
      accentMuted: 'rgba(129,140,248,0.12)',
      danger: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'Высокий контраст',
    colors: {
      bg: '#000000',
      bgAlt: '#1a1a1a',
      border: '#ffffff',
      surface: '#0d0d0d',
      surfaceHover: '#1a1a1a',
      text: '#ffffff',
      textMuted: '#cccccc',
      textDim: '#999999',
      accent: '#a78bfa',
      accentMuted: 'rgba(167,139,250,0.2)',
      danger: '#ff6b6b',
      success: '#69db7c',
      warning: '#ffd43b',
    },
  },
};
