import { invoke, isTauri } from '@tauri-apps/api/core';
import type { RegionRecord } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';

export class RegionRepository {
  async getByPage(pageId: string): Promise<RegionRecord[]> {
    if (isTauri()) {
      return invoke<RegionRecord[]>('list_region_records_by_page', { pageId });
    }

    const state = readBrowserDomainState();
    return Object.values(state.regions)
      .filter((region) => region.pageId === pageId)
      .map((region) => cloneDomainValue(region));
  }

  async getById(id: string): Promise<RegionRecord | null> {
    if (isTauri()) {
      return invoke<RegionRecord | null>('get_region_record', { id });
    }

    const state = readBrowserDomainState();
    const region = state.regions[id];
    return region ? cloneDomainValue(region) : null;
  }

  async create(region: RegionRecord): Promise<RegionRecord> {
    return this.upsert(region);
  }

  async update(region: RegionRecord): Promise<RegionRecord> {
    return this.upsert(region);
  }

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_region_record', { id });
      return;
    }

    const state = readBrowserDomainState();
    delete state.regions[id];
    writeBrowserDomainState(state);
  }

  async deleteByPage(pageId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_region_records_by_page', { pageId });
      return;
    }

    const state = readBrowserDomainState();
    for (const region of Object.values(state.regions)) {
      if (region.pageId === pageId) {
        delete state.regions[region.id];
      }
    }
    writeBrowserDomainState(state);
  }

  private async upsert(region: RegionRecord): Promise<RegionRecord> {
    if (isTauri()) {
      return invoke<RegionRecord>('upsert_region_record', { region });
    }

    const state = readBrowserDomainState();
    state.regions[region.id] = cloneDomainValue(region);
    writeBrowserDomainState(state);
    return cloneDomainValue(region);
  }
}

export const regionRepository = new RegionRepository();
