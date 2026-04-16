use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Manager, WebviewUrl, WebviewWindowBuilder,
};

#[tauri::command]
fn open_tab(app: tauri::AppHandle, tab: String) -> Result<(), String> {
    let url = format!("https://hellokoto.com/kotoiq?tab={}", tab);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&format!("window.location.href = '{}'", url));
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    // Uses plugin-opener to open in system default browser
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn new_window(app: tauri::AppHandle, label: String, url: String) -> Result<(), String> {
    let _ = WebviewWindowBuilder::new(
        &app,
        label,
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title("KotoIQ")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 500.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window if user tries to launch second instance
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![open_tab, open_external, new_window])
        .setup(|app| {
            // ── Build system tray menu ────────────────────────────────
            let dashboard = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
            let keywords = MenuItem::with_id(app, "keywords", "Keywords", true, None::<&str>)?;
            let briefs = MenuItem::with_id(app, "briefs", "PageIQ Writer", true, None::<&str>)?;
            let ranks = MenuItem::with_id(app, "ranks", "Rankings", true, None::<&str>)?;
            let ask = MenuItem::with_id(app, "ask", "Ask KotoIQ…", true, Some("CmdOrCtrl+/"))?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let show_hide = MenuItem::with_id(app, "show_hide", "Show / Hide Window", true, None::<&str>)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit KotoIQ", true, Some("CmdOrCtrl+Q"))?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &dashboard, &keywords, &briefs, &ranks, &separator1,
                    &ask, &separator2, &show_hide, &quit,
                ],
            )?;

            // ── Build tray icon ───────────────────────────────────────
            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("KotoIQ — SEO Intelligence")
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    match id {
                        "quit" => {
                            app.exit(0);
                        }
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "dashboard" | "keywords" | "briefs" | "ranks" | "ask" => {
                            let url = format!("https://hellokoto.com/kotoiq?tab={}", id);
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.eval(&format!("window.location.href = '{}'", url));
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // ── Build application menu bar (macOS uses top bar) ───────
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "new_window", "New Window", true, Some("CmdOrCtrl+N"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItem::with_id(app, "nav_dashboard", "Dashboard", true, Some("CmdOrCtrl+1"))?,
                    &MenuItem::with_id(app, "nav_keywords", "Keywords", true, Some("CmdOrCtrl+2"))?,
                    &MenuItem::with_id(app, "nav_briefs", "PageIQ Writer", true, Some("CmdOrCtrl+3"))?,
                    &MenuItem::with_id(app, "nav_ranks", "Rankings", true, Some("CmdOrCtrl+4"))?,
                    &MenuItem::with_id(app, "nav_ask", "Ask KotoIQ", true, Some("CmdOrCtrl+/"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                ],
            )?;

            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[
                    &MenuItem::with_id(app, "help_docs", "Documentation…", true, None::<&str>)?,
                    &MenuItem::with_id(app, "help_support", "Support…", true, None::<&str>)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])?;
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(|app, event| {
                let id = event.id.as_ref();
                match id {
                    "new_window" => {
                        let _ = WebviewWindowBuilder::new(
                            app,
                            format!("window-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
                            WebviewUrl::External("https://hellokoto.com/kotoiq".parse().unwrap()),
                        )
                        .title("KotoIQ")
                        .inner_size(1200.0, 800.0)
                        .center()
                        .build();
                    }
                    id if id.starts_with("nav_") => {
                        let tab = id.strip_prefix("nav_").unwrap_or("dashboard");
                        let url = format!("https://hellokoto.com/kotoiq?tab={}", tab);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval(&format!("window.location.href = '{}'", url));
                        }
                    }
                    "help_docs" => {
                        let _ = open::that("https://hellokoto.com/docs");
                    }
                    "help_support" => {
                        let _ = open::that("https://hellokoto.com/support");
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
