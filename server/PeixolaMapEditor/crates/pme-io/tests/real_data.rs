//! Tests against the real server/client data of this project. They are `#[ignore]`d because
//! they need the data files; run with `cargo test --release -p pme-io -- --ignored --nocapture`.
//! Nothing is written to the data folders: round-trips happen in memory.

use std::path::{Path, PathBuf};
use std::time::Instant;

use pme_core::items::ItemDb;
use pme_core::map::Map;
use pme_io::{dat, materials_xml, otb, otbm, spr, world_xml};

/// The editor's own materials (`PeixolaMapEditor/data/materials`).
fn materials_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/materials").canonicalize().unwrap()
}

fn server_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..").canonicalize().unwrap()
}

fn client_things() -> PathBuf {
    server_dir().join("../cliente/data/things/860")
}

fn load_db() -> ItemDb {
    let s = server_dir();
    let mut db = ItemDb::default();
    let t = Instant::now();
    otb::load_otb(&s.join("data/items/items.otb"), &mut db).unwrap();
    otb::load_items_xml(&s.join("data/items/items.xml"), &mut db).unwrap();
    let opts = dat::read_otfi(&client_things().join("Tibia.otfi")).unwrap_or_default();
    let sig = dat::load_dat(&client_things().join("Tibia.dat"), &opts, &mut db).unwrap();
    println!(
        "items: max id {} (otb {}.{}.{}), dat sig {sig:#x}, {} item sprites, {} outfits in {:?}",
        db.max_id,
        db.otb_major,
        db.otb_minor,
        db.otb_build,
        db.sprites.len(),
        db.outfits.len(),
        t.elapsed()
    );
    db
}

/// Compare two maps tile by tile.
fn assert_same(a: &Map, b: &Map) {
    assert_eq!(a.tile_count(), b.tile_count(), "tile count");
    for (p, t) in a.tiles() {
        let o = b.get(p).unwrap_or_else(|| panic!("missing tile {p}"));
        assert_eq!(t, o, "tile {p} differs");
    }
    assert_eq!(a.towns, b.towns);
    assert_eq!(a.waypoints, b.waypoints);
    assert_eq!(a.descriptions, b.descriptions);
}

#[test]
#[ignore]
fn load_items_dat_spr() {
    let db = load_db();
    assert!(db.max_id > 100);
    // Invisible "tech" items: editorsuffix appended to the name, client ids used by RME.
    let t = db.get(460).unwrap();
    assert_eq!((t.client_id, t.name.as_str()), (470, "nothing special (Invisible Walkable Floor)"));
    assert_eq!(db.get(459).unwrap().client_id, 469);
    assert_eq!(db.get(1548).unwrap().client_id, 2187);
    let opts = dat::read_otfi(&client_things().join("Tibia.otfi")).unwrap_or_default();
    let f = spr::SpriteFile::open(&client_things().join("Tibia.spr"), opts.extended, true).unwrap();
    println!("spr: signature {:#x}, {} sprites", f.signature, f.count);
    // Grass (server id 4526) must have a decodable, non-empty sprite.
    let s = db.sprite(4526).expect("grass sprite");
    let mut buf = [0u8; spr::SPRITE_BYTES];
    assert!(f.decode(s.sprite_ids[0], &mut buf));
    assert!(buf.chunks(4).any(|p| p[3] != 0), "grass sprite is empty");
}

#[test]
#[ignore]
fn load_materials() {
    let db = load_db();
    let s = server_dir();
    let t = Instant::now();
    let m = materials_xml::load(&materials_dir().join("materials.xml"), &[materials_dir().join("extensions")], &db).unwrap();
    println!(
        "materials: {} brushes, {} borders, {} tilesets, {} warnings in {:?}",
        m.brushes.len(),
        m.borders.len(),
        m.tilesets.len(),
        m.warnings.len(),
        t.elapsed()
    );
    for w in m.warnings.iter().take(10) {
        println!("  warn: {w}");
    }
    let grass = m.brush_by_name("grass").expect("grass brush");
    let g = m.ground(grass).expect("grass is a ground brush");
    assert!(!g.items.is_empty() && !g.borders.is_empty());
}

#[test]
#[ignore]
fn roundtrip_small_map() {
    let db = load_db();
    let path = server_dir().join("data/world/new-items.otbm");
    let a = otbm::load(&path, &db, None).unwrap();
    let bytes = otbm::save_bytes(&a, &db);
    let b = otbm::load_bytes(&bytes, &db, None).unwrap();
    assert_same(&a, &b);
    // Saving twice must be byte-identical (deterministic writer).
    assert_eq!(bytes, otbm::save_bytes(&b, &db));
    println!("new-items.otbm: {} tiles round-tripped", a.tile_count());
}

#[test]
#[ignore]
fn roundtrip_main_map() {
    let db = load_db();
    let s = server_dir();
    let path = s.join("data/world/main.otbm");
    let t = Instant::now();
    let mut a = otbm::load(&path, &db, None).unwrap();
    let load_time = t.elapsed();
    let spawns = world_xml::load_spawns(&s.join("data/world/main-spawn.xml"), &mut a).unwrap();
    world_xml::load_houses(&s.join("data/world/main-house.xml"), &mut a).unwrap();
    println!(
        "main.otbm: {} tiles, {} towns, {} houses, {spawns} creatures, loaded in {load_time:?}",
        a.tile_count(),
        a.towns.len(),
        a.houses.len()
    );

    let t = Instant::now();
    let bytes = otbm::save_bytes(&a, &db);
    println!("saved {} bytes in {:?} (original {} bytes)", bytes.len(), t.elapsed(), std::fs::metadata(&path).unwrap().len());
    let b = otbm::load_bytes(&bytes, &db, None).unwrap();
    // Spawns/creatures live in the XML, not in the OTBM: compare without them.
    let mut a2 = otbm::load(&path, &db, None).unwrap();
    a2.revision = 0;
    assert_same(&a2, &b);

    let (xml, orphans) = world_xml::spawns_xml(&a);
    assert_eq!(orphans, 0, "creatures outside spawns");
    let mut c = Map::new();
    let n = world_xml::load_spawns_str(&xml, &mut c).unwrap();
    assert_eq!(n, spawns, "spawn round-trip creature count");
}

mod brushes_real {
    use super::*;
    use pme_core::brushes::{Brush, BrushShape};
    use pme_core::editor::Editor;
    use pme_core::materials::{wall, Materials};
    use pme_core::position::Position;
    use pme_core::tile::flags;
    use std::sync::Arc;

    fn setup() -> Editor {
        let db = load_db();
        let s = server_dir();
        let m: Materials = materials_xml::load(&materials_dir().join("materials.xml"), &[], &db).unwrap();
        Editor::new(Map::new(), Arc::new(db), Arc::new(m))
    }

    #[test]
    #[ignore]
    fn ground_brush_autoborders_and_undo() {
        let mut ed = setup();
        let grass = ed.mat.brush_by_name("grass").unwrap();
        let c = Position::new(100, 100, 7);
        ed.begin("draw");
        ed.draw(&Brush::Material(grass), c, 2, BrushShape::Square, false, None);
        ed.end();
        // 5x5 grass
        for dy in -2..=2 {
            for dx in -2..=2 {
                let t = ed.map.get(c.offset(dx, dy, 0).unwrap()).expect("grass tile");
                assert_eq!(ed.mat.ground_brush_of(t.ground.as_ref().unwrap().id), grass);
            }
        }
        // Edge tiles get borders (grass borders against "nothing"), the centre does not.
        let edge = ed.map.get(c.offset(-2, 0, 0).unwrap()).unwrap();
        let centre = ed.map.get(c).unwrap();
        let mat = ed.mat.clone();
        let borders = |t: &pme_core::Tile| t.items.iter().filter(|i| mat.info(i.id).is_border).count();
        println!("edge borders: {:?}", edge.items.iter().map(|i| i.id).collect::<Vec<_>>());
        assert!(borders(edge) > 0, "edge tile should have a border");
        assert_eq!(borders(centre), 0, "centre tile must not have borders");

        // Paint a different ground in the middle: borders between the two brushes appear.
        let sand = ed.mat.brush_by_name("sand").unwrap();
        ed.begin("draw");
        ed.draw(&Brush::Material(sand), c, 0, BrushShape::Square, false, None);
        ed.end();
        let around: usize = (-1..=1).flat_map(|dy| (-1..=1).map(move |dx| (dx, dy))).filter(|&(dx, dy)| (dx, dy) != (0, 0)).map(|(dx, dy)| borders(ed.map.get(c.offset(dx, dy, 0).unwrap()).unwrap())).sum::<usize>() + borders(ed.map.get(c).unwrap());
        assert!(around > 0, "grass/sand transition should create borders");

        assert!(ed.undo());
        assert!(ed.undo());
        assert_eq!(ed.map.tile_count(), 0, "undo must restore the empty map");
        assert!(ed.redo());
        assert_eq!(ed.map.tile_count() >= 25, true);
    }

    #[test]
    #[ignore]
    fn wall_brush_aligns() {
        let mut ed = setup();
        let w = ed.mat.brush_by_name("stone wall").unwrap();
        ed.begin("wall");
        for x in 200..=204 {
            ed.draw(&Brush::Material(w), Position::new(x, 200, 7), 0, BrushShape::Square, false, None);
        }
        ed.end();
        let mid = ed.map.get(Position::new(202, 200, 7)).unwrap();
        let info = ed.mat.info(mid.items[0].id);
        assert!(info.is_wall);
        assert_eq!(info.alignment, wall::HORIZONTAL, "middle of a horizontal line must be a horizontal wall");
        // Vertical line
        ed.begin("wall");
        for y in 300..=303 {
            ed.draw(&Brush::Material(w), Position::new(200, y, 7), 0, BrushShape::Square, false, None);
        }
        ed.end();
        let mid = ed.map.get(Position::new(200, 301, 7)).unwrap();
        assert_eq!(ed.mat.info(mid.items[0].id).alignment, wall::VERTICAL);
    }

    #[test]
    #[ignore]
    fn zones_houses_and_roundtrip() {
        let mut ed = setup();
        let grass = ed.mat.brush_by_name("grass").unwrap();
        let c = Position::new(500, 500, 7);
        ed.draw(&Brush::Material(grass), c, 1, BrushShape::Square, false, None);
        ed.draw(&Brush::Zone(flags::PROTECTION_ZONE), c, 1, BrushShape::Square, false, None);
        assert!(ed.map.get(c).unwrap().flags & flags::PROTECTION_ZONE != 0);
        // PvP replaces PZ (exclusive), No-Logout combines.
        ed.draw(&Brush::Zone(flags::PVP_ZONE), c, 0, BrushShape::Square, false, None);
        ed.draw(&Brush::Zone(flags::NO_LOGOUT), c, 0, BrushShape::Square, false, None);
        assert_eq!(ed.map.get(c).unwrap().flags, flags::PVP_ZONE | flags::NO_LOGOUT);
        // Zones never go on tiles without ground.
        ed.draw(&Brush::Zone(flags::PROTECTION_ZONE), Position::new(900, 900, 7), 0, BrushShape::Square, false, None);
        assert!(ed.map.get(Position::new(900, 900, 7)).is_none());
        // House brush
        ed.map.houses.push(pme_core::House { id: 7, name: "Test".into(), town_id: 1, rent: 0, entry: c, guildhall: false, size: 0 });
        ed.draw(&Brush::House(7), c.offset(1, 1, 0).unwrap(), 0, BrushShape::Square, false, None);
        let t = ed.map.get(c.offset(1, 1, 0).unwrap()).unwrap();
        assert_eq!((t.house_id, t.flags & flags::PROTECTION_ZONE), (7, flags::PROTECTION_ZONE));
        // Round-trip through OTBM bytes
        let bytes = otbm::save_bytes(&ed.map, &ed.db);
        let back = otbm::load_bytes(&bytes, &ed.db, None).unwrap();
        assert_same(&ed.map, &back);
        assert!(world_xml::houses_xml(&ed.map).contains("houseid=\"7\""));
    }

    #[test]
    #[ignore]
    fn doodad_copy_paste_move() {
        let mut ed = setup();
        let grass = ed.mat.brush_by_name("grass").unwrap();
        let c = Position::new(600, 600, 7);
        ed.draw(&Brush::Material(grass), c, 3, BrushShape::Square, false, None);
        // First doodad brush that has single items.
        let (did, _) = ed.mat.brushes.iter().enumerate().find_map(|(i, b)| match &b.kind {
            pme_core::materials::BrushKind::Doodad(d) if d.alternatives.iter().any(|a| a.single_chance > 0) && !d.on_blocking => Some((i as u32 + 1, d)),
            _ => None,
        }).unwrap();
        let before: usize = ed.map.tiles().map(|(_, t)| t.items.len()).sum();
        ed.draw(&Brush::Material(did), c, 0, BrushShape::Square, false, None);
        let after: usize = ed.map.tiles().map(|(_, t)| t.items.len()).sum();
        assert!(after > before, "doodad should add items");

        ed.select_area(c.offset(-1, -1, 0).unwrap(), c.offset(1, 1, 0).unwrap(), false);
        assert_eq!(ed.selection.len(), 9);
        assert_eq!(ed.copy(), 9);
        let target = Position::new(700, 700, 7);
        ed.paste(target);
        assert_eq!(ed.map.get(target).map(|t| t.ground.is_some()), Some(true));
        let n = ed.map.tile_count();
        ed.move_selection(5, 0, 0);
        assert!(ed.map.get(Position::new(705, 700, 7)).is_some());
        assert!(ed.undo(), "move is one undo step");
        assert_eq!(ed.map.tile_count(), n);
        assert!(ed.map.get(target).is_some());
    }

    #[test]
    #[ignore]
    fn custom_brushes_load_and_paint() {
        use pme_io::materials_writer::*;
        let db = load_db();
        let s = server_dir();
        let dir = std::env::temp_dir().join(format!("pme-custom-{}", std::process::id()));
        let mut c = CustomBrushes::default();
        // A new border made of the grass border items, and a ground using a sand item.
        let grass_border = [4542u16, 4543, 4544, 4545, 4546, 4547, 4548, 4549, 4550, 4551, 4552, 4553];
        let bid = c.next_border_id([2u32, 100].into_iter());
        c.borders.push(NewBorder { id: bid, edges: grass_border });
        c.upsert(CustomBrush::Ground(GroundDef { name: "peixola test ground".into(), look_id: 231, z_order: 9000, items: vec![ChanceItem { id: 231, chance: 10 }], border_id: bid, outer: true, to_none: false }));
        c.upsert(CustomBrush::Doodad(DoodadDef { name: "peixola test doodad".into(), look_id: 2700, draggable: false, on_blocking: true, thickness: (0, 0), singles: vec![], composite: vec![(0, 0, 0, vec![2700]), (1, 0, 0, vec![2701])] }));
        c.save(&dir.join("peixola_brushes.xml")).unwrap();

        let m = materials_xml::load(&materials_dir().join("materials.xml"), &[dir.clone()], &db).unwrap();
        let g = m.brush_by_name("peixola test ground").expect("custom ground loaded");
        let d = m.brush_by_name("peixola test doodad").expect("custom doodad loaded");
        assert!(m.tilesets.iter().any(|t| t.name == TILESET_NAME));
        let mut ed = Editor::new(Map::new(), Arc::new(db), Arc::new(m));
        let grass = ed.mat.brush_by_name("grass").unwrap();
        let p = Position::new(300, 300, 7);
        ed.draw(&Brush::Material(grass), p, 2, BrushShape::Square, false, None);
        ed.draw(&Brush::Material(g), p, 0, BrushShape::Square, false, None);
        // The custom ground is higher (z-order) than grass, so its outer border lands on the grass around it.
        let n = ed.map.get(p.offset(-1, 0, 0).unwrap()).unwrap();
        assert!(n.items.iter().any(|i| grass_border.contains(&i.id)), "custom border not applied: {:?}", n.items);
        ed.draw(&Brush::Material(d), Position::new(400, 400, 7), 0, BrushShape::Square, false, None);
        assert_eq!(ed.map.get(Position::new(401, 400, 7)).map(|t| t.items[0].id), Some(2701));
        let _ = std::fs::remove_dir_all(dir);
    }
}

#[test]
#[ignore]
fn creatures_unique_and_spawn_npcs_resolve() {
    let s = server_dir();
    let mut w = Vec::new();
    let list = pme_io::creatures::load(&s.join("data"), &mut w);
    let mut keys = std::collections::HashSet::new();
    for c in &list {
        assert!(keys.insert((c.is_npc, c.name.to_lowercase())), "duplicate creature key {}", c.name);
    }
    // Every NPC used in main-spawn.xml must exist as data/npc/<name>.xml.
    let mut m = Map::new();
    world_xml::load_spawns(&s.join("data/world/main-spawn.xml"), &mut m).unwrap();
    let missing: std::collections::BTreeSet<String> = m
        .tiles()
        .filter_map(|(_, t)| t.creature.as_ref())
        .filter(|c| c.is_npc && !keys.contains(&(true, c.name.to_lowercase())))
        .map(|c| c.name.clone())
        .collect();
    let npcs = list.iter().filter(|c| c.is_npc).count();
    println!("{} creatures ({npcs} NPCs); NPCs in spawns without a file: {missing:?}", list.len());
    for c in list.iter().filter(|c| c.is_npc && c.display != c.name) {
        println!("  {}.xml shows as '{}'", c.name, c.display);
    }
}

/// Byte-for-byte comparison with a map saved by RME: `PME_RME_OTBM=<file.otbm>`
/// (e.g. a version extracted from git). Load + save must reproduce RME's bytes exactly.
#[test]
#[ignore]
fn save_matches_rme_bytes() {
    let Some(path) = std::env::var_os("PME_RME_OTBM") else {
        println!("PME_RME_OTBM not set: skipped");
        return;
    };
    let db = load_db();
    let original = std::fs::read(&path).unwrap();
    let map = otbm::load_bytes(&original, &db, None).unwrap();
    let saved = otbm::save_bytes(&map, &db);
    let first_diff = original.iter().zip(&saved).position(|(a, b)| a != b);
    println!("RME {} bytes, PeixolaMapEditor {} bytes, first difference at {first_diff:?}", original.len(), saved.len());
    assert_eq!(first_diff, None, "content differs");
    assert_eq!(original.len(), saved.len(), "length differs");
}

/// Copy of the bundled materials in a temp dir (tests never touch the real files).
fn temp_materials() -> PathBuf {
    // One folder per call: tests run in parallel and each removes its copy at the end.
    static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let src = materials_dir();
    let dst = std::env::temp_dir().join(format!("pme-860-{}-{n}", std::process::id()));
    std::fs::create_dir_all(&dst).unwrap();
    for f in std::fs::read_dir(&src).unwrap().flatten() {
        let p = f.path();
        if p.extension().is_some_and(|e| e == "xml") {
            std::fs::copy(&p, dst.join(p.file_name().unwrap())).unwrap();
        }
    }
    dst
}

#[test]
#[ignore]
fn edit_default_brush_in_place() {
    use pme_io::{xml, xml_edit};
    let db = load_db();
    let dir = temp_materials();
    let mat = materials_xml::load(&dir.join("materials.xml"), &[], &db).unwrap();
    // Every brush and border element round-trips through the serializer.
    let mut checked = 0;
    for (name, file) in &mat.brush_source {
        let text = std::fs::read(file).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap();
        let r = xml_edit::find_element(&text, "brush", "name", name).unwrap_or_else(|| panic!("brush {name} not found in {}", file.display()));
        let e = xml::parse_str(&text[r]).unwrap().children.remove(0);
        let again = xml::parse_str(&e.to_xml("\t", "\r\n")).unwrap().children.remove(0);
        assert_eq!(again, e, "round-trip of brush {name}");
        checked += 1;
    }
    for (id, file) in &mat.border_source {
        let e = xml_edit::load_element(file, "border", "id", &id.to_string()).unwrap();
        assert_eq!(xml::parse_str(&e.to_xml("", "\n")).unwrap().children.remove(0), e);
    }
    println!("{checked} brushes and {} borders round-trip", mat.border_source.len());

    // Edit grass: add an item, save in place, reload.
    let grass_file = mat.brush_source["grass"].clone();
    let before = std::fs::read(&grass_file).unwrap();
    let mut e = xml_edit::load_element(&grass_file, "brush", "name", "grass").unwrap();
    e.children.insert(0, xml::Elem::new("item", &[("id", "4541"), ("chance", "777")]));
    xml_edit::replace_element(&grass_file, "brush", "name", "grass", &e).unwrap();
    let after = std::fs::read(&grass_file).unwrap();
    let r = xml_edit::find_element(&String::from_utf8_lossy(&before), "brush", "name", "grass").unwrap();
    assert_eq!(&after[..r.start], &before[..r.start], "file prefix unchanged");
    let tail = before.len() - r.end;
    assert_eq!(&after[after.len() - tail..], &before[r.end..], "file suffix unchanged");

    let mat2 = materials_xml::load(&dir.join("materials.xml"), &[], &db).unwrap();
    let g = mat2.ground(mat2.brush_by_name("grass").unwrap()).unwrap();
    assert!(g.total_chance >= 777 && g.items.iter().any(|(id, _)| *id == 4541));
    // Every other brush is unchanged in kind and item count.
    for (b1, b2) in mat.brushes.iter().zip(&mat2.brushes) {
        assert_eq!(b1.name, b2.name);
        if b1.name != "grass" {
            assert_eq!(format!("{:?}", b1.kind).len(), format!("{:?}", b2.kind).len(), "brush {} changed", b1.name);
        }
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
#[ignore]
fn tileset_fromid_and_edit() {
    use pme_core::materials::{PaletteKind, TilesetEntry};
    use pme_io::tileset_edit;
    let db = load_db();
    let dir = temp_materials();
    let mat = materials_xml::load(&dir.join("materials.xml"), &[], &db).unwrap();
    let stairs = mat.tilesets.iter().find(|t| t.name == "Stairs / Ramps / Ladders").expect("tileset");
    assert!(stairs.entries(PaletteKind::Terrain).any(|e| matches!(e, TilesetEntry::Item(459))), "item 459 (fromid only) must be listed");
    let total: usize = mat.tilesets.iter().map(|t| t.categories.iter().map(|c| c.1.len()).sum::<usize>()).sum();
    println!("{total} tileset entries");

    // Add + remove an item through the in-place editor, on the temp copy.
    let file = mat.tileset_source["Stairs / Ramps / Ladders"].clone();
    assert!(tileset_edit::edit(&file, "Stairs / Ramps / Ladders", |t| {
        tileset_edit::add_item(t, PaletteKind::Terrain, 460);
        true
    })
    .unwrap());
    let m2 = materials_xml::load(&dir.join("materials.xml"), &[], &db).unwrap();
    let s2 = m2.tilesets.iter().find(|t| t.name == "Stairs / Ramps / Ladders").unwrap();
    assert!(s2.entries(PaletteKind::Terrain).any(|e| matches!(e, TilesetEntry::Item(460))));
    assert!(tileset_edit::edit(&file, "Stairs / Ramps / Ladders", |t| tileset_edit::remove_item(t, PaletteKind::Terrain, 460)).unwrap());
    let m3 = materials_xml::load(&dir.join("materials.xml"), &[], &db).unwrap();
    let s3 = m3.tilesets.iter().find(|t| t.name == "Stairs / Ramps / Ladders").unwrap();
    assert!(!s3.entries(PaletteKind::Terrain).any(|e| matches!(e, TilesetEntry::Item(460))));
    assert!(s3.entries(PaletteKind::Terrain).any(|e| matches!(e, TilesetEntry::Item(459))), "other entries kept");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
#[ignore]
fn staged_borders_and_scatter_real() {
    use pme_core::brushes::{Brush, BrushShape};
    use pme_core::editor::Editor;
    use pme_core::gen::scatter::{scatter, ScatterEntry, ScatterParams};
    use pme_core::position::Position;
    use pme_core::staged::{with_neighbours, Staged};
    use pme_core::Item;
    use std::sync::Arc;
    let db = Arc::new(load_db());
    let s = server_dir();
    let mat = Arc::new(materials_xml::load(&materials_dir().join("materials.xml"), &[], &db).unwrap());
    let area: Vec<Position> = (0..6u16).flat_map(|y| (0..6u16).map(move |x| Position::new(500 + x, 500 + y, 7))).collect();

    // A: borders computed on the real map.
    let mut a = Editor::new(Map::new(), db.clone(), mat.clone());
    for p in &area {
        a.map.set_tile(*p, pme_core::Tile { ground: Some(Item::new(4526)), ..Default::default() });
    }
    a.reborder(&with_neighbours(area.iter().copied()));
    // B: the same, staged first, then applied.
    let mut b = Editor::new(Map::new(), db.clone(), mat.clone());
    let ch = {
        let mut st = Staged::new(&b.map);
        for p in &area {
            st.set(*p, pme_core::Tile { ground: Some(Item::new(4526)), ..Default::default() });
        }
        st.reborder(&with_neighbours(area.iter().copied()), &db, &mat);
        st.into_changes()
    };
    b.apply_staged(&ch, "gen");
    let dump = |m: &Map| {
        let mut v: Vec<_> = m.tiles().map(|(p, t)| (p, t.clone())).collect();
        v.sort_by_key(|x| x.0);
        v
    };
    assert!(dump(&a.map).iter().any(|(_, t)| !t.items.is_empty()), "borders were generated");
    assert_eq!(dump(&a.map), dump(&b.map), "staged borders == map borders");

    // Scatter with a real doodad brush, twice with the same seed.
    let mut ed = Editor::new(Map::new(), db.clone(), mat.clone());
    let grass = mat.brush_by_name("grass").unwrap();
    ed.brush_seed = Some(9);
    ed.draw(&Brush::Material(grass), Position::new(700, 700, 7), 10, BrushShape::Square, false, None);
    let doodad = mat
        .brushes
        .iter()
        .enumerate()
        .find_map(|(i, b)| match &b.kind {
            pme_core::materials::BrushKind::Doodad(d) if !d.on_blocking && d.alternatives.iter().any(|a| a.single_chance > 0) => Some(i as u32 + 1),
            _ => None,
        })
        .unwrap();
    let zone: Vec<Position> = (0..21u16).flat_map(|y| (0..21u16).map(move |x| Position::new(690 + x, 690 + y, 7))).collect();
    let params = ScatterParams { entries: vec![(ScatterEntry::Doodad(doodad), 2), (ScatterEntry::Item(4541), 1)], density: 0.3, min_distance: 1, seed: 42, ..Default::default() };
    let r1 = scatter(&ed.map, &zone, &params, &db, &mat);
    let r2 = scatter(&ed.map, &zone, &params, &db, &mat);
    assert!(!r1.is_empty());
    assert_eq!(r1, r2, "seed 42 twice → identical");
    let before = dump(&ed.map);
    let n = ed.apply_staged(&r1, "scatter");
    assert!(n > 0);
    // Save → reload keeps the scattered items and attributes.
    let bytes = otbm::save_bytes(&ed.map, &db);
    let back = otbm::load_bytes(&bytes, &db, None).unwrap();
    assert_same(&ed.map, &back);
    assert!(ed.undo());
    assert_eq!(dump(&ed.map), before, "undo restores the map");
    println!("staged borders ok; scatter placed objects on {n} tiles");
}

/// The bundled materials must load exactly like the RME originals they were copied from.
/// Skipped (printed) when the RME folder is no longer present.
#[test]
#[ignore]
fn bundled_materials_match_rme_originals() {
    let rme = server_dir().join("RME");
    if !rme.join("data/860/materials.xml").is_file() {
        println!("RME folder not present: nothing to compare (the editor does not need it)");
        return;
    }
    let db = load_db();
    let ours = materials_xml::load(&materials_dir().join("materials.xml"), &[materials_dir().join("extensions")], &db).unwrap();
    let orig = materials_xml::load(&rme.join("data/860/materials.xml"), &[rme.join("extensions")], &db).unwrap();
    assert_eq!(ours.brushes.len(), orig.brushes.len());
    assert_eq!(ours.borders.len(), orig.borders.len());
    assert_eq!(ours.tilesets.len(), orig.tilesets.len());
    let entries = |m: &pme_core::materials::Materials| m.tilesets.iter().map(|t| t.categories.iter().map(|c| c.1.len()).sum::<usize>()).sum::<usize>();
    assert_eq!(entries(&ours), entries(&orig));
    for (a, b) in ours.brushes.iter().zip(&orig.brushes) {
        assert_eq!(format!("{:?}", a.kind), format!("{:?}", b.kind), "brush {}", a.name);
    }
    println!("bundled materials == RME: {} brushes, {} borders, {} tilesets", ours.brushes.len(), ours.borders.len(), ours.tilesets.len());
}
