// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The desktop app is a thin native shell around apps/web — all business
    // logic, calendar rendering, and API calls happen in the same React
    // code that runs on the web. This keeps web/desktop/mobile behavior
    // consistent per the architecture requirement to share business logic.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Calendar & Scheduling desktop app");
}
