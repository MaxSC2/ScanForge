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

const MAX_PLUGIN_SOURCE_BYTES = 1024 * 1024;
const PLUGIN_FETCH_TIMEOUT_MS = 15_000;

function validatePluginUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Plugin URL must use HTTP(S)');
  }
  return url.href;
}

async function fetchPluginSource(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    PLUGIN_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(validatePluginUrl(url), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Plugin fetch failed: HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_PLUGIN_SOURCE_BYTES) {
      throw new Error('Plugin source is too large');
    }

    const source = await response.text();
    if (new TextEncoder().encode(source).byteLength > MAX_PLUGIN_SOURCE_BYTES) {
      throw new Error('Plugin source is too large');
    }

    return source;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Plugin fetch timed out after ${PLUGIN_FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function loadPluginFromSource(source: string): Promise<PluginManifest | null> {
  if (new TextEncoder().encode(source).byteLength > MAX_PLUGIN_SOURCE_BYTES) {
    return null;
  }

  const manifest = extractManifest(source);
  if (!manifest) return null;

  const registry = usePluginRegistry.getState();
  if (registry.plugins.find((p) => p.manifest.id === manifest.id)) {
    return null;
  }

  const api = getPluginAPI();

  try {
    const factory = new Function('ctx', source) as PluginFactory;
    await factory({ api, manifest });

    registry.registerPlugin(manifest);
    return manifest;
  } catch (err) {
    console.error(`[Plugin ${manifest.id}] Failed to initialize:`, err);
    return null;
  }
}

export async function loadPluginFromUrl(url: string): Promise<PluginManifest | null> {
  try {
    const source = await fetchPluginSource(url);
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

