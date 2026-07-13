import { afterEach, describe, expect, it } from 'vitest';
import { formatKeys, parseKeys, matchEvent, useShortcutsStore } from '../../stores/useShortcutsStore';

describe('useShortcutsStore', () => {
  afterEach(() => {
    useShortcutsStore.setState({ overrides: {} });
    localStorage.clear();
  });

  describe('getBinding', () => {
    it('returns default keys when no override', () => {
      expect(useShortcutsStore.getState().getBinding('tool_select')).toBe('v');
    });

    it('returns override when set', () => {
      useShortcutsStore.getState().setBinding('tool_select', 'b');
      expect(useShortcutsStore.getState().getBinding('tool_select')).toBe('b');
    });

    it('returns empty string for unknown shortcut id', () => {
      expect(useShortcutsStore.getState().getBinding('nonexistent')).toBe('');
    });
  });

  describe('setBinding', () => {
    it('persists to localStorage', () => {
      useShortcutsStore.getState().setBinding('delete_region', 'ctrl+x');
      expect(JSON.parse(localStorage.getItem('scanforge.shortcuts') ?? '{}')).toEqual({ delete_region: 'ctrl+x' });
    });
  });

  describe('resetBinding', () => {
    it('removes override and restores default', () => {
      useShortcutsStore.getState().setBinding('tool_select', 'b');
      useShortcutsStore.getState().resetBinding('tool_select');
      expect(useShortcutsStore.getState().getBinding('tool_select')).toBe('v');
    });
  });

  describe('resetAll', () => {
    it('clears all overrides', () => {
      useShortcutsStore.getState().setBinding('tool_select', 'b');
      useShortcutsStore.getState().setBinding('delete_region', 'x');
      useShortcutsStore.getState().resetAll();
      expect(useShortcutsStore.getState().overrides).toEqual({});
    });
  });
});

describe('formatKeys', () => {
  it('formats simple key', () => {
    expect(formatKeys('v')).toBe('V');
  });

  it('formats with modifiers', () => {
    expect(formatKeys('ctrl+shift+a')).toBe('Ctrl+Shift+A');
  });

  it('formats arrow keys', () => {
    expect(formatKeys('arrowup')).toBe('Arrowup');
  });
});

describe('parseKeys', () => {
  it('parses simple key', () => {
    expect(parseKeys('v')).toEqual({ key: 'v', ctrl: false, shift: false, alt: false });
  });

  it('parses with modifiers', () => {
    expect(parseKeys('ctrl+shift+a')).toEqual({ key: 'a', ctrl: true, shift: true, alt: false });
  });

  it('parses multi-character key', () => {
    expect(parseKeys('arrowup')).toEqual({ key: 'arrowup', ctrl: false, shift: false, alt: false });
  });

  it('parses alt+arrow', () => {
    expect(parseKeys('alt+arrowleft')).toEqual({ key: 'arrowleft', ctrl: false, shift: false, alt: true });
  });
});

describe('matchEvent', () => {
  function createEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return { key: '', code: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...overrides } as KeyboardEvent;
  }

  it('matches simple key', () => {
    expect(matchEvent(createEvent({ key: 'v' }), 'v')).toBe(true);
  });

  it('rejects wrong key', () => {
    expect(matchEvent(createEvent({ key: 'b' }), 'v')).toBe(false);
  });

  it('matches ctrl+key', () => {
    expect(matchEvent(createEvent({ key: 'z', ctrlKey: true }), 'ctrl+z')).toBe(true);
  });

  it('rejects missing ctrl', () => {
    expect(matchEvent(createEvent({ key: 'z' }), 'ctrl+z')).toBe(false);
  });

  it('matches escape alias', () => {
    expect(matchEvent(createEvent({ key: 'Escape' }), 'esc')).toBe(true);
  });

  it('matches delete alias', () => {
    expect(matchEvent(createEvent({ key: 'Delete' }), 'del')).toBe(true);
    expect(matchEvent(createEvent({ key: 'Backspace' }), 'del')).toBe(true);
  });

  it('matches space alias', () => {
    expect(matchEvent(createEvent({ key: ' ' }), 'space')).toBe(true);
    expect(matchEvent(createEvent({ key: 'Space' }), 'space')).toBe(true);
  });

  it('matches shift+arrow', () => {
    expect(matchEvent(createEvent({ key: 'ArrowUp', shiftKey: true }), 'shift+arrowup')).toBe(true);
  });

  it('matches alt+arrow', () => {
    expect(matchEvent(createEvent({ key: 'ArrowLeft', altKey: true }), 'alt+arrowleft')).toBe(true);
  });

  it('uses code as fallback', () => {
    expect(matchEvent(createEvent({ key: '', code: 'KeyA', ctrlKey: true }), 'ctrl+a')).toBe(true);
  });
});
