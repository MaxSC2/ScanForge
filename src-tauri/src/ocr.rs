use crate::domain_storage::{DomainRepository, RegionRecord};
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use uuid::Uuid;

const WINDOWS_OCR_SCRIPT: &str = include_str!("ocr/windows_ocr.ps1");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrRegionResult {
    pub region_id: String,
    pub text: Option<String>,
    pub confidence: Option<f64>,
    pub skipped: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrPageResult {
    pub engine: String,
    pub regions_processed: usize,
    pub filled_count: usize,
    pub skipped_count: usize,
    pub results: Vec<OcrRegionResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrProviderRequest {
    image_data_url: String,
    source_language: Option<String>,
    regions: Vec<OcrProviderRegionInput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrProviderRegionInput {
    id: String,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
    orientation: String,
    source_text: String,
    locked: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OcrProviderResponse {
    engine: String,
    results: Vec<OcrRegionResult>,
}

enum OcrProviderMode {
    #[cfg(target_os = "windows")]
    Windows {
        strict: bool,
    },
    #[cfg(not(target_os = "windows"))]
    Preview {
        engine: String,
    },
}

fn preview_engine_name(engine: &str) -> String {
    if engine == "mock" {
        "scanforge-preview".to_string()
    } else {
        format!("scanforge-{engine}-preview")
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn file_stem(file_name: &str) -> &str {
    file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(file_name)
}

fn page_label(image_path: &str, page_id: &str) -> String {
    if image_path.starts_with("data:") {
        return format!("page-{}", page_id.chars().take(8).collect::<String>());
    }

    let normalized = image_path.replace('\\', "/");
    let file_name = normalized.rsplit('/').next().unwrap_or(image_path);
    file_stem(file_name).to_string()
}

fn build_preview_text(page_name: &str, page_width: i64, page_height: i64, region: &RegionRecord) -> String {
    let page_area = (page_width.max(1) * page_height.max(1)) as f64;
    let region_area = (region.width.max(1.0) * region.height.max(1.0)).max(1.0);
    let coverage = ((region_area / page_area) * 1000.0).round() / 10.0;
    let label = if region.label.trim().is_empty() {
        format!("region {}", region.order.max(1))
    } else {
        region.label.to_lowercase()
    };

    format!(
        "OCR preview: {} / text / {} / {:.1}%",
        page_name,
        label,
        coverage.max(0.1)
    )
}

#[cfg(target_os = "windows")]
fn resolve_provider(requested_engine: &str) -> Result<OcrProviderMode, String> {
    match requested_engine {
        "windows" => Ok(OcrProviderMode::Windows { strict: true }),
        "mock" => Ok(OcrProviderMode::Windows { strict: false }),
        "tesseract" | "paddle" | "manga-ocr" => Err(format!(
            "OCR engine '{}' is not implemented yet in Stage 3.",
            requested_engine
        )),
        other => Err(format!("Unsupported OCR engine '{}'.", other)),
    }
}

#[cfg(not(target_os = "windows"))]
fn resolve_provider(requested_engine: &str) -> Result<OcrProviderMode, String> {
    match requested_engine {
        "mock" | "windows" => Ok(OcrProviderMode::Preview {
            engine: preview_engine_name(requested_engine),
        }),
        "tesseract" | "paddle" | "manga-ocr" => Err(format!(
            "OCR engine '{}' is not implemented yet in Stage 3.",
            requested_engine
        )),
        other => Err(format!("Unsupported OCR engine '{}'.", other)),
    }
}

fn build_provider_request(
    page_image_data_url: String,
    source_language: Option<String>,
    regions: &[RegionRecord],
) -> OcrProviderRequest {
    OcrProviderRequest {
        image_data_url: page_image_data_url,
        source_language,
        regions: regions
            .iter()
            .map(|region| OcrProviderRegionInput {
                id: region.id.clone(),
                label: region.label.clone(),
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
                rotation: region.rotation,
                orientation: region.orientation.clone(),
                source_text: region.source_text.clone(),
                locked: region.locked,
            })
            .collect(),
    }
}

fn run_preview_provider(
    page_name: &str,
    page_width: i64,
    page_height: i64,
    regions: &[RegionRecord],
    engine_name: String,
) -> OcrProviderResponse {
    let results = regions
        .iter()
        .map(|region| {
            if region.locked {
                return OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: None,
                    skipped: true,
                    reason: Some("locked".into()),
                };
            }

            if !region.source_text.trim().is_empty() {
                return OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: None,
                    skipped: true,
                    reason: Some("already_filled".into()),
                };
            }

            if region.width <= 0.0 || region.height <= 0.0 {
                return OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: None,
                    skipped: true,
                    reason: Some("invalid_bounds".into()),
                };
            }

            OcrRegionResult {
                region_id: region.id.clone(),
                text: Some(build_preview_text(page_name, page_width, page_height, region)),
                confidence: None,
                skipped: false,
                reason: None,
            }
        })
        .collect();

    OcrProviderResponse {
        engine: engine_name,
        results,
    }
}

#[cfg(target_os = "windows")]
fn run_windows_provider(request: &OcrProviderRequest) -> Result<OcrProviderResponse, String> {
    let temp_dir = std::env::temp_dir().join(format!("scanforge-ocr-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let request_path = temp_dir.join("request.json");
    let script_path = temp_dir.join("windows_ocr.ps1");

    let execution = (|| {
        let request_json =
            serde_json::to_string(request).map_err(|error| error.to_string())?;
        fs::write(&request_path, request_json).map_err(|error| error.to_string())?;
        fs::write(&script_path, WINDOWS_OCR_SCRIPT).map_err(|error| error.to_string())?;

        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&script_path)
            .arg(&request_path)
            .output()
            .map_err(|error| format!("Failed to start Windows OCR provider: {error}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            return Err(format!("Windows OCR provider failed: {}", detail));
        }

        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("Windows OCR provider returned invalid UTF-8: {error}"))?;
        let payload = stdout.trim();
        serde_json::from_str::<OcrProviderResponse>(payload)
            .map_err(|error| format!("Failed to parse Windows OCR output: {error}"))
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    execution
}

#[cfg(not(target_os = "windows"))]
fn run_windows_provider(_request: &OcrProviderRequest) -> Result<OcrProviderResponse, String> {
    Err("Windows OCR provider is only available on Windows.".into())
}

fn apply_ocr_result_to_region(
    repository: &DomainRepository,
    region: &RegionRecord,
    result: &OcrRegionResult,
    engine_name: &str,
    source_language: Option<String>,
    processed_at: i64,
) -> Result<(), String> {
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
        return repository.upsert_region(updated_region).map(|_| ());
    }

    match result.reason.as_deref() {
        Some("invalid_bounds") | Some("no_text") => {
            updated_region.ocr_status = "failed".into();
            updated_region.ocr_engine = Some(engine_name.to_string());
            updated_region.source_language = source_language;
            updated_region.ocr_updated_at = Some(processed_at);
            updated_region.ocr_confidence = result.confidence;
            repository.upsert_region(updated_region).map(|_| ())
        }
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn run_page_ocr(
    page_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<OcrPageResult, String> {
    let page = repository
        .get_page(page_id.clone())?
        .ok_or_else(|| "Page not found".to_string())?;

    if page.width <= 0 || page.height <= 0 {
        return Err("Invalid page dimensions".into());
    }

    if !page.image_path.starts_with("data:image/") {
        return Err("OCR backend expects a data:image payload".into());
    }

    let settings = repository.get_project_settings(page.project_id.clone())?;
    let requested_engine = settings
        .as_ref()
        .map(|settings| settings.ocr_engine.as_str())
        .unwrap_or("windows");
    let source_language = settings
        .as_ref()
        .and_then(|settings| (settings.source_language != "auto").then(|| settings.source_language.clone()));

    let provider = resolve_provider(requested_engine)?;
    let page_name = page_label(&page.image_path, &page.id);
    let regions = repository.list_regions_by_page(page_id)?;
    let provider_request = build_provider_request(page.image_path.clone(), source_language.clone(), &regions);

    #[cfg(target_os = "windows")]
    let provider_output = match provider {
        OcrProviderMode::Windows { strict } => match run_windows_provider(&provider_request) {
            Ok(response) => response,
            Err(_error) if !strict => run_preview_provider(
                &page_name,
                page.width,
                page.height,
                &regions,
                preview_engine_name("mock"),
            ),
            Err(error) => return Err(error),
        },
    };

    #[cfg(not(target_os = "windows"))]
    let provider_output = match provider {
        OcrProviderMode::Preview { engine } => {
            run_preview_provider(&page_name, page.width, page.height, &regions, engine)
        }
    };

    let processed_at = now_ms();
    let result_by_id = provider_output
        .results
        .iter()
        .map(|result| (result.region_id.as_str(), result))
        .collect::<std::collections::HashMap<_, _>>();

    for region in &regions {
        if let Some(result) = result_by_id.get(region.id.as_str()) {
            apply_ocr_result_to_region(
                &repository,
                region,
                result,
                &provider_output.engine,
                source_language.clone(),
                processed_at,
            )?;
        }
    }

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
        regions_processed: provider_output.results.len(),
        filled_count,
        skipped_count,
        results: provider_output.results,
    })
}
