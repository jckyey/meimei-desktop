use tauri::{
    menu::{Menu, MenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default()
            .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION)
            .build())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示 Meimei", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "隐藏 Meimei", true, None::<&str>)?;
            let check = MenuItem::with_id(app, "check-update", "检查更新", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let mut action_items = Vec::new();
            for (id, label) in [
                ("idle", "待机"), ("run-right", "向右跑"), ("run-left", "向左跑"),
                ("wave", "挥手"), ("jump", "跳跃"), ("failed", "失落"),
                ("waiting", "等待"), ("working", "忙碌"), ("review", "观察"),
            ] {
                action_items.push(MenuItem::with_id(app, id, label, true, None::<&str>)?);
            }
            let action_refs: Vec<&dyn tauri::menu::IsMenuItem<_>> = action_items
                .iter()
                .map(|item| item as &dyn tauri::menu::IsMenuItem<_>)
                .collect();
            let actions = Submenu::with_items(app, "动作预览", true, &action_refs)?;
            let menu = Menu::with_items(app, &[&show, &hide, &actions, &check, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("app icon").clone())
                .tooltip("Meimei")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    action => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                        let _ = app.emit("pet-action", action.to_string());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Meimei failed to start");
}
