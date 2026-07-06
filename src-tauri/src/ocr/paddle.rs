use crate::domain_storage::RegionRecord;
use super::provider::{OcrError, OcrProvider, OcrProviderRequest, OcrProviderResponse, OcrRegionResult};
use std::process::{Command, Stdio};
use std::io::Write;

const PADDLE_OCR_SCRIPT: &str = include_str!("paddle_ocr.py");

pub struct PaddleOcrProvider;

impl OcrProvider for PaddleOcrProvider {
    fn name(&self) -> &str {
        "paddle"
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
        run_paddle_ocr(request, regions, overwrite_existing)
    }
}

fn run_paddle_ocr(
    request: &OcrProviderRequest,
    _regions: &[RegionRecord],
    _overwrite_existing: bool,
) -> Result<OcrProviderResponse, OcrError> {
    let python_check = Command::new("python3")
        .arg("--version")
        .output()
        .or_else(|_| Command::new("python").arg("--version").output());

    match python_check {
        Ok(output) if output.status.success() => {}
        _ => {
            return Err(OcrError::new(
                "paddle",
                "Python is not available on this system. Install Python 3 to use PaddleOCR.",
                false,
            ));
        }
    }

    let python = if cfg!(target_os = "windows") { "python" } else { "python3" };

    let mut child = Command::new(python)
        .arg("-c")
        .arg(PADDLE_OCR_SCRIPT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| OcrError::new(
            "paddle",
            format!("Failed to start PaddleOCR process: {e}"),
            true,
        ))?;

    let request_json = serde_json::to_string(request)
        .map_err(|e| OcrError::new("paddle", format!("Failed to serialize request: {e}"), false))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin.write_all(request_json.as_bytes())
            .map_err(|e| OcrError::new("paddle", format!("Failed to write to stdin: {e}"), true))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| OcrError::new("paddle", format!("Failed to read PaddleOCR output: {e}"), true))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = if !stderr.is_empty() { stderr } else { "Unknown error".into() };

        if message.contains("not installed") || message.contains("No module named") {
            return Err(OcrError::new(
                "paddle",
                "paddleocr Python package is not installed. Run: pip install paddleocr",
                true,
            ));
        }

        return Err(OcrError::new(
            "paddle",
            format!("PaddleOCR failed: {message}"),
            true,
        ));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| OcrError::new("paddle", format!("Invalid UTF-8 output: {e}"), false))?;

    let response: OcrProviderResponse = serde_json::from_str(&stdout)
        .map_err(|e| OcrError::new("paddle", format!("Failed to parse PaddleOCR response: {e}"), false))?;

    Ok(response)
}
