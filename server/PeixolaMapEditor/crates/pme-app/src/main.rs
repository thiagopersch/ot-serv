#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! PeixolaMapEditor — OpenTibia map editor (RME-compatible) written in Rust.

mod app;
mod assets;
mod atlas;
mod browse;
mod brush_edit_std;
mod brush_editor;
mod canvas;
mod i18n;
mod icons;
mod inspector;
mod light;
mod minimap;
mod outfit;
mod palette;
mod pending;
mod properties;
mod replace;
mod scatter_ui;
mod settings;
mod view;
mod welcome;
mod widgets;

use std::path::PathBuf;

fn main() -> eframe::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    // Optional: a map path as the first argument (also works with "Open with...").
    let open = std::env::args().nth(1).map(PathBuf::from).filter(|p| p.is_file());

    let options = eframe::NativeOptions {
        renderer: eframe::Renderer::Wgpu,
        viewport: eframe::egui::ViewportBuilder::default()
            .with_title("PeixolaMapEditor")
            .with_inner_size([1600.0, 950.0])
            .with_min_inner_size([900.0, 600.0])
            .with_maximized(true),
        vsync: true,
        ..Default::default()
    };
    eframe::run_native("PeixolaMapEditor", options, Box::new(move |cc| Ok(Box::new(app::App::new(cc, open)))))
}
