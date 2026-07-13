import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isDesktopRuntime } from '../utils/runtime';

export interface AutoDetectResponse {
  engine: string | null;
  regionsCreated: number;
  regionIds: string[];
}

export interface AutoDetectProgressEvent {
  pageId: string;
  progress: number;
  message: string;
}

export async function autoDetectRegions(
  pageId: string,
  clearExisting = true,
  onProgress?: (progress: number, message: string) => void,
): Promise<AutoDetectResponse> {
  if (!isDesktopRuntime()) {
    throw new Error('Auto-detect requires desktop runtime (Tauri)');
  }

  let unlisten: UnlistenFn | undefined;
  try {
    unlisten = await listen<AutoDetectProgressEvent>('auto-detect-progress', (event) => {
      onProgress?.(event.payload.progress, event.payload.message);
    });

    return await invoke<AutoDetectResponse>('auto_detect_regions', {
      pageId,
      clearExisting,
    });
  } finally {
    unlisten?.();
  }
}
