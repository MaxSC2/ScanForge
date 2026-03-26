use serde::{Deserialize, Serialize};

const OCR_ENGINE_NAME: &str = "scanforge-tauri-preview";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrRegionInput {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub order: i64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub source_text: String,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrPagePayload {
    pub page_id: String,
    pub file_name: String,
    pub image_data_url: String,
    pub natural_width: i64,
    pub natural_height: i64,
    pub regions: Vec<OcrRegionInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrRegionResult {
    pub region_id: String,
    pub text: Option<String>,
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

fn file_stem(file_name: &str) -> &str {
    file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(file_name)
}

fn region_kind_label(kind: &str) -> &str {
    match kind {
        "speech" => "speech",
        "sfx" => "sfx",
        "narration" => "narration",
        _ => "text",
    }
}

fn build_preview_text(payload: &OcrPagePayload, region: &OcrRegionInput) -> String {
    let page_area = (payload.natural_width.max(1) * payload.natural_height.max(1)) as f64;
    let region_area = (region.width.max(1.0) * region.height.max(1.0)).max(1.0);
    let coverage = ((region_area / page_area) * 1000.0).round() / 10.0;
    let label = if region.label.trim().is_empty() {
        format!("region {}", region.order.max(1))
    } else {
        region.label.trim().to_string()
    };

    format!(
        "OCR preview: {} / {} / {} / {:.1}%",
        file_stem(&payload.file_name),
        region_kind_label(&region.kind),
        label,
        coverage.max(0.1)
    )
}

#[tauri::command]
pub fn run_page_ocr(payload: OcrPagePayload) -> Result<OcrPageResult, String> {
    if payload.natural_width <= 0 || payload.natural_height <= 0 {
        return Err("Invalid page dimensions".into());
    }

    if !payload.image_data_url.starts_with("data:image/") {
        return Err("OCR backend expects a data:image payload".into());
    }

    let mut results = Vec::with_capacity(payload.regions.len());

    for region in &payload.regions {
        if region.locked {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                skipped: true,
                reason: Some("locked".into()),
            });
            continue;
        }

        if !region.source_text.trim().is_empty() {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                skipped: true,
                reason: Some("already_filled".into()),
            });
            continue;
        }

        if region.width <= 0.0 || region.height <= 0.0 {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                skipped: true,
                reason: Some("invalid_bounds".into()),
            });
            continue;
        }

        results.push(OcrRegionResult {
            region_id: region.id.clone(),
            text: Some(build_preview_text(&payload, region)),
            skipped: false,
            reason: None,
        });
    }

    let filled_count = results
        .iter()
        .filter(|item| !item.skipped && item.text.is_some())
        .count();
    let skipped_count = results.len().saturating_sub(filled_count);

    Ok(OcrPageResult {
        engine: OCR_ENGINE_NAME.into(),
        regions_processed: results.len(),
        filled_count,
        skipped_count,
        results,
    })
}
