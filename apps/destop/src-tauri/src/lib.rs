#[cfg_attr(mobile, tauri::mobile_entry_point)]

use serde::Serialize;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};

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

fn resolve_project_target(root_path: &str, relative_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = Path::new(root_path);
    if !root.is_dir() {
        return Err("Project root is not a directory".into());
    }
    let relative = Path::new(relative_path);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Target path escapes the project root".into());
    }
    let target = root.join(relative);
    if !target.starts_with(root) {
        return Err("Target path escapes the project root".into());
    }
    Ok((root.to_path_buf(), target))
}

/// 将 JSON 文本写回项目内的相对路径，父目录不存在时自动创建。
#[tauri::command]
fn write_project_file(root_path: String, relative_path: String, content: String) -> Result<(), String> {
    let (_root, target) = resolve_project_target(&root_path, &relative_path)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(&target, content).map_err(|error| error.to_string())
}

/// 删除项目内的相对 JSON 文件；文件已不存在时视为成功。
#[tauri::command]
fn delete_project_file(root_path: String, relative_path: String) -> Result<(), String> {
    let (_root, target) = resolve_project_target(&root_path, &relative_path)?;
    if target.exists() {
        if !target.is_file() {
            return Err("Target path is not a file".into());
        }
        std::fs::remove_file(&target).map_err(|error| error.to_string())?;
    }
    Ok(())
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

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn app_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app_data_dir(app).map(|directory| directory.join("settings.json"))
}

fn error_log_path(app: &AppHandle) -> Result<PathBuf, String> {
    app_data_dir(app).map(|directory| directory.join("error.log"))
}

#[tauri::command]
fn read_app_settings(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = app_settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn write_app_settings(app: AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let path = app_settings_path(&app)?;
    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    std::fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn reset_error_log(app: AppHandle) -> Result<(), String> {
    let path = error_log_path(&app)?;
    std::fs::write(&path, "").map_err(|error| error.to_string())
}

#[tauri::command]
fn append_error_log(app: AppHandle, content: String) -> Result<(), String> {
    let path = error_log_path(&app)?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(content.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_error_log(app: AppHandle) -> Result<String, String> {
    let path = error_log_path(&app)?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path).map_err(|error| error.to_string())
}

/// 单条聊天消息（OpenAI 兼容）。
/// 支持可选的 `content`（可为 null，用于带 tool_calls 的 assistant 消息）与 `tool_calls`。
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageInput {
    role: String,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<ToolCallInput>>,
    #[serde(default)]
    tool_call_id: Option<String>,
}

/// 一条工具调用（assistant 发起的 function call）。
#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ToolCallInput {
    id: String,
    #[serde(rename = "type")]
    call_type: String,
    function: FunctionCallInput,
}

/// 工具调用的函数名与参数（JSON 字符串）。
#[derive(Serialize, serde::Deserialize, Clone)]
struct FunctionCallInput {
    name: String,
    arguments: String,
}

/// 传给模型可用的工具定义（OpenAI 兼容 function calling）。
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolInput {
    #[serde(rename = "type")]
    tool_type: String,
    function: serde_json::Value,
}

/// 去掉 baseURL 末尾斜杠，避免拼出双斜杠。
fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

/// 拼接 OpenAI 兼容的 chat/completions 地址。
fn build_chat_url(base_url: &str) -> String {
    let normalized = normalize_base_url(base_url);
    if normalized.to_ascii_lowercase().ends_with("/chat/completions") {
        normalized
    } else {
        format!("{}/chat/completions", normalized)
    }
}

/// 一次对话的返回结果：文本内容 + 可选的工具调用列表。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatCompletionResult {
    content: String,
    tool_calls: Vec<ToolCallInput>,
}

/// 将单个消息序列化为 OpenAI 兼容的消息体，支持 content 为 null 与 tool_calls。
fn message_to_json(message: &ChatMessageInput) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    obj.insert("role".into(), serde_json::Value::String(message.role.clone()));
    match &message.content {
        Some(content) => {
            // content 为空串时统一转 null：OpenAI/Kimi 协议中 content 应用 null 表示“无文本内容”，
            // 空串 "" 会被部分模型（如 Kimi coding 接口）以「assistant must not be empty」拒绝。
            if content.is_empty() {
                obj.insert("content".into(), serde_json::Value::Null);
            } else {
                obj.insert("content".into(), serde_json::Value::String(content.clone()));
            }
        }
        None => {
            obj.insert("content".into(), serde_json::Value::Null);
        }
    }
    if let Some(tool_call_id) = &message.tool_call_id {
        obj.insert("tool_call_id".into(), serde_json::Value::String(tool_call_id.clone()));
    }
    if let Some(tool_calls) = &message.tool_calls {
        let calls = tool_calls
            .iter()
            .map(|call| {
                serde_json::json!({
                    "id": call.id,
                    "type": call.call_type,
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                })
            })
            .collect::<Vec<_>>();
        obj.insert("tool_calls".into(), serde_json::Value::Array(calls));
    }
    serde_json::Value::Object(obj)
}

/// 通过 Rust 后端转发大模型请求，绕开浏览器 CORS 限制。
/// 支持 tools（function calling）；返回文本内容与工具调用列表。
#[tauri::command]
async fn chat_completion(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessageInput>,
    tools: Option<Vec<ToolInput>>,
) -> Result<ChatCompletionResult, String> {
    let url = build_chat_url(&base_url);

    // 先校验 URL 是否合法，避免 reqwest 抛出笼统的 builder error。
    let parsed = reqwest::Url::parse(&url)
        .map_err(|_| format!("Base URL 不合法：{url}。请确认已包含 http:// 或 https:// 前缀，例如 https://api.moonshot.cn/v1"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!("Base URL 协议不支持：{}。仅支持 http/https", parsed.scheme()));
    }

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages.iter().map(message_to_json).collect::<Vec<_>>(),
        "stream": false,
    });
    if let Some(tools) = tools {
        let tool_defs = tools
            .iter()
            .map(|tool| serde_json::json!({ "type": tool.tool_type, "function": tool.function }))
            .collect::<Vec<_>>();
        if !tool_defs.is_empty() {
            body["tools"] = serde_json::Value::Array(tool_defs);
        }
    }

    let client = reqwest::Client::new();
    let response = client
        .post(url.clone())
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("请求失败（URL={}）：{}", url, error))?;

    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        return Err(format!("请求失败（{}）URL={}：{}", status.as_u16(), url, detail));
    }

    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    let message = &data["choices"][0]["message"];
    let content = message["content"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    // 解析工具调用列表。
    let mut tool_calls: Vec<ToolCallInput> = Vec::new();
    if let Some(calls) = message["tool_calls"].as_array() {
        for call in calls {
            let id = call["id"].as_str().unwrap_or_default().to_string();
            let call_type = call["type"].as_str().unwrap_or("function").to_string();
            let name = call["function"]["name"].as_str().unwrap_or_default().to_string();
            let arguments = call["function"]["arguments"]
                .as_str()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("{}")
                .to_string();
            tool_calls.push(ToolCallInput {
                id,
                call_type,
                function: FunctionCallInput { name, arguments },
            });
        }
    }

    Ok(ChatCompletionResult { content, tool_calls })
}

/// 默认会话目录：可执行文件所在目录下的 `.bz-chat`。
fn default_chat_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let parent = exe
        .parent()
        .ok_or_else(|| "无法定位可执行文件所在目录".to_string())?;
    Ok(parent.join(".bz-chat"))
}

/// 校验会话目录：必须存在且为目录，否则返回错误。
fn resolve_chat_dir(dir: &str) -> Result<PathBuf, String> {
    let path = Path::new(dir);
    if !path.is_dir() {
        return Err("会话目录不存在或不是目录".into());
    }
    Ok(path.to_path_buf())
}

/// 校验会话文件名：仅允许安全字符，杜绝路径穿越与非法文件名。
fn is_safe_session_filename(name: &str) -> bool {
    !name.is_empty()
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && !name.starts_with('.')
}

/// 从会话目录读取会话文件名（去掉 .json 后缀），并按更新时间倒序排列。
fn list_session_ids(dir: &Path) -> Result<Vec<String>, String> {
    let mut ids = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|error| error.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else { continue };
        if !file_type.is_file() {
            continue;
        }
        let Some(name) = path.file_name().map(|v| v.to_string_lossy().into_owned()) else {
            continue;
        };
        if !name.ends_with(".json") {
            continue;
        }
        let id = name.trim_end_matches(".json").to_string();
        if !is_safe_session_filename(&id) {
            continue;
        }
        ids.push(id);
    }
    Ok(ids)
}

/// 返回默认会话保存目录（可执行文件所在目录下的 `.bz-chat`）。
#[tauri::command]
fn get_default_chat_dir() -> Result<String, String> {
    Ok(default_chat_dir()?.to_string_lossy().into_owned())
}

/// 读取会话目录下所有会话的完整内容（文件名 + JSON 文本）。
/// 目录不存在时返回空列表。
#[tauri::command]
fn read_chat_sessions(dir: String) -> Result<Vec<ProjectFileEntry>, String> {
    let path = Path::new(&dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let root = resolve_chat_dir(&dir)?;
    let ids = list_session_ids(&root)?;
    let mut files = Vec::with_capacity(ids.len());
    for id in ids {
        let file_path = root.join(format!("{id}.json"));
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            files.push(ProjectFileEntry { relative_path: id, content });
        }
    }
    Ok(files)
}

/// 将单个会话写入会话目录下的 `{id}.json`，父目录不存在时自动创建。
#[tauri::command]
fn write_chat_session(dir: String, id: String, content: String) -> Result<(), String> {
    if !is_safe_session_filename(&id) {
        return Err("会话 id 不合法".into());
    }
    let root = resolve_chat_dir(&dir)?;
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let target = root.join(format!("{id}.json"));
    std::fs::write(&target, content).map_err(|error| error.to_string())
}

/// 删除会话目录下的 `{id}.json`；文件不存在时视为成功。
#[tauri::command]
fn delete_chat_session(dir: String, id: String) -> Result<(), String> {
    if !is_safe_session_filename(&id) {
        return Err("会话 id 不合法".into());
    }
    let root = resolve_chat_dir(&dir)?;
    let target = root.join(format!("{id}.json"));
    if target.exists() {
        if !target.is_file() {
            return Err("目标路径不是文件".into());
        }
        std::fs::remove_file(&target).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_project_files,
            read_json_file,
            write_project_file,
            delete_project_file,
            read_mod_asset,
            read_app_settings,
            write_app_settings,
            reset_error_log,
            append_error_log,
            read_error_log,
            chat_completion,
            get_default_chat_dir,
            read_chat_sessions,
            write_chat_session,
            delete_chat_session
        ])
        .run(tauri::generate_context!())
        .expect("failed to run baize-next-destop");
}
