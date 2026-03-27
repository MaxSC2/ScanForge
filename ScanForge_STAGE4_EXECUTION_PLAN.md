# ScanForge - Stage 4 Execution Plan
## Production Hardening

Date: 2026-03-27
Baseline branch: `stage-3-pipeline-foundation`
Next working branch: `stage-4-production-hardening`

---

# 1. Executive Goal

Stage 3 made ScanForge pipeline-real for the first time:

`Import -> OCR -> Translation -> Rendered Export`

Stage 4 goal:

Turn that pipeline from "it works" into "it is stable, debuggable, recoverable, and usable for real repeated work".

This stage is about production hardening, not feature inflation.

The one-line mission for Stage 4 is:

**Make ScanForge resilient enough for repeated daily use without fragile pipeline behavior, silent failures, or avoidable data loss.**

---

# 2. What Stage 4 Is

Stage 4 is the hardening phase that should improve:

1. stability of OCR and translation workflows
2. crash safety and editor recovery
3. render/export reproducibility
4. canvas performance on larger pages and larger region counts
5. architectural readiness for future providers and plugins
6. developer observability and debugging speed

---

# 3. What Stage 4 Is Not

Do not do these in this stage unless they are directly required to stabilize existing systems:

- full cleaning/redraw toolkit
- full typesetting studio
- QC dashboard system
- collaboration or cloud sync
- plugin marketplace UX
- cosmetic redesign work
- unrelated editor features
- major product-scope expansion

If Stage 4 turns into "add cool features", it will fail its purpose.

---

# 4. Baseline Reality From Stage 3

At the end of Stage 3, the repository already has:

- normalized domain-backed persistence
- repository layer
- project settings and text styles
- OCR jobs and translation jobs
- real Windows OCR path
- draft translation pipeline
- rendered PNG export
- manual verification pass for the Stage 3 scope

But important weaknesses still remain:

- OCR provider coverage is incomplete
- translation quality and provider resilience are still limited
- job/result handling can still be hardened
- autosave/recovery behavior should become more explicit and safer
- export reproducibility should be treated as a first-class guarantee
- canvas/runtime performance at larger scale has not been deeply hardened
- automated coverage is still shallow

So Stage 4 should improve reliability, not rewrite the product direction.

---

# 5. Stage 4 Primary Objective

Ship the first truly dependable working foundation for real repeated chapter work.

Input:
- imported or restored project

Processing:
- OCR
- translation
- manual editing
- rendered export

Output:
- predictable, recoverable, repeatable pipeline behavior

If Stage 4 succeeds, ScanForge will still not be the full long-term product, but it will become much harder to break during normal use.

---

# 6. Stage 4 Workstreams

Stage 4 should be executed in 7 workstreams:

1. OCR Pipeline v2
2. Translation System v2
3. Editor Stability
4. Canvas Performance
5. Export System v2
6. Error Handling and Observability
7. Architecture Readiness

---

# 7. Workstream A - OCR Pipeline v2

## 7.1 Goal

Make OCR resilient, restartable, and less dependent on a single fragile path.

## 7.2 Required outcomes

- provider-based multi-engine OCR fallback
- confidence-aware OCR state
- targeted re-OCR for page or region
- retry behavior that does not corrupt region state
- explicit failure reporting

## 7.3 Target direction

Preferred engine order:

1. MangaOCR or equivalent high-quality manga-focused path
2. PaddleOCR or equivalent fallback path
3. existing preview/mock fallback only as a last safety net

## 7.4 Required capabilities

- OCR selected page
- OCR selected region(s)
- retry failed OCR jobs
- skip locked regions
- support fill-empty-only and overwrite modes
- persist confidence and engine metadata
- surface OCR failures in the jobs panel and logs

## 7.5 Done when

- OCR no longer depends on one brittle provider path
- users can re-run OCR precisely where needed
- OCR failures are recoverable and visible
- OCR does not silently damage region data

---

# 8. Workstream B - Translation System v2

## 8.1 Goal

Make translation resilient, consistent, and provider-independent.

## 8.2 Required outcomes

- provider abstraction that can support OpenAI, Claude, or local models
- retry and fallback behavior
- translation memory or cache for repeated phrases
- glossary enforcement support
- more explicit overwrite and preservation rules

## 8.3 Required capabilities

- provider chain or fallback order
- stable handling of repeated text
- persistence of translation source/provider metadata
- cache hits for repeated phrases where appropriate
- no silent replacement of manual edits

## 8.4 Done when

- translation is not coupled to a single provider path
- repeated phrases can resolve consistently
- fallback/retry behavior is explicit
- user edits are preserved unless overwrite is intentionally enabled

---

# 9. Workstream C - Editor Stability

## 9.1 Goal

Make it difficult for the user to lose work.

## 9.2 Required outcomes

- stronger undo/redo behavior
- clearer autosave and recovery behavior
- safer snapshot/recovery strategy
- crash-safe restoration path

## 9.3 Required capabilities

- reliable editor-state history
- project recovery after interrupted session
- explicit restoration of the last valid project state
- protection against partially written or corrupted state

## 9.4 Done when

- users cannot casually lose meaningful work
- restart and recovery feel trustworthy
- crash or forced close does not create panic-level data loss risk

---

# 10. Workstream D - Canvas Performance

## 10.1 Goal

Keep the editor responsive on heavier pages and larger region counts.

## 10.2 Required outcomes

- virtualized or more selective rendering
- region culling where appropriate
- minimap optimization
- zoom and pan performance fixes

## 10.3 Required capabilities

- acceptable interaction with 100+ regions on a page
- smoother zoom/pan behavior
- less unnecessary redraw work
- reduced UI lag in inspector-heavy or overlay-heavy scenarios

## 10.4 Done when

- large pages do not make the editor feel broken
- region overlays and canvas interaction remain usable at scale

---

# 11. Workstream E - Export System v2

## 11.1 Goal

Make rendered export reproducible and trustworthy.

## 11.2 Required outcomes

- deterministic export behavior
- batch export queue
- export validation
- explicit distinction between success, partial success, and failure

## 11.3 Required capabilities

- same input state produces the same rendered output
- batch export for multiple pages
- validation for missing translated text, invalid styles, or broken page assets
- clearer export error reporting

## 11.4 Done when

- export is reproducible
- batch export is possible
- broken output does not appear silently

---

# 12. Workstream F - Error Handling and Observability

## 12.1 Goal

Make failures visible, understandable, and debuggable.

## 12.2 Required outcomes

- global error boundary
- user-friendly error UI
- structured logging
- better diagnostic trail for OCR, translation, export, and recovery failures

## 12.3 Required capabilities

- app-level catch for unexpected UI/runtime failures
- non-silent job failures
- structured logs for critical pipeline actions
- enough context to reproduce user-reported problems

## 12.4 Done when

- errors do not casually destroy UX
- debugging a failure no longer depends on guesswork

---

# 13. Workstream G - Architecture Readiness

## 13.1 Goal

Prepare the codebase for future providers, plugins, and larger feature layers without turning the app into a pile of tightly coupled code.

## 13.2 Required outcomes

- cleaner separation of domain, services, and UI
- less logic buried inside components
- clearer provider boundaries
- safer module ownership

## 13.3 Required capabilities

- UI components stay presentation-oriented
- domain logic remains outside component tree
- service/provider contracts are explicit
- future extension points are clearer than they are today

## 13.4 Done when

- the codebase reads like a system instead of accumulated feature patches
- future Stage 5+ work will not need another avoidable cleanup pass first

---

# 14. Dev Experience

Stage 4 should improve internal development speed as part of hardening.

Required improvements:

- better dev scripts
- logging helpers
- debug panel or equivalent developer diagnostics
- faster reproduction path for common failures

Done when:

- diagnosing OCR, translation, export, or recovery issues is materially faster

---

# 15. Exit Criteria

Stage 4 is complete when:

- the app does not regularly break during normal project work
- pipeline failures are surfaced clearly and can be retried or recovered
- import -> OCR -> translation -> edit -> export is stable across repeated use
- users are protected against common work-loss scenarios
- export is reproducible
- large pages and larger region counts remain usable
- debugging information is sufficient for real maintenance

---

# 16. Verification Requirements

Stage 4 should not be closed without a dedicated verification pass covering:

1. OCR retry and fallback behavior
2. translation retry and provider fallback behavior
3. autosave and recovery after restart
4. crash-safe restoration scenarios
5. large-page canvas interaction
6. deterministic re-export checks
7. batch export validation
8. error surfacing in jobs panel and logs

---

# 17. Final Priority Order

Recommended execution order:

1. OCR Pipeline v2
2. Translation System v2
3. Editor Stability
4. Error Handling and Observability
5. Export System v2
6. Canvas Performance
7. Architecture Readiness

If this order changes, it should be because of a clear dependency, not just convenience.

---

# 18. Final Assessment

If Stage 3 meant:

`it works`

then Stage 4 should mean:

`it keeps working under pressure`

The correct one-line mission for this stage is:

**Turn ScanForge from a verified pipeline foundation into a reliable daily-use production foundation.**
