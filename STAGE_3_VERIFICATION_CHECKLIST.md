# ScanForge Stage 3 Verification Checklist

Date: 2026-03-26
Branch baseline: `stage-3-pipeline-foundation`

## 1. Goal

This checklist verifies the first complete Stage 3 pipeline slice:

`load -> OCR -> translation -> rendered export -> reload -> re-export`

The checklist is considered successful only if the app behaves consistently across the full flow and the exported result visibly reflects stored translated text.

## 2. Automated Smoke Checks

Run these before manual verification:

1. `npm run build`
2. `cargo check` in `src-tauri`
3. `npm run test`

Expected result:

- all commands exit successfully
- no TypeScript or Rust compile failures
- smoke tests for translation draft helpers and render helper logic pass

## 3. Manual Verification Flow

### 3.1 Project creation and restore

1. Launch the app.
2. Create a new local project.
3. Import at least one page image.
4. Confirm the project appears in the local project library.
5. Restart the app.
6. Confirm the same project restores with pages intact.

Expected:

- project is restored automatically
- page list survives restart
- no jobs are lost or corrupted during restore

### 3.2 Region editing

1. Draw at least two regions on the page.
2. Rename one region.
3. Change order or geometry for one region.
4. Add notes to one region.
5. Lock one region and leave another unlocked.

Expected:

- region metadata persists
- locked and visible states survive reload
- inspector shows the edited values

### 3.3 OCR pipeline

1. Set OCR engine to `Windows OCR` if running in Tauri on Windows.
2. Run OCR for the active page.
3. Wait for the OCR job to complete.
4. Check inspector metadata for at least one region.
5. Restart the app.

Expected:

- OCR job appears in the jobs panel
- `sourceText` is filled for unlocked, empty regions
- locked regions are skipped
- OCR metadata such as status and engine persists after restart

### 3.4 Translation pipeline

1. Set target language in project settings.
2. Run translation for the active page.
3. Confirm a translation job appears and completes.
4. Confirm `translatedText` is written into the regions.
5. Manually edit one translated region in the inspector.
6. Restart the app.

Expected:

- translation job persists and completes
- translated text survives restart
- manual edit is preserved
- translation metadata persists

### 3.5 Rendered export

1. Ensure at least one visible region has non-empty `translatedText`.
2. Trigger `Render PNG` from the toolbar.
3. Save the output image.
4. Open the exported PNG outside the app.
5. Confirm the exported image visibly includes translated text overlays.

Expected:

- export is not identical to the raw source page when translated regions exist
- text uses stored translated content
- hidden regions do not render

### 3.6 Reload and export consistency

1. Restart the app after a successful rendered export.
2. Re-open the same project.
3. Export the same page again.
4. Compare the two exported files visually.

Expected:

- second export is consistent with the first
- no translated text is lost on reload
- no style fallback regression is visible between exports

## 4. Migration Safety Check

Use an older Stage 2 project if available.

1. Open a Stage 2 project snapshot.
2. Confirm pages and regions are present.
3. Run OCR.
4. Run translation.
5. Export rendered PNG.

Expected:

- Stage 2 project loads without data loss
- OCR and translation still work after migration
- rendered export works on migrated data

## 5. Failure Cases To Check

At minimum verify these negative scenarios:

1. OCR on a page with no regions should fail clearly.
2. Translation on a page with empty source text should skip cleanly.
3. Locked regions should not be overwritten by OCR or translation.
4. Re-running translation with overwrite disabled should preserve manual edits.
5. Job failures should surface in the jobs panel and not fail silently.

## 6. Sign-Off Rule

Stage 3 verification is acceptable only when:

- automated smoke checks pass
- the full manual pipeline flow passes
- migration safety check passes
- no silent job failures occur

If any item fails, Stage 3 remains open and the failing step should be documented before further feature work continues.
