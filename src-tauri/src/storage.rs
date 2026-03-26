use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

const DB_FILE_NAME: &str = "scanforge.db";
const PROJECTS_TABLE: &str = "projects";
const PAGES_TABLE: &str = "pages";
const REGIONS_TABLE: &str = "regions";
const JOBS_TABLE: &str = "jobs";
const PROJECT_SNAPSHOTS_TABLE: &str = "project_snapshots";
const LEGACY_PROJECTS_UPDATED_INDEX: &str = "idx_projects_updated_at";

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

#[derive(Debug, Clone)]
struct DomainProjectRow {
    id: String,
    name: String,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Clone)]
struct DomainPageRow {
    id: String,
    order: i64,
    image_path: String,
    width: i64,
    height: i64,
}

#[derive(Debug, Clone)]
struct DomainRegionRow {
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
    source_text: String,
    translated_text: String,
    status: String,
    locked: bool,
    visible: bool,
    ocr_confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SnapshotRegion {
    #[serde(default)]
    id: String,
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
    #[serde(default)]
    width: f64,
    #[serde(default)]
    height: f64,
    #[serde(default)]
    rotation: f64,
    #[serde(default)]
    source_text: String,
    #[serde(default)]
    translated_text: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    locked: bool,
    #[serde(default = "default_true")]
    visible: bool,
    #[serde(default)]
    ocr_confidence: Option<f64>,
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
        migrate_legacy_snapshot_table(&connection)?;

        connection
            .execute_batch(&format!(
                "
                CREATE TABLE IF NOT EXISTS {PROJECTS_TABLE} (
                  id TEXT PRIMARY KEY,
                  name TEXT,
                  created_at INTEGER,
                  updated_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS {PAGES_TABLE} (
                  id TEXT PRIMARY KEY,
                  project_id TEXT,
                  page_order INTEGER,
                  image_path TEXT,
                  width INTEGER,
                  height INTEGER
                );

                CREATE TABLE IF NOT EXISTS {REGIONS_TABLE} (
                  id TEXT PRIMARY KEY,
                  page_id TEXT,
                  x REAL,
                  y REAL,
                  width REAL,
                  height REAL,
                  rotation REAL,
                  source_text TEXT,
                  translated_text TEXT,
                  status TEXT,
                  locked INTEGER,
                  visible INTEGER,
                  ocr_confidence REAL
                );

                CREATE TABLE IF NOT EXISTS {JOBS_TABLE} (
                  id TEXT PRIMARY KEY,
                  type TEXT,
                  status TEXT,
                  project_id TEXT,
                  page_id TEXT,
                  progress REAL,
                  created_at INTEGER,
                  updated_at INTEGER,
                  error TEXT
                );

                CREATE TABLE IF NOT EXISTS {PROJECT_SNAPSHOTS_TABLE} (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL,
                  last_opened_at INTEGER,
                  page_count INTEGER NOT NULL,
                  payload_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_snapshots_updated_at
                ON {PROJECT_SNAPSHOTS_TABLE}(updated_at DESC);

                CREATE INDEX IF NOT EXISTS idx_pages_project_id_order
                ON {PAGES_TABLE}(project_id, page_order);

                CREATE INDEX IF NOT EXISTS idx_regions_page_id
                ON {REGIONS_TABLE}(page_id);

                CREATE INDEX IF NOT EXISTS idx_jobs_project_id_status
                ON {JOBS_TABLE}(project_id, status);
                "
            ))
            .map_err(|error| error.to_string())?;

        migrate_snapshot_projects(&connection)?;
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
                &format!(
                    "
                    INSERT INTO {PROJECTS_TABLE} (id, name, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      created_at = excluded.created_at,
                      updated_at = excluded.updated_at
                    "
                ),
                params![
                    project_id,
                    project.meta.name,
                    project.meta.created_at,
                    project.meta.updated_at,
                ],
            )
            .map_err(|error| error.to_string())?;

        connection
            .execute(
                &format!(
                    "
                    INSERT INTO {PROJECT_SNAPSHOTS_TABLE} (
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
                    "
                ),
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
        migrate_snapshot_projects(&connection)?;

        let project_row = get_project_row(&connection, id.clone())?
            .ok_or_else(|| format!("Local project {id} was not found"))?;

        update_snapshot_last_opened(&connection, id.clone())?;

        if let Some(mut snapshot) = load_snapshot_backup(&connection, id)? {
            snapshot.meta = ProjectMeta {
                local_project_id: Some(project_row.id),
                name: project_row.name,
                created_at: project_row.created_at,
                updated_at: project_row.updated_at,
            };
            return Ok(snapshot);
        }

        build_project_from_domain(&connection, project_row)
    }

    pub fn load_latest_project(&self) -> Result<Option<ProjectFile>, String> {
        let connection = self.connect()?;
        migrate_snapshot_projects(&connection)?;

        let latest_project_id = connection
            .query_row(
                &format!(
                    "
                    SELECT p.id
                    FROM {PROJECTS_TABLE} p
                    LEFT JOIN {PROJECT_SNAPSHOTS_TABLE} s ON s.id = p.id
                    ORDER BY COALESCE(s.last_opened_at, p.updated_at) DESC, p.updated_at DESC
                    LIMIT 1
                    "
                ),
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        match latest_project_id {
            Some(id) => self.load_project(id).map(Some),
            None => Ok(None),
        }
    }

    pub fn list_projects(&self) -> Result<Vec<LocalProjectSummary>, String> {
        let connection = self.connect()?;
        migrate_snapshot_projects(&connection)?;
        let mut statement = connection
            .prepare(&format!(
                "
                SELECT
                  p.id,
                  p.name,
                  p.created_at,
                  p.updated_at,
                  COALESCE(page_counts.page_count, 0) AS page_count,
                  s.last_opened_at
                FROM {PROJECTS_TABLE} p
                LEFT JOIN (
                  SELECT project_id, COUNT(*) AS page_count
                  FROM {PAGES_TABLE}
                  GROUP BY project_id
                ) page_counts ON page_counts.project_id = p.id
                LEFT JOIN {PROJECT_SNAPSHOTS_TABLE} s ON s.id = p.id
                ORDER BY COALESCE(s.last_opened_at, p.updated_at) DESC, p.updated_at DESC
                "
            ))
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

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }
}

fn default_true() -> bool {
    true
}

fn normalize_snapshot_region_status(region: &SnapshotRegion) -> String {
    if let Some(status) = region.status.clone() {
        return status;
    }

    if !region.translated_text.trim().is_empty() {
        return "translated".into();
    }

    if !region.source_text.trim().is_empty() {
        return "ocr_done".into();
    }

    "idle".into()
}

fn derive_file_name(page_order: i64, image_path: &str) -> String {
    if !image_path.starts_with("data:") {
        let normalized = image_path.replace('\\', "/");
        if let Some(segment) = normalized.rsplit('/').next() {
            return segment.to_string();
        }
    }

    format!("page-{page_order}.png")
}

fn build_project_from_domain(
    connection: &Connection,
    project: DomainProjectRow,
) -> Result<ProjectFile, String> {
    let pages = list_pages_by_project(connection, project.id.clone())?;

    let project_pages = pages
        .into_iter()
        .map(|page| {
            let regions = list_regions_by_page(connection, page.id.clone())?
                .into_iter()
                .enumerate()
                .map(|(index, region)| {
                    Ok(json!({
                        "id": region.id,
                        "label": format!("Region {}", index + 1),
                        "x": region.x,
                        "y": region.y,
                        "width": region.width,
                        "height": region.height,
                        "rotation": region.rotation,
                        "sourceText": region.source_text,
                        "translatedText": region.translated_text,
                        "status": region.status,
                        "kind": "speech",
                        "order": index + 1,
                        "notes": "",
                        "locked": region.locked,
                        "visible": region.visible,
                        "ocrConfidence": region.ocr_confidence
                    }))
                })
                .collect::<Result<Vec<_>, String>>()?;

            Ok(ProjectFilePage {
                id: page.id,
                file_name: derive_file_name(page.order, &page.image_path),
                image_data_url: page.image_path,
                natural_width: page.width,
                natural_height: page.height,
                regions,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let active_page_id = project_pages.first().map(|page| page.id.clone());

    Ok(ProjectFile {
        version: 1,
        meta: ProjectMeta {
            local_project_id: Some(project.id),
            name: project.name,
            created_at: project.created_at,
            updated_at: project.updated_at,
        },
        pages: project_pages,
        active_page_id,
    })
}

fn migrate_snapshot_projects(connection: &Connection) -> Result<(), String> {
    if !table_exists(connection, PROJECT_SNAPSHOTS_TABLE)? {
        return Ok(());
    }

    let mut statement = connection
        .prepare(&format!(
            "
            SELECT s.id, s.payload_json
            FROM {PROJECT_SNAPSHOTS_TABLE} s
            LEFT JOIN {PROJECTS_TABLE} p ON p.id = s.id
            WHERE p.id IS NULL
            ORDER BY s.updated_at ASC
            "
        ))
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?;

    for row in rows {
        let (snapshot_id, payload_json) = row.map_err(|error| error.to_string())?;
        let mut project =
            serde_json::from_str::<ProjectFile>(&payload_json).map_err(|error| error.to_string())?;
        project.meta.local_project_id = Some(
            project
                .meta
                .local_project_id
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(snapshot_id),
        );

        import_snapshot_project_into_domain(connection, &project)?;
    }

    Ok(())
}

fn import_snapshot_project_into_domain(
    connection: &Connection,
    project: &ProjectFile,
) -> Result<(), String> {
    let project_id = project
        .meta
        .local_project_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Snapshot project is missing localProjectId".to_string())?;

    connection
        .execute(
            &format!(
                "
                INSERT INTO {PROJECTS_TABLE} (id, name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                "
            ),
            params![
                project_id.clone(),
                project.meta.name,
                project.meta.created_at,
                project.meta.updated_at,
            ],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            &format!(
                "
                DELETE FROM {REGIONS_TABLE}
                WHERE page_id IN (
                  SELECT id FROM {PAGES_TABLE} WHERE project_id = ?1
                )
                "
            ),
            params![project_id.clone()],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            &format!("DELETE FROM {PAGES_TABLE} WHERE project_id = ?1"),
            params![project_id.clone()],
        )
        .map_err(|error| error.to_string())?;

    for (page_index, page) in project.pages.iter().enumerate() {
        connection
            .execute(
                &format!(
                    "
                    INSERT INTO {PAGES_TABLE} (id, project_id, page_order, image_path, width, height)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                    "
                ),
                params![
                    page.id,
                    project_id.clone(),
                    (page_index as i64) + 1,
                    page.image_data_url,
                    page.natural_width,
                    page.natural_height,
                ],
            )
            .map_err(|error| error.to_string())?;

        for raw_region in &page.regions {
            let region = serde_json::from_value::<SnapshotRegion>(raw_region.clone())
                .unwrap_or_else(|_| SnapshotRegion::default());

            if region.id.trim().is_empty() {
                continue;
            }

            connection
                .execute(
                    &format!(
                        "
                        INSERT INTO {REGIONS_TABLE} (
                          id,
                          page_id,
                          x,
                          y,
                          width,
                          height,
                          rotation,
                          source_text,
                          translated_text,
                          status,
                          locked,
                          visible,
                          ocr_confidence
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                        "
                    ),
                    params![
                        region.id,
                        page.id,
                        region.x,
                        region.y,
                        region.width,
                        region.height,
                        region.rotation,
                        region.source_text,
                        region.translated_text,
                        normalize_snapshot_region_status(&region),
                        bool_to_sql(region.locked),
                        bool_to_sql(region.visible),
                        region.ocr_confidence,
                    ],
                )
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn get_project_row(connection: &Connection, id: String) -> Result<Option<DomainProjectRow>, String> {
    connection
        .query_row(
            &format!(
                "
                SELECT id, name, created_at, updated_at
                FROM {PROJECTS_TABLE}
                WHERE id = ?1
                "
            ),
            params![id],
            |row| {
                Ok(DomainProjectRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn list_pages_by_project(
    connection: &Connection,
    project_id: String,
) -> Result<Vec<DomainPageRow>, String> {
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT id, project_id, page_order, image_path, width, height
            FROM {PAGES_TABLE}
            WHERE project_id = ?1
            ORDER BY page_order ASC, id ASC
            "
        ))
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![project_id], |row| {
            Ok(DomainPageRow {
                id: row.get(0)?,
                order: row.get(2)?,
                image_path: row.get(3)?,
                width: row.get(4)?,
                height: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn list_regions_by_page(
    connection: &Connection,
    page_id: String,
) -> Result<Vec<DomainRegionRow>, String> {
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT
              id,
              page_id,
              x,
              y,
              width,
              height,
              rotation,
              source_text,
              translated_text,
              status,
              locked,
              visible,
              ocr_confidence
            FROM {REGIONS_TABLE}
            WHERE page_id = ?1
            ORDER BY rowid ASC
            "
        ))
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![page_id], |row| {
            Ok(DomainRegionRow {
                id: row.get(0)?,
                x: row.get(2)?,
                y: row.get(3)?,
                width: row.get(4)?,
                height: row.get(5)?,
                rotation: row.get(6)?,
                source_text: row.get(7)?,
                translated_text: row.get(8)?,
                status: row.get(9)?,
                locked: sql_to_bool(row.get::<_, i64>(10)?),
                visible: sql_to_bool(row.get::<_, i64>(11)?),
                ocr_confidence: row.get(12)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn load_snapshot_backup(connection: &Connection, id: String) -> Result<Option<ProjectFile>, String> {
    let payload = connection
        .query_row(
            &format!("SELECT payload_json FROM {PROJECT_SNAPSHOTS_TABLE} WHERE id = ?1"),
            params![id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    match payload {
        Some(payload_json) => serde_json::from_str(&payload_json)
            .map(Some)
            .map_err(|error| error.to_string()),
        None => Ok(None),
    }
}

fn update_snapshot_last_opened(connection: &Connection, id: String) -> Result<(), String> {
    if !table_exists(connection, PROJECT_SNAPSHOTS_TABLE)? {
        return Ok(());
    }

    connection
        .execute(
            &format!("UPDATE {PROJECT_SNAPSHOTS_TABLE} SET last_opened_at = ?1 WHERE id = ?2"),
            params![now_ms(), id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn migrate_legacy_snapshot_table(connection: &Connection) -> Result<(), String> {
    if !table_exists(connection, PROJECTS_TABLE)? {
        return Ok(());
    }

    if !table_has_column(connection, PROJECTS_TABLE, "payload_json")? {
        return Ok(());
    }

    connection
        .execute_batch(&format!("DROP INDEX IF EXISTS {LEGACY_PROJECTS_UPDATED_INDEX};"))
        .map_err(|error| error.to_string())?;

    let snapshot_target_name = if table_exists(connection, PROJECT_SNAPSHOTS_TABLE)? {
        format!("project_snapshots_legacy_backup_{}", now_ms())
    } else {
        PROJECT_SNAPSHOTS_TABLE.to_string()
    };

    connection
        .execute_batch(&format!(
            "ALTER TABLE {PROJECTS_TABLE} RENAME TO {snapshot_target_name};"
        ))
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn table_exists(connection: &Connection, table_name: &str) -> Result<bool, String> {
    let exists = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            params![table_name],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(exists.is_some())
}

fn table_has_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut statement = connection
        .prepare(&pragma)
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;

    for column in rows {
        let column = column.map_err(|error| error.to_string())?;
        if column == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

fn bool_to_sql(value: bool) -> i64 {
    if value { 1 } else { 0 }
}

fn sql_to_bool(value: i64) -> bool {
    value != 0
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
