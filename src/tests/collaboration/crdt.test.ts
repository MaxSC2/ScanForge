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

    it('accepts remote when no local version exists', () => {
      initCrdtMeta(RID, PID, USER_A);
      const result = resolveRemote(RID, 'x', { t: 100, u: USER_B });
      expect(result).toBe(true);
      const meta = getCrdtMeta(RID)!;
      expect(meta.versions['x'].u).toBe(USER_B);
    });

    it('remote wins when timestamp is newer', async () => {
      initCrdtMeta(RID, PID, USER_A);
      writeLocal(RID, 'x', USER_A);
      await new Promise((r) => setTimeout(r, 10));
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
      writeLocal(RID, 'x', USER_A);
      const result = resolveRemote(RID, 'x', tag);
      // local A >= remote A (same timestamp), userIds equal, so local wins
      // resolveRemote returns true only if remote is strictly newer
      expect(result).toBe(false);
    });

    it('tie broken by userId lexicographic', () => {
      initCrdtMeta(RID, PID, USER_B);
      writeLocal(RID, 'x', USER_B);
      const tag = { t: getCrdtMeta(RID)!.versions['x'].t, u: USER_A };
      const result = resolveRemote(RID, 'x', tag);
      // remote A < local B (lexicographically), so local wins
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

    it('double delete keeps last', () => {
      initCrdtMeta(RID, PID, USER_A);
      expect(markDeleted(RID, USER_B)).toBe(true);
      expect(markDeleted(RID, USER_A)).toBe(true);
      expect(isDeleted(RID)).toBe(true);
    });
  });

  describe('buildVersionMap', () => {
    it('creates version entries for each field in patch', () => {
      initCrdtMeta(RID, PID, USER_A);
      const patch = { x: 100, y: 200, width: 300 };
      const versions = buildVersionMap(RID, patch, USER_A);
      expect(Object.keys(versions)).toEqual(['x', 'y', 'width']);
    });
  });
});
