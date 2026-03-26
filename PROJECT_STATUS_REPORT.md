# ScanForge Project Status Report

Date: 2026-03-26
Branch: `stage-2-domain-refactor`
Report scope: post-Stage-2 repository state

## 1. Executive Summary

ScanForge is no longer a bare prototype. The repository now contains a working local-first desktop editing foundation with:

- React + TypeScript editor UI
- Tauri desktop shell
- normalized SQLite domain tables for `projects`, `pages`, `regions`, and `jobs`
- repository layer for domain access
- local project library
- page and region editing workflow
- OCR preview pipeline wired through backend storage
- persisted OCR job queue state
- strong viewer and inspection UX

The current product is best described as:

`Local-first scanlation editor foundation with normalized persistence and OCR-preview backend`

It is still not a full scanlation studio. Major pipeline stages such as translation, cleaning, redraw, typesetting, QC, and final composed export are not implemented yet.

Most important reality check:

- Stage 2 is substantially completed.
- Core domain entities now live in normalized storage.
- JSON snapshot storage is no longer the main domain source.
- JSON is still retained as a compatibility and backup layer for import/export and for some UI-only metadata that the current domain schema does not yet store.

## 2. Repository and Delivery Status

Version-control and repo state:

- Git is configured and used actively.
- The current working branch is `stage-2-domain-refactor`.
- The repository has a clean incremental history for Stage 2.

Recent milestone commits:

- `e3ffe03` `refactor: add normalized sqlite schema foundation`
- `9cb48f9` `refactor: add domain repository layer`
- `41b09e0` `refactor: connect pages to domain storage`
- `f6a3e64` `refactor: connect regions to domain storage`
- `3fd1ab8` `refactor: route ocr through domain storage`
- `9e8a406` `refactor: persist jobs in domain storage`
- `32fa130` `refactor: make local project storage db-first`

Build health right now:

- `npm run build` passes
- `cargo check` passes

Quality/process gaps:

- no automated test suite
- no lint step
- no CI pipeline in the repo

## 3. Planned Product vs Current Reality

### 3.1 Planned product from specs

From `CORE.md`, `ENGINEERING_SPEC.md`, and `UX_SPEC.md`, the target product is:

- local-first scanlation studio
- pipeline `RAW -> OCR -> Translation -> Cleaning -> Redraw -> Typesetting -> QC -> Export`
- architecture `UI -> API -> Services -> Storage`
- stack direction `React + Tauri + FastAPI + PaddleOCR + OpenCV`
- strong region/job systems and explicit lifecycle handling

### 3.2 Current reality in code

What is implemented now:

- desktop-first React/Tauri editor
- page import, selection, reorder, and stitching
- region draw/edit workflow
- project autosave and restore
- normalized local storage for project/page/region/job domain data
- OCR preview backend through Tauri
- persisted job queue core state
- polished inspection and reading UX

What is not implemented now:

- FastAPI layer
- translation pipeline
- cleaning tools
- redraw tools
- typesetting engine
- QC workflow
- final composed export renderer
- real OCR engine integration
- action-based undo/redo architecture
- region/page lifecycle state machines

## 4. Current Architecture

Current practical architecture is:

`React UI -> Zustand stores -> repository helpers -> Tauri commands / browser adapters -> SQLite normalized tables + snapshot backup`

This is much closer to the planned direction than the old snapshot-only setup, but it is not yet the full target architecture from the engineering spec.

What exists now:

- frontend UI layer
- state layer via Zustand stores
- repository layer for `projects/pages/regions/jobs`
- Tauri backend commands
- normalized SQLite tables
- browser fallback domain persistence in `localStorage`
- snapshot compatibility layer

What does not exist yet:

- separate API boundary
- separate service orchestration layer
- worker subsystem outside the app process
- FastAPI backend
- external OCR/translation services

## 5. Technology Stack in the Repo

Frontend/runtime:

- React 19
- TypeScript
- Zustand
- Konva / react-konva
- `@hello-pangea/dnd`
- Lucide React
- Vite
- `vite-plugin-singlefile`

Desktop/backend:

- Tauri 2
- `rusqlite`
- `serde`
- `serde_json`
- Tauri dialog and fs plugins

Not present:

- FastAPI
- Python backend services
- PaddleOCR
- OpenCV
- Vitest/Jest/Playwright tests

## 6. Implemented Product Surface

### 6.1 App shell

The app shell is coherent and already usable:

- `Layout`
- `Toolbar`
- `PagesSidebar`
- `EditorCanvas`
- `RegionInspector`
- `StatusBar`
- `ToastContainer`

### 6.2 Page workflow

Implemented page operations:

- import image files
- page list view
- drag-and-drop page reorder
- multi-select pages
- active page switching
- page deletion
- page stitching
- active page export as PNG

### 6.3 Region workflow

Implemented region operations:

- draw rectangular regions
- select region
- move and resize region
- duplicate region
- delete region
- reorder regions
- edit geometry
- edit source text
- edit translated text
- edit notes
- toggle lock/visibility

### 6.4 Inspector and sidebar UX

Current side panels include:

- Projects tab
- Pages tab
- Jobs tab
- region detail inspector
- all-regions list inspector

### 6.5 Viewer UX

This is one of the strongest implemented areas:

- zoom in/out
- manual zoom reset
- fit page
- fit width
- actual size `1:1`
- overlay visibility toggle
- focus mode
- clean view
- auto-hide clean-view HUD
- reader-style page navigation in clean view

## 7. Zustand Store Topology

Current state is split across:

- `useProjectStore`
- `usePageStore`
- `useRegionStore`
- `useJobStore`
- `useProjectLibraryStore`
- `useHistoryStore`
- `useEditorStore`
- `useToastStore`

This is a meaningful improvement over the original single-snapshot shape, but the app is still not using a fully action-driven model.

Important current behavior:

- `projectStore` carries project meta
- `pageStore` carries current in-memory pages
- `regionStore` mutates region data within active page state
- `jobStore` carries UI-visible job queue state and now syncs its core fields into DB
- `historyStore` is still snapshot-based

## 8. Storage and Persistence Status

### 8.1 Stage 2 outcome

Stage 2 goal was:

`Snapshot JSON storage -> normalized domain-driven storage`

That goal is mostly achieved.

What now exists in normalized storage:

- `projects`
- `pages`
- `regions`
- `jobs`

What now persists in DB:

- project meta
- page order and image path
- region geometry and domain text/status fields
- job type/status/progress/error timestamps

### 8.2 Current local persistence behavior

Local persistence now works like this:

1. The editor still serializes a project snapshot for backup and compatibility.
2. The app syncs pages, regions, and jobs into normalized storage through repository helpers.
3. On restore/load, the app hydrates a project payload and then overlays current domain data from repositories.
4. Pages, regions, and jobs therefore come back from normalized storage, not only from raw snapshot JSON.

### 8.3 Important caveat

The system is not yet a pure domain-only reconstruction.

Snapshot backup still matters for fields that are not present in the current normalized schema, especially:

- region `label`
- region `kind`
- region `order` as editor metadata
- region `notes`
- `activePageId`

Because of that, the runtime is best described as:

`DB-first for core domain state, snapshot-assisted for UI-only metadata`

### 8.4 Asset storage reality

The engineering spec says `SQLite + local FS`.

Current reality is:

- page images are stored as data URLs
- data URLs are written into snapshot backup
- page `imagePath` in DB still points to data URLs, not filesystem assets

So storage is normalized, but asset storage is not yet optimized.

## 9. Repository Layer Status

Implemented repositories:

- `projectRepository.ts`
- `pageRepository.ts`
- `regionRepository.ts`
- `jobRepository.ts`

Implemented persistence bridges:

- `pagePersistence.ts`
- `regionPersistence.ts`
- `jobPersistence.ts`

What they now handle:

- domain CRUD access
- merge of repository data back into UI state
- sync of in-memory page/region/job changes into DB
- browser fallback behavior

This is a major architectural milestone because the editor is no longer built around one opaque blob.

## 10. OCR and Job System Status

### 10.1 OCR status

OCR is now wired through backend storage, not through raw in-memory JSON regions.

Current OCR flow:

1. sync current pages/regions into domain storage
2. run OCR by page id
3. backend reads page and region data from storage
4. backend writes OCR result back into stored regions
5. frontend reloads the updated regions from repository

This is structurally the correct direction for the later pipeline.

### 10.2 OCR limitation

The OCR engine is still a preview/mock engine.

It does not do real image recognition. It currently generates preview text based on page/region context and writes that into `sourceText`.

### 10.3 Jobs status

Jobs are no longer only transient UI state.

Implemented now:

- `queued`, `running`, `done`, `failed`
- persisted core job state in `jobs` table
- job restore on project load
- running jobs normalized back to queued on recovery
- retry and clear flow in the sidebar

What is still missing:

- richer persisted job payloads
- persisted result summaries/messages
- multi-stage job orchestration beyond OCR

## 11. Stage 2 Plan Checkpoint

Stage 2 checklist versus actual repo state:

- `1. create SQLite schema` -> done
- `2. make repositories` -> done
- `3. connect pages` -> done
- `4. connect regions` -> done
- `5. adapt OCR` -> done
- `6. add jobs` -> done
- `7. make migration` -> done
- `8. remove JSON dependency as primary source` -> mostly done, with compatibility caveat

Practical Stage 2 verdict:

- the old snapshot-only architecture is gone as the main project backbone
- normalized domain storage is now the main structural source of truth for core entities
- snapshot backup still participates where the current domain model is intentionally incomplete

## 12. Remaining Gaps Against Original Specs

Still missing relative to `CORE.md`, `ENGINEERING_SPEC.md`, and `UX_SPEC.md`:

- translation pipeline
- translation UI
- cleaning workflow
- redraw workflow
- typesetting workflow
- QC workflow
- final composed export
- real OCR engine
- FastAPI/service architecture
- page/region lifecycle machines
- action-based history system
- filesystem asset storage
- automated tests

## 13. Technical Debt and Risks

Important current risks:

- UI metadata still depends on snapshot fallback because the domain schema does not yet store all region/editor fields.
- `imagePath` currently holds data URLs, which is heavy and not scalable for large projects.
- Undo/redo is still snapshot-based and not aligned with the long-term action-system plan.
- The project still lacks automated tests, so regression risk is manual.
- OCR is architecturally correct but functionally still mock-level.
- Job persistence stores the core queue state, but not the full rich UI job presentation.

## 14. What Is Strong Right Now

Strongest areas in the project today:

- editor shell and viewing UX
- page and region interaction model
- local-first persistence foundation
- normalized domain storage introduction
- repository-layer architecture
- OCR storage path design
- project library and autosave behavior

## 15. What Needs to Happen Next

The next stage should no longer be another storage refactor. The foundation is good enough to move the product forward.

Best next priorities:

1. Close the remaining domain gaps if full snapshot independence is required.
2. Replace OCR preview with a real OCR engine.
3. Build the translation pipeline on top of the normalized storage path.
4. Add final rendered export so translated content can become real output.
5. Introduce test coverage for repositories, persistence, and OCR/job flow.

## 16. Final Assessment

ScanForge has moved from "interesting prototype" to "serious local-first editor foundation".

It is still not the full product from the original vision, but the project is now in a far better place architecturally:

- normalized domain storage exists
- OCR and jobs already use it
- the editor is usable
- local project recovery works
- Stage 2 technical debt reduction is real, not cosmetic

The most accurate one-line description of the repository today is:

`A working local-first scanlation editor foundation with normalized persistence, OCR-preview backend, and strong viewer/editor UX, ready for real pipeline stages next.`
