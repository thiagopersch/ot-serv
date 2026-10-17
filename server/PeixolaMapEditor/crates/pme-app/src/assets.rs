//! Loading of game data (items, sprites, materials, creatures) and maps on background threads.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Instant;

use ahash::AHashMap;
use anyhow::{Context, Result};
use pme_core::items::ItemDb;
use pme_core::map::Map;
use pme_core::materials::Materials;
use pme_io::creatures::CreatureType;
use pme_io::spr::SpriteFile;
use pme_io::{creatures, dat, materials_xml, otb, otbm, world_xml};

use crate::settings::Paths;

pub struct Assets {
    pub db: Arc<ItemDb>,
    pub mat: Arc<Materials>,
    pub spr: Arc<SpriteFile>,
    pub creatures: Vec<CreatureType>,
    /// (is_npc, lowercase name) -> index into `creatures`
    pub creature_index: AHashMap<(bool, String), usize>,
    pub warnings: Vec<String>,
}

impl Assets {
    /// Look a creature up by spawn name; falls back to the other kind (monster/NPC).
    pub fn creature(&self, name: &str, npc: bool) -> Option<&CreatureType> {
        let n = name.to_lowercase();
        self.creature_index.get(&(npc, n.clone())).or_else(|| self.creature_index.get(&(!npc, n))).map(|&i| &self.creatures[i])
    }
}

/// Shared progress for a background job: text + per-mille.
#[derive(Default)]
pub struct Progress {
    pub text: Mutex<String>,
    pub permille: AtomicU32,
}

impl Progress {
    pub fn set(&self, s: impl Into<String>) {
        *self.text.lock().unwrap() = s.into();
    }
}

pub fn load_assets(paths: &Paths, progress: &Progress) -> Result<Assets> {
    let t = Instant::now();
    if let Some(p) = paths.missing() {
        anyhow::bail!("{}: {}", crate::i18n::t("err-missing-file"), p.display());
    }
    let mut db = ItemDb::default();
    progress.set("items.otb");
    otb::load_otb(&paths.items_otb(), &mut db)?;
    progress.permille.store(100, Ordering::Relaxed);
    progress.set("items.xml");
    otb::load_items_xml(&paths.items_xml(), &mut db)?;
    progress.permille.store(250, Ordering::Relaxed);
    progress.set("Tibia.dat");
    let opts = dat::read_otfi(&paths.otfi()).unwrap_or_default();
    dat::load_dat(&paths.dat(), &opts, &mut db)?;
    progress.permille.store(450, Ordering::Relaxed);
    progress.set("Tibia.spr");
    // OTFI `transparency` decides whether pixels carry alpha.
    let alpha = std::fs::read_to_string(paths.otfi()).map(|s| s.contains("transparency: true")).unwrap_or(true);
    let spr = SpriteFile::open(&paths.spr(), opts.extended, alpha)?;
    progress.permille.store(500, Ordering::Relaxed);
    progress.set("materials.xml");
    let ext = if paths.extensions_dir.is_dir() { vec![paths.extensions_dir.clone()] } else { vec![] };
    let mat = materials_xml::load(&paths.materials_xml, &ext, &db)?;
    progress.permille.store(800, Ordering::Relaxed);
    progress.set("monsters / npcs");
    let mut warnings = mat.warnings.clone();
    let creatures = creatures::load(&paths.server_data, &mut warnings);
    let creature_index = creatures.iter().enumerate().map(|(i, c)| ((c.is_npc, c.name.to_lowercase()), i)).collect();
    progress.permille.store(1000, Ordering::Relaxed);
    log::info!("assets loaded in {:?}", t.elapsed());
    Ok(Assets { db: Arc::new(db), mat: Arc::new(mat), spr: Arc::new(spr), creatures, creature_index, warnings })
}

pub struct LoadedMap {
    pub map: Map,
    pub path: PathBuf,
    pub warnings: Vec<String>,
    pub seconds: f32,
}

pub fn load_map(path: &Path, db: &ItemDb, progress: &Progress) -> Result<LoadedMap> {
    let t = Instant::now();
    progress.set(path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default());
    let pm = AtomicU32::new(0);
    let mut warnings = Vec::new();
    let map = std::thread::scope(|s| -> Result<Map> {
        let h = s.spawn(|| otbm::load(path, db, Some(&pm)));
        while !h.is_finished() {
            progress.permille.store(pm.load(Ordering::Relaxed) * 9 / 10, Ordering::Relaxed);
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
        h.join().unwrap()
    })
    .with_context(|| format!("{}", path.display()))?;
    let mut map = map;
    let dir = path.parent().unwrap_or(Path::new("."));
    if !map.house_file.is_empty() {
        let p = dir.join(&map.house_file);
        if p.is_file() {
            if let Err(e) = world_xml::load_houses(&p, &mut map) {
                warnings.push(format!("{}: {e:#}", p.display()));
            }
        }
    }
    if !map.spawn_file.is_empty() {
        let p = dir.join(&map.spawn_file);
        if p.is_file() {
            progress.set(map.spawn_file.clone());
            if let Err(e) = world_xml::load_spawns(&p, &mut map) {
                warnings.push(format!("{}: {e:#}", p.display()));
            }
        }
    }
    map.revision = 0;
    progress.permille.store(1000, Ordering::Relaxed);
    Ok(LoadedMap { map, path: path.to_path_buf(), warnings, seconds: t.elapsed().as_secs_f32() })
}

/// Save map + spawns + houses next to it. Returns warnings (e.g. creatures outside spawns).
pub fn save_map(path: &Path, map: &mut Map, db: &ItemDb) -> Result<Vec<String>> {
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "map".into());
    if map.spawn_file.is_empty() {
        map.spawn_file = format!("{stem}-spawn.xml");
    }
    if map.house_file.is_empty() {
        map.house_file = format!("{stem}-house.xml");
    }
    let dir = path.parent().unwrap_or(Path::new("."));
    otbm::save(path, map, db)?;
    let mut warnings = Vec::new();
    let (spawns, orphans) = world_xml::spawns_xml(map);
    if orphans > 0 {
        warnings.push(crate::i18n::tf("warn-orphan-creatures", &[&orphans]));
    }
    pme_io::write_atomic(&dir.join(&map.spawn_file), spawns.as_bytes())?;
    pme_io::write_atomic(&dir.join(&map.house_file), world_xml::houses_xml(map).as_bytes())?;
    Ok(warnings)
}

pub enum Job {
    Assets(JoinHandle<Result<Assets>>, Arc<Progress>),
    Map(JoinHandle<Result<LoadedMap>>, Arc<Progress>),
    /// Materials only (after creating/editing brushes).
    Materials(JoinHandle<Result<Materials>>, Arc<Progress>),
}

/// Reload just the materials (brushes) with an already loaded item database.
pub fn load_materials(paths: &Paths, db: &ItemDb, progress: &Progress) -> Result<Materials> {
    progress.set("materials.xml");
    let ext = if paths.extensions_dir.is_dir() { vec![paths.extensions_dir.clone()] } else { vec![] };
    let m = materials_xml::load(&paths.materials_xml, &ext, db)?;
    progress.permille.store(1000, Ordering::Relaxed);
    Ok(m)
}

impl Job {
    pub fn progress(&self) -> &Progress {
        match self {
            Job::Assets(_, p) | Job::Map(_, p) | Job::Materials(_, p) => p,
        }
    }

    pub fn is_finished(&self) -> bool {
        match self {
            Job::Assets(h, _) => h.is_finished(),
            Job::Map(h, _) => h.is_finished(),
            Job::Materials(h, _) => h.is_finished(),
        }
    }
}
