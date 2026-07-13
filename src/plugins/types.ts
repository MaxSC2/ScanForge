import type { Page, Region } from '../types';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  source: string;
}

export interface PluginContext {
  api: PluginAPI;
  manifest: PluginManifest;
}

export interface PluginToolbarAction {
  icon: string;
  label: string;
  onClick: () => void;
}

export interface PluginAPI {
  getPages: () => Page[];
  getActivePage: () => Page | undefined;
  getRegions: (pageId: string) => Region[];
  addRegion: (pageId: string, rect: { x: number; y: number; width: number; height: number }) => Region;
  updateRegion: (pageId: string, regionId: string, patch: Partial<Region>) => void;
  deleteRegion: (pageId: string, regionId: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  fetchJson: (url: string, options?: RequestInit) => Promise<unknown>;
  onRegionCreate: (cb: (region: Region) => void) => () => void;
  onRegionUpdate: (cb: (region: Region, patch: Partial<Region>) => void) => () => void;
  onPageOpen: (cb: (page: Page) => void) => () => void;
  addToolbarAction: (action: PluginToolbarAction) => () => void;
}

export type PluginFactory = (ctx: PluginContext) => void | Promise<void>;
