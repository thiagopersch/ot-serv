//! "Create / edit brushes" window. Brushes are written to an RME-compatible materials file in
//! the extensions folder (`peixola_brushes.xml`) and the materials are reloaded afterwards.

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText};
use pme_io::materials_writer::*;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::widgets::{item_picker, PickerCtx};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum BeTab {
    Ground,
    Wall,
    Carpet,
    Table,
    Doodad,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum BorderMode {
    None,
    Existing,
    New,
}

pub struct BrushEditor {
    pub tab: BeTab,
    pub custom: CustomBrushes,
    pub path: PathBuf,
    pub name: String,
    /// Name being edited (None = new brush).
    pub editing: Option<String>,
    pub look: u16,
    // ground
    pub ground_items: Vec<ChanceItem>,
    pub z_order: i32,
    pub border_mode: BorderMode,
    pub existing_border: u32,
    pub new_border: [u16; 12],
    pub new_border_id: u32,
    pub outer: bool,
    pub to_none: bool,
    // wall
    pub wall: Vec<u16>,
    pub doors: Vec<DoorDef>,
    // carpet / table
    pub carpet: [u16; 13],
    pub table: [u16; 7],
    // doodad
    pub singles: Vec<ChanceItem>,
    pub composite: Vec<(i32, i32, i32, Vec<u16>)>,
    pub include_ground: bool,
    pub draggable: bool,
    pub on_blocking: bool,
    pub thickness: (i32, i32),
    pub status: Option<(String, bool)>,
}

impl BrushEditor {
    pub fn new(path: PathBuf) -> Self {
        let custom = CustomBrushes::load(&path).unwrap_or_default();
        let mut s = Self {
            tab: BeTab::Ground,
            custom,
            path,
            name: String::new(),
            editing: None,
            look: 0,
            ground_items: vec![ChanceItem { id: 0, chance: 100 }],
            z_order: 3500,
            border_mode: BorderMode::Existing,
            existing_border: 0,
            new_border: [0; 12],
            new_border_id: 0,
            outer: true,
            to_none: false,
            wall: vec![0; WALL_TYPES.len()],
            doors: Vec::new(),
            carpet: [0; 13],
            table: [0; 7],
            singles: Vec::new(),
            composite: Vec::new(),
            include_ground: false,
            draggable: true,
            on_blocking: false,
            thickness: (0, 0),
            status: None,
        };
        s.reset(BeTab::Ground);
        s
    }

    pub fn reset(&mut self, tab: BeTab) {
        let (custom, path) = (std::mem::take(&mut self.custom), std::mem::take(&mut self.path));
        *self = Self {
            tab,
            custom,
            path,
            name: String::new(),
            editing: None,
            look: 0,
            ground_items: vec![ChanceItem { id: 0, chance: 100 }],
            z_order: 3500,
            border_mode: BorderMode::Existing,
            existing_border: 0,
            new_border: [0; 12],
            new_border_id: 0,
            outer: true,
            to_none: false,
            wall: vec![0; WALL_TYPES.len()],
            doors: Vec::new(),
            carpet: [0; 13],
            table: [0; 7],
            singles: Vec::new(),
            composite: Vec::new(),
            include_ground: false,
            draggable: true,
            on_blocking: false,
            thickness: (0, 0),
            status: None,
        };
    }

    /// Load a saved custom brush into the form.
    fn edit(&mut self, b: &CustomBrush) {
        let first = |v: &[ChanceItem]| v.first().map(|c| c.id).unwrap_or(0);
        match b {
            CustomBrush::Ground(g) => {
                self.reset(BeTab::Ground);
                self.ground_items = g.items.clone();
                self.z_order = g.z_order;
                self.outer = g.outer;
                self.to_none = g.to_none;
                if let Some(nb) = self.custom.borders.iter().find(|x| x.id == g.border_id) {
                    self.border_mode = BorderMode::New;
                    self.new_border = nb.edges;
                    self.new_border_id = nb.id;
                } else if g.border_id != 0 {
                    self.border_mode = BorderMode::Existing;
                    self.existing_border = g.border_id;
                } else {
                    self.border_mode = BorderMode::None;
                }
                self.look = g.look_id;
                self.name = g.name.clone();
            }
            CustomBrush::Wall(w) => {
                self.reset(BeTab::Wall);
                for (i, ty) in WALL_TYPES.iter().enumerate() {
                    self.wall[i] = w.nodes.iter().find(|(t, _)| t == ty).map(|(_, v)| first(v)).unwrap_or(0);
                }
                self.doors = w.doors.clone();
                self.look = w.look_id;
                self.name = w.name.clone();
            }
            CustomBrush::Carpet(c) => {
                self.reset(BeTab::Carpet);
                for (i, a) in CARPET_ALIGNS.iter().enumerate() {
                    self.carpet[i] = c.nodes.iter().find(|(t, _)| t == a).map(|(_, v)| first(v)).unwrap_or(0);
                }
                self.look = c.look_id;
                self.name = c.name.clone();
            }
            CustomBrush::Table(c) => {
                self.reset(BeTab::Table);
                for (i, a) in TABLE_ALIGNS.iter().enumerate() {
                    self.table[i] = c.nodes.iter().find(|(t, _)| t == a).map(|(_, v)| first(v)).unwrap_or(0);
                }
                self.look = c.look_id;
                self.name = c.name.clone();
            }
            CustomBrush::Doodad(d) => {
                self.reset(BeTab::Doodad);
                self.singles = d.singles.clone();
                self.composite = d.composite.clone();
                self.draggable = d.draggable;
                self.on_blocking = d.on_blocking;
                self.thickness = d.thickness;
                self.look = d.look_id;
                self.name = d.name.clone();
            }
        }
        self.editing = Some(b.name().to_owned());
    }

    /// Load a saved custom brush by name (from the palette context menu).
    pub fn open_by_name(&mut self, name: &str) {
        if let Some(b) = self.custom.brushes.iter().find(|b| b.name() == name).cloned() {
            self.edit(&b);
        }
    }

    /// All item ids used by the form (for the "already owned by another brush" warning).
    fn used_items(&self) -> Vec<u16> {
        let v: Vec<u16> = match self.tab {
            BeTab::Ground => self.ground_items.iter().map(|c| c.id).collect(),
            BeTab::Wall => self.wall.iter().copied().chain(self.doors.iter().map(|d| d.id)).collect(),
            BeTab::Carpet => self.carpet.to_vec(),
            BeTab::Table => self.table.to_vec(),
            BeTab::Doodad => return vec![],
        };
        v.into_iter().filter(|&i| i != 0).collect()
    }

    /// Build the definition from the form; Err = message for the user.
    fn build(&mut self, existing_borders: impl Iterator<Item = u32>) -> Result<CustomBrush, String> {
        let name = self.name.trim().to_owned();
        if name.is_empty() {
            return Err(t("be-err-name").to_owned());
        }
        let items = |v: &[ChanceItem]| v.iter().filter(|c| c.id != 0).cloned().collect::<Vec<_>>();
        let look_or = |look: u16, fallback: u16| if look != 0 { look } else { fallback };
        Ok(match self.tab {
            BeTab::Ground => {
                let gi = items(&self.ground_items);
                let Some(first) = gi.first().map(|c| c.id) else { return Err(t("be-err-items").to_owned()) };
                let border_id = match self.border_mode {
                    BorderMode::None => 0,
                    BorderMode::Existing => self.existing_border,
                    BorderMode::New => {
                        if self.new_border.iter().all(|&i| i == 0) {
                            return Err(t("be-err-border").to_owned());
                        }
                        if self.new_border_id == 0 {
                            self.new_border_id = self.custom.next_border_id(existing_borders);
                        }
                        let nb = NewBorder { id: self.new_border_id, edges: self.new_border };
                        match self.custom.borders.iter_mut().find(|b| b.id == nb.id) {
                            Some(slot) => *slot = nb,
                            None => self.custom.borders.push(nb),
                        }
                        self.new_border_id
                    }
                };
                CustomBrush::Ground(GroundDef { name, look_id: look_or(self.look, first), z_order: self.z_order, items: gi, border_id, outer: self.outer, to_none: self.to_none })
            }
            BeTab::Wall => {
                let nodes: Vec<(String, Vec<ChanceItem>)> =
                    WALL_TYPES.iter().zip(&self.wall).filter(|(_, &id)| id != 0).map(|(ty, &id)| (ty.to_string(), vec![ChanceItem { id, chance: 1 }])).collect();
                let Some(first) = nodes.first().map(|n| n.1[0].id) else { return Err(t("be-err-items").to_owned()) };
                CustomBrush::Wall(AlignedDef { name, look_id: look_or(self.look, first), nodes, doors: self.doors.iter().filter(|d| d.id != 0).cloned().collect() })
            }
            BeTab::Carpet | BeTab::Table => {
                let (aligns, ids): (&[&str], &[u16]) = if self.tab == BeTab::Carpet { (&CARPET_ALIGNS, &self.carpet) } else { (&TABLE_ALIGNS, &self.table) };
                let nodes: Vec<(String, Vec<ChanceItem>)> = aligns.iter().zip(ids).filter(|(_, &id)| id != 0).map(|(a, &id)| (a.to_string(), vec![ChanceItem { id, chance: 1 }])).collect();
                let Some(first) = nodes.first().map(|n| n.1[0].id) else { return Err(t("be-err-items").to_owned()) };
                let def = AlignedDef { name, look_id: look_or(self.look, first), nodes, doors: vec![] };
                if self.tab == BeTab::Carpet { CustomBrush::Carpet(def) } else { CustomBrush::Table(def) }
            }
            BeTab::Doodad => {
                let singles = items(&self.singles);
                if singles.is_empty() && self.composite.is_empty() {
                    return Err(t("be-err-doodad").to_owned());
                }
                let first = singles.first().map(|c| c.id).or_else(|| self.composite.iter().find(|c| c.0 == 0 && c.1 == 0).or(self.composite.first()).and_then(|c| c.3.last().copied())).unwrap_or(0);
                CustomBrush::Doodad(DoodadDef {
                    name,
                    look_id: look_or(self.look, first),
                    draggable: self.draggable,
                    on_blocking: self.on_blocking,
                    thickness: self.thickness,
                    singles,
                    composite: self.composite.clone(),
                })
            }
        })
    }
}

fn chance_list(ui: &mut egui::Ui, pc: &mut PickerCtx, salt: &str, list: &mut Vec<ChanceItem>) {
    let mut remove = None;
    for (i, c) in list.iter_mut().enumerate() {
        ui.horizontal(|ui| {
            item_picker(ui, pc, (salt, i), &mut c.id, false);
            ui.label(t("be-chance"));
            ui.add(egui::DragValue::new(&mut c.chance).range(0..=100000));
            if ui.small_button("🗑").clicked() {
                remove = Some(i);
            }
        });
    }
    if let Some(i) = remove {
        list.remove(i);
    }
    if ui.button(format!("➕ {}", t("be-add-item"))).clicked() {
        list.push(ChanceItem { id: pc.brush_item.unwrap_or(0), chance: 10 });
    }
}

const EDGE_KEYS: [&str; 12] = ["edge-n", "edge-e", "edge-s", "edge-w", "edge-cnw", "edge-cne", "edge-csw", "edge-cse", "edge-dnw", "edge-dne", "edge-dsw", "edge-dse"];

impl App {
    pub fn open_brush_editor(&mut self) {
        if self.brush_editor.is_none() {
            let dir = if self.settings.paths.extensions_dir.as_os_str().is_empty() {
                self.settings.paths.materials_xml.parent().map(|p| p.to_path_buf()).unwrap_or_default()
            } else {
                self.settings.paths.extensions_dir.clone()
            };
            self.brush_editor = Some(BrushEditor::new(dir.join("peixola_brushes.xml")));
        }
    }

    pub fn brush_editor_window(&mut self, ctx: &egui::Context) {
        let Some(mut be) = self.brush_editor.take() else { return };
        let frame = self.anim_frame(ctx);
        let brush_item = self.brush_item();
        let mut open = true;
        let mut save = false;
        let mut delete = false;
        let mut capture = false;
        let mut use_brush_after = false;
        let (Some(assets), Some(atlas)) = (&self.assets, &mut self.atlas) else {
            self.brush_editor = Some(be);
            return;
        };
        let mat = assets.mat.clone();
        let mut pc = PickerCtx { ctx, atlas, assets, brush_item, frame };
        egui::Window::new(t("be-title")).open(&mut open).default_size([720.0, 600.0]).show(ctx, |ui| {
            ui.horizontal_top(|ui| {
                // ---- left: saved custom brushes
                ui.vertical(|ui| {
                    ui.set_width(170.0);
                    ui.label(RichText::new(t("be-saved")).strong());
                    if ui.button(format!("➕ {}", t("be-new"))).clicked() {
                        let tab = be.tab;
                        be.reset(tab);
                    }
                    egui::ScrollArea::vertical().id_salt("be-list").max_height(480.0).show(ui, |ui| {
                        let list = be.custom.brushes.clone();
                        for b in &list {
                            let sel = be.editing.as_deref() == Some(b.name());
                            if ui.selectable_label(sel, format!("{} ({})", b.name(), b.kind())).clicked() {
                                be.edit(b);
                            }
                        }
                        if list.is_empty() {
                            ui.label(RichText::new(t("be-none")).weak());
                        }
                    });
                    ui.label(RichText::new(be.path.display().to_string()).small().weak());
                });
                ui.separator();
                // ---- right: form
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        for (tab, key) in [(BeTab::Ground, "tab-terrain"), (BeTab::Wall, "be-wall"), (BeTab::Carpet, "be-carpet"), (BeTab::Table, "be-table"), (BeTab::Doodad, "tab-doodad")] {
                            if ui.selectable_label(be.tab == tab, t(key)).clicked() && be.tab != tab {
                                if be.editing.is_some() {
                                    be.reset(tab);
                                } else {
                                    be.tab = tab;
                                }
                            }
                        }
                    });
                    ui.separator();
                    egui::Grid::new("be-head").num_columns(2).show(ui, |ui| {
                        ui.label(t("name"));
                        ui.add(egui::TextEdit::singleline(&mut be.name).desired_width(260.0));
                        ui.end_row();
                        ui.label(t("be-look"));
                        item_picker(ui, &mut pc, "look", &mut be.look, true);
                        ui.end_row();
                    });
                    ui.separator();
                    egui::ScrollArea::vertical().id_salt("be-form").max_height(390.0).show(ui, |ui| match be.tab {
                        BeTab::Ground => {
                            ui.horizontal(|ui| {
                                ui.label("z-order");
                                ui.add(egui::DragValue::new(&mut be.z_order).range(0..=100000));
                            })
                            .response
                            .on_hover_text(t("be-zorder-tip"));
                            ui.label(RichText::new(t("be-ground-items")).strong());
                            chance_list(ui, &mut pc, "g", &mut be.ground_items);
                            ui.separator();
                            ui.horizontal(|ui| {
                                ui.label(RichText::new(t("be-border")).strong());
                                ui.radio_value(&mut be.border_mode, BorderMode::None, t("be-border-none"));
                                ui.radio_value(&mut be.border_mode, BorderMode::Existing, t("be-border-existing"));
                                ui.radio_value(&mut be.border_mode, BorderMode::New, t("be-border-new"));
                            });
                            let mut copy_from: Option<[u16; 12]> = None;
                            let preview: Option<[u16; 12]> = match be.border_mode {
                                BorderMode::None => None,
                                BorderMode::Existing => {
                                    let cur = mat.border_index.get(&be.existing_border).map(|&i| &mat.borders[i]);
                                    let label = cur.map(|b| format!("#{} (grupo {})", b.id, b.group)).unwrap_or_else(|| t("be-pick-border").to_owned());
                                    egui::ComboBox::from_id_salt("be-border").selected_text(label).height(400.0).show_ui(ui, |ui| {
                                        let mut ids: Vec<u32> = mat.border_index.keys().copied().collect();
                                        ids.sort_unstable();
                                        for id in ids {
                                            ui.selectable_value(&mut be.existing_border, id, format!("#{id}"));
                                        }
                                    });
                                    cur.map(|b| [b.tiles[1], b.tiles[2], b.tiles[3], b.tiles[4], b.tiles[5], b.tiles[6], b.tiles[7], b.tiles[8], b.tiles[9], b.tiles[10], b.tiles[12], b.tiles[11]])
                                }
                                BorderMode::New => {
                                    egui::ComboBox::from_id_salt("be-copy").selected_text(t("be-copy-from")).height(400.0).show_ui(ui, |ui| {
                                        let mut ids: Vec<u32> = mat.border_index.keys().copied().collect();
                                        ids.sort_unstable();
                                        for id in ids {
                                            if ui.selectable_label(false, format!("#{id}")).clicked() {
                                                let b = &mat.borders[mat.border_index[&id]];
                                                copy_from = Some([b.tiles[1], b.tiles[2], b.tiles[3], b.tiles[4], b.tiles[5], b.tiles[6], b.tiles[7], b.tiles[8], b.tiles[9], b.tiles[10], b.tiles[12], b.tiles[11]]);
                                            }
                                        }
                                    });
                                    egui::Grid::new("be-edges").num_columns(4).spacing([8.0, 4.0]).show(ui, |ui| {
                                        for (i, k) in EDGE_KEYS.iter().enumerate() {
                                            ui.label(t(k));
                                            item_picker(ui, &mut pc, ("edge", i), &mut be.new_border[i], false);
                                            if i % 2 == 1 {
                                                ui.end_row();
                                            }
                                        }
                                    });
                                    None
                                }
                            };
                            if let Some(c) = copy_from {
                                be.new_border = c;
                            }
                            if let Some(p) = preview {
                                ui.horizontal_wrapped(|ui| {
                                    for (i, id) in p.iter().enumerate() {
                                        pc.icon(ui, *id, 30.0).on_hover_text(format!("{} — {}", t(EDGE_KEYS[i]), pc.name(*id)));
                                    }
                                });
                            }
                            if be.border_mode != BorderMode::None {
                                ui.horizontal(|ui| {
                                    ui.radio_value(&mut be.outer, true, t("be-outer"));
                                    ui.radio_value(&mut be.outer, false, t("be-inner"));
                                    ui.checkbox(&mut be.to_none, t("be-to-none"));
                                });
                                ui.label(RichText::new(t("be-border-tip")).small().weak());
                            }
                        }
                        BeTab::Wall => {
                            egui::Grid::new("be-wall").num_columns(2).spacing([8.0, 4.0]).show(ui, |ui| {
                                for (i, ty) in WALL_TYPES.iter().enumerate() {
                                    ui.label(*ty);
                                    item_picker(ui, &mut pc, ("wall", i), &mut be.wall[i], true);
                                    ui.end_row();
                                }
                            });
                            ui.separator();
                            ui.label(RichText::new(t("be-doors")).strong());
                            let mut remove = None;
                            for (i, d) in be.doors.iter_mut().enumerate() {
                                ui.horizontal(|ui| {
                                    egui::ComboBox::from_id_salt(("dwt", i)).selected_text(d.wall_type.clone()).width(90.0).show_ui(ui, |ui| {
                                        for ty in ["horizontal", "vertical"] {
                                            ui.selectable_value(&mut d.wall_type, ty.to_owned(), ty);
                                        }
                                    });
                                    item_picker(ui, &mut pc, ("door", i), &mut d.id, false);
                                    egui::ComboBox::from_id_salt(("dk", i)).selected_text(d.kind.clone()).width(90.0).show_ui(ui, |ui| {
                                        for k in DOOR_TYPES {
                                            ui.selectable_value(&mut d.kind, k.to_owned(), k);
                                        }
                                    });
                                    ui.checkbox(&mut d.open, t("be-open"));
                                    if ui.small_button("🗑").clicked() {
                                        remove = Some(i);
                                    }
                                });
                            }
                            if let Some(i) = remove {
                                be.doors.remove(i);
                            }
                            if ui.button(format!("➕ {}", t("be-add-door"))).clicked() {
                                be.doors.push(DoorDef { wall_type: "horizontal".into(), id: 0, kind: "normal".into(), open: false });
                            }
                        }
                        BeTab::Carpet => {
                            egui::Grid::new("be-carpet").num_columns(2).spacing([8.0, 4.0]).show(ui, |ui| {
                                for (i, a) in CARPET_ALIGNS.iter().enumerate() {
                                    ui.label(if *a == "center" { t("edge-center") } else { t(EDGE_KEYS[i - 1]) });
                                    item_picker(ui, &mut pc, ("carpet", i), &mut be.carpet[i], true);
                                    ui.end_row();
                                }
                            });
                        }
                        BeTab::Table => {
                            egui::Grid::new("be-table").num_columns(2).spacing([8.0, 4.0]).show(ui, |ui| {
                                for (i, a) in TABLE_ALIGNS.iter().enumerate() {
                                    ui.label(*a);
                                    item_picker(ui, &mut pc, ("table", i), &mut be.table[i], true);
                                    ui.end_row();
                                }
                            });
                        }
                        BeTab::Doodad => {
                            ui.label(RichText::new(t("be-doodad-composite")).strong());
                            ui.horizontal(|ui| {
                                if ui.button(format!("⬚ {}", t("be-capture"))).on_hover_text(t("be-capture-tip")).clicked() {
                                    capture = true;
                                }
                                ui.checkbox(&mut be.include_ground, t("be-include-ground"));
                                if !be.composite.is_empty() && ui.button(t("be-clear")).clicked() {
                                    be.composite.clear();
                                }
                            });
                            if !be.composite.is_empty() {
                                let n: usize = be.composite.iter().map(|c| c.3.len()).sum();
                                ui.label(tf("be-captured", &[&be.composite.len(), &n]));
                                ui.horizontal_wrapped(|ui| {
                                    for (x, y, _, ids) in be.composite.iter().take(40) {
                                        if let Some(&top) = ids.last() {
                                            pc.icon(ui, top, 28.0).on_hover_text(format!("({x}, {y}) {}", pc.name(top)));
                                        }
                                    }
                                });
                            }
                            ui.separator();
                            ui.label(RichText::new(t("be-doodad-singles")).strong());
                            chance_list(ui, &mut pc, "d", &mut be.singles);
                            ui.separator();
                            ui.checkbox(&mut be.draggable, t("be-draggable"));
                            ui.checkbox(&mut be.on_blocking, t("be-on-blocking"));
                            ui.horizontal(|ui| {
                                ui.label(t("be-thickness"));
                                ui.add(egui::DragValue::new(&mut be.thickness.0).range(0..=1000));
                                ui.label("/");
                                ui.add(egui::DragValue::new(&mut be.thickness.1).range(0..=1000));
                            })
                            .response
                            .on_hover_text(t("be-thickness-tip"));
                        }
                    });
                    // Warn when an item already belongs to another brush (it would lose its auto-border).
                    let owners: Vec<String> = be
                        .used_items()
                        .into_iter()
                        .filter_map(|id| {
                            let b = mat.info(id).brush;
                            let n = mat.brush(b)?.name.clone();
                            (Some(n.as_str()) != be.editing.as_deref()).then(|| format!("{} → {n}", pc.name(id)))
                        })
                        .collect();
                    if !owners.is_empty() {
                        ui.colored_label(Color32::from_rgb(255, 200, 80), tf("be-warn-owned", &[&owners.join(", ")]));
                    }
                    ui.separator();
                    ui.horizontal(|ui| {
                        if ui.button(RichText::new(format!("💾 {}", t("be-save"))).strong()).clicked() {
                            save = true;
                        }
                        ui.checkbox(&mut use_brush_after, t("be-select-after"));
                        if be.editing.is_some() && ui.button(format!("🗑 {}", t("be-delete"))).clicked() {
                            delete = true;
                        }
                    });
                    if let Some((msg, err)) = &be.status {
                        ui.colored_label(if *err { Color32::LIGHT_RED } else { Color32::LIGHT_GREEN }, msg);
                    }
                });
            });
        });

        if capture {
            if let Some(ed) = &self.editor {
                let sel: Vec<_> = ed.selection.iter().copied().collect();
                if sel.is_empty() {
                    be.status = Some((t("be-err-selection").to_owned(), true));
                } else {
                    let min_x = sel.iter().map(|p| p.x).min().unwrap() as i32;
                    let min_y = sel.iter().map(|p| p.y).min().unwrap() as i32;
                    let min_z = sel.iter().map(|p| p.z).min().unwrap() as i32;
                    let mut comp: Vec<(i32, i32, i32, Vec<u16>)> = sel
                        .iter()
                        .filter_map(|p| {
                            let t = ed.map.get(*p)?;
                            let ids: Vec<u16> = t.ground.iter().filter(|_| be.include_ground).chain(t.items.iter()).map(|i| i.id).collect();
                            (!ids.is_empty()).then(|| (p.x as i32 - min_x, p.y as i32 - min_y, p.z as i32 - min_z, ids))
                        })
                        .collect();
                    comp.sort();
                    be.composite = comp;
                    be.status = None;
                }
            }
        }
        if delete {
            if let Some(name) = be.editing.clone() {
                be.custom.remove(&name);
                match be.custom.save(&be.path) {
                    Ok(()) => {
                        be.status = Some((tf("be-deleted", &[&name]), false));
                        let tab = be.tab;
                        be.reset(tab);
                        self.reload_materials(None);
                    }
                    Err(e) => be.status = Some((format!("{e:#}"), true)),
                }
            }
        }
        if save {
            let existing: Vec<u32> = mat.borders.iter().map(|b| b.id).collect();
            match be.build(existing.into_iter()) {
                Ok(def) => {
                    let name = def.name().to_owned();
                    let clash = mat.brush_by_name(&name).is_some() && !be.custom.brushes.iter().any(|b| b.name() == name);
                    if clash {
                        be.status = Some((t("be-err-exists").to_owned(), true));
                    } else {
                        if let Some(old) = be.editing.clone().filter(|o| *o != name) {
                            be.custom.remove(&old);
                        }
                        be.custom.upsert(def);
                        match be.custom.save(&be.path) {
                            Ok(()) => {
                                be.editing = Some(name.clone());
                                be.status = Some((tf("be-saved-ok", &[&name]), false));
                                self.reload_materials(use_brush_after.then_some(name));
                            }
                            Err(e) => be.status = Some((format!("{e:#}"), true)),
                        }
                    }
                }
                Err(msg) => be.status = Some((msg, true)),
            }
        }
        if open {
            self.brush_editor = Some(be);
        }
    }
}
