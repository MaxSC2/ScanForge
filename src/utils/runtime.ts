import { isTauri } from '@tauri-apps/api/core';

type TauriWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

export function isDesktopRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeWindow = window as TauriWindow;
  return isTauri() || Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
}
