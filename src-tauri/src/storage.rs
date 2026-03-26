use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

const DB_FILE_NAME: &str = "scanforge.db";

#[derive(Debug, Clone)]
pub struct ProjectRepository {
  db_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
  pub local_project_id: Option<String>,
  pub name: String,
  pub created_at: i64,
  pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFilePage {
  pub id: String,
  pub file_name: String,
  pub image_data_url: String,
  pub natural_width: i64,
  pub natural_height: i64,
  pub regions: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
  pub version: u8,
  pub meta: ProjectMeta,
  pub pages: Vec<ProjectFilePage>,
  pub active_page_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProjectSummary {
  pub id: String,
  pub name: String,
  pub created_at: i64,
  pub updated_at: i64,
  pub page_count: i64,
  pub last_opened_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProjectSaveResult {
  pub project: ProjectFile,
  pub summary: LocalProjectSummary,
}

impl ProjectRepository {
  pub fn new(app: &AppHandle) -> Result<Self, String> {
    let app_dir = app
      .path()
      .app_data_dir()
      .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;

    let repository = Self {
      db_path: app_dir.join(DB_FILE_NAME),
    };
    repository.init()?;
    Ok(repository)
  }

  fn connect(&self) -> Result<Connection, String> {
    Connection::open(&self.db_path).map_err(|error| error.to_string())
  }

  fn init(&self) -> Result<(), String> {
    let connection = self.connect()?;
    connection
      .execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER,
          page_count INTEGER NOT NULL,
          payload_json TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_projects_updated_at
        ON projects(updated_at DESC);
        ",
      )
      .map_err(|error| error.to_string())?;

    Ok(())
  }

  pub fn save_project(&self, mut project: ProjectFile) -> Result<LocalProjectSaveResult, String> {
    let project_id = project
      .meta
      .local_project_id
      .clone()
      .filter(|value| !value.trim().is_empty())
      .unwrap_or_else(|| Uuid::new_v4().to_string());

    project.meta.local_project_id = Some(project_id.clone());

    let summary = LocalProjectSummary {
      id: project_id.clone(),
      name: project.meta.name.clone(),
      created_at: project.meta.created_at,
      updated_at: project.meta.updated_at,
      page_count: project.pages.len() as i64,
      last_opened_at: Some(now_ms()),
    };
    let payload_json = serde_json::to_string(&project).map_err(|error| error.to_string())?;
    let connection = self.connect()?;

    connection
      .execute(
        "
        INSERT INTO projects (
          id,
          name,
          created_at,
          updated_at,
          last_opened_at,
          page_count,
          payload_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at,
          last_opened_at = excluded.last_opened_at,
          page_count = excluded.page_count,
          payload_json = excluded.payload_json
        ",
        params![
          summary.id,
          summary.name,
          summary.created_at,
          summary.updated_at,
          summary.last_opened_at,
          summary.page_count,
          payload_json,
        ],
      )
      .map_err(|error| error.to_string())?;

    Ok(LocalProjectSaveResult { project, summary })
  }

  pub fn load_project(&self, id: String) -> Result<ProjectFile, String> {
    let connection = self.connect()?;
    let payload_json = connection
      .query_row(
        "SELECT payload_json FROM projects WHERE id = ?1",
        params![id.clone()],
        |row| row.get::<_, String>(0),
      )
      .map_err(|error| error.to_string())?;

    connection
      .execute(
        "UPDATE projects SET last_opened_at = ?1 WHERE id = ?2",
        params![now_ms(), id],
      )
      .map_err(|error| error.to_string())?;

    serde_json::from_str(&payload_json).map_err(|error| error.to_string())
  }

  pub fn load_latest_project(&self) -> Result<Option<ProjectFile>, String> {
    let connection = self.connect()?;
    let row = connection
      .query_row(
        "
        SELECT id, payload_json
        FROM projects
        ORDER BY COALESCE(last_opened_at, updated_at) DESC
        LIMIT 1
        ",
        [],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
      )
      .optional()
      .map_err(|error| error.to_string())?;

    let Some((id, payload_json)) = row else {
      return Ok(None);
    };

    connection
      .execute(
        "UPDATE projects SET last_opened_at = ?1 WHERE id = ?2",
        params![now_ms(), id],
      )
      .map_err(|error| error.to_string())?;

    let project = serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    Ok(Some(project))
  }

  pub fn list_projects(&self) -> Result<Vec<LocalProjectSummary>, String> {
    let connection = self.connect()?;
    let mut statement = connection
      .prepare(
        "
        SELECT id, name, created_at, updated_at, page_count, last_opened_at
        FROM projects
        ORDER BY updated_at DESC
        ",
      )
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        Ok(LocalProjectSummary {
          id: row.get(0)?,
          name: row.get(1)?,
          created_at: row.get(2)?,
          updated_at: row.get(3)?,
          page_count: row.get(4)?,
          last_opened_at: row.get(5)?,
        })
      })
      .map_err(|error| error.to_string())?;

    rows
      .collect::<Result<Vec<_>, _>>()
      .map_err(|error| error.to_string())
  }
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as i64)
    .unwrap_or_default()
}

#[tauri::command]
pub fn save_project_snapshot(
  project: ProjectFile,
  repository: State<'_, ProjectRepository>,
) -> Result<LocalProjectSaveResult, String> {
  repository.save_project(project)
}

#[tauri::command]
pub fn load_project_snapshot(
  id: String,
  repository: State<'_, ProjectRepository>,
) -> Result<ProjectFile, String> {
  repository.load_project(id)
}

#[tauri::command]
pub fn load_latest_project_snapshot(
  repository: State<'_, ProjectRepository>,
) -> Result<Option<ProjectFile>, String> {
  repository.load_latest_project()
}

#[tauri::command]
pub fn list_project_summaries(
  repository: State<'_, ProjectRepository>,
) -> Result<Vec<LocalProjectSummary>, String> {
  repository.list_projects()
}
