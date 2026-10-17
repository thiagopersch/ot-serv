//! Right panel: minimap and tile / item properties.

use eframe::egui::{self, Color32, RichText, Sense, Vec2};
use pme_core::item::Item;
use pme_core::tile::flags;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::view;

impl App {
    pub fn inspector_ui(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        ui.add_space(4.0);
        egui::CollapsingHeader::new(RichText::new(t("minimap")).strong()).default_open(true).show(ui, |ui| {
            let (Some(ed), Some(a)) = (&self.editor, &self.assets) else { return };
            let center = self.cam.center(self.canvas_rect);
            let view_tiles = self.canvas_rect.size() / (view::TILE * self.cam.zoom);
            if let Some(p) = self.minimap.ui(ui, &ed.map, &a.db, center, view_tiles) {
                self.cam.center_on(self.canvas_rect, p);
            }
            ui.label(RichText::new(t("minimap-help")).weak().small());
        });
        ui.separator();
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| self.tile_properties(ctx, ui));
    }

    fn tile_properties(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        let frame = self.anim_frame(ctx);
        let mut open_window: Option<usize> = None;
        ui.label(RichText::new(t("props-tile")).strong());
        let Some(pos) = self.inspect else {
            ui.label(RichText::new(t("props-none")).weak());
            return;
        };
        let (Some(ed), Some(a)) = (&mut self.editor, &self.assets) else { return };
        // Work on an editable copy; "Apply" commits it as one undoable change.
        if self.inspect_edit.as_ref().is_none_or(|(p, _)| *p != pos) {
            self.inspect_edit = Some((pos, ed.map.get(pos).cloned().unwrap_or_default()));
            self.inspect_item = None;
        }
        let (_, tile) = self.inspect_edit.as_mut().unwrap();
        let original = ed.map.get(pos).cloned().unwrap_or_default();
        ui.horizontal(|ui| {
            ui.label(RichText::new(format!("{pos}")).monospace());
            if ui.small_button("📋").on_hover_text(t("ctx-copy-position")).clicked() {
                ctx.copy_text(format!("{}, {}, {}", pos.x, pos.y, pos.z));
            }
        });

        // Zones
        ui.horizontal_wrapped(|ui| {
            for (bit, key) in [(flags::PROTECTION_ZONE, "zone-pz"), (flags::NO_PVP, "zone-nopvp"), (flags::NO_LOGOUT, "zone-nologout"), (flags::PVP_ZONE, "zone-pvp")] {
                let mut on = tile.flags & bit != 0;
                if ui.checkbox(&mut on, t(key)).changed() {
                    if on {
                        if bit & flags::EXCLUSIVE != 0 {
                            tile.flags &= !flags::EXCLUSIVE;
                        }
                        tile.flags |= bit;
                    } else {
                        tile.flags &= !bit;
                    }
                }
            }
        });
        ui.horizontal(|ui| {
            ui.label(t("props-house"));
            ui.add(egui::DragValue::new(&mut tile.house_id).range(0..=u32::MAX));
            if tile.house_id != 0 {
                ui.label(RichText::new(ed.map.house(tile.house_id).map(|h| h.name.clone()).unwrap_or_else(|| "?".into())).weak());
            }
        });
        if tile.spawn_radius > 0 {
            ui.horizontal(|ui| {
                ui.label(t("props-spawn-radius"));
                ui.add(egui::DragValue::new(&mut tile.spawn_radius).range(0..=50));
            });
        }
        if let Some(c) = &mut tile.creature {
            ui.horizontal(|ui| {
                ui.label(RichText::new(format!("👤 {}", c.name)).color(Color32::from_rgb(255, 190, 120)));
                ui.label(t("settings-spawn-time"));
                ui.add(egui::DragValue::new(&mut c.spawn_time).range(1..=86400));
            });
        }
        ui.separator();

        // Item stack (top first, like RME's browse field)
        ui.label(RichText::new(tf("props-items", &[&tile.item_count()])).strong());
        let n = tile.items.len();
        ui.label(RichText::new(t("props-dblclick-hint")).small().weak());
        let mut action: Option<(usize, i32)> = None; // (index, -1 up / +1 down / 0 remove)
        let entries: Vec<(Option<usize>, u16)> = tile.items.iter().enumerate().rev().map(|(i, it)| (Some(i), it.id)).chain(tile.ground.iter().map(|g| (None, g.id))).collect();
        for (idx, id) in entries {
            let key = idx.map(|i| i + 1).unwrap_or(0);
            let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 30.0), Sense::click());
            if self.inspect_item == Some(key) || resp.hovered() {
                ui.painter().rect_filled(rect, 3.0, if self.inspect_item == Some(key) { Color32::from_rgb(40, 110, 170) } else { Color32::from_gray(50) });
            }
            if let Some(atlas) = &mut self.atlas {
                view::paint_item_icon(ctx, ui.painter(), atlas, &a.db, id, egui::Rect::from_min_size(rect.min, Vec2::splat(30.0)), frame);
            }
            let label = format!("{} [{id}]{}", a.db.name(id), if idx.is_none() { format!("  ({})", t("props-ground")) } else { String::new() });
            ui.painter().text(egui::pos2(rect.min.x + 36.0, rect.center().y), egui::Align2::LEFT_CENTER, label, egui::FontId::proportional(13.0), ui.visuals().text_color());
            if resp.clicked() {
                self.inspect_item = Some(key);
            }
            if resp.double_clicked() {
                open_window = Some(key);
            }
        }
        if tile.item_count() == 0 {
            ui.label(RichText::new(t("props-empty")).weak());
        }

        // Selected item editor
        if let Some(key) = self.inspect_item {
            let item: Option<&mut Item> = if key == 0 { tile.ground.as_mut() } else { tile.items.get_mut(key - 1) };
            if let Some(item) = item {
                ui.separator();
                let ty = a.db.get(item.id).cloned().unwrap_or_default();
                ui.horizontal(|ui| {
                    ui.label(RichText::new(format!("{} [{}]", ty.name, item.id)).strong());
                    if ui.small_button(format!("\u{1F5D7} {}", t("props-open-window"))).clicked() {
                        open_window = Some(key);
                    }
                });
                egui::Grid::new("itemprops").num_columns(2).spacing([8.0, 4.0]).show(ui, |ui| {
                    let mut aid = item.action_id();
                    ui.label(t("props-action-id"));
                    if ui.add(egui::DragValue::new(&mut aid)).changed() {
                        item.set_action_id(aid);
                    }
                    ui.end_row();
                    let mut uid = item.unique_id();
                    ui.label(t("props-unique-id"));
                    if ui.add(egui::DragValue::new(&mut uid)).changed() {
                        item.set_unique_id(uid);
                    }
                    ui.end_row();
                    if ty.has_subtype() {
                        let mut c = item.subtype() as u8;
                        ui.label(if ty.is_stackable() { t("props-count") } else { t("props-fluid") });
                        if ui.add(egui::DragValue::new(&mut c).range(0..=100)).changed() {
                            item.set_attr_count(c);
                        }
                        ui.end_row();
                    }
                    if ty.is_door() {
                        let mut d = item.door_id();
                        ui.label(t("props-door-id"));
                        if ui.add(egui::DragValue::new(&mut d)).changed() {
                            item.set_door_id(d);
                        }
                        ui.end_row();
                    }
                    if ty.is_depot() {
                        let mut d = item.depot_id();
                        ui.label(t("props-depot-id"));
                        if ui.add(egui::DragValue::new(&mut d)).changed() {
                            item.set_depot_id(d);
                        }
                        ui.end_row();
                    }
                    if ty.is_teleport() || item.tele_dest().is_some() {
                        let mut d = item.tele_dest().unwrap_or_default();
                        ui.label(t("props-teleport"));
                        let mut ch = false;
                        ui.horizontal(|ui| {
                            ch |= ui.add(egui::DragValue::new(&mut d.x)).changed();
                            ch |= ui.add(egui::DragValue::new(&mut d.y)).changed();
                            ch |= ui.add(egui::DragValue::new(&mut d.z).range(0..=15)).changed();
                        });
                        if ch {
                            item.set_tele_dest(Some(d));
                        }
                        ui.end_row();
                    }
                    let mut text = item.text().to_owned();
                    ui.label(t("props-text"));
                    if ui.add(egui::TextEdit::multiline(&mut text).desired_rows(1)).changed() {
                        item.set_text(&text);
                    }
                    ui.end_row();
                    let mut desc = item.description().to_owned();
                    ui.label(t("props-desc"));
                    if ui.text_edit_singleline(&mut desc).changed() {
                        item.set_description(&desc);
                    }
                    ui.end_row();
                });
                if !item.children().is_empty() {
                    ui.label(tf("props-container", &[&item.children().len()]));
                }
                if let Some(dest) = item.tele_dest() {
                    if ui.button(t("props-goto-dest")).clicked() {
                        self.cam.center_on(self.canvas_rect, dest);
                    }
                }
                if key > 0 {
                    ui.horizontal(|ui| {
                        if ui.add_enabled(key < n, egui::Button::new("⬆")).on_hover_text(t("props-move-up")).clicked() {
                            action = Some((key - 1, 1));
                        }
                        if ui.add_enabled(key > 1, egui::Button::new("⬇")).on_hover_text(t("props-move-down")).clicked() {
                            action = Some((key - 1, -1));
                        }
                        if ui.button("🗑").on_hover_text(t("remove")).clicked() {
                            action = Some((key - 1, 0));
                        }
                    });
                } else if ui.button(format!("🗑 {}", t("props-remove-ground"))).clicked() {
                    tile.ground = None;
                    self.inspect_item = None;
                }
            }
        }
        if let Some((i, dir)) = action {
            match dir {
                0 => {
                    tile.items.remove(i);
                    self.inspect_item = None;
                }
                1 if i + 1 < tile.items.len() => {
                    tile.items.swap(i, i + 1);
                    self.inspect_item = Some(i + 2);
                }
                -1 if i > 0 => {
                    tile.items.swap(i, i - 1);
                    self.inspect_item = Some(i);
                }
                _ => {}
            }
        }

        ui.separator();
        let changed = *tile != original;
        ui.horizontal(|ui| {
            if ui.add_enabled(changed, egui::Button::new(RichText::new(t("apply")).strong())).clicked() {
                let new_tile = tile.clone();
                ed.begin("properties");
                ed.replace_tile(pos, new_tile);
                ed.end();
            }
            if ui.add_enabled(changed, egui::Button::new(t("revert"))).clicked() {
                *tile = original.clone();
            }
            if changed {
                ui.label(RichText::new(t("props-unsaved")).color(Color32::from_rgb(255, 200, 80)).small());
            }
        });
        if let Some(k) = open_window {
            self.open_properties(pos, crate::properties::PropTarget::Item(k));
        }
    }
}
