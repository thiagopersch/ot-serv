//! The editing session: map + undo history + brush application, selection and clipboard.

use std::sync::Arc;

use ahash::{AHashMap, AHashSet};

use crate::brushes::{self, carpet_table, doodad, ground, wall, Brush, BrushShape};
use crate::history::{Change, History};
use crate::item::Item;
use crate::items::ItemDb;
use crate::map::{House, Map, Waypoint};
use crate::materials::{BrushId, BrushKind, Materials};
use crate::position::Position;
use crate::tile::{flags, Creature, PlacedTile, Tile};

#[derive(Clone, Debug)]
pub struct EditorOptions {
    pub auto_border: bool,
    pub eraser_leave_unique: bool,
    pub house_brush_remove_items: bool,
    pub auto_assign_door_id: bool,
    pub default_spawn_time: u32,
    /// Direction of newly placed creatures: 0 N, 1 E, 2 S, 3 W.
    pub default_direction: u8,
    pub auto_create_spawn_radius: u16,
}

impl Default for EditorOptions {
    fn default() -> Self {
        Self {
            auto_border: true,
            eraser_leave_unique: true,
            house_brush_remove_items: false,
            auto_assign_door_id: true,
            default_spawn_time: 60,
            default_direction: 2,
            auto_create_spawn_radius: 3,
        }
    }
}

/// Where [`Editor::replace_items`] works.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ReplaceScope {
    Map,
    Selection,
    Floor(u8),
    /// Rectangle on `min.z` (inclusive).
    Area { min: Position, max: Position },
}

/// Floors included by a box selection (RME "Selection Mode").
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SelectFloors {
    /// Only the floor being viewed.
    #[default]
    Current,
    /// The floor being viewed and every floor below it (down to 15).
    Lower,
    /// The floors visible from the current one (down to 7 above ground, +2 underground).
    Visible,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct SelectMode {
    pub floors: SelectFloors,
    /// Shift the box on lower floors to follow the perspective offset (RME "Compensate Selection").
    pub compensate: bool,
}

/// Clipboard contents: tiles relative to the copied area's top-left corner.
#[derive(Clone, Default)]
pub struct CopyBuffer {
    pub tiles: Vec<PlacedTile>,
    pub width: u16,
    pub height: u16,
}

impl CopyBuffer {
    pub fn is_empty(&self) -> bool {
        self.tiles.is_empty()
    }
}

pub struct Editor {
    pub map: Map,
    pub history: History,
    pub db: Arc<ItemDb>,
    pub mat: Arc<Materials>,
    pub opts: EditorOptions,
    pub selection: AHashSet<Position>,
    pub clipboard: CopyBuffer,
    /// Map revision at the last save.
    pub saved_revision: u64,
    /// When set, brush strokes are reproducible: each `draw` is seeded with this value mixed
    /// with the target position (same seed + same map = same result).
    pub brush_seed: Option<u64>,
}

impl Editor {
    pub fn new(map: Map, db: Arc<ItemDb>, mat: Arc<Materials>) -> Self {
        let rev = map.revision;
        Self {
            map,
            history: History::default(),
            db,
            mat,
            opts: EditorOptions::default(),
            selection: AHashSet::new(),
            clipboard: CopyBuffer::default(),
            saved_revision: rev,
            brush_seed: None,
        }
    }

    pub fn is_dirty(&self) -> bool {
        self.map.revision != self.saved_revision
    }

    pub fn mark_saved(&mut self) {
        self.saved_revision = self.map.revision;
    }

    fn tile_or_new(&self, pos: Position) -> Tile {
        self.map.get(pos).cloned().unwrap_or_default()
    }

    fn commit(&mut self, pos: Position, tile: Tile) {
        if self.map.get(pos) == Some(&tile) || (self.map.get(pos).is_none() && tile.is_empty()) {
            return;
        }
        self.history.set_tile(&mut self.map, pos, tile);
    }

    fn commit_all(&mut self, tiles: Vec<(Position, Tile)>) {
        for (p, t) in tiles {
            self.commit(p, t);
        }
    }

    pub fn begin(&mut self, label: &str) {
        self.history.begin(label);
    }

    pub fn end(&mut self) {
        self.history.end();
    }

    pub fn undo(&mut self) -> bool {
        self.history.undo(&mut self.map)
    }

    pub fn redo(&mut self) -> bool {
        self.history.redo(&mut self.map)
    }

    fn positions(&self, center: Position, size: i32, shape: BrushShape) -> Vec<Position> {
        brushes::area(center.x as i32, center.y as i32, size, shape)
            .into_iter()
            .filter_map(|(x, y)| Position::new(0, 0, center.z).offset(x, y, 0))
            .collect()
    }

    fn expand(positions: &[Position]) -> Vec<Position> {
        let mut set: AHashSet<Position> = AHashSet::with_capacity(positions.len() * 2);
        for p in positions {
            for dy in -1..=1 {
                for dx in -1..=1 {
                    if let Some(q) = p.offset(dx, dy, 0) {
                        set.insert(q);
                    }
                }
            }
        }
        let mut v: Vec<_> = set.into_iter().collect();
        v.sort_unstable();
        v
    }

    /// Apply `brush` at `center`. `erase` = right mouse button / undraw.
    /// `doodad_buffer` is the pre-generated doodad placement (see [`doodad::fill_buffer`]).
    pub fn draw(&mut self, brush: &Brush, center: Position, size: i32, shape: BrushShape, erase: bool, doodad_buffer: Option<&doodad::DoodadBuffer>) {
        match self.brush_seed {
            Some(seed) => crate::rng::with_seed(crate::rng::mix(seed, center.x, center.y, center.z), || self.draw_inner(brush, center, size, shape, erase, doodad_buffer)),
            None => self.draw_inner(brush, center, size, shape, erase, doodad_buffer),
        }
    }

    /// Apply a staged change set (preview → confirm) as **one** undo step.
    /// Returns the number of tiles actually changed.
    pub fn apply_staged(&mut self, changes: &crate::staged::StagedChanges, label: &str) -> usize {
        let mut n = 0;
        self.begin(label);
        for p in changes.sorted_positions() {
            let new = changes.tiles.get(&p).cloned().flatten();
            let before = self.map.get(p).cloned();
            if before == new {
                continue;
            }
            self.history.apply(&mut self.map, Change::Tile { pos: p, tile: new.map(Box::new) });
            n += 1;
        }
        self.end();
        n
    }

    fn draw_inner(&mut self, brush: &Brush, center: Position, size: i32, shape: BrushShape, erase: bool, doodad_buffer: Option<&doodad::DoodadBuffer>) {
        let mat = self.mat.clone();
        let db = self.db.clone();
        match brush {
            Brush::Raw(id) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::with_capacity(ps.len());
                for p in ps {
                    let mut t = self.tile_or_new(p);
                    if erase {
                        if t.ground.as_ref().is_some_and(|g| g.id == *id) {
                            t.ground = None;
                        }
                        t.items.retain(|i| i.id != *id);
                    } else {
                        let it = if db.get(*id).is_some_and(|t| t.is_stackable()) { Item::with_count(*id, 1) } else { Item::new(*id) };
                        t.add_item(&db, it);
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
            }
            Brush::Eraser => {
                let ps = self.positions(center, size, shape);
                let leave = self.opts.eraser_leave_unique;
                let mut out = Vec::new();
                for &p in &ps {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if erase {
                        t.items.retain(|i| leave && i.is_complex());
                        if !(leave && t.ground.as_ref().is_some_and(Item::is_complex)) {
                            t.ground = None;
                        }
                    } else {
                        t.items.retain(|i| leave && (i.is_complex() || mat.info(i.id).is_border));
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
                if self.opts.auto_border {
                    let mut out = Vec::new();
                    for p in Self::expand(&ps) {
                        let Some(mut t) = self.map.get(p).cloned() else { continue };
                        wall::do_walls(&self.map, &db, &mat, p, &mut t);
                        carpet_table::do_tables(&self.map, &mat, p, &mut t);
                        carpet_table::do_carpets(&self.map, &mat, p, &mut t);
                        ground::do_borders(&self.map, &mat, p, &mut t);
                        out.push((p, t));
                    }
                    self.commit_all(out);
                }
            }
            Brush::Zone(flag) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                for p in ps {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if t.ground.is_none() {
                        continue;
                    }
                    if erase {
                        t.flags &= !flag;
                    } else {
                        if flag & flags::EXCLUSIVE != 0 {
                            t.flags &= !flags::EXCLUSIVE;
                        }
                        t.flags |= flag;
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
            }
            Brush::House(house_id) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                let mut next_door = self.next_free_door_id(*house_id);
                for p in ps {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if t.ground.is_none() {
                        continue;
                    }
                    if erase {
                        if t.house_id == 0 {
                            continue;
                        }
                        t.house_id = 0;
                        t.flags &= !flags::PROTECTION_ZONE;
                        if self.opts.auto_assign_door_id {
                            for i in t.items.iter_mut().filter(|i| db.get(i.id).is_some_and(|ty| ty.is_door())) {
                                i.set_door_id(0);
                            }
                        }
                    } else {
                        let old = t.house_id;
                        t.house_id = *house_id;
                        t.flags = (t.flags & !flags::EXCLUSIVE) | flags::PROTECTION_ZONE;
                        if self.opts.house_brush_remove_items {
                            t.items.retain(|i| db.get(i.id).is_none_or(|ty| !ty.has(crate::items::otb_flags::MOVEABLE)));
                        }
                        if self.opts.auto_assign_door_id {
                            for i in t.items.iter_mut().filter(|i| db.get(i.id).is_some_and(|ty| ty.is_door())) {
                                if i.door_id() == 0 || old != 0 {
                                    i.set_door_id(next_door);
                                    next_door = next_door.saturating_add(1);
                                }
                            }
                        }
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
            }
            Brush::HouseExit(house_id) => {
                if erase || self.map.get(center).is_none_or(|t| t.ground.is_none()) {
                    return;
                }
                let mut houses = self.map.houses.clone();
                if let Some(h) = houses.iter_mut().find(|h| h.id == *house_id) {
                    h.entry = center;
                    self.history.apply(&mut self.map, Change::Houses(houses));
                }
            }
            Brush::Waypoint(name) => {
                let mut wps = self.map.waypoints.clone();
                if erase {
                    wps.retain(|w| w.pos != center);
                } else if let Some(w) = wps.iter_mut().find(|w| &w.name == name) {
                    w.pos = center;
                } else {
                    wps.push(Waypoint { name: name.clone(), pos: center });
                }
                if wps != self.map.waypoints {
                    self.history.apply(&mut self.map, Change::Waypoints(wps));
                }
            }
            Brush::Spawn => {
                let mut t = self.tile_or_new(center);
                if erase {
                    t.spawn_radius = 0;
                } else {
                    t.spawn_radius = size.max(1) as u16;
                }
                self.commit(center, t);
            }
            Brush::Creature { name, npc } => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                let mut new_spawn = None;
                for p in ps {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if erase {
                        if t.creature.take().is_none() {
                            continue;
                        }
                    } else {
                        if t.ground.is_none() || t.is_blocking(&db) {
                            continue;
                        }
                        t.creature = Some(Box::new(Creature { name: name.clone(), spawn_time: self.opts.default_spawn_time, direction: self.opts.default_direction.min(3), is_npc: *npc }));
                        if new_spawn.is_none() && self.spawn_covering(p).is_none() {
                            new_spawn = Some(p);
                        }
                    }
                    out.push((p, t));
                }
                if let Some(sp) = new_spawn {
                    // Auto-create a spawn around the first uncovered creature (like RME AUTO_CREATE_SPAWN).
                    let r = self.opts.auto_create_spawn_radius.max(size as u16).max(1);
                    if let Some((_, t)) = out.iter_mut().find(|(p, _)| *p == sp) {
                        t.spawn_radius = r;
                    }
                }
                self.commit_all(out);
            }
            Brush::Material(id) => self.draw_material(*id, center, size, shape, erase, doodad_buffer),
        }
    }

    fn draw_material(&mut self, id: BrushId, center: Position, size: i32, shape: BrushShape, erase: bool, doodad_buffer: Option<&doodad::DoodadBuffer>) {
        let mat = self.mat.clone();
        let db = self.db.clone();
        let Some(def) = mat.brush(id) else { return };
        let auto = self.opts.auto_border;
        match &def.kind {
            BrushKind::Unknown => {}
            BrushKind::Ground(_) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::with_capacity(ps.len());
                for &p in &ps {
                    let mut t = self.tile_or_new(p);
                    if auto {
                        ground::clean_borders(&mat, &mut t);
                    }
                    if erase {
                        ground::undraw(&mat, id, &mut t);
                    } else {
                        ground::draw(&mat, id, &mut t);
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
                if auto {
                    self.reborder(&Self::expand(&ps));
                }
            }
            BrushKind::Wall(_) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                for &p in &ps {
                    let mut t = self.tile_or_new(p);
                    if erase {
                        wall::undraw(&mat, id, &mut t);
                    } else {
                        wall::draw(&db, &mat, id, &mut t);
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
                if auto {
                    let mut out = Vec::new();
                    for p in Self::expand(&ps) {
                        let Some(mut t) = self.map.get(p).cloned() else { continue };
                        wall::do_walls(&self.map, &db, &mat, p, &mut t);
                        out.push((p, t));
                    }
                    self.commit_all(out);
                }
            }
            BrushKind::WallDecoration(_) => {
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                for p in ps {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if erase {
                        wall::undraw(&mat, id, &mut t);
                    } else {
                        wall::draw_decoration(&db, &mat, id, &mut t);
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
            }
            BrushKind::Carpet(_) | BrushKind::Table(_) => {
                let is_carpet = matches!(def.kind, BrushKind::Carpet(_));
                let ps = self.positions(center, size, shape);
                let mut out = Vec::new();
                for &p in &ps {
                    let mut t = self.tile_or_new(p);
                    match (is_carpet, erase) {
                        (true, false) => carpet_table::draw_carpet(&db, &mat, id, &mut t),
                        (true, true) => carpet_table::undraw_carpet(&mat, &mut t),
                        (false, false) => carpet_table::draw_table(&db, &mat, id, &mut t),
                        (false, true) => carpet_table::undraw_table(&mat, &mut t),
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
                let mut out = Vec::new();
                for p in Self::expand(&ps) {
                    let Some(mut t) = self.map.get(p).cloned() else { continue };
                    if is_carpet {
                        carpet_table::do_carpets(&self.map, &mat, p, &mut t);
                    } else {
                        carpet_table::do_tables(&self.map, &mat, p, &mut t);
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
            }
            BrushKind::Doodad(d) => {
                if erase {
                    let ps = self.positions(center, size, shape);
                    let mut out = Vec::new();
                    for p in ps {
                        let Some(mut t) = self.map.get(p).cloned() else { continue };
                        let leave = self.opts.eraser_leave_unique;
                        t.items.retain(|i| mat.info(i.id).doodad == 0 || (leave && i.is_complex()));
                        if t.ground.as_ref().is_some_and(|g| mat.info(g.id).doodad != 0) {
                            t.ground = None;
                        }
                        out.push((p, t));
                    }
                    self.commit_all(out);
                    return;
                }
                let generated;
                let buf = match doodad_buffer {
                    Some(b) => b,
                    None => {
                        generated = doodad::fill_buffer(d, 0, size, shape == BrushShape::Circle);
                        &generated
                    }
                };
                let mut out = Vec::new();
                let mut to_border = Vec::new();
                for (dx, dy, dz, items) in buf {
                    let Some(p) = center.offset(*dx, *dy, *dz) else { continue };
                    let existing = self.map.get(p);
                    let mut t = match existing {
                        Some(t) => {
                            if !d.on_blocking && t.is_blocking(&db) {
                                continue;
                            }
                            if !d.on_duplicate && doodad::owns_any(&mat, id, &t.items) {
                                continue;
                            }
                            t.clone()
                        }
                        None if d.on_blocking => Tile::new(),
                        None => continue,
                    };
                    // Remove walls that the doodad replaces.
                    for it in items {
                        let info = mat.info(it.id);
                        if info.is_wall {
                            wall::clean_walls(&mat, &mut t, Some(info.brush));
                        }
                    }
                    let has_ground = items.iter().any(|i| db.is_ground(i.id));
                    let has_wall = items.iter().any(|i| mat.info(i.id).is_wall);
                    if d.redo_borders && self.opts.auto_border {
                        to_border.push(p);
                        let n: &[(i32, i32)] = if has_ground {
                            &[(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
                        } else if has_wall {
                            &[(0, -1), (-1, 0), (1, 0), (0, 1)]
                        } else {
                            &[]
                        };
                        to_border.extend(n.iter().filter_map(|(x, y)| p.offset(*x, *y, 0)));
                    }
                    for it in items {
                        t.add_item(&db, it.clone());
                    }
                    out.push((p, t));
                }
                self.commit_all(out);
                if !to_border.is_empty() {
                    to_border.sort_unstable();
                    to_border.dedup();
                    let mut out = Vec::new();
                    for p in to_border {
                        let Some(mut t) = self.map.get(p).cloned() else { continue };
                        ground::do_borders(&self.map, &mat, p, &mut t);
                        wall::do_walls(&self.map, &db, &mat, p, &mut t);
                        out.push((p, t));
                    }
                    self.commit_all(out);
                }
            }
        }
    }

    /// Recompute ground borders on the given positions (creating tiles where a border appears).
    pub fn reborder(&mut self, ps: &[Position]) {
        let mat = self.mat.clone();
        let mut out = Vec::with_capacity(ps.len());
        for &p in ps {
            let mut t = self.tile_or_new(p);
            ground::do_borders(&self.map, &mat, p, &mut t);
            out.push((p, t));
        }
        self.commit_all(out);
    }

    /// Spawn whose area covers `p` (searching up to 30 tiles away).
    pub fn spawn_covering(&self, p: Position) -> Option<Position> {
        const MAX: i32 = 30;
        for dy in -MAX..=MAX {
            for dx in -MAX..=MAX {
                let Some(t) = self.map.get_xyz(p.x as i32 + dx, p.y as i32 + dy, p.z) else { continue };
                if t.spawn_radius as i32 >= dx.abs().max(dy.abs()) {
                    return Position::new(0, 0, p.z).offset(p.x as i32 + dx, p.y as i32 + dy, 0);
                }
            }
        }
        None
    }

    fn next_free_door_id(&self, house_id: u32) -> u8 {
        let mut max = 0u8;
        for (_, t) in self.map.tiles().filter(|(_, t)| t.house_id == house_id) {
            for i in &t.items {
                max = max.max(i.door_id());
            }
        }
        max.saturating_add(1)
    }

    // ---------------------------------------------------------------- selection / clipboard

    /// Select the tiles of the rectangle `a`..`b` on floor `a.z` only.
    pub fn select_area(&mut self, a: Position, b: Position, add: bool) {
        self.select_area_mode(a, b, add, SelectMode::default());
    }

    /// Box selection with RME's selection modes (port of `MapCanvas::OnMouseActionRelease`):
    /// the rectangle `a`..`b` is drawn on floor `a.z`; `mode` decides which floors are included
    /// and whether the box follows the floors' perspective offset ("compensate").
    pub fn select_area_mode(&mut self, a: Position, b: Position, add: bool, mode: SelectMode) {
        const GROUND_LAYER: i32 = 7;
        const MAX_LAYER: i32 = 15;
        if !add {
            self.selection.clear();
        }
        let floor = a.z as i32;
        let (mut x0, mut x1) = (a.x.min(b.x) as i32, a.x.max(b.x) as i32);
        let (mut y0, mut y1) = (a.y.min(b.y) as i32, a.y.max(b.y) as i32);
        let start_z = match mode.floors {
            SelectFloors::Current => floor,
            SelectFloors::Lower => MAX_LAYER,
            SelectFloors::Visible if floor <= GROUND_LAYER => GROUND_LAYER,
            SelectFloors::Visible => (floor + 2).min(MAX_LAYER),
        };
        let compensate = mode.compensate && mode.floors != SelectFloors::Current;
        if compensate && floor < GROUND_LAYER {
            let d = GROUND_LAYER - floor;
            x0 -= d;
            y0 -= d;
            x1 -= d;
            y1 -= d;
        }
        for z in (floor..=start_z).rev() {
            for y in y0.max(0)..=y1.min(u16::MAX as i32) {
                for x in x0.max(0)..=x1.min(u16::MAX as i32) {
                    let p = Position::new(x as u16, y as u16, z as u8);
                    if self.map.get(p).is_some() {
                        self.selection.insert(p);
                    }
                }
            }
            if compensate && z <= GROUND_LAYER {
                x0 += 1;
                y0 += 1;
                x1 += 1;
                y1 += 1;
            }
        }
    }

    pub fn toggle_select(&mut self, p: Position) {
        if !self.selection.remove(&p) && self.map.get(p).is_some() {
            self.selection.insert(p);
        }
    }

    pub fn copy(&mut self) -> usize {
        let Some(min_x) = self.selection.iter().map(|p| p.x).min() else { return 0 };
        let min_y = self.selection.iter().map(|p| p.y).min().unwrap();
        let max_x = self.selection.iter().map(|p| p.x).max().unwrap();
        let max_y = self.selection.iter().map(|p| p.y).max().unwrap();
        let mut tiles: Vec<PlacedTile> = self
            .selection
            .iter()
            .filter_map(|&p| self.map.get(p).map(|t| PlacedTile { pos: Position::new(p.x - min_x, p.y - min_y, p.z), tile: t.clone() }))
            .collect();
        tiles.sort_by_key(|t| t.pos);
        let n = tiles.len();
        self.clipboard = CopyBuffer { tiles, width: max_x - min_x + 1, height: max_y - min_y + 1 };
        n
    }

    pub fn delete_selection(&mut self) {
        let sel: Vec<Position> = self.selection.drain().collect();
        self.begin("delete");
        self.clear_tiles(&sel);
        self.end();
    }

    /// Remove one object from a tile (Browse field "Delete") as one undo step.
    /// `index`: `None` = creature, `Some(0)` = ground, `Some(n)` = `items[n - 1]`.
    pub fn remove_object(&mut self, pos: Position, index: Option<usize>) -> bool {
        let Some(mut t) = self.map.get(pos).cloned() else { return false };
        match index {
            None => t.creature = None,
            Some(0) => t.ground = None,
            Some(n) if n <= t.items.len() => {
                t.items.remove(n - 1);
            }
            Some(_) => return false,
        }
        let ground = index == Some(0);
        if Some(&t) == self.map.get(pos) {
            return false;
        }
        self.begin("delete object");
        self.commit(pos, t);
        if ground && self.opts.auto_border {
            self.reborder(&Self::expand(&[pos]));
        }
        self.end();
        true
    }

    /// Remove the tiles at `ps` entirely (ground, items, creature, zones, house, spawn) and fix
    /// the neighbours' borders. Recorded in the current batch (wrap in `begin`/`end`).
    pub fn clear_tiles(&mut self, ps: &[Position]) {
        let mut cleared = Vec::with_capacity(ps.len());
        for p in ps {
            if self.map.get(*p).is_some() {
                self.history.apply(&mut self.map, Change::Tile { pos: *p, tile: None });
                cleared.push(*p);
            }
        }
        if self.opts.auto_border && !cleared.is_empty() {
            self.reborder(&Self::expand(&cleared));
        }
    }

    pub fn cut(&mut self) -> usize {
        let n = self.copy();
        self.delete_selection();
        n
    }

    /// Paste the clipboard with its top-left corner at `at` (floor offsets preserved relative to `at.z`).
    pub fn paste(&mut self, at: Position) {
        if self.clipboard.is_empty() {
            return;
        }
        let base_z = self.clipboard.tiles.iter().map(|t| t.pos.z).min().unwrap_or(at.z) as i32;
        let db = self.db.clone();
        self.begin("paste");
        self.selection.clear();
        let mut placed = Vec::new();
        for pt in self.clipboard.tiles.clone() {
            let Some(p) = at.offset(pt.pos.x as i32, pt.pos.y as i32, pt.pos.z as i32 - base_z) else { continue };
            let new_tile = if pt.tile.ground.is_some() {
                pt.tile
            } else {
                let mut t = self.tile_or_new(p);
                for it in pt.tile.items {
                    t.add_item(&db, it);
                }
                t.flags |= pt.tile.flags;
                if pt.tile.house_id != 0 {
                    t.house_id = pt.tile.house_id;
                }
                if pt.tile.creature.is_some() {
                    t.creature = pt.tile.creature;
                }
                if pt.tile.spawn_radius != 0 {
                    t.spawn_radius = pt.tile.spawn_radius;
                }
                t
            };
            self.commit(p, new_tile);
            placed.push(p);
            self.selection.insert(p);
        }
        if self.opts.auto_border {
            let set: AHashSet<Position> = placed.iter().copied().collect();
            let border: Vec<Position> = Self::expand(&placed).into_iter().filter(|p| !set.contains(p)).collect();
            self.reborder(&border);
        }
        self.end();
    }

    /// Move the selection by (dx, dy, dz).
    pub fn move_selection(&mut self, dx: i32, dy: i32, dz: i32) {
        if self.selection.is_empty() || (dx == 0 && dy == 0 && dz == 0) {
            return;
        }
        let saved = std::mem::take(&mut self.clipboard);
        let min_x = self.selection.iter().map(|p| p.x).min().unwrap() as i32;
        let min_y = self.selection.iter().map(|p| p.y).min().unwrap() as i32;
        let z = self.selection.iter().map(|p| p.z).min().unwrap() as i32;
        self.copy();
        self.begin("move");
        self.delete_selection();
        if let Some(at) = Position::new(0, 0, 0).offset(min_x + dx, min_y + dy, z + dz) {
            self.paste(at);
        }
        self.end();
        self.clipboard = saved;
    }

    // ---------------------------------------------------------------- replace items

    /// Existing tile positions inside a scope.
    pub fn scope_positions(&self, scope: ReplaceScope) -> Vec<Position> {
        match scope {
            ReplaceScope::Selection => self.selection.iter().copied().filter(|p| self.map.get(*p).is_some()).collect(),
            ReplaceScope::Map => self.map.tiles().map(|(p, _)| p).collect(),
            ReplaceScope::Floor(z) => self.map.tiles().filter(|(p, _)| p.z == z).map(|(p, _)| p).collect(),
            ReplaceScope::Area { min, max } => {
                let mut v = Vec::new();
                for y in min.y..=max.y {
                    for x in min.x..=max.x {
                        let p = Position::new(x, y, min.z);
                        if self.map.get(p).is_some() {
                            v.push(p);
                        }
                    }
                }
                v
            }
        }
    }

    /// How many items `replace_items` would change (preview).
    pub fn count_items(&self, ids: &[u16], scope: ReplaceScope, include_containers: bool) -> usize {
        fn walk(it: &Item, ids: &[u16], deep: bool) -> usize {
            ids.contains(&it.id) as usize + if deep { it.children().iter().map(|c| walk(c, ids, true)).sum() } else { 0 }
        }
        self.scope_positions(scope)
            .into_iter()
            .filter_map(|p| self.map.get(p))
            .map(|t| t.ground.iter().chain(t.items.iter()).map(|i| walk(i, ids, include_containers)).sum::<usize>())
            .sum()
    }

    /// Replace item ids following `rules` (from → to) inside `scope`, as one undo step.
    /// Attributes are kept. Returns the number of replaced items.
    pub fn replace_items(&mut self, rules: &[(u16, u16)], scope: ReplaceScope, include_containers: bool) -> usize {
        let rules: AHashMap<u16, u16> = rules.iter().copied().filter(|(a, b)| *a != 0 && *b != 0 && a != b).collect();
        if rules.is_empty() {
            return 0;
        }
        let db = self.db.clone();
        let positions = self.scope_positions(scope);

        fn swap_id(item: &mut Item, rules: &AHashMap<u16, u16>, db: &ItemDb, deep: bool) -> usize {
            let mut n = 0;
            if let Some(&to) = rules.get(&item.id) {
                let had_count = item.attrs().iter().any(|a| matches!(a, crate::item::Attr::Count(_)));
                item.id = to;
                if !had_count && db.get(to).is_some_and(|t| t.is_stackable()) {
                    item.set_attr_count(1);
                }
                n += 1;
            }
            if deep {
                if let Some(ext) = item.ext.as_mut() {
                    for c in ext.children.iter_mut() {
                        n += swap_id(c, rules, db, true);
                    }
                }
            }
            n
        }

        let mut total = 0;
        let mut out = Vec::new();
        for p in positions {
            let Some(t) = self.map.get(p) else { continue };
            let mut t = t.clone();
            let mut n = 0;
            if let Some(g) = t.ground.as_mut() {
                n += swap_id(g, &rules, &db, include_containers);
            }
            for it in t.items.iter_mut() {
                n += swap_id(it, &rules, &db, include_containers);
            }
            if n == 0 {
                continue;
            }
            // A replaced ground that is no longer ground (or an item that became ground) is re-stacked.
            let items = std::mem::take(&mut t.items);
            if let Some(g) = t.ground.take() {
                if db.is_ground(g.id) || db.get(g.id).is_none() {
                    t.ground = Some(g);
                } else {
                    t.add_item(&db, g);
                }
            }
            for it in items {
                if t.ground.is_none() && db.is_ground(it.id) {
                    t.ground = Some(it);
                } else {
                    t.items.push(it);
                }
            }
            total += n;
            out.push((p, t));
        }
        if !out.is_empty() {
            self.begin("replace");
            self.commit_all(out);
            self.end();
        }
        total
    }

    // ---------------------------------------------------------------- houses / towns

    pub fn set_houses(&mut self, houses: Vec<House>) {
        if houses != self.map.houses {
            self.history.apply(&mut self.map, Change::Houses(houses));
        }
    }

    pub fn set_towns(&mut self, towns: Vec<crate::map::Town>) {
        if towns != self.map.towns {
            self.history.apply(&mut self.map, Change::Towns(towns));
        }
    }

    pub fn set_waypoints(&mut self, wps: Vec<Waypoint>) {
        if wps != self.map.waypoints {
            self.history.apply(&mut self.map, Change::Waypoints(wps));
        }
    }

    /// Replace a tile (property editor).
    pub fn replace_tile(&mut self, pos: Position, tile: Tile) {
        self.commit(pos, tile);
    }

    /// Tile count per house id.
    pub fn house_sizes(&self) -> AHashMap<u32, u32> {
        let mut m = AHashMap::new();
        for (_, t) in self.map.tiles() {
            if t.house_id != 0 {
                *m.entry(t.house_id).or_insert(0) += 1;
            }
        }
        m
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_staged_is_one_undo_step() {
        let mut ed = editor();
        let before: Vec<_> = ed.map.tiles().map(|(p, t)| (p, t.clone())).collect();
        let mut st = crate::staged::Staged::new(&ed.map);
        for x in 0..50u16 {
            st.set(Position::new(300 + x, 300, 7), Tile { ground: Some(Item::new(2)), ..Tile::new() });
        }
        st.remove(Position::new(100, 100, 7));
        st.tile_mut(Position::new(101, 100, 7)).items.push(Item::new(11));
        let ch = st.into_changes();
        let undo_before = ed.history.undo_count();
        assert_eq!(ed.apply_staged(&ch, "gen"), 52);
        assert_eq!(ed.history.undo_count(), undo_before + 1, "one undo step");
        assert!(ed.map.get(Position::new(100, 100, 7)).is_none());
        assert!(ed.undo());
        let after: Vec<_> = ed.map.tiles().map(|(p, t)| (p, t.clone())).collect();
        let (mut a, mut b) = (before, after);
        a.sort_by_key(|x| x.0);
        b.sort_by_key(|x| x.0);
        assert_eq!(a, b, "undo restores the map exactly");
    }
    use crate::items::{ItemGroup, ItemType};

    fn db() -> ItemDb {
        let mut db = ItemDb::default();
        db.items = (0..=20u16)
            .map(|id| ItemType { id, valid: id >= 1, group: if id <= 5 { ItemGroup::Ground } else { ItemGroup::None }, ..Default::default() })
            .collect();
        db
    }

    fn editor() -> Editor {
        let mut ed = Editor::new(Map::new(), Arc::new(db()), Arc::new(Materials::default()));
        for x in 0..4u16 {
            for z in [6u8, 7] {
                let mut t = Tile::new();
                t.ground = Some(Item::new(1));
                t.items.push(Item::new(10));
                ed.map.set_tile(Position::new(100 + x, 100, z), t);
            }
        }
        ed
    }

    fn count(ed: &Editor, id: u16) -> usize {
        ed.map.tiles().map(|(_, t)| t.ground.iter().chain(t.items.iter()).filter(|i| i.id == id).count()).sum()
    }

    #[test]
    fn clear_tiles_removes_whole_tile_and_undoes() {
        let mut ed = editor();
        let (p, q) = (Position::new(101, 100, 7), Position::new(102, 100, 7));
        let before = ed.map.get(p).cloned();
        let undo_before = ed.history.undo_count();
        ed.begin("clear");
        ed.clear_tiles(&[p, p, Position::new(500, 500, 7)]);
        ed.end();
        assert!(ed.map.get(p).is_none(), "tile removed");
        assert!(ed.map.get(q).is_some(), "neighbour untouched");
        assert_eq!(ed.history.undo_count(), undo_before + 1, "one undo step");
        assert!(ed.undo());
        assert_eq!(ed.map.get(p).cloned(), before, "undo restores the tile");
    }

    /// Editor with a ground tile on every position of x 100..=120, y 100..=120, z 5..=9.
    fn layered_editor() -> Editor {
        let mut ed = Editor::new(Map::new(), Arc::new(db()), Arc::new(Materials::default()));
        for z in 5u8..=9 {
            for y in 100u16..=120 {
                for x in 100u16..=120 {
                    let mut t = Tile::new();
                    t.ground = Some(Item::new(1));
                    ed.map.set_tile(Position::new(x, y, z), t);
                }
            }
        }
        ed
    }

    fn floors_of(ed: &Editor) -> Vec<u8> {
        let mut v: Vec<u8> = ed.selection.iter().map(|p| p.z).collect();
        v.sort_unstable();
        v.dedup();
        v
    }

    #[test]
    fn selection_modes_follow_rme() {
        let (a, b) = (Position::new(110, 110, 6), Position::new(111, 111, 6));
        let mode = |floors, compensate| SelectMode { floors, compensate };
        let mut ed = layered_editor();

        ed.select_area_mode(a, b, false, mode(SelectFloors::Current, true));
        assert_eq!(floors_of(&ed), vec![6]);
        assert_eq!(ed.selection.len(), 4);

        ed.select_area_mode(a, b, false, mode(SelectFloors::Lower, false));
        assert_eq!(floors_of(&ed), vec![6, 7, 8, 9], "6 and below (tiles exist up to 9)");
        assert_eq!(ed.selection.len(), 16);

        ed.select_area_mode(a, b, false, mode(SelectFloors::Visible, false));
        assert_eq!(floors_of(&ed), vec![6, 7], "above ground: down to floor 7");

        // Compensated: floor 7 is one floor below 6, so its box is shifted by -1.
        ed.select_area_mode(a, b, false, mode(SelectFloors::Visible, true));
        assert!(ed.selection.contains(&Position::new(110, 110, 6)));
        assert!(ed.selection.contains(&Position::new(109, 109, 7)));
        assert!(!ed.selection.contains(&Position::new(111, 111, 7)));

        // Underground: visible = floor .. floor + 2.
        let (c, d) = (Position::new(110, 110, 8), Position::new(110, 110, 8));
        ed.select_area_mode(c, d, false, mode(SelectFloors::Visible, true));
        assert_eq!(floors_of(&ed), vec![8, 9]);
        assert_eq!(ed.selection.len(), 2, "no compensation below ground");

        // `add` keeps the previous selection.
        ed.select_area_mode(a, a, true, SelectMode::default());
        assert!(ed.selection.contains(&Position::new(110, 110, 6)) && ed.selection.contains(&Position::new(110, 110, 9)));
    }

    #[test]
    fn copy_paste_keeps_floors() {
        let mut ed = layered_editor();
        let p = Position::new(105, 105, 7);
        let mut t = ed.map.get(p).unwrap().clone();
        t.items.push(Item::new(11));
        ed.map.set_tile(p, t);
        ed.select_area_mode(Position::new(105, 105, 6), Position::new(106, 105, 6), false, SelectMode { floors: SelectFloors::Lower, compensate: false });
        assert_eq!(ed.copy(), 8, "2 tiles x 4 floors");
        let undo_before = ed.history.undo_count();
        ed.paste(Position::new(200, 200, 6));
        assert_eq!(ed.history.undo_count(), undo_before + 1, "one undo step");
        for z in 6u8..=9 {
            assert!(ed.map.get(Position::new(200, 200, z)).is_some() && ed.map.get(Position::new(201, 200, z)).is_some(), "floor {z}");
        }
        assert_eq!(ed.map.get(Position::new(200, 200, 7)).unwrap().items.len(), 1, "items come along");
        assert!(ed.map.get(Position::new(200, 200, 10)).is_none());
    }

    #[test]
    fn remove_object_takes_only_that_object() {
        let mut ed = editor();
        let p = Position::new(100, 100, 7);
        let before = ed.map.get(p).cloned().unwrap();
        assert!(ed.remove_object(p, Some(1)), "top item");
        let t = ed.map.get(p).unwrap();
        assert!(t.items.is_empty());
        assert_eq!(t.ground, before.ground, "ground kept");
        assert!(!ed.remove_object(p, Some(5)), "out of range");
        assert!(!ed.remove_object(p, None), "no creature: nothing to do");
        assert!(ed.undo());
        assert_eq!(ed.map.get(p), Some(&before));
    }

    #[test]
    fn replace_whole_map_and_undo() {
        let mut ed = editor();
        let n = ed.replace_items(&[(10, 11), (1, 2)], ReplaceScope::Map, false);
        assert_eq!(n, 16);
        assert_eq!((count(&ed, 10), count(&ed, 11), count(&ed, 2)), (0, 8, 8));
        assert!(ed.undo(), "replace is one undo step");
        assert_eq!((count(&ed, 10), count(&ed, 1)), (8, 8));
    }

    #[test]
    fn replace_scopes() {
        let mut ed = editor();
        assert_eq!(ed.replace_items(&[(10, 11)], ReplaceScope::Floor(6), false), 4);
        assert_eq!(count(&ed, 11), 4);
        let area = ReplaceScope::Area { min: Position::new(100, 100, 7), max: Position::new(101, 100, 7) };
        assert_eq!(ed.replace_items(&[(10, 12)], area, false), 2);
        ed.selection.insert(Position::new(103, 100, 7));
        assert_eq!(ed.replace_items(&[(10, 13)], ReplaceScope::Selection, false), 1);
        assert_eq!(count(&ed, 10), 1);
    }

    #[test]
    fn replace_keeps_attributes_and_restacks_ground() {
        let mut ed = editor();
        let p = Position::new(100, 100, 7);
        let mut t = ed.map.get(p).unwrap().clone();
        t.items[0].set_action_id(5000);
        let mut bag = Item::new(15);
        bag.ext_mut().children.push(Item::new(10));
        t.items.push(bag);
        ed.map.set_tile(p, t);
        // An item turned into ground goes to the ground slot only if it is free; ground→item is re-stacked.
        ed.replace_items(&[(1, 16)], ReplaceScope::Selection, false); // empty selection: nothing
        assert_eq!(ed.map.get(p).unwrap().ground.as_ref().unwrap().id, 1);
        ed.selection.insert(p);
        assert_eq!(ed.replace_items(&[(10, 11)], ReplaceScope::Selection, true), 2, "container content counts");
        let t = ed.map.get(p).unwrap();
        assert_eq!(t.items[0].action_id(), 5000);
        assert_eq!(t.items[1].children()[0].id, 11);
        ed.replace_items(&[(1, 16)], ReplaceScope::Selection, false);
        let t = ed.map.get(p).unwrap();
        assert!(t.ground.is_none() && t.items.iter().any(|i| i.id == 16));
    }
}
