//! Pending (previewed) operations: generators and batch tools produce a `StagedChanges` that is
//! drawn as a ghost over the map. Nothing touches the map until "Apply" — which writes it as one
//! undo step. "Cancel" drops it. If the map changed meanwhile, Apply is blocked (regenerate).

use eframe::egui::{self, Color32, Key, Rect, RichText, Stroke};
use pme_core::staged::StagedChanges;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::view::{Builder, DrawCtx};

/// Which tool can regenerate the preview (new seed / same parameters).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Regen {
    Scatter,
}

pub struct PendingOp {
    pub label: String,
    pub changes: StagedChanges,
    /// Map revision the preview was computed on.
    pub map_rev: u64,
    pub regen: Option<Regen>,
}

impl App {
    pub fn set_pending(&mut self, label: impl Into<String>, changes: StagedChanges, regen: Option<Regen>) {
        let map_rev = self.editor.as_ref().map_or(0, |e| e.map.revision);
        self.pending = Some(PendingOp { label: label.into(), changes, map_rev, regen });
    }

    /// Ghost of the pending changes on the current floor + outline of the affected area.
    pub fn draw_pending(&mut self, ctx: &egui::Context, painter: &egui::Painter, rect: Rect) {
        let (Some(p), Some(assets), Some(atlas)) = (&self.pending, &self.assets, &mut self.atlas) else { return };
        let cam = self.cam;
        let z = cam.floor;
        let frame = crate::app::anim_frame_for(&self.settings, ctx);
        let mut dc = DrawCtx { ctx, atlas, assets, cam, rect, frame, spawns: Vec::new(), tech: self.settings.view.show_tech_items };
        let mut b = Builder::new();
        let mut area: Option<Rect> = None;
        for pos in p.changes.sorted_positions().into_iter().filter(|q| q.z == z) {
            let r = cam.tile_rect(rect, pos.x as i32, pos.y as i32, z);
            area = Some(area.map_or(r, |a| a.union(r)));
            if !rect.intersects(r) {
                continue;
            }
            match p.changes.tiles.get(&pos).and_then(|t| t.as_ref()) {
                Some(tile) => dc.tile(&mut b, pos, tile, &self.settings.view, false, 0, 175),
                None => b.fill(r, Color32::from_rgba_unmultiplied(255, 60, 60, 90)),
            }
        }
        painter.extend(b.into_shapes());
        if let Some(a) = area {
            painter.rect_stroke(a.expand(1.0), 0.0, Stroke::new(2.0_f32, Color32::from_rgb(60, 220, 255)), egui::StrokeKind::Outside);
        }
        if dc.atlas.missing {
            ctx.request_repaint();
        }
    }

    /// Bottom bar: summary + Apply (Enter) / Regenerate / Cancel (Esc).
    pub fn pending_bar(&mut self, ctx: &egui::Context) {
        let Some(p) = &self.pending else { return };
        let stale = self.editor.as_ref().is_some_and(|e| e.map.revision != p.map_rev);
        let (label, n, regen) = (p.label.clone(), p.changes.len(), p.regen);
        let floors: std::collections::BTreeSet<u8> = p.changes.tiles.keys().map(|q| q.z).collect();
        let mut apply = false;
        let mut cancel = false;
        let mut regenerate = false;
        egui::Area::new(egui::Id::new("pending-bar")).anchor(egui::Align2::CENTER_BOTTOM, [0.0, -40.0]).order(egui::Order::Foreground).show(ctx, |ui| {
            egui::Frame::new().fill(Color32::from_rgb(24, 40, 52)).stroke(Stroke::new(1.0_f32, Color32::from_rgb(60, 220, 255))).corner_radius(6.0).inner_margin(10.0).show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new(format!("\u{1F441} {}", tf("pending-summary", &[&label, &n]))).strong());
                    if floors.len() > 1 || floors.iter().any(|z| *z != self.cam.floor) {
                        let list: Vec<String> = floors.iter().map(|z| z.to_string()).collect();
                        ui.label(RichText::new(tf("pending-floors", &[&list.join(", ")])).small().weak());
                    }
                    ui.separator();
                    if stale {
                        ui.colored_label(Color32::from_rgb(255, 190, 80), t("pending-stale"));
                    }
                    if ui.add_enabled(!stale && n > 0, egui::Button::new(RichText::new(format!("\u{2714} {}", t("pending-apply"))).strong())).on_hover_text("Enter").clicked() {
                        apply = true;
                    }
                    if regen.is_some() && ui.button(format!("\u{1F3B2} {}", t("pending-regen"))).clicked() {
                        regenerate = true;
                    }
                    if ui.button(format!("\u{2716} {}", t("cancel"))).on_hover_text("Esc").clicked() {
                        cancel = true;
                    }
                });
            });
        });
        if !ctx.wants_keyboard_input() {
            ctx.input_mut(|i| {
                if !stale && i.consume_key(egui::Modifiers::NONE, Key::Enter) {
                    apply = true;
                }
                if i.consume_key(egui::Modifiers::NONE, Key::Escape) {
                    cancel = true;
                }
            });
        }
        if regenerate {
            match regen {
                Some(Regen::Scatter) => self.scatter_generate(ctx, true),
                None => {}
            }
        } else if apply {
            if let (Some(p), Some(ed)) = (self.pending.take(), &mut self.editor) {
                let changed = ed.apply_staged(&p.changes, &p.label);
                self.sel_rev += 1;
                self.toast(ctx, tf("pending-applied", &[&p.label, &changed]), false);
            }
        } else if cancel {
            self.pending = None;
        }
        ctx.request_repaint_after(std::time::Duration::from_millis(200));
    }
}
