/**
 * Lightweight LWW (Last-Writer-Wins) CRDT for collaborative region editing.
 *
 * Each field of a region carries a version tag { timestamp, userId }.
 * When merging, the value with the later timestamp wins.
 * Ties are broken by userId lexicographic order.
 */

export interface VersionTag {
  t: number; // timestamp
  u: string; // userId
}

export type VersionMap = Record<string, VersionTag>;

export interface CrdtRegionMeta {
  regionId: string;
  pageId: string;
  versions: VersionMap;
  deleted?: VersionTag;
}

const crdtMeta = new Map<string, CrdtRegionMeta>();

function tag(userId: string): VersionTag {
  return { t: Date.now(), u: userId };
}

function isNewer(a: VersionTag, b: VersionTag): boolean {
  return a.t > b.t || (a.t === b.t && a.u > b.u);
}

function key(field: string, sub?: string): string {
  return sub ? `${field}:${sub}` : field;
}

export function getCrdtMeta(regionId: string): CrdtRegionMeta | undefined {
  return crdtMeta.get(regionId);
}

export function initCrdtMeta(regionId: string, pageId: string, _userId: string) {
  if (!crdtMeta.has(regionId)) {
    crdtMeta.set(regionId, {
      regionId,
      pageId,
      versions: {},
    });
  }
}

export function clearCrdtMeta(regionId: string) {
  crdtMeta.delete(regionId);
}

export function clearAllCrdtMeta() {
  crdtMeta.clear();
}

/**
 * Record a local field write and return the version tag.
 * Does NOT check conflicts — this is the authority.
 */
export function writeLocal(regionId: string, field: string, userId: string, sub?: string) {
  const meta = crdtMeta.get(regionId);
  if (!meta) return;
  const k = key(field, sub);
  meta.versions[k] = tag(userId);
}

/**
 * Resolve a remote field update against local state.
 * Returns true if the remote value wins (should be applied).
 */
export function resolveRemote(
  regionId: string,
  field: string,
  remoteTag: VersionTag,
  sub?: string,
): boolean {
  const meta = crdtMeta.get(regionId);
  if (!meta) return true; // no local state — accept remote

  const k = key(field, sub);
  const local = meta.versions[k];

  if (!local) {
    meta.versions[k] = remoteTag;
    return true;
  }

  if (isNewer(remoteTag, local)) {
    meta.versions[k] = remoteTag;
    return true;
  }

  return false;
}

export function markDeleted(regionId: string, userId: string): boolean {
  const meta = crdtMeta.get(regionId);
  const remoteTag = tag(userId);

  if (!meta) {
    // region doesn't exist locally, or already cleaned up
    return true;
  }

  if (!meta.deleted || isNewer(remoteTag, meta.deleted)) {
    meta.deleted = remoteTag;
    return true;
  }

  return false;
}

export function isDeleted(regionId: string): boolean {
  return crdtMeta.has(regionId) && !!crdtMeta.get(regionId)!.deleted;
}

/**
 * Build a version tag map for a patch, marking all changed fields.
 */
export function buildVersionMap(
  _regionId: string,
  patch: Record<string, unknown>,
  userId: string,
): VersionMap {
  const versions: VersionMap = {};
  const now = tag(userId);
  for (const field of Object.keys(patch)) {
    versions[field] = now;
  }
  return versions;
}
