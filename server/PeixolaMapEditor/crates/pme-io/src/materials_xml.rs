//! RME materials XML loader (materials.xml + includes + extensions).
//! Two passes: first every brush name is registered (so forward references work), then
//! definitions are loaded in file order, like RME's `Materials::unserializeMaterials`.

use std::path::{Path, PathBuf};

use ahash::AHashMap;
use anyhow::Result;
use pme_core::item::Item;
use pme_core::items::ItemDb;
use pme_core::materials::*;

use crate::xml::{self, Elem};

struct Ctx<'a> {
    m: Materials,
    /// Editor-only meta items (`<metaitem id>`): valid in materials, absent from items.otb.
    meta: ahash::AHashSet<u16>,
    db: &'a ItemDb,
    client_to_server: AHashMap<u16, u16>,
}

impl Ctx<'_> {
    fn warn(&mut self, s: String) {
        if self.m.warnings.len() < 500 {
            self.m.warnings.push(s);
        }
    }

    fn valid(&self, id: u16) -> bool {
        self.db.get(id).is_some()
    }

    fn is_meta(&self, id: u16) -> bool {
        self.meta.contains(&id)
    }

    fn look_id(&self, e: &Elem) -> u16 {
        if let Some(id) = e.int::<u16>("server_lookid") {
            return id;
        }
        e.int::<u16>("lookid").and_then(|c| self.client_to_server.get(&c).copied()).unwrap_or(0)
    }
}

/// Collect (dir, element) for every top-level element across includes, in order.
fn collect(path: &Path, out: &mut Vec<(PathBuf, Elem)>, warnings: &mut Vec<String>, depth: u32) {
    if depth > 8 {
        return;
    }
    let doc = match xml::parse_file(path) {
        Ok(d) => d,
        Err(e) => {
            warnings.push(format!("{e:#}"));
            return;
        }
    };
    let dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    for root in doc.children.into_iter().filter(|e| e.is("materials")) {
        for e in root.children {
            if e.is("include") {
                if let Some(f) = e.attr("file") {
                    collect(&dir.join(f), out, warnings, depth + 1);
                }
            } else {
                out.push((path.to_path_buf(), e));
            }
        }
    }
}

pub fn load(materials_xml: &Path, extension_dirs: &[PathBuf], db: &ItemDb) -> Result<Materials> {
    let mut elems = Vec::new();
    let mut warnings = Vec::new();
    collect(materials_xml, &mut elems, &mut warnings, 0);
    for dir in extension_dirs {
        let Ok(rd) = std::fs::read_dir(dir) else { continue };
        let mut files: Vec<_> = rd.flatten().map(|f| f.path()).filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("xml"))).collect();
        files.sort();
        for f in files {
            collect(&f, &mut elems, &mut warnings, 0);
        }
    }

    let mut client_to_server = AHashMap::new();
    for t in db.items.iter().filter(|t| t.valid) {
        client_to_server.entry(t.client_id).or_insert(t.id);
    }
    let meta = elems.iter().filter(|(_, e)| e.is("metaitem")).filter_map(|(_, e)| e.int::<u16>("id")).collect();
    let mut cx = Ctx { m: Materials::default(), meta, db, client_to_server };
    cx.m.warnings = warnings;
    cx.m.item_info.resize(db.items.len(), ItemBrushInfo::default());

    // Pass 1: register brush names (and remember which file defines each brush / border).
    for (file, e) in &elems {
        if e.is("brush") {
            if let Some(name) = e.attr("name") {
                cx.m.ensure_brush(name);
                // The defining element is the one with children; a stub only counts if nothing else.
                if !e.children.is_empty() || !cx.m.brush_source.contains_key(name) {
                    cx.m.brush_source.insert(name.to_owned(), file.clone());
                }
            }
        } else if e.is("border") {
            if let Some(id) = e.int::<u32>("id") {
                cx.m.border_source.entry(id).or_insert_with(|| file.clone());
            }
        } else if e.is("tileset") {
            if let Some(name) = e.attr("name") {
                cx.m.tileset_source.entry(name.to_owned()).or_insert_with(|| file.clone());
            }
        }
    }
    // Pass 2: definitions, in order.
    for (_, e) in &elems {
        if e.is("border") {
            load_border(&mut cx, e, 0);
        } else if e.is("brush") {
            load_brush(&mut cx, e);
        } else if e.is("tileset") {
            load_tileset(&mut cx, e);
        }
    }
    Ok(cx.m)
}

fn load_border(cx: &mut Ctx, e: &Elem, ground_equivalent: u16) -> Option<usize> {
    let id = e.int::<u32>("id").unwrap_or(0);
    let optional = e.attr("type") == Some("optional");
    let group = e.int::<u16>("group").unwrap_or(0);
    let mut ab = AutoBorder { id, group, tiles: [0; 13] };
    for c in &e.children {
        let (Some(item), Some(edge)) = (c.int::<u16>("item"), c.attr("edge")) else { continue };
        if !cx.valid(item) {
            if !cx.is_meta(item) {
                cx.warn(format!("border {id}: invalid item {item}"));
            }
            continue;
        }
        let edge = border::from_edge_name(edge);
        let info = cx.m.info_mut(item);
        info.is_border = true;
        info.is_optional_border |= optional;
        if group != 0 && info.border_group == 0 {
            info.border_group = group;
        }
        if ground_equivalent != 0 {
            info.ground_equivalent = ground_equivalent;
        }
        if edge != border::NONE {
            ab.tiles[edge as usize] = item;
            if info.alignment == 0 {
                info.alignment = edge;
            }
        }
    }
    cx.m.borders.push(ab);
    let idx = cx.m.borders.len() - 1;
    if id != 0 && ground_equivalent == 0 {
        cx.m.border_index.insert(id, idx);
    }
    Some(idx)
}

fn brush_ref(cx: &mut Ctx, name: &str) -> Option<BrushId> {
    if name == "all" {
        return Some(BRUSH_ALL);
    }
    let r = cx.m.brush_by_name(name);
    if r.is_none() {
        cx.warn(format!("brush '{name}' is not defined"));
    }
    r
}

fn load_brush(cx: &mut Ctx, e: &Elem) {
    let Some(name) = e.attr("name") else { return };
    let id = cx.m.ensure_brush(name);
    let ty = e.attr("type").unwrap_or("").to_ascii_lowercase();
    let look = cx.look_id(e);
    // Stubs only declare the name/type.
    let kind = match ty.as_str() {
        "ground" => {
            let mut g = match &cx.m.brushes[id as usize - 1].kind {
                BrushKind::Ground(g) => g.clone(),
                _ => GroundBrush { randomize: true, ..Default::default() },
            };
            load_ground(cx, id, e, &mut g);
            BrushKind::Ground(g)
        }
        "wall" | "wall decoration" => {
            let mut w = match &cx.m.brushes[id as usize - 1].kind {
                BrushKind::Wall(w) | BrushKind::WallDecoration(w) => w.clone(),
                _ => WallBrush::new(),
            };
            load_wall(cx, id, e, &mut w);
            if ty == "wall" { BrushKind::Wall(w) } else { BrushKind::WallDecoration(w) }
        }
        "doodad" => BrushKind::Doodad(load_doodad(cx, id, e)),
        "carpet" => BrushKind::Carpet(load_carpet(cx, id, e)),
        "table" => BrushKind::Table(load_table(cx, id, e)),
        _ => return,
    };
    let b = &mut cx.m.brushes[id as usize - 1];
    if look != 0 {
        b.look_id = look;
    }
    // Do not overwrite a full definition with a later stub.
    let is_stub = e.children.is_empty();
    if !is_stub || matches!(b.kind, BrushKind::Unknown) {
        b.kind = kind;
    }
}

fn load_ground(cx: &mut Ctx, id: BrushId, e: &Elem, g: &mut GroundBrush) {
    if let Some(z) = e.int::<i32>("z-order") {
        g.z_order = z;
    }
    if e.attr("solo_optional").is_some() {
        g.use_only_optional = e.bool("solo_optional");
    }
    if e.attr("randomize").is_some() {
        g.randomize = e.bool("randomize");
    }
    for c in &e.children {
        let name = c.name.to_ascii_lowercase();
        match name.as_str() {
            "item" => {
                let item = c.int::<u16>("id").unwrap_or(0);
                let chance = c.int::<u32>("chance").unwrap_or(0);
                if !cx.valid(item) {
                    cx.warn(format!("ground '{}': invalid item {item}", cx.m.brushes[id as usize - 1].name));
                    continue;
                }
                cx.m.info_mut(item).brush = id;
                g.total_chance += chance;
                g.items.push((item, g.total_chance));
            }
            "optional" => {
                if let Some(ge) = c.int::<u16>("ground_equivalent") {
                    g.optional_border = load_border(cx, c, ge);
                } else if let Some(bid) = c.int::<u32>("id") {
                    g.optional_border = cx.m.border_index.get(&bid).copied();
                }
            }
            "border" => {
                let autoborder = if let Some(bid) = c.int::<u32>("id") {
                    if bid == 0 {
                        None
                    } else if let Some(&i) = cx.m.border_index.get(&bid) {
                        Some(i)
                    } else {
                        cx.warn(format!("could not find border id {bid}"));
                        continue;
                    }
                } else if let Some(ge) = c.int::<u16>("ground_equivalent") {
                    load_border(cx, c, ge)
                } else {
                    continue;
                };
                let to = match c.attr("to") {
                    None | Some("all") => BRUSH_ALL,
                    Some("none") => 0,
                    Some(n) => match brush_ref(cx, n) {
                        Some(b) => b,
                        None => continue,
                    },
                };
                let outer = c.attr("align") != Some("inner");
                match (outer, to == 0) {
                    (true, true) => g.has_outer_zilch_border = true,
                    (true, false) => g.has_outer_border = true,
                    (false, true) => g.has_inner_zilch_border = true,
                    (false, false) => g.has_inner_border = true,
                }
                let mut bb = BorderBlock { outer, to, autoborder, specific_cases: Vec::new() };
                for sc in c.children_named("specific") {
                    if let Some(case) = load_specific(cx, sc) {
                        bb.specific_cases.push(case);
                    }
                }
                g.borders.push(bb);
            }
            "friend" | "enemy" => {
                if let Some(n) = c.attr("name") {
                    if let Some(b) = brush_ref(cx, n) {
                        g.friends.push(b);
                    }
                }
                g.hate_friends = name == "enemy";
            }
            "clear_borders" => g.borders.clear(),
            "clear_friends" => {
                g.friends.clear();
                g.hate_friends = false;
            }
            _ => {}
        }
    }
    if g.total_chance == 0 {
        g.randomize = false;
    }
}

fn load_specific(cx: &mut Ctx, sc: &Elem) -> Option<SpecificCase> {
    let mut case = SpecificCase::default();
    let mut any = false;
    for part in &sc.children {
        if part.is("conditions") {
            for cond in &part.children {
                if cond.is("match_border") {
                    let (Some(bid), Some(edge)) = (cond.int::<u32>("id"), cond.attr("edge")) else { continue };
                    let Some(&i) = cx.m.border_index.get(&bid) else {
                        cx.warn(format!("unknown border id {bid} in specific case"));
                        continue;
                    };
                    case.items_to_match.push(cx.m.borders[i].tiles[border::from_edge_name(edge) as usize]);
                    any = true;
                } else if cond.is("match_group") {
                    let (Some(group), Some(edge)) = (cond.int::<u16>("group"), cond.attr("edge")) else { continue };
                    case.match_group = group;
                    case.group_match_alignment = border::from_edge_name(edge);
                    case.items_to_match.push(group);
                    any = true;
                } else if cond.is("match_item") {
                    let Some(id) = cond.int::<u16>("id") else { continue };
                    case.match_group = 0;
                    case.items_to_match.push(id);
                    any = true;
                }
            }
        } else if part.is("actions") {
            for act in &part.children {
                if act.is("replace_border") {
                    let (Some(bid), Some(edge), Some(with)) = (act.int::<u32>("id"), act.attr("edge"), act.int::<u16>("with")) else { continue };
                    let Some(&i) = cx.m.border_index.get(&bid) else { continue };
                    case.to_replace_id = cx.m.borders[i].tiles[border::from_edge_name(edge) as usize];
                    case.with_id = with;
                    cx.m.info_mut(with).is_border = true;
                    any = true;
                } else if act.is("replace_item") {
                    let (Some(id), Some(with)) = (act.int::<u16>("id"), act.int::<u16>("with")) else { continue };
                    case.to_replace_id = id;
                    case.with_id = with;
                    cx.m.info_mut(with).is_border = true;
                    any = true;
                } else if act.is("delete_borders") {
                    case.delete_all = true;
                    any = true;
                }
            }
        }
    }
    if sc.attr("keep_border").is_some() {
        case.keep_border = sc.bool("keep_border");
    }
    any.then_some(case)
}

fn door_kind(s: &str) -> Option<(Vec<DoorKind>, bool)> {
    use DoorKind::*;
    Some(match s {
        "normal" => (vec![Normal], false),
        "normal_alt" => (vec![NormalAlt], false),
        "locked" => (vec![Locked], false),
        "quest" => (vec![Quest], false),
        "magic" => (vec![Magic], false),
        "archway" => (vec![Archway], false),
        "window" => (vec![Window], true),
        "hatch_window" | "hatch window" => (vec![HatchWindow], true),
        "any door" => (vec![Archway, Normal, NormalAlt, Locked, Quest, Magic], false),
        "any window" => (vec![Window, HatchWindow], true),
        "any" => (vec![Window, HatchWindow, Archway, Normal, NormalAlt, Locked, Quest, Magic], true),
        _ => return None,
    })
}

fn load_wall(cx: &mut Ctx, id: BrushId, e: &Elem, w: &mut WallBrush) {
    for c in &e.children {
        if c.is("wall") {
            let Some(align) = c.attr("type").and_then(wall::from_name) else {
                cx.warn(format!("unknown wall alignment '{}'", c.attr_or("type", "")));
                continue;
            };
            for sub in &c.children {
                let item = sub.int::<u16>("id").unwrap_or(0);
                if item == 0 || !cx.valid(item) {
                    continue;
                }
                if sub.is("item") {
                    let info = cx.m.info_mut(item);
                    info.is_wall = true;
                    info.brush = id;
                    info.alignment = align;
                    let node = &mut w.nodes[align as usize];
                    node.total_chance += sub.int::<u32>("chance").unwrap_or(0);
                    node.items.push((item, node.total_chance));
                } else if sub.is("door") {
                    let Some((kinds, window)) = door_kind(sub.attr_or("type", "")) else { continue };
                    let open = if sub.attr("open").is_some() { sub.bool("open") } else { window };
                    let locked = sub.bool("locked");
                    let hate = sub.bool("hate");
                    let info = cx.m.info_mut(item);
                    info.is_wall = true;
                    info.brush = id;
                    info.is_brush_door = true;
                    info.wall_hate_me = hate;
                    info.is_open = open;
                    info.is_locked = locked;
                    info.alignment = align;
                    for k in kinds {
                        w.doors[align as usize].push(DoorDef { id: item, kind: k, locked });
                    }
                }
            }
        } else if c.is("friend") {
            let Some(n) = c.attr("name") else { continue };
            if n == "all" {
                continue;
            }
            let Some(b) = brush_ref(cx, n) else { continue };
            w.friends.push(b);
            if c.bool("redirect") && w.redirect_to == 0 {
                w.redirect_to = b;
            }
        }
    }
}

fn xml_item(e: &Elem) -> Option<Item> {
    let id = e.int::<u16>("id")?;
    let mut it = Item::new(id);
    if let Some(aid) = e.int::<u16>("actionid") {
        it.set_action_id(aid);
    }
    if let Some(n) = e.int::<u8>("subtype").or_else(|| e.int::<u8>("count")) {
        it.set_attr_count(n);
    }
    Some(it)
}

fn load_alternative(cx: &mut Ctx, id: BrushId, e: &Elem, alt: &mut DoodadAlternative) {
    for c in &e.children {
        if c.is("item") {
            let Some(chance) = c.int::<u32>("chance") else { continue };
            let Some(it) = xml_item(c).filter(|i| cx.valid(i.id)) else { continue };
            cx.m.info_mut(it.id).doodad = id;
            alt.single_chance += chance;
            alt.singles.push((it, chance));
        } else if c.is("composite") {
            let Some(chance) = c.int::<u32>("chance") else { continue };
            alt.composite_chance += chance;
            let mut cb = CompositeBlock { chance: alt.composite_chance, tiles: Vec::new() };
            for t in c.children_named("tile") {
                let (Some(x), Some(y)) = (t.int::<i32>("x"), t.int::<i32>("y")) else { continue };
                let z = t.int::<i32>("z").unwrap_or(0);
                let items: Vec<Item> = t.children_named("item").filter_map(xml_item).filter(|i| cx.valid(i.id)).collect();
                for i in &items {
                    cx.m.info_mut(i.id).doodad = id;
                }
                if !items.is_empty() {
                    cb.tiles.push((x, y, z, items));
                }
            }
            alt.composites.push(cb);
        }
    }
}

fn load_doodad(cx: &mut Ctx, id: BrushId, e: &Elem) -> DoodadBrush {
    let mut d = DoodadBrush {
        on_blocking: e.bool("on_blocking"),
        on_duplicate: e.bool("on_duplicate"),
        redo_borders: e.bool("redo_borders") || e.bool("reborder"),
        one_size: e.bool("one_size"),
        draggable: e.bool("draggable"),
        clear_optional_border: e.bool("remove_optional_border"),
        ..Default::default()
    };
    if let Some((a, b)) = e.attr("thickness").and_then(|t| t.split_once('/')) {
        d.thickness = a.trim().parse().unwrap_or(0);
        d.thickness_ceiling = b.trim().parse::<i32>().unwrap_or(0).max(d.thickness);
    }
    for c in e.children_named("alternate") {
        let mut alt = DoodadAlternative::default();
        load_alternative(cx, id, c, &mut alt);
        d.alternatives.push(alt);
    }
    let mut alt = d.alternatives.pop().unwrap_or_default();
    load_alternative(cx, id, e, &mut alt);
    d.alternatives.push(alt);
    d
}

fn load_carpet(cx: &mut Ctx, id: BrushId, e: &Elem) -> CarpetBrush {
    let mut cb = CarpetBrush { nodes: vec![WeightedNode::default(); 14] };
    for c in e.children_named("carpet") {
        let Some(a) = c.attr("align") else { continue };
        let align = match border::from_edge_name(a) {
            border::NONE if a == "center" => border::CARPET_CENTER,
            border::NONE => continue,
            v => v,
        };
        let mut items: Vec<(u16, u32)> = c.children_named("item").filter_map(|i| Some((i.int::<u16>("id")?, i.int::<u32>("chance")?))).collect();
        if items.is_empty() {
            if let Some(id) = c.int::<u16>("id") {
                items.push((id, 1));
            }
        }
        for (item, chance) in items {
            if !cx.valid(item) {
                continue;
            }
            let info = cx.m.info_mut(item);
            info.is_carpet = true;
            info.brush = id;
            let n = &mut cb.nodes[align as usize];
            n.total_chance += chance;
            n.items.push((item, chance));
        }
    }
    cb
}

fn load_table(cx: &mut Ctx, id: BrushId, e: &Elem) -> TableBrush {
    let mut tb = TableBrush { nodes: vec![WeightedNode::default(); table::COUNT] };
    for c in e.children_named("table") {
        let align = match c.attr_or("align", "") {
            "vertical" => table::VERTICAL,
            "horizontal" => table::HORIZONTAL,
            "south" => table::SOUTH_END,
            "east" => table::EAST_END,
            "north" => table::NORTH_END,
            "west" => table::WEST_END,
            "alone" => table::ALONE,
            _ => continue,
        };
        for i in c.children_named("item") {
            let Some(item) = i.int::<u16>("id").filter(|&x| cx.valid(x)) else { continue };
            let chance = i.int::<u32>("chance").unwrap_or(0);
            let info = cx.m.info_mut(item);
            info.is_table = true;
            info.brush = id;
            let n = &mut tb.nodes[align as usize];
            n.total_chance += chance;
            n.items.push((item, chance));
        }
    }
    tb
}

fn load_tileset(cx: &mut Ctx, e: &Elem) {
    let Some(name) = e.attr("name") else { return };
    let idx = match cx.m.tilesets.iter().position(|t| t.name == name) {
        Some(i) => i,
        None => {
            cx.m.tilesets.push(Tileset { name: name.to_owned(), categories: Vec::new() });
            cx.m.tilesets.len() - 1
        }
    };
    for cat in &e.children {
        let kinds: &[PaletteKind] = match cat.name.to_ascii_lowercase().as_str() {
            "terrain" => &[PaletteKind::Terrain],
            "doodad" => &[PaletteKind::Doodad],
            "items" => &[PaletteKind::Items],
            "raw" => &[PaletteKind::Raw],
            "terrain_and_raw" => &[PaletteKind::Terrain, PaletteKind::Raw],
            "doodad_and_raw" => &[PaletteKind::Doodad, PaletteKind::Raw],
            "items_and_raw" => &[PaletteKind::Items, PaletteKind::Raw],
            _ => continue,
        };
        let mut entries = Vec::new();
        let mut raw_entries = Vec::new();
        for c in &cat.children {
            if c.is("brush") {
                if let Some(b) = c.attr("name").and_then(|n| cx.m.brush_by_name(n)) {
                    entries.push(TilesetEntry::Brush(b));
                }
            } else if c.is("item") {
                let (from, to) = match (c.int::<u16>("id"), c.int::<u16>("fromid"), c.int::<u16>("toid")) {
                    (Some(id), _, _) => (id, id),
                    (None, Some(a), Some(b)) => (a, b),
                    // RME writes single items as `<item fromid="459" />` (no toid).
                    (None, Some(a), None) => (a, a),
                    _ => continue,
                };
                for id in from..=to {
                    if cx.valid(id) {
                        raw_entries.push(TilesetEntry::Item(id));
                    }
                }
            }
        }
        for &k in kinds {
            let list: Vec<TilesetEntry> = match k {
                PaletteKind::Raw if kinds.len() > 1 => raw_entries.clone(),
                _ => entries.iter().cloned().chain(raw_entries.iter().cloned()).collect(),
            };
            if !list.is_empty() {
                cx.m.tilesets[idx].categories.push((k, list));
            }
        }
    }
}
