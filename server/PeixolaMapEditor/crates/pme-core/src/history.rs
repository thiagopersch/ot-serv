//! Undo/redo. Same model as RME `action.cpp`: every change swaps whole tiles, so applying a
//! change twice restores the original state. A batch groups everything done in one user
//! gesture (a brush stroke, a paste, a delete...).

use std::collections::VecDeque;

use crate::map::{House, Map, Town, Waypoint};
use crate::position::Position;
use crate::tile::Tile;

pub enum Change {
    Tile { pos: Position, tile: Option<Box<Tile>> },
    Houses(Vec<House>),
    Towns(Vec<Town>),
    Waypoints(Vec<Waypoint>),
}

impl Change {
    /// Swap the stored state with the map's state.
    fn apply(&mut self, map: &mut Map) {
        match self {
            Change::Tile { pos, tile } => {
                let old = map.swap_tile(*pos, tile.take());
                *tile = old;
            }
            Change::Houses(v) => std::mem::swap(v, &mut map.houses),
            Change::Towns(v) => std::mem::swap(v, &mut map.towns),
            Change::Waypoints(v) => std::mem::swap(v, &mut map.waypoints),
        }
    }

    fn mem_size(&self) -> usize {
        match self {
            Change::Tile { tile, .. } => 32 + tile.as_ref().map_or(0, |t| t.mem_size()),
            Change::Houses(v) => v.len() * 64,
            Change::Towns(v) => v.len() * 48,
            Change::Waypoints(v) => v.len() * 48,
        }
    }
}

pub struct Batch {
    pub label: String,
    changes: Vec<Change>,
    mem: usize,
}

impl Batch {
    pub fn len(&self) -> usize {
        self.changes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.changes.is_empty()
    }

    /// Positions touched by this batch.
    pub fn positions(&self) -> impl Iterator<Item = Position> + '_ {
        self.changes.iter().filter_map(|c| if let Change::Tile { pos, .. } = c { Some(*pos) } else { None })
    }
}

pub struct History {
    undo: VecDeque<Batch>,
    redo: Vec<Batch>,
    open: Option<Batch>,
    depth: u32,
    pub max_batches: usize,
    pub max_mem: usize,
    mem: usize,
}

impl Default for History {
    fn default() -> Self {
        Self { undo: VecDeque::new(), redo: Vec::new(), open: None, depth: 0, max_batches: 500, max_mem: 512 * 1024 * 1024, mem: 0 }
    }
}

impl History {
    /// Open a batch. Calls nest: only the outermost `end` closes it.
    pub fn begin(&mut self, label: impl Into<String>) {
        self.depth += 1;
        if self.open.is_none() {
            self.open = Some(Batch { label: label.into(), changes: Vec::new(), mem: 0 });
        }
    }

    pub fn is_open(&self) -> bool {
        self.open.is_some()
    }

    /// Apply a change to the map now and record it in the open batch.
    pub fn apply(&mut self, map: &mut Map, mut change: Change) {
        change.apply(map);
        let implicit = self.open.is_none();
        if implicit {
            self.begin("edit");
        }
        let b = self.open.as_mut().unwrap();
        b.mem += change.mem_size();
        b.changes.push(change);
        if implicit {
            self.end();
        }
    }

    /// Convenience: replace a tile, recording the change.
    pub fn set_tile(&mut self, map: &mut Map, pos: Position, tile: Tile) {
        self.apply(map, Change::Tile { pos, tile: Some(Box::new(tile)) });
    }

    pub fn end(&mut self) {
        self.depth = self.depth.saturating_sub(1);
        if self.depth > 0 {
            return;
        }
        let Some(b) = self.open.take() else { return };
        if b.changes.is_empty() {
            return;
        }
        self.redo.clear();
        self.mem += b.mem;
        self.undo.push_back(b);
        while self.undo.len() > self.max_batches || (self.mem > self.max_mem && self.undo.len() > 1) {
            if let Some(old) = self.undo.pop_front() {
                self.mem -= old.mem;
            }
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    pub fn undo_label(&self) -> Option<&str> {
        self.undo.back().map(|b| b.label.as_str())
    }

    pub fn redo_label(&self) -> Option<&str> {
        self.redo.last().map(|b| b.label.as_str())
    }

    /// Force-close any open batch (e.g. before undo).
    fn close_all(&mut self) {
        self.depth = 1;
        self.end();
    }

    pub fn undo(&mut self, map: &mut Map) -> bool {
        self.close_all();
        let Some(mut b) = self.undo.pop_back() else { return false };
        for c in b.changes.iter_mut().rev() {
            c.apply(map);
        }
        self.mem -= b.mem;
        self.redo.push(b);
        true
    }

    pub fn redo(&mut self, map: &mut Map) -> bool {
        self.close_all();
        let Some(mut b) = self.redo.pop() else { return false };
        for c in b.changes.iter_mut() {
            c.apply(map);
        }
        self.mem += b.mem;
        self.undo.push_back(b);
        true
    }

    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
        self.open = None;
        self.depth = 0;
        self.mem = 0;
    }

    pub fn undo_count(&self) -> usize {
        self.undo.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    fn ground(id: u16) -> Tile {
        Tile { ground: Some(Item::new(id)), ..Tile::new() }
    }

    #[test]
    fn undo_redo_swaps() {
        let mut map = Map::new();
        let mut h = History::default();
        let p = Position::new(100, 100, 7);
        map.set_tile(p, ground(1));

        h.begin("stroke");
        h.set_tile(&mut map, p, ground(2));
        h.set_tile(&mut map, p, ground(3));
        h.set_tile(&mut map, Position::new(101, 100, 7), ground(4));
        h.end();
        assert_eq!(map.get(p).unwrap().ground.as_ref().unwrap().id, 3);
        assert_eq!(map.tile_count(), 2);

        assert!(h.undo(&mut map));
        assert_eq!(map.get(p).unwrap().ground.as_ref().unwrap().id, 1);
        assert_eq!(map.tile_count(), 1);

        assert!(h.redo(&mut map));
        assert_eq!(map.get(p).unwrap().ground.as_ref().unwrap().id, 3);
        assert_eq!(map.tile_count(), 2);
        assert!(!h.can_redo());
    }

    #[test]
    fn new_batch_clears_redo() {
        let mut map = Map::new();
        let mut h = History::default();
        let p = Position::new(5, 5, 7);
        h.set_tile(&mut map, p, ground(1));
        h.undo(&mut map);
        assert!(h.can_redo());
        h.set_tile(&mut map, p, ground(2));
        assert!(!h.can_redo());
    }
}
