import { invoke } from '@tauri-apps/api/core';
import type { PageRecord } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';
import { isDesktopRuntime } from '../utils/runtime';

export class PageRepository {
  async listByProject(projectId: string): Promise<PageRecord[]> {
    if (isDesktopRuntime()) {
      return invoke<PageRecord[]>('list_page_records_by_project', { projectId });
    }

    const state = readBrowserDomainState();
    return Object.values(state.pages)
      .filter((page) => page.projectId === projectId)
      .map((page) => cloneDomainValue(page))
      .sort((left, right) => left.order - right.order);
  }

  async getById(id: string): Promise<PageRecord | null> {
    if (isDesktopRuntime()) {
      return invoke<PageRecord | null>('get_page_record', { id });
    }

    const state = readBrowserDomainState();
    const page = state.pages[id];
    return page ? cloneDomainValue(page) : null;
  }

  async create(page: PageRecord): Promise<PageRecord> {
    return this.upsert(page);
  }

  async update(page: PageRecord): Promise<PageRecord> {
    return this.upsert(page);
  }

  async delete(id: string): Promise<void> {
    if (isDesktopRuntime()) {
      await invoke('delete_page_record', { id });
      return;
    }

    const state = readBrowserDomainState();
    delete state.pages[id];

    for (const region of Object.values(state.regions)) {
      if (region.pageId === id) {
        delete state.regions[region.id];
      }
    }

    writeBrowserDomainState(state);
  }

  async deleteByProject(projectId: string): Promise<void> {
    if (isDesktopRuntime()) {
      await invoke('delete_page_records_by_project', { projectId });
      return;
    }

    const state = readBrowserDomainState();
    const pageIds = Object.values(state.pages)
      .filter((page) => page.projectId === projectId)
      .map((page) => page.id);

    for (const pageId of pageIds) {
      delete state.pages[pageId];
      for (const region of Object.values(state.regions)) {
        if (region.pageId === pageId) {
          delete state.regions[region.id];
        }
      }
    }

    writeBrowserDomainState(state);
  }

  private async upsert(page: PageRecord): Promise<PageRecord> {
    if (isDesktopRuntime()) {
      return invoke<PageRecord>('upsert_page_record', { page });
    }

    const state = readBrowserDomainState();
    state.pages[page.id] = cloneDomainValue(page);
    writeBrowserDomainState(state);
    return cloneDomainValue(page);
  }
}

export const pageRepository = new PageRepository();
