use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagickOptions {
    pub format: String,       // "jpg" | "png" | "webp"
    pub quality: u32,         // 1-100
    pub resize_percent: Option<u32>,  // e.g. 50 for 50%
    pub input_path: String,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagickResult {
    pub success: bool,
    pub output_path: String,
    pub error: Option<String>,
}

fn find_magick() -> Option<&'static str> {
    for cmd in &["magick", "convert", "gm"] {
        if Command::new(cmd)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(cmd);
        }
    }
    None
}

#[tauri::command]
pub fn convert_with_imagick(options: ImagickOptions) -> Result<ImagickResult, String> {
    let magick = find_magick().ok_or_else(|| {
        "ImageMagick not found. Install: apt install imagemagick (Linux) or brew install imagemagick (Mac)".to_string()
    })?;

    // Build args: input → [resize] → [quality] → output
    let mut args: Vec<String> = Vec::new();

    if magick == "magick" || magick == "convert" {
        args.push(options.input_path.clone());
    }

    if let Some(pct) = options.resize_percent {
        args.push("-resize".into());
        args.push(format!("{pct}%"));
    }

    args.push("-quality".into());
    args.push(options.quality.to_string());

    args.push(options.output_path.clone());

    let output = if magick == "magick" || magick == "convert" {
        Command::new("convert")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run convert: {e}"))?
    } else {
        // GraphicsMagick
        args.insert(0, options.input_path.clone());
        Command::new("gm")
            .arg("convert")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run gm convert: {e}"))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "convert failed".into()
        } else {
            format!("convert failed: {stderr}")
        });
    }

    Ok(ImagickResult {
        success: true,
        output_path: options.output_path,
        error: None,
    })
}

#[tauri::command]
pub fn check_imagick() -> Result<bool, String> {
    Ok(find_magick().is_some())
}
