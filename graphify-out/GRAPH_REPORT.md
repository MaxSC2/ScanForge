# Graph Report - .  (2026-07-07)

## Corpus Check
- 228 files · ~167,733 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 276 nodes · 1012 edges · 17 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Domain Repository (CRUD)|Domain Repository (CRUD)]]
- [[_COMMUNITY_Delete Operations|Delete Operations]]
- [[_COMMUNITY_Translation Pipeline|Translation Pipeline]]
- [[_COMMUNITY_OCR Request Building|OCR Request Building]]
- [[_COMMUNITY_Job & Region Listing|Job & Region Listing]]
- [[_COMMUNITY_Image & OCR IO|Image & OCR I/O]]
- [[_COMMUNITY_OCR Result Processing|OCR Result Processing]]
- [[_COMMUNITY_Database Row Mapping|Database Row Mapping]]
- [[_COMMUNITY_Diagnostics & Text Styles|Diagnostics & Text Styles]]
- [[_COMMUNITY_Preview OCR Engine|Preview OCR Engine]]
- [[_COMMUNITY_Ollama Provider|Ollama Provider]]
- [[_COMMUNITY_AI Agent Tools & Dispatcher|AI Agent Tools & Dispatcher]]
- [[_COMMUNITY_TypeScript Types & Stores|TypeScript Types & Stores]]
- [[_COMMUNITY_Glossary & Memory UI|Glossary & Memory UI]]
- [[_COMMUNITY_Canvas Components|Canvas Components]]
- [[_COMMUNITY_Inspector Panels|Inspector Panels]]

## God Nodes (most connected - your core abstractions)
1. `DomainRepository` - 72 edges
2. `RegionRecord` - 32 edges
3. `ProjectRepository` - 22 edges
4. `OcrError` - 21 edges
5. `OcrProviderRequest` - 17 edges
6. `run_page_translation()` - 17 edges
7. `run_page_ocr()` - 16 edges
8. `OcrProviderResponse` - 15 edges
9. `run_provider_chain()` - 14 edges
10. `ProjectFile` - 13 edges

## Surprising Connections (you probably didn't know these)
- `run_page_ocr()` --calls--> `build_provider_request()`  [INFERRED]
  src-tauri/src/ocr.rs → src-tauri/src/ocr/provider.rs
- `run_page_ocr()` --calls--> `run_provider_chain()`  [INFERRED]
  src-tauri/src/ocr.rs → src-tauri/src/ocr/provider.rs
- `apply_ocr_result_to_region()` --references--> `DomainRepository`  [EXTRACTED]
  src-tauri/src/ocr.rs → src-tauri/src/domain_storage.rs
- `run_page_ocr()` --references--> `DomainRepository`  [EXTRACTED]
  src-tauri/src/ocr.rs → src-tauri/src/domain_storage.rs
- `apply_translation_result_to_region()` --references--> `DomainRepository`  [EXTRACTED]
  src-tauri/src/translation.rs → src-tauri/src/domain_storage.rs

## Import Cycles
- None detected.

## Communities (17 total, 0 thin omitted)

### Community 0 - "Domain Repository (CRUD)"
Cohesion: 0.12
Nodes (49): build_project_from_domain(), default_text_style_id(), delete_page_image(), delete_project_assets(), derive_file_name(), DomainPageRow, DomainProjectRow, DomainRegionRow (+41 more)

### Community 1 - "Delete Operations"
Cohesion: 0.18
Nodes (20): delete_diagnostic_entities_by_project(), delete_diagnostic_entity(), delete_job_entities_by_project(), delete_job_entity(), delete_page_record(), delete_page_records_by_project(), delete_project_record(), delete_project_settings_record() (+12 more)

### Community 2 - "Translation Pipeline"
Cohesion: 0.22
Nodes (24): apply_translation_result_to_region(), apply_translation_skip_to_region(), build_local_draft_translation(), build_preview_translation(), build_provider_chain(), derive_region_status(), describe_provider_label(), is_word_char() (+16 more)

### Community 3 - "OCR Request Building"
Cohesion: 0.20
Nodes (14): Formatter, Into, build_provider_request(), OcrProviderRegionInput, OcrProviderRequest, OcrRegionResult, Box, Option (+6 more)

### Community 4 - "Job & Region Listing"
Cohesion: 0.25
Nodes (11): deserialize_string_list(), get_job_entity(), get_region_record(), JobEntity, list_job_entities_by_project(), list_region_records_by_page(), map_job_entity(), Option (+3 more)

### Community 5 - "Image & OCR I/O"
Cohesion: 0.28
Nodes (14): Display, OcrError, crop_region_png(), decode_data_url(), load_page_image(), map_language(), parse_tesseract_tsv(), Option (+6 more)

### Community 6 - "OCR Result Processing"
Cohesion: 0.24
Nodes (13): Row, get_project_record(), list_project_records(), map_diagnostic_entity(), map_page_record(), map_project_record(), map_project_settings_record(), map_region_record() (+5 more)

### Community 7 - "Database Row Mapping"
Cohesion: 0.28
Nodes (15): apply_ocr_result_to_region(), build_providers_for_engine(), emit_progress(), now_ms(), OcrPageResult, OcrProgressEvent, page_label(), AppHandle (+7 more)

### Community 8 - "Diagnostics & Text Styles"
Cohesion: 0.25
Nodes (6): build_preview_text(), preview_engine_name(), PreviewOcrProvider, Result, Self, String

### Community 9 - "Preview OCR Engine"
Cohesion: 0.28
Nodes (6): Send, PaddleOcrProvider, Result, run_paddle_ocr(), OcrProvider, Sync

### Community 10 - "Ollama Provider"
Cohesion: 0.33
Nodes (5): ensure_table_column(), AppHandle, Connection, Self, table_has_column()

### Community 11 - "AI Agent Tools & Dispatcher"
Cohesion: 0.43
Nodes (4): get_page_record(), list_page_records_by_project(), PageRecord, upsert_page_record()

### Community 12 - "TypeScript Types & Stores"
Cohesion: 0.43
Nodes (4): get_text_style_record(), list_text_style_records_by_project(), TextStyleRecord, upsert_text_style_record()

### Community 13 - "Glossary & Memory UI"
Cohesion: 0.48
Nodes (4): RegionRecord, MangaOcrProvider, Result, run_manga_ocr()

### Community 14 - "Canvas Components"
Cohesion: 0.43
Nodes (4): OcrProviderResponse, Result, run_windows_provider_inner(), WindowsOcrProvider

### Community 15 - "Inspector Panels"
Cohesion: 0.60
Nodes (3): get_project_settings_record(), ProjectSettingsRecord, upsert_project_settings_record()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RegionRecord` connect `Glossary & Memory UI` to `Delete Operations`, `Translation Pipeline`, `OCR Request Building`, `Job & Region Listing`, `Image & OCR I/O`, `OCR Result Processing`, `Database Row Mapping`, `Diagnostics & Text Styles`, `Preview OCR Engine`, `Canvas Components`?**
  _High betweenness centrality (0.331) - this node is a cross-community bridge._
- **Why does `DomainRepository` connect `Delete Operations` to `Translation Pipeline`, `Job & Region Listing`, `OCR Result Processing`, `Database Row Mapping`, `Ollama Provider`, `AI Agent Tools & Dispatcher`, `TypeScript Types & Stores`, `Inspector Panels`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Should `Domain Repository (CRUD)` be split into smaller, more focused modules?**
  _Cohesion score 0.11748251748251748 - nodes in this community are weakly interconnected._