//! "Distribuir objetos" window: scatter items / doodads over the selection (or the visible area)
//! with weights, density, spacing, seed and exclusions. Produces a preview (pending op).

use eframe::egui::{self, Color32, RichText};
use pme_core::brushes::Brush;
use pme_core::gen::scatter::{scatter, ScatterEntry, ScatterParams};
use pme_core::materials::BrushKind;
use pme_core::position::Position;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::pending::Regen;
use crate::widgets::{item_picker, PickerCtx};

pub struct ScatterUi {
    pub params: ScatterParams,
    pub query: String,
}

impl Default for ScatterUi {
    fn default() -> Self {
        Self { params: ScatterParams { seed: pme_core::rng::random_seed() % 1_000_000, ..Default::default() }, query: String::new() }
    }
}

impl App {
    pub fn open_scatter(&mut self) {
        let mut ui = self.scatter.take().unwrap_or_default();
        // Pre-fill with the current brush when the list is empty.
        if ui.params.entries.is_empty() {
            if let Some(e) = self.current_scatter_entry() {
                ui.params.entries.push((e, 1));
            }
        }
        self.scatter = Some(ui);
    }

    fn current_scatter_entry(&self) -> Option<ScatterEntry> {
        let a = self.assets.as_ref()?;
        match &self.brush {
            Some(Brush::Raw(id)) => Some(ScatterEntry::Item(*id)),
            Some(Brush::Material(b)) if matches!(a.mat.brush(*b).map(|d| &d.kind), Some(BrushKind::Doodad(_))) => Some(ScatterEntry::Doodad(*b)),
            _ => None,
        }
    }

    /// Candidate area: the selection, or the visible tiles of the current floor.
    fn scatter_area(&self) -> Vec<Position> {
        let Some(ed) = &self.editor else { return vec![] };
        if !ed.selection.is_empty() {
            return ed.selection.iter().copied().collect();
        }
        let r = self.canvas_rect;
        let (x0, y0) = self.cam.tile_at(r, r.min);
        let (x1, y1) = self.cam.tile_at(r, r.max);
        let z = self.cam.floor;
        let mut v = Vec::new();
        for y in y0.max(0)..=y1.min(65535) {
            for x in x0.max(0)..=x1.min(65535) {
                let p = Position::new(x as u16, y as u16, z);
                if ed.map.get(p).is_some() {
                    v.push(p);
                }
            }
        }
        v
    }

    /// Compute the preview (pending op). `new_seed` = "Regenerate".
    pub fn scatter_generate(&mut self, ctx: &egui::Context, new_seed: bool) {
        let area = self.scatter_area();
        if area.is_empty() {
            self.toast(ctx, t("scatter-no-area"), true);
            return;
        }
        let changes = {
            let (Some(st), Some(ed)) = (&mut self.scatter, &self.editor) else { return };
            if new_seed {
                st.params.seed = pme_core::rng::random_seed() % 1_000_000;
            }
            let t0 = std::time::Instant::now();
            let changes = scatter(&ed.map, &area, &st.params, &ed.db, &ed.mat);
            log::info!("scatter: {} candidate tiles → {} changed in {:.1} ms", area.len(), changes.len(), t0.elapsed().as_secs_f32() * 1000.0);
            changes
        };
        if changes.is_empty() {
            self.pending = None;
            self.toast(ctx, t("scatter-nothing"), true);
            return;
        }
        self.set_pending(t("scatter-title"), changes, Some(Regen::Scatter));
    }

    pub fn scatter_window(&mut self, ctx: &egui::Context) {
        let Some(mut st) = self.scatter.take() else { return };
        let frame = self.anim_frame(ctx);
        let brush_item = self.brush_item();
        let current = self.current_scatter_entry();
        let sel = self.editor.as_ref().map_or(0, |e| e.selection.len());
        let mut open = true;
        let mut generate = false;
        if let (Some(a), Some(atlas)) = (&self.assets, &mut self.atlas) {
            let mut pc = PickerCtx { ctx, atlas, assets: a, brush_item, frame };
            egui::Window::new(t("scatter-title")).open(&mut open).default_width(470.0).show(ctx, |ui| {
                ui.label(RichText::new(if sel > 0 { tf("scatter-area-selection", &[&sel]) } else { t("scatter-area-visible").to_owned() }).color(Color32::from_rgb(140, 200, 255)));
                ui.separator();
                // ---- entries
                ui.label(RichText::new(t("scatter-objects")).strong());
                let mut remove = None;
                for (i, (entry, weight)) in st.params.entries.iter_mut().enumerate() {
                    ui.horizontal(|ui| {
                        match entry {
                            ScatterEntry::Item(id) => {
                                item_picker(ui, &mut pc, ("sc-item", i), id, true);
                            }
                            ScatterEntry::Doodad(b) => {
                                let def = a.mat.brush(*b);
                                pc.icon(ui, def.map_or(0, |d| d.look_id), 26.0);
                                ui.label(def.map(|d| format!("{} (doodad)", d.name)).unwrap_or_else(|| "?".into()));
                            }
                        }
                        ui.label(t("scatter-weight"));
                        ui.add(egui::DragValue::new(weight).range(0..=1000));
                        if ui.small_button("\u{1F5D1}").clicked() {
                            remove = Some(i);
                        }
                    });
                }
                if let Some(i) = remove {
                    st.params.entries.remove(i);
                }
                ui.horizontal_wrapped(|ui| {
                    if ui.button(format!("+ {}", t("scatter-add-item"))).clicked() {
                        st.params.entries.push((ScatterEntry::Item(brush_item.unwrap_or(0)), 1));
                    }
                    ui.menu_button(format!("+ {}", t("scatter-add-doodad")), |ui| {
                        ui.add(egui::TextEdit::singleline(&mut st.query).hint_text(t("ts-brush-hint")).desired_width(280.0));
                        let q = st.query.to_lowercase();
                        let hits: Vec<(u32, String, u16)> = a
                            .mat
                            .brushes
                            .iter()
                            .enumerate()
                            .filter(|(_, d)| matches!(d.kind, BrushKind::Doodad(_)) && (q.is_empty() || d.name.to_lowercase().contains(&q)))
                            .take(60)
                            .map(|(i, d)| (i as u32 + 1, d.name.clone(), d.look_id))
                            .collect();
                        egui::ScrollArea::vertical().max_height(260.0).show(ui, |ui| {
                            for (b, name, look) in hits {
                                let r = ui.horizontal(|ui| {
                                    pc.icon(ui, look, 24.0);
                                    ui.selectable_label(false, name)
                                });
                                if r.inner.clicked() {
                                    st.params.entries.push((ScatterEntry::Doodad(b), 1));
                                    ui.close_menu();
                                }
                            }
                        });
                    });
                    if let Some(e) = current {
                        if ui.button(t("scatter-add-current")).clicked() {
                            st.params.entries.push((e, 1));
                        }
                    }
                });
                ui.separator();
                // ---- parameters
                egui::Grid::new("sc-params").num_columns(2).show(ui, |ui| {
                    ui.label(t("scatter-density"));
                    let mut d = st.params.density * 100.0;
                    if ui.add(egui::Slider::new(&mut d, 1.0..=100.0).suffix("%")).changed() {
                        st.params.density = d / 100.0;
                    }
                    ui.end_row();
                    ui.label(t("scatter-min-distance"));
                    ui.add(egui::DragValue::new(&mut st.params.min_distance).range(0..=10)).on_hover_text(t("scatter-min-distance-tip"));
                    ui.end_row();
                    ui.label(t("scatter-seed"));
                    ui.horizontal(|ui| {
                        ui.add(egui::DragValue::new(&mut st.params.seed));
                        if ui.small_button("\u{1F3B2}").clicked() {
                            st.params.seed = pme_core::rng::random_seed() % 1_000_000;
                        }
                    });
                    ui.end_row();
                });
                ui.label(RichText::new(t("scatter-rules")).strong());
                ui.horizontal_wrapped(|ui| {
                    ui.checkbox(&mut st.params.preserve_existing, t("scatter-preserve"));
                    ui.checkbox(&mut st.params.exclude_blocking, t("scatter-ex-blocking"));
                    ui.checkbox(&mut st.params.exclude_houses, t("scatter-ex-houses"));
                    ui.checkbox(&mut st.params.exclude_pz, t("scatter-ex-pz"));
                    ui.checkbox(&mut st.params.exclude_creatures, t("scatter-ex-creatures"));
                });
                // ---- allowed grounds
                ui.horizontal_wrapped(|ui| {
                    ui.label(t("scatter-grounds"));
                    if st.params.allowed_grounds.is_empty() {
                        ui.label(RichText::new(t("scatter-grounds-any")).weak());
                    }
                    let mut rm = None;
                    for (i, g) in st.params.allowed_grounds.iter().enumerate() {
                        let name = a.mat.brush(*g).map(|d| d.name.clone()).unwrap_or_default();
                        if ui.small_button(format!("{name} \u{2716}")).clicked() {
                            rm = Some(i);
                        }
                    }
                    if let Some(i) = rm {
                        st.params.allowed_grounds.remove(i);
                    }
                    ui.menu_button("+", |ui| {
                        ui.add(egui::TextEdit::singleline(&mut st.query).hint_text(t("ts-brush-hint")).desired_width(260.0));
                        let q = st.query.to_lowercase();
                        egui::ScrollArea::vertical().max_height(240.0).show(ui, |ui| {
                            for (i, d) in a.mat.brushes.iter().enumerate().filter(|(_, d)| matches!(d.kind, BrushKind::Ground(_)) && (q.is_empty() || d.name.to_lowercase().contains(&q))).take(60) {
                                if ui.selectable_label(false, &d.name).clicked() {
                                    let id = i as u32 + 1;
                                    if !st.params.allowed_grounds.contains(&id) {
                                        st.params.allowed_grounds.push(id);
                                    }
                                    ui.close_menu();
                                }
                            }
                        });
                    });
                });
                ui.separator();
                let ok = st.params.entries.iter().any(|e| e.1 > 0);
                if ui.add_enabled(ok, egui::Button::new(RichText::new(format!("\u{1F441} {}", t("scatter-preview"))).strong())).clicked() {
                    generate = true;
                }
                ui.label(RichText::new(t("scatter-help")).small().weak());
            });
        }
        self.scatter = if open { Some(st) } else { None };
        if generate {
            self.scatter_generate(ctx, false);
        }
    }
}
