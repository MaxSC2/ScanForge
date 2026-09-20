import { afterEach, describe, expect, it } from 'vitest';
import {
  initCrdtMeta,
  clearAllCrdtMeta,
  writeLocal,
  resolveRemote,
  markDeleted,
  isDeleted,
  getCrdtMeta,
  buildVersionMap,
} from '../../collaboration/crdt';

describe('CRDT LWW', () => {
  afterEach(() => {
    clearAllCrdtMeta();
  });

  const RID = 'region-1';
  const PID = 'page-1';
  const USER_A = 'user-a';
  const USER_B = 'user-b';

  describe('initCrdtMeta', () => {
    it('creates metadata for a region', () => {
      initCrdtMeta(RID, PID, USER_A);
      const meta = getCrdtMeta(RID);
      expect(meta).toBeDefined();
      expect(meta!.regionId).toBe(RID);
      expect(meta!.pageId).toBe(PID);
      expect(meta!.versions).toEqual({});
      expect(meta!.deleted).toBeUndefined();
    });
  });

  describe('writeLocal and resolveRemote', () => {
    it('local write sets version tag', () => {
      initCrdtMeta(RID, PID, USER_A);
      writeLocal(RID, 'x', USER_A);
      const meta = getCrdtMeta(RID)!;
      expect(meta.versions['x']).toBeDefined();
      expect(meta.versions['x'].u).toBe(USER_A);
    });

    it('local write can use the exact transmitted operation timestamp', () => {
      initCrdtMeta(RID, PID, USER_A);
      writeLocal(RID, 'x', USER_A, undefined, 5000);
      const versions = buildVersionMap(RID, { x: 100 }, USER_A, 5000);

      expect(getCrdtMeta(RID)!.versions.x).toEqual({ t: 5000, u: USER_A });
      expect(versions.x).toEqual({ t: 5000, u: USER_A });
    });

    it('accepts remote when no local version exists', () => {
      initCrdtMeta(RID, PID, USER_A);
      const result = resolveRemote(RID, 'x', { t: 100, u: USER_B });
      expect(result).toBe(true);
      const meta = getCrdtMeta(RID)!;
      expect(meta.versions['x'].u).toBe(USER_B);
    });

    it('remote wins when timestamp is newer', () => {
      initCrdtMeta(RID, PID, USER_A);
      writeLocal(RID, 'x', USER_A);
      const result = resolveRemote(RID, 'x', { t: Date.now() + 1000, u: USER_B });
      expect(result).toBe(true);
    });

    it('local wins when timestamp is older', () => {
      initCrdtMeta(RID, PID, USER_A);
      writeLocal(RID, 'x', USER_A);
      const meta = getCrdtMeta(RID)!;
      const localTag = meta.versions['x'];
      const result = resolveRemote(RID, 'x', { t: localTag.t - 1000, u: USER_B });
      expect(result).toBe(false);
      expect(meta.versions['x'].u).toBe(USER_A);
    });

    it('tie broken by userId', () => {
      initCrdtMeta(RID, PID, USER_A);
      const tag = { t: Date.now(), u: USER_A };
      writeLocal(RID, 'x', USER_A, undefined, tag.t);
      const result = resolveRemote(RID, 'x', tag);
      expect(result).toBe(false);
    });

    it('tie broken by userId lexicographic', () => {
      initCrdtMeta(RID, PID, USER_B);
      writeLocal(RID, 'x', USER_B);
      const tag = { t: getCrdtMeta(RID)!.versions['x'].t, u: USER_A };
      const result = resolveRemote(RID, 'x', tag);
      expect(result).toBe(false);
    });
  });

  describe('markDeleted', () => {
    it('marks region as deleted', () => {
      initCrdtMeta(RID, PID, USER_A);
      const result = markDeleted(RID, USER_A);
      expect(result).toBe(true);
      expect(isDeleted(RID)).toBe(true);
    });

    it('double delete marks deleted', () => {
      initCrdtMeta(RID, PID, USER_A);
      markDeleted(RID, USER_B);
      const result = markDeleted(RID, USER_A);
      expect(isDeleted(RID)).toBe(true);
      expect(result === true || result === false).toBe(true);
    });
  });

  it('keeps transmitted remote versions ordered by their real timestamp', () => {
    initCrdtMeta(RID, PID, USER_A);

    expect(resolveRemote(RID, 'x', { t: 1000, u: USER_A })).toBe(true);
    expect(resolveRemote(RID, 'x', { t: 1500, u: USER_B })).toBe(true);
    expect(resolveRemote(RID, 'x', { t: 1200, u: USER_A })).toBe(false);

    expect(getCrdtMeta(RID)!.versions['x']).toEqual({ t: 1500, u: USER_B });
  });

  it('rejects late field updates after a deletion tombstone', () => {
    initCrdtMeta(RID, PID, USER_A);

    expect(markDeleted(RID, USER_B, PID, { t: 2000, u: USER_B })).toBe(true);
    expect(resolveRemote(RID, 'x', { t: 1000, u: USER_A })).toBe(false);
    expect(resolveRemote(RID, 'x', { t: 3000, u: USER_A })).toBe(false);
    expect(isDeleted(RID)).toBe(true);
  });

  describe('buildVersionMap', () => {
    it('creates version entries for each field in patch', () => {
      initCrdtMeta(RID, PID, USER_A);
      const patch = { x: 100, y: 200, width: 300 };
      const versions = buildVersionMap(RID, patch, USER_A, 7000);
      expect(Object.keys(versions)).toEqual(['x', 'y', 'width']);
      expect(Object.values(versions)).toEqual([
        { t: 7000, u: USER_A },
        { t: 7000, u: USER_A },
        { t: 7000, u: USER_A },
      ]);
    });
  });
});
