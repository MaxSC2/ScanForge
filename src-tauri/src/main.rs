mod ocr;
mod storage;

use ocr::run_page_ocr;
use std::io;
use storage::{
    list_project_summaries, load_latest_project_snapshot, load_project_snapshot,
    save_project_snapshot, ProjectRepository,
};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            let repository = ProjectRepository::new(&handle).map_err(io::Error::other)?;
            app.manage(repository);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_project_snapshot,
            load_project_snapshot,
            load_latest_project_snapshot,
            list_project_summaries,
            run_page_ocr
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScanForge");
}
