mod domain_storage;
mod ocr;
mod storage;
mod translation;

use domain_storage::{
    delete_diagnostic_entities_by_project, delete_diagnostic_entity,
    delete_job_entities_by_project, delete_job_entity, delete_page_record,
    delete_page_records_by_project, delete_project_record, delete_project_settings_record,
    delete_region_record, delete_region_records_by_page, delete_text_style_record,
    delete_text_style_records_by_project, get_job_entity, get_page_record, get_project_record,
    get_project_settings_record, get_region_record, get_text_style_record,
    list_diagnostic_entities_by_project, list_job_entities_by_project,
    list_page_records_by_project, list_project_records, list_region_records_by_page,
    list_text_style_records_by_project, upsert_diagnostic_entity, upsert_job_entity,
    upsert_page_record, upsert_project_record, upsert_project_settings_record,
    upsert_region_record, upsert_text_style_record, DomainRepository,
};
use ocr::run_page_ocr;
use std::io;
use storage::{
    list_project_summaries, load_latest_project_snapshot, load_project_snapshot,
    save_project_snapshot, ProjectRepository,
};
use tauri::Manager;
use translation::run_page_translation;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            let repository = ProjectRepository::new(&handle).map_err(io::Error::other)?;
            let domain_repository =
                DomainRepository::new(&handle).map_err(io::Error::other)?;
            app.manage(repository);
            app.manage(domain_repository);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_project_snapshot,
            load_project_snapshot,
            load_latest_project_snapshot,
            list_project_summaries,
            list_project_records,
            get_project_record,
            upsert_project_record,
            delete_project_record,
            get_project_settings_record,
            upsert_project_settings_record,
            delete_project_settings_record,
            list_text_style_records_by_project,
            get_text_style_record,
            upsert_text_style_record,
            delete_text_style_record,
            delete_text_style_records_by_project,
            list_page_records_by_project,
            get_page_record,
            upsert_page_record,
            delete_page_record,
            delete_page_records_by_project,
            list_region_records_by_page,
            get_region_record,
            upsert_region_record,
            delete_region_record,
            delete_region_records_by_page,
            list_job_entities_by_project,
            get_job_entity,
            upsert_job_entity,
            delete_job_entity,
            delete_job_entities_by_project,
            list_diagnostic_entities_by_project,
            upsert_diagnostic_entity,
            delete_diagnostic_entity,
            delete_diagnostic_entities_by_project,
            run_page_ocr,
            run_page_translation
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScanForge");
}
