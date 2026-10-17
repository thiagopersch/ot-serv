//! Left panel: brush settings and palettes (terrain, doodads, items, raw, zones, houses,
//! creatures, waypoints).

use eframe::egui::{self, Color32, RichText, Sense, Vec2};
use pme_core::brushes::{Brush, BrushShape};
use pme_core::map::House;
use pme_core::materials::{BrushKind, PaletteKind, TilesetEntry};
use pme_core::tile::flags;

use crate::app::App;
use crate::canvas::zone_color;
use crate::i18n::{t, tf};
use crate::view;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Tab {
    #[default]
    Terrain,
    Doodad,
    Items,
    Raw,
    Zones,
    Houses,
    Creatures,
    Waypoints,
}

impl Tab {
    const ALL: [Tab; 8] = [Tab::Terrain, Tab::Doodad, Tab::Items, Tab::Raw, Tab::Zones, Tab::Houses, Tab::Creatures, Tab::Waypoints];

    fn label(self) -> &'static str {
        match self {
            Tab::Terrain => t("tab-terrain"),
            Tab::Doodad => t("tab-doodad"),
            Tab::Items => t("tab-items"),
            Tab::Raw => t("tab-raw"),
            Tab::Zones => t("tab-zones"),
            Tab::Houses => t("tab-houses"),
            Tab::Creatures => t("tab-creatures"),
            Tab::Waypoints => t("tab-waypoints"),
        }
    }

    fn kind(self) -> Option<PaletteKind> {
        Some(match self {
            Tab::Terrain => PaletteKind::Terrain,
            Tab::Doodad => PaletteKind::Doodad,
            Tab::Items => PaletteKind::Items,
            Tab::Raw => PaletteKind::Raw,
            _ => return None,
        })
    }
}

/// Tileset selection: `None` = all tilesets, `Some(usize::MAX)` = every item (raw tab).
#[derive(Default)]
pub struct PaletteState {
    pub tab: Tab,
    pub tileset: Option<usize>,
    pub search: String,
    pub doodad_variation: usize,
    cache_key: Option<(Tab, Option<usize>, String)>,
    cache: Vec<TilesetEntry>,
    pub creature_search: String,
    pub show_npcs: bool,
    pub show_hidden: bool,
    /// Entry to scroll to after the palette list is rebuilt (Select RAW / Select brush).
    pub scroll_to: Option<TilesetEntry>,
    /// "Add to tileset" popup state.
    pub ts_add_item: u16,
    pub ts_add_brush: String,
    pub selected_house: Option<u32>,
    pub house_town_filter: u32,
    pub waypoint_name: String,
}

impl PaletteState {
    pub fn invalidate(&mut self) {
        self.cache_key = None;
    }
}

/// Change requested on the selected tileset from the palette.
pub enum TsAction {
    AddItem(u16),
    AddBrush(String),
    Remove(TilesetEntry),
}

impl App {
    /// Write a palette change into the tileset XML (in place, `.bak` kept) and reload brushes.
    fn apply_tileset_action(&mut self, ctx: &egui::Context, idx: usize, action: TsAction) {
        let Some(a) = &self.assets else { return };
        let Some(ts) = a.mat.tilesets.get(idx) else { return };
        let name = ts.name.clone();
        let Some(file) = a.mat.tileset_source.get(&name).cloned() else {
            self.toast(ctx, t("ts-no-source"), true);
            return;
        };
        let kind = self.palette.tab.kind().unwrap_or(PaletteKind::Raw);
        let brush_name = |b: pme_core::materials::BrushId| a.mat.brush(b).map(|d| d.name.clone());
        let mut scroll = None;
        let result = match action {
            TsAction::AddItem(id) => {
                scroll = Some(TilesetEntry::Item(id));
                pme_io::tileset_edit::edit(&file, &name, |e| {
                    pme_io::tileset_edit::add_item(e, kind, id);
                    true
                })
            }
            TsAction::AddBrush(b) => {
                scroll = a.mat.brush_by_name(&b).map(TilesetEntry::Brush);
                pme_io::tileset_edit::edit(&file, &name, |e| {
                    pme_io::tileset_edit::add_brush(e, kind, &b);
                    true
                })
            }
            TsAction::Remove(TilesetEntry::Item(id)) => pme_io::tileset_edit::edit(&file, &name, |e| pme_io::tileset_edit::remove_item(e, kind, id)),
            TsAction::Remove(TilesetEntry::Brush(b)) => match brush_name(b) {
                Some(n) => pme_io::tileset_edit::edit(&file, &name, |e| pme_io::tileset_edit::remove_brush(e, kind, &n)),
                None => Ok(false),
            },
        };
        match result {
            Ok(true) => {
                self.palette.scroll_to = scroll;
                self.palette.ts_add_brush.clear();
                self.reload_materials(None);
                self.toast(ctx, tf("ts-saved", &[&name]), false);
            }
            Ok(false) => self.toast(ctx, t("ts-not-found"), true),
            Err(e) => self.toast(ctx, format!("{e:#}"), true),
        }
    }
}

/// Key used in `Settings::hidden_creatures`.
pub fn creature_key(name: &str, npc: bool) -> String {
    format!("{}:{name}", if npc { "npc" } else { "monster" })
}

impl App {
    /// Confirmation + removal of a creature from the server files.
    pub fn remove_creature_dialog(&mut self, ctx: &egui::Context) {
        let Some((name, npc, uses)) = self.remove_creature.clone() else { return };
        let mut close = false;
        let mut confirm = false;
        egui::Modal::new(egui::Id::new("remove-creature")).show(ctx, |ui| {
            ui.set_max_width(460.0);
            ui.heading(tf("creatures-remove-title", &[&name]));
            ui.add_space(4.0);
            if npc {
                ui.label(tf("creatures-remove-npc", &[&name]));
            } else {
                ui.label(tf("creatures-remove-monster", &[&name]));
            }
            if uses > 0 {
                ui.add_space(4.0);
                ui.colored_label(Color32::from_rgb(255, 190, 80), tf("creatures-remove-in-use", &[&uses]));
            }
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if ui.button(RichText::new(t("creatures-remove-confirm")).color(Color32::from_rgb(255, 120, 120)).strong()).clicked() {
                    confirm = true;
                }
                if ui.button(t("cancel")).clicked() {
                    close = true;
                }
            });
        });
        if confirm {
            let data = self.settings.paths.server_data.clone();
            let result = if npc {
                pme_io::creatures::remove_npc(&data, &name).map(|p| tf("creatures-removed-npc", &[&p.display()]))
            } else {
                pme_io::creatures::remove_monster(&data, &name).map(|ok| if ok { tf("creatures-removed-monster", &[&name]) } else { t("creatures-not-listed").to_owned() })
            };
            match result {
                Ok(msg) => {
                    let mut warnings = Vec::new();
                    let list = pme_io::creatures::load(&data, &mut warnings);
                    if let Some(a) = &mut self.assets {
                        a.creature_index = list.iter().enumerate().map(|(i, c)| ((c.is_npc, c.name.to_lowercase()), i)).collect();
                        a.creatures = list;
                    }
                    if matches!(&self.brush, Some(Brush::Creature { name: n, npc: k }) if n.eq_ignore_ascii_case(&name) && *k == npc) {
                        self.set_brush(None);
                    }
                    self.settings.hidden_creatures.retain(|k| *k != creature_key(&name, npc));
                    self.settings.save();
                    self.cache = None;
                    self.toast(ctx, msg, false);
                }
                Err(e) => self.toast(ctx, format!("{e:#}"), true),
            }
            close = true;
        }
        if close {
            self.remove_creature = None;
        }
    }
}

/// "PZ · No-PvP ..." for the status bar.
pub fn zone_names(f: u32) -> String {
    let mut v = Vec::new();
    for (bit, key) in [(flags::PROTECTION_ZONE, "zone-pz"), (flags::NO_PVP, "zone-nopvp"), (flags::NO_LOGOUT, "zone-nologout"), (flags::PVP_ZONE, "zone-pvp")] {
        if f & bit != 0 {
            v.push(t(key));
        }
    }
    v.join(" · ")
}

const ICON: f32 = 34.0;

impl App {
    /// "Select RAW": select the item as a RAW brush and show it in the Raw palette.
    pub fn select_raw_in_palette(&mut self, id: u16) {
        let Some(a) = &self.assets else { return };
        let ts = a.mat.tilesets.iter().position(|t| t.entries(PaletteKind::Raw).any(|e| matches!(e, TilesetEntry::Item(i) if *i == id)));
        self.palette.tab = Tab::Raw;
        self.palette.tileset = Some(ts.unwrap_or(usize::MAX));
        self.palette.search.clear();
        self.palette.invalidate();
        self.palette.scroll_to = Some(TilesetEntry::Item(id));
        self.set_brush(Some(Brush::Raw(id)));
    }

    /// "Select brush": select a materials brush and show it in its palette (Terrain / Doodads).
    pub fn select_brush_in_palette(&mut self, b: pme_core::materials::BrushId) {
        let Some(a) = &self.assets else { return };
        let is_doodad = matches!(a.mat.brush(b).map(|d| &d.kind), Some(pme_core::materials::BrushKind::Doodad(_)));
        let (tab, kind) = if is_doodad { (Tab::Doodad, PaletteKind::Doodad) } else { (Tab::Terrain, PaletteKind::Terrain) };
        let ts = a.mat.tilesets.iter().position(|t| t.entries(kind).any(|e| matches!(e, TilesetEntry::Brush(x) if *x == b)));
        self.palette.tab = tab;
        self.palette.tileset = ts;
        self.palette.search.clear();
        self.palette.invalidate();
        self.palette.scroll_to = Some(TilesetEntry::Brush(b));
        self.set_brush(Some(Brush::Material(b)));
    }

    pub fn palette_ui(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        // Brush settings
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            ui.label(RichText::new(t("brush-size")).strong());
            let mut s = self.brush_size + 1;
            if ui.add(egui::Slider::new(&mut s, 1..=16)).on_hover_text(t("brush-size-tip")).changed() {
                self.brush_size = s - 1;
                self.regen_doodad();
            }
        });
        ui.horizontal(|ui| {
            let mut changed = ui.radio_value(&mut self.brush_shape, BrushShape::Square, t("brush-square")).changed();
            changed |= ui.radio_value(&mut self.brush_shape, BrushShape::Circle, t("brush-circle")).changed();
            if changed {
                self.regen_doodad();
            }
        });
        if let Some(b) = &self.brush {
            let n = self.variation_count();
            let var = if n > 1 { format!("  ·  {} {}/{n}", t("doodad-variation"), self.palette.doodad_variation.min(n - 1) + 1) } else { String::new() };
            ui.label(RichText::new(format!("✏ {}{var}", self.brush_name(b))).color(Color32::from_rgb(140, 200, 255)));
        } else if self.paste_mode {
            ui.label(RichText::new(t("mode-paste")).color(Color32::from_rgb(140, 200, 255)));
        } else {
            ui.label(RichText::new(t("mode-select")).weak());
        }
        ui.separator();

        // Tabs (two rows)
        ui.horizontal_wrapped(|ui| {
            for tab in Tab::ALL {
                if ui.selectable_label(self.palette.tab == tab, tab.label()).clicked() && self.palette.tab != tab {
                    self.palette.tab = tab;
                    self.palette.tileset = None;
                    self.palette.invalidate();
                }
            }
        });
        ui.separator();
        match self.palette.tab {
            Tab::Zones => self.zones_tab(ui),
            Tab::Houses => self.houses_tab(ui),
            Tab::Creatures => self.creatures_tab(ctx, ui),
            Tab::Waypoints => self.waypoints_tab(ui),
            _ => self.tileset_tab(ctx, ui),
        }
    }

    pub fn brush_name(&self, b: &Brush) -> String {
        let Some(a) = &self.assets else { return String::new() };
        match b {
            Brush::Raw(id) => format!("{} [{id}]", a.db.name(*id)),
            Brush::Material(id) => a.mat.brush(*id).map(|b| format!("{} ({})", b.name, b.kind_name())).unwrap_or_default(),
            Brush::Eraser => t("tool-eraser").to_owned(),
            Brush::Zone(f) => zone_names(*f),
            Brush::House(id) => tf("brush-house", &[id]),
            Brush::HouseExit(id) => tf("brush-house-exit", &[id]),
            Brush::Spawn => t("brush-spawn").to_owned(),
            Brush::Creature { name, .. } => name.clone(),
            Brush::Waypoint(n) => format!("{}: {n}", t("tab-waypoints")),
        }
    }

    fn rebuild_entries(&mut self) {
        let key = (self.palette.tab, self.palette.tileset, self.palette.search.to_lowercase());
        if self.palette.cache_key.as_ref() == Some(&key) {
            return;
        }
        let Some(a) = &self.assets else { return };
        let kind = self.palette.tab.kind().unwrap_or(PaletteKind::Terrain);
        let mut out: Vec<TilesetEntry> = Vec::new();
        let mut seen = ahash::AHashSet::new();
        let mut push = |e: &TilesetEntry, out: &mut Vec<TilesetEntry>| {
            let k = match e {
                TilesetEntry::Brush(b) => *b as u64 | 1 << 40,
                TilesetEntry::Item(i) => *i as u64,
            };
            if seen.insert(k) {
                out.push(e.clone());
            }
        };
        match self.palette.tileset {
            Some(usize::MAX) => {
                for it in a.db.items.iter().filter(|t| t.valid && a.db.sprite(t.id).is_some()) {
                    out.push(TilesetEntry::Item(it.id));
                }
            }
            Some(i) => {
                if let Some(ts) = a.mat.tilesets.get(i) {
                    for e in ts.entries(kind) {
                        push(e, &mut out);
                    }
                }
            }
            None => {
                for ts in &a.mat.tilesets {
                    for e in ts.entries(kind) {
                        push(e, &mut out);
                    }
                }
            }
        }
        let q = &key.2;
        if !q.is_empty() {
            let id_q = q.parse::<u32>().ok();
            out.retain(|e| match e {
                TilesetEntry::Brush(b) => a.mat.brush(*b).is_some_and(|b| b.name.to_lowercase().contains(q.as_str()) || id_q.is_some_and(|i| i == b.look_id as u32)),
                TilesetEntry::Item(i) => id_q.map_or_else(|| a.db.name(*i).to_lowercase().contains(q.as_str()), |n| n == *i as u32),
            });
        }
        self.palette.cache = out;
        self.palette.cache_key = Some(key);
    }

    fn tileset_tab(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        let Some(a) = &self.assets else { return };
        let kind = self.palette.tab.kind().unwrap();
        let names: Vec<(usize, String)> = a.mat.tilesets.iter().enumerate().filter(|(_, ts)| ts.entries(kind).next().is_some()).map(|(i, ts)| (i, ts.name.clone())).collect();
        let current = match self.palette.tileset {
            None => t("tileset-all").to_owned(),
            Some(usize::MAX) => t("tileset-every-item").to_owned(),
            Some(i) => a.mat.tilesets.get(i).map(|t| t.name.clone()).unwrap_or_default(),
        };
        let mut changed = false;
        egui::ComboBox::from_id_salt("tileset").selected_text(current).width(ui.available_width() - 8.0).height(500.0).show_ui(ui, |ui| {
            changed |= ui.selectable_value(&mut self.palette.tileset, None, t("tileset-all")).changed();
            if kind == PaletteKind::Raw {
                changed |= ui.selectable_value(&mut self.palette.tileset, Some(usize::MAX), t("tileset-every-item")).changed();
            }
            for (i, n) in names {
                changed |= ui.selectable_value(&mut self.palette.tileset, Some(i), n).changed();
            }
        });
        ui.horizontal(|ui| {
            ui.label("🔍");
            if ui.add(egui::TextEdit::singleline(&mut self.palette.search).hint_text(t("search-hint")).desired_width(f32::INFINITY)).changed() {
                changed = true;
            }
        });
        if self.palette.tab == Tab::Doodad {
            let n = self.variation_count();
            ui.horizontal(|ui| {
                ui.label(t("doodad-variation"));
                if n > 1 {
                    if ui.small_button("\u{25C0}").on_hover_text("Z / Alt+Z").clicked() {
                        self.cycle_variation(ctx, -1);
                    }
                    self.palette.doodad_variation = self.palette.doodad_variation.min(n - 1);
                    ui.label(RichText::new(format!("{}/{n}", self.palette.doodad_variation + 1)).strong());
                    if ui.small_button("\u{25B6}").on_hover_text("X / Alt+X").clicked() {
                        self.cycle_variation(ctx, 1);
                    }
                } else {
                    ui.label(RichText::new(t("doodad-no-variations")).weak());
                }
                if ui.button("\u{1F3B2}").on_hover_text(t("doodad-reroll")).clicked() {
                    self.regen_doodad();
                }
            });
        }
        if changed {
            self.palette.invalidate();
        }
        self.rebuild_entries();
        // A specific tileset is selected: its entries can be added / removed (written to the XML).
        let editable = self.palette.tileset.filter(|&i| i != usize::MAX);
        let mut ts_action: Option<TsAction> = None;
        ui.horizontal(|ui| {
            ui.label(RichText::new(tf("palette-count", &[&self.palette.cache.len()])).weak().small());
            if matches!(self.palette.tab, Tab::Terrain | Tab::Doodad) && ui.small_button(format!("+ {}", t("be-new-brush"))).on_hover_text(t("be-title")).clicked() {
                self.open_brush_editor();
            }
            if editable.is_some() {
                let brush_item = self.brush_item();
                let frame = self.anim_frame(ctx);
                let tab = self.palette.tab;
                let (Some(a), Some(atlas)) = (&self.assets, &mut self.atlas) else { return };
                let p = &mut self.palette;
                ui.menu_button(format!("+ {}", t("ts-add")), |ui| {
                    ui.set_min_width(320.0);
                    ui.label(RichText::new(t("ts-add-help")).small().weak());
                    let mut pc = crate::widgets::PickerCtx { ctx, atlas, assets: a, brush_item, frame };
                    ui.horizontal(|ui| {
                        if p.ts_add_item == 0 {
                            p.ts_add_item = brush_item.unwrap_or(0);
                        }
                        crate::widgets::item_picker(ui, &mut pc, "ts-add-item", &mut p.ts_add_item, true);
                    });
                    if ui.add_enabled(p.ts_add_item != 0, egui::Button::new(t("ts-add-item"))).clicked() {
                        ts_action = Some(TsAction::AddItem(p.ts_add_item));
                        ui.close_menu();
                    }
                    if matches!(tab, Tab::Terrain | Tab::Doodad) {
                        ui.separator();
                        ui.add(egui::TextEdit::singleline(&mut p.ts_add_brush).hint_text(t("ts-brush-hint")).desired_width(300.0));
                        let q = p.ts_add_brush.to_lowercase();
                        let want_doodad = tab == Tab::Doodad;
                        egui::ScrollArea::vertical().max_height(220.0).show(ui, |ui| {
                            // Match by brush name, or by the server id / client id of its icon item.
                            let qn = q.trim().parse::<u16>().ok();
                            let hits: Vec<(String, &'static str, u16)> = a
                                .mat
                                .brushes
                                .iter()
                                .filter(|d| {
                                    let doodad = matches!(d.kind, BrushKind::Doodad(_));
                                    let client = a.db.get(d.look_id).map_or(0, |t| t.client_id);
                                    let matches = q.trim().is_empty() || d.name.to_lowercase().contains(q.trim()) || qn.is_some_and(|n| n == d.look_id || n == client);
                                    !matches!(d.kind, BrushKind::Unknown) && doodad == want_doodad && matches
                                })
                                .take(60)
                                .map(|d| (d.name.clone(), d.kind_name(), d.look_id))
                                .collect();
                            for (name, kind, look) in hits {
                                let r = ui.horizontal(|ui| {
                                    pc.icon(ui, look, 26.0);
                                    ui.selectable_label(false, format!("{name} ({kind})"))
                                });
                                if r.inner.clicked() {
                                    ts_action = Some(TsAction::AddBrush(name));
                                    ui.close_menu();
                                }
                            }
                        });
                    }
                });
            }
        });
        ui.separator();

        let frame = self.anim_frame(ctx);
        let entries = std::mem::take(&mut self.palette.cache);
        let cols = ((ui.available_width() - 14.0) / (ICON + 4.0)).floor().max(1.0) as usize;
        let rows = entries.len().div_ceil(cols);
        let mut clicked = None;
        let mut edit_brush: Option<String> = None;
        let mut area = egui::ScrollArea::vertical().auto_shrink([false, false]);
        if let Some(target) = self.palette.scroll_to.take() {
            let same = |e: &TilesetEntry| match (e, &target) {
                (TilesetEntry::Brush(a), TilesetEntry::Brush(b)) => a == b,
                (TilesetEntry::Item(a), TilesetEntry::Item(b)) => a == b,
                _ => false,
            };
            if let Some(i) = entries.iter().position(same) {
                let row_h = ICON + 4.0 + ui.spacing().item_spacing.y;
                area = area.vertical_scroll_offset(((i / cols) as f32 * row_h - row_h * 2.0).max(0.0));
            }
        }
        area.show_rows(ui, ICON + 4.0, rows, |ui, range| {
            let (Some(a), Some(atlas)) = (&self.assets, &mut self.atlas) else { return };
            for row in range {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 4.0;
                    for e in entries.iter().skip(row * cols).take(cols) {
                        let (item, tip, brush) = match e {
                            TilesetEntry::Brush(b) => {
                                let def = a.mat.brush(*b);
                                (def.map(|d| d.look_id).unwrap_or(0), def.map(|d| format!("{} ({})", d.name, d.kind_name())).unwrap_or_default(), Brush::Material(*b))
                            }
                            TilesetEntry::Item(i) => (*i, format!("{} [{i}]", a.db.name(*i)), Brush::Raw(*i)),
                        };
                        let selected = self.brush.as_ref() == Some(&brush);
                        let (rect, resp) = ui.allocate_exact_size(Vec2::splat(ICON), Sense::click());
                        let bg = if selected {
                            Color32::from_rgb(40, 110, 170)
                        } else if resp.hovered() {
                            Color32::from_gray(60)
                        } else {
                            Color32::from_gray(32)
                        };
                        ui.painter().rect_filled(rect, 3.0, bg);
                        view::paint_item_icon(ctx, ui.painter(), atlas, &a.db, item, rect.shrink(1.0), frame);
                        let resp = resp.on_hover_text(tip);
                        let def = if let TilesetEntry::Brush(b) = e { a.mat.brush(*b) } else { None };
                        if def.is_some() || editable.is_some() {
                            resp.context_menu(|ui| {
                                if let Some(def) = def {
                                    if ui.button(format!("\u{270F} {}", t("bse-open"))).clicked() {
                                        edit_brush = Some(def.name.clone());
                                        ui.close_menu();
                                    }
                                }
                                if editable.is_some() && ui.button(RichText::new(t("ts-remove")).color(Color32::from_rgb(255, 130, 130))).clicked() {
                                    ts_action = Some(TsAction::Remove(e.clone()));
                                    ui.close_menu();
                                }
                            });
                        }
                        if resp.clicked() {
                            clicked = Some(brush);
                        }
                    }
                });
            }
        });
        self.palette.cache = entries;
        if let (Some(action), Some(idx)) = (ts_action, editable) {
            self.apply_tileset_action(ctx, idx, action);
        }
        if let Some(name) = edit_brush {
            // Brushes created in the editor open in the creator; the others are edited in place.
            let custom = self.assets.as_ref().and_then(|a| a.mat.brush_source.get(&name)).is_some_and(|p| p.file_name().is_some_and(|f| f == "peixola_brushes.xml"));
            if custom {
                self.open_brush_editor();
                if let Some(be) = &mut self.brush_editor {
                    be.open_by_name(&name);
                }
            } else {
                self.open_std_brush_editor(ctx, &name);
            }
        }
        if let Some(b) = clicked {
            self.set_brush(Some(b));
        }
        if self.atlas.as_ref().is_some_and(|a| a.missing) {
            ctx.request_repaint();
        }
    }

    fn zones_tab(&mut self, ui: &mut egui::Ui) {
        ui.label(t("zones-help"));
        ui.add_space(6.0);
        for (flag, key, tip) in [
            (flags::PROTECTION_ZONE, "zone-pz", "zone-pz-tip"),
            (flags::NO_PVP, "zone-nopvp", "zone-nopvp-tip"),
            (flags::NO_LOGOUT, "zone-nologout", "zone-nologout-tip"),
            (flags::PVP_ZONE, "zone-pvp", "zone-pvp-tip"),
        ] {
            let selected = self.brush == Some(Brush::Zone(flag));
            let c = zone_color(flag);
            let text = RichText::new(format!("■  {}", t(key))).color(c).size(15.0);
            let btn = egui::Button::new(text).selected(selected).min_size(Vec2::new(ui.available_width(), 30.0));
            if ui.add(btn).on_hover_text(t(tip)).clicked() {
                self.set_brush(Some(Brush::Zone(flag)));
            }
        }
        ui.add_space(8.0);
        ui.label(RichText::new(t("zones-erase-help")).weak());
        ui.add_space(8.0);
        if !self.settings.view.show_zones {
            ui.colored_label(Color32::from_rgb(255, 200, 80), t("zones-hidden"));
            if ui.button(t("view-zones")).clicked() {
                self.settings.view.show_zones = true;
            }
        }
    }

    fn houses_tab(&mut self, ui: &mut egui::Ui) {
        let Some(ed) = &mut self.editor else { return };
        let towns = ed.map.towns.clone();
        ui.horizontal(|ui| {
            ui.label(t("houses-town"));
            let cur = if self.palette.house_town_filter == 0 {
                t("tileset-all").to_owned()
            } else {
                towns.iter().find(|t| t.id == self.palette.house_town_filter).map(|t| t.name.clone()).unwrap_or_default()
            };
            egui::ComboBox::from_id_salt("town").selected_text(cur).show_ui(ui, |ui| {
                ui.selectable_value(&mut self.palette.house_town_filter, 0, t("tileset-all"));
                for tw in &towns {
                    ui.selectable_value(&mut self.palette.house_town_filter, tw.id, &tw.name);
                }
            });
        });
        ui.horizontal(|ui| {
            ui.label("🔍");
            ui.add(egui::TextEdit::singleline(&mut self.palette.search).hint_text(t("search-hint")).desired_width(f32::INFINITY));
        });
        let q = self.palette.search.to_lowercase();
        let houses: Vec<House> = ed
            .map
            .houses
            .iter()
            .filter(|h| self.palette.house_town_filter == 0 || h.town_id == self.palette.house_town_filter)
            .filter(|h| q.is_empty() || h.name.to_lowercase().contains(&q) || h.id.to_string() == q)
            .cloned()
            .collect();
        let mut goto = None;
        egui::ScrollArea::vertical().max_height(ui.available_height() * 0.5).auto_shrink([false, false]).show_rows(ui, 20.0, houses.len(), |ui, range| {
            for h in &houses[range] {
                let sel = self.palette.selected_house == Some(h.id);
                let r = ui.selectable_label(sel, format!("#{:<4} {}", h.id, h.name));
                if r.clicked() {
                    self.palette.selected_house = Some(h.id);
                    self.current_house = h.id;
                }
                if r.double_clicked() {
                    goto = Some(h.entry);
                }
            }
        });
        ui.separator();
        let mut new_brush = None;
        let mut houses_edit = None;
        if let Some(id) = self.palette.selected_house {
            if let Some(mut h) = ed.map.house(id).cloned() {
                let before = h.clone();
                egui::Grid::new("house").num_columns(2).show(ui, |ui| {
                    ui.label(t("name"));
                    ui.text_edit_singleline(&mut h.name);
                    ui.end_row();
                    ui.label(t("houses-rent"));
                    ui.add(egui::DragValue::new(&mut h.rent));
                    ui.end_row();
                    ui.label(t("houses-town"));
                    egui::ComboBox::from_id_salt("htown").selected_text(towns.iter().find(|t| t.id == h.town_id).map(|t| t.name.clone()).unwrap_or_else(|| h.town_id.to_string())).show_ui(ui, |ui| {
                        for tw in &towns {
                            ui.selectable_value(&mut h.town_id, tw.id, &tw.name);
                        }
                    });
                    ui.end_row();
                    ui.label(t("houses-guildhall"));
                    ui.checkbox(&mut h.guildhall, "");
                    ui.end_row();
                    ui.label(t("houses-entry"));
                    ui.label(format!("{}", h.entry));
                    ui.end_row();
                });
                if h != before {
                    let mut all = ed.map.houses.clone();
                    if let Some(slot) = all.iter_mut().find(|x| x.id == id) {
                        *slot = h.clone();
                    }
                    houses_edit = Some(all);
                }
                ui.horizontal_wrapped(|ui| {
                    if ui.selectable_label(self.brush == Some(Brush::House(id)), t("houses-paint")).on_hover_text(t("houses-paint-tip")).clicked() {
                        new_brush = Some(Brush::House(id));
                    }
                    if ui.selectable_label(self.brush == Some(Brush::HouseExit(id)), t("houses-exit")).on_hover_text(t("houses-exit-tip")).clicked() {
                        new_brush = Some(Brush::HouseExit(id));
                    }
                    if ui.button(t("goto-go")).clicked() {
                        goto = Some(h.entry);
                    }
                    if ui.button(t("remove")).on_hover_text(t("houses-remove-tip")).clicked() {
                        houses_edit = Some(ed.map.houses.iter().filter(|x| x.id != id).cloned().collect());
                        self.palette.selected_house = None;
                    }
                });
            }
        }
        if ui.button(format!("➕ {}", t("houses-new"))).clicked() {
            let id = ed.map.houses.iter().map(|h| h.id).max().unwrap_or(0) + 1;
            let town = if self.palette.house_town_filter != 0 { self.palette.house_town_filter } else { towns.first().map(|t| t.id).unwrap_or(1) };
            let mut all = ed.map.houses.clone();
            all.push(House { id, name: format!("House #{id}"), town_id: town, rent: 0, entry: self.cam.center(self.canvas_rect), guildhall: false, size: 0 });
            houses_edit = Some(all);
            self.palette.selected_house = Some(id);
            self.current_house = id;
        }
        if let Some(all) = houses_edit {
            ed.begin("houses");
            ed.set_houses(all);
            ed.end();
        }
        if let Some(b) = new_brush {
            self.set_brush(Some(b));
        }
        if let Some(p) = goto {
            self.goto(p);
        }
    }

    fn creatures_tab(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            if ui.selectable_label(self.brush == Some(Brush::Spawn), format!("◎ {}", t("brush-spawn"))).on_hover_text(t("spawn-tip")).clicked() {
                self.set_brush(Some(Brush::Spawn));
            }
            ui.label(t("settings-spawn-time"));
            if ui.add(egui::DragValue::new(&mut self.settings.default_spawn_time).range(1..=86400).suffix(" s")).changed() {
                self.sync_options();
            }
        });
        // Direction of the next creatures placed (the server spawns them facing it).
        ui.horizontal(|ui| {
            ui.label(t("creatures-direction"));
            let mut d = self.settings.default_direction.min(3);
            for (i, key) in ["dir-north", "dir-east", "dir-south", "dir-west"].iter().enumerate() {
                ui.selectable_value(&mut d, i as u8, t(key));
            }
            if d != self.settings.default_direction {
                self.settings.default_direction = d;
                self.sync_options();
            }
        });
        // Legend of the map markers.
        ui.horizontal_wrapped(|ui| {
            ui.label(RichText::new("\u{1F525}").color(Color32::from_rgb(255, 170, 40)));
            ui.label(RichText::new(t("legend-spawn")).small());
            ui.label(RichText::new("\u{25A0}").color(Color32::from_rgb(235, 70, 110)));
            ui.label(RichText::new(t("creatures-monsters")).small());
            ui.label(RichText::new("\u{25A0}").color(Color32::from_rgb(40, 200, 255)));
            ui.label(RichText::new(t("creatures-npcs")).small());
            ui.label(RichText::new("\u{25A1}").color(Color32::from_rgb(255, 30, 30)));
            ui.label(RichText::new(t("legend-orphan")).small());
        });
        let frame = self.anim_frame(ctx);
        ui.horizontal(|ui| {
            ui.selectable_value(&mut self.palette.show_npcs, false, t("creatures-monsters"));
            ui.selectable_value(&mut self.palette.show_npcs, true, t("creatures-npcs"));
        });
        ui.horizontal(|ui| {
            ui.label("🔍");
            ui.add(egui::TextEdit::singleline(&mut self.palette.creature_search).hint_text(t("search-hint")).desired_width(f32::INFINITY));
        });
        ui.separator();
        let Some(a) = &self.assets else { return };
        let none_loaded = a.creatures.is_empty();
        let q = self.palette.creature_search.to_lowercase();
        let hidden = &self.settings.hidden_creatures;
        let n_hidden = a.creatures.iter().filter(|c| c.is_npc == self.palette.show_npcs && hidden.contains(&creature_key(&c.name, c.is_npc))).count();
        let list: Vec<(String, String, bool, bool)> = a
            .creatures
            .iter()
            .filter(|c| c.is_npc == self.palette.show_npcs && (q.is_empty() || c.name.to_lowercase().contains(&q) || c.display.to_lowercase().contains(&q)))
            .map(|c| (c.name.clone(), c.display.clone(), c.is_npc, hidden.contains(&creature_key(&c.name, c.is_npc))))
            .filter(|c| !c.3 || self.palette.show_hidden)
            .collect();
        if n_hidden > 0 || self.palette.show_hidden {
            ui.checkbox(&mut self.palette.show_hidden, tf("creatures-show-hidden", &[&n_hidden]));
        }
        let mut toggle_hidden: Option<String> = None;
        let mut remove_req: Option<(String, bool)> = None;
        let dir = self.settings.default_direction;
        let mut clicked = None;
        egui::ScrollArea::vertical().auto_shrink([false, false]).show_rows(ui, ICON, list.len(), |ui, range| {
            let (Some(a), Some(atlas)) = (&self.assets, &mut self.atlas) else { return };
            for (name, display, npc, is_hidden) in &list[range] {
                let brush = Brush::Creature { name: name.clone(), npc: *npc };
                let sel = self.brush.as_ref() == Some(&brush);
                let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), ICON), Sense::click());
                if sel || resp.hovered() {
                    ui.painter().rect_filled(rect, 3.0, if sel { Color32::from_rgb(40, 110, 170) } else { Color32::from_gray(50) });
                }
                let icon = egui::Rect::from_min_size(rect.min, Vec2::splat(ICON));
                view::paint_creature_icon(ctx, ui.painter(), atlas, a, name, *npc, dir, icon.shrink(1.0), frame);
                let text_pos = egui::pos2(rect.min.x + ICON + 6.0, rect.center().y);
                let color = if *is_hidden { ui.visuals().weak_text_color() } else { ui.visuals().text_color() };
                let label = if *is_hidden { format!("{display}  ({})", t("creatures-hidden")) } else { display.clone() };
                let r = ui.painter().text(text_pos, egui::Align2::LEFT_CENTER, label, egui::FontId::proportional(14.0), color);
                // NPCs whose file name differs from the in-game name: show the file (that is what the spawn uses).
                if !display.eq_ignore_ascii_case(name) {
                    ui.painter().text(egui::pos2(r.max.x + 6.0, rect.center().y), egui::Align2::LEFT_CENTER, format!("({name}.xml)"), egui::FontId::proportional(12.0), ui.visuals().weak_text_color());
                }
                resp.context_menu(|ui| {
                    if ui.button(if *is_hidden { t("creatures-unhide") } else { t("creatures-hide") }).on_hover_text(t("creatures-hide-tip")).clicked() {
                        toggle_hidden = Some(creature_key(name, *npc));
                        ui.close_menu();
                    }
                    ui.separator();
                    if ui.button(RichText::new(t("creatures-remove-server")).color(Color32::from_rgb(255, 120, 120))).clicked() {
                        remove_req = Some((name.clone(), *npc));
                        ui.close_menu();
                    }
                });
                if resp.clicked() {
                    clicked = Some(brush);
                }
            }
        });
        if let Some(k) = toggle_hidden {
            let h = &mut self.settings.hidden_creatures;
            if let Some(i) = h.iter().position(|x| *x == k) {
                h.remove(i);
            } else {
                h.push(k);
            }
            self.settings.save();
        }
        if let Some((name, npc)) = remove_req {
            let uses = self.editor.as_ref().map_or(0, |e| {
                e.map.tiles().filter(|(_, t)| t.creature.as_ref().is_some_and(|c| c.is_npc == npc && c.name.eq_ignore_ascii_case(&name))).count()
            });
            self.remove_creature = Some((name, npc, uses));
        }
        if let Some(b) = clicked {
            self.set_brush(Some(b));
        }
        if none_loaded {
            ui.colored_label(Color32::from_rgb(255, 200, 80), t("creatures-none"));
        }
    }

    fn waypoints_tab(&mut self, ui: &mut egui::Ui) {
        let Some(ed) = &mut self.editor else { return };
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut self.palette.waypoint_name).hint_text(t("name")).desired_width(150.0));
            if ui.add_enabled(!self.palette.waypoint_name.trim().is_empty(), egui::Button::new(t("waypoint-place"))).on_hover_text(t("waypoint-place-tip")).clicked() {
                self.brush = Some(Brush::Waypoint(self.palette.waypoint_name.trim().to_owned()));
                self.paste_mode = false;
            }
        });
        ui.separator();
        let wps = ed.map.waypoints.clone();
        let mut goto = None;
        let mut remove = None;
        let mut pick = None;
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
            for (i, w) in wps.iter().enumerate() {
                ui.horizontal(|ui| {
                    let sel = self.brush == Some(Brush::Waypoint(w.name.clone()));
                    if ui.selectable_label(sel, &w.name).on_hover_text(format!("{}", w.pos)).clicked() {
                        pick = Some(w.name.clone());
                        goto = Some(w.pos);
                    }
                    if ui.small_button("🗑").on_hover_text(t("remove")).clicked() {
                        remove = Some(i);
                    }
                });
            }
        });
        if let Some(i) = remove {
            let mut v = wps.clone();
            v.remove(i);
            ed.begin("waypoints");
            ed.set_waypoints(v);
            ed.end();
        }
        if let Some(n) = pick {
            self.palette.waypoint_name = n.clone();
            self.brush = Some(Brush::Waypoint(n));
        }
        if let Some(p) = goto {
            self.goto(p);
        }
        if wps.is_empty() {
            ui.label(RichText::new(t("waypoints-none")).weak());
        }
    }
}
