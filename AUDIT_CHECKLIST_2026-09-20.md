# ScanForge Full Audit Checklist — 2026-09-20

## Audit scope

Static cross-layer audit of the current `main` codebase, followed by targeted fixes on branch `audit/hardening-2026-09-20`.

Reviewed areas:
- React UI and canvas/editor interaction
- Zustand stores and state ownership
- repositories and persistence boundaries
- SQLite/Tauri/Rust backend
- page assets and recovery
- OCR providers and job execution
- translation providers
- rendered export and inpainting
- collaboration/CRDT
- plugins and local network integrations
- tests and CI/release workflow
- documentation consistency

The audit is source-based. A local desktop runtime was not executed in this environment, so OS-specific behavior remains subject to GitHub Actions and manual desktop acceptance.

Severity:
- **P0** = data isolation/security/blocking correctness
- **P1** = serious reliability, data integrity, or core workflow issue
- **P2** = important hardening/UX/maintainability
- **P3** = release polish or lower-risk improvement

Status:
- `[x]` fixed/covered by this audit branch
- `[~]` partially mitigated
- `[ ]` remaining work
- `[T]` requires device/E2E verification

---

## Fixed in this audit branch

### AUD-FIX-01 — CRDT remote version corruption
**Severity:** P1  
**Status:** [x]

**Root cause**
`src/collaboration/sync.ts` applied a remote field update with `resolveRemote()`, then called `writeLocal()` on the same field. The receiving client therefore replaced the transmitted remote timestamp with its own `Date.now()` value.

**Impact**
A later remote operation could be rejected incorrectly because the receiver had artificially made the older operation look newer.

**Fix**
- remote application no longer rewrites resolved fields with a local timestamp
- transmitted version tags remain authoritative
- tests cover ordering of multiple remote timestamps

**Files**
- `src/collaboration/sync.ts`
- `src/collaboration/crdt.ts`
- `src/tests/collaboration/crdt.test.ts`

---

### AUD-FIX-02 — CRDT deletion tombstone was destroyed
**Severity:** P1  
**Status:** [x]

**Root cause**
Remote delete called `markDeleted()`, then immediately `clearCrdtMeta()`. With no persistent tombstone, late network updates could modify a region that had already been deleted.

**Fix**
- deletion now creates/retains a tombstone
- late field updates are rejected while the collaboration session remains active
- deletion uses the exact operation timestamp/user tag

**Files**
- `src/collaboration/crdt.ts`
- `src/collaboration/sync.ts`
- `src/tests/collaboration/crdt.test.ts`

---

### AUD-FIX-03 — OCR cancellation did not cancel the executing job
**Severity:** P1  
**Status:** [~]

**Root cause**
`runOcrJob()` created an `AbortController`, but the job store had no access to it. Cancel only changed the visible job status while OCR could continue.

**Fix**
- active OCR controllers are registered by job id
- job cancellation now aborts the active controller
- queued OCR jobs are cancelled immediately
- desktop OCR has a backend cancellation command and cancellation checks before applying results
- Tauri invocation maps aborted requests back to an `AbortError`

**Important limitation**
The Rust command uses a cooperative cancellation flag. It can prevent post-cancel result application, but it cannot necessarily interrupt a third-party OCR subprocess already executing internally.

**Files**
- `src/services/jobExecution.ts`
- `src/stores/useJobStore.ts`
- `src/services/ocr.ts`
- `src-tauri/src/ocr.rs`
- `src-tauri/src/lib.rs`

**Remaining**
[T] Verify on Windows with a slow OCR provider that cancellation stops result application immediately and that no stale OCR result is written after cancellation.

---

### AUD-FIX-04 — Job persistence race
**Severity:** P1  
**Status:** [x]

**Root cause**
Every job state mutation launched its own asynchronous persistence operation. Rapid progress/status changes could overlap and finish out of order, allowing an older state to overwrite a newer state in SQLite.

**Fix**
- persistence writes are serialized
- mutations coalesce while a write is in flight
- the worker reads the latest job state only when ready to persist
- a new persistence pass is scheduled if another mutation arrives during the current write

**Files**
- `src/stores/useJobStore.ts`

**Remaining**
[T] Stress test a long queue with rapid progress updates and application restart.

---

## Remaining checklist

## P0 — Data isolation / security

### COLLAB-P0-01 — Collaboration has no project/session isolation
**Status:** [~]

**Evidence**
The original protocol had no project/room identifier and the relay broadcast operations to every connected client. Authentication/authorization is still absent.

**Resolution**
- `CollabOp.roomId` now carries the logical collaboration room
- room id is derived from the persisted project id, with a per-user draft room before persistence
- reconnect only resends pending operations belonging to the current room
- the client ignores operations from another room as defense in depth
- `collab-server.js` stores each socket's room and broadcasts users/operations only inside that room
- the relay validates the join payload and rejects operations whose room does not match the socket's room

**Remaining**
Authenticated room membership and a server-side credential/token are still required before collaboration should be treated as production-secure.

**Acceptance**
Project/session isolation is enforced server-side. Authentication remains a separate follow-up hardening item.

---

## Collaboration hardening follow-up

### COLLAB-P2-01 — Relay resource and message bounds
**Status:** [x]

**Resolution**
The relay now caps WebSocket messages at 1 MiB and rejects operation types outside the supported protocol set. This is a resource/protocol hardening measure, not authentication.

## P1 — Core correctness and reliability

### DATA-P1-01 — History snapshots duplicate full image payloads
**Status:** [x]

**Evidence**
`src/stores/useHistoryStore.ts` uses `structuredClone(pageState.pages)`. Pages include `imageUrl` and `imagePath`, and these may contain large data URLs.

**Risk**
Large manga chapters multiplied by a 100-step history can consume substantial memory and increase GC pressure.

**Resolution**
- data-URL image payloads are stored once in a module-level history image registry
- history snapshots store small numeric references instead of copying the same large image string
- non-data URLs remain inline
- orphaned image references are pruned when history entries are discarded or cleared
- undo/redo restores the original image URLs from the registry
- undo/redo also preserves the full region selection state

**Acceptance**
Repeated history captures of unchanged data-URL assets do not duplicate the image payload in each snapshot. Large-project memory still requires runtime profiling for unique image revisions.

---

### DATA-P1-02 — Asset recovery falls back to an invalid filesystem path
**Status:** [x]

**Evidence**
`src/repositories/pagePersistence.ts` falls back to `record.imagePath` if `load_page_image` fails. When `imagePath` is a filesystem path, this value is not necessarily a browser-loadable image URL.

**Risk**
A missing/corrupt asset can leave a page pointing at an unusable path even when a snapshot may still contain a recoverable image.

**Resolution**
Recovery now explicitly tries:
1. durable desktop asset
2. a valid embedded/blob/HTTP fallback already present in project state
3. an inline recovery placeholder containing the affected page name and stored asset filename

The filesystem path is never assigned directly to `imageUrl` after a failed load.

**Acceptance**
Missing durable assets no longer produce an invalid browser image URL, and an unrecoverable page remains visibly identifiable.

---

### DATA-P1-03 — Snapshot vs normalized DB source of truth is ambiguous
**Status:** [~]

**Evidence**
The Tauri loader previously preferred the snapshot even when normalized domain tables contained newer state.

**Resolution**
`src-tauri/src/storage.rs` now reconstructs the project from normalized domain tables first. The snapshot is used only when domain reconstruction fails, matching the browser repository's domain-first behavior.

**Remaining**
Add an integration test that creates deliberate domain/snapshot divergence and verifies domain state wins, plus a crash/recovery fixture proving snapshot fallback still works.

**Acceptance**
A documented domain-first load order is enforced by code and covered by divergence/recovery tests.

---

### JOB-P1-01 — Running translation/export jobs are not truly cancellable
**Status:** [~]

**Evidence**
Only OCR has an execution cancellation path.

**Resolution**
Running translation/export jobs are no longer falsely marked as cancelled. The job store now keeps them running and shows that cancellation is not yet supported; queued jobs can still be cancelled before execution.

**Remaining**
A true cancellation channel still needs to be implemented for translation and export execution.

**Acceptance**
No running job is marked cancelled unless its underlying execution has actually been stopped.

---

### OCR-P1-01 — Browser Tesseract worker is hardcoded to English
**Status:** [x]

**Evidence**
`src/services/ocr.ts` creates the Tesseract worker with `createWorker('eng', 1, ...)` while project settings support Japanese, Chinese, Korean and English.

**Risk**
Browser OCR can use the wrong language model for non-English source material.

**Resolution**
- added explicit Tesseract language mapping for `ja/zh/ko/en`
- `auto` and unknown values use the documented English fallback
- workers are cached by resolved language code
- browser OCR passes the resolved project/region language to worker initialization
- unit coverage added for all supported mappings and fallback behavior

**Acceptance**
Worker language is derived from project source language and model initialization is cached per resolved language.

---

### TRANS-P1-01 — Desktop and browser translation providers disagree
**Status:** [~]

**Evidence**
Browser code supports several provider ids, while `src-tauri/src/translation.rs` currently implements only local/mock and explicitly rejects remote.

**Resolution**
Desktop now routes implemented browser-capable providers (`offline`, `deepl`, `libre`, `ollama`, `sakura`) through the browser provider path instead of silently falling back to the Tauri local/mock chain.

**Remaining**
The `remote` provider is still not implemented as a desktop/browser executable provider, and there is no single capability registry shared by UI and runtime.

**Acceptance**
A configured provider must execute through a matching implemented runtime path or be rejected explicitly. A unified capability registry remains follow-up work.

---

### TEST-P1-01 — Region store tests are skipped
**Status:** [x]

**Evidence**
`src/tests/stores/useRegionStore.test.ts` wraps the suite in `describe.skip()`.

**Risk**
A critical editor state surface has extensive tests that CI does not execute.

**Resolution**
- re-enabled the full suite
- fixed Shift-selection semantics so `multiSelectedRegionIds` remains the non-primary part of the selected set
- retained coverage for single-select, multi-select, deletion, duplication, reordering and selection helpers

**Acceptance**
The suite is no longer skipped and is included in the normal Vitest test command.

---

### TEST-P1-02 — Repository/job lifecycle coverage is incomplete
**Status:** [ ]

**Evidence**
Current tests cover job persistence helpers and utility logic, but there is limited end-to-end coverage for repository CRUD + job recovery + state restoration.

**Acceptance**
Add integration-level fixtures for project/page/region/job lifecycle, including crash/restart recovery and missing asset cases.

---

### COLLAB-P1-01 — Collaboration protocol contains unused message/op types
**Status:** [ ]

**Evidence**
`src/collaboration/types.ts` defines `state`, `region:reorder`, and `page:select`, while the current relay/sync path primarily handles create/update/delete.

**Risk**
The protocol advertises behavior that is not necessarily synchronized.

**Acceptance**
Either fully implement the protocol cases or remove/deprecate them and add protocol tests.

---

### COLLAB-P1-02 — Collaboration server has no authentication or authorization
**Status:** [~]

**Evidence**
`collab-server.js` remains an open WebSocket relay without a credential-based authentication protocol.

**Resolution**
- server-side room isolation is now enforced
- join payloads are structurally validated
- operations are accepted only after a room join and only when `op.roomId` matches the socket room
- operation type is allowlisted
- WebSocket message size is capped at 1 MiB

**Remaining**
Authenticated room membership, credential/token validation and rate limiting remain required for production-secure collaboration.

---

### PERF-P1-01 — Page assets remain heavily data-URL driven
**Status:** [ ]

**Evidence**
Project status documentation explicitly records data-URL-heavy asset storage, and browser/editor state keeps `imageUrl` alongside durable paths.

**Risk**
Large chapters increase memory and serialization costs.

**Acceptance**
Use durable asset references in domain state; materialize data URLs only at renderer/API boundaries.

---

## P2 — Important hardening

### UX-P2-01 — Export cancellation message contains mojibake
**Status:** [x]

**Resolution**
Replaced the corrupted user-facing message in `recordExportSelectionCanceled()` with valid UTF-8 Russian text.

**Acceptance**
The exported cancellation message is valid UTF-8.

---

### SOURCE-P2-01 — Source monitor lacks timeout/concurrency/validation controls
**Status:** [x]

**Resolution**
- source creation and fetches require HTTP(S)
- RSS, HTML and chapter-image requests use a 15-second timeout
- normalized source URLs are stored on creation
- source polling remains sequential, keeping concurrency bounded

**Acceptance**
Network calls have explicit timeouts and source URLs are restricted to HTTP(S). Cancellation remains a future enhancement.

---

### API-P2-01 — Remote API configuration uses plain HTTP
**Status:** [ ]

**Evidence**
`src/services/apiServer.ts` constructs `http://host:port` endpoints and has no authentication protocol.

**Acceptance**
Document localhost-only assumptions or add authenticated HTTPS-capable transport for remote usage.

---

### RENDER-P2-01 — Basic inpainting is a fallback algorithm, not content-aware cleanup
**Status:** [ ]

**Evidence**
`src/services/inpainting/basic.ts` fills a region from sampled edge colors and applies a small blur.

**Acceptance**
Label it clearly as basic fallback and test IOPaint/content-aware providers as separate capability levels.

---

### PLUGIN-P2-01 — Plugin trust model is implicit
**Status:** [~]

**Evidence**
`src/plugins/loader.ts` executes plugin source with `new Function()`, and plugin API exposes page/region access plus network fetch.

**Resolution**
- remote plugin source is restricted to HTTP(S)
- remote plugin downloads have a 15-second timeout and 1 MiB size cap
- failed plugin initialization no longer leaves a registered plugin entry behind
- a plugin is registered only after successful factory initialization

**Remaining**
Plugin code is still trusted application-level JavaScript. No sandbox or capability isolation exists.

**Acceptance**
Treat plugins as trusted code in product documentation. Add sandbox/capability restrictions before supporting untrusted third-party plugins.

---

### CI-P2-01 — Lint is not a required CI gate
**Status:** [ ]

**Evidence**
`package.json` exposes an ESLint script and `eslint.config.js`, but ESLint packages are not declared in the current dependency lockfile.

**Resolution**
Kept lint out of the CI gate until the ESLint dependency set is declared and lockfile-backed.

**Acceptance**
Add the ESLint dependency set and then make lint a required quality gate.

---

### CI-P2-02 — Validation script checks only a small hardcoded subset
**Status:** [x]

**Evidence**
`scripts/validate.mjs` transpiles a fixed list of files rather than validating the complete source tree.

**Acceptance**
Either remove the duplicate validation layer or make it cover all supported source/config files that it claims to validate.

---

### RELEASE-P2-01 — CI uses generated Android manifest patching
**Status:** [ ]

**Evidence**
The Android workflow runs `tauri android init` and then modifies the generated manifest with `sed`.

**Risk**
Generated layout changes can silently break the build or permissions behavior.

**Acceptance**
Track stable Android configuration in source where possible and keep the CI patch minimal/version-pinned.

---

### RELEASE-P2-02 — Desktop build matrix is x86-focused
**Status:** [ ]

**Evidence**
The current CI matrix targets x86_64 Linux/macOS/Windows.

**Acceptance**
Decide whether ARM desktop builds are in product scope and add explicit support/tests if they are.

---

### DOC-P2-01 — README/status docs can drift from actual runtime capability
**Status:** [ ]

**Evidence**
The status report is dated 2026-03-27 and describes Stage 3 while current source contains additional adapters/features. README marks several broad capabilities as complete despite provider-specific/runtime-specific limitations.

**Acceptance**
Update documentation from a capability matrix generated/reviewed against actual current code.

---

### SOURCE-P2-02 — Manga Translator integration needs bounded network behavior
**Status:** [x]

**Resolution**
- endpoint is parsed and restricted to HTTP(S)
- requests have a 30-second timeout
- timeout errors are surfaced distinctly
- response JSON is validated for a non-empty image payload
- malformed/missing `elapsed` values safely fall back to zero

**Acceptance**
Manga Translator requests are bounded and malformed responses are rejected.

---

### IMAGE-P2-01 — Duplicate-page asset fix from PR #1 must be merged or superseded
**Status:** [ ]

A separate draft PR already exists:
- `fix/duplicate-page-asset-isolation`
- PR #1

The audit branch does not duplicate that change. The fix should be merged separately or cherry-picked into the final maintenance branch.

---

## P3 — Release polish

### RELEASE-P3-01 — Add release artifact checksums and provenance
**Status:** [ ]

### RELEASE-P3-02 — Add crash-log retention/diagnostic export UX
**Status:** [ ]

### RELEASE-P3-03 — Add automated smoke tests for import PNG/JPG/PDF/CBZ/CBR
**Status:** [ ]

### RELEASE-P3-04 — Add performance budget for large chapter load
**Status:** [ ]

### RELEASE-P3-05 — Remove or archive stale/unused protocol and legacy code paths after capability review
**Status:** [ ]

---

## Audit recommendations by execution order

1. Finish OCR backend cancellation wiring and verify on Windows.
2. Unskip and strengthen `useRegionStore` tests.
3. Fix source-of-truth/recovery semantics between snapshot and normalized DB.
4. Redesign history snapshots to avoid copying image payloads.
5. Fix browser OCR language selection.
6. Resolve desktop/browser translation provider capability mismatch.
7. Add authenticated collaboration room membership before treating collaboration as production-ready.
8. Harden remaining cancellation semantics for translation/export.
9. Tighten CI quality gates.
10. Update README/status docs from actual current behavior.

## Verification gate for closing this audit

The audit should not be considered closed until:
- PR CI is green
- TypeScript and Rust builds pass
- all non-skipped critical test suites pass
- Windows desktop OCR cancellation is manually verified
- duplicate-page asset isolation is manually verified
- project recovery is tested with a missing asset
- collaboration is tested with two independent project sessions
- large-project history memory is profiled
