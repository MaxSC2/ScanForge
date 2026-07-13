import type { Page, Region } from '../types';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import { useToastStore } from '../stores/useToastStore';
import type { PluginAPI, PluginToolbarAction } from './types';

type EventHandler = (...args: unknown[]) => void;

const listeners: Record<string, Set<EventHandler>> = {
  'region:create': new Set(),
  'region:update': new Set(),
  'page:open': new Set(),
};

const toolbarActions: PluginToolbarAction[] = [];

export function emitEvent(event: string, ...args: unknown[]) {
  listeners[event]?.forEach((cb) => cb(...args));
}

export function getPluginAPI(): PluginAPI {
  return {
    getPages: () => usePageStore.getState().pages,
    getActivePage: () => {
      const id = usePageStore.getState().activePageId;
      return id ? usePageStore.getState().pages.find((p) => p.id === id) : undefined;
    },
    getRegions: (pageId) => {
      const page = usePageStore.getState().pages.find((p) => p.id === pageId);
      return page?.regions ?? [];
    },
    addRegion: (pageId, rect) => {
      return useRegionStore.getState().addRegion(pageId, rect);
    },
    updateRegion: (pageId, regionId, patch) => {
      useRegionStore.getState().updateRegion(pageId, regionId, patch);
    },
    deleteRegion: (pageId, regionId) => {
      useRegionStore.getState().deleteRegion(pageId, regionId);
    },
    showToast: (message, type = 'info') => {
      useToastStore.getState().push(message, type);
    },
    fetchJson: async (url, options) => {
      const res = await fetch(url, options);
      return res.json();
    },
    onRegionCreate: (cb) => {
      const handler = (r: unknown) => cb(r as Region);
      listeners['region:create'] ??= new Set();
      listeners['region:create'].add(handler as EventHandler);
      return () => { listeners['region:create']?.delete(handler as EventHandler); };
    },
    onRegionUpdate: (cb) => {
      const handler = (args: unknown) => {
        const [r, p] = args as [Region, Partial<Region>];
        cb(r, p);
      };
      listeners['region:update'] ??= new Set();
      listeners['region:update'].add(handler as EventHandler);
      return () => { listeners['region:update']?.delete(handler as EventHandler); };
    },
    onPageOpen: (cb) => {
      const handler = (p: unknown) => cb(p as Page);
      listeners['page:open'] ??= new Set();
      listeners['page:open'].add(handler as EventHandler);
      return () => { listeners['page:open']?.delete(handler as EventHandler); };
    },
    addToolbarAction: (action) => {
      toolbarActions.push(action);
      return () => {
        const idx = toolbarActions.indexOf(action);
        if (idx >= 0) toolbarActions.splice(idx, 1);
      };
    },
  };
}

export function getToolbarActions(): PluginToolbarAction[] {
  return toolbarActions;
}
