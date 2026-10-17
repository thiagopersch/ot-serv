//! "Replace items" window: several from → to rules, applied to the whole map, the selection,
//! the current floor or the visible area, as one undo step.

use eframe::egui::{self, Color32, RichText};
use pme_core::editor::ReplaceScope;
use pme_core::position::Position;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::widgets::{item_picker, PickerCtx};

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum ScopeKind {
    #[default]
    Map,
    Selection,
    Floor,
    Visible,
}

pub struct ReplaceState {
    pub rules: Vec<(u16, u16)>,
    pub scope: ScopeKind,
    pub containers: bool,
    pub preview: Option<usize>,
}

impl Default for ReplaceState {
    fn default() -> Self {
        Self { rules: vec![(0, 0)], scope: ScopeKind::Map, containers: true, preview: None }
    }
}

impl App {
    /// Open the window, optionally pre-filling the "from" item.
    pub fn open_replace(&mut self, from: Option<u16>) {
        let st = self.replace.get_or_insert_with(ReplaceState::default);
        if let Some(id) = from {
            match st.rules.iter_mut().find(|r| r.0 == 0) {
                Some(r) => r.0 = id,
                None => st.rules.push((id, 0)),
            }
            st.preview = None;
        }
    }

    fn scope(&self, k: ScopeKind) -> ReplaceScope {
        match k {
            ScopeKind::Map => ReplaceScope::Map,
            ScopeKind::Selection => ReplaceScope::Selection,
            ScopeKind::Floor => ReplaceScope::Floor(self.cam.floor),
            ScopeKind::Visible => {
                let r = self.canvas_rect;
                let (x0, y0) = self.cam.tile_at(r, r.min);
                let (x1, y1) = self.cam.tile_at(r, r.max);
                let c = |v: i32| v.clamp(0, 65535) as u16;
                ReplaceScope::Area { min: Position::new(c(x0), c(y0), self.cam.floor), max: Position::new(c(x1), c(y1), self.cam.floor) }
            }
        }
    }

    pub fn replace_window(&mut self, ctx: &egui::Context) {
        let Some(mut st) = self.replace.take() else { return };
        let frame = self.anim_frame(ctx);
        let brush_item = self.brush_item();
        let scope = self.scope(st.scope);
        let has_sel = self.editor.as_ref().is_some_and(|e| !e.selection.is_empty());
        let mut open = true;
        let mut run = false;
        let mut count = false;
        if let (Some(assets), Some(atlas)) = (&self.assets, &mut self.atlas) {
            let mut pc = PickerCtx { ctx, atlas, assets, brush_item, frame };
            egui::Window::new(t("replace-title")).open(&mut open).default_width(460.0).show(ctx, |ui| {
                ui.label(RichText::new(t("replace-help")).weak());
                ui.separator();
                let mut remove = None;
                for (i, (from, to)) in st.rules.iter_mut().enumerate() {
                    ui.horizontal(|ui| {
                        ui.label(t("replace-from"));
                        if item_picker(ui, &mut pc, ("from", i), from, false) {
                            st.preview = None;
                        }
                        ui.label("→");
                        if item_picker(ui, &mut pc, ("to", i), to, false) {
                            st.preview = None;
                        }
                        if ui.small_button("🗑").on_hover_text(t("remove")).clicked() {
                            remove = Some(i);
                        }
                    });
                    if *from != 0 || *to != 0 {
                        ui.label(RichText::new(format!("{}  →  {}", pc.name(*from), pc.name(*to))).small().weak());
                    }
                }
                if let Some(i) = remove {
                    st.rules.remove(i);
                    st.preview = None;
                }
                if ui.button(format!("➕ {}", t("replace-add-rule"))).clicked() {
                    st.rules.push((0, 0));
                }
                ui.separator();
                ui.horizontal_wrapped(|ui| {
                    ui.label(t("replace-scope"));
                    let mut ch = ui.radio_value(&mut st.scope, ScopeKind::Map, t("replace-scope-map")).changed();
                    ch |= ui.add_enabled(has_sel, egui::RadioButton::new(st.scope == ScopeKind::Selection, t("replace-scope-selection"))).clicked() && {
                        st.scope = ScopeKind::Selection;
                        true
                    };
                    ch |= ui.radio_value(&mut st.scope, ScopeKind::Floor, t("replace-scope-floor")).changed();
                    ch |= ui.radio_value(&mut st.scope, ScopeKind::Visible, t("replace-scope-visible")).changed();
                    if ch {
                        st.preview = None;
                    }
                });
                if ui.checkbox(&mut st.containers, t("replace-containers")).changed() {
                    st.preview = None;
                }
                ui.separator();
                let valid = st.rules.iter().any(|(a, b)| *a != 0 && *b != 0 && a != b);
                ui.horizontal(|ui| {
                    if ui.add_enabled(valid, egui::Button::new(t("replace-count"))).clicked() {
                        count = true;
                    }
                    if let Some(n) = st.preview {
                        ui.label(RichText::new(tf("replace-preview", &[&n])).color(Color32::from_rgb(140, 200, 255)));
                    }
                });
                if ui.add_enabled(valid, egui::Button::new(RichText::new(t("replace-run")).strong())).clicked() {
                    run = true;
                }
            });
        }
        let rules: Vec<(u16, u16)> = st.rules.iter().copied().filter(|(a, b)| *a != 0 && *b != 0 && a != b).collect();
        if count {
            if let Some(ed) = &self.editor {
                let ids: Vec<u16> = rules.iter().map(|r| r.0).collect();
                st.preview = Some(ed.count_items(&ids, scope, st.containers));
            }
        }
        if run {
            if let Some(ed) = &mut self.editor {
                let n = ed.replace_items(&rules, scope, st.containers);
                self.toast(ctx, tf("replace-done", &[&n]), false);
                st.preview = None;
            }
        }
        if open {
            self.replace = Some(st);
        }
    }
}
