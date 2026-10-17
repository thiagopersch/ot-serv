//! Properties popups (right click → Properties), one window per object, with sections that
//! depend on the item type — like RME's `OldPropertiesWindow`.

use eframe::egui::{self, Color32, RichText};
use pme_core::item::{Attr, Item};
use pme_core::items::{otb_flags, ItemGroup};
use pme_core::map::Town;
use pme_core::position::Position;
use pme_core::tile::Tile;

use crate::app::App;
use crate::i18n::{t, tf};
use crate::widgets::{item_picker, PickerCtx};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PropTarget {
    /// 0 = ground, n = `items[n - 1]`.
    Item(usize),
    Creature,
    Spawn,
}

pub struct PropWindow {
    pub id: u64,
    pub pos: Position,
    pub target: PropTarget,
    /// Working copy of the whole tile; committed on OK.
    pub edit: Tile,
    pub open: bool,
    pub add_item: u16,
    pub sel_child: Option<usize>,
}

/// TFS fluid types (subtype values stored in the map).
pub const FLUIDS: [(u8, &str); 21] = [
    (0, "fluid-empty"),
    (1, "fluid-water"),
    (2, "fluid-blood"),
    (3, "fluid-beer"),
    (4, "fluid-slime"),
    (5, "fluid-lemonade"),
    (6, "fluid-milk"),
    (7, "fluid-mana"),
    (10, "fluid-life"),
    (11, "fluid-oil"),
    (13, "fluid-urine"),
    (14, "fluid-coconut"),
    (15, "fluid-wine"),
    (19, "fluid-mud"),
    (21, "fluid-fruit"),
    (26, "fluid-lava"),
    (27, "fluid-rum"),
    (28, "fluid-swamp"),
    (35, "fluid-tea"),
    (43, "fluid-mead"),
    (8, "fluid-other"),
];

pub fn fluid_name(v: u16) -> String {
    FLUIDS.iter().find(|(k, _)| *k as u16 == v).map(|(_, n)| t(n).to_owned()).unwrap_or_else(|| format!("#{v}"))
}

const DIRECTIONS: [&str; 4] = ["dir-north", "dir-east", "dir-south", "dir-west"];

/// Outcome of drawing one window this frame.
#[derive(Default)]
struct Outcome {
    apply: bool,
    pick_dest: bool,
    goto: Option<Position>,
}

impl App {
    /// Open (or focus) a properties window for an object on a tile.
    pub fn open_properties(&mut self, pos: Position, target: PropTarget) {
        let Some(ed) = &self.editor else { return };
        let Some(tile) = ed.map.get(pos) else { return };
        if self.prop_windows.iter().any(|w| w.pos == pos && w.target == target) {
            return;
        }
        self.next_prop_id += 1;
        self.prop_windows.push(PropWindow { id: self.next_prop_id, pos, target, edit: tile.clone(), open: true, add_item: 0, sel_child: None });
    }

    /// Item that the "use current brush" buttons insert.
    pub fn brush_item(&self) -> Option<u16> {
        use pme_core::brushes::Brush;
        match (&self.brush, &self.assets) {
            (Some(Brush::Raw(id)), _) => Some(*id),
            (Some(Brush::Material(b)), Some(a)) => a.mat.brush(*b).map(|d| d.look_id).filter(|&i| i != 0),
            _ => None,
        }
    }

    pub fn properties_windows(&mut self, ctx: &egui::Context) {
        if self.prop_windows.is_empty() {
            return;
        }
        let frame = self.anim_frame(ctx);
        let brush_item = self.brush_item();
        let mut wins = std::mem::take(&mut self.prop_windows);
        let (Some(ed), Some(assets), Some(atlas)) = (&mut self.editor, &self.assets, &mut self.atlas) else {
            self.prop_windows = wins;
            return;
        };
        let towns = ed.map.towns.clone();
        let mut pc = PickerCtx { ctx, atlas, assets, brush_item, frame };
        let mut picks = None;
        let mut gotos = None;
        for w in &mut wins {
            // The map may have changed under us (undo, other edits): drop stale windows.
            if ed.map.get(w.pos).is_none() {
                w.open = false;
                continue;
            }
            let title = window_title(w, &pc);
            let mut open = true;
            let mut out = Outcome::default();
            egui::Window::new(title)
                .id(egui::Id::new(("props", w.id)))
                .open(&mut open)
                .collapsible(false)
                .resizable(false)
                .default_width(320.0)
                .show(ctx, |ui| {
                    ui.label(RichText::new(format!("📍 {}", w.pos)).monospace().weak());
                    ui.separator();
                    match w.target {
                        PropTarget::Item(k) => item_window(ui, w, k, &towns, &mut pc, &mut out),
                        PropTarget::Creature => creature_window(ui, w),
                        PropTarget::Spawn => {
                            ui.horizontal(|ui| {
                                ui.label(t("props-spawn-radius"));
                                ui.add(egui::DragValue::new(&mut w.edit.spawn_radius).range(1..=50));
                            });
                        }
                    }
                    ui.separator();
                    ui.horizontal(|ui| {
                        if ui.button(RichText::new(t("ok")).strong()).clicked() {
                            out.apply = true;
                        }
                        if ui.button(t("cancel")).clicked() {
                            w.open = false;
                        }
                    });
                });
            if out.apply {
                ed.begin("properties");
                ed.replace_tile(w.pos, w.edit.clone());
                ed.end();
                w.open = false;
            }
            if out.pick_dest {
                picks = Some(w.id);
            }
            if out.goto.is_some() {
                gotos = out.goto;
            }
            if !open {
                w.open = false;
            }
        }
        wins.retain(|w| w.open);
        self.prop_windows = wins;
        if picks.is_some() {
            self.picking_dest = picks;
        }
        if let Some(p) = gotos {
            self.goto(p);
        }
    }

    /// Called by the canvas when the user clicks while picking a teleport destination.
    pub fn deliver_pick(&mut self, p: Position) {
        if let Some(id) = self.picking_dest.take() {
            if let Some(w) = self.prop_windows.iter_mut().find(|w| w.id == id) {
                if let PropTarget::Item(k) = w.target {
                    if let Some(it) = item_mut(&mut w.edit, k) {
                        it.set_tele_dest(Some(p));
                    }
                }
            }
        }
    }
}

fn item_mut(t: &mut Tile, k: usize) -> Option<&mut Item> {
    if k == 0 { t.ground.as_mut() } else { t.items.get_mut(k - 1) }
}

fn window_title(w: &PropWindow, pc: &PickerCtx) -> String {
    match w.target {
        PropTarget::Item(k) => {
            let id = if k == 0 { w.edit.ground.as_ref().map(|g| g.id) } else { w.edit.items.get(k - 1).map(|i| i.id) };
            format!("{} — {}", t("props-window"), pc.name(id.unwrap_or(0)))
        }
        PropTarget::Creature => format!("{} — {}", t("props-creature"), w.edit.creature.as_ref().map(|c| c.name.as_str()).unwrap_or("?")),
        PropTarget::Spawn => t("brush-spawn").to_owned(),
    }
}

fn creature_window(ui: &mut egui::Ui, w: &mut PropWindow) {
    let Some(c) = w.edit.creature.as_mut() else { return };
    egui::Grid::new("creature").num_columns(2).show(ui, |ui| {
        ui.label(t("name"));
        ui.label(RichText::new(&c.name).strong());
        ui.end_row();
        ui.label(t("settings-spawn-time"));
        ui.add(egui::DragValue::new(&mut c.spawn_time).range(1..=86400).suffix(" s"));
        ui.end_row();
        ui.label(t("props-direction"));
        egui::ComboBox::from_id_salt("dir").selected_text(t(DIRECTIONS[(c.direction as usize).min(3)])).show_ui(ui, |ui| {
            for (i, d) in DIRECTIONS.iter().enumerate() {
                ui.selectable_value(&mut c.direction, i as u8, t(d));
            }
        });
        ui.end_row();
    });
}

fn item_window(ui: &mut egui::Ui, w: &mut PropWindow, k: usize, towns: &[Town], pc: &mut PickerCtx, out: &mut Outcome) {
    let house_tile = w.edit.house_id != 0;
    let Some(item) = item_mut(&mut w.edit, k) else {
        ui.label(t("props-empty"));
        return;
    };
    let ty = pc.assets.db.get(item.id).cloned().unwrap_or_default();
    ui.horizontal(|ui| {
        pc.icon(ui, item.id, 40.0);
        ui.vertical(|ui| {
            ui.label(RichText::new(&ty.name).strong().size(15.0));
            ui.label(RichText::new(format!("ID {} · {}", item.id, type_label(&ty))).weak());
        });
    });
    ui.add_space(4.0);

    egui::Grid::new("common").num_columns(2).spacing([10.0, 5.0]).show(ui, |ui| {
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

        if ty.is_stackable() {
            let mut c = item.subtype().max(1) as u8;
            ui.label(t("props-count"));
            if ui.add(egui::DragValue::new(&mut c).range(1..=100)).changed() {
                item.set_attr_count(c);
            }
            ui.end_row();
        }
        if ty.group == ItemGroup::Rune || item.attrs().iter().any(|a| matches!(a, Attr::RuneCharges(_))) {
            let mut c = item.subtype() as u8;
            ui.label(t("props-charges"));
            if ui.add(egui::DragValue::new(&mut c).range(0..=255)).changed() {
                item.upsert_attr(|a| matches!(a, Attr::RuneCharges(_)), Attr::RuneCharges(c));
            }
            ui.end_row();
        } else if ty.has(otb_flags::CLIENTCHARGES) || item.attrs().iter().any(|a| matches!(a, Attr::Charges(_))) {
            let mut c = item.subtype();
            ui.label(t("props-charges"));
            if ui.add(egui::DragValue::new(&mut c).range(0..=65535)).changed() {
                item.upsert_attr(|a| matches!(a, Attr::Charges(_)), Attr::Charges(c));
            }
            ui.end_row();
        }
        if ty.is_fluid() || ty.is_splash() {
            let mut v = item.subtype();
            ui.label(t("props-fluid"));
            egui::ComboBox::from_id_salt("fluid").selected_text(fluid_name(v)).show_ui(ui, |ui| {
                for (f, _) in FLUIDS {
                    ui.selectable_value(&mut v, f as u16, fluid_name(f as u16));
                }
            });
            if v != item.subtype() {
                item.set_attr_count(v as u8);
            }
            ui.end_row();
        }
        if ty.is_depot() {
            let mut d = item.depot_id();
            ui.label(t("props-depot-id"));
            let cur = towns.iter().find(|t| t.id as u16 == d).map(|t| t.name.clone()).unwrap_or_else(|| if d == 0 { t("props-none-town").to_owned() } else { format!("#{d}") });
            egui::ComboBox::from_id_salt("depot").selected_text(cur).show_ui(ui, |ui| {
                ui.selectable_value(&mut d, 0, t("props-none-town"));
                for tw in towns {
                    ui.selectable_value(&mut d, tw.id as u16, format!("{} (#{})", tw.name, tw.id));
                }
            });
            if d != item.depot_id() {
                item.set_depot_id(d);
            }
            ui.end_row();
        }
        if ty.is_door() {
            let mut d = item.door_id();
            ui.label(t("props-door-id"));
            ui.add_enabled_ui(house_tile, |ui| {
                if ui.add(egui::DragValue::new(&mut d)).on_disabled_hover_text(t("props-door-house-only")).changed() {
                    item.set_door_id(d);
                }
            });
            ui.end_row();
        }
    });

    if ty.is_teleport() || item.tele_dest().is_some() {
        ui.separator();
        ui.label(RichText::new(t("props-teleport")).strong());
        let mut d = item.tele_dest().unwrap_or_default();
        let mut ch = false;
        ui.horizontal(|ui| {
            ui.label("X");
            ch |= ui.add(egui::DragValue::new(&mut d.x)).changed();
            ui.label("Y");
            ch |= ui.add(egui::DragValue::new(&mut d.y)).changed();
            ui.label("Z");
            ch |= ui.add(egui::DragValue::new(&mut d.z).range(0..=15)).changed();
        });
        if ch {
            item.set_tele_dest(Some(d));
        }
        ui.horizontal(|ui| {
            if ui.button(format!("🎯 {}", t("props-pick-on-map"))).on_hover_text(t("props-pick-on-map-tip")).clicked() {
                out.pick_dest = true;
            }
            if ui.add_enabled(item.tele_dest().is_some(), egui::Button::new(t("props-goto-dest"))).clicked() {
                out.goto = item.tele_dest();
            }
            if item.tele_dest().is_some() && ui.button(t("remove")).clicked() {
                item.set_tele_dest(None);
            }
        });
    }

    let writeable = ty.group == ItemGroup::Writeable || ty.has(otb_flags::READABLE) || !item.text().is_empty();
    ui.separator();
    egui::Grid::new("texts").num_columns(2).spacing([10.0, 5.0]).show(ui, |ui| {
        if writeable {
            let mut text = item.text().to_owned();
            ui.label(t("props-text"));
            if ui.add(egui::TextEdit::multiline(&mut text).desired_rows(3).desired_width(220.0)).changed() {
                item.set_text(&text);
            }
            ui.end_row();
        }
        let mut desc = item.description().to_owned();
        ui.label(t("props-desc"));
        if ui.add(egui::TextEdit::singleline(&mut desc).desired_width(220.0)).changed() {
            item.set_description(&desc);
        }
        ui.end_row();
    });

    if ty.is_container() {
        ui.separator();
        ui.label(RichText::new(tf("props-container", &[&item.children().len()])).strong());
        let mut remove = None;
        ui.horizontal_wrapped(|ui| {
            for (i, c) in item.children().iter().enumerate() {
                let sel = w.sel_child == Some(i);
                let r = pc.icon(ui, c.id, 32.0).on_hover_text(pc.name(c.id));
                if sel {
                    ui.painter().rect_stroke(r.rect, 3.0, egui::Stroke::new(2.0_f32, Color32::from_rgb(80, 170, 255)), egui::StrokeKind::Outside);
                }
                if r.clicked() {
                    w.sel_child = Some(i);
                }
            }
        });
        if let Some(i) = w.sel_child.filter(|&i| i < item.children().len()) {
            let child = &mut item.ext_mut().children[i];
            ui.horizontal(|ui| {
                ui.label(pc.name(child.id));
                let mut aid = child.action_id();
                ui.label(t("props-action-id"));
                if ui.add(egui::DragValue::new(&mut aid)).changed() {
                    child.set_action_id(aid);
                }
                if pc.assets.db.get(child.id).is_some_and(|t| t.is_stackable()) {
                    let mut c = child.subtype().max(1) as u8;
                    if ui.add(egui::DragValue::new(&mut c).range(1..=100).prefix("x")).changed() {
                        child.set_attr_count(c);
                    }
                }
                if ui.small_button("🗑").on_hover_text(t("remove")).clicked() {
                    remove = Some(i);
                }
            });
        }
        if let Some(i) = remove {
            item.ext_mut().children.remove(i);
            w.sel_child = None;
        }
        ui.horizontal(|ui| {
            item_picker(ui, pc, "add-child", &mut w.add_item, false);
            if ui.add_enabled(w.add_item != 0, egui::Button::new(t("props-add-item"))).clicked() {
                let id = w.add_item;
                let it = if pc.assets.db.get(id).is_some_and(|t| t.is_stackable()) { Item::with_count(id, 1) } else { Item::new(id) };
                item.ext_mut().children.push(it);
            }
        });
    }
}

fn type_label(ty: &pme_core::ItemType) -> &'static str {
    if ty.is_teleport() {
        t("type-teleport")
    } else if ty.is_door() {
        t("type-door")
    } else if ty.is_depot() {
        t("type-depot")
    } else if ty.is_container() {
        t("type-container")
    } else if ty.is_fluid() || ty.is_splash() {
        t("type-fluid")
    } else if ty.is_ground() {
        t("type-ground")
    } else if ty.group == ItemGroup::Writeable || ty.has(otb_flags::READABLE) {
        t("type-writeable")
    } else if ty.is_stackable() {
        t("type-stackable")
    } else {
        t("type-item")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fluid_names_known() {
        assert_eq!(fluid_name(1), crate::i18n::t("fluid-water"));
        assert_eq!(fluid_name(99), "#99");
        let mut ids: Vec<u8> = FLUIDS.iter().map(|(k, _)| *k).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), FLUIDS.len(), "duplicate fluid ids");
    }
}
