use crate::domain_storage::RegionRecord;
use super::provider::{OcrError, OcrProvider, OcrProviderRequest, OcrProviderResponse, OcrRegionResult};
use std::fs;
use std::process::Command;
use uuid::Uuid;

const WINDOWS_OCR_SCRIPT: &str = include_str!("windows_ocr.ps1");

pub struct WindowsOcrProvider;

impl OcrProvider for WindowsOcrProvider {
    fn name(&self) -> &str {
        "windows"
    }

    fn recognize(
        &self,
        request: &OcrProviderRequest,
        _page_name: &str,
        _page_width: i64,
        _page_height: i64,
        _regions: &[RegionRecord],
        _overwrite_existing: bool,
    ) -> Result<OcrProviderResponse, OcrError> {
        run_windows_provider_inner(request)
    }
}

#[cfg(target_os = "windows")]
fn run_windows_provider_inner(request: &OcrProviderRequest) -> Result<OcrProviderResponse, OcrError> {
    let temp_dir = std::env::temp_dir().join(format!("scanforge-ocr-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|e| {
        OcrError::new("windows", format!("Failed to create temp dir: {e}"), false)
    })?;

    let request_path = temp_dir.join("request.json");
    let script_path = temp_dir.join("windows_ocr.ps1");

    let result = (|| -> Result<OcrProviderResponse, OcrError> {
        let request_json = serde_json::to_string(request).map_err(|e| {
            OcrError::new("windows", format!("Failed to serialize request: {e}"), false)
        })?;
        fs::write(&request_path, request_json).map_err(|e| {
            OcrError::new("windows", format!("Failed to write request: {e}"), false)
        })?;
        fs::write(&script_path, WINDOWS_OCR_SCRIPT).map_err(|e| {
            OcrError::new("windows", format!("Failed to write script: {e}"), false)
        })?;

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
            .map_err(|e| {
                OcrError::new("windows", format!("Failed to start PowerShell: {e}"), true)
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            return Err(OcrError::new(
                "windows",
                format!("Provider failed: {detail}"),
                true,
            ));
        }

        let stdout = String::from_utf8(output.stdout).map_err(|e| {
            OcrError::new("windows", format!("Invalid UTF-8 output: {e}"), false)
        })?;
        let payload = stdout.trim();

        serde_json::from_str::<OcrProviderResponse>(payload).map_err(|e| {
            OcrError::new("windows", format!("Failed to parse output: {e}"), false)
        })
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

#[cfg(not(target_os = "windows"))]
fn run_windows_provider_inner(_request: &OcrProviderRequest) -> Result<OcrProviderResponse, OcrError> {
    Err(OcrError::new(
        "windows",
        "Windows OCR provider is only available on Windows.",
        false,
    ))
}
