use crate::domain_storage::RegionRecord;
use super::provider::{OcrError, OcrProvider, OcrProviderRequest, OcrProviderResponse, OcrRegionResult};
use std::io::Write;
use std::process::{Command, Stdio};
use tempfile::NamedTempFile;

pub struct TesseractOcrProvider;

impl OcrProvider for TesseractOcrProvider {
    fn name(&self) -> &str {
        "tesseract"
    }

    fn recognize(
        &self,
        request: &OcrProviderRequest,
        _page_name: &str,
        _page_width: i64,
        _page_height: i64,
        regions: &[RegionRecord],
        overwrite_existing: bool,
    ) -> Result<OcrProviderResponse, OcrError> {
        run_tesseract_ocr(request, regions, overwrite_existing)
    }
}

fn decode_data_url(data_url: &str) -> Result<Vec<u8>, OcrError> {
    let encoded = data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| OcrError::new("tesseract", "Invalid data URL format", false))?;
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| OcrError::new("tesseract", format!("Failed to decode base64: {e}"), false))
}

fn map_language(source_language: &Option<String>) -> String {
    match source_language.as_deref() {
        Some("ja") => "jpn",
        Some("zh") => "chi_sim",
        Some("ko") => "kor",
        Some("en") => "eng",
        Some("ru") => "rus",
        Some("fr") => "fra",
        Some("de") => "deu",
        Some("es") => "spa",
        Some("it") => "ita",
        Some(lang) => lang,
        None => "eng",
    }
    .to_string()
}

fn load_page_image(image_bytes: &[u8]) -> Result<Vec<u8>, OcrError> {
    image::load_from_memory(image_bytes)
        .map_err(|e| OcrError::new("tesseract", format!("Failed to decode image: {e}"), false))
        .map(|img| {
            let mut buf = std::io::Cursor::new(Vec::new());
            img.write_to(&mut buf, image::ImageFormat::Png)
                .ok();
            buf.into_inner()
        })
}

fn crop_region_png(image_bytes: &[u8], x: i64, y: i64, w: i64, h: i64) -> Result<Vec<u8>, OcrError> {
    let img = image::load_from_memory(image_bytes)
        .map_err(|e| OcrError::new("tesseract", format!("Failed to decode image: {e}"), false))?;

    let x = x.max(0).min(img.width() as i64 - 1) as u32;
    let y = y.max(0).min(img.height() as i64 - 1) as u32;
    let w = (w as u32).min(img.width() - x).max(1);
    let h = (h as u32).min(img.height() - y).max(1);

    let cropped = img.crop_imm(x, y, w, h);
    let mut buf = std::io::Cursor::new(Vec::new());
    cropped
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| OcrError::new("tesseract", format!("Failed to encode crop: {e}"), false))?;
    Ok(buf.into_inner())
}

fn parse_tesseract_tsv(output: &str) -> Vec<(String, f64)> {
    let mut words: Vec<(String, f64)> = Vec::new();
    let mut lines = output.lines();

    // Skip header line
    let header = lines.next().unwrap_or("");
    let headers: Vec<&str> = header.split('\t').collect();

    let text_idx = headers.iter().position(|&h| h == "text").unwrap_or(usize::MAX);
    let conf_idx = headers.iter().position(|&h| h == "conf").unwrap_or(usize::MAX);
    let level_idx = headers.iter().position(|&h| h == "level").unwrap_or(usize::MAX);

    for line in lines {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() <= text_idx.max(conf_idx) {
            continue;
        }

        // Only process word-level entries (level == 5)
        if level_idx < cols.len() {
            if let Ok(level) = cols[level_idx].trim().parse::<i32>() {
                if level != 5 {
                    continue;
                }
            }
        }

        let text = cols[text_idx].trim().to_string();
        if text.is_empty() || text.chars().all(|c| c.is_whitespace()) {
            continue;
        }

        let conf = if conf_idx < cols.len() {
            cols[conf_idx].trim().parse::<f64>().unwrap_or(0.0)
        } else {
            0.0
        };

        words.push((text, conf));
    }

    words
}

fn run_tesseract_on_crop(
    crop_bytes: &[u8],
    lang: &str,
    psm: &str,
) -> Result<(String, f64), OcrError> {
    let mut temp_file = NamedTempFile::new()
        .map_err(|e| OcrError::new("tesseract", format!("Failed to create temp file: {e}"), true))?;
    temp_file
        .write_all(crop_bytes)
        .map_err(|e| OcrError::new("tesseract", format!("Failed to write temp file: {e}"), true))?;

    let temp_path = temp_file.path().to_str()
        .ok_or_else(|| OcrError::new("tesseract", "Invalid temp path", false))?
        .to_string();

    let psm_arg = format!("--psm={psm}");

    let tsv_output = Command::new("tesseract")
        .arg(&temp_path)
        .arg("stdout")
        .arg("tsv")
        .arg("-l")
        .arg(lang)
        .arg(&psm_arg)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| OcrError::new(
            "tesseract",
            format!("Failed to run tesseract: {e}. Is Tesseract installed?",),
            true,
        ))?;

    if !tsv_output.status.success() {
        let stderr = String::from_utf8_lossy(&tsv_output.stderr).to_string();
        let message = if stderr.contains("Error opening data file") || stderr.contains("Please make sure the TESSDATA_PREFIX environment variable") {
            format!("Tesseract language data not found for '{lang}'. Set TESSDATA_PREFIX or install language pack.")
        } else {
            format!("Tesseract failed: {stderr}")
        };
        return Err(OcrError::new("tesseract", message, true));
    }

    let tsv_str = String::from_utf8_lossy(&tsv_output.stdout).to_string();
    let words = parse_tesseract_tsv(&tsv_str);

    if words.is_empty() {
        return Ok((String::new(), 0.0));
    }

    let combined_text: String = words.iter().map(|(w, _)| w.as_str()).collect::<Vec<&str>>().join(" ");
    let avg_confidence = words.iter().map(|(_, c)| c).sum::<f64>() / words.len() as f64;
    let normalized_conf = (avg_confidence / 100.0).clamp(0.0, 1.0);

    Ok((combined_text, normalized_conf))
}

fn run_tesseract_ocr(
    request: &OcrProviderRequest,
    _regions: &[RegionRecord],
    _overwrite_existing: bool,
) -> Result<OcrProviderResponse, OcrError> {
    // Check if tesseract is available
    let version_check = Command::new("tesseract")
        .arg("--version")
        .output();

    match version_check {
        Ok(output) if output.status.success() => {}
        _ => {
            return Err(OcrError::new(
                "tesseract",
                "Tesseract CLI is not installed. Install Tesseract OCR (https://github.com/tesseract-ocr/tesseract)",
                true,
            ));
        }
    }

    let page_image_data = decode_data_url(&request.image_data_url)?;
    let page_image_png = load_page_image(&page_image_data)?;
    let lang = map_language(&request.source_language);
    let psm = "6"; // Assume a single uniform block of text

    let mut results: Vec<OcrRegionResult> = Vec::new();

    for region in &request.regions {
        if region.locked {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                confidence: None,
                skipped: true,
                reason: Some("locked".into()),
            });
            continue;
        }

        let should_overwrite = request.overwrite_existing || region.ocr_overwrite_enabled;
        if !should_overwrite && !region.source_text.trim().is_empty() {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                confidence: None,
                skipped: true,
                reason: Some("already_filled".into()),
            });
            continue;
        }

        let x = region.x as i64;
        let y = region.y as i64;
        let w = region.width as i64;
        let h = region.height as i64;

        if w <= 0 || h <= 0 {
            results.push(OcrRegionResult {
                region_id: region.id.clone(),
                text: None,
                confidence: None,
                skipped: true,
                reason: Some("invalid_bounds".into()),
            });
            continue;
        }

        let crop_result = crop_region_png(&page_image_png, x, y, w, h);

        let crop_bytes = match crop_result {
            Ok(bytes) => bytes,
            Err(e) => {
                results.push(OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: None,
                    skipped: true,
                    reason: Some(format!("error: {e}")),
                });
                continue;
            }
        };

        match run_tesseract_on_crop(&crop_bytes, &lang, psm) {
            Ok((text, confidence)) if text.is_empty() => {
                results.push(OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: Some(0.0),
                    skipped: true,
                    reason: Some("no_text".into()),
                });
            }
            Ok((text, confidence)) => {
                results.push(OcrRegionResult {
                    region_id: region.id.clone(),
                    text: Some(text),
                    confidence: Some(confidence),
                    skipped: false,
                    reason: None,
                });
            }
            Err(e) => {
                results.push(OcrRegionResult {
                    region_id: region.id.clone(),
                    text: None,
                    confidence: None,
                    skipped: true,
                    reason: Some(format!("error: {e}")),
                });
            }
        }
    }

    Ok(OcrProviderResponse {
        engine: "tesseract".into(),
        results,
    })
}
