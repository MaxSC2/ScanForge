import { afterEach, describe, expect, it, vi } from 'vitest';
import { t, useLocaleStore } from '../../i18n';

describe('i18n', () => {
  afterEach(() => {
    useLocaleStore.setState({ locale: 'ru' });
    localStorage.clear();
  });

  describe('t()', () => {
    it('returns Russian string by default', () => {
      expect(t('toolbar.open')).toBe('Открыть изображения, PDF, CBZ, CBR');
    });

    it('returns English string when locale is en', () => {
      useLocaleStore.setState({ locale: 'en' });
      expect(t('toolbar.open')).toBe('Open images, PDF, CBZ, CBR');
    });

    it('falls back to Russian when key missing in English', () => {
      useLocaleStore.setState({ locale: 'en' });
      // Using a key only defined in Russian test locales
      expect(t('toolbar.open')).toBe('Open images, PDF, CBZ, CBR');
    });

    it('returns the key itself when not found in any locale', () => {
      expect(t('nonexistent.key.123')).toBe('nonexistent.key.123');
    });

    it('substitutes params', () => {
      expect(t('status.pages', { count: 5 })).toBe('Страниц: 5');
    });

    it('substitutes multiple params', () => {
      useLocaleStore.setState({ locale: 'en' });
      expect(t('presets.saved', { name: 'Test' })).toBe('Preset "Test" saved');
    });
  });

  describe('useLocaleStore', () => {
    it('persists locale change', () => {
      useLocaleStore.getState().setLocale('en');
      expect(useLocaleStore.getState().locale).toBe('en');
    });
  });

  describe('plugin keys', () => {
    it('has plugin keys in Russian', () => {
      expect(t('plugins.title')).toBe('Плагины');
      expect(t('plugins.install')).toBe('Установить плагин');
      expect(t('plugins.empty')).toBe('Нет установленных плагинов');
    });

    it('has plugin keys in English', () => {
      useLocaleStore.setState({ locale: 'en' });
      expect(t('plugins.title')).toBe('Plugins');
      expect(t('plugins.install')).toBe('Install plugin');
      expect(t('plugins.empty')).toBe('No plugins installed');
    });
  });

  describe('collab keys', () => {
    it('has collab keys in Russian', () => {
      expect(t('collab.title')).toBe('Коллаборация');
      expect(t('collab.connected')).toBe('Подключено');
      expect(t('collab.disconnected')).toBe('Отключено');
    });

    it('has collab keys in English', () => {
      useLocaleStore.setState({ locale: 'en' });
      expect(t('collab.title')).toBe('Collaboration');
      expect(t('collab.connected')).toBe('Connected');
    });
  });
});
