# Provider Strategy

## Purpose

Define how OCR and translation providers should be selected, integrated, and evolved without coupling the product to one fragile implementation path.

## Current Reality

### OCR

Implemented today:

- real desktop OCR on Windows via WinRT
- browser preview fallback
- provider-chain fallback behavior in the Tauri OCR path

Current status:

- `windows` is the only real production-grade provider path in the repo today
- `mock` is the preview safety-net path
- `manga-ocr`, `paddle`, and `tesseract` are strategy targets, not completed provider integrations

### Translation

Implemented today:

- `local` draft translation provider
- `mock` preview provider
- persisted provider metadata in project settings and region translation state

Current status:

- translation architecture is provider-ready
- translation quality is still draft-level
- no external model-backed provider is production-ready in the repo yet

## Selection Rules

Provider selection comes from project settings.

Current settings should determine:

- OCR engine
- source language
- translation provider
- target language

The app must not hardcode provider choice inside UI components.

## OCR Strategy

### Preferred Long-Term Order

1. manga-focused OCR provider
2. general high-quality fallback OCR provider
3. preview/mock fallback only as a safety net

### Current Effective Order

Desktop:

- configured engine
- provider fallback chain
- preview fallback if no real provider succeeds

Browser:

- preview fallback only

### OCR Rules

- OCR must support page and region targeting
- OCR must support fill-empty-only and overwrite behavior
- OCR must not silently destroy manual text
- OCR failures must be visible in Jobs and diagnostics
- OCR metadata must persist per region

Persisted OCR metadata includes:

- `sourceText`
- `sourceLanguage`
- `ocrStatus`
- `ocrEngine`
- `ocrUpdatedAt`
- `ocrConfidence`

## Translation Strategy

### Preferred Long-Term Direction

1. high-quality model-backed provider
2. deterministic fallback provider
3. preview/mock fallback only for safety or offline development

### Current Effective Order

- configured translation provider
- local/mock draft behavior depending on environment and implementation path

### Translation Rules

- translation must be provider-independent at the service boundary
- manual translated text must not be silently overwritten
- overwrite should be explicit and opt-in
- repeated phrases should eventually support cache or memory behavior
- failures must be visible in Jobs and diagnostics

Persisted translation metadata includes:

- `translatedText`
- `targetLanguage`
- `translationStatus`
- `translationProvider`
- `translationUpdatedAt`

## Provider Contract Rules

Any provider integration should respect these rules:

- input comes from domain-backed state, not arbitrary UI snapshots
- output writes through service/repository boundaries
- provider name and important metadata must be persisted
- failures must return structured, inspectable information
- retry must be safe and not corrupt region state

## Near-Term Stage 4 Priority

The next provider work should focus on:

- stronger OCR provider resilience and clearer fallback behavior
- first real translation fallback chain
- explicit manual-edit preservation policy
- clearer provider diagnostics and failure visibility

## Non-Goals Right Now

- cloud provider sprawl without stable contracts
- provider-specific UI coupling
- hidden fallback behavior that users cannot understand
