# Architecture

## Current Practical Architecture

`React UI -> Zustand stores -> services/repositories -> Tauri commands or browser adapters -> SQLite domain storage + snapshot compatibility`

This is the real architecture of the repository today.

## Frontend Layers

### UI Layer

Primary folders:

- `src/components`
- `src/features`
- `src/App.tsx`

Responsibilities:

- layout
- toolbar and sidebars
- editor canvas and minimap
- region inspector
- status and toast UI

UI components should stay presentation-oriented and should not become persistence or provider layers.

Feature-level hooks and pure helpers are an acceptable boundary when a component starts accumulating file I/O, queue targeting, or multi-store orchestration.

### State Layer

Primary folders:

- `src/stores`
- `src/hooks`

Key stores:

- `useProjectStore`
- `useProjectDomainStore`
- `usePageStore`
- `useRegionStore`
- `useJobStore`
- `useProjectLibraryStore`
- `useHistoryStore`
- `useEditorStore`
- `usePersistenceStore`
- `useDiagnosticsStore`

Responsibilities:

- editor state
- selection state
- queue state
- UI toggles and runtime status
- orchestration of user actions

### Service Layer

Primary folders:

- `src/services`

Current responsibilities:

- OCR and translation execution entry points
- queued job execution and pipeline-stage dispatch
- project sync before pipeline actions
- job result summarization
- rendered export helper logic
- diagnostics formatting

Services should contain pipeline behavior, not React component logic.

Stage 4 note:

- `useJobStore` should orchestrate queue state, retries, and user intent
- provider/repository-heavy execution paths should live in service modules such as `src/services/jobExecution.ts`
- component-adjacent orchestration such as toolbar actions or target derivation can live in feature hooks/helpers such as `src/features/toolbar/useToolbarActions.ts` and `src/features/toolbar/toolbarTargets.ts`

### Repository Layer

Primary folders:

- `src/repositories`
- `src/storage`

Responsibilities:

- DB-backed CRUD access
- merge and sync between runtime state and normalized storage
- browser fallback persistence
- project load/save envelope handling

Repositories are the persistence boundary and should remain the single way domain state touches storage.

## Desktop Backend

Primary folder:

- `src-tauri`

Key modules:

- `src-tauri/src/main.rs`
- `src-tauri/src/storage.rs`
- `src-tauri/src/domain_storage.rs`
- `src-tauri/src/ocr.rs`
- `src-tauri/src/translation.rs`

Responsibilities:

- Tauri command registration
- normalized SQLite persistence
- OCR provider execution
- translation provider execution
- project recovery and backup logic

## Domain Model

Core normalized entities:

- `projects`
- `pages`
- `regions`
- `jobs`
- `project_settings`
- `text_styles`

Key rule:

DB-backed domain state is the primary source of truth for pipeline-relevant data.

## Persistence Reality

### What Is DB-First

- project metadata
- pages
- regions
- jobs
- project settings
- text styles
- OCR metadata
- translation metadata

### What Still Uses Compatibility Paths

- project file import/export envelope
- snapshot-assisted recovery fallback
- some reconstructed UI context

### Known Limitation

Page assets are still effectively data-URL heavy rather than fully durable filesystem assets.

## Pipeline Boundaries

### OCR

Flow:

1. UI queues OCR job
2. current editor state is synced
3. OCR runs by page or region target
4. backend/provider writes results into `regions`
5. frontend refreshes domain-backed region state

### Translation

Flow:

1. UI queues translation job
2. current editor state is synced
3. translation provider runs by page or region target
4. backend/service writes results into `regions`
5. frontend refreshes domain-backed region state

### Rendered Export

Flow:

1. current state is synced to repositories
2. export reads page, regions, settings, and text styles from storage
3. translated overlays are rendered onto page image
4. PNG is saved through Tauri or browser save path

## Current Architectural Rules

- UI should not talk to SQLite directly
- providers should not mutate React state directly
- stores should not become mini-backends
- persistence logic belongs in repositories/storage modules
- stage-specific scope changes must be recorded in project docs and decisions
