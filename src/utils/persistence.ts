import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { Page, ProjectFile, ProjectMeta } from '../types';
import { normalizeRegion } from '../types/region';
import { isDesktopRuntime } from './runtime';

export interface HydratedProjectState {
  meta: ProjectMeta;
  pages: Page[];
  activePageId: string | null;
}

function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => reject(new Error('Failed to decode project image'));
    image.src = src;
  });
}

export async function hydrateProjectFile(contents: ProjectFile): Promise<HydratedProjectState> {
  const pages = await Promise.all(
    contents.pages.map(async (page) => {
      const actual = await readImageSize(page.imageDataUrl);
      return {
        id: page.id,
        fileName: page.fileName,
        imagePath: page.imageDataUrl,
        imageUrl: page.imageDataUrl,
        naturalWidth: actual.width,
        naturalHeight: actual.height,
        regions: page.regions.map((region) => normalizeRegion(region)),
      };
    }),
  );

  return {
    meta: contents.meta,
    pages,
    activePageId: contents.activePageId,
  };
}

export async function saveProjectFile(contents: ProjectFile): Promise<void> {
  const text = JSON.stringify(contents, null, 2);

  if (isDesktopRuntime()) {
    const path = await save({
      title: 'Сохранить проект ScanForge',
      defaultPath: `${contents.meta.name || 'scanforge-project'}.scanforge.json`,
      filters: [{ name: 'Проект ScanForge', extensions: ['scanforge.json', 'json'] }],
    });
    if (!path) return;
    await writeTextFile(path, text);
    return;
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contents.meta.name || 'scanforge-project'}.scanforge.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openProjectFile(): Promise<ProjectFile | null> {
  if (isDesktopRuntime()) {
    const path = await open({
      title: 'Открыть проект ScanForge',
      multiple: false,
      directory: false,
      filters: [{ name: 'Проект ScanForge', extensions: ['scanforge.json', 'json'] }],
    });
    if (!path || Array.isArray(path)) return null;
    const text = await readTextFile(path);
    return JSON.parse(text) as ProjectFile;
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.scanforge.json';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const text = await file.text();
        resolve(JSON.parse(text) as ProjectFile);
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

function toPngName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  return `${base}.png`;
}

async function saveBlob(blob: Blob, suggestedName: string): Promise<boolean> {
  if (isDesktopRuntime()) {
    const path = await save({
      title: 'Экспорт изображения',
      defaultPath: suggestedName,
      filters: [{ name: 'PNG изображение', extensions: ['png'] }],
    });
    if (!path) return false;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, bytes);
    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function exportPageImage(page: Page): Promise<boolean> {
  const response = await fetch(page.imageUrl);
  const blob = await response.blob();
  return saveBlob(blob, toPngName(page.fileName));
}
