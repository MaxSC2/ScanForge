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
pub struct RegionRecord {
    pub id: String,
    pub page_id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub source_text: String,
    pub translated_text: String,
    pub status: String,
    pub locked: bool,
    pub visible: bool,
    pub ocr_confidence: Option<f64>,
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
    pub progress: f64,
    pub created_at: i64,
    pub updated_at: i64,
    pub error: Option<String>,
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
                  source_text TEXT,
                  translated_text TEXT,
                  status TEXT,
                  locked INTEGER,
                  visible INTEGER,
                  ocr_confidence REAL
                );

                CREATE TABLE IF NOT EXISTS jobs (
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
                ",
            )
            .map_err(|error| error.to_string())?;

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
            .execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
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
                  source_text,
                  translated_text,
                  status,
                  locked,
                  visible,
                  ocr_confidence
                FROM regions
                WHERE page_id = ?1
                ORDER BY rowid ASC
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
                  source_text,
                  translated_text,
                  status,
                  locked,
                  visible,
                  ocr_confidence
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
                  source_text,
                  translated_text,
                  status,
                  locked,
                  visible,
                  ocr_confidence
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                ON CONFLICT(id) DO UPDATE SET
                  page_id = excluded.page_id,
                  x = excluded.x,
                  y = excluded.y,
                  width = excluded.width,
                  height = excluded.height,
                  rotation = excluded.rotation,
                  source_text = excluded.source_text,
                  translated_text = excluded.translated_text,
                  status = excluded.status,
                  locked = excluded.locked,
                  visible = excluded.visible,
                  ocr_confidence = excluded.ocr_confidence
                ",
                params![
                    region.id,
                    region.page_id,
                    region.x,
                    region.y,
                    region.width,
                    region.height,
                    region.rotation,
                    region.source_text,
                    region.translated_text,
                    region.status,
                    bool_to_sql(region.locked),
                    bool_to_sql(region.visible),
                    region.ocr_confidence,
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
                SELECT id, type, status, project_id, page_id, progress, created_at, updated_at, error
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
                SELECT id, type, status, project_id, page_id, progress, created_at, updated_at, error
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
        connection
            .execute(
                "
                INSERT INTO jobs (
                  id,
                  type,
                  status,
                  project_id,
                  page_id,
                  progress,
                  created_at,
                  updated_at,
                  error
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(id) DO UPDATE SET
                  type = excluded.type,
                  status = excluded.status,
                  project_id = excluded.project_id,
                  page_id = excluded.page_id,
                  progress = excluded.progress,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  error = excluded.error
                ",
                params![
                    job.id,
                    job.job_type,
                    job.status,
                    job.project_id,
                    job.page_id,
                    job.progress,
                    job.created_at,
                    job.updated_at,
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

fn map_region_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<RegionRecord> {
    Ok(RegionRecord {
        id: row.get(0)?,
        page_id: row.get(1)?,
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
}

fn map_job_entity(row: &rusqlite::Row<'_>) -> rusqlite::Result<JobEntity> {
    Ok(JobEntity {
        id: row.get(0)?,
        job_type: row.get(1)?,
        status: row.get(2)?,
        project_id: row.get(3)?,
        page_id: row.get(4)?,
        progress: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        error: row.get(8)?,
    })
}

fn bool_to_sql(value: bool) -> i64 {
    if value { 1 } else { 0 }
}

fn sql_to_bool(value: i64) -> bool {
    value != 0
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
