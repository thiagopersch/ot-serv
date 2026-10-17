//! Brushes created inside the editor. They live in their own RME-compatible materials file
//! (`RME/extensions/peixola_brushes.xml` by default), which the normal materials loader
//! picks up together with the other extensions.

use std::fmt::Write as _;
use std::path::Path;

use anyhow::Result;

use crate::xml::{self, Elem};

/// RME border edge names, in the order the editor shows them.
pub const EDGES: [&str; 12] = ["n", "e", "s", "w", "cnw", "cne", "csw", "cse", "dnw", "dne", "dsw", "dse"];
pub const WALL_TYPES: [&str; 12] = [
    "horizontal", "vertical", "corner", "pole", "north end", "south end", "east end", "west end", "north T", "south T", "east T", "west T",
];
pub const DOOR_TYPES: [&str; 8] = ["normal", "locked", "quest", "magic", "archway", "window", "hatch_window", "normal_alt"];
pub const CARPET_ALIGNS: [&str; 13] = ["center", "n", "e", "s", "w", "cnw", "cne", "csw", "cse", "dnw", "dne", "dsw", "dse"];
pub const TABLE_ALIGNS: [&str; 7] = ["alone", "north", "south", "east", "west", "horizontal", "vertical"];
pub const TILESET_NAME: &str = "Peixola (custom)";

#[derive(Clone, Debug, Default, PartialEq)]
pub struct ChanceItem {
    pub id: u16,
    pub chance: u32,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct NewBorder {
    pub id: u32,
    /// Item per edge, in [`EDGES`] order (0 = none).
    pub edges: [u16; 12],
}

#[derive(Clone, Debug, PartialEq)]
pub struct GroundDef {
    pub name: String,
    pub look_id: u16,
    pub z_order: i32,
    pub items: Vec<ChanceItem>,
    /// Border id (existing or one of [`CustomBrushes::borders`]); 0 = no border.
    pub border_id: u32,
    pub outer: bool,
    /// `to="none"`: border only against empty tiles.
    pub to_none: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DoorDef {
    pub wall_type: String,
    pub id: u16,
    pub kind: String,
    pub open: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AlignedDef {
    pub name: String,
    pub look_id: u16,
    /// (alignment / wall type, items)
    pub nodes: Vec<(String, Vec<ChanceItem>)>,
    pub doors: Vec<DoorDef>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DoodadDef {
    pub name: String,
    pub look_id: u16,
    pub draggable: bool,
    pub on_blocking: bool,
    pub thickness: (i32, i32),
    pub singles: Vec<ChanceItem>,
    /// One composite: (dx, dy, dz, item ids bottom→top).
    pub composite: Vec<(i32, i32, i32, Vec<u16>)>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum CustomBrush {
    Ground(GroundDef),
    Wall(AlignedDef),
    Carpet(AlignedDef),
    Table(AlignedDef),
    Doodad(DoodadDef),
}

impl CustomBrush {
    pub fn name(&self) -> &str {
        match self {
            CustomBrush::Ground(g) => &g.name,
            CustomBrush::Wall(a) | CustomBrush::Carpet(a) | CustomBrush::Table(a) => &a.name,
            CustomBrush::Doodad(d) => &d.name,
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            CustomBrush::Ground(_) => "ground",
            CustomBrush::Wall(_) => "wall",
            CustomBrush::Carpet(_) => "carpet",
            CustomBrush::Table(_) => "table",
            CustomBrush::Doodad(_) => "doodad",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct CustomBrushes {
    pub borders: Vec<NewBorder>,
    pub brushes: Vec<CustomBrush>,
}

fn chance_items(e: &Elem) -> Vec<ChanceItem> {
    e.children_named("item").filter_map(|i| Some(ChanceItem { id: i.int("id")?, chance: i.int("chance").unwrap_or(1) })).collect()
}

impl CustomBrushes {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.is_file() {
            return Ok(Self::default());
        }
        let doc = xml::parse_file(path)?;
        let mut out = Self::default();
        for root in doc.children.iter().filter(|e| e.is("materials")) {
            for e in &root.children {
                if e.is("border") {
                    let mut b = NewBorder { id: e.int("id").unwrap_or(0), edges: [0; 12] };
                    for bi in e.children_named("borderitem") {
                        if let (Some(edge), Some(item)) = (bi.attr("edge"), bi.int::<u16>("item")) {
                            if let Some(i) = EDGES.iter().position(|x| *x == edge) {
                                b.edges[i] = item;
                            }
                        }
                    }
                    out.borders.push(b);
                } else if e.is("brush") {
                    if let Some(b) = Self::parse_brush(e) {
                        out.brushes.push(b);
                    }
                }
            }
        }
        Ok(out)
    }

    fn parse_brush(e: &Elem) -> Option<CustomBrush> {
        let name = e.attr("name")?.to_owned();
        let look_id = e.int("server_lookid").unwrap_or(0);
        Some(match e.attr("type")? {
            "ground" => {
                let border = e.children_named("border").next();
                CustomBrush::Ground(GroundDef {
                    name,
                    look_id,
                    z_order: e.int("z-order").unwrap_or(0),
                    items: chance_items(e),
                    border_id: border.and_then(|b| b.int("id")).unwrap_or(0),
                    outer: border.is_none_or(|b| b.attr("align") != Some("inner")),
                    to_none: border.is_some_and(|b| b.attr("to") == Some("none")),
                })
            }
            "wall" => {
                let mut nodes = Vec::new();
                let mut doors = Vec::new();
                for w in e.children_named("wall") {
                    let ty = w.attr_or("type", "").to_owned();
                    for d in w.children_named("door") {
                        doors.push(DoorDef { wall_type: ty.clone(), id: d.int("id").unwrap_or(0), kind: d.attr_or("type", "normal").to_owned(), open: d.bool("open") });
                    }
                    nodes.push((ty, chance_items(w)));
                }
                CustomBrush::Wall(AlignedDef { name, look_id, nodes, doors })
            }
            "carpet" => {
                let nodes = e
                    .children_named("carpet")
                    .map(|c| {
                        let mut items = chance_items(c);
                        if items.is_empty() {
                            if let Some(id) = c.int("id") {
                                items.push(ChanceItem { id, chance: 1 });
                            }
                        }
                        (c.attr_or("align", "").to_owned(), items)
                    })
                    .collect();
                CustomBrush::Carpet(AlignedDef { name, look_id, nodes, doors: vec![] })
            }
            "table" => {
                let nodes = e.children_named("table").map(|c| (c.attr_or("align", "").to_owned(), chance_items(c))).collect();
                CustomBrush::Table(AlignedDef { name, look_id, nodes, doors: vec![] })
            }
            "doodad" => {
                let thickness = e.attr("thickness").and_then(|t| t.split_once('/')).map(|(a, b)| (a.parse().unwrap_or(0), b.parse().unwrap_or(0))).unwrap_or((0, 0));
                let composite = e
                    .children_named("composite")
                    .next()
                    .map(|c| {
                        c.children_named("tile")
                            .map(|t| (t.int("x").unwrap_or(0), t.int("y").unwrap_or(0), t.int("z").unwrap_or(0), t.children_named("item").filter_map(|i| i.int("id")).collect()))
                            .collect()
                    })
                    .unwrap_or_default();
                CustomBrush::Doodad(DoodadDef { name, look_id, draggable: e.bool("draggable"), on_blocking: e.bool("on_blocking"), thickness, singles: chance_items(e), composite })
            }
            _ => return None,
        })
    }

    /// Insert or replace (by name).
    pub fn upsert(&mut self, b: CustomBrush) {
        match self.brushes.iter_mut().find(|x| x.name() == b.name()) {
            Some(slot) => *slot = b,
            None => self.brushes.push(b),
        }
    }

    pub fn remove(&mut self, name: &str) {
        self.brushes.retain(|b| b.name() != name);
    }

    /// Next free border id, above every id already known (`existing`).
    pub fn next_border_id(&self, existing: impl Iterator<Item = u32>) -> u32 {
        existing.chain(self.borders.iter().map(|b| b.id)).max().unwrap_or(0).max(999) + 1
    }

    pub fn to_xml(&self) -> String {
        let esc = xml::escape;
        let mut s = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- Brushes created with PeixolaMapEditor (RME-compatible). -->\n<materials>\n");
        let items = |s: &mut String, indent: &str, v: &[ChanceItem]| {
            for i in v.iter().filter(|i| i.id != 0) {
                let _ = writeln!(s, "{indent}<item id=\"{}\" chance=\"{}\" />", i.id, i.chance);
            }
        };
        for b in &self.borders {
            let _ = writeln!(s, "\t<border id=\"{}\">", b.id);
            for (i, e) in EDGES.iter().enumerate() {
                if b.edges[i] != 0 {
                    let _ = writeln!(s, "\t\t<borderitem edge=\"{e}\" item=\"{}\" />", b.edges[i]);
                }
            }
            s.push_str("\t</border>\n");
        }
        for b in &self.brushes {
            match b {
                CustomBrush::Ground(g) => {
                    let _ = writeln!(s, "\t<brush name=\"{}\" type=\"ground\" server_lookid=\"{}\" z-order=\"{}\">", esc(&g.name), g.look_id, g.z_order);
                    items(&mut s, "\t\t", &g.items);
                    if g.border_id != 0 {
                        let to = if g.to_none { " to=\"none\"" } else { "" };
                        let _ = writeln!(s, "\t\t<border align=\"{}\"{to} id=\"{}\" />", if g.outer { "outer" } else { "inner" }, g.border_id);
                    }
                    s.push_str("\t</brush>\n");
                }
                CustomBrush::Wall(w) => {
                    let _ = writeln!(s, "\t<brush name=\"{}\" type=\"wall\" server_lookid=\"{}\">", esc(&w.name), w.look_id);
                    let mut types: Vec<&str> = w.nodes.iter().map(|(t, _)| t.as_str()).collect();
                    for d in &w.doors {
                        if !types.contains(&d.wall_type.as_str()) {
                            types.push(&d.wall_type);
                        }
                    }
                    for ty in types {
                        let node = w.nodes.iter().find(|(t, _)| t == ty).map(|(_, v)| v.as_slice()).unwrap_or(&[]);
                        let doors: Vec<&DoorDef> = w.doors.iter().filter(|d| d.wall_type == ty && d.id != 0).collect();
                        if node.iter().all(|i| i.id == 0) && doors.is_empty() {
                            continue;
                        }
                        let _ = writeln!(s, "\t\t<wall type=\"{ty}\">");
                        items(&mut s, "\t\t\t", node);
                        for d in doors {
                            let _ = writeln!(s, "\t\t\t<door id=\"{}\" type=\"{}\" open=\"{}\" />", d.id, d.kind, d.open);
                        }
                        s.push_str("\t\t</wall>\n");
                    }
                    s.push_str("\t</brush>\n");
                }
                CustomBrush::Carpet(c) | CustomBrush::Table(c) => {
                    let (ty, tag) = if matches!(b, CustomBrush::Carpet(_)) { ("carpet", "carpet") } else { ("table", "table") };
                    let _ = writeln!(s, "\t<brush name=\"{}\" type=\"{ty}\" server_lookid=\"{}\">", esc(&c.name), c.look_id);
                    for (align, v) in c.nodes.iter().filter(|(_, v)| v.iter().any(|i| i.id != 0)) {
                        let _ = writeln!(s, "\t\t<{tag} align=\"{align}\">");
                        items(&mut s, "\t\t\t", v);
                        let _ = writeln!(s, "\t\t</{tag}>");
                    }
                    s.push_str("\t</brush>\n");
                }
                CustomBrush::Doodad(d) => {
                    let _ = write!(s, "\t<brush name=\"{}\" type=\"doodad\" server_lookid=\"{}\" draggable=\"{}\" on_blocking=\"{}\"", esc(&d.name), d.look_id, d.draggable, d.on_blocking);
                    if d.thickness.1 > 0 {
                        let _ = write!(s, " thickness=\"{}/{}\"", d.thickness.0, d.thickness.1);
                    }
                    s.push_str(">\n");
                    items(&mut s, "\t\t", &d.singles);
                    if !d.composite.is_empty() {
                        s.push_str("\t\t<composite chance=\"10\">\n");
                        for (x, y, z, ids) in &d.composite {
                            let _ = write!(s, "\t\t\t<tile x=\"{x}\" y=\"{y}\"");
                            if *z != 0 {
                                let _ = write!(s, " z=\"{z}\"");
                            }
                            s.push_str(">\n");
                            for id in ids {
                                let _ = writeln!(s, "\t\t\t\t<item id=\"{id}\" />");
                            }
                            s.push_str("\t\t\t</tile>\n");
                        }
                        s.push_str("\t\t</composite>\n");
                    }
                    s.push_str("\t</brush>\n");
                }
            }
        }
        // Palette entries
        let _ = writeln!(s, "\t<tileset name=\"{TILESET_NAME}\">");
        let terrain: Vec<&CustomBrush> = self.brushes.iter().filter(|b| !matches!(b, CustomBrush::Doodad(_))).collect();
        let doodads: Vec<&CustomBrush> = self.brushes.iter().filter(|b| matches!(b, CustomBrush::Doodad(_))).collect();
        for (tag, list) in [("terrain", terrain), ("doodad", doodads)] {
            if list.is_empty() {
                continue;
            }
            let _ = writeln!(s, "\t\t<{tag}>");
            for b in list {
                let _ = writeln!(s, "\t\t\t<brush name=\"{}\" />", esc(b.name()));
            }
            let _ = writeln!(s, "\t\t</{tag}>");
        }
        s.push_str("\t</tileset>\n</materials>\n");
        s
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        crate::write_atomic(path, self.to_xml().as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_roundtrip() {
        let mut c = CustomBrushes::default();
        c.borders.push(NewBorder { id: 5000, edges: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
        c.upsert(CustomBrush::Ground(GroundDef { name: "my <ground>".into(), look_id: 100, z_order: 3500, items: vec![ChanceItem { id: 100, chance: 50 }], border_id: 5000, outer: true, to_none: false }));
        c.upsert(CustomBrush::Wall(AlignedDef {
            name: "my wall".into(),
            look_id: 1050,
            nodes: vec![("horizontal".into(), vec![ChanceItem { id: 1050, chance: 1 }]), ("vertical".into(), vec![ChanceItem { id: 1049, chance: 1 }])],
            doors: vec![DoorDef { wall_type: "horizontal".into(), id: 6252, kind: "normal".into(), open: false }],
        }));
        c.upsert(CustomBrush::Carpet(AlignedDef { name: "rug".into(), look_id: 7145, nodes: vec![("center".into(), vec![ChanceItem { id: 7145, chance: 1 }])], doors: vec![] }));
        c.upsert(CustomBrush::Table(AlignedDef { name: "desk".into(), look_id: 4191, nodes: vec![("alone".into(), vec![ChanceItem { id: 4191, chance: 1 }])], doors: vec![] }));
        c.upsert(CustomBrush::Doodad(DoodadDef { name: "tree".into(), look_id: 2700, draggable: true, on_blocking: false, thickness: (25, 100), singles: vec![], composite: vec![(0, 0, 0, vec![2700]), (-1, 0, 0, vec![2701, 2702])] }));
        let dir = std::env::temp_dir().join(format!("pme-writer-{}", std::process::id()));
        let path = dir.join("custom.xml");
        c.save(&path).unwrap();
        let back = CustomBrushes::load(&path).unwrap();
        assert_eq!(back, c);
        let _ = std::fs::remove_dir_all(dir);
    }
}
