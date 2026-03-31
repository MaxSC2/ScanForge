import { describe, expect, it } from 'vitest';
import {
  diagnosticDotClass,
  formatReason,
  formatScope,
  formatStatus,
  formatTarget,
} from '../../features/sidebar/jobsPanelFormatting';

describe('jobsPanelFormatting', () => {
  it('formats page target when no regions are present', () => {
    expect(formatTarget({})).toBe('страница');
  });

  it('formats region target counts', () => {
    expect(formatTarget({ regionIds: ['r1'] })).toBe('1 регион');
    expect(formatTarget({ regionIds: ['r1', 'r2'] })).toBe('2 регионов');
  });

  it('maps known reasons to readable Russian labels', () => {
    expect(formatReason('already_translated')).toBe('уже переведено');
    expect(formatReason('provider_unavailable')).toBe('провайдер недоступен');
  });

  it('maps known scopes and statuses', () => {
    expect(formatScope('translation')).toBe('Перевод');
    expect(formatStatus('running')).toBe('в работе');
  });

  it('maps diagnostic level to dot class', () => {
    expect(diagnosticDotClass('warning')).toBe('bg-amber-400');
    expect(diagnosticDotClass('info')).toBe('bg-zinc-500');
  });
});
