use crate::domain_storage::{DomainRepository, PageRecord, RegionRecord, ProjectSettingsRecord};
use crate::storage::ProjectRepository;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use tauri::{Emitter, State};
use uuid::Uuid;

const DETECT_SCRIPT: &str = include_str!("detect.py");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub text: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectScriptRequest {
    image_data_url: String,
    source_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectScriptResponse {
    engine: Option<String>,
    regions: Vec<DetectedRegion>,
    reason: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoDetectProgressEvent {
    pub page_id: String,
    pub progress: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoDetectResponse {
    pub engine: Option<String>,
    pub regions_created: usize,
    pub region_ids: Vec<String>,
}

fn emit_progress(app_handle: &tauri::AppHandle, page_id: &str, progress: f64, message: String) {
    let _ = app_handle.emit(
        "auto-detect-progress",
        AutoDetectProgressEvent {
            page_id: page_id.to_string(),
            progress,
            message,
        },
    );
}

fn sorted_region_order(
    regions: &[DetectedRegion],
    page_height: f64,
) -> Vec<(usize, i64)> {
    let mut indexed: Vec<(usize, f64, f64)> = regions
        .iter()
        .enumerate()
        .map(|(i, r)| (i, r.y, r.x))
        .collect();

    indexed.sort_by(|a, b| {
        let row_a = (a.1 / (page_height / 10.0)).floor() as i64;
        let row_b = (b.1 / (page_height / 10.0)).floor() as i64;
        row_a.cmp(&row_b).then_with(|| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
    });

    indexed
        .into_iter()
        .enumerate()
        .map(|(order, (orig_idx, _, _))| (orig_idx, order as i64))
        .collect()
}

#[tauri::command]
pub fn auto_detect_regions(
    app_handle: tauri::AppHandle,
    page_id: String,
    clear_existing: Option<bool>,
    repository: State<'_, DomainRepository>,
    storage: State<'_, ProjectRepository>,
) -> Result<AutoDetectResponse, String> {
    emit_progress(&app_handle, &page_id, 0.05, "Loading page".to_string());

    let page = repository
        .get_page(page_id.clone())
        .map_err(|e| format!("Database error loading page: {e}"))?
        .ok_or_else(|| "Page not found".to_string())?;

    emit_progress(&app_handle, &page_id, 0.15, "Loading image".to_string());

    let image_data = if page.image_path.starts_with("data:") {
        page.image_path.clone()
    } else {
        storage
            .load_page_image_as_data_url(&page.image_path)
            .map_err(|e| format!("Failed to load page image: {e}"))?
    };

    let settings = repository
        .get_project_settings(page.project_id.clone())
        .map_err(|e| format!("Database error loading settings: {e}"))?;
    let source_language = settings
        .as_ref()
        .and_then(|s| (s.source_language != "auto").then(|| s.source_language.clone()));

    emit_progress(&app_handle, &page_id, 0.25, "Running text detection".to_string());

    let python = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let mut child = Command::new(python)
        .arg("-c")
        .arg(DETECT_SCRIPT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python process: {e}"))?;

    let request_json = serde_json::to_string(&DetectScriptRequest {
        image_data_url: image_data,
        source_language,
    })
    .map_err(|e| format!("Failed to serialize request: {e}"))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin
            .write_all(request_json.as_bytes())
            .map_err(|e| format!("Failed to write to Python stdin: {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read Python output: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = if !stderr.is_empty() {
            stderr
        } else {
            "Detection script failed".to_string()
        };

        if message.contains("not installed") || message.contains("No module named") {
            return Err("OCR library not installed. Run: pip install paddleocr".to_string());
        }

        return Err(format!("Detection failed: {message}"));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 output: {e}"))?;

    let script_response: DetectScriptResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse detection response: {e}"))?;

    let detected_regions = script_response.regions;
    if detected_regions.is_empty() {
        return Ok(AutoDetectResponse {
            engine: script_response.engine,
            regions_created: 0,
            region_ids: vec![],
        });
    }

    emit_progress(
        &app_handle,
        &page_id,
        0.6,
        format!("Found {} text regions, creating...", detected_regions.len()),
    );

    let clear_existing = clear_existing.unwrap_or(true);
    if clear_existing {
        repository
            .delete_regions_by_page(page_id.clone())
            .map_err(|e| format!("Failed to clear existing regions: {e}"))?;
    }

    let processed_at = now_ms();
    let region_orders = sorted_region_order(&detected_regions, page.height as f64);

    let mut created_ids: Vec<String> = Vec::with_capacity(detected_regions.len());

    for (orig_idx, order) in region_orders {
        let det = &detected_regions[orig_idx];
        let region_id = Uuid::new_v4().to_string();

        let region = RegionRecord {
            id: region_id.clone(),
            page_id: page_id.clone(),
            x: det.x,
            y: det.y,
            width: det.width,
            height: det.height,
            rotation: 0.0,
            label: format!("{}", order + 1),
            kind: "speech".into(),
            order,
            orientation: "horizontal".into(),
            source_text: det.text.clone(),
            source_language: None,
            translated_text: String::new(),
            status: "ocr_done".into(),
            ocr_status: "done".into(),
            ocr_engine: script_response.engine.clone(),
            ocr_updated_at: Some(processed_at),
            target_language: None,
            translation_status: "idle".into(),
            translation_provider: None,
            translation_updated_at: None,
            notes: String::new(),
            locked: false,
            visible: true,
            text_style_id: None,
            ocr_confidence: Some(det.confidence),
            ocr_overwrite_enabled: false,
        };

        repository
            .upsert_region(region)
            .map_err(|e| format!("Failed to create region: {e}"))?;

        created_ids.push(region_id);
    }

    emit_progress(
        &app_handle,
        &page_id,
        1.0,
        format!("Created {} regions", created_ids.len()),
    );

    Ok(AutoDetectResponse {
        engine: script_response.engine,
        regions_created: created_ids.len(),
        region_ids: created_ids,
    })
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}
