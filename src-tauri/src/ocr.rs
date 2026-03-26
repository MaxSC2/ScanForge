use crate::domain_storage::{DomainRepository, RegionRecord};
use serde::{Deserialize, Serialize};
use tauri::State;

const OCR_ENGINE_NAME: &str = "scanforge-tauri-preview";

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

fn page_label(image_path: &str, page_id: &str) -> String {
    if image_path.starts_with("data:") {
        return format!("page-{}", page_id.chars().take(8).collect::<String>());
    }

    let normalized = image_path.replace('\\', "/");
    let file_name = normalized.rsplit('/').next().unwrap_or(image_path);
    file_stem(file_name).to_string()
}

fn build_preview_text(
    page_name: &str,
    page_width: i64,
    page_height: i64,
    region: &RegionRecord,
) -> String {
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

    let page_name = page_label(&page.image_path, &page.id);
    let regions = repository.list_regions_by_page(page_id)?;
    let mut results = Vec::with_capacity(regions.len());

    for region in regions.into_iter() {
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

        let text = build_preview_text(&page_name, page.width, page.height, &region);
        let mut updated_region = region.clone();
        updated_region.source_text = text.clone();
        updated_region.status = if updated_region.translated_text.trim().is_empty() {
            "ocr_done".into()
        } else {
            "translated".into()
        };
        updated_region.ocr_status = "done".into();
        updated_region.ocr_engine = Some(OCR_ENGINE_NAME.into());
        updated_region.ocr_updated_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_millis() as i64)
                .unwrap_or_default(),
        );
        repository.upsert_region(updated_region)?;

        results.push(OcrRegionResult {
            region_id: region.id,
            text: Some(text),
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
