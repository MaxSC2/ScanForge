use crate::domain_storage::RegionRecord;
use serde::{Deserialize, Serialize};

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
pub struct OcrProviderResponse {
    pub engine: String,
    pub results: Vec<OcrRegionResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProviderRequest {
    pub image_data_url: String,
    pub source_language: Option<String>,
    pub overwrite_existing: bool,
    pub regions: Vec<OcrProviderRegionInput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProviderRegionInput {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub orientation: String,
    pub source_text: String,
    pub locked: bool,
    pub ocr_overwrite_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrError {
    pub provider: String,
    pub message: String,
    pub recoverable: bool,
}

impl std::fmt::Display for OcrError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {} (recoverable: {})", self.provider, self.message, self.recoverable)
    }
}

impl OcrError {
    pub fn new(provider: impl Into<String>, message: impl Into<String>, recoverable: bool) -> Self {
        Self {
            provider: provider.into(),
            message: message.into(),
            recoverable,
        }
    }
}

pub trait OcrProvider: Send + Sync {
    fn name(&self) -> &str;

    fn recognize(
        &self,
        request: &OcrProviderRequest,
        page_name: &str,
        page_width: i64,
        page_height: i64,
        regions: &[RegionRecord],
        overwrite_existing: bool,
    ) -> Result<OcrProviderResponse, OcrError>;
}

pub fn build_provider_request(
    page_image_data_url: String,
    source_language: Option<String>,
    regions: &[RegionRecord],
    overwrite_existing: bool,
) -> OcrProviderRequest {
    OcrProviderRequest {
        image_data_url: page_image_data_url,
        source_language,
        overwrite_existing,
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
                ocr_overwrite_enabled: region.ocr_overwrite_enabled,
            })
            .collect(),
    }
}

pub struct UnavailableOcrProvider {
    name: String,
    message: String,
}

impl UnavailableOcrProvider {
    pub fn new(name: &str, message: String) -> Self {
        Self {
            name: name.to_string(),
            message,
        }
    }
}

impl OcrProvider for UnavailableOcrProvider {
    fn name(&self) -> &str {
        &self.name
    }

    fn recognize(
        &self,
        _request: &OcrProviderRequest,
        _page_name: &str,
        _page_width: i64,
        _page_height: i64,
        _regions: &[RegionRecord],
        _overwrite_existing: bool,
    ) -> Result<OcrProviderResponse, OcrError> {
        Err(OcrError::new(&self.name, &self.message, true))
    }
}

pub fn run_provider_chain(
    providers: &[Box<dyn OcrProvider>],
    request: &OcrProviderRequest,
    page_name: &str,
    page_width: i64,
    page_height: i64,
    regions: &[RegionRecord],
    overwrite_existing: bool,
) -> Result<(OcrProviderResponse, Vec<String>), OcrError> {
    let mut provider_path: Vec<String> = Vec::new();
    let mut last_error: Option<OcrError> = None;

    for provider in providers {
        provider_path.push(provider.name().to_string());

        match provider.recognize(request, page_name, page_width, page_height, regions, overwrite_existing) {
            Ok(response) => {
                if let Some(last) = provider_path.last_mut() {
                    *last = response.engine.clone();
                }
                return Ok((response, provider_path));
            }
            Err(error) => {
                eprintln!("[ScanForge][OCR] provider '{}' failed: {}", provider.name(), error);
                if !error.recoverable {
                    return Err(error);
                }
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| OcrError::new("chain", "No OCR providers available", false)))
}
