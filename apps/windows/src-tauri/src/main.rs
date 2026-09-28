// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn get_device_identifier() -> String {
    // Return machine identifier for first-party confirmed views
    let hostname = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "windows-client".into());
    format!("win-{}", hostname)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_device_identifier])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
