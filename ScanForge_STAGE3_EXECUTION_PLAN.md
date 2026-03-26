# ScanForge - Stage 3 Execution Plan
## Translation Pipeline + Real OCR Integration + Final Render Foundation

Date: 2026-03-26
Baseline branch: `stage-2-domain-refactor`
Next working branch: `stage-3-pipeline-foundation`

---

# 1. Executive Goal

Stage 2 moved ScanForge from snapshot-first storage to a normalized domain-backed local editor foundation. Core entities now live in normalized SQLite tables, OCR/job flow already uses repository-backed persistence, and the app is no longer just a shell.

Stage 3 goal:

`Pages + Regions + Jobs + OCR preview`
`->`
`Real OCR + Translation Drafts + Final Render Path`

This stage must produce the first architecture that can eventually support the product promise:

`RAW -> OCR -> Translation -> Cleaning -> Redraw -> Typesetting -> QC -> Export`

---

# 2. What Stage 3 Is

Stage 3 is not the "add every missing feature" phase.

Stage 3 is the phase that adds the first real pipeline layers on top of the stabilized domain/storage foundation:

1. replace mock/preview OCR with a real OCR integration path
2. add a real translation domain path
3. add a final rendered export foundation
4. keep everything local-first
5. avoid breaking the editor UX that is already strong

---

# 3. What Stage 3 Is Not

Do not do these in this stage:

- full cleaning/redraw toolset
- full typesetting studio
- full QC system
- FastAPI split unless absolutely required
- action-history rewrite
- collaboration/cloud sync
- asset storage overhaul beyond what is needed for OCR/export
- broad UI redesign

If you start adding cosmetic tools, fancy panels, or secondary workflows now, you are wasting time and reintroducing architectural chaos.

---

# 4. Baseline Reality From Stage 2

Current repo state after Stage 2:

- normalized SQLite tables exist for `projects`, `pages`, `regions`, `jobs`
- repository layer is in place
- OCR/jobs already route through storage
- the editor/viewer UX is strong
- snapshot JSON is no longer the primary backbone, but still exists as compatibility/backup support
- OCR is still mock/preview only
- translation, final render, typesetting, QC are not built yet

So Stage 3 should not fight the Stage 2 architecture. It should extend it.

---

# 5. Stage 3 Primary Objective

Ship the first true production pipeline slice:

Input: imported page + regions
Processing: real OCR -> translation draft generation
Output: stored translation results + first final-rendered export path

If Stage 3 is successful, the project will still not be the full product, but it will stop being "editor foundation only" and become "pipeline-capable editor foundation".

---

# 6. Stage 3 Deliverables

Stage 3 must deliver all of the following:

## 6.1 Real OCR vertical slice
- replace preview OCR implementation with a real OCR integration path
- store OCR confidence and OCR metadata per region
- allow rerun per page or selected regions
- keep OCR job persistence through `jobs`

## 6.2 Translation domain slice
- introduce translation jobs
- introduce translation provider abstraction
- store translation draft and translation state in DB
- support source language / target language in project settings
- support rerun translation on page or selected regions

## 6.3 Final render foundation
- build a renderer that composes a page from:
  - source page image
  - region visibility state
  - translated text overlays
  - basic text style info
- export the composed page as PNG
- make export mean "rendered result", not "original source image"

## 6.4 Domain completion for Stage 3
- close the minimum schema gaps required for OCR/translation/render
- reduce snapshot fallback dependence for region/editor metadata that is now critical

---

# 7. Stage 3 Architecture Principle

Do not jump to a multi-service architecture yet just because the original docs mention FastAPI.

Current practical architecture after Stage 2 is:

`React UI -> Zustand stores -> repositories -> Tauri commands / adapters -> SQLite`

That is good enough for Stage 3.

Rule:
Stay Tauri-local unless a concrete OCR or translation integration forces a split.

The target of this stage is pipeline capability, not architecture cosplay.

---

# 8. Stage 3 Workstreams

Stage 3 should be split into 5 workstreams:

1. Domain & schema completion
2. Real OCR integration
3. Translation pipeline
4. Final render/export foundation
5. Verification and stabilization

---

# 9. Workstream A - Domain & Schema Completion

## 9.1 Goal
Make the normalized model rich enough for OCR, translation, and final render without leaning on snapshot fallback for important pipeline data.

## 9.2 Required Region Model expansion

Current Region still lacks some real production fields or stores them only partially. Stage 3 must expand it.

## Target Region shape
```ts
type Region = {
  id: string
  pageId: string

  // geometry
  x: number
  y: number
  width: number
  height: number
  rotation: number

  // identity / organization
  label: string
  kind: 'speech' | 'sfx' | 'narration' | 'other'
  order: number
  orientation: 'horizontal' | 'vertical'

  // OCR
  sourceText: string
  sourceLanguage?: string
  ocrStatus: 'idle' | 'queued' | 'running' | 'done' | 'failed'
  ocrConfidence?: number
  ocrEngine?: string
  ocrUpdatedAt?: number

  // Translation
  translatedText: string
  targetLanguage?: string
  translationStatus: 'idle' | 'queued' | 'running' | 'done' | 'failed'
  translationProvider?: string
  translationUpdatedAt?: number

  // review/editor
  notes: string
  locked: boolean
  visible: boolean

  // rendering / style (minimal Stage 3 version)
  textStyleId?: string
}
```

## 9.3 New or expanded domain entities

### TextStyle
```ts
type TextStyle = {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  align: 'left' | 'center' | 'right'
  fill: string
  stroke: string
  strokeWidth: number
}
```

### ProjectSettings
```ts
type ProjectSettings = {
  projectId: string
  sourceLanguage: 'ja' | 'zh' | 'ko' | 'en' | 'auto'
  targetLanguage: 'ru' | 'en'
  ocrEngine: 'mock' | 'tesseract' | 'paddle' | 'manga-ocr'
  translationProvider: 'mock' | 'local' | 'remote'
  defaultTextStyleId?: string
}
```

### Job
Expand jobs to include payload/result metadata:
```ts
type Job = {
  id: string
  type: 'OCR' | 'TRANSLATE'
  status: 'queued' | 'running' | 'done' | 'failed'
  projectId: string
  pageId?: string
  regionIds?: string[]
  progress: number
  createdAt: number
  updatedAt: number
  summary?: string
  error?: string
}
```

## 9.4 SQLite schema additions

Add tables or columns for:
- `project_settings`
- `text_styles`
- expanded `regions`
- expanded `jobs`

### Suggested schema extension
```sql
ALTER TABLE regions ADD COLUMN label TEXT DEFAULT '';
ALTER TABLE regions ADD COLUMN kind TEXT DEFAULT 'speech';
ALTER TABLE regions ADD COLUMN region_order INTEGER DEFAULT 0;
ALTER TABLE regions ADD COLUMN orientation TEXT DEFAULT 'horizontal';
ALTER TABLE regions ADD COLUMN source_language TEXT;
ALTER TABLE regions ADD COLUMN ocr_status TEXT DEFAULT 'idle';
ALTER TABLE regions ADD COLUMN ocr_engine TEXT;
ALTER TABLE regions ADD COLUMN ocr_updated_at INTEGER;
ALTER TABLE regions ADD COLUMN target_language TEXT;
ALTER TABLE regions ADD COLUMN translation_status TEXT DEFAULT 'idle';
ALTER TABLE regions ADD COLUMN translation_provider TEXT;
ALTER TABLE regions ADD COLUMN translation_updated_at INTEGER;
ALTER TABLE regions ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE regions ADD COLUMN text_style_id TEXT;

CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT PRIMARY KEY,
  source_language TEXT NOT NULL DEFAULT 'auto',
  target_language TEXT NOT NULL DEFAULT 'ru',
  ocr_engine TEXT NOT NULL DEFAULT 'mock',
  translation_provider TEXT NOT NULL DEFAULT 'mock',
  default_text_style_id TEXT
);

CREATE TABLE IF NOT EXISTS text_styles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  font_family TEXT NOT NULL,
  font_size REAL NOT NULL,
  line_height REAL NOT NULL,
  letter_spacing REAL NOT NULL,
  align TEXT NOT NULL,
  fill TEXT NOT NULL,
  stroke TEXT NOT NULL,
  stroke_width REAL NOT NULL
);
```

## 9.5 Acceptance criteria for Workstream A
- region metadata critical for OCR/translation/render no longer depends on snapshot fallback
- project language settings exist and persist
- text style records exist and can be referenced by regions
- job payload/result fields persist enough info for OCR/translation flows

---

# 10. Workstream B - Real OCR Integration

## 10.1 Goal
Replace the mock OCR backend with an implementation path that can later be improved without rewriting the editor or job pipeline.

## 10.2 Stage 3 OCR strategy
Do not aim for "perfect OCR".
Aim for "real OCR path with replaceable engine interface".

## 10.3 OCR provider interface

Create a provider abstraction:

```ts
type OcrInput = {
  pageId: string
  imagePath: string
  regions: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    orientation: 'horizontal' | 'vertical'
  }>
  sourceLanguage: string
}

type OcrResult = Array<{
  regionId: string
  text: string
  confidence?: number
  engine: string
}>
```

### Interface
```ts
interface OcrProvider {
  run(input: OcrInput): Promise<OcrResult>
}
```

## 10.4 Initial real OCR implementation choice
Use the easiest real OCR path that can run locally. The priority is architecture, not best-in-class recognition.

Practical order:
1. Tesseract-based local prototype or equivalent OCR adapter
2. then later swap/upgrade to better OCR
3. keep provider interface stable

## 10.5 OCR workflow requirements
- OCR by page
- OCR by selected regions
- skip locked regions
- allow overwrite or "fill only empty regions"
- persist `ocrStatus`, `ocrConfidence`, `sourceText`
- write results through repositories, not direct store mutation

## 10.6 OCR backend behavior
The backend should:
1. fetch page image and regions from storage
2. crop region images
3. run OCR provider
4. persist results to `regions`
5. update `jobs`

## 10.7 OCR UI requirements
Add minimal settings:
- run OCR page
- run OCR selected
- rerun OCR
- toggle fill-empty-only
- show confidence in inspector

## 10.8 Acceptance criteria for Workstream B
- OCR no longer returns synthetic placeholder text
- page OCR writes real recognized text into `sourceText`
- OCR job results survive restart
- inspector can show OCR confidence when available
- OCR path is provider-based, not hardcoded into editor logic

---

# 11. Workstream C - Translation Pipeline

## 11.1 Goal
Create the first true translation path built on top of normalized storage and persisted jobs.

## 11.2 Translation is not typesetting
Stage 3 translation means:
- generate translation drafts
- persist them
- expose them in inspector and region list
- allow rerun and manual edit

It does not mean full text styling or final polished lettering.

## 11.3 Translation provider abstraction

```ts
type TranslationInput = {
  projectId: string
  sourceLanguage: string
  targetLanguage: string
  items: Array<{
    regionId: string
    text: string
    kind: string
    notes?: string
  }>
}

type TranslationResult = Array<{
  regionId: string
  translatedText: string
  provider: string
}>
```

### Interface
```ts
interface TranslationProvider {
  translate(input: TranslationInput): Promise<TranslationResult>
}
```

## 11.4 Initial translation provider strategy
Stage 3 should support at least:
- `mock` provider for fallback/testing
- one real provider path or local integration hook

The real point is:
- translation jobs exist
- translation results persist
- provider can later be swapped

## 11.5 Translation workflow requirements
- translate page
- translate selected regions
- skip locked regions
- skip empty `sourceText`
- persist `translatedText`
- persist `translationStatus` and provider name
- preserve manual edits unless user chooses overwrite

## 11.6 Translation UI requirements
Minimal but real:
- source language selector
- target language selector
- translation provider selector
- run translation
- rerun translation selected/page
- "overwrite existing translations" toggle

## 11.7 Acceptance criteria for Workstream C
- translation jobs exist and persist like OCR jobs
- translated text is stored in DB and survives reload
- inspector shows editable translated text
- translation can run on page or selected regions
- provider is abstracted, not hardcoded into UI/store

---

# 12. Workstream D - Final Render / Export Foundation

## 12.1 Goal
Make export meaningful.

Current export still behaves like source image export, which means the app is not yet producing final output.

Stage 3 must create the first composed render path.

## 12.2 Render scope for Stage 3
Stage 3 final render should support:
- source page image
- region visibility
- translated text overlays
- basic text style application
- export rendered page as PNG

That is enough to establish the pipeline. It does not need full redraw or advanced typesetting yet.

## 12.3 Render engine inputs
```ts
type RenderPageInput = {
  page: Page
  regions: Region[]
  styles: TextStyle[]
  includeHidden?: boolean
}
```

## 12.4 Render rules
- only visible regions render
- only regions with `translatedText` render translated text
- style resolution:
  1. region `textStyleId`
  2. project default text style
  3. fallback style
- honor geometry bounds
- center-align by default if no style override
- basic auto-fit is acceptable
- no advanced speech-bubble contouring yet

## 12.5 Export requirements
- export active page as rendered PNG
- stitched export may remain source-based unless render stitching is easy
- export path must clearly distinguish:
  - source export
  - rendered export

## 12.6 Acceptance criteria for Workstream D
- exported page is visibly different from the original when translated regions exist
- rendered export uses stored translated text and style data
- exported result survives app restart and re-export consistency checks
- export pipeline works from DB-backed domain state, not only current in-memory UI state

---

# 13. Workstream E - Verification and Stabilization

## 13.1 Goal
Prevent the new pipeline from becoming a brittle mess.

## 13.2 Required checks
At minimum add verification around:
- repository CRUD
- OCR job lifecycle
- translation job lifecycle
- page restore after restart
- rendered export path

## 13.3 Minimum quality bar
Even without full test coverage, Stage 3 should include:
- manual verification checklist
- repeatable smoke test flow
- no silent job failures
- toast/error reporting for failed OCR/translation
- migration compatibility with Stage 2 projects

## 13.4 Acceptance criteria for Workstream E
- Stage 2 project loads without losing pages/regions
- OCR still works after migration
- translation works after migration
- rendered export works on migrated project
- build remains passing

---

# 14. Store and Repository Rules for Stage 3

## 14.1 Store responsibilities
Do not let stores become mini-backends.

### Stores may:
- hold UI state
- hold current editor state
- trigger repository-backed workflows
- reflect current selected page/region/job

### Stores may not:
- implement OCR directly
- implement translation logic directly
- become the primary persistence engine
- own duplicated hidden copies of domain data unnecessarily

## 14.2 Repository responsibilities
Repositories must be the persistence boundary:
- fetch domain entities
- create/update/delete entities
- sync job states
- provide hydration for stores

## 14.3 Tauri command responsibilities
Tauri backend should:
- run OCR
- run translation provider call if local/backend-driven
- render export if backend-based
- update repositories through storage layer

---

# 15. Required File/Module Additions

## 15.1 Frontend
Expected new files or equivalents:
```text
src/repositories/projectSettingsRepository.ts
src/repositories/textStyleRepository.ts
src/features/settings/ProjectSettingsPanel.tsx
src/features/jobs/translationJobs.ts
src/features/export/renderExport.ts
src/types/projectSettings.ts
src/types/textStyle.ts
src/types/translation.ts
src/types/ocr.ts
```

## 15.2 Backend / Tauri
Expected new modules or equivalents:
```text
src-tauri/src/ocr/
src-tauri/src/translation/
src-tauri/src/render/
src-tauri/src/repositories/
src-tauri/src/migrations/
```

---

# 16. Branching Plan

Recommended branch breakdown:

- `stage-3-pipeline-foundation` - umbrella branch
- `feature/stage3-domain-completion`
- `feature/stage3-real-ocr`
- `feature/stage3-translation`
- `feature/stage3-render-export`
- `feature/stage3-verification`

Do not build all of Stage 3 in one dirty branch unless you want future-you to develop trust issues.

---

# 17. AI Team Task Split

## Codex
Give Codex:
- repository/data-model refactors
- Tauri backend integration
- OCR/translation provider contracts
- render/export path

## Qwen
Give Qwen:
- alternative repository/store implementations
- translation pipeline wiring
- migration safety checks
- schema refinement proposals

## Gemini
Give Gemini:
- settings panel UX
- inspector extensions for OCR/translation/style
- job panel UX
- export UI polish

## Rule
Never let all three mutate the same persistence layer at once.

---

# 18. Manual Verification Checklist

Stage 3 is acceptable only if this full flow works:

1. Create or load project
2. Import pages
3. Create/edit regions
4. Save and restart app
5. Confirm pages/regions/jobs restore
6. Run real OCR on selected page
7. Confirm `sourceText` updates
8. Run translation on selected page
9. Confirm `translatedText` updates
10. Edit translation manually
11. Export rendered PNG
12. Confirm output contains translated overlay
13. Reload project and export again
14. Confirm results are stable

If this does not work end-to-end, Stage 3 is not done.

---

# 19. Explicit Done Definition

Stage 3 is done when all of the following are true:

- normalized domain storage remains the core source of truth
- real OCR replaces preview OCR
- translation jobs exist and persist
- translated text survives reload
- project settings include source/target language and providers
- rendered export produces composed page output
- build remains green
- Stage 2 projects still load

---

# 20. Anti-Scope Rules

Do not do these before Stage 3 is complete:
- fancy cleaning brushes
- redraw AI
- advanced typography presets
- speech-bubble-aware layout engine
- QC dashboards
- FastAPI split "just because"
- cloud sync
- plugin systems

Stage 3 is about pipeline legitimacy, not feature inflation.

---

# 21. Final Priority Order

This is the exact execution order recommended:

1. Domain/schema completion
2. Project settings + text style persistence
3. Real OCR provider integration
4. Translation provider integration
5. Translation jobs + inspector wiring
6. Final rendered export foundation
7. Verification and stabilization

If you change this order, make sure you have a real reason and not just enthusiasm.

---

# 22. Final Assessment

Stage 2 gave ScanForge a serious local-first editor foundation with normalized persistence and repository architecture.

Stage 3 should now make the product pipeline-real for the first time.

The correct one-line mission for this stage is:

**Replace mock OCR and source-only export with a real OCR -> translation -> rendered output pipeline built on the normalized domain model.**
