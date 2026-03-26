# ScanForge Project Status Report

Date: 2026-03-26
Branch: `stage-3-pipeline-foundation`
Report scope: post-Stage-3 render/export foundation

## 1. Executive Summary

ScanForge is no longer just an editor shell.

The repository now contains a working local-first desktop pipeline foundation with:

- React + TypeScript editor UI
- Tauri desktop shell
- normalized SQLite domain storage
- repository layer for domain access
- persisted local project library
- page and region editing workflow
- real local OCR path on Windows via WinRT OCR
- persisted OCR and translation jobs
- draft translation pipeline with provider abstraction
- rendered PNG export from DB-backed translated page state
- project pipeline settings and text style persistence
- strong viewer and inspection UX

The most accurate current one-line description is:

`Local-first scanlation editor foundation with normalized persistence, real Windows OCR, draft translation pipeline, rendered PNG export, and strong viewer/editor UX`

This is a serious step forward from Stage 2, but Stage 3 is still not fully complete.

What is still missing before Stage 3 can be called done:

- end-to-end verification and stabilization pass
- stronger OCR and translation provider coverage beyond current local draft paths

## 2. Current Stage Status

### 2.1 Stage 2

Stage 2 can be treated as completed for practical purposes.

Closed outcomes:

- normalized domain storage became the main persistence backbone
- repositories exist for core entities
- pages, regions, jobs, and OCR all route through DB-backed paths
- snapshot JSON is no longer the primary source of truth

Remaining Stage 2 caveat:

- snapshot compatibility still exists for project import/export and a small amount of non-critical UI context such as `activePageId`

### 2.2 Stage 3

Stage 3 is in progress and materially advanced.

Workstream status:

- Workstream A `Domain & schema completion` -> substantially done
- Workstream B `Real OCR integration` -> usable and integrated
- Workstream C `Translation pipeline` -> first real foundation implemented
- Workstream D `Final render / export foundation` -> foundation implemented
- Workstream E `Verification and stabilization` -> not done

Practical Stage 3 verdict:

- the repo is no longer "editor + OCR preview only"
- the repo is now "editor + OCR + translation draft + rendered export foundation"
- Stage 3 is not done yet because verification and stabilization are still missing

## 3. Repository and Branch State

Current active branch:

- `stage-3-pipeline-foundation`

Recent Stage 3 milestone commits:

- `e2fb632` `docs: add stage 3 execution plan`
- `ddbc0e3` `refactor: start stage 3 domain completion`
- `0c08929` `refactor: hydrate stage 3 project domain config`
- `5d1187d` `feat: add windows ocr provider`
- `3aab524` `feat: add translation pipeline foundation`

Build health right now:

- `npm run build` passes
- `cargo check` passes

Quality/process status:

- no automated test suite yet
- no CI pipeline yet
- no dedicated lint pipeline yet

## 4. Planned Product vs Current Reality

### 4.1 Target product from specs

From `CORE.md`, `ENGINEERING_SPEC.md`, and `UX_SPEC.md`, the target product remains:

- local-first scanlation studio
- pipeline `RAW -> OCR -> Translation -> Cleaning -> Redraw -> Typesetting -> QC -> Export`
- architecture direction `UI -> API -> Services -> Storage`
- strong region/job lifecycle handling

### 4.2 Current reality in code

What exists now:

- desktop-first React/Tauri editor
- normalized SQLite persistence
- project settings and text styles in DB
- page and region editor workflows
- OCR provider path with real Windows OCR on desktop
- translation provider path with persisted draft translations
- rendered export path using stored translated overlays and text styles
- persisted OCR and translation jobs
- strong viewer/focus/clean reading modes

What does not exist yet:

- full typesetting workflow
- cleaning/redraw toolset
- QC workflow
- FastAPI/service split
- automated verification suite

## 5. Current Architecture

Current practical architecture:

`React UI -> Zustand stores -> repositories -> Tauri commands / browser adapters -> SQLite normalized tables + snapshot compatibility`

This is the real architecture of the repo today.

What exists:

- frontend UI layer
- Zustand state layer
- repository persistence boundary
- Tauri backend commands for OCR and translation
- normalized SQLite tables for domain state
- browser fallback domain storage for non-Tauri runs
- snapshot compatibility and backup path

What does not exist:

- separate FastAPI service layer
- external worker process architecture
- cloud sync or collaboration
- remote OCR/translation orchestration

## 6. Technology Stack

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
- Rust
- `rusqlite`
- `serde`
- `serde_json`
- Tauri dialog and fs plugins

Platform integrations:

- Windows WinRT OCR provider via PowerShell bridge for desktop OCR

Not present:

- FastAPI
- PaddleOCR
- OpenCV
- external translation SDKs
- automated test runner in active use

## 7. Implemented Product Surface

### 7.1 Editor shell

Implemented shell pieces:

- `Layout`
- `Toolbar`
- `PagesSidebar`
- `EditorCanvas`
- `RegionInspector`
- `StatusBar`
- `ToastContainer`

### 7.2 Page workflow

Implemented page operations:

- import image files
- page list view
- drag-and-drop page reorder
- multi-select pages
- active page switching
- page deletion
- page stitching
- active page rendered PNG export

### 7.3 Region workflow

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
- toggle lock and visibility
- inspect OCR and translation metadata

### 7.4 Viewer UX

This remains one of the strongest parts of the project:

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

### 7.5 Pipeline settings UX

Minimal Stage 3 settings are now accessible in the inspector via `ProjectSettingsPanel`:

- source language selector
- target language selector
- OCR engine selector
- translation provider selector

Toolbar pipeline controls now include:

- run OCR
- run translation
- overwrite-existing-translations toggle
- rendered PNG export trigger

## 8. Domain Model and Persistence Status

### 8.1 Core normalized entities

Persisted normalized entities now include:

- `projects`
- `pages`
- `regions`
- `jobs`
- `project_settings`
- `text_styles`

### 8.2 Region model maturity

Critical Stage 3 region data is now DB-backed rather than snapshot-only:

- geometry
- label
- kind
- order
- orientation
- source text
- OCR lifecycle fields
- translated text
- translation lifecycle fields
- notes
- visibility and lock state
- text style reference

This is a meaningful architectural improvement over the Stage 2 halfway state.

### 8.3 Snapshot dependence

The project is still not a pure snapshot-free app, but the remaining dependence is much smaller than before.

Snapshot is still used for:

- compatibility import/export
- backup envelope behavior
- some project file reconstruction concerns outside the DB core

Snapshot is no longer required for core region metadata that matters to OCR, translation, and rendered export.

### 8.4 Asset storage reality

Important limitation still present:

- page assets are still effectively stored as data URLs
- DB stores `imagePath`, but in practice this still points to embedded image data rather than a durable filesystem asset path

So persistence is normalized, but asset storage is still not production-grade.

## 9. OCR Status

### 9.1 What is implemented

OCR is now provider-based and storage-backed.

Current OCR path:

1. sync current page and region domain state into DB
2. run OCR by page id through Tauri
3. backend reads page and regions from domain storage
4. backend processes region crops
5. backend writes OCR results back into `regions`
6. frontend refreshes region state from repositories

Desktop OCR on Windows:

- real local OCR via WinRT OCR
- region-level crop processing
- OCR metadata persisted per region

Persisted OCR metadata:

- `sourceText`
- `ocrStatus`
- `ocrEngine`
- `sourceLanguage`
- `ocrUpdatedAt`
- `ocrConfidence`

### 9.2 Current limitations

Important remaining OCR gaps:

- OCR selected-region workflow is not yet first-class in the UI
- OCR overwrite/fill-empty-only is still effectively fill-empty-only
- only Windows currently has a real OCR provider path
- Tesseract/Paddle/Manga OCR adapters are not implemented yet

## 10. Translation Status

### 10.1 What is implemented

Stage 3 translation foundation now exists as a real persisted pipeline.

Current translation path:

1. sync current page and region state into DB
2. resolve project settings from normalized storage
3. run translation by page or selected region target
4. provider writes translated draft text into `regions`
5. frontend refreshes translated region state from repositories

Implemented translation capabilities:

- provider abstraction
- Tauri translation backend command
- browser fallback translation path
- translation jobs in persisted queue
- translate selected page
- translate selected region
- overwrite-existing toggle
- translated text stored in DB and restored after reload

Persisted translation metadata:

- `translatedText`
- `targetLanguage`
- `translationStatus`
- `translationProvider`
- `translationUpdatedAt`

### 10.2 Current translation provider reality

The current provider is a local draft provider, not a production-grade translator.

What exists today:

- `local` draft provider
- `mock` preview provider
- persisted provider abstraction

What it means in practice:

- translation architecture is now real
- translation job persistence is real
- output is draft-quality and deterministic
- this is enough to support the first rendered export layer

### 10.3 Current translation limitations

Still missing:

- real external or model-backed translation quality
- translation batch review UX
- stronger overwrite policy UX beyond a single toggle
- richer translation job payload/result presentation

## 11. Job System Status

Jobs are no longer OCR-only.

Current job system now supports:

- `OCR`
- `TRANSLATE`

Persisted job fields:

- type
- status
- project id
- page id
- optional region ids
- progress
- created/updated timestamps
- summary
- error

Current behavior:

- queued/running/done/failed states persist
- job list restores after project reload
- retry works for OCR and translation jobs
- running jobs recover safely as queued jobs

What is still missing:

- richer per-job result payloads in UI
- multi-stage orchestration across OCR -> translation -> render
- dedicated verification around failure recovery

## 12. Store and Repository Status

Current store topology includes:

- `useProjectStore`
- `useProjectDomainStore`
- `usePageStore`
- `useRegionStore`
- `useJobStore`
- `useProjectLibraryStore`
- `useHistoryStore`
- `useEditorStore`
- `useToastStore`

Important current behavior:

- stores drive UI and editor state
- repositories remain the persistence boundary
- OCR and translation are not implemented directly in the UI layer
- project settings and text styles are hydrated from repositories
- render export syncs and reads from repository-backed domain state

This is aligned with the Stage 3 architectural rule to avoid turning stores into mini-backends.

## 13. Export Status

Rendered export foundation now exists.

Current rendered export behavior:

- export syncs current project state into domain storage before rendering
- export reads page, regions, settings, and text styles from repository-backed storage
- export composes the source image plus visible translated text overlays
- style resolution follows region style -> project default style -> fallback style
- output is written as rendered PNG, not raw source image

Current limitations:

- export is frontend canvas-based, not backend-renderer-based
- stitched export is still source-image oriented
- text layout is basic Stage 3 auto-fit, not full typesetting
- hidden-region and advanced render options are not exposed in UI yet

## 14. Quality and Risk Assessment

Current strengths:

- editor shell and viewing UX
- normalized domain model
- OCR repository path
- translation repository path
- rendered export path from domain state
- project settings persistence
- local-first recovery behavior

Current risks:

- translation quality is draft-level
- OCR provider coverage is platform-limited
- image asset storage is still data-URL heavy
- no automated tests
- undo/redo is still snapshot-based and not aligned with the long-term action model

## 15. Stage 3 Done-Definition Check

Stage 3 done-definition vs actual status:

- normalized domain storage remains the core source of truth -> yes
- real OCR replaces preview OCR -> partially yes on Windows, not fully cross-platform
- translation jobs exist and persist -> yes
- translated text survives reload -> yes
- project settings include source/target language and providers -> yes
- rendered export produces composed page output -> yes
- build remains green -> yes
- Stage 2 projects still load -> expected yes, but full verification pass still pending

Practical conclusion:

- Stage 3 is not done yet
- the repo is now close enough that verification and stabilization are the right next targets

## 16. Recommended Next Steps

The correct next execution order from here is:

1. add a repeatable manual verification checklist for OCR -> translation -> export
2. verify Stage 2 project migration through OCR -> translation -> export
3. add minimal automated checks around repository CRUD and job lifecycles
4. harden provider failure reporting and recovery paths

If the next work goes into cosmetic editor features instead of verification, Stage 3 will drift again and remain unfinished.

## 17. Final Assessment

ScanForge has moved beyond "editor foundation only".

The repository now contains:

- a serious local-first editor
- normalized domain-backed persistence
- real Windows OCR
- persisted translation draft pipeline
- rendered PNG export from translated domain state
- usable project-level pipeline settings

But the project is still one major slice away from a legitimate Stage 3 finish:

`verification + stabilization`

The most honest current description is:

`A working local-first scanlation editor foundation with normalized persistence, real Windows OCR, persisted translation drafts, and first rendered PNG export, pending verification and stabilization.`
