import { ChevronRight } from 'lucide-react';
import { ChevronDownIcon } from '../../icons';
import type { DiagnosticEntry } from '../../types';
import {
  diagnosticDotClass,
  formatClock,
  formatScope,
} from './jobsPanelFormatting';

export function DiagnosticsSection({
  diagnosticsOpen,
  onToggle,
  diagnostics,
  recentDiagnostics,
  clearDiagnostics,
}: {
  diagnosticsOpen: boolean;
  onToggle: () => void;
  diagnostics: DiagnosticEntry[];
  recentDiagnostics: DiagnosticEntry[];
  clearDiagnostics: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-zinc-200"
        >
          {diagnosticsOpen ? (
            <ChevronDownIcon size={12} className="text-zinc-500" />
          ) : (
            <ChevronRight size={12} className="text-zinc-500" />
          )}
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Диагностика
          </span>
          <span className="text-[10px] tabular-nums text-zinc-600">{diagnostics.length}</span>
        </button>
        <button
          onClick={clearDiagnostics}
          className="inline-flex h-6 items-center rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          title="Очистить журнал диагностики"
        >
          Очистить
        </button>
      </div>

      {!diagnosticsOpen ? (
        <div className="px-3 py-3 text-[10px] text-zinc-600">
          Недавние предупреждения и сообщения восстановления скрыты, чтобы не перегружать боковую панель.
        </div>
      ) : recentDiagnostics.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-[11px] font-medium text-zinc-400">Нет недавней диагностики</p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Здесь будут появляться предупреждения пайплайна и ошибки восстановления.
          </p>
        </div>
      ) : (
        <ul className="max-h-40 overflow-y-auto p-1">
          {recentDiagnostics.map((entry) => (
            <DiagnosticListItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagnosticListItem({ entry }: { entry: DiagnosticEntry }) {
  return (
    <li className="rounded-md px-2 py-2 hover:bg-zinc-900/70">
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 h-2 w-2 flex-none rounded-full ${diagnosticDotClass(entry.level)}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[11px] font-medium text-zinc-200">{entry.message}</div>
            {entry.count > 1 ? (
              <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400">
                x{entry.count}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-600">
            <span>{formatScope(entry.scope)}</span>
            <span>{entry.level}</span>
            <span>{formatClock(entry.timestamp)}</span>
          </div>
          {entry.detail ? (
            <div className="mt-1 break-words text-[10px] text-zinc-500" title={entry.detail}>
              {entry.detail}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
