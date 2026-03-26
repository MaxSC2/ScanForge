# ScanForge Project Status Report

Date: 2026-03-26
Branch: `dev`

## 1. Executive Summary

ScanForge is no longer just a skeleton. The repository currently contains a working desktop-oriented editing MVP with:

- page import and page ordering
- local project persistence
- region drawing and editing
- undo/redo
- OCR job queue scaffold
- Tauri backend shell
- improved viewing modes for inspection and reading

At the same time, the project is still significantly behind the original product plan in `CORE.md`, `ENGINEERING_SPEC.md`, and `UX_SPEC.md`. The biggest gap is that the app is currently an editor/viewer with OCR-preview scaffolding, not yet a full scanlation pipeline.

The current state is best described as:

`Local-first page and region editor + project library + OCR preview queue + viewer UX`

It is **not yet**:

- a full translation studio
- a full cleaning/redraw/typesetting pipeline
- a real OCR engine integration
- a FastAPI-based multi-service architecture
- a normalized SQLite domain model for pages/regions/jobs

## 2. Planned Product vs Current Reality

### 2.1 What the plan says

From the project specs:

- `CORE.md`: local-first scanlation studio, pipeline `RAW -> OCR -> Translation -> Cleaning -> Redraw -> Typesetting -> QC -> Export`
- `ENGINEERING_SPEC.md`: architecture `UI -> API -> Services -> Storage`, region model `id, bbox, text, translation, style`, job states `queued -> running -> done/failed`, storage `SQLite + local FS`
- `UX_SPEC.md`: layout `Sidebar | Canvas | Inspector`, flow from import to export, tools for OCR, translation, QC, editing

### 2.2 What is actually implemented

Implemented in practice:

- React + TypeScript frontend
- Tauri desktop shell
- local persistence layer with SQLite in Tauri and `localStorage` fallback in browser
- region-based canvas editor on Konva
- page list with drag-and-drop reorder
- region list with drag-and-drop reorder
- inspector for region editing
- undo/redo snapshots
- OCR queue with sequential execution
- Tauri OCR command returning preview OCR text
- project library UI and autosave
- advanced viewing UX: fit modes, focus mode, clean view, reader navigation

Not implemented yet:

- FastAPI layer
- translation pipeline
- cleaning tools
- redraw tools
- typesetting engine
- QC workflow
- final rendered export pipeline
- real OCR via PaddleOCR/Tesseract/OpenCV
- structured domain storage for pages/regions/jobs in SQLite

## 3. Current Architecture

Current practical architecture is closer to:

`React UI -> Zustand stores -> Tauri commands / browser adapters -> SQLite blob storage`

This differs from the planned architecture:

`UI -> API -> Services -> Storage`

What exists now:

- UI layer is substantial and already usable
- application state lives mostly in Zustand stores
- backend communication exists only for Tauri commands
- OCR is invoked through Tauri, but only as a preview engine
- storage is project-snapshot based, not entity-based

What does not exist yet:

- separate API layer
- service orchestration layer
- true job orchestration backend
- persistent worker system

## 4. Repository Overview

Top-level meaningful areas:

- `src/`: frontend app
- `src-tauri/`: desktop shell and backend commands
- `CORE.md`, `ENGINEERING_SPEC.md`, `UX_SPEC.md`: project vision/specs
- `README.md`: minimal project description

Key technology stack currently in code:

- React 19
- TypeScript
- Zustand
- Konva / react-konva
- Tauri 2
- rusqlite
- Lucide icons
- hello-pangea/dnd
- Vite + singlefile build

Not present in the repo today:

- FastAPI
- Python services
- PaddleOCR
- OpenCV
- automated test suite

## 5. Frontend State

### 5.1 App shell

The app shell is already coherent:

- `Layout`
- `Toolbar`
- `PagesSidebar`
- `EditorCanvas`
- `RegionInspector`
- `StatusBar`
- `ToastContainer`

The app starts keyboard shortcuts and local persistence automatically at boot.

### 5.2 Toolbar

Current toolbar capabilities:

- open images
- open project file
- save project file
- export active page as PNG
- run OCR
- stitch selected pages
- switch editor tools
- undo/redo
- zoom controls
- focus mode
- clean view
- viewer presets: `1:1`, `Width`, `Page`
- overlay visibility toggle

This is already significantly beyond the original bare skeleton.

### 5.3 Sidebar

The left side is tabbed and now contains three practical workspaces:

- Pages
- Projects
- Jobs

Implemented behavior:

- page list
- batch page selection
- page drag-and-drop reorder
- page deletion
- project library refresh/load/create
- jobs dashboard with queue state and retry

### 5.4 Inspector

The right panel supports:

- region details view
- full region list view
- region metadata editing
- geometry editing
- source text editing
- translated text editing
- notes editing
- lock/visibility controls
- duplicate/delete region
- region reorder in list

This means the region editor is already much more mature than the specs alone might suggest.

## 6. Canvas and Editing

### 6.1 What works

Canvas/editor capabilities currently include:

- page rendering via Konva
- draw new rectangular regions
- select regions
- move regions
- resize regions
- right-click context menu for regions
- lock/unlock regions
- show/hide individual regions
- overlay labels
- grid overlay
- minimap
- cursor coordinates in status bar

### 6.2 Viewing and inspection UX

Viewing UX is one of the strongest implemented areas right now:

- manual zoom
- fit page
- fit width
- actual size (`1:1`)
- overlay visibility toggle
- focus mode with overlay side panels
- clean view that removes most UI
- clean view HUD with auto-hide
- cinematic page presentation in clean view
- reader-like page navigation in clean view

This area is ahead of the rest of the product in terms of polish.

## 7. State Management

The application logic is centered around Zustand stores:

- `usePageStore`
- `useRegionStore`
- `useProjectStore`
- `useProjectLibraryStore`
- `useHistoryStore`
- `useEditorStore`
- `useJobStore`
- `useToastStore`

### 7.1 Strengths

- state is split by concern
- editor interactions are already usable
- history snapshots cover pages, selection and project meta
- project library and autosave are integrated
- OCR jobs are isolated from editor logic

### 7.2 Limitations

- undo/redo is snapshot-based, not action-based as planned
- no explicit page lifecycle or region lifecycle state machines
- job state is in-memory only
- no persisted job history in database

## 8. Persistence and Storage

### 8.1 What exists now

The app already has real local-first persistence:

- Tauri repository backed by SQLite
- browser fallback repository backed by `localStorage`
- autosave of current local project
- load latest project on startup
- project library listing

### 8.2 Tauri storage design today

Current SQLite approach is simple:

- one `projects` table
- one row per project
- project payload stored as full JSON blob in `payload_json`

Stored summary metadata:

- id
- name
- created/updated timestamps
- last opened timestamp
- page count

### 8.3 Important limitation

This is **not** yet the planned `SQLite + local FS` domain model.

What is missing:

- pages table
- regions table
- jobs table
- assets/files on disk with references
- normalized relationships
- partial loading
- selective updates

Today storage behaves as:

`entire project snapshot save/load`

not as:

`structured project database`

## 9. OCR and Jobs

### 9.1 What exists

OCR is implemented as a working vertical slice:

- queue OCR jobs for pages
- sequential processing
- statuses `queued`, `running`, `done`, `failed`
- progress updates
- result summary
- retry failed jobs
- skip locked and already-filled regions

### 9.2 Frontend OCR path

Frontend flow:

- encode page image as data URL
- serialize page + regions into OCR payload
- call Tauri OCR backend or browser preview fallback
- apply returned text into `sourceText`

### 9.3 Backend OCR path

Backend OCR currently exists only as preview logic:

- validates payload
- iterates regions
- skips invalid/locked/already-filled regions
- generates synthetic preview text

Important conclusion:

OCR architecture is wired correctly enough for replacement later, but the engine is not real OCR yet.

### 9.4 What is missing in jobs

- translation jobs
- job cancellation
- concurrent worker strategy
- persisted jobs
- resumable jobs
- background service manager
- job dependency graph

## 10. Import, Save, Export

### 10.1 Import

Current import capabilities:

- load image files into pages
- drag-and-drop images onto canvas
- open `.scanforge.json` project file
- restore local project snapshot

### 10.2 Save

Two save paths exist:

- manual export to `.scanforge.json`
- background autosave to local repository

### 10.3 Export

This is a major gap area.

Current export behavior:

- exporting a page saves the original page image blob
- stitched export saves the stitched image produced from source page images

What export does **not** do yet:

- render translated text
- render cleaned/redrawn output
- render final composition
- export chapter package
- export QC outputs

So export exists technically, but not yet as final production export.

## 11. What Has Been Implemented Well

Strongest parts of the current project:

1. Editor UX foundation
2. Local-first persistence direction
3. Region manipulation workflow
4. OCR queue scaffolding
5. Viewer and clean-view polish
6. Clear Git progress with incremental commits

The project already feels like a usable internal tool for:

- loading pages
- marking regions
- organizing projects
- previewing OCR workflow
- reviewing pages visually

## 12. Main Gaps Against the Original Vision

The biggest missing systems relative to the specs are:

### 12.1 Product pipeline gaps

- Translation
- Cleaning
- Redraw
- Typesetting
- QC
- final Export

### 12.2 Architecture gaps

- no FastAPI
- no UI/API/service split
- no backend service orchestration
- no separate OCR service process

### 12.3 Data model gaps

- region has no `style` model
- no text styling/typesetting schema
- no lifecycle state machines
- jobs not persisted

### 12.4 Production-readiness gaps

- no tests
- no CI
- no migration strategy
- no error telemetry
- no packaging/release workflow

## 13. Risks and Technical Debt

### 13.1 Snapshot storage debt

Saving the full project JSON blob into SQLite is fine for MVP speed, but it will become limiting for:

- large projects
- partial updates
- job persistence
- future collaboration features
- search/filter/reporting

### 13.2 Undo/redo debt

Snapshot-based history is easy to ship, but it becomes expensive and fragile as the data model grows.

### 13.3 OCR replacement risk

The current OCR interface is replaceable, which is good. But once real OCR lands, the project will also need:

- region image cropping
- language settings
- confidence metadata
- model configuration
- better error handling

### 13.4 Export debt

Until export produces the final rendered page, the app remains an editor prototype rather than a full production studio.

## 14. Suggested Priority Order From Here

If development returns to the core plan, the most rational next sequence is:

1. Replace snapshot-only storage with a clearer project repository/domain model
2. Add translation jobs next to OCR jobs
3. Define richer region schema including style/typesetting fields
4. Build final rendered export pipeline
5. Add cleaning/redraw/text tools after export path is real
6. Only then consider FastAPI split if local Tauri-only architecture becomes limiting

Short version:

`Storage/domain model -> Translation -> Final export -> Production editing tools`

## 15. Current Build and Tooling Status

Confirmed on 2026-03-26:

- `npm run build` passes
- `cargo check` passes

Current branch:

- `dev`

Recent feature progression shows consistent forward movement:

- local persistence foundation
- project library
- OCR queue
- Tauri OCR wiring
- side panel streamlining
- focus mode
- viewer presets
- clean view
- clean view polish
- clean view reader navigation

## 16. Final Assessment

ScanForge is currently in a strong **MVP editor foundation** phase.

It is already valuable as:

- a local page/region organizer
- a region annotation editor
- an OCR-preview workflow shell
- a polished viewer for inspection

It is not yet the full scanlation studio described in the specs.

Best one-line assessment:

`The project has a solid local-first editing core, but the main production pipeline from OCR to final translated export is still only partially built.`
