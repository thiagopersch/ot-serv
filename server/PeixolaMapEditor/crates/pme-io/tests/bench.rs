//! Baseline timings on the real data (run in release):
//!   cargo test --release -p pme-io --test bench -- --ignored --nocapture
//! Nothing is written to disk: the map is loaded, edited and serialized in memory.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

use pme_core::brushes::{Brush, BrushShape};
use pme_core::editor::Editor;
use pme_core::gen::scatter::{scatter, ScatterEntry, ScatterParams};
use pme_core::items::ItemDb;
use pme_core::position::Position;
use pme_io::{dat, materials_xml, otb, otbm};

/// The editor's own materials (`PeixolaMapEditor/data/materials`).
fn materials_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/materials").canonicalize().unwrap()
}

fn server_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..").canonicalize().unwrap()
}

fn ms(t: Instant) -> f64 {
    t.elapsed().as_secs_f64() * 1000.0
}

#[test]
#[ignore]
fn baseline_timings() {
    let s = server_dir();
    let things = s.join("../cliente/data/things/860");
    let mut db = ItemDb::default();
    let t = Instant::now();
    otb::load_otb(&s.join("data/items/items.otb"), &mut db).unwrap();
    otb::load_items_xml(&s.join("data/items/items.xml"), &mut db).unwrap();
    dat::load_dat(&things.join("Tibia.dat"), &dat::read_otfi(&things.join("Tibia.otfi")).unwrap_or_default(), &mut db).unwrap();
    let t_items = ms(t);
    let t = Instant::now();
    let mat = materials_xml::load(&materials_dir().join("materials.xml"), &[materials_dir().join("extensions")], &db).unwrap();
    let t_mat = ms(t);
    let db = Arc::new(db);
    let mat = Arc::new(mat);

    let t = Instant::now();
    let map = otbm::load(&s.join("data/world/main.otbm"), &db, None).unwrap();
    let t_load = ms(t);
    let tiles = map.tile_count();
    let t = Instant::now();
    let bytes = otbm::save_bytes(&map, &db);
    let t_save = ms(t);

    let mut ed = Editor::new(map, db.clone(), mat.clone());
    ed.brush_seed = Some(1);
    let grass = mat.brush_by_name("grass").unwrap();
    // 101x101 ground stroke (+ auto-border) in an empty area of the real map.
    let c = Position::new(5000, 5000, 7);
    let t = Instant::now();
    ed.begin("bench");
    ed.draw(&Brush::Material(grass), c, 50, BrushShape::Square, false, None);
    ed.end();
    let t_brush = ms(t);
    let t = Instant::now();
    assert!(ed.undo());
    let t_undo = ms(t);
    assert!(ed.redo());

    // Scatter over 200x200 candidate positions around the painted square.
    let doodad = mat.brushes.iter().position(|b| matches!(&b.kind, pme_core::materials::BrushKind::Doodad(d) if !d.on_blocking)).unwrap() as u32 + 1;
    let area: Vec<Position> = (0..200u16).flat_map(|y| (0..200u16).map(move |x| Position::new(4900 + x, 4900 + y, 7))).collect();
    let params = ScatterParams { entries: vec![(ScatterEntry::Doodad(doodad), 1), (ScatterEntry::Item(4541), 1)], density: 0.2, seed: 5, ..Default::default() };
    let t = Instant::now();
    let ch = scatter(&ed.map, &area, &params, &db, &mat);
    let t_scatter = ms(t);
    let t = Instant::now();
    let applied = ed.apply_staged(&ch, "scatter");
    let t_apply = ms(t);
    let t = Instant::now();
    assert!(ed.undo());
    let t_undo_scatter = ms(t);

    println!("---- PeixolaMapEditor baseline (release, this machine) ----");
    println!("items.otb + items.xml + Tibia.dat : {t_items:8.1} ms");
    println!("materials (bundled + extensions)   : {t_mat:8.1} ms");
    println!("load main.otbm ({tiles} tiles)     : {t_load:8.1} ms");
    println!("serialize main.otbm ({} MB)       : {t_save:8.1} ms", bytes.len() / 1_000_000);
    println!("ground brush 101x101 + borders    : {t_brush:8.1} ms");
    println!("undo of that stroke               : {t_undo:8.1} ms");
    println!("scatter 200x200 candidates        : {t_scatter:8.1} ms ({} tiles staged)", ch.len());
    println!("apply staged ({applied} tiles)          : {t_apply:8.1} ms");
    println!("undo of the scatter               : {t_undo_scatter:8.1} ms");
}
