//! Application state, background jobs, menus, shortcuts and dialogs.
//! The map canvas lives in `canvas.rs`, the left palette in `palette.rs` and the right
//! panel (minimap + tile properties) in `inspector.rs`.

use std::path::PathBuf;
use std::sync::Arc;

use eframe::egui::{self, Color32, Key, KeyboardShortcut, Modifiers, RichText};
use pme_core::brushes::{doodad::DoodadBuffer, Brush, BrushShape};
use pme_core::editor::Editor;
use pme_core::map::{Map, Town};
use pme_core::position::Position;
use pme_core::tile::Tile;

use crate::assets::{self, Assets, Job, Progress};
use crate::atlas::Atlas;
use crate::i18n::{self, t, tf, Lang};
use crate::minimap::Minimap;
use crate::brush_edit_std::StdBrushEdit;
use crate::brush_editor::BrushEditor;
use crate::palette::PaletteState;
use crate::properties::PropWindow;
use crate::replace::ReplaceState;
use crate::settings::Settings;
use crate::view::{Camera, MapCache};

pub struct Toast {
    pub text: String,
    pub until: f64,
    pub error: bool,
}

/// Pointer gesture in progress on the canvas.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Gesture {
    None,
    /// Brush stroke (erase = right button).
    Paint { erase: bool, last: (i32, i32) },
    /// Shift + drag with a brush: fill a rectangle on release.
    RectFill { erase: bool, start: (i32, i32) },
    BoxSelect { start: (i32, i32) },
    MoveSelection { start: (i32, i32) },
    /// Ctrl + left drag: clear every tile passed over (one undo step).
    Clear { last: (i32, i32) },
}

#[derive(Clone, Copy, PartialEq)]
pub enum Pending {
    New,
    Open,
    Quit,
}

#[derive(Default)]
pub struct FindState {
    pub query: String,
    pub results: Vec<(Position, u16)>,
    pub searched: bool,
}

#[derive(Default)]
pub struct Dialogs {
    pub goto: Option<[String; 3]>,
    pub find: Option<FindState>,
    pub settings: bool,
    pub about: bool,
    pub shortcuts: bool,
    pub map_props: bool,
    pub stats: Option<String>,
    pub confirm: Option<Pending>,
    pub warnings: Vec<String>,
    pub show_warnings: bool,
}

pub struct App {
    pub settings: Settings,
    pub assets: Option<Assets>,
    pub atlas: Option<Atlas>,
    pub editor: Option<Editor>,
    pub map_path: Option<PathBuf>,
    pub cam: Camera,
    pub canvas_rect: egui::Rect,
    pub cache: Option<MapCache>,
    pub sel_rev: u64,
    pub job: Option<Job>,
    pub open_after_load: Option<PathBuf>,
    pub load_error: Option<String>,

    pub brush: Option<Brush>,
    /// Brush radius (0 = 1 tile).
    pub brush_size: i32,
    pub brush_shape: BrushShape,
    pub doodad_buffer: Option<DoodadBuffer>,
    pub gesture: Gesture,
    pub paste_mode: bool,
    pub hover: Option<Position>,
    pub inspect: Option<Position>,
    pub inspect_edit: Option<(Position, Tile)>,
    pub inspect_item: Option<usize>,
    pub current_house: u32,

    pub palette: PaletteState,
    pub minimap: Minimap,
    pub dialogs: Dialogs,
    pub toasts: Vec<Toast>,
    pub last_build_ms: f32,
    pub last_quads: usize,
    pub allow_close: bool,
    pub last_modifiers: egui::Modifiers,

    pub prop_windows: Vec<PropWindow>,
    pub next_prop_id: u64,
    /// Properties window waiting for a teleport destination click.
    pub picking_dest: Option<u64>,
    pub replace: Option<ReplaceState>,
    pub brush_editor: Option<BrushEditor>,
    /// After a materials reload: (brush to select, name of the previously selected brush).
    pub reload_select: (Option<String>, Option<String>),
    /// Tile under the cursor when the context menu was opened.
    pub context_pos: Option<Position>,
    /// "Remove from server" confirmation: (spawn name, is_npc, tiles using it in the map).
    pub remove_creature: Option<(String, bool, usize)>,
    /// In-place editor of an existing brush.
    pub std_brush_edit: Option<StdBrushEdit>,
    /// "Browse field" window (objects of one tile).
    pub browse: Option<crate::browse::BrowseField>,
    /// Previewed operation waiting for Apply / Cancel.
    pub pending: Option<crate::pending::PendingOp>,
    /// "Distribuir objetos" window.
    pub scatter: Option<crate::scatter_ui::ScatterUi>,
    /// Start screen (new / open / recent maps) visible.
    pub welcome: bool,
    /// Cached number of floors in the selection: (sel_rev it was computed for, count).
    pub sel_floors: (u64, u32),
}

impl App {
    pub fn new(cc: &eframe::CreationContext, open: Option<PathBuf>) -> Self {
        let settings = Settings::load();
        i18n::set_lang(settings.lang);
        setup_style(&cc.egui_ctx);
        let open = open.or_else(|| if settings.open_last_map { settings.recent.first().cloned() } else { None });
        let welcome = open.is_none() && settings.show_welcome;
        let mut app = Self {
            settings,
            assets: None,
            atlas: None,
            editor: None,
            map_path: None,
            cam: Camera::default(),
            canvas_rect: egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(800.0, 600.0)),
            cache: None,
            sel_rev: 0,
            job: None,
            open_after_load: open,
            load_error: None,
            brush: None,
            brush_size: 0,
            brush_shape: BrushShape::Square,
            doodad_buffer: None,
            gesture: Gesture::None,
            paste_mode: false,
            hover: None,
            inspect: None,
            inspect_edit: None,
            inspect_item: None,
            current_house: 0,
            palette: PaletteState::default(),
            minimap: Minimap::default(),
            dialogs: Dialogs::default(),
            toasts: Vec::new(),
            last_build_ms: 0.0,
            last_quads: 0,
            allow_close: false,
            last_modifiers: egui::Modifiers::NONE,
            prop_windows: Vec::new(),
            next_prop_id: 0,
            picking_dest: None,
            replace: None,
            brush_editor: None,
            reload_select: (None, None),
            context_pos: None,
            remove_creature: None,
            std_brush_edit: None,
            browse: None,
            pending: None,
            scatter: None,
            welcome,
            sel_floors: (u64::MAX, 0),
        };
        if app.settings.paths.missing().is_none() {
            app.start_asset_load();
        } else {
            app.dialogs.settings = true;
        }
        app
    }

    pub fn toast(&mut self, ctx: &egui::Context, text: impl Into<String>, error: bool) {
        let now = ctx.input(|i| i.time);
        self.toasts.push(Toast { text: text.into(), until: now + if error { 8.0 } else { 3.5 }, error });
    }

    // ------------------------------------------------------------------ jobs

    pub fn start_asset_load(&mut self) {
        let paths = self.settings.paths.clone();
        let p = Arc::new(Progress::default());
        let p2 = p.clone();
        self.load_error = None;
        let h = std::thread::spawn(move || assets::load_assets(&paths, &p2));
        self.job = Some(Job::Assets(h, p));
    }

    pub fn start_map_load(&mut self, path: PathBuf) {
        let Some(a) = &self.assets else {
            self.open_after_load = Some(path);
            return;
        };
        let db = a.db.clone();
        let p = Arc::new(Progress::default());
        let p2 = p.clone();
        let h = std::thread::spawn(move || assets::load_map(&path, &db, &p2));
        self.job = Some(Job::Map(h, p));
    }

    fn poll_job(&mut self, ctx: &egui::Context) {
        if !self.job.as_ref().is_some_and(Job::is_finished) {
            return;
        }
        match self.job.take().unwrap() {
            Job::Assets(h, _) => match h.join().unwrap() {
                Ok(a) => {
                    let n = a.warnings.len();
                    self.dialogs.warnings = a.warnings.clone();
                    self.atlas = Some(Atlas::new(a.spr.clone(), self.settings.view.hd_sprites));
                    let (db, mat) = (a.db.clone(), a.mat.clone());
                    self.assets = Some(a);
                    self.palette.invalidate();
                    self.cache = None;
                    if let Some(ed) = &mut self.editor {
                        ed.db = db;
                        ed.mat = mat;
                    } else {
                        self.new_map();
                    }
                    self.toast(ctx, tf("toast-assets-loaded", &[&n]), false);
                    if let Some(p) = self.open_after_load.take() {
                        self.start_map_load(p);
                    }
                }
                Err(e) => {
                    self.load_error = Some(format!("{e:#}"));
                    self.dialogs.settings = true;
                }
            },
            Job::Materials(h, _) => match h.join().unwrap() {
                Ok(m) => {
                    let mat = Arc::new(m);
                    if let Some(a) = &mut self.assets {
                        a.mat = mat.clone();
                    }
                    if let Some(ed) = &mut self.editor {
                        ed.mat = mat.clone();
                    }
                    self.palette.invalidate();
                    self.cache = None;
                    // Brush ids may have shifted: re-resolve by name.
                    let (select, previous) = std::mem::take(&mut self.reload_select);
                    if let Some(id) = select.or(previous).and_then(|n| mat.brush_by_name(&n)) {
                        self.set_brush(Some(Brush::Material(id)));
                    } else if matches!(self.brush, Some(Brush::Material(_))) {
                        self.set_brush(None);
                    }
                    self.toast(ctx, t("toast-materials-reloaded"), false);
                }
                Err(e) => self.toast(ctx, format!("materials: {e:#}"), true),
            },
            Job::Map(h, _) => match h.join().unwrap() {
                Ok(lm) => {
                    let a = self.assets.as_ref().unwrap();
                    let mut ed = Editor::new(lm.map, a.db.clone(), a.mat.clone());
                    self.apply_editor_options(&mut ed);
                    // Start at the first town temple, or the first house, or the map centre.
                    let start = ed.map.towns.first().map(|t| t.temple).or_else(|| ed.map.houses.first().map(|h| h.entry));
                    let tiles = ed.map.tile_count();
                    self.editor = Some(ed);
                    self.settings.push_recent(&lm.path);
                    self.settings.save();
                    self.map_path = Some(lm.path);
                    self.after_map_change();
                    if let Some(p) = start {
                        self.cam.center_on(self.canvas_rect, p);
                    }
                    if !lm.warnings.is_empty() {
                        self.dialogs.warnings.extend(lm.warnings);
                        self.dialogs.show_warnings = true;
                    }
                    self.toast(ctx, tf("toast-map-loaded", &[&tiles, &format!("{:.2}", lm.seconds)]), false);
                }
                Err(e) => self.toast(ctx, format!("{}: {e:#}", t("err-open-map")), true),
            },
        }
    }

    /// Reload materials in the background (after the brush editor saved). `select` = brush
    /// name to select afterwards.
    pub fn reload_materials(&mut self, select: Option<String>) {
        let Some(a) = &self.assets else { return };
        let previous = match &self.brush {
            Some(Brush::Material(id)) => a.mat.brush(*id).map(|b| b.name.clone()),
            _ => None,
        };
        self.reload_select = (select, previous);
        let (db, paths) = (a.db.clone(), self.settings.paths.clone());
        let p = Arc::new(Progress::default());
        let p2 = p.clone();
        let h = std::thread::spawn(move || assets::load_materials(&paths, &db, &p2));
        self.job = Some(Job::Materials(h, p));
    }

    /// Current animation frame (speed set in Settings, `anim_ms` per frame).
    pub fn anim_frame(&self, ctx: &egui::Context) -> u32 {
        anim_frame_for(&self.settings, ctx)
    }

    pub fn apply_editor_options(&self, ed: &mut Editor) {
        ed.opts.auto_border = self.settings.auto_border;
        ed.opts.eraser_leave_unique = self.settings.eraser_leave_unique;
        ed.opts.house_brush_remove_items = self.settings.house_brush_remove_items;
        ed.opts.default_spawn_time = self.settings.default_spawn_time;
        ed.opts.default_direction = self.settings.default_direction;
        ed.history.max_batches = self.settings.undo_limit.max(10);
    }

    fn after_map_change(&mut self) {
        self.cache = None;
        self.inspect = None;
        self.inspect_edit = None;
        self.paste_mode = false;
        self.gesture = Gesture::None;
        self.sel_rev += 1;
        self.palette.invalidate();
    }

    // ------------------------------------------------------------------ file actions

    pub fn is_dirty(&self) -> bool {
        self.editor.as_ref().is_some_and(Editor::is_dirty)
    }

    pub fn new_map(&mut self) {
        let Some(a) = &self.assets else { return };
        let mut map = Map::new();
        map.otb_major = a.db.otb_major;
        map.otb_minor = a.db.otb_minor;
        let mut ed = Editor::new(map, a.db.clone(), a.mat.clone());
        self.apply_editor_options(&mut ed);
        self.editor = Some(ed);
        self.map_path = None;
        self.after_map_change();
        self.cam = Camera::default();
        self.cam.center_on(self.canvas_rect, Position::new(1000, 1000, 7));
    }

    /// Pick a map file and start loading it. Returns false when the dialog was cancelled.
    pub fn open_dialog(&mut self) -> bool {
        let mut d = rfd::FileDialog::new().add_filter("OpenTibia map (*.otbm)", &["otbm"]);
        if let Some(dir) = self.map_path.as_ref().and_then(|p| p.parent()) {
            d = d.set_directory(dir);
        } else {
            d = d.set_directory(self.settings.paths.server_data.join("world"));
        }
        match d.pick_file() {
            Some(p) => {
                self.start_map_load(p);
                true
            }
            None => false,
        }
    }

    pub fn save(&mut self, ctx: &egui::Context, save_as: bool) {
        let path = match (&self.map_path, save_as) {
            (Some(p), false) => p.clone(),
            _ => {
                let mut d = rfd::FileDialog::new().add_filter("OpenTibia map (*.otbm)", &["otbm"]).set_file_name("map.otbm");
                if let Some(dir) = self.map_path.as_ref().and_then(|p| p.parent()) {
                    d = d.set_directory(dir);
                }
                match d.save_file() {
                    Some(p) => {
                        // A new file name gets its own spawn/house files.
                        if let Some(ed) = &mut self.editor {
                            ed.map.spawn_file.clear();
                            ed.map.house_file.clear();
                        }
                        p
                    }
                    None => return,
                }
            }
        };
        let Some(ed) = &mut self.editor else { return };
        let t0 = std::time::Instant::now();
        match assets::save_map(&path, &mut ed.map, &ed.db) {
            Ok(warns) => {
                ed.mark_saved();
                self.settings.push_recent(&path);
                self.settings.save();
                self.map_path = Some(path.clone());
                let name = path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
                self.toast(ctx, tf("toast-saved", &[&name, &format!("{:.2}", t0.elapsed().as_secs_f32())]), false);
                for w in warns {
                    self.toast(ctx, w, true);
                }
            }
            Err(e) => self.toast(ctx, format!("{}: {e:#}", t("err-save")), true),
        }
    }

    pub(crate) fn request(&mut self, ctx: &egui::Context, action: Pending) {
        if self.is_dirty() {
            self.dialogs.confirm = Some(action);
        } else {
            self.do_pending(ctx, action);
        }
    }

    fn do_pending(&mut self, ctx: &egui::Context, action: Pending) {
        match action {
            Pending::New => self.new_map(),
            Pending::Open => {
                self.open_dialog();
            }
            Pending::Quit => {
                self.allow_close = true;
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        }
    }

    // ------------------------------------------------------------------ edit actions

    pub fn set_brush(&mut self, b: Option<Brush>) {
        self.paste_mode = false;
        self.brush = b;
        self.regen_doodad();
    }

    pub fn regen_doodad(&mut self) {
        self.doodad_buffer = None;
        let (Some(Brush::Material(id)), Some(a)) = (&self.brush, &self.assets) else { return };
        if let Some(d) = pme_core::brushes::doodad::doodad(&a.mat, *id) {
            self.doodad_buffer = Some(pme_core::brushes::doodad::fill_buffer(d, self.palette.doodad_variation, self.brush_size, self.brush_shape == BrushShape::Circle));
        }
    }

    /// Number of variations (`<alternate>` blocks) of the current brush; 0 if it has none.
    pub fn variation_count(&self) -> usize {
        match (&self.brush, &self.assets) {
            (Some(Brush::Material(id)), Some(a)) => pme_core::brushes::doodad::doodad(&a.mat, *id).map_or(0, |d| d.alternatives.len()),
            _ => 0,
        }
    }

    /// Step to the previous (-1) / next (+1) variation of the current brush, wrapping around.
    pub fn cycle_variation(&mut self, ctx: &egui::Context, delta: i32) {
        let n = self.variation_count();
        if n <= 1 {
            return;
        }
        self.palette.doodad_variation = wrap_variation(self.palette.doodad_variation, delta, n);
        self.regen_doodad();
        let msg = tf("toast-variation", &[&(self.palette.doodad_variation + 1), &n]);
        self.toasts.retain(|t| !t.text.starts_with(&msg[..msg.find(' ').unwrap_or(0)]));
        self.toast(ctx, msg, false);
    }

    pub fn undo(&mut self) {
        if let Some(ed) = &mut self.editor {
            if ed.undo() {
                self.sel_rev += 1;
                self.inspect_edit = None;
            }
        }
    }

    pub fn redo(&mut self) {
        if let Some(ed) = &mut self.editor {
            if ed.redo() {
                self.sel_rev += 1;
                self.inspect_edit = None;
            }
        }
    }

    pub fn copy(&mut self, ctx: &egui::Context, cut: bool) {
        let Some(ed) = &mut self.editor else { return };
        let n = if cut { ed.cut() } else { ed.copy() };
        self.sel_rev += 1;
        if n > 0 {
            // The tiles stay in the editor's clipboard. A short text goes to the system clipboard
            // because egui only emits a Paste event (Ctrl+V) when the clipboard holds text.
            let floors: std::collections::BTreeSet<u8> = ed.clipboard.tiles.iter().map(|t| t.pos.z).collect();
            ctx.copy_text(format!("PeixolaMapEditor: {n} tiles, {}x{}, {} floor(s)", ed.clipboard.width, ed.clipboard.height, floors.len()));
            let msg = tf(if cut { "toast-cut" } else { "toast-copied" }, &[&n]);
            self.toast(ctx, msg, false);
        }
    }

    pub fn start_paste(&mut self) {
        if self.editor.as_ref().is_some_and(|e| !e.clipboard.is_empty()) {
            self.brush = None;
            self.paste_mode = true;
        }
    }

    pub fn delete_selection(&mut self) {
        if let Some(ed) = &mut self.editor {
            ed.delete_selection();
            self.sel_rev += 1;
        }
    }

    /// RME "Selection Mode": compensate checkbox + which floors a box selection takes.
    /// Returns true when something changed (used by the Edit menu and the settings dialog).
    pub fn selection_mode_ui(&mut self, ui: &mut egui::Ui) -> bool {
        use crate::settings::SelectionFloors as F;
        let s = &mut self.settings;
        let mut changed = ui.checkbox(&mut s.select_compensate, t("select-compensate")).on_hover_text(t("select-compensate-tip")).changed();
        ui.separator();
        for (v, key, tip) in [(F::Current, "select-current", "select-current-tip"), (F::Lower, "select-lower", "select-lower-tip"), (F::Visible, "select-visible", "select-visible-tip")] {
            changed |= ui.radio_value(&mut s.select_floors, v, t(key)).on_hover_text(t(tip)).changed();
        }
        changed
    }

    pub fn change_floor(&mut self, delta: i32) {
        let f = (self.cam.floor as i32 + delta).clamp(0, 15) as u8;
        if f != self.cam.floor {
            // Keep the same map position under the view centre (perspective offset).
            let o_old = self.cam.floor_offset(self.cam.floor);
            self.cam.floor = f;
            let o_new = self.cam.floor_offset(f);
            let d = (o_old - o_new) as f32 * crate::view::TILE;
            self.cam.x += d;
            self.cam.y += d;
        }
    }

    pub fn goto(&mut self, p: Position) {
        self.cam.center_on(self.canvas_rect, p);
    }

    // ------------------------------------------------------------------ shortcuts

    fn shortcuts(&mut self, ctx: &egui::Context) {
        let sc = |m: Modifiers, k: Key| KeyboardShortcut::new(m, k);
        let consume = |s: KeyboardShortcut| ctx.input_mut(|i| i.consume_shortcut(&s));
        if consume(sc(Modifiers::COMMAND, Key::S)) {
            self.save(ctx, false);
        }
        if consume(sc(Modifiers::COMMAND | Modifiers::SHIFT, Key::S)) {
            self.save(ctx, true);
        }
        if consume(sc(Modifiers::COMMAND, Key::O)) {
            self.request(ctx, Pending::Open);
        }
        if consume(sc(Modifiers::COMMAND, Key::N)) {
            self.request(ctx, Pending::New);
        }
        if ctx.wants_keyboard_input() {
            return;
        }
        if consume(sc(Modifiers::COMMAND, Key::Z)) {
            self.undo();
        }
        if consume(sc(Modifiers::COMMAND, Key::Y)) || consume(sc(Modifiers::COMMAND | Modifiers::SHIFT, Key::Z)) {
            self.redo();
        }
        // egui-winit turns Ctrl+C / Ctrl+X / Ctrl+V into Copy / Cut / Paste events (no Key event),
        // so read those; the key shortcuts stay as a fallback for other backends.
        let (mut copy, mut cut, mut paste) = (false, false, false);
        ctx.input_mut(|i| {
            i.events.retain(|e| match e {
                egui::Event::Copy => !std::mem::replace(&mut copy, true),
                egui::Event::Cut => !std::mem::replace(&mut cut, true),
                egui::Event::Paste(_) => !std::mem::replace(&mut paste, true),
                _ => true,
            })
        });
        copy |= consume(sc(Modifiers::COMMAND, Key::C));
        cut |= consume(sc(Modifiers::COMMAND, Key::X));
        paste |= consume(sc(Modifiers::COMMAND, Key::V));
        if copy {
            self.copy(ctx, false);
        }
        if cut {
            self.copy(ctx, true);
        }
        if paste {
            self.start_paste();
        }
        if consume(sc(Modifiers::COMMAND, Key::H)) {
            self.open_replace(None);
        }
        if consume(sc(Modifiers::COMMAND, Key::F)) {
            self.dialogs.find.get_or_insert_with(FindState::default);
        }
        if consume(sc(Modifiers::COMMAND, Key::G)) {
            let c = self.cam.center(self.canvas_rect);
            self.dialogs.goto = Some([c.x.to_string(), c.y.to_string(), c.z.to_string()]);
        }
        if consume(sc(Modifiers::NONE, Key::Delete)) {
            self.delete_selection();
        }
        if consume(sc(Modifiers::NONE, Key::Escape)) {
            if self.pending.is_some() {
                self.pending = None;
            } else if self.picking_dest.is_some() {
                self.picking_dest = None;
            } else if self.paste_mode || self.brush.is_some() {
                self.set_brush(None);
            } else if let Some(ed) = &mut self.editor {
                ed.selection.clear();
                self.sel_rev += 1;
            }
        }
        if consume(sc(Modifiers::NONE, Key::PageUp)) || consume(sc(Modifiers::NONE, Key::Plus)) {
            self.change_floor(-1);
        }
        if consume(sc(Modifiers::NONE, Key::PageDown)) || consume(sc(Modifiers::NONE, Key::Minus)) {
            self.change_floor(1);
        }
        if consume(sc(Modifiers::NONE, Key::OpenBracket)) {
            self.brush_size = (self.brush_size - 1).max(0);
            self.regen_doodad();
        }
        if consume(sc(Modifiers::NONE, Key::CloseBracket)) {
            self.brush_size = (self.brush_size + 1).min(15);
            self.regen_doodad();
        }
        if consume(sc(Modifiers::NONE, Key::Space)) {
            self.regen_doodad();
        }
        // Brush variations, like RME: Z = previous, X = next (Alt+Z / Alt+X also work).
        if consume(sc(Modifiers::NONE, Key::Z)) || consume(sc(Modifiers::ALT, Key::Z)) {
            self.cycle_variation(ctx, -1);
        }
        if consume(sc(Modifiers::NONE, Key::X)) || consume(sc(Modifiers::ALT, Key::X)) {
            self.cycle_variation(ctx, 1);
        }
        // Arrow keys pan.
        let step = ctx.input(|i| if i.modifiers.shift { 10.0 } else { 3.0 }) * crate::view::TILE;
        ctx.input(|i| {
            if i.key_pressed(Key::ArrowLeft) {
                self.cam.x -= step;
            }
            if i.key_pressed(Key::ArrowRight) {
                self.cam.x += step;
            }
            if i.key_pressed(Key::ArrowUp) {
                self.cam.y -= step;
            }
            if i.key_pressed(Key::ArrowDown) {
                self.cam.y += step;
            }
        });
    }

    // ------------------------------------------------------------------ menus

    fn menu_bar(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        egui::menu::bar(ui, |ui| {
            ui.menu_button(t("menu-file"), |ui| {
                if ui.add(egui::Button::new(t("menu-new")).shortcut_text("Ctrl+N")).clicked() {
                    ui.close_menu();
                    self.request(ctx, Pending::New);
                }
                if ui.add(egui::Button::new(t("menu-open")).shortcut_text("Ctrl+O")).clicked() {
                    ui.close_menu();
                    self.request(ctx, Pending::Open);
                }
                ui.menu_button(t("menu-recent"), |ui| {
                    let recent = self.settings.recent.clone();
                    if recent.is_empty() {
                        ui.label(RichText::new(t("menu-recent-empty")).weak());
                    }
                    for p in recent {
                        if ui.button(p.display().to_string()).clicked() {
                            ui.close_menu();
                            if !self.is_dirty() {
                                self.start_map_load(p);
                            } else {
                                self.toast(ctx, t("toast-save-first"), true);
                            }
                        }
                    }
                });
                if ui.button(t("menu-welcome")).clicked() {
                    ui.close_menu();
                    self.welcome = true;
                }
                ui.separator();
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("menu-save")).shortcut_text("Ctrl+S")).clicked() {
                    ui.close_menu();
                    self.save(ctx, false);
                }
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("menu-save-as")).shortcut_text("Ctrl+Shift+S")).clicked() {
                    ui.close_menu();
                    self.save(ctx, true);
                }
                ui.separator();
                if ui.button(t("menu-reload-data")).clicked() {
                    ui.close_menu();
                    self.start_asset_load();
                }
                ui.separator();
                if ui.button(t("menu-exit")).clicked() {
                    ui.close_menu();
                    self.request(ctx, Pending::Quit);
                }
            });
            ui.menu_button(t("menu-edit"), |ui| {
                let (can_undo, can_redo) = self.editor.as_ref().map_or((false, false), |e| (e.history.can_undo(), e.history.can_redo()));
                if ui.add_enabled(can_undo, egui::Button::new(t("menu-undo")).shortcut_text("Ctrl+Z")).clicked() {
                    self.undo();
                }
                if ui.add_enabled(can_redo, egui::Button::new(t("menu-redo")).shortcut_text("Ctrl+Y")).clicked() {
                    self.redo();
                }
                ui.separator();
                let has_sel = self.editor.as_ref().is_some_and(|e| !e.selection.is_empty());
                if ui.add_enabled(has_sel, egui::Button::new(t("menu-cut")).shortcut_text("Ctrl+X")).clicked() {
                    ui.close_menu();
                    self.copy(ctx, true);
                }
                if ui.add_enabled(has_sel, egui::Button::new(t("menu-copy")).shortcut_text("Ctrl+C")).clicked() {
                    ui.close_menu();
                    self.copy(ctx, false);
                }
                let has_clip = self.editor.as_ref().is_some_and(|e| !e.clipboard.is_empty());
                if ui.add_enabled(has_clip, egui::Button::new(t("menu-paste")).shortcut_text("Ctrl+V")).clicked() {
                    ui.close_menu();
                    self.start_paste();
                }
                if ui.add_enabled(has_sel, egui::Button::new(t("menu-delete")).shortcut_text("Del")).clicked() {
                    ui.close_menu();
                    self.delete_selection();
                }
                ui.separator();
                if ui.add(egui::Button::new(t("menu-select-mode")).shortcut_text("Esc")).clicked() {
                    ui.close_menu();
                    self.set_brush(None);
                }
                ui.menu_button(t("menu-selection-mode"), |ui| {
                    if self.selection_mode_ui(ui) {
                        self.settings.save();
                    }
                });
                ui.separator();
                let mut changed = ui.checkbox(&mut self.settings.auto_border, t("opt-auto-border")).changed();
                changed |= ui.checkbox(&mut self.settings.eraser_leave_unique, t("opt-eraser-unique")).changed();
                changed |= ui.checkbox(&mut self.settings.house_brush_remove_items, t("opt-house-remove-items")).changed();
                if changed {
                    self.sync_options();
                }
            });
            ui.menu_button(t("menu-view"), |ui| {
                let v = &mut self.settings.view;
                let mut c = false;
                c |= ui.checkbox(&mut v.show_all_floors, t("view-all-floors")).changed();
                c |= ui.checkbox(&mut v.show_shade, t("view-shade")).changed();
                c |= ui.checkbox(&mut v.show_zones, t("view-zones")).changed();
                c |= ui.checkbox(&mut v.show_houses, t("view-houses")).changed();
                c |= ui.checkbox(&mut v.show_spawns, t("view-spawns")).changed();
                c |= ui.checkbox(&mut v.show_creatures, t("view-creatures")).changed();
                c |= ui.checkbox(&mut v.show_waypoints, t("view-waypoints")).changed();
                c |= ui.checkbox(&mut v.show_grid, t("view-grid")).changed();
                c |= ui.checkbox(&mut v.show_blocking, t("view-blocking")).changed();
                c |= ui.checkbox(&mut v.highlight_items, t("view-highlight-items")).changed();
                ui.separator();
                c |= ui.checkbox(&mut v.show_animation, t("view-animation")).changed();
                c |= ui.checkbox(&mut v.show_lights, t("view-lights")).changed();
                c |= ui.checkbox(&mut v.hd_sprites, t("view-hd")).on_hover_text(t("view-hd-tip")).changed();
                c |= ui.checkbox(&mut v.show_tooltips, t("view-tooltips")).changed();
                c |= ui.checkbox(&mut v.show_tech_items, t("view-tech-items")).on_hover_text(t("view-tech-items-tip")).changed();
                ui.horizontal(|ui| {
                    ui.label(t("view-ambient"));
                    c |= ui.add(egui::Slider::new(&mut v.ambient_light, 0..=255)).on_hover_text(t("view-ambient-tip")).changed();
                });
                if c {
                    self.settings.save();
                }
                ui.separator();
                if ui.button(t("view-zoom-in")).clicked() {
                    let r = self.canvas_rect;
                    self.cam.zoom_at(r, r.center(), self.cam.zoom * 1.25);
                }
                if ui.button(t("view-zoom-out")).clicked() {
                    let r = self.canvas_rect;
                    self.cam.zoom_at(r, r.center(), self.cam.zoom / 1.25);
                }
                if ui.button(t("view-zoom-reset")).clicked() {
                    let r = self.canvas_rect;
                    self.cam.zoom_at(r, r.center(), 1.0);
                }
                ui.separator();
                if ui.add(egui::Button::new(t("view-floor-up")).shortcut_text("PgUp")).clicked() {
                    self.change_floor(-1);
                }
                if ui.add(egui::Button::new(t("view-floor-down")).shortcut_text("PgDn")).clicked() {
                    self.change_floor(1);
                }
            });
            ui.menu_button(t("menu-map"), |ui| {
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("menu-map-props"))).clicked() {
                    ui.close_menu();
                    self.dialogs.map_props = true;
                }
                if ui.add(egui::Button::new(t("menu-goto")).shortcut_text("Ctrl+G")).clicked() {
                    ui.close_menu();
                    let c = self.cam.center(self.canvas_rect);
                    self.dialogs.goto = Some([c.x.to_string(), c.y.to_string(), c.z.to_string()]);
                }
                if ui.add(egui::Button::new(t("menu-find-item")).shortcut_text("Ctrl+F")).clicked() {
                    ui.close_menu();
                    self.dialogs.find.get_or_insert_with(FindState::default);
                }
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("replace-title")).shortcut_text("Ctrl+H")).clicked() {
                    ui.close_menu();
                    self.open_replace(None);
                }
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("menu-stats"))).clicked() {
                    ui.close_menu();
                    self.dialogs.stats = Some(self.statistics());
                }
            });
            ui.menu_button(t("menu-tools"), |ui| {
                if ui.add_enabled(self.editor.is_some(), egui::Button::new(t("scatter-title"))).on_hover_text(t("scatter-help")).clicked() {
                    ui.close_menu();
                    self.open_scatter();
                }
                if ui.add_enabled(self.assets.is_some(), egui::Button::new(t("be-title"))).clicked() {
                    ui.close_menu();
                    self.open_brush_editor();
                }
                if ui.button(t("menu-settings")).clicked() {
                    ui.close_menu();
                    self.dialogs.settings = true;
                }
                if ui.add_enabled(!self.dialogs.warnings.is_empty(), egui::Button::new(t("menu-warnings"))).clicked() {
                    ui.close_menu();
                    self.dialogs.show_warnings = true;
                }
            });
            ui.menu_button(t("menu-language"), |ui| {
                for l in [Lang::Pt, Lang::En] {
                    if ui.radio(self.settings.lang == l, l.label()).clicked() {
                        self.settings.lang = l;
                        i18n::set_lang(l);
                        self.settings.save();
                        ui.close_menu();
                    }
                }
            });
            ui.menu_button(t("menu-help"), |ui| {
                if ui.button(t("menu-shortcuts")).clicked() {
                    ui.close_menu();
                    self.dialogs.shortcuts = true;
                }
                if ui.button(t("menu-about")).clicked() {
                    ui.close_menu();
                    self.dialogs.about = true;
                }
            });
        });
    }

    pub fn sync_options(&mut self) {
        let mut ed = self.editor.take();
        if let Some(e) = &mut ed {
            self.apply_editor_options(e);
        }
        self.editor = ed;
        self.settings.save();
    }

    fn toolbar(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            if ui.button("🗋").on_hover_text(t("menu-new")).clicked() {
                self.request(ctx, Pending::New);
            }
            if ui.button("🗁").on_hover_text(t("menu-open")).clicked() {
                self.request(ctx, Pending::Open);
            }
            if ui.add_enabled(self.editor.is_some(), egui::Button::new("💾")).on_hover_text(t("menu-save")).clicked() {
                self.save(ctx, false);
            }
            ui.separator();
            let (can_undo, can_redo) = self.editor.as_ref().map_or((false, false), |e| (e.history.can_undo(), e.history.can_redo()));
            if ui.add_enabled(can_undo, egui::Button::new("⟲")).on_hover_text(t("menu-undo")).clicked() {
                self.undo();
            }
            if ui.add_enabled(can_redo, egui::Button::new("⟳")).on_hover_text(t("menu-redo")).clicked() {
                self.redo();
            }
            ui.separator();
            let select = self.brush.is_none() && !self.paste_mode;
            if crate::icons::tool_button(ui, select, crate::icons::ToolIcon::Cursor, &t("tool-select")).on_hover_text(t("tool-select-tip")).clicked() {
                self.set_brush(None);
            }
            let eraser = self.brush == Some(Brush::Eraser);
            if crate::icons::tool_button(ui, eraser, crate::icons::ToolIcon::Eraser, &t("tool-eraser")).on_hover_text(t("tool-eraser-tip")).clicked() {
                self.set_brush(Some(Brush::Eraser));
            }
            ui.separator();
            ui.label(t("tool-floor"));
            if ui.small_button("⬆").on_hover_text(t("view-floor-up")).clicked() {
                self.change_floor(-1);
            }
            ui.label(RichText::new(format!("{:>2}", self.cam.floor)).monospace().strong());
            if ui.small_button("⬇").on_hover_text(t("view-floor-down")).clicked() {
                self.change_floor(1);
            }
            ui.separator();
            ui.label(t("tool-zoom"));
            let mut z = self.cam.zoom * 100.0;
            if ui.add(egui::DragValue::new(&mut z).range(12.5..=400.0).suffix("%").speed(2.0)).changed() {
                let r = self.canvas_rect;
                self.cam.zoom_at(r, r.center(), z / 100.0);
            }
            ui.separator();
            let v = &mut self.settings.view;
            let mut c = false;
            c |= ui.toggle_value(&mut v.show_zones, t("tool-zones")).on_hover_text(t("view-zones")).changed();
            c |= ui.toggle_value(&mut v.show_houses, t("tool-houses")).on_hover_text(t("view-houses")).changed();
            c |= ui.toggle_value(&mut v.show_spawns, t("tool-spawns")).on_hover_text(t("view-spawns")).changed();
            c |= ui.toggle_value(&mut v.show_grid, t("tool-grid")).on_hover_text(t("view-grid")).changed();
            c |= ui.toggle_value(&mut v.show_all_floors, t("tool-floors")).on_hover_text(t("view-all-floors")).changed();
            c |= ui.toggle_value(&mut v.show_animation, t("tool-animation")).on_hover_text(t("view-animation")).changed();
            c |= ui.toggle_value(&mut v.show_lights, t("tool-lights")).on_hover_text(t("view-lights")).changed();
            c |= ui.toggle_value(&mut v.hd_sprites, t("tool-hd")).on_hover_text(t("view-hd-tip")).changed();
            c |= ui.toggle_value(&mut v.show_tooltips, t("tool-tooltips")).on_hover_text(t("view-tooltips")).changed();
            if c {
                self.settings.save();
            }
            ui.separator();
            if ui.toggle_value(&mut self.settings.auto_border, t("tool-auto-border")).on_hover_text(t("opt-auto-border")).changed() {
                self.sync_options();
            }
        });
    }

    fn status_bar(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            if self.picking_dest.is_some() {
                ui.label(RichText::new(t("props-picking")).color(Color32::from_rgb(255, 210, 80)).strong());
                ui.separator();
            }
            if let Some(job) = &self.job {
                let p = job.progress();
                let pm = p.permille.load(std::sync::atomic::Ordering::Relaxed);
                ui.add(egui::ProgressBar::new(pm as f32 / 1000.0).desired_width(160.0).text(p.text.lock().unwrap().clone()));
                ui.separator();
            }
            if let Some(h) = self.hover {
                ui.label(RichText::new(format!("X {}  Y {}  Z {}", h.x, h.y, h.z)).monospace());
                if let (Some(ed), Some(a)) = (&self.editor, &self.assets) {
                    if let Some(tile) = ed.map.get(h) {
                        ui.separator();
                        let top = tile.items.last().or(tile.ground.as_ref());
                        if let Some(it) = top {
                            ui.label(format!("{} [{}]", a.db.name(it.id), it.id));
                        }
                        ui.label(RichText::new(tf("status-items", &[&tile.item_count()])).weak());
                        if tile.house_id != 0 {
                            let name = ed.map.house(tile.house_id).map(|h| h.name.as_str()).unwrap_or("?");
                            ui.label(RichText::new(format!("🏠 {name} (#{})", tile.house_id)).color(Color32::LIGHT_BLUE));
                        }
                        let zones = crate::palette::zone_names(tile.flags);
                        if !zones.is_empty() {
                            ui.label(RichText::new(zones).color(Color32::LIGHT_GREEN));
                        }
                    }
                }
            }
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if let Some(ed) = &self.editor {
                    let name = self.map_path.as_ref().and_then(|p| p.file_name()).map(|f| f.to_string_lossy().into_owned()).unwrap_or_else(|| t("untitled").to_owned());
                    let dirty = if ed.is_dirty() { " •" } else { "" };
                    ui.label(RichText::new(format!("{name}{dirty}")).strong());
                    ui.separator();
                    ui.label(RichText::new(tf("status-tiles", &[&ed.map.tile_count()])).weak());
                    if !ed.selection.is_empty() {
                        ui.separator();
                        // Floors in the selection, recomputed only when the selection changes.
                        if self.sel_floors.0 != self.sel_rev {
                            let mask = ed.selection.iter().fold(0u16, |m, p| m | 1 << (p.z & 15));
                            self.sel_floors = (self.sel_rev, mask.count_ones());
                        }
                        let floors = self.sel_floors.1;
                        if floors > 1 {
                            ui.label(tf("status-selected-floors", &[&ed.selection.len(), &floors]));
                        } else {
                            ui.label(tf("status-selected", &[&ed.selection.len()]));
                        }
                    }
                }
                ui.separator();
                let sprites = self.atlas.as_ref().map_or(0, Atlas::resident);
                ui.label(RichText::new(format!("{:.1} ms · {} quads · {} sprites", self.last_build_ms, self.last_quads, sprites)).weak().small())
                    .on_hover_text(t("status-perf-tip"));
            });
        });
    }

    fn statistics(&self) -> String {
        let Some(ed) = &self.editor else { return String::new() };
        let (mut items, mut creatures, mut spawns, mut house_tiles, mut pz) = (0usize, 0usize, 0usize, 0usize, 0usize);
        for (_, t) in ed.map.tiles() {
            items += t.item_count();
            creatures += t.creature.is_some() as usize;
            spawns += (t.spawn_radius > 0) as usize;
            house_tiles += (t.house_id != 0) as usize;
            pz += (t.flags & pme_core::tile::flags::PROTECTION_ZONE != 0) as usize;
        }
        tf(
            "stats-text",
            &[&ed.map.tile_count(), &items, &house_tiles, &pz, &spawns, &creatures, &ed.map.houses.len(), &ed.map.towns.len(), &ed.map.waypoints.len()],
        )
    }

    // ------------------------------------------------------------------ dialogs

    fn dialogs(&mut self, ctx: &egui::Context) {
        // Confirm discard
        if let Some(action) = self.dialogs.confirm {
            let mut close = false;
            egui::Modal::new(egui::Id::new("confirm")).show(ctx, |ui| {
                ui.heading(t("confirm-title"));
                ui.label(t("confirm-unsaved"));
                ui.add_space(8.0);
                ui.horizontal(|ui| {
                    if ui.button(t("confirm-save")).clicked() {
                        self.save(ctx, false);
                        if !self.is_dirty() {
                            self.do_pending(ctx, action);
                        }
                        close = true;
                    }
                    if ui.button(t("confirm-discard")).clicked() {
                        if let Some(ed) = &mut self.editor {
                            ed.mark_saved();
                        }
                        self.do_pending(ctx, action);
                        close = true;
                    }
                    if ui.button(t("cancel")).clicked() {
                        close = true;
                    }
                });
            });
            if close {
                self.dialogs.confirm = None;
            }
        }

        // Go to position
        if let Some(mut g) = self.dialogs.goto.take() {
            let mut open = true;
            let mut go = false;
            egui::Window::new(t("menu-goto")).collapsible(false).resizable(false).open(&mut open).show(ctx, |ui| {
                ui.horizontal(|ui| {
                    for (i, l) in ["X", "Y", "Z"].iter().enumerate() {
                        ui.label(*l);
                        let r = ui.add(egui::TextEdit::singleline(&mut g[i]).desired_width(60.0));
                        if i == 0 && !r.has_focus() && ui.memory(|m| m.focused().is_none()) {
                            r.request_focus();
                        }
                        if r.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)) {
                            go = true;
                        }
                    }
                });
                ui.label(RichText::new(t("goto-paste-hint")).weak().small());
                if ui.button(t("goto-go")).clicked() {
                    go = true;
                }
            });
            // Accept "x, y, z" pasted in the first field.
            if g[0].contains(',') {
                let parts: Vec<String> = g[0].split(',').map(|s| s.trim().to_owned()).collect();
                if parts.len() == 3 {
                    g = [parts[0].clone(), parts[1].clone(), parts[2].clone()];
                }
            }
            if go {
                if let (Ok(x), Ok(y), Ok(z)) = (g[0].trim().parse::<u16>(), g[1].trim().parse::<u16>(), g[2].trim().parse::<u8>()) {
                    self.goto(Position::new(x, y, z.min(15)));
                    self.inspect = Some(Position::new(x, y, z.min(15)));
                    open = false;
                }
            }
            if open {
                self.dialogs.goto = Some(g);
            }
        }

        self.find_dialog(ctx);
        self.settings_dialog(ctx);
        self.map_props_dialog(ctx);

        if let Some(s) = &self.dialogs.stats {
            let mut open = true;
            egui::Window::new(t("menu-stats")).collapsible(false).open(&mut open).show(ctx, |ui| {
                ui.label(RichText::new(s).monospace());
            });
            if !open {
                self.dialogs.stats = None;
            }
        }
        if self.dialogs.show_warnings {
            egui::Window::new(t("menu-warnings")).open(&mut self.dialogs.show_warnings).default_size([520.0, 320.0]).show(ctx, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    for w in &self.dialogs.warnings {
                        ui.label(RichText::new(w).small());
                    }
                });
            });
        }
        if self.dialogs.shortcuts {
            egui::Window::new(t("menu-shortcuts")).open(&mut self.dialogs.shortcuts).collapsible(false).show(ctx, |ui| {
                egui::Grid::new("shortcuts").striped(true).show(ui, |ui| {
                    for line in t("shortcuts-text").lines() {
                        if let Some((k, d)) = line.split_once('|') {
                            ui.label(RichText::new(k.trim()).monospace().strong());
                            ui.label(d.trim());
                            ui.end_row();
                        }
                    }
                });
            });
        }
        if self.dialogs.about {
            egui::Window::new(t("menu-about")).open(&mut self.dialogs.about).collapsible(false).resizable(false).show(ctx, |ui| {
                ui.heading("PeixolaMapEditor");
                ui.label(format!("v{}", env!("CARGO_PKG_VERSION")));
                ui.label(t("about-text"));
            });
        }
    }

    fn find_dialog(&mut self, ctx: &egui::Context) {
        let Some(mut f) = self.dialogs.find.take() else { return };
        let mut open = true;
        let mut goto = None;
        egui::Window::new(t("menu-find-item")).open(&mut open).default_size([380.0, 420.0]).show(ctx, |ui| {
            ui.horizontal(|ui| {
                let r = ui.add(egui::TextEdit::singleline(&mut f.query).hint_text(t("find-hint")).desired_width(220.0));
                let enter = r.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter));
                if (ui.button(t("find-search")).clicked() || enter) && !f.query.trim().is_empty() {
                    f.results = self.find_items(&f.query);
                    f.searched = true;
                }
            });
            if f.searched {
                ui.label(tf("find-results", &[&f.results.len()]));
            }
            ui.separator();
            let db = self.assets.as_ref().map(|a| a.db.clone());
            egui::ScrollArea::vertical().show_rows(ui, 18.0, f.results.len(), |ui, range| {
                for (p, id) in &f.results[range] {
                    let name = db.as_ref().map(|d| d.name(*id).to_owned()).unwrap_or_default();
                    if ui.selectable_label(false, format!("{p}   {name} [{id}]")).clicked() {
                        goto = Some(*p);
                    }
                }
            });
        });
        if let Some(p) = goto {
            self.goto(p);
            self.inspect = Some(p);
            self.inspect_edit = None;
        }
        if open {
            self.dialogs.find = Some(f);
        }
    }

    /// Search by numeric id, or by (part of) the item name. Also matches action/unique ids
    /// written as `aid:1234` / `uid:1234`.
    fn find_items(&self, q: &str) -> Vec<(Position, u16)> {
        let (Some(ed), Some(a)) = (&self.editor, &self.assets) else { return vec![] };
        let q = q.trim().to_lowercase();
        let (aid, uid) = (q.strip_prefix("aid:").and_then(|s| s.trim().parse::<u16>().ok()), q.strip_prefix("uid:").and_then(|s| s.trim().parse::<u16>().ok()));
        let ids: Option<ahash::AHashSet<u16>> = if aid.is_some() || uid.is_some() {
            None
        } else if let Ok(id) = q.parse::<u16>() {
            Some([id].into_iter().collect())
        } else {
            Some(a.db.items.iter().filter(|t| t.valid && t.name.to_lowercase().contains(&q)).map(|t| t.id).collect())
        };
        let mut out = Vec::new();
        let matches = |it: &pme_core::Item| match (&ids, aid, uid) {
            (Some(ids), _, _) => ids.contains(&it.id),
            (None, Some(a), _) => it.action_id() == a,
            (None, _, Some(u)) => it.unique_id() == u,
            _ => false,
        };
        fn walk(it: &pme_core::Item, f: &dyn Fn(&pme_core::Item) -> bool) -> Option<u16> {
            if f(it) {
                return Some(it.id);
            }
            it.children().iter().find_map(|c| walk(c, f))
        }
        for (p, tile) in ed.map.tiles() {
            if let Some(id) = tile.ground.iter().chain(tile.items.iter()).find_map(|i| walk(i, &matches)) {
                out.push((p, id));
                if out.len() >= 5000 {
                    break;
                }
            }
        }
        out.sort_unstable();
        out
    }

    fn settings_dialog(&mut self, ctx: &egui::Context) {
        if !self.dialogs.settings {
            return;
        }
        let mut open = true;
        let mut load = false;
        egui::Window::new(t("menu-settings")).open(&mut open).collapsible(false).resizable(true).default_width(760.0).min_width(480.0).show(ctx, |ui| {
            if let Some(e) = &self.load_error {
                ui.colored_label(Color32::LIGHT_RED, e);
                ui.separator();
            }
            ui.label(t("settings-paths-help"));
            ui.add_space(4.0);
            let p = &mut self.settings.paths;
            // One row per path: fixed-width label, input filling the remaining width (follows the
            // window size), browse button on the right.
            const LABEL_W: f32 = 170.0;
            for (label, path, folder) in [
                (t("settings-server-data"), &mut p.server_data, true),
                (t("settings-client-things"), &mut p.client_things, true),
                (t("settings-materials"), &mut p.materials_xml, false),
                (t("settings-extensions"), &mut p.extensions_dir, true),
            ] {
                ui.horizontal(|ui| {
                    ui.allocate_ui_with_layout(egui::vec2(LABEL_W, ui.spacing().interact_size.y), egui::Layout::left_to_right(egui::Align::Center), |ui| {
                        ui.set_min_width(LABEL_W);
                        ui.label(label);
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.button(t("browse")).clicked() {
                            let d = rfd::FileDialog::new().set_directory(if path.is_dir() { path.as_path() } else { path.parent().unwrap_or(path.as_path()) });
                            let picked = if folder { d.pick_folder() } else { d.add_filter("XML", &["xml"]).pick_file() };
                            if let Some(np) = picked {
                                *path = np;
                            }
                        }
                        let mut s = path.display().to_string();
                        let w = ui.available_width();
                        if ui.add(egui::TextEdit::singleline(&mut s).desired_width(w)).on_hover_text(&s).changed() {
                            *path = PathBuf::from(s);
                        }
                    });
                });
                ui.add_space(2.0);
            }
            if let Some(m) = self.settings.paths.missing() {
                ui.colored_label(Color32::from_rgb(255, 180, 80), format!("{}: {}", t("err-missing-file"), m.display()));
            }
            ui.separator();
            ui.horizontal(|ui| {
                ui.label(t("settings-undo-limit"));
                ui.add(egui::DragValue::new(&mut self.settings.undo_limit).range(10..=5000));
                ui.separator();
                ui.label(t("settings-spawn-time"));
                ui.add(egui::DragValue::new(&mut self.settings.default_spawn_time).range(1..=86400).suffix(" s"));
            });
            ui.checkbox(&mut self.settings.open_last_map, t("settings-open-last"));
            ui.horizontal(|ui| {
                ui.label(t("settings-selection-mode"));
                self.selection_mode_ui(ui);
            });
            ui.horizontal(|ui| {
                ui.label(t("settings-anim-speed"));
                ui.add(egui::Slider::new(&mut self.settings.anim_ms, 50..=500).suffix(" ms").step_by(10.0)).on_hover_text(t("settings-anim-speed-tip"));
            });
            ui.separator();
            ui.horizontal(|ui| {
                let busy = self.job.is_some();
                if ui.add_enabled(!busy, egui::Button::new(RichText::new(t("settings-load")).strong())).clicked() {
                    load = true;
                }
                if busy {
                    ui.spinner();
                }
            });
        });
        if load {
            self.settings.save();
            self.sync_options();
            self.start_asset_load();
        }
        if !open {
            self.settings.save();
            self.sync_options();
        }
        self.dialogs.settings = open && (self.assets.is_none() || !load);
    }

    fn map_props_dialog(&mut self, ctx: &egui::Context) {
        if !self.dialogs.map_props {
            return;
        }
        let Some(ed) = &mut self.editor else { return };
        let mut open = true;
        let mut towns = ed.map.towns.clone();
        let mut towns_changed = false;
        let mut goto = None;
        egui::Window::new(t("menu-map-props")).open(&mut open).default_width(520.0).show(ctx, |ui| {
            egui::Grid::new("mapprops").num_columns(2).show(ui, |ui| {
                ui.label(t("props-description"));
                let mut d = ed.map.descriptions.join("\n");
                if ui.add(egui::TextEdit::multiline(&mut d).desired_rows(2)).changed() {
                    ed.map.descriptions = d.lines().map(str::to_owned).collect();
                    ed.map.revision += 1;
                }
                ui.end_row();
                ui.label(t("props-size"));
                ui.horizontal(|ui| {
                    ui.add(egui::DragValue::new(&mut ed.map.width).range(256..=65535));
                    ui.label("x");
                    ui.add(egui::DragValue::new(&mut ed.map.height).range(256..=65535));
                });
                ui.end_row();
                ui.label(t("props-spawn-file"));
                ui.text_edit_singleline(&mut ed.map.spawn_file);
                ui.end_row();
                ui.label(t("props-house-file"));
                ui.text_edit_singleline(&mut ed.map.house_file);
                ui.end_row();
                ui.label(t("props-version"));
                ui.label(format!("OTBM v{} · OTB {}.{}", ed.map.otbm_version + 1, ed.map.otb_major, ed.map.otb_minor));
                ui.end_row();
            });
            ui.separator();
            ui.heading(t("props-towns"));
            egui::Grid::new("towns").striped(true).num_columns(5).show(ui, |ui| {
                ui.label("ID");
                ui.label(t("name"));
                ui.label(t("props-temple"));
                ui.label("");
                ui.label("");
                ui.end_row();
                let mut remove = None;
                for (i, town) in towns.iter_mut().enumerate() {
                    towns_changed |= ui.add(egui::DragValue::new(&mut town.id).range(1..=255)).changed();
                    towns_changed |= ui.add(egui::TextEdit::singleline(&mut town.name).desired_width(140.0)).changed();
                    ui.horizontal(|ui| {
                        towns_changed |= ui.add(egui::DragValue::new(&mut town.temple.x)).changed();
                        towns_changed |= ui.add(egui::DragValue::new(&mut town.temple.y)).changed();
                        towns_changed |= ui.add(egui::DragValue::new(&mut town.temple.z).range(0..=15)).changed();
                    });
                    if ui.small_button("➡").on_hover_text(t("goto-go")).clicked() {
                        goto = Some(town.temple);
                    }
                    if ui.small_button("🗑").on_hover_text(t("remove")).clicked() {
                        remove = Some(i);
                    }
                    ui.end_row();
                }
                if let Some(i) = remove {
                    towns.remove(i);
                    towns_changed = true;
                }
            });
            if ui.button(t("props-add-town")).clicked() {
                let id = towns.iter().map(|t| t.id).max().unwrap_or(0) + 1;
                let c = self.cam.center(self.canvas_rect);
                towns.push(Town { id, name: format!("Town {id}"), temple: c });
                towns_changed = true;
            }
        });
        if towns_changed {
            ed.begin("towns");
            ed.set_towns(towns);
            ed.end();
        }
        if let Some(p) = goto {
            self.goto(p);
        }
        self.dialogs.map_props = open;
    }

    fn toasts_ui(&mut self, ctx: &egui::Context) {
        let now = ctx.input(|i| i.time);
        self.toasts.retain(|t| t.until > now);
        if self.toasts.is_empty() {
            return;
        }
        egui::Area::new(egui::Id::new("toasts")).anchor(egui::Align2::RIGHT_BOTTOM, [-12.0, -36.0]).order(egui::Order::Foreground).show(ctx, |ui| {
            for t in &self.toasts {
                let (bg, fg) = if t.error { (Color32::from_rgb(90, 30, 30), Color32::from_rgb(255, 200, 200)) } else { (Color32::from_rgb(30, 60, 45), Color32::from_rgb(200, 255, 220)) };
                egui::Frame::new().fill(bg).corner_radius(6.0).inner_margin(8.0).show(ui, |ui| {
                    ui.set_max_width(420.0);
                    ui.label(RichText::new(&t.text).color(fg));
                });
                ui.add_space(4.0);
            }
        });
        ctx.request_repaint_after(std::time::Duration::from_millis(250));
    }

    fn loading_overlay(&mut self, ctx: &egui::Context) {
        let Some(job) = &self.job else { return };
        let p = job.progress();
        let pm = p.permille.load(std::sync::atomic::Ordering::Relaxed);
        let text = p.text.lock().unwrap().clone();
        let title = match job {
            Job::Assets(..) => t("loading-assets"),
            Job::Map(..) => t("loading-map"),
            Job::Materials(..) => t("loading-materials"),
        };
        egui::Modal::new(egui::Id::new("loading")).show(ctx, |ui| {
            ui.set_width(360.0);
            ui.heading(title);
            ui.add(egui::ProgressBar::new(pm as f32 / 1000.0).text(text).animate(true));
        });
        ctx.request_repaint_after(std::time::Duration::from_millis(50));
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.poll_job(ctx);
        // HD Mode toggled: rebuild the sprite atlas at the new resolution.
        if let (Some(a), Some(atlas)) = (&self.assets, &self.atlas) {
            if atlas.hd() != self.settings.view.hd_sprites {
                self.atlas = Some(Atlas::new(a.spr.clone(), self.settings.view.hd_sprites));
                self.cache = None;
            }
        }
        self.last_modifiers = ctx.input(|i| i.modifiers);
        if let Some(a) = &mut self.atlas {
            a.begin_frame();
        }

        // Window title
        let title = match (&self.map_path, &self.editor) {
            (Some(p), Some(ed)) => format!("PeixolaMapEditor — {}{}", p.display(), if ed.is_dirty() { " •" } else { "" }),
            _ => "PeixolaMapEditor".to_owned(),
        };
        ctx.send_viewport_cmd(egui::ViewportCommand::Title(title));

        // Close request with unsaved changes
        if ctx.input(|i| i.viewport().close_requested()) && !self.allow_close && self.is_dirty() {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            self.dialogs.confirm = Some(Pending::Quit);
        }

        self.shortcuts(ctx);

        egui::TopBottomPanel::top("menu").show(ctx, |ui| {
            self.menu_bar(ctx, ui);
        });
        egui::TopBottomPanel::top("toolbar").show(ctx, |ui| {
            ui.add_space(2.0);
            self.toolbar(ctx, ui);
            ui.add_space(2.0);
        });
        egui::TopBottomPanel::bottom("status").show(ctx, |ui| self.status_bar(ui));

        if self.assets.is_some() {
            egui::SidePanel::left("palette").resizable(true).default_width(310.0).min_width(240.0).show(ctx, |ui| self.palette_ui(ctx, ui));
            egui::SidePanel::right("inspector").resizable(true).default_width(280.0).min_width(220.0).show(ctx, |ui| self.inspector_ui(ctx, ui));
        }
        egui::CentralPanel::default().frame(egui::Frame::new().fill(Color32::from_rgb(10, 10, 14))).show(ctx, |ui| {
            if self.assets.is_some() && self.editor.is_some() {
                self.canvas_ui(ctx, ui);
            } else {
                ui.centered_and_justified(|ui| {
                    ui.label(RichText::new(t("welcome")).size(18.0).weak());
                });
            }
        });

        // Before the dialogs so Settings opened from it is drawn on top.
        self.welcome_window(ctx);
        self.dialogs(ctx);
        self.properties_windows(ctx);
        self.replace_window(ctx);
        self.brush_editor_window(ctx);
        self.std_brush_edit_window(ctx);
        self.browse_field_window(ctx);
        self.scatter_window(ctx);
        self.pending_bar(ctx);
        self.remove_creature_dialog(ctx);
        if self.settings.view.show_animation {
            ctx.request_repaint_after(std::time::Duration::from_millis(self.settings.anim_ms.clamp(50, 500) as u64));
        }
        self.toasts_ui(ctx);
        self.loading_overlay(ctx);
    }
}

/// `v + delta` wrapped into `0..n` (0 when there are no variations).
pub fn wrap_variation(v: usize, delta: i32, n: usize) -> usize {
    if n == 0 {
        return 0;
    }
    (v as i64 + delta as i64).rem_euclid(n as i64) as usize
}

#[cfg(test)]
mod tests {
    use super::wrap_variation;

    #[test]
    fn variation_wraps() {
        assert_eq!(wrap_variation(0, -1, 5), 4);
        assert_eq!(wrap_variation(4, 1, 5), 0);
        assert_eq!(wrap_variation(2, 1, 5), 3);
        assert_eq!(wrap_variation(7, 1, 0), 0);
    }
}

/// Animation frame for the given settings (0 when animations are off).
pub fn anim_frame_for(s: &Settings, ctx: &egui::Context) -> u32 {
    if !s.view.show_animation {
        return 0;
    }
    let ms = s.anim_ms.clamp(50, 500) as f64;
    (ctx.input(|i| i.time) * 1000.0 / ms) as u32
}

fn setup_style(ctx: &egui::Context) {
    ctx.set_visuals(egui::Visuals::dark());
    ctx.style_mut(|s| {
        s.spacing.item_spacing = egui::vec2(6.0, 5.0);
        s.spacing.button_padding = egui::vec2(7.0, 3.0);
        s.visuals.selection.bg_fill = Color32::from_rgb(40, 110, 170);
    });
}
