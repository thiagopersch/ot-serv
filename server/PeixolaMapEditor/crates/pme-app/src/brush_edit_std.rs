//! "Editar brush" — edits an existing brush (RME default materials or any other file) in place.
//! The form works directly on the XML element, so anything it does not show (specific cases,
//! unknown attributes) is preserved. An XML tab gives full control.

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText};
use pme_io::xml::{self, Elem};
use pme_io::xml_edit;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::widgets::{item_picker, PickerCtx};

pub struct StdBrushEdit {
    pub name: String,
    pub kind: String,
    pub path: PathBuf,
    pub elem: Elem,
    pub original: Elem,
    /// Borders edited from this window: (id, file, element).
    pub borders: Vec<(u32, PathBuf, Elem)>,
    pub editing_border: Option<u32>,
    pub xml_tab: bool,
    pub xml_text: String,
    pub xml_err: Option<String>,
    pub variation: usize,
    pub status: Option<(String, bool)>,
}

const EDGES: [&str; 12] = ["n", "e", "s", "w", "cnw", "cne", "csw", "cse", "dnw", "dne", "dsw", "dse"];
const EDGE_KEYS: [&str; 12] = ["edge-n", "edge-e", "edge-s", "edge-w", "edge-cnw", "edge-cne", "edge-csw", "edge-cse", "edge-dnw", "edge-dne", "edge-dsw", "edge-dse"];
const WALL_TYPES: [&str; 18] = [
    "horizontal", "vertical", "corner", "pole", "north end", "south end", "east end", "west end", "north T", "south T", "east T", "west T",
    "northwest diagonal", "northeast diagonal", "southwest diagonal", "southeast diagonal", "intersection", "untouchable",
];
const DOOR_TYPES: [&str; 8] = ["normal", "locked", "quest", "magic", "archway", "window", "hatch_window", "normal_alt"];
const CARPET_ALIGNS: [&str; 13] = ["center", "n", "e", "s", "w", "cnw", "cne", "csw", "cse", "dnw", "dne", "dsw", "dse"];
const TABLE_ALIGNS: [&str; 7] = ["alone", "north", "south", "east", "west", "horizontal", "vertical"];

fn num<T: std::str::FromStr + Default>(e: &Elem, k: &str) -> T {
    e.int(k).unwrap_or_default()
}

/// `<item id chance>` children of `parent`. Returns true if anything changed.
fn item_list(ui: &mut egui::Ui, pc: &mut PickerCtx, salt: &str, parent: &mut Elem, chance: bool) -> bool {
    let mut changed = false;
    let mut remove = None;
    for (n, i) in parent.child_indices("item").into_iter().enumerate() {
        let c = &mut parent.children[i];
        ui.horizontal(|ui| {
            let mut id: u16 = num(c, "id");
            if item_picker(ui, pc, (salt, n), &mut id, false) {
                c.set_attr("id", id.to_string());
                changed = true;
            }
            if chance {
                let mut ch: u32 = num(c, "chance");
                ui.label(t("be-chance"));
                if ui.add(egui::DragValue::new(&mut ch).range(0..=100000)).changed() {
                    c.set_attr("chance", ch.to_string());
                    changed = true;
                }
            }
            ui.label(RichText::new(pc.name(id)).small().weak());
            if ui.small_button("🗑").clicked() {
                remove = Some(i);
            }
        });
    }
    if let Some(i) = remove {
        parent.children.remove(i);
        changed = true;
    }
    if ui.small_button(format!("➕ {}", t("be-add-item"))).clicked() {
        let id = pc.brush_item.unwrap_or(0).to_string();
        let mut e = Elem::new("item", &[("id", &id)]);
        if chance {
            e.set_attr("chance", "10");
        }
        parent.children.push(e);
        changed = true;
    }
    changed
}

fn bool_attr(ui: &mut egui::Ui, e: &mut Elem, key: &str, label: &str) {
    let mut v = e.bool(key);
    if ui.checkbox(&mut v, label).changed() {
        e.set_attr(key, if v { "true" } else { "false" });
    }
}

fn combo(ui: &mut egui::Ui, id: impl std::hash::Hash, e: &mut Elem, key: &str, options: &[&str]) {
    let cur = e.attr(key).unwrap_or("").to_owned();
    egui::ComboBox::from_id_salt(id).selected_text(cur.clone()).width(130.0).show_ui(ui, |ui| {
        for o in options {
            if ui.selectable_label(cur == *o, *o).clicked() {
                e.set_attr(key, *o);
            }
        }
    });
}

impl App {
    /// Open the in-place editor for an existing brush.
    pub fn open_std_brush_editor(&mut self, ctx: &egui::Context, name: &str) {
        let Some(a) = &self.assets else { return };
        let Some(path) = a.mat.brush_source.get(name).cloned() else {
            self.toast(ctx, t("bse-no-source"), true);
            return;
        };
        match xml_edit::load_element(&path, "brush", "name", name) {
            Ok(elem) => {
                let kind = elem.attr("type").unwrap_or("").to_owned();
                self.std_brush_edit = Some(StdBrushEdit {
                    name: name.to_owned(),
                    kind,
                    path,
                    original: elem.clone(),
                    xml_text: elem.to_xml("", "\n"),
                    elem,
                    borders: Vec::new(),
                    editing_border: None,
                    xml_tab: false,
                    xml_err: None,
                    variation: 0,
                    status: None,
                });
            }
            Err(e) => self.toast(ctx, format!("{e:#}"), true),
        }
    }

    pub fn std_brush_edit_window(&mut self, ctx: &egui::Context) {
        let Some(mut st) = self.std_brush_edit.take() else { return };
        let frame = self.anim_frame(ctx);
        let brush_item = self.brush_item();
        let mut open = true;
        let mut save = false;
        let mut capture = false;
        let (Some(assets), Some(atlas)) = (&self.assets, &mut self.atlas) else {
            self.std_brush_edit = Some(st);
            return;
        };
        let mat = assets.mat.clone();
        let mut pc = PickerCtx { ctx, atlas, assets, brush_item, frame };
        let title = format!("{} — {} ({})", t("bse-title"), st.name, st.kind);
        egui::Window::new(title).id(egui::Id::new("std-brush-edit")).open(&mut open).default_size([640.0, 620.0]).show(ctx, |ui| {
            ui.horizontal(|ui| {
                if ui.selectable_label(!st.xml_tab, t("bse-form")).clicked() && st.xml_tab {
                    st.xml_tab = false;
                }
                if ui.selectable_label(st.xml_tab, "XML").clicked() && !st.xml_tab {
                    st.xml_text = st.elem.to_xml("", "\n");
                    st.xml_err = None;
                    st.xml_tab = true;
                }
                ui.separator();
                let dirty = st.elem != st.original || !st.borders.is_empty();
                if dirty {
                    ui.label(RichText::new(t("props-unsaved")).color(Color32::from_rgb(255, 200, 80)).small());
                }
            });
            ui.separator();
            egui::ScrollArea::vertical().id_salt("bse-scroll").max_height(470.0).auto_shrink([false, false]).show(ui, |ui| {
                if st.xml_tab {
                    ui.label(RichText::new(t("bse-xml-help")).small().weak());
                    ui.add(egui::TextEdit::multiline(&mut st.xml_text).code_editor().desired_rows(24).desired_width(f32::INFINITY));
                    return;
                }
                // ---- common
                egui::Grid::new("bse-head").num_columns(2).show(ui, |ui| {
                    ui.label(t("name"));
                    ui.label(RichText::new(&st.name).strong()).on_hover_text(t("bse-name-fixed"));
                    ui.end_row();
                    ui.label(t("be-look"));
                    let mut look: u16 = num(&st.elem, "server_lookid");
                    if item_picker(ui, &mut pc, "look", &mut look, true) {
                        st.elem.set_attr("server_lookid", look.to_string());
                    }
                    ui.end_row();
                });
                ui.separator();
                match st.kind.as_str() {
                    "ground" => ground_form(ui, &mut pc, &mut st, &mat),
                    "wall" | "wall decoration" => wall_form(ui, &mut pc, &mut st.elem),
                    "carpet" => aligned_form(ui, &mut pc, &mut st.elem, "carpet", &CARPET_ALIGNS),
                    "table" => aligned_form(ui, &mut pc, &mut st.elem, "table", &TABLE_ALIGNS),
                    "doodad" => {
                        if doodad_form(ui, &mut pc, &mut st) {
                            capture = true;
                        }
                    }
                    _ => {
                        ui.label(t("bse-use-xml"));
                    }
                }
            });
            if let Some(e) = &st.xml_err {
                ui.colored_label(Color32::LIGHT_RED, e);
            }
            ui.separator();
            ui.horizontal(|ui| {
                if st.xml_tab && ui.button(t("bse-apply-xml")).clicked() {
                    match xml::parse_str(&st.xml_text).map(|d| d.children.into_iter().find(|c| !c.name.starts_with('#'))) {
                        Ok(Some(e)) if e.is("brush") && e.attr("name") == Some(st.name.as_str()) && e.attr("type").unwrap_or("") == st.kind => {
                            st.elem = e;
                            st.xml_err = None;
                            st.xml_tab = false;
                        }
                        Ok(_) => st.xml_err = Some(t("bse-xml-mismatch").to_owned()),
                        Err(e) => st.xml_err = Some(format!("{e:#}")),
                    }
                }
                if ui.button(RichText::new(format!("💾 {}", t("be-save"))).strong()).clicked() {
                    save = true;
                }
                if ui.button(t("revert")).clicked() {
                    st.elem = st.original.clone();
                    st.borders.clear();
                    st.xml_text = st.elem.to_xml("", "\n");
                    st.status = None;
                }
            });
            ui.label(RichText::new(tf("bse-footer", &[&st.path.display()])).small().weak());
            if let Some((msg, err)) = &st.status {
                ui.colored_label(if *err { Color32::LIGHT_RED } else { Color32::LIGHT_GREEN }, msg);
            }
        });

        if capture {
            if let Some(ed) = &self.editor {
                let sel: Vec<_> = ed.selection.iter().copied().collect();
                if sel.is_empty() {
                    st.status = Some((t("be-err-selection").to_owned(), true));
                } else {
                    let (min_x, min_y, min_z) = (sel.iter().map(|p| p.x).min().unwrap() as i32, sel.iter().map(|p| p.y).min().unwrap() as i32, sel.iter().map(|p| p.z).min().unwrap() as i32);
                    let mut comp = Elem::new("composite", &[("chance", "10")]);
                    let mut tiles: Vec<_> = sel.iter().filter_map(|p| ed.map.get(*p).map(|t| (*p, t))).collect();
                    tiles.sort_by_key(|(p, _)| *p);
                    for (p, tile) in tiles {
                        let (x, y, z) = ((p.x as i32 - min_x).to_string(), (p.y as i32 - min_y).to_string(), (p.z as i32 - min_z).to_string());
                        let mut te = Elem::new("tile", &[("x", &x), ("y", &y)]);
                        if z != "0" {
                            te.set_attr("z", z);
                        }
                        for it in &tile.items {
                            te.children.push(Elem::new("item", &[("id", &it.id.to_string())]));
                        }
                        if !te.children.is_empty() {
                            comp.children.push(te);
                        }
                    }
                    variation_mut(&mut st.elem, st.variation).children.push(comp);
                    st.status = None;
                }
            }
        }
        if save {
            let mut result: anyhow::Result<()> = Ok(());
            if st.xml_tab {
                result = Err(anyhow::anyhow!(t("bse-apply-first")));
            }
            if result.is_ok() {
                result = xml_edit::replace_element(&st.path, "brush", "name", &st.name, &st.elem);
            }
            for (id, file, e) in &st.borders {
                if result.is_ok() {
                    result = xml_edit::replace_element(file, "border", "id", &id.to_string(), e);
                }
            }
            match result {
                Ok(()) => {
                    st.original = st.elem.clone();
                    st.borders.clear();
                    st.status = Some((tf("be-saved-ok", &[&st.name]), false));
                    self.reload_materials(None);
                }
                Err(e) => st.status = Some((format!("{e:#}"), true)),
            }
        }
        if open {
            self.std_brush_edit = Some(st);
        }
    }
}

fn ground_form(ui: &mut egui::Ui, pc: &mut PickerCtx, st: &mut StdBrushEdit, mat: &pme_core::materials::Materials) {
    ui.horizontal(|ui| {
        ui.label("z-order");
        let mut z: i32 = num(&st.elem, "z-order");
        if ui.add(egui::DragValue::new(&mut z).range(0..=100000)).on_hover_text(t("be-zorder-tip")).changed() {
            st.elem.set_attr("z-order", z.to_string());
        }
    });
    ui.label(RichText::new(t("be-ground-items")).strong());
    item_list(ui, pc, "gi", &mut st.elem, true);
    ui.separator();

    // Borders
    ui.label(RichText::new(t("bse-borders")).strong());
    let mut remove = None;
    let mut edit_border = None;
    for (n, i) in st.elem.child_indices("border").into_iter().enumerate() {
        let b = &mut st.elem.children[i];
        ui.group(|ui| {
            ui.horizontal(|ui| {
                ui.label(t("bse-align"));
                combo(ui, ("align", n), b, "align", &["outer", "inner"]);
                ui.label(t("bse-to"));
                let mut to = b.attr("to").unwrap_or("all").to_owned();
                if ui.add(egui::TextEdit::singleline(&mut to).desired_width(110.0)).on_hover_text(t("bse-to-tip")).changed() {
                    if to.trim().is_empty() || to == "all" {
                        b.remove_attr("to");
                    } else {
                        b.set_attr("to", to);
                    }
                }
                ui.label("id");
                let mut id: u32 = num(b, "id");
                if ui.add(egui::DragValue::new(&mut id)).changed() {
                    b.set_attr("id", id.to_string());
                }
                if ui.small_button(t("bse-edit-border")).clicked() {
                    edit_border = Some(id);
                }
                if ui.small_button("🗑").clicked() {
                    remove = Some(i);
                }
            });
            let id: u32 = num(b, "id");
            if let Some(&bi) = mat.border_index.get(&id) {
                let ab = &mat.borders[bi];
                ui.horizontal_wrapped(|ui| {
                    for (k, tile) in [1usize, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 11].iter().enumerate() {
                        let item = ab.tiles[*tile];
                        pc.icon(ui, item, 24.0).on_hover_text(format!("{} — {}", t(EDGE_KEYS[k]), pc.name(item)));
                    }
                });
            }
            let specific = b.child_indices("specific").len();
            if specific > 0 {
                ui.label(RichText::new(tf("bse-specific", &[&specific])).small().weak());
            }
        });
    }
    if let Some(i) = remove {
        st.elem.children.remove(i);
    }
    if ui.small_button(format!("➕ {}", t("bse-add-border"))).clicked() {
        st.elem.children.push(Elem::new("border", &[("align", "outer"), ("id", "0")]));
    }
    if let Some(id) = edit_border {
        if !st.borders.iter().any(|(b, _, _)| *b == id) {
            if let Some(file) = mat.border_source.get(&id) {
                match xml_edit::load_element(file, "border", "id", &id.to_string()) {
                    Ok(e) => st.borders.push((id, file.clone(), e)),
                    Err(e) => st.status = Some((format!("{e:#}"), true)),
                }
            } else {
                st.status = Some((t("bse-border-inline").to_owned(), true));
            }
        }
        st.editing_border = Some(id);
    }
    // Border items editor
    if let Some(id) = st.editing_border {
        if let Some((_, file, be)) = st.borders.iter_mut().find(|(b, _, _)| *b == id) {
            ui.group(|ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new(tf("bse-border-title", &[&id])).strong());
                    ui.label(RichText::new(file.display().to_string()).small().weak());
                });
                egui::Grid::new("bse-edges").num_columns(4).show(ui, |ui| {
                    for (k, edge) in EDGES.iter().enumerate() {
                        let idx = be.children.iter().position(|c| c.is("borderitem") && c.attr("edge") == Some(edge));
                        let mut item: u16 = idx.map(|i| num(&be.children[i], "item")).unwrap_or(0);
                        ui.label(t(EDGE_KEYS[k]));
                        if item_picker(ui, pc, ("edge", k), &mut item, false) {
                            match (idx, item) {
                                (Some(i), 0) => {
                                    be.children.remove(i);
                                }
                                (Some(i), v) => be.children[i].set_attr("item", v.to_string()),
                                (None, 0) => {}
                                (None, v) => be.children.push(Elem::new("borderitem", &[("edge", edge), ("item", &v.to_string())])),
                            }
                        }
                        if k % 2 == 1 {
                            ui.end_row();
                        }
                    }
                });
                ui.label(RichText::new(t("bse-border-shared")).small().color(Color32::from_rgb(255, 200, 80)));
            });
        }
    }
    ui.separator();

    // Friends / enemies
    ui.label(RichText::new(t("bse-friends")).strong());
    let mut remove = None;
    for (n, i) in st.elem.children.iter().enumerate().filter(|(_, c)| c.is("friend") || c.is("enemy")).map(|(i, _)| i).collect::<Vec<_>>().into_iter().enumerate() {
        let f = &mut st.elem.children[i];
        ui.horizontal(|ui| {
            let mut enemy = f.is("enemy");
            egui::ComboBox::from_id_salt(("fk", n)).selected_text(if enemy { "enemy" } else { "friend" }).width(80.0).show_ui(ui, |ui| {
                ui.selectable_value(&mut enemy, false, "friend");
                ui.selectable_value(&mut enemy, true, "enemy");
            });
            f.name = if enemy { "enemy".into() } else { "friend".into() };
            let mut name = f.attr("name").unwrap_or("").to_owned();
            if ui.add(egui::TextEdit::singleline(&mut name).desired_width(200.0)).changed() {
                f.set_attr("name", name);
            }
            if ui.small_button("🗑").clicked() {
                remove = Some(i);
            }
        });
    }
    if let Some(i) = remove {
        st.elem.children.remove(i);
    }
    if ui.small_button(format!("➕ {}", t("bse-add-friend"))).clicked() {
        st.elem.children.push(Elem::new("friend", &[("name", "")]));
    }
    if let Some(o) = st.elem.children.iter_mut().find(|c| c.is("optional")) {
        ui.horizontal(|ui| {
            ui.label(t("bse-optional"));
            let mut id: u32 = num(o, "id");
            if ui.add(egui::DragValue::new(&mut id)).changed() {
                o.set_attr("id", id.to_string());
            }
        });
    }
}

fn wall_form(ui: &mut egui::Ui, pc: &mut PickerCtx, elem: &mut Elem) {
    let mut remove = None;
    for (n, i) in elem.child_indices("wall").into_iter().enumerate() {
        let w = &mut elem.children[i];
        ui.group(|ui| {
            ui.horizontal(|ui| {
                ui.label(t("bse-wall-type"));
                combo(ui, ("wt", n), w, "type", &WALL_TYPES);
                if ui.small_button("🗑").clicked() {
                    remove = Some(i);
                }
            });
            item_list(ui, pc, &format!("w{n}"), w, true);
            let mut rm_door = None;
            for (dn, di) in w.child_indices("door").into_iter().enumerate() {
                let d = &mut w.children[di];
                ui.horizontal(|ui| {
                    ui.label(t("be-doors"));
                    let mut id: u16 = num(d, "id");
                    if item_picker(ui, pc, ("door", n, dn), &mut id, false) {
                        d.set_attr("id", id.to_string());
                    }
                    combo(ui, ("dt", n, dn), d, "type", &DOOR_TYPES);
                    bool_attr(ui, d, "open", t("be-open"));
                    bool_attr(ui, d, "locked", t("bse-locked"));
                    if ui.small_button("🗑").clicked() {
                        rm_door = Some(di);
                    }
                });
            }
            if let Some(di) = rm_door {
                w.children.remove(di);
            }
            if ui.small_button(format!("➕ {}", t("be-add-door"))).clicked() {
                w.children.push(Elem::new("door", &[("id", "0"), ("type", "normal"), ("open", "false")]));
            }
        });
    }
    if let Some(i) = remove {
        elem.children.remove(i);
    }
    if ui.small_button(format!("➕ {}", t("bse-add-wall"))).clicked() {
        elem.children.push(Elem::new("wall", &[("type", "horizontal")]));
    }
}

fn aligned_form(ui: &mut egui::Ui, pc: &mut PickerCtx, elem: &mut Elem, tag: &str, aligns: &[&str]) {
    let mut remove = None;
    for (n, i) in elem.child_indices(tag).into_iter().enumerate() {
        let c = &mut elem.children[i];
        ui.group(|ui| {
            ui.horizontal(|ui| {
                ui.label(t("bse-align"));
                combo(ui, ("al", n), c, "align", aligns);
                if c.attr("id").is_some() {
                    let mut id: u16 = num(c, "id");
                    if item_picker(ui, pc, ("aid", n), &mut id, true) {
                        c.set_attr("id", id.to_string());
                    }
                }
                if ui.small_button("🗑").clicked() {
                    remove = Some(i);
                }
            });
            if c.attr("id").is_none() {
                item_list(ui, pc, &format!("a{n}"), c, true);
            }
        });
    }
    if let Some(i) = remove {
        elem.children.remove(i);
    }
    if ui.small_button(format!("➕ {}", t("bse-add-align"))).clicked() {
        elem.children.push(Elem::new(tag, &[("align", aligns[0])]));
    }
}

/// Base element (variation 0) or the n-th `<alternate>`.
fn variation_mut(elem: &mut Elem, v: usize) -> &mut Elem {
    if v == 0 {
        return elem;
    }
    let idx = elem.child_indices("alternate");
    match idx.get(v - 1) {
        Some(&i) => &mut elem.children[i],
        None => elem,
    }
}

/// Returns true when the user asked to capture the map selection as a composite.
fn doodad_form(ui: &mut egui::Ui, pc: &mut PickerCtx, st: &mut StdBrushEdit) -> bool {
    let mut capture = false;
    ui.horizontal_wrapped(|ui| {
        bool_attr(ui, &mut st.elem, "draggable", t("be-draggable"));
        bool_attr(ui, &mut st.elem, "on_blocking", t("be-on-blocking"));
        bool_attr(ui, &mut st.elem, "on_duplicate", t("bse-on-duplicate"));
        bool_attr(ui, &mut st.elem, "redo_borders", t("bse-redo-borders"));
        bool_attr(ui, &mut st.elem, "one_size", t("bse-one-size"));
    });
    ui.horizontal(|ui| {
        ui.label(t("be-thickness"));
        let mut th = st.elem.attr("thickness").unwrap_or("").to_owned();
        if ui.add(egui::TextEdit::singleline(&mut th).desired_width(80.0).hint_text("25/100")).on_hover_text(t("be-thickness-tip")).changed() {
            if th.trim().is_empty() {
                st.elem.remove_attr("thickness");
            } else {
                st.elem.set_attr("thickness", th);
            }
        }
    });
    let alts = st.elem.child_indices("alternate").len();
    ui.horizontal(|ui| {
        ui.label(RichText::new(t("bse-variation")).strong());
        egui::ComboBox::from_id_salt("bse-var")
            .selected_text(if st.variation == 0 { t("bse-variation-base").to_owned() } else { format!("{} {}", t("bse-variation-alt"), st.variation) })
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut st.variation, 0, t("bse-variation-base"));
                for v in 1..=alts {
                    ui.selectable_value(&mut st.variation, v, format!("{} {v}", t("bse-variation-alt")));
                }
            });
        if ui.small_button(format!("➕ {}", t("bse-add-variation"))).clicked() {
            st.elem.children.push(Elem::new("alternate", &[]));
            st.variation = alts + 1;
        }
        if st.variation > 0 && ui.small_button(format!("🗑 {}", t("bse-remove-variation"))).clicked() {
            if let Some(&i) = st.elem.child_indices("alternate").get(st.variation - 1) {
                st.elem.children.remove(i);
            }
            st.variation = 0;
        }
    });
    if st.variation > alts {
        st.variation = 0;
    }
    let target = variation_mut(&mut st.elem, st.variation);
    ui.label(RichText::new(t("be-doodad-singles")).strong());
    item_list(ui, pc, "ds", target, true);
    ui.separator();
    ui.horizontal(|ui| {
        ui.label(RichText::new(t("bse-composites")).strong());
        if ui.small_button(format!("⬚ {}", t("be-capture"))).on_hover_text(t("be-capture-tip")).clicked() {
            capture = true;
        }
    });
    let mut remove = None;
    for (n, ci) in target.child_indices("composite").into_iter().enumerate() {
        let comp = &mut target.children[ci];
        let tiles = comp.child_indices("tile").len();
        egui::CollapsingHeader::new(tf("bse-composite", &[&(n + 1), &tiles])).id_salt(("comp", st.variation, n)).show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(t("be-chance"));
                let mut ch: u32 = num(comp, "chance");
                if ui.add(egui::DragValue::new(&mut ch).range(0..=100000)).changed() {
                    comp.set_attr("chance", ch.to_string());
                }
                if ui.small_button(format!("🗑 {}", t("remove"))).clicked() {
                    remove = Some(ci);
                }
            });
            let mut rm_tile = None;
            for (tn, ti) in comp.child_indices("tile").into_iter().enumerate() {
                let tile = &mut comp.children[ti];
                ui.horizontal(|ui| {
                    for k in ["x", "y", "z"] {
                        let mut v: i32 = num(tile, k);
                        ui.label(k);
                        if ui.add(egui::DragValue::new(&mut v).range(-15..=15)).changed() {
                            if k == "z" && v == 0 {
                                tile.remove_attr("z");
                            } else {
                                tile.set_attr(k, v.to_string());
                            }
                        }
                    }
                    if ui.small_button("🗑").clicked() {
                        rm_tile = Some(ti);
                    }
                });
                ui.indent(("ti", n, tn), |ui| {
                    item_list(ui, pc, &format!("c{n}t{tn}"), tile, false);
                });
            }
            if let Some(ti) = rm_tile {
                comp.children.remove(ti);
            }
            if ui.small_button(format!("➕ {}", t("bse-add-tile"))).clicked() {
                comp.children.push(Elem::new("tile", &[("x", "0"), ("y", "0")]));
            }
        });
    }
    if let Some(ci) = remove {
        target.children.remove(ci);
    }
    capture
}
