import { afterEach, describe, expect, it } from 'vitest';
import { isDesktopRuntime } from '../../utils/runtime';

describe('runtime', () => {
  type RuntimeWindow = Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
      return;
    }

    globalThis.window = originalWindow;
  });

  it('treats injected Tauri globals as desktop runtime even if base detection is unavailable', () => {
    const runtimeWindow = {} as RuntimeWindow;
    globalThis.window = runtimeWindow;
    runtimeWindow.__TAURI_INTERNALS__ = {};
    expect(isDesktopRuntime()).toBe(true);
  });
});
