use crate::domain_storage::{DomainRepository, RegionRecord};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationRegionResult {
    pub region_id: String,
    pub translated_text: Option<String>,
    pub skipped: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationPageResult {
    pub provider: String,
    pub regions_processed: usize,
    pub translated_count: usize,
    pub skipped_count: usize,
    pub results: Vec<TranslationRegionResult>,
}

enum TranslationProviderMode {
    Local,
    Preview,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn resolve_provider(provider: &str) -> Result<TranslationProviderMode, String> {
    match provider {
        "local" => Ok(TranslationProviderMode::Local),
        "mock" => Ok(TranslationProviderMode::Preview),
        "remote" => Err("Remote translation provider is not implemented yet in Stage 3.".into()),
        other => Err(format!("Unsupported translation provider '{}'.", other)),
    }
}

fn is_word_char(value: char) -> bool {
    value.is_alphanumeric() || value == '\''
}

fn is_word_token(token: &str) -> bool {
    !token.is_empty() && token.chars().all(is_word_char)
}

fn tokenize_text(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut current_is_word: Option<bool> = None;

    for ch in text.chars() {
        let is_word = is_word_char(ch);
        match current_is_word {
            Some(flag) if flag == is_word => current.push(ch),
            Some(_) => {
                tokens.push(current);
                current = String::from(ch);
                current_is_word = Some(is_word);
            }
            None => {
                current.push(ch);
                current_is_word = Some(is_word);
            }
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn preserve_case(source: &str, translated: &str) -> String {
    if source.chars().all(|char| !char.is_lowercase()) {
        return translated.to_uppercase();
    }

    if source
        .chars()
        .next()
        .map(|char| char.is_uppercase())
        .unwrap_or(false)
    {
        let mut chars = translated.chars();
        if let Some(first) = chars.next() {
            return format!("{}{}", first.to_uppercase(), chars.collect::<String>());
        }
    }

    translated.to_string()
}

fn translate_known_word(word: &str, target_language: &str) -> Option<String> {
    let normalized = word.to_lowercase();
    let translated = match target_language {
        "ru" => match normalized.as_str() {
            "hello" | "hi" => Some("привет"),
            "yes" => Some("да"),
            "no" => Some("нет"),
            "thanks" | "thank" => Some("спасибо"),
            "sorry" => Some("прости"),
            "please" => Some("пожалуйста"),
            "wait" => Some("подожди"),
            "stop" => Some("стой"),
            "run" => Some("беги"),
            "go" => Some("иди"),
            "what" => Some("что"),
            "where" => Some("где"),
            "who" => Some("кто"),
            "why" => Some("почему"),
            "mission" => Some("миссия"),
            "danger" => Some("опасность"),
            "enemy" => Some("враг"),
            "friend" => Some("друг"),
            "captain" => Some("капитан"),
            "system" => Some("система"),
            "power" => Some("сила"),
            "test" => Some("тест"),
            "attack" => Some("атака"),
            "region" => Some("регион"),
            "page" => Some("страница"),
            "translation" => Some("перевод"),
            "start" => Some("старт"),
            "finish" => Some("финиш"),
            "open" => Some("открыть"),
            "close" => Some("закрыть"),
            "save" => Some("сохранить"),
            _ => None,
        },
        "en" => match normalized.as_str() {
            "привет" => Some("hello"),
            "да" => Some("yes"),
            "нет" => Some("no"),
            "спасибо" => Some("thanks"),
            "прости" => Some("sorry"),
            "пожалуйста" => Some("please"),
            "подожди" => Some("wait"),
            "стой" => Some("stop"),
            "беги" => Some("run"),
            "иди" => Some("go"),
            "что" => Some("what"),
            "где" => Some("where"),
            "кто" => Some("who"),
            "почему" => Some("why"),
            "миссия" => Some("mission"),
            "опасность" => Some("danger"),
            "враг" => Some("enemy"),
            "друг" => Some("friend"),
            "капитан" => Some("captain"),
            "система" => Some("system"),
            "сила" => Some("power"),
            "тест" => Some("test"),
            "атака" => Some("attack"),
            "регион" => Some("region"),
            "страница" => Some("page"),
            "перевод" => Some("translation"),
            "старт" => Some("start"),
            "финиш" => Some("finish"),
            "открыть" => Some("open"),
            "закрыть" => Some("close"),
            "сохранить" => Some("save"),
            _ => None,
        },
        _ => None,
    }?;

    Some(preserve_case(word, translated))
}

fn build_local_draft_translation(text: &str, target_language: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let mut translated_words = 0_usize;
    let output = tokenize_text(trimmed)
        .into_iter()
        .map(|token| {
            if !is_word_token(&token) {
                return token;
            }

            if let Some(translated) = translate_known_word(&token, target_language) {
                translated_words += 1;
                translated
            } else {
                token
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if output.is_empty() || translated_words == 0 || output == trimmed {
        let prefix = if target_language == "ru" {
            "[ru draft]"
        } else {
            "[en draft]"
        };
        return format!("{prefix} {trimmed}");
    }

    output
}

fn build_preview_translation(text: &str, target_language: &str) -> String {
    let prefix = if target_language == "ru" {
        "[preview ru]"
    } else {
        "[preview en]"
    };
    format!("{prefix} {}", text.trim())
}

fn provider_name(mode: &TranslationProviderMode) -> &'static str {
    match mode {
        TranslationProviderMode::Local => "scanforge-local-draft",
        TranslationProviderMode::Preview => "scanforge-translation-preview",
    }
}

fn apply_translation_result_to_region(
    repository: &DomainRepository,
    region: &RegionRecord,
    translated_text: &str,
    provider: &str,
    target_language: &str,
    processed_at: i64,
) -> Result<(), String> {
    let mut updated_region = region.clone();
    updated_region.translated_text = translated_text.to_string();
    updated_region.status = "translated".into();
    updated_region.target_language = Some(target_language.to_string());
    updated_region.translation_status = "done".into();
    updated_region.translation_provider = Some(provider.to_string());
    updated_region.translation_updated_at = Some(processed_at);
    repository.upsert_region(updated_region).map(|_| ())
}

#[tauri::command]
pub fn run_page_translation(
    page_id: String,
    region_ids: Option<Vec<String>>,
    overwrite_existing: bool,
    repository: State<'_, DomainRepository>,
) -> Result<TranslationPageResult, String> {
    let page = repository
        .get_page(page_id.clone())?
        .ok_or_else(|| "Page not found".to_string())?;
    let settings = repository.get_project_settings(page.project_id.clone())?;
    let target_language = settings
        .as_ref()
        .map(|settings| settings.target_language.clone())
        .unwrap_or_else(|| "ru".to_string());
    let requested_provider = settings
        .as_ref()
        .map(|settings| settings.translation_provider.as_str())
        .unwrap_or("local");
    let provider = resolve_provider(requested_provider)?;
    let provider_label = provider_name(&provider).to_string();

    let target_region_ids = region_ids.map(|ids| ids.into_iter().collect::<HashSet<_>>());
    let mut regions = repository.list_regions_by_page(page_id)?;
    if let Some(target_ids) = target_region_ids.as_ref() {
        regions.retain(|region| target_ids.contains(&region.id));
    }

    if regions.is_empty() {
        return Err("No regions selected for translation".into());
    }

    let processed_at = now_ms();
    let mut results = Vec::with_capacity(regions.len());

    for region in &regions {
        if region.locked {
            results.push(TranslationRegionResult {
                region_id: region.id.clone(),
                translated_text: None,
                skipped: true,
                reason: Some("locked".into()),
            });
            continue;
        }

        if region.source_text.trim().is_empty() {
            results.push(TranslationRegionResult {
                region_id: region.id.clone(),
                translated_text: None,
                skipped: true,
                reason: Some("empty_source".into()),
            });
            continue;
        }

        if !overwrite_existing && !region.translated_text.trim().is_empty() {
            results.push(TranslationRegionResult {
                region_id: region.id.clone(),
                translated_text: None,
                skipped: true,
                reason: Some("already_translated".into()),
            });
            continue;
        }

        let translated_text = match provider {
            TranslationProviderMode::Local => {
                build_local_draft_translation(&region.source_text, &target_language)
            }
            TranslationProviderMode::Preview => {
                build_preview_translation(&region.source_text, &target_language)
            }
        };

        apply_translation_result_to_region(
            &repository,
            region,
            &translated_text,
            &provider_label,
            &target_language,
            processed_at,
        )?;

        results.push(TranslationRegionResult {
            region_id: region.id.clone(),
            translated_text: Some(translated_text),
            skipped: false,
            reason: None,
        });
    }

    let translated_count = results
        .iter()
        .filter(|result| !result.skipped && result.translated_text.is_some())
        .count();
    let skipped_count = results.len().saturating_sub(translated_count);

    Ok(TranslationPageResult {
        provider: provider_label,
        regions_processed: results.len(),
        translated_count,
        skipped_count,
        results,
    })
}
