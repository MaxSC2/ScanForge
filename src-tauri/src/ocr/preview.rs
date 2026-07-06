use crate::domain_storage::RegionRecord;
use super::provider::{OcrError, OcrProvider, OcrProviderRequest, OcrProviderResponse, OcrRegionResult};

fn preview_engine_name(engine: &str) -> String {
    if engine == "mock" {
        "scanforge-preview".to_string()
    } else {
        format!("scanforge-{engine}-preview")
    }
}

fn file_stem(file_name: &str) -> &str {
    file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(file_name)
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

pub struct PreviewOcrProvider {
    engine_label: String,
}

impl PreviewOcrProvider {
    pub fn new(requested_engine: &str) -> Self {
        Self {
            engine_label: preview_engine_name(requested_engine),
        }
    }
}

impl OcrProvider for PreviewOcrProvider {
    fn name(&self) -> &str {
        &self.engine_label
    }

    fn recognize(
        &self,
        _request: &OcrProviderRequest,
        page_name: &str,
        page_width: i64,
        page_height: i64,
        regions: &[RegionRecord],
        overwrite_existing: bool,
    ) -> Result<OcrProviderResponse, OcrError> {
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

                let should_overwrite = overwrite_existing || region.ocr_overwrite_enabled;
                if !should_overwrite && !region.source_text.trim().is_empty() {
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

        Ok(OcrProviderResponse {
            engine: self.engine_label.clone(),
            results,
        })
    }
}
