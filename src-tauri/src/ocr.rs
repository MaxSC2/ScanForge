pub mod detect;
pub mod easy;
pub mod manga;
pub mod paddle;
pub mod preview;
pub mod provider;
pub mod tesseract;
pub mod windows;

use crate::domain_storage::{DomainRepository, RegionRecord};
use crate::storage::ProjectRepository;
use provider::{build_provider_request, run_provider_chain, OcrError, OcrProvider, OcrProviderRequest};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, State};

// Re-export types needed by the Tauri command
pub use provider::OcrRegionResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrPageResult {
    pub engine: String,
    pub provider_path: Vec<String>,
    pub regions_processed: usize,
    pub filled_count: usize,
    pub skipped_count: usize,
    pub results: Vec<OcrRegionResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProgressEvent {
    pub page_id: String,
    pub region_id: Option<String>,
    pub progress: f64,
    pub message: String,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn page_label(image_path: &str, page_id: &str) -> String {
    if image_path.starts_with("data:") {
        return format!("page-{}", page_id.chars().take(8).collect::<String>());
    }

    let normalized = image_path.replace('\\', "/");
    let file_name = normalized.rsplit('/').next().unwrap_or(image_path);
    file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem.to_string())
        .unwrap_or_else(|| file_name.to_string())
}

fn build_providers_for_engine(engine: &str) -> Vec<Box<dyn OcrProvider>> {
    let preview = || -> Box<dyn OcrProvider> {
        Box::new(preview::PreviewOcrProvider::new(engine))
    };
    let windows = || -> Box<dyn OcrProvider> {
        Box::new(windows::WindowsOcrProvider)
    };
    let manga = || -> Box<dyn OcrProvider> {
        Box::new(manga::MangaOcrProvider)
    };
    let paddle = || -> Box<dyn OcrProvider> {
        Box::new(paddle::PaddleOcrProvider)
    };
    let easy = || -> Box<dyn OcrProvider> {
        Box::new(easy::EasyOcrProvider)
    };
    let unavailable = |name: &str, msg: String| -> Box<dyn OcrProvider> {
        Box::new(provider::UnavailableOcrProvider::new(name, msg))
    };

    match engine {
        "mock" => vec![preview()],
        "windows" => vec![windows(), preview()],
        "tesseract" => vec![
            Box::new(tesseract::TesseractOcrProvider),
            windows(),
            preview(),
        ],
        "paddle" => vec![paddle(), windows(), preview()],
        "easyocr" => vec![easy(), paddle(), windows(), preview()],
        "manga-ocr" => vec![manga(), paddle(), windows(), preview()],
        other => vec![
            unavailable(other, format!("Unsupported OCR engine '{other}', falling back.")),
            windows(),
            preview(),
        ],
    }
}

fn apply_ocr_result_to_region(
    repository: &DomainRepository,
    region: &RegionRecord,
    result: &OcrRegionResult,
    engine_name: &str,
    source_language: Option<String>,
    processed_at: i64,
) -> Result<(), OcrError> {
    let mut updated_region = region.clone();

    if let Some(text) = result.text.clone() {
        updated_region.source_text = text;
        updated_region.status = if updated_region.translated_text.trim().is_empty() {
            "ocr_done".into()
        } else {
            "translated".into()
        };
        updated_region.ocr_status = "done".into();
        updated_region.ocr_engine = Some(engine_name.to_string());
        updated_region.source_language = source_language;
        updated_region.ocr_updated_at = Some(processed_at);
        updated_region.ocr_confidence = result.confidence;
        return repository.upsert_region(updated_region).map_err(|e| {
            OcrError::new("storage", format!("Failed to update region: {e}"), false)
        });
    }

    match result.reason.as_deref() {
        Some("invalid_bounds") | Some("no_text") => {
            updated_region.ocr_status = "failed".into();
            updated_region.ocr_engine = Some(engine_name.to_string());
            updated_region.source_language = source_language;
            updated_region.ocr_updated_at = Some(processed_at);
            updated_region.ocr_confidence = result.confidence;
            repository.upsert_region(updated_region).map_err(|e| {
                OcrError::new("storage", format!("Failed to update region: {e}"), false)
            })
        }
        _ => Ok(()),
    }
}

fn emit_progress(
    app_handle: &tauri::AppHandle,
    page_id: &str,
    region_id: Option<String>,
    progress: f64,
    message: String,
) {
    let _ = app_handle.emit("ocr-progress", OcrProgressEvent {
        page_id: page_id.to_string(),
        region_id,
        progress,
        message,
    });
}

#[tauri::command]
pub fn run_page_ocr(
    app_handle: tauri::AppHandle,
    page_id: String,
    region_ids: Option<Vec<String>>,
    overwrite_existing: Option<bool>,
    repository: State<'_, DomainRepository>,
) -> Result<OcrPageResult, String> {
    emit_progress(&app_handle, &page_id, None, 0.05, "Starting OCR".into());

    let page = repository
        .get_page(page_id.clone())
        .map_err(|e| format!("Database error loading page: {e}"))?
        .ok_or_else(|| "Page not found".to_string())?;

    emit_progress(&app_handle, &page_id, None, 0.15, "Loading page data".into());

    if page.width <= 0 || page.height <= 0 {
        return Err("Invalid page dimensions".into());
    }

    let image_data = if page.image_path.starts_with("data:") {
        page.image_path.clone()
    } else {
        let storage = app_handle.state::<ProjectRepository>();
        storage.load_page_image_as_data_url(&page.image_path)
            .map_err(|e| format!("Failed to load page image for OCR: {e}"))?
    };

    let settings = repository.get_project_settings(page.project_id.clone()).map_err(|e| format!("Database error loading settings: {e}"))?;
    let requested_engine = settings
        .as_ref()
        .map(|settings| settings.ocr_engine.as_str())
        .unwrap_or("windows");
    let source_language = settings
        .as_ref()
        .and_then(|s| (s.source_language != "auto").then(|| s.source_language.clone()));

    emit_progress(&app_handle, &page_id, None, 0.25, format!("Running {}", requested_engine));

    let page_name = page_label(&page.image_path, &page.id);
    let all_regions = repository.list_regions_by_page(page_id.clone()).map_err(|e| format!("Database error loading regions: {e}"))?;
    let regions = if let Some(region_ids) = region_ids {
        let target_ids: std::collections::HashSet<_> = region_ids.into_iter().collect();
        all_regions
            .into_iter()
            .filter(|region| target_ids.contains(&region.id))
            .collect::<Vec<_>>()
    } else {
        all_regions
    };

    if regions.is_empty() {
        return Err("No regions selected for OCR".into());
    }

    let overwrite_existing = overwrite_existing.unwrap_or(false);
    let provider_request = build_provider_request(
        image_data,
        source_language.clone(),
        &regions,
        overwrite_existing,
    );

    let providers = build_providers_for_engine(requested_engine);
    let (provider_output, provider_path) = run_provider_chain(
        &providers,
        &provider_request,
        &page_name,
        page.width,
        page.height,
        &regions,
        overwrite_existing,
    )
    .map_err(|e| {
        format!("OCR failed: {e}")
    })?;

    let processed_at = now_ms();
    let result_by_id: std::collections::HashMap<&str, &OcrRegionResult> = provider_output
        .results
        .iter()
        .map(|result| (result.region_id.as_str(), result))
        .collect();

    let total = regions.len() as f64;
    for (index, region) in regions.iter().enumerate() {
        if let Some(result) = result_by_id.get(region.id.as_str()) {
            apply_ocr_result_to_region(
                &repository,
                region,
                result,
                &provider_output.engine,
                source_language.clone(),
                processed_at,
            ).map_err(|e| format!("Failed to apply OCR result: {e}"))?;
        }
        let region_progress = 0.35 + ((index + 1) as f64 / total) * 0.6;
        let status = if region.locked { "skipped (locked)" } else { "done" };
        emit_progress(
            &app_handle,
            &page_id,
            Some(region.id.clone()),
            region_progress,
            format!("Region {}/{}: {}", index + 1, total, status),
        );
    }

    emit_progress(&app_handle, &page_id, None, 1.0, "OCR complete".into());

    let filled_count = provider_output
        .results
        .iter()
        .filter(|item| !item.skipped && item.text.is_some())
        .count();
    let skipped_count = provider_output
        .results
        .len()
        .saturating_sub(filled_count);

    Ok(OcrPageResult {
        engine: provider_output.engine,
        provider_path,
        regions_processed: provider_output.results.len(),
        filled_count,
        skipped_count,
        results: provider_output.results,
    })
}
