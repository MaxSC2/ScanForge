import { afterEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '../../themes/store';

describe('useThemeStore', () => {
  afterEach(() => {
    useThemeStore.setState({ themeId: 'dark' });
    localStorage.clear();
    // Reset CSS vars
    const root = document.documentElement;
    root.style.removeProperty('--theme-bg');
    root.style.removeProperty('--theme-accent');
  });

  it('defaults to dark theme', () => {
    expect(useThemeStore.getState().themeId).toBe('dark');
  });

  it('switches theme and applies CSS vars', () => {
    useThemeStore.getState().setTheme('darker');
    expect(useThemeStore.getState().themeId).toBe('darker');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--theme-bg')).toBe('#000000');
  });

  it('switches to high-contrast', () => {
    useThemeStore.getState().setTheme('high-contrast');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--theme-accent')).toBe('#a78bfa');
  });
});
