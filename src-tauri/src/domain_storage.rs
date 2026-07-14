use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

const DB_FILE_NAME: &str = "scanforge.db";

#[derive(Debug, Clone)]
pub struct DomainRepository {
    db_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRecord {
    pub id: String,
    pub project_id: String,
    pub order: i64,
    pub image_path: String,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsRecord {
    pub project_id: String,
    pub source_language: String,
    pub target_language: String,
    pub ocr_engine: String,
    pub translation_provider: String,
    pub default_text_style_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStyleRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub font_family: String,
    pub font_size: f64,
    pub line_height: f64,
    pub letter_spacing: f64,
    pub align: String,
    pub fill: String,
    pub stroke: String,
    pub stroke_width: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionRecord {
    pub id: String,
    pub page_id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub label: String,
    pub kind: String,
    pub order: i64,
    pub orientation: String,
    pub source_text: String,
    pub source_language: Option<String>,
    pub translated_text: String,
    pub status: String,
    pub ocr_status: String,
    pub ocr_engine: Option<String>,
    pub ocr_updated_at: Option<i64>,
    pub target_language: Option<String>,
    pub translation_status: String,
    pub translation_provider: Option<String>,
    pub translation_updated_at: Option<i64>,
    pub notes: String,
    pub locked: bool,
    pub visible: bool,
    pub text_style_id: Option<String>,
    pub ocr_confidence: Option<f64>,
    pub ocr_overwrite_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEntity {
    pub id: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub status: String,
    pub project_id: String,
    pub page_id: Option<String>,
    pub region_ids: Option<Vec<String>>,
    pub progress: f64,
    pub created_at: i64,
    pub updated_at: i64,
    pub summary: Option<String>,
    pub result_json: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEntity {
    pub id: String,
    pub project_id: String,
    pub scope: String,
    pub level: String,
    pub message: String,
    pub timestamp: i64,
    pub count: i64,
    pub detail: Option<String>,
    pub page_id: Option<String>,
    pub region_id: Option<String>,
    pub job_id: Option<String>,
}

impl DomainRepository {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;

        let repository = Self {
            db_path: app_dir.join(DB_FILE_NAME),
        };
        repository.ensure_schema()?;
        Ok(repository)
    }

    fn connect(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|error| error.to_string())
    }

    fn ensure_schema(&self) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute_batch(
                "
                CREATE TABLE IF NOT EXISTS projects (
                  id TEXT PRIMARY KEY,
                  name TEXT,
                  created_at INTEGER,
                  updated_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS pages (
                  id TEXT PRIMARY KEY,
                  project_id TEXT,
                  page_order INTEGER,
                  image_path TEXT,
                  width INTEGER,
                  height INTEGER
                );

                CREATE TABLE IF NOT EXISTS regions (
                  id TEXT PRIMARY KEY,
                  page_id TEXT,
                  x REAL,
                  y REAL,
                  width REAL,
                  height REAL,
                  rotation REAL,
                  label TEXT DEFAULT '',
                  kind TEXT DEFAULT 'speech',
                  region_order INTEGER DEFAULT 0,
                  orientation TEXT DEFAULT 'horizontal',
                  source_text TEXT,
                  source_language TEXT,
                  translated_text TEXT,
                  status TEXT,
                  ocr_status TEXT DEFAULT 'idle',
                  ocr_engine TEXT,
                  ocr_updated_at INTEGER,
                  target_language TEXT,
                  translation_status TEXT DEFAULT 'idle',
                  translation_provider TEXT,
                  translation_updated_at INTEGER,
                  notes TEXT DEFAULT '',
                  locked INTEGER,
                  visible INTEGER,
                  text_style_id TEXT,
                  ocr_confidence REAL,
                  ocr_overwrite_enabled INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS jobs (
                  id TEXT PRIMARY KEY,
                  type TEXT,
                  status TEXT,
                  project_id TEXT,
                  page_id TEXT,
                  region_ids TEXT,
                  progress REAL,
                  created_at INTEGER,
                  updated_at INTEGER,
                  summary TEXT,
                  result_json TEXT,
                  error TEXT
                );

                CREATE TABLE IF NOT EXISTS diagnostics (
                  id TEXT PRIMARY KEY,
                  project_id TEXT NOT NULL,
                  scope TEXT NOT NULL,
                  level TEXT NOT NULL,
                  message TEXT NOT NULL,
                  timestamp INTEGER NOT NULL,
                  count INTEGER NOT NULL,
                  detail TEXT,
                  page_id TEXT,
                  region_id TEXT,
                  job_id TEXT
                );

                CREATE TABLE IF NOT EXISTS project_settings (
                  project_id TEXT PRIMARY KEY,
                  source_language TEXT NOT NULL DEFAULT 'auto',
                  target_language TEXT NOT NULL DEFAULT 'ru',
                  ocr_engine TEXT NOT NULL DEFAULT 'mock',
                  translation_provider TEXT NOT NULL DEFAULT 'mock',
                  default_text_style_id TEXT
                );

                CREATE TABLE IF NOT EXISTS text_styles (
                  id TEXT PRIMARY KEY,
                  project_id TEXT NOT NULL,
                  name TEXT NOT NULL,
                  font_family TEXT NOT NULL,
                  font_size REAL NOT NULL,
                  line_height REAL NOT NULL,
                  letter_spacing REAL NOT NULL,
                  align TEXT NOT NULL,
                  fill TEXT NOT NULL,
                  stroke TEXT NOT NULL,
                  stroke_width REAL NOT NULL
                );
                ",
            )
            .map_err(|error| error.to_string())?;

        ensure_table_column(&connection, "regions", "label", "TEXT DEFAULT ''")?;
        ensure_table_column(&connection, "regions", "kind", "TEXT DEFAULT 'speech'")?;
        ensure_table_column(&connection, "regions", "region_order", "INTEGER DEFAULT 0")?;
        ensure_table_column(
            &connection,
            "regions",
            "orientation",
            "TEXT DEFAULT 'horizontal'",
        )?;
        ensure_table_column(&connection, "regions", "source_language", "TEXT")?;
        ensure_table_column(&connection, "regions", "ocr_status", "TEXT DEFAULT 'idle'")?;
        ensure_table_column(&connection, "regions", "ocr_engine", "TEXT")?;
        ensure_table_column(&connection, "regions", "ocr_updated_at", "INTEGER")?;
        ensure_table_column(&connection, "regions", "target_language", "TEXT")?;
        ensure_table_column(
            &connection,
            "regions",
            "translation_status",
            "TEXT DEFAULT 'idle'",
        )?;
        ensure_table_column(&connection, "regions", "translation_provider", "TEXT")?;
        ensure_table_column(&connection, "regions", "translation_updated_at", "INTEGER")?;
        ensure_table_column(&connection, "regions", "notes", "TEXT DEFAULT ''")?;
        ensure_table_column(&connection, "regions", "text_style_id", "TEXT")?;
        ensure_table_column(&connection, "regions", "ocr_overwrite_enabled", "INTEGER NOT NULL DEFAULT 0")?;
        ensure_table_column(&connection, "jobs", "region_ids", "TEXT")?;
        ensure_table_column(&connection, "jobs", "summary", "TEXT")?;
        ensure_table_column(&connection, "jobs", "result_json", "TEXT")?;
        ensure_table_column(&connection, "diagnostics", "detail", "TEXT")?;

        Ok(())
    }

    pub fn list_projects(&self) -> Result<Vec<ProjectRecord>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT id, name, created_at, updated_at
                FROM projects
                ORDER BY updated_at DESC, created_at DESC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], map_project_record)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get_project(&self, id: String) -> Result<Option<ProjectRecord>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT id, name, created_at, updated_at
                FROM projects
                WHERE id = ?1
                ",
                params![id],
                map_project_record,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_project(&self, project: ProjectRecord) -> Result<ProjectRecord, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO projects (id, name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                ",
                params![project.id, project.name, project.created_at, project.updated_at],
            )
            .map_err(|error| error.to_string())?;

        Ok(project)
    }

    pub fn delete_project(&self, id: String) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;

        transaction
            .execute(
                "
                DELETE FROM regions
                WHERE page_id IN (SELECT id FROM pages WHERE project_id = ?1)
                ",
                params![id.clone()],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM jobs WHERE project_id = ?1", params![id.clone()])
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM pages WHERE project_id = ?1", params![id.clone()])
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM project_settings WHERE project_id = ?1",
                params![id.clone()],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM text_styles WHERE project_id = ?1",
                params![id.clone()],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn get_project_settings(
        &self,
        project_id: String,
    ) -> Result<Option<ProjectSettingsRecord>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT
                  project_id,
                  source_language,
                  target_language,
                  ocr_engine,
                  translation_provider,
                  default_text_style_id
                FROM project_settings
                WHERE project_id = ?1
                ",
                params![project_id],
                map_project_settings_record,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_project_settings(
        &self,
        settings: ProjectSettingsRecord,
    ) -> Result<ProjectSettingsRecord, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO project_settings (
                  project_id,
                  source_language,
                  target_language,
                  ocr_engine,
                  translation_provider,
                  default_text_style_id
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(project_id) DO UPDATE SET
                  source_language = excluded.source_language,
                  target_language = excluded.target_language,
                  ocr_engine = excluded.ocr_engine,
                  translation_provider = excluded.translation_provider,
                  default_text_style_id = excluded.default_text_style_id
                ",
                params![
                    settings.project_id,
                    settings.source_language,
                    settings.target_language,
                    settings.ocr_engine,
                    settings.translation_provider,
                    settings.default_text_style_id,
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(settings)
    }

    pub fn delete_project_settings(&self, project_id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute(
                "DELETE FROM project_settings WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_text_styles_by_project(
        &self,
        project_id: String,
    ) -> Result<Vec<TextStyleRecord>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT
                  id,
                  project_id,
                  name,
                  font_family,
                  font_size,
                  line_height,
                  letter_spacing,
                  align,
                  fill,
                  stroke,
                  stroke_width
                FROM text_styles
                WHERE project_id = ?1
                ORDER BY name ASC, id ASC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![project_id], map_text_style_record)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get_text_style(&self, id: String) -> Result<Option<TextStyleRecord>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT
                  id,
                  project_id,
                  name,
                  font_family,
                  font_size,
                  line_height,
                  letter_spacing,
                  align,
                  fill,
                  stroke,
                  stroke_width
                FROM text_styles
                WHERE id = ?1
                ",
                params![id],
                map_text_style_record,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_text_style(&self, style: TextStyleRecord) -> Result<TextStyleRecord, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO text_styles (
                  id,
                  project_id,
                  name,
                  font_family,
                  font_size,
                  line_height,
                  letter_spacing,
                  align,
                  fill,
                  stroke,
                  stroke_width
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                ON CONFLICT(id) DO UPDATE SET
                  project_id = excluded.project_id,
                  name = excluded.name,
                  font_family = excluded.font_family,
                  font_size = excluded.font_size,
                  line_height = excluded.line_height,
                  letter_spacing = excluded.letter_spacing,
                  align = excluded.align,
                  fill = excluded.fill,
                  stroke = excluded.stroke,
                  stroke_width = excluded.stroke_width
                ",
                params![
                    style.id,
                    style.project_id,
                    style.name,
                    style.font_family,
                    style.font_size,
                    style.line_height,
                    style.letter_spacing,
                    style.align,
                    style.fill,
                    style.stroke,
                    style.stroke_width,
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(style)
    }

    pub fn delete_text_style(&self, id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM text_styles WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn delete_text_styles_by_project(&self, project_id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM text_styles WHERE project_id = ?1", params![project_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_pages_by_project(&self, project_id: String) -> Result<Vec<PageRecord>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT id, project_id, page_order, image_path, width, height
                FROM pages
                WHERE project_id = ?1
                ORDER BY page_order ASC, id ASC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![project_id], map_page_record)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get_page(&self, id: String) -> Result<Option<PageRecord>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT id, project_id, page_order, image_path, width, height
                FROM pages
                WHERE id = ?1
                ",
                params![id],
                map_page_record,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_page(&self, page: PageRecord) -> Result<PageRecord, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO pages (id, project_id, page_order, image_path, width, height)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE SET
                  project_id = excluded.project_id,
                  page_order = excluded.page_order,
                  image_path = excluded.image_path,
                  width = excluded.width,
                  height = excluded.height
                ",
                params![
                    page.id,
                    page.project_id,
                    page.order,
                    page.image_path,
                    page.width,
                    page.height,
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(page)
    }

    pub fn delete_page(&self, id: String) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;

        transaction
            .execute("DELETE FROM regions WHERE page_id = ?1", params![id.clone()])
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM pages WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn delete_pages_by_project(&self, project_id: String) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;

        transaction
            .execute(
                "
                DELETE FROM regions
                WHERE page_id IN (SELECT id FROM pages WHERE project_id = ?1)
                ",
                params![project_id.clone()],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM pages WHERE project_id = ?1", params![project_id])
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn list_regions_by_page(&self, page_id: String) -> Result<Vec<RegionRecord>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT
                  id,
                  page_id,
                  x,
                  y,
                  width,
                  height,
                  rotation,
                  label,
                  kind,
                  region_order,
                  orientation,
                  source_text,
                  source_language,
                  translated_text,
                  status,
                  ocr_status,
                  ocr_engine,
                  ocr_updated_at,
                  target_language,
                  translation_status,
                  translation_provider,
                  translation_updated_at,
                  notes,
                  locked,
                  visible,
                  text_style_id,
                  ocr_confidence,
                  ocr_overwrite_enabled
                FROM regions
                WHERE page_id = ?1
                ORDER BY region_order ASC, rowid ASC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![page_id], map_region_record)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get_region(&self, id: String) -> Result<Option<RegionRecord>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT
                  id,
                  page_id,
                  x,
                  y,
                  width,
                  height,
                  rotation,
                  label,
                  kind,
                  region_order,
                  orientation,
                  source_text,
                  source_language,
                  translated_text,
                  status,
                  ocr_status,
                  ocr_engine,
                  ocr_updated_at,
                  target_language,
                  translation_status,
                  translation_provider,
                  translation_updated_at,
                  notes,
                  locked,
                  visible,
                  text_style_id,
                  ocr_confidence,
                  ocr_overwrite_enabled
                FROM regions
                WHERE id = ?1
                ",
                params![id],
                map_region_record,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_region(&self, region: RegionRecord) -> Result<RegionRecord, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO regions (
                  id,
                  page_id,
                  x,
                  y,
                  width,
                  height,
                  rotation,
                  label,
                  kind,
                  region_order,
                  orientation,
                  source_text,
                  source_language,
                  translated_text,
                  status,
                  ocr_status,
                  ocr_engine,
                  ocr_updated_at,
                  target_language,
                  translation_status,
                  translation_provider,
                  translation_updated_at,
                  notes,
                  locked,
                  visible,
                  text_style_id,
                  ocr_confidence,
                  ocr_overwrite_enabled
                )
                VALUES (
                  ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
                  ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28
                )
                ON CONFLICT(id) DO UPDATE SET
                  page_id = excluded.page_id,
                  x = excluded.x,
                  y = excluded.y,
                  width = excluded.width,
                  height = excluded.height,
                  rotation = excluded.rotation,
                  label = excluded.label,
                  kind = excluded.kind,
                  region_order = excluded.region_order,
                  orientation = excluded.orientation,
                  source_text = excluded.source_text,
                  source_language = excluded.source_language,
                  translated_text = excluded.translated_text,
                  status = excluded.status,
                  ocr_status = excluded.ocr_status,
                  ocr_engine = excluded.ocr_engine,
                  ocr_updated_at = excluded.ocr_updated_at,
                  target_language = excluded.target_language,
                  translation_status = excluded.translation_status,
                  translation_provider = excluded.translation_provider,
                  translation_updated_at = excluded.translation_updated_at,
                  notes = excluded.notes,
                  locked = excluded.locked,
                  visible = excluded.visible,
                  text_style_id = excluded.text_style_id,
                  ocr_confidence = excluded.ocr_confidence,
                  ocr_overwrite_enabled = excluded.ocr_overwrite_enabled
                ",
                params![
                    region.id,
                    region.page_id,
                    region.x,
                    region.y,
                    region.width,
                    region.height,
                    region.rotation,
                    region.label,
                    region.kind,
                    region.order,
                    region.orientation,
                    region.source_text,
                    region.source_language,
                    region.translated_text,
                    region.status,
                    region.ocr_status,
                    region.ocr_engine,
                    region.ocr_updated_at,
                    region.target_language,
                    region.translation_status,
                    region.translation_provider,
                    region.translation_updated_at,
                    region.notes,
                    bool_to_sql(region.locked),
                    bool_to_sql(region.visible),
                    region.text_style_id,
                    region.ocr_confidence,
                    bool_to_sql(region.ocr_overwrite_enabled),
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(region)
    }

    pub fn delete_region(&self, id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM regions WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn delete_regions_by_page(&self, page_id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM regions WHERE page_id = ?1", params![page_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_jobs_by_project(&self, project_id: String) -> Result<Vec<JobEntity>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT
                  id,
                  type,
                  status,
                  project_id,
                  page_id,
                  region_ids,
                  progress,
                  created_at,
                  updated_at,
                  summary,
                  result_json,
                  error
                FROM jobs
                WHERE project_id = ?1
                ORDER BY created_at DESC, id DESC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![project_id], map_job_entity)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get_job(&self, id: String) -> Result<Option<JobEntity>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "
                SELECT
                  id,
                  type,
                  status,
                  project_id,
                  page_id,
                  region_ids,
                  progress,
                  created_at,
                  updated_at,
                  summary,
                  result_json,
                  error
                FROM jobs
                WHERE id = ?1
                ",
                params![id],
                map_job_entity,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_job(&self, job: JobEntity) -> Result<JobEntity, String> {
        let connection = self.connect()?;
        let serialized_region_ids = serialize_string_list(&job.region_ids)?;
        connection
            .execute(
                "
                INSERT INTO jobs (
                  id,
                  type,
                  status,
                  project_id,
                  page_id,
                  region_ids,
                  progress,
                  created_at,
                  updated_at,
                  summary,
                  result_json,
                  error
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                ON CONFLICT(id) DO UPDATE SET
                  type = excluded.type,
                  status = excluded.status,
                  project_id = excluded.project_id,
                  page_id = excluded.page_id,
                  region_ids = excluded.region_ids,
                  progress = excluded.progress,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  summary = excluded.summary,
                  result_json = excluded.result_json,
                  error = excluded.error
                ",
                params![
                    job.id,
                    job.job_type,
                    job.status,
                    job.project_id,
                    job.page_id,
                    serialized_region_ids,
                    job.progress,
                    job.created_at,
                    job.updated_at,
                    job.summary,
                    job.result_json,
                    job.error,
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(job)
    }

    pub fn delete_job(&self, id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM jobs WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn delete_jobs_by_project(&self, project_id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM jobs WHERE project_id = ?1", params![project_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_diagnostics_by_project(
        &self,
        project_id: String,
    ) -> Result<Vec<DiagnosticEntity>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "
                SELECT
                  id,
                  project_id,
                  scope,
                  level,
                  message,
                  timestamp,
                  count,
                  detail,
                  page_id,
                  region_id,
                  job_id
                FROM diagnostics
                WHERE project_id = ?1
                ORDER BY timestamp DESC, id DESC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![project_id], map_diagnostic_entity)
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_diagnostic(&self, entry: DiagnosticEntity) -> Result<DiagnosticEntity, String> {
        let connection = self.connect()?;
        connection
            .execute(
                "
                INSERT INTO diagnostics (
                  id,
                  project_id,
                  scope,
                  level,
                  message,
                  timestamp,
                  count,
                  detail,
                  page_id,
                  region_id,
                  job_id
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                ON CONFLICT(id) DO UPDATE SET
                  project_id = excluded.project_id,
                  scope = excluded.scope,
                  level = excluded.level,
                  message = excluded.message,
                  timestamp = excluded.timestamp,
                  count = excluded.count,
                  detail = excluded.detail,
                  page_id = excluded.page_id,
                  region_id = excluded.region_id,
                  job_id = excluded.job_id
                ",
                params![
                    entry.id,
                    entry.project_id,
                    entry.scope,
                    entry.level,
                    entry.message,
                    entry.timestamp,
                    entry.count,
                    entry.detail,
                    entry.page_id,
                    entry.region_id,
                    entry.job_id,
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(entry)
    }

    pub fn delete_diagnostic(&self, id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM diagnostics WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn delete_diagnostics_by_project(&self, project_id: String) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM diagnostics WHERE project_id = ?1", params![project_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

fn map_project_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectRecord> {
    Ok(ProjectRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn map_page_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<PageRecord> {
    Ok(PageRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        order: row.get(2)?,
        image_path: row.get(3)?,
        width: row.get(4)?,
        height: row.get(5)?,
    })
}

fn map_project_settings_record(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectSettingsRecord> {
    Ok(ProjectSettingsRecord {
        project_id: row.get(0)?,
        source_language: row.get(1)?,
        target_language: row.get(2)?,
        ocr_engine: row.get(3)?,
        translation_provider: row.get(4)?,
        default_text_style_id: row.get(5)?,
    })
}

fn map_text_style_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<TextStyleRecord> {
    Ok(TextStyleRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        font_family: row.get(3)?,
        font_size: row.get(4)?,
        line_height: row.get(5)?,
        letter_spacing: row.get(6)?,
        align: row.get(7)?,
        fill: row.get(8)?,
        stroke: row.get(9)?,
        stroke_width: row.get(10)?,
    })
}

fn map_region_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<RegionRecord> {
    Ok(RegionRecord {
        id: row.get(0)?,
        page_id: row.get(1)?,
        x: row.get(2)?,
        y: row.get(3)?,
        width: row.get(4)?,
        height: row.get(5)?,
        rotation: row.get(6)?,
        label: row.get(7)?,
        kind: row.get(8)?,
        order: row.get(9)?,
        orientation: row.get(10)?,
        source_text: row.get(11)?,
        source_language: row.get(12)?,
        translated_text: row.get(13)?,
        status: row.get(14)?,
        ocr_status: row.get(15)?,
        ocr_engine: row.get(16)?,
        ocr_updated_at: row.get(17)?,
        target_language: row.get(18)?,
        translation_status: row.get(19)?,
        translation_provider: row.get(20)?,
        translation_updated_at: row.get(21)?,
        notes: row.get(22)?,
        locked: sql_to_bool(row.get::<_, i64>(23)?),
        visible: sql_to_bool(row.get::<_, i64>(24)?),
        text_style_id: row.get(25)?,
        ocr_confidence: row.get(26)?,
        ocr_overwrite_enabled: sql_to_bool(row.get::<_, i64>(27)?),
    })
}

fn map_job_entity(row: &rusqlite::Row<'_>) -> rusqlite::Result<JobEntity> {
    Ok(JobEntity {
        id: row.get(0)?,
        job_type: row.get(1)?,
        status: row.get(2)?,
        project_id: row.get(3)?,
        page_id: row.get(4)?,
        region_ids: deserialize_string_list(row.get::<_, Option<String>>(5)?),
        progress: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        summary: row.get(9)?,
        result_json: row.get(10)?,
        error: row.get(11)?,
    })
}

fn map_diagnostic_entity(row: &rusqlite::Row<'_>) -> rusqlite::Result<DiagnosticEntity> {
    Ok(DiagnosticEntity {
        id: row.get(0)?,
        project_id: row.get(1)?,
        scope: row.get(2)?,
        level: row.get(3)?,
        message: row.get(4)?,
        timestamp: row.get(5)?,
        count: row.get(6)?,
        detail: row.get(7)?,
        page_id: row.get(8)?,
        region_id: row.get(9)?,
        job_id: row.get(10)?,
    })
}

fn bool_to_sql(value: bool) -> i64 {
    if value { 1 } else { 0 }
}

fn sql_to_bool(value: i64) -> bool {
    value != 0
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

fn ensure_table_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    definition: &str,
) -> Result<(), String> {
    if table_has_column(connection, table_name, column_name)? {
        return Ok(());
    }

    let statement = format!(
        "ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
    );
    connection
        .execute(&statement, [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn serialize_string_list(values: &Option<Vec<String>>) -> Result<Option<String>, String> {
    values
        .as_ref()
        .map(|items| serde_json::to_string(items).map_err(|error| error.to_string()))
        .transpose()
}

fn deserialize_string_list(value: Option<String>) -> Option<Vec<String>> {
    value.and_then(|raw| serde_json::from_str::<Vec<String>>(&raw).ok())
}

#[tauri::command]
pub fn list_project_records(
    repository: State<'_, DomainRepository>,
) -> Result<Vec<ProjectRecord>, String> {
    repository.list_projects()
}

#[tauri::command]
pub fn get_project_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<ProjectRecord>, String> {
    repository.get_project(id)
}

#[tauri::command]
pub fn upsert_project_record(
    project: ProjectRecord,
    repository: State<'_, DomainRepository>,
) -> Result<ProjectRecord, String> {
    repository.upsert_project(project)
}

#[tauri::command]
pub fn delete_project_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_project(id)
}

#[tauri::command]
pub fn get_project_settings_record(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<ProjectSettingsRecord>, String> {
    repository.get_project_settings(project_id)
}

#[tauri::command]
pub fn upsert_project_settings_record(
    settings: ProjectSettingsRecord,
    repository: State<'_, DomainRepository>,
) -> Result<ProjectSettingsRecord, String> {
    repository.upsert_project_settings(settings)
}

#[tauri::command]
pub fn delete_project_settings_record(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_project_settings(project_id)
}

#[tauri::command]
pub fn list_text_style_records_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Vec<TextStyleRecord>, String> {
    repository.list_text_styles_by_project(project_id)
}

#[tauri::command]
pub fn get_text_style_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<TextStyleRecord>, String> {
    repository.get_text_style(id)
}

#[tauri::command]
pub fn upsert_text_style_record(
    style: TextStyleRecord,
    repository: State<'_, DomainRepository>,
) -> Result<TextStyleRecord, String> {
    repository.upsert_text_style(style)
}

#[tauri::command]
pub fn delete_text_style_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_text_style(id)
}

#[tauri::command]
pub fn delete_text_style_records_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_text_styles_by_project(project_id)
}

#[tauri::command]
pub fn list_page_records_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Vec<PageRecord>, String> {
    repository.list_pages_by_project(project_id)
}

#[tauri::command]
pub fn get_page_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<PageRecord>, String> {
    repository.get_page(id)
}

#[tauri::command]
pub fn upsert_page_record(
    page: PageRecord,
    repository: State<'_, DomainRepository>,
) -> Result<PageRecord, String> {
    repository.upsert_page(page)
}

#[tauri::command]
pub fn delete_page_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_page(id)
}

#[tauri::command]
pub fn delete_page_records_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_pages_by_project(project_id)
}

#[tauri::command]
pub fn list_region_records_by_page(
    page_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Vec<RegionRecord>, String> {
    repository.list_regions_by_page(page_id)
}

#[tauri::command]
pub fn get_region_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<RegionRecord>, String> {
    repository.get_region(id)
}

#[tauri::command]
pub fn upsert_region_record(
    region: RegionRecord,
    repository: State<'_, DomainRepository>,
) -> Result<RegionRecord, String> {
    repository.upsert_region(region)
}

#[tauri::command]
pub fn delete_region_record(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_region(id)
}

#[tauri::command]
pub fn delete_region_records_by_page(
    page_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_regions_by_page(page_id)
}

#[tauri::command]
pub fn list_job_entities_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Vec<JobEntity>, String> {
    repository.list_jobs_by_project(project_id)
}

#[tauri::command]
pub fn get_job_entity(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Option<JobEntity>, String> {
    repository.get_job(id)
}

#[tauri::command]
pub fn upsert_job_entity(
    job: JobEntity,
    repository: State<'_, DomainRepository>,
) -> Result<JobEntity, String> {
    repository.upsert_job(job)
}

#[tauri::command]
pub fn delete_job_entity(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_job(id)
}

#[tauri::command]
pub fn delete_job_entities_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_jobs_by_project(project_id)
}

#[tauri::command]
pub fn list_diagnostic_entities_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<Vec<DiagnosticEntity>, String> {
    repository.list_diagnostics_by_project(project_id)
}

#[tauri::command]
pub fn upsert_diagnostic_entity(
    entry: DiagnosticEntity,
    repository: State<'_, DomainRepository>,
) -> Result<DiagnosticEntity, String> {
    repository.upsert_diagnostic(entry)
}

#[tauri::command]
pub fn delete_diagnostic_entity(
    id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_diagnostic(id)
}

#[tauri::command]
pub fn delete_diagnostic_entities_by_project(
    project_id: String,
    repository: State<'_, DomainRepository>,
) -> Result<(), String> {
    repository.delete_diagnostics_by_project(project_id)
}
