import type { ServerConfig } from '../types/server';

const DEFAULT_CONFIG: ServerConfig = {
  enabled: false,
  host: 'localhost',
  port: 8765,
};

function getConfig(): ServerConfig {
  try {
    const raw = localStorage.getItem('scanforge-server-config');
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

function setConfig(config: ServerConfig) {
  localStorage.setItem('scanforge-server-config', JSON.stringify(config));
}

function baseUrl(config: ServerConfig) {
  return `http://${config.host}:${config.port}`;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  message: string;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  pageCount: number;
  currentPage: number;
}

export async function sendToServer(
  files: File[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> {
  const cfg = getConfig();
  if (!cfg.enabled) {
    throw new Error('Server is disabled. Enable it in settings first.');
  }

  const form = new FormData();
  for (const f of files) {
    form.append('files', f);
  }
  form.append('source_language', sourceLanguage);
  form.append('target_language', targetLanguage);
  form.append('translation_provider', 'mock'); // server uses mock by default

  const resp = await fetch(`${baseUrl(cfg)}/api/v1/process`, {
    method: 'POST',
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error ?? 'Server error');
  }

  const data = await resp.json();
  return data.jobId as string;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const cfg = getConfig();
  const resp = await fetch(`${baseUrl(cfg)}/api/v1/job/${jobId}`);
  if (!resp.ok) throw new Error('Failed to get job status');
  return resp.json();
}

export async function downloadResult(jobId: string): Promise<Blob> {
  const cfg = getConfig();
  const resp = await fetch(`${baseUrl(cfg)}/api/v1/job/${jobId}/download`);
  if (!resp.ok) throw new Error('Download not ready');
  return resp.blob();
}

export function connectWebSocket(
  jobId: string,
  onMessage: (data: JobStatus) => void,
): () => void {
  const cfg = getConfig();
  const ws = new WebSocket(`ws://${cfg.host}:${cfg.port}/api/v1/job/${jobId}/ws`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {}
  };

  ws.onerror = () => {};

  return () => ws.close();
}

export { getConfig, setConfig };
export type { ServerConfig };
