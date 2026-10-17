//! Shared widgets: item picker (icon + id + "use current brush" + search popup).

use std::hash::Hash;

use eframe::egui::{self, Color32, RichText, Sense, Vec2};

use crate::assets::Assets;
use crate::atlas::Atlas;
use crate::i18n::t;
use crate::view::paint_item_icon;

/// What the pickers need from the app.
pub struct PickerCtx<'a> {
    pub ctx: &'a egui::Context,
    pub atlas: &'a mut Atlas,
    pub assets: &'a Assets,
    /// Item of the brush currently selected in the palette (for the 🖌 button).
    pub brush_item: Option<u16>,
    pub frame: u32,
}

impl PickerCtx<'_> {
    pub fn icon(&mut self, ui: &mut egui::Ui, id: u16, size: f32) -> egui::Response {
        let (rect, resp) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
        ui.painter().rect_filled(rect, 3.0, Color32::from_gray(35));
        if id != 0 {
            paint_item_icon(self.ctx, ui.painter(), self.atlas, &self.assets.db, id, rect.shrink(1.0), self.frame);
        }
        resp
    }

    pub fn name(&self, id: u16) -> String {
        if id == 0 {
            return String::new();
        }
        match self.assets.db.get(id) {
            Some(t) if !t.name.is_empty() => format!("{} [{id}]", t.name),
            Some(_) => format!("[{id}]"),
            None => format!("[{id}] ?"),
        }
    }
}

/// Item id picker. Returns true when the value changed.
pub fn item_picker(ui: &mut egui::Ui, pc: &mut PickerCtx, salt: impl Hash, value: &mut u16, show_name: bool) -> bool {
    let mut changed = false;
    let id = ui.id().with(salt);
    ui.horizontal(|ui| {
        let name = pc.name(*value);
        pc.icon(ui, *value, 26.0).on_hover_text(if name.is_empty() { t("picker-empty").to_owned() } else { name.clone() });
        changed |= ui.add(egui::DragValue::new(value).range(0..=u16::MAX).speed(0.3)).changed();
        if let Some(b) = pc.brush_item {
            if ui.small_button("🖌").on_hover_text(t("picker-use-brush")).clicked() {
                *value = b;
                changed = true;
            }
        }
        ui.menu_button("🔍", |ui| {
            let mut q: String = ui.data_mut(|d| d.get_temp(id).unwrap_or_default());
            ui.add(egui::TextEdit::singleline(&mut q).hint_text(t("picker-search-hint")).desired_width(240.0)).request_focus();
            let ql = q.to_lowercase();
            ui.data_mut(|d| d.insert_temp(id, q.clone()));
            if ql.trim().is_empty() {
                ui.label(RichText::new(t("picker-type-to-search")).weak());
                return;
            }
            // Name, server id or client id. Exact id matches come first.
            let qid = ql.trim().parse::<u16>().ok();
            let db = &pc.assets.db;
            let mut hits: Vec<u16> = Vec::new();
            if let Some(n) = qid {
                hits.extend(db.get(n).map(|t| t.id));
                hits.extend(db.items.iter().filter(|it| it.valid && it.client_id == n && it.id != n).map(|it| it.id));
            }
            let by_id = hits.clone();
            hits.extend(db.items.iter().filter(|it| it.valid && !by_id.contains(&it.id) && it.name.to_lowercase().contains(ql.trim())).map(|it| it.id).take(80));
            hits.truncate(80);
            egui::ScrollArea::vertical().max_height(320.0).show(ui, |ui| {
                for h in hits {
                    let client = pc.assets.db.get(h).map_or(0, |t| t.client_id);
                    let r = ui.horizontal(|ui| {
                        pc.icon(ui, h, 22.0);
                        let r = ui.selectable_label(false, pc.name(h));
                        ui.label(RichText::new(format!("cid {client}")).small().weak());
                        r
                    });
                    if r.inner.clicked() {
                        *value = h;
                        changed = true;
                        ui.close_menu();
                    }
                }
            });
        });
        if show_name && *value != 0 {
            ui.label(RichText::new(pc.name(*value)).weak().small());
        }
    });
    changed
}
