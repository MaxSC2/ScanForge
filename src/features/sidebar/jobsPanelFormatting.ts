import type { DiagnosticEntry, JobRecord } from '../../types';

export function formatClock(value: number | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

export function formatTarget(job: Pick<JobRecord, 'regionIds'>) {
  if (!job.regionIds?.length) {
    return 'страница';
  }

  return job.regionIds.length === 1 ? '1 регион' : `${job.regionIds.length} регионов`;
}

export function formatReason(reason: string) {
  switch (reason) {
    case 'already_filled':
      return 'уже заполнено';
    case 'already_translated':
      return 'уже переведено';
    case 'invalid_bounds':
      return 'неверные границы';
    case 'no_text':
      return 'нет текста';
    case 'locked':
      return 'заблокировано';
    case 'empty_source':
      return 'пустой исходник';
    case 'provider_unavailable':
      return 'провайдер недоступен';
    case 'canceled':
      return 'отменено';
    default:
      return reason.replace(/_/g, ' ');
  }
}

export function formatScope(scope: DiagnosticEntry['scope']) {
  switch (scope) {
    case 'ocr':
      return 'OCR';
    case 'translation':
      return 'Перевод';
    case 'export':
      return 'Экспорт';
    case 'recovery':
      return 'Восстановление';
    case 'autosave':
      return 'Автосохранение';
    case 'project':
      return 'Проект';
    default:
      return 'Система';
  }
}

export function formatStatus(status: JobRecord['status']) {
  switch (status) {
    case 'queued':
      return 'в очереди';
    case 'running':
      return 'в работе';
    case 'done':
      return 'готово';
    case 'failed':
      return 'ошибка';
    default:
      return status;
  }
}

export function diagnosticDotClass(level: DiagnosticEntry['level']) {
  switch (level) {
    case 'error':
      return 'bg-red-400';
    case 'warning':
      return 'bg-amber-400';
    default:
      return 'bg-zinc-500';
  }
}
