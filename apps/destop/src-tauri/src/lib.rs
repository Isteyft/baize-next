#[cfg_attr(mobile, tauri::mobile_entry_point)]

use serde::Serialize;
use std::io::Write;
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



#[tauri::command]
fn read_json_file(path: String) -> Result<ProjectFileEntry, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("Selected path is not a file".into());
    }
    let is_json = file_path
        .extension()
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if !is_json {
        return Err("Selected file is not a JSON file".into());
    }
    let content = std::fs::read_to_string(file_path).map_err(|error| error.to_string())?;
    let relative_path = file_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    Ok(ProjectFileEntry { relative_path, content })
}

/// 将 JSON 文本写回项目内的相对路径，父目录不存在时自动创建。
#[tauri::command]
fn write_project_file(root_path: String, relative_path: String, content: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err("Project root is not a directory".into());
    }
    let relative = Path::new(&relative_path);
    if relative.is_absolute() {
        return Err("Relative path is required".into());
    }
    let target = root.join(relative);
    if !target.starts_with(root) {
        return Err("Target path escapes the project root".into());
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(&target, content).map_err(|error| error.to_string())
}


/// 读取项目内的 mod 资源图片并编码为 data URL，供前端直接展示图标。
#[tauri::command]
fn read_mod_asset(root_path: String, relative_path: String) -> Result<String, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err("Project root is not a directory".into());
    }
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let relative = Path::new(&relative_path);
    if relative.is_absolute() {
        return Err("Relative path is required".into());
    }
    let target = root.join(relative).canonicalize().map_err(|error| error.to_string())?;
    if !target.starts_with(&root) {
        return Err("Target path escapes the project root".into());
    }
    if !target.is_file() {
        return Err("Asset file does not exist".into());
    }
    let bytes = std::fs::read(&target).map_err(|error| error.to_string())?;
    let mime = match target
        .extension()
        .map(|ext| ext.to_string_lossy().to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };
    Ok(format!("data:{};base64,{}", mime, base64_encode(&bytes)))
}

/// 以标准字母表对字节进行 base64 编码，避免额外依赖。
fn base64_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        output.push(ALPHABET[((triple >> 18) & 0x3f) as usize] as char);
        output.push(ALPHABET[((triple >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            output.push(ALPHABET[((triple >> 6) & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
        if chunk.len() > 2 {
            output.push(ALPHABET[(triple & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
    }
    output
}

fn error_log_path() -> Result<std::path::PathBuf, String> {
    std::env::current_dir()
        .map(|dir| dir.join("error.log"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn reset_error_log() -> Result<(), String> {
    let path = error_log_path()?;
    std::fs::write(&path, "").map_err(|error| error.to_string())
}

#[tauri::command]
fn append_error_log(content: String) -> Result<(), String> {
    let path = error_log_path()?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(content.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_error_log() -> Result<String, String> {
    let path = error_log_path()?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_project_files,
            read_json_file,
            write_project_file,
            read_mod_asset,
            reset_error_log,
            append_error_log,
            read_error_log
        ])
        .run(tauri::generate_context!())
        .expect("failed to run baize-next-destop");
}
