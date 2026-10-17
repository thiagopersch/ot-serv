//! Persistent settings (`%APPDATA%/PeixolaMapEditor/peixola.toml`).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::i18n::Lang;

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Paths {
    /// Server `data` folder (items/, monster/, npc/, world/).
    pub server_data: PathBuf,
    /// Folder with Tibia.dat / Tibia.spr / Tibia.otfi.
    pub client_things: PathBuf,
    /// materials.xml (borders, grounds, walls, doodads, tilesets) — the editor's own copy in
    /// `PeixolaMapEditor/data/materials` (RME-compatible format).
    pub materials_xml: PathBuf,
    /// Extra materials folder (`PeixolaMapEditor/data/materials/extensions`).
    pub extensions_dir: PathBuf,
}

impl Default for Paths {
    fn default() -> Self {
        detect_paths().unwrap_or(Self {
            server_data: PathBuf::new(),
            client_things: PathBuf::new(),
            materials_xml: PathBuf::new(),
            extensions_dir: PathBuf::new(),
        })
    }
}

impl Paths {
    pub fn items_otb(&self) -> PathBuf {
        self.server_data.join("items/items.otb")
    }
    pub fn items_xml(&self) -> PathBuf {
        self.server_data.join("items/items.xml")
    }
    pub fn dat(&self) -> PathBuf {
        self.client_things.join("Tibia.dat")
    }
    pub fn spr(&self) -> PathBuf {
        self.client_things.join("Tibia.spr")
    }
    pub fn otfi(&self) -> PathBuf {
        self.client_things.join("Tibia.otfi")
    }

    /// First missing required file, if any.
    pub fn missing(&self) -> Option<PathBuf> {
        [self.items_otb(), self.items_xml(), self.dat(), self.spr(), self.materials_xml.clone()].into_iter().find(|p| !p.is_file())
    }
}

fn search_starts() -> Vec<PathBuf> {
    let mut starts: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        starts.push(exe);
    }
    if let Ok(cwd) = std::env::current_dir() {
        starts.push(cwd);
    }
    starts
}

/// The editor's own materials folder (`<PeixolaMapEditor>/data/materials`), found next to the
/// executable (also when it runs from `target/release`) or from the working directory.
pub fn bundled_materials() -> Option<PathBuf> {
    for start in search_starts() {
        for dir in start.ancestors() {
            for root in [dir.to_path_buf(), dir.join("PeixolaMapEditor"), dir.join("server/PeixolaMapEditor")] {
                let m = root.join("data/materials");
                if m.join("materials.xml").is_file() {
                    return Some(clean(m));
                }
            }
        }
    }
    None
}

/// Look for the OTServer layout (`server/data`, `cliente/data/things/860`) around the
/// executable and the working directory. Materials always come from the editor's own folder.
fn detect_paths() -> Option<Paths> {
    let materials = bundled_materials();
    for start in search_starts() {
        for dir in start.ancestors() {
            for server in [dir.to_path_buf(), dir.join("server")] {
                if server.join("data/items/items.otb").is_file() {
                    let things = server.join("../cliente/data/things/860");
                    return Some(Paths {
                        server_data: clean(server.join("data")),
                        client_things: clean(things),
                        materials_xml: materials.as_ref().map(|m| m.join("materials.xml")).unwrap_or_default(),
                        extensions_dir: materials.as_ref().map(|m| m.join("extensions")).unwrap_or_default(),
                    });
                }
            }
        }
    }
    None
}

/// Point materials paths that still live in an RME folder to the editor's own copy.
/// Returns true when something changed.
pub fn migrate_paths(paths: &mut Paths, bundled: Option<&Path>) -> bool {
    let Some(b) = bundled else { return false };
    let in_rme = |p: &Path| p.components().any(|c| c.as_os_str().to_string_lossy().eq_ignore_ascii_case("RME"));
    let mut changed = false;
    if paths.materials_xml.as_os_str().is_empty() || in_rme(&paths.materials_xml) {
        paths.materials_xml = b.join("materials.xml");
        changed = true;
    }
    if paths.extensions_dir.as_os_str().is_empty() || in_rme(&paths.extensions_dir) {
        paths.extensions_dir = b.join("extensions");
        changed = true;
    }
    changed
}

fn clean(p: PathBuf) -> PathBuf {
    p.canonicalize().map(|c| PathBuf::from(c.to_string_lossy().trim_start_matches(r"\\?\"))).unwrap_or(p)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct View {
    pub show_all_floors: bool,
    pub show_shade: bool,
    pub show_zones: bool,
    pub show_houses: bool,
    pub show_spawns: bool,
    pub show_creatures: bool,
    pub show_grid: bool,
    pub show_waypoints: bool,
    pub show_blocking: bool,
    pub highlight_items: bool,
    pub show_animation: bool,
    pub show_lights: bool,
    /// RME-style balloons over items with text / teleport / aid / uid / door id.
    pub show_tooltips: bool,
    /// Invisible items (stairs / walkable floor / walls) drawn as coloured squares, like RME.
    pub show_tech_items: bool,
    /// HD Mode: sprites upscaled 32 -> 64 px with xBRZ, like the client's `hdSprites`.
    pub hd_sprites: bool,
    /// Ambient light 0 (night) ..= 255 (day) used by the light preview.
    pub ambient_light: u8,
}

impl Default for View {
    fn default() -> Self {
        Self {
            show_all_floors: true,
            show_shade: true,
            show_zones: true,
            show_houses: true,
            show_spawns: true,
            show_creatures: true,
            show_grid: false,
            show_waypoints: true,
            show_blocking: false,
            highlight_items: false,
            show_animation: true,
            show_lights: false,
            show_tooltips: true,
            show_tech_items: true,
            hd_sprites: false,
            ambient_light: 90,
        }
    }
}

/// Floors included by a box selection (RME "Selection Mode"), saved in the settings.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum SelectionFloors {
    #[default]
    Current,
    Lower,
    Visible,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub lang: Lang,
    pub paths: Paths,
    pub view: View,
    pub recent: Vec<PathBuf>,
    pub auto_border: bool,
    pub eraser_leave_unique: bool,
    pub house_brush_remove_items: bool,
    pub default_spawn_time: u32,
    /// Direction of newly placed creatures: 0 N, 1 E, 2 S, 3 W.
    pub default_direction: u8,
    pub undo_limit: usize,
    pub open_last_map: bool,
    /// Show the start screen (new / open / recent maps) when the editor starts.
    pub show_welcome: bool,
    /// Box selection: which floors are included (default: only the current one).
    pub select_floors: SelectionFloors,
    /// Box selection on several floors follows the perspective offset (RME "Compensate").
    pub select_compensate: bool,
    /// Sprite animation speed: milliseconds per frame (50..=500).
    pub anim_ms: u32,
    /// Creatures hidden from the palette ("npc:Name" / "monster:Name").
    pub hidden_creatures: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            lang: Lang::Pt,
            paths: Paths::default(),
            view: View::default(),
            recent: Vec::new(),
            auto_border: true,
            eraser_leave_unique: true,
            house_brush_remove_items: false,
            default_spawn_time: 60,
            default_direction: 2,
            undo_limit: 500,
            open_last_map: false,
            show_welcome: true,
            select_floors: SelectionFloors::Current,
            select_compensate: true,
            anim_ms: 100,
            hidden_creatures: Vec::new(),
        }
    }
}

fn settings_path() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    base.join("PeixolaMapEditor").join("peixola.toml")
}

impl Settings {
    pub fn load() -> Self {
        let p = settings_path();
        let mut s: Settings = std::fs::read_to_string(&p).ok().and_then(|s| toml::from_str(&s).ok()).unwrap_or_default();
        // Older configs pointed to the RME folder: move them to the editor's bundled materials.
        if migrate_paths(&mut s.paths, bundled_materials().as_deref()) {
            log::info!("materials paths migrated to the bundled copy: {}", s.paths.materials_xml.display());
            s.save();
        }
        s
    }

    pub fn save(&self) {
        let p = settings_path();
        if let Some(dir) = p.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(s) = toml::to_string_pretty(self) {
            let _ = std::fs::write(p, s);
        }
    }

    pub fn push_recent(&mut self, path: &Path) {
        self.recent.retain(|p| p != path);
        self.recent.insert(0, path.to_path_buf());
        self.recent.truncate(10);
    }

    /// Selection mode for `Editor::select_area_mode`.
    pub fn select_mode(&self) -> pme_core::editor::SelectMode {
        use pme_core::editor::SelectFloors as F;
        let floors = match self.select_floors {
            SelectionFloors::Current => F::Current,
            SelectionFloors::Lower => F::Lower,
            SelectionFloors::Visible => F::Visible,
        };
        pme_core::editor::SelectMode { floors, compensate: self.select_compensate }
    }

    pub fn remove_recent(&mut self, path: &Path) {
        self.recent.retain(|p| p != path);
    }

    /// Drop history entries whose file no longer exists. Returns how many were removed.
    pub fn prune_missing_recent(&mut self) -> usize {
        let before = self.recent.len();
        self.recent.retain(|p| p.is_file());
        before - self.recent.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rme_paths_migrate_to_bundled_copy() {
        let bundled = PathBuf::from(r"C:\x\PeixolaMapEditor\data\materials");
        let mut p = Paths {
            server_data: PathBuf::from(r"C:\x\server\data"),
            client_things: PathBuf::from(r"C:\x\cliente\data\things\860"),
            materials_xml: PathBuf::from(r"C:\x\server\RME\data\860\materials.xml"),
            extensions_dir: PathBuf::from(r"C:\x\server\RME\extensions"),
        };
        assert!(migrate_paths(&mut p, Some(&bundled)));
        assert_eq!(p.materials_xml, bundled.join("materials.xml"));
        assert_eq!(p.extensions_dir, bundled.join("extensions"));
        assert_eq!(p.server_data, PathBuf::from(r"C:\x\server\data"), "other paths untouched");
        assert!(!migrate_paths(&mut p, Some(&bundled)), "already migrated");
        // A custom non-RME path chosen by the user is respected.
        p.materials_xml = PathBuf::from(r"D:\meus\materials.xml");
        assert!(!migrate_paths(&mut p, Some(&bundled)));
        // Without a bundled copy nothing changes.
        p.materials_xml = PathBuf::from(r"C:\x\server\RME\data\860\materials.xml");
        assert!(!migrate_paths(&mut p, None));
    }

    #[test]
    fn recent_history_helpers() {
        let mut s = Settings { recent: Vec::new(), ..Settings::default() };
        for i in 0..12 {
            s.push_recent(Path::new(&format!("map{i}.otbm")));
        }
        assert_eq!(s.recent.len(), 10, "history keeps 10 entries");
        assert_eq!(s.recent[0], PathBuf::from("map11.otbm"), "newest first");
        s.push_recent(Path::new("map5.otbm"));
        assert_eq!(s.recent[0], PathBuf::from("map5.otbm"));
        assert_eq!(s.recent.iter().filter(|p| **p == PathBuf::from("map5.otbm")).count(), 1, "no duplicates");
        s.remove_recent(Path::new("map5.otbm"));
        assert!(!s.recent.contains(&PathBuf::from("map5.otbm")));

        // Only existing files survive pruning (the crate's Cargo.toml exists, the fake maps don't).
        let real = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(real.is_file());
        s.push_recent(&real);
        let n = s.recent.len();
        assert_eq!(s.prune_missing_recent(), n - 1);
        assert_eq!(s.recent, vec![real]);
    }
}
