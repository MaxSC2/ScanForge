# Stage Gate — ScanForge

## Purpose

Defines when a stage can be considered complete.

---

## Core rule

A stage is complete only if:
system is stable, predictable, and verified.

---

## Required checks

### 1. Build
- app builds successfully (Tauri + frontend)
- no critical runtime errors

Required commands:
- `npm run build`
- `cargo check`
- `npm run test`

---

### 2. Pipeline validation
- OCR works without crashes
- translation pipeline runs end-to-end
- export produces correct output

---

### 3. Data integrity
- projects load correctly
- autosave works
- recovery works after restart/crash

---

### 4. Error handling
- failures do not crash the app
- errors are visible (logs / diagnostics)

---

### 5. Observability
- diagnostics trail works
- failures can be traced

---

### 6. Manual verification
- open project → edit → OCR → translate → export
- repeat flow multiple times
- run the affected scenario in Tauri desktop mode when the slice depends on desktop integrations

---

### 7. No silent regressions

Critical rule:
- nothing previously working is silently broken

If regression found:
- stage is NOT complete

---

## Docs update required

Before closing stage:
- CURRENT_STAGE.md updated
- DECISIONS.md updated (if needed)
- ROADMAP.md adjusted (if needed)
- ARCHITECTURE.md updated if the system shape changed
- PROVIDER_STRATEGY.md updated if OCR/translation behavior changed materially
- TESTING_STRATEGY.md updated if verification expectations changed materially

---

## Final condition

Stage is closed only when:
- system behaves predictably
- no critical instability remains
