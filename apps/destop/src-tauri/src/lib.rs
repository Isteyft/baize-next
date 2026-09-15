#[cfg_attr(mobile, tauri::mobile_entry_point)]

use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileEntry {
    relative_path: String,
    content: String,
}

fn collect_json_files(dir: &Path, root: &Path, files: &mut Vec<ProjectFileEntry>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else { continue };
        if file_type.is_dir() {
            collect_json_files(&path, root, files);
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let is_json = path
            .extension()
            .map(|ext| ext.eq_ignore_ascii_case("json"))
            .unwrap_or(false);
        if !is_json {
            continue;
        }
        let relative_path = path
            .strip_prefix(root)
            .ok()
            .map(|value| value.to_string_lossy().replace('\\', "/"));
        let content = std::fs::read_to_string(&path).ok();
        if let (Some(relative_path), Some(content)) = (relative_path, content) {
            files.push(ProjectFileEntry { relative_path, content });
        }
    }
}

#[tauri::command]
fn read_project_files(root_path: String) -> Result<Vec<ProjectFileEntry>, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err("Selected path is not a directory".into());
    }
    let mut files = Vec::new();
    collect_json_files(root, root, &mut files);
    Ok(files)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_project_files])
        .run(tauri::generate_context!())
        .expect("failed to run baize-next-destop");
}
