# Decisions

## Purpose

Keep a compact record of architecture and process decisions that should not be rediscovered from scratch.

## Decision Log

### 2026-03-26 - Desktop-first local architecture

Decision:

- build ScanForge as a React + Tauri desktop application rather than a web-only shell

Context:

- the product is local-first
- OCR, filesystem access, and recovery behavior benefit from desktop integration

Consequences:

- desktop integrations are first-class
- browser mode remains fallback/development mode, not the primary product target

### 2026-03-26 - DB-first normalized domain storage

Decision:

- use normalized SQLite-backed domain storage as the primary persistence layer

Context:

- snapshot-only storage blocked pipeline growth and increased technical debt

Consequences:

- repositories became the persistence boundary
- pages, regions, jobs, settings, and styles moved into normalized storage
- snapshot support remains for compatibility and backup paths

### 2026-03-26 - Repository boundary between UI and storage

Decision:

- route domain persistence through repositories instead of direct store-to-storage logic

Context:

- OCR, translation, export, and recovery needed stable storage contracts

Consequences:

- UI and stores orchestrate behavior
- repositories own DB access and merge/sync logic

### 2026-03-27 - Provider-based OCR and translation direction

Decision:

- structure OCR and translation around provider selection and service boundaries

Context:

- the product cannot stay coupled to one OCR or translation implementation forever

Consequences:

- provider metadata is persisted
- fallback chains become possible
- future provider integrations should extend contracts, not rewrite UI flows

### 2026-03-27 - Rendered export must read from domain state

Decision:

- rendered export should be driven by synced repository/domain state, not only live UI state

Context:

- export reproducibility matters and should not depend on transient component state

Consequences:

- export sync happens before rendering
- export behavior is closer to deterministic and easier to debug

### 2026-03-28 - Stage-driven documentation system

Decision:

- project work should be managed through `scanforge/docs` and `templates`

Context:

- stage drift and undocumented decisions create avoidable chaos

Consequences:

- `CURRENT_STAGE.md` becomes the daily entry point
- architecture/provider/testing updates should be recorded when behavior changes materially
- templates should be used to structure tasks, refactors, bugs, and decisions

### 2026-04-01 - Job execution belongs in services, not inside large stores

Decision:

- move queued OCR, translation, and export execution out of `useJobStore` and into service-layer modules

Context:

- `useJobStore` had accumulated queue orchestration, provider execution, repository refreshes, diagnostics, and export behavior in one large file

Consequences:

- stores stay responsible for queue state and user intent
- pipeline execution becomes easier to locate and evolve in service modules
- future provider or recovery changes should extend service boundaries before growing store complexity further

### 2026-04-01 - Toolbar action orchestration should live in feature hooks/helpers

Decision:

- move toolbar-specific action orchestration and target derivation out of `Toolbar.tsx` into feature-level hooks and pure helpers

Context:

- the toolbar had accumulated project file workflows, export dispatch, OCR and translation target selection, stitch preview behavior, and multiple store interactions in one UI component

Consequences:

- `Toolbar.tsx` can stay focused on layout, menus, and visible controls
- reusable behavior such as OCR/translation target derivation can be unit-tested without rendering the toolbar
- future toolbar changes should extend `src/features/toolbar/useToolbarActions.ts` or pure helpers before growing the component body again

### 2026-04-01 - Large feature containers should split local state and detail panes before they become architecture bottlenecks

Decision:

- split inspector-specific state, shared inspector UI primitives, and the region details pane out of `RegionInspector.tsx`

Context:

- `RegionInspector.tsx` had grown into a single file responsible for tab switching, inspector state, detail editing, region list rendering, shared accordion primitives, and drag/reorder UI

Consequences:

- feature-local modules can evolve independently without forcing every inspector change through one large component file
- `RegionInspector.tsx` stays focused on top-level view switching and composition
- future inspector work should extend local modules such as `useRegionInspector.ts`, `RegionDetailsPanel.tsx`, or `inspectorShared.tsx` before growing the container again

### 2026-04-01 - Sidebar containers should split formatting, sections, and selector hooks before growing into mixed-responsibility components

Decision:

- move jobs-sidebar formatting helpers, section rendering, and sidebar state selection out of `JobsPanel.tsx`

Context:

- `JobsPanel.tsx` had accumulated string formatting, diagnostics presentation, queue rendering, counter derivation, and sidebar runtime state in one file

Consequences:

- `JobsPanel.tsx` stays focused on layout and section composition
- formatting logic becomes reusable and testable without rendering the sidebar
- future jobs-sidebar changes should prefer modules such as `useJobsPanel.ts`, `jobsPanelFormatting.ts`, `JobQueueSection.tsx`, and `DiagnosticsSection.tsx` before growing the container again

### 2026-04-01 - Canvas containers should split runtime hooks and empty-state presentation before becoming mini-frameworks

Decision:

- move editor-canvas runtime state and handlers out of `EditorCanvas.tsx` into a dedicated feature hook and split the empty canvas state into its own component

Context:

- `EditorCanvas.tsx` had accumulated viewport fitting, pointer tracking, draw-mode behavior, drag/drop state, context-menu state, and empty-state presentation in one file on top of the actual Konva stage composition

Consequences:

- `EditorCanvas.tsx` stays focused on stage rendering and visible layer composition
- canvas runtime behavior is easier to evolve without rewriting the whole container
- future canvas work should prefer modules such as `useEditorCanvas.tsx` and `CanvasEmptyState.tsx` before growing the stage container again

### 2026-04-01 - Job stores should delegate queue fabrication details to pure queue services

Decision:

- move target normalization, active-queue signature checks, retry-target derivation, and queued-job construction out of `useJobStore` into a pure queue service

Context:

- `useJobStore` had already delegated execution to `jobExecution`, but still contained repeated logic for deduping targets, constructing queue signatures, and creating new `JobRecord` objects for OCR, translation, and export

Consequences:

- `useJobStore` stays closer to orchestration, retries, and user intent
- queue fabrication logic becomes reusable and testable without mutating store state
- future queueing changes should prefer `src/services/jobQueue.ts` before growing `useJobStore` with another copy of target-processing logic
