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
