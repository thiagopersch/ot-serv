//! Start screen shown when the editor opens (like RME's welcome dialog): new map, open map,
//! settings and the history of opened maps.

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText};

use crate::app::{App, Pending};
use crate::i18n::t;

enum Action {
    New,
    Open,
    Settings,
    Recent(PathBuf),
    Remove(PathBuf),
    PruneMissing,
}

impl App {
    pub fn welcome_window(&mut self, ctx: &egui::Context) {
        if !self.welcome {
            return;
        }
        // First run without valid paths: the settings dialog comes first.
        if self.assets.is_none() && (self.load_error.is_some() || self.settings.paths.missing().is_some()) {
            return;
        }
        let mut open = true;
        let mut action = None;
        let mut show_changed = false;
        egui::Window::new(t("welcome-title"))
            .id(egui::Id::new("welcome"))
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .fixed_size([740.0, 400.0])
            .show(ctx, |ui| {
                ui.horizontal_top(|ui| {
                    // ---- left: identity + actions
                    ui.allocate_ui_with_layout(egui::vec2(240.0, 400.0), egui::Layout::top_down(egui::Align::Center), |ui| {
                        ui.set_width(240.0);
                        ui.add_space(12.0);
                        let (r, _) = ui.allocate_exact_size(egui::vec2(84.0, 84.0), egui::Sense::hover());
                        ui.painter().circle_filled(r.center(), 42.0, Color32::from_rgb(28, 74, 110));
                        ui.painter().circle_stroke(r.center(), 42.0, egui::Stroke::new(2.0f32, Color32::from_rgb(90, 170, 230)));
                        ui.painter().text(r.center(), egui::Align2::CENTER_CENTER, "🐟", egui::FontId::proportional(44.0), Color32::WHITE);
                        ui.add_space(8.0);
                        ui.label(RichText::new("PeixolaMapEditor").size(20.0).strong());
                        ui.label(RichText::new(format!("{} {}", t("welcome-version"), env!("CARGO_PKG_VERSION"))).weak());
                        ui.add_space(22.0);
                        let size = egui::vec2(200.0, 34.0);
                        if ui.add_sized(size, egui::Button::new(RichText::new(format!("🗋  {}", t("welcome-new"))).size(15.0))).clicked() {
                            action = Some(Action::New);
                        }
                        ui.add_space(4.0);
                        if ui.add_sized(size, egui::Button::new(RichText::new(format!("🗁  {}", t("welcome-open"))).size(15.0))).clicked() {
                            action = Some(Action::Open);
                        }
                        ui.add_space(4.0);
                        if ui.add_sized(size, egui::Button::new(RichText::new(format!("⚙  {}", t("welcome-settings"))).size(15.0))).clicked() {
                            action = Some(Action::Settings);
                        }
                        ui.add_space(18.0);
                        show_changed = ui.checkbox(&mut self.settings.show_welcome, t("welcome-show-startup")).changed();
                    });
                    ui.separator();
                    // ---- right: history
                    ui.vertical(|ui| {
                        ui.horizontal(|ui| {
                            ui.heading(t("welcome-recent"));
                            let any_missing = self.settings.recent.iter().any(|p| !p.is_file());
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                if any_missing && ui.link(t("welcome-prune")).clicked() {
                                    action = Some(Action::PruneMissing);
                                }
                            });
                        });
                        ui.separator();
                        if self.settings.recent.is_empty() {
                            ui.add_space(30.0);
                            ui.vertical_centered(|ui| ui.label(RichText::new(t("welcome-recent-empty")).weak()));
                            return;
                        }
                        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
                            for p in &self.settings.recent {
                                let exists = p.is_file();
                                let name = p.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_else(|| p.display().to_string());
                                ui.horizontal(|ui| {
                                    let w = ui.available_width() - 28.0;
                                    let mut title = RichText::new(&name).strong().size(14.0);
                                    let mut sub = RichText::new(p.display().to_string()).small().weak();
                                    if !exists {
                                        title = title.color(Color32::GRAY).strikethrough();
                                        sub = RichText::new(format!("{}  {}", p.display(), t("welcome-not-found"))).small().color(Color32::from_rgb(220, 120, 100));
                                    }
                                    let r = ui
                                        .allocate_ui(egui::vec2(w, 36.0), |ui| {
                                            ui.set_width(w);
                                            let resp = ui.vertical(|ui| {
                                                ui.label(title);
                                                ui.label(sub);
                                            });
                                            resp.response
                                        })
                                        .inner;
                                    let resp = ui.interact(r.rect, ui.id().with(p), egui::Sense::click());
                                    if resp.hovered() {
                                        ui.painter().rect_filled(r.rect.expand(2.0), 4.0, Color32::from_white_alpha(14));
                                    }
                                    if resp.on_hover_cursor(egui::CursorIcon::PointingHand).on_hover_text(t("welcome-open-recent-tip")).clicked() {
                                        action = Some(Action::Recent(p.clone()));
                                    }
                                    if ui.small_button("✖").on_hover_text(t("welcome-remove-tip")).clicked() {
                                        action = Some(Action::Remove(p.clone()));
                                    }
                                });
                                ui.add_space(4.0);
                            }
                        });
                    });
                });
            });
        if show_changed {
            self.settings.save();
        }
        if !open {
            self.welcome = false;
        }
        match action {
            Some(Action::New) => {
                self.welcome = false;
                self.request(ctx, Pending::New);
            }
            Some(Action::Open) => {
                if self.is_dirty() {
                    self.welcome = false;
                    self.request(ctx, Pending::Open);
                } else if self.open_dialog() {
                    self.welcome = false;
                }
            }
            Some(Action::Settings) => self.dialogs.settings = true,
            Some(Action::Recent(p)) => {
                if !p.is_file() {
                    self.toast(ctx, format!("{}: {}", t("welcome-not-found-toast"), p.display()), true);
                } else if self.is_dirty() {
                    self.toast(ctx, t("toast-save-first"), true);
                } else {
                    self.welcome = false;
                    self.start_map_load(p);
                }
            }
            Some(Action::Remove(p)) => {
                self.settings.remove_recent(&p);
                self.settings.save();
            }
            Some(Action::PruneMissing) => {
                self.settings.prune_missing_recent();
                self.settings.save();
            }
            None => {}
        }
    }
}
