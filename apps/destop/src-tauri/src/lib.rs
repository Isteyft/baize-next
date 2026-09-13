#[cfg_attr(mobile, tauri::mobile_entry_point)]

/**
 * 启动 Tauri 应用。
 * 当前未注册自定义命令；窗口配置与权限由 tauri.conf.json / capabilities 管理。
 */
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run baize-next-destop");
}
