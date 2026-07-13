import type { PluginManifest, PluginFactory } from './types';
import { getPluginAPI } from './api';
import { usePluginRegistry } from './registry';

function extractManifest(source: string): PluginManifest | null {
  try {
    const match = source.match(/\/\*[\s\S]*?\*\//);
    if (!match) return null;
    const header = match[0];
    const id = header.match(/@id\s+(\S+)/)?.[1];
    const name = header.match(/@name\s+([^@\*]+)/)?.[1]?.trim();
    const version = header.match(/@version\s+(\S+)/)?.[1];
    const description = header.match(/@description\s+([^@\*]+)/)?.[1]?.trim();
    const author = header.match(/@author\s+([^@\*]+)/)?.[1]?.trim();
    if (!id || !name || !version) return null;
    return { id, name, version, description, author, source };
  } catch {
    return null;
  }
}

export async function loadPluginFromSource(source: string): Promise<PluginManifest | null> {
  const manifest = extractManifest(source);
  if (!manifest) return null;

  const registry = usePluginRegistry.getState();
  if (registry.plugins.find((p) => p.manifest.id === manifest.id)) {
    return null;
  }

  registry.registerPlugin(manifest);

  const api = getPluginAPI();
  const factory = new Function('ctx', source) as PluginFactory;

  try {
    await factory({ api, manifest });
  } catch (err) {
    console.error(`[Plugin ${manifest.id}] Failed to initialize:`, err);
    return null;
  }

  return manifest;
}

export async function loadPluginFromUrl(url: string): Promise<PluginManifest | null> {
  try {
    const res = await fetch(url);
    const source = await res.text();
    return loadPluginFromSource(source);
  } catch (err) {
    console.error(`[Plugin] Failed to load from ${url}:`, err);
    return null;
  }
}

export function getPluginSources(): string[] {
  try {
    const raw = localStorage.getItem('scanforge-plugin-sources');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePluginSource(source: string) {
  const sources = getPluginSources();
  if (!sources.includes(source)) {
    sources.push(source);
    localStorage.setItem('scanforge-plugin-sources', JSON.stringify(sources));
  }
}

export function removePluginSource(source: string) {
  const sources = getPluginSources().filter((s) => s !== source);
  localStorage.setItem('scanforge-plugin-sources', JSON.stringify(sources));
}
