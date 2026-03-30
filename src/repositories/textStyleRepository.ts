import { invoke } from '@tauri-apps/api/core';
import type { TextStyleRecord } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';
import { isDesktopRuntime } from '../utils/runtime';

export class TextStyleRepository {
  async listByProject(projectId: string): Promise<TextStyleRecord[]> {
    if (isDesktopRuntime()) {
      return invoke<TextStyleRecord[]>('list_text_style_records_by_project', { projectId });
    }

    const state = readBrowserDomainState();
    return Object.values(state.textStyles)
      .filter((style) => style.projectId === projectId)
      .map((style) => cloneDomainValue(style))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getById(id: string): Promise<TextStyleRecord | null> {
    if (isDesktopRuntime()) {
      return invoke<TextStyleRecord | null>('get_text_style_record', { id });
    }

    const state = readBrowserDomainState();
    const style = state.textStyles[id];
    return style ? cloneDomainValue(style) : null;
  }

  async create(style: TextStyleRecord): Promise<TextStyleRecord> {
    return this.upsert(style);
  }

  async update(style: TextStyleRecord): Promise<TextStyleRecord> {
    return this.upsert(style);
  }

  async delete(id: string): Promise<void> {
    if (isDesktopRuntime()) {
      await invoke('delete_text_style_record', { id });
      return;
    }

    const state = readBrowserDomainState();
    delete state.textStyles[id];
    writeBrowserDomainState(state);
  }

  async deleteByProject(projectId: string): Promise<void> {
    if (isDesktopRuntime()) {
      await invoke('delete_text_style_records_by_project', { projectId });
      return;
    }

    const state = readBrowserDomainState();
    for (const style of Object.values(state.textStyles)) {
      if (style.projectId === projectId) {
        delete state.textStyles[style.id];
      }
    }
    writeBrowserDomainState(state);
  }

  private async upsert(style: TextStyleRecord): Promise<TextStyleRecord> {
    if (isDesktopRuntime()) {
      return invoke<TextStyleRecord>('upsert_text_style_record', { style });
    }

    const state = readBrowserDomainState();
    state.textStyles[style.id] = cloneDomainValue(style);
    writeBrowserDomainState(state);
    return cloneDomainValue(style);
  }
}

export const textStyleRepository = new TextStyleRepository();
