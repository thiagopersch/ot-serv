//! Staged edits: a copy-on-write layer over the map. Generators, distribution tools, templates
//! and transforms build their result here first (preview), then it is applied to the map as a
//! single undo step — or simply dropped (cancel). The map is never touched before confirmation.

use ahash::AHashMap;

use crate::brushes::{carpet_table, ground, wall};
use crate::items::ItemDb;
use crate::map::Map;
use crate::materials::Materials;
use crate::position::Position;
use crate::source::TileSource;
use crate::tile::Tile;

/// Owned result of a staged operation: the new content of every touched tile
/// (`None` = the tile is removed).
#[derive(Clone, Default, Debug, PartialEq)]
pub struct StagedChanges {
    pub tiles: AHashMap<Position, Option<Tile>>,
}

impl StagedChanges {
    pub fn len(&self) -> usize {
        self.tiles.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tiles.is_empty()
    }

    /// Bounding box (min, max) of the touched positions, per axis.
    pub fn bounds(&self) -> Option<(Position, Position)> {
        let mut it = self.tiles.keys();
        let first = *it.next()?;
        let (mut lo, mut hi) = (first, first);
        for p in it {
            lo = Position::new(lo.x.min(p.x), lo.y.min(p.y), lo.z.min(p.z));
            hi = Position::new(hi.x.max(p.x), hi.y.max(p.y), hi.z.max(p.z));
        }
        Some((lo, hi))
    }

    /// Positions in a stable order (applying in this order is deterministic).
    pub fn sorted_positions(&self) -> Vec<Position> {
        let mut v: Vec<Position> = self.tiles.keys().copied().collect();
        v.sort_unstable();
        v
    }

    /// Drop entries that would not change `map` (keeps previews and undo batches minimal).
    pub fn prune_unchanged(&mut self, map: &Map) {
        self.tiles.retain(|p, t| match (t, map.get(*p)) {
            (Some(n), Some(o)) => n != o,
            (Some(n), None) => !n.is_empty(),
            (None, o) => o.is_some(),
        });
    }
}

/// Copy-on-write view over a map.
pub struct Staged<'m> {
    base: &'m Map,
    changes: StagedChanges,
}

impl<'m> Staged<'m> {
    pub fn new(base: &'m Map) -> Self {
        Self { base, changes: StagedChanges::default() }
    }

    pub fn base(&self) -> &'m Map {
        self.base
    }

    /// Current content of a tile (staged version first).
    pub fn get(&self, pos: Position) -> Option<&Tile> {
        match self.changes.tiles.get(&pos) {
            Some(t) => t.as_ref(),
            None => self.base.get(pos),
        }
    }

    /// Mutable tile, copied from the map on first write (created empty if missing).
    pub fn tile_mut(&mut self, pos: Position) -> &mut Tile {
        let base = self.base;
        let slot = self.changes.tiles.entry(pos).or_insert_with(|| Some(base.get(pos).cloned().unwrap_or_default()));
        slot.get_or_insert_with(Tile::default)
    }

    pub fn set(&mut self, pos: Position, tile: Tile) {
        let t = if tile.is_empty() { None } else { Some(tile) };
        self.changes.tiles.insert(pos, t);
    }

    pub fn remove(&mut self, pos: Position) {
        self.changes.tiles.insert(pos, None);
    }

    pub fn changes(&self) -> &StagedChanges {
        &self.changes
    }

    /// Finish: the owned change set (unchanged tiles pruned).
    pub fn into_changes(mut self) -> StagedChanges {
        self.changes.prune_unchanged(self.base);
        self.changes
    }

    /// Recompute ground borders, walls, carpets and tables on `positions`, reading neighbours
    /// from this staged view (same RME algorithms the brushes use on the real map).
    pub fn reborder(&mut self, positions: &[Position], db: &ItemDb, mat: &Materials) {
        let mut out = Vec::with_capacity(positions.len());
        let view: &Staged = self;
        for &p in positions {
            let mut t = view.get(p).cloned().unwrap_or_default();
            let before = t.clone();
            wall::do_walls(view, db, mat, p, &mut t);
            carpet_table::do_tables(view, mat, p, &mut t);
            carpet_table::do_carpets(view, mat, p, &mut t);
            ground::do_borders(view, mat, p, &mut t);
            if t != before {
                out.push((p, t));
            }
        }
        for (p, t) in out {
            self.set(p, t);
        }
    }
}

impl TileSource for Staged<'_> {
    #[inline]
    fn tile(&self, pos: Position) -> Option<&Tile> {
        self.get(pos)
    }
}

/// Positions of `positions` plus their 8 neighbours, sorted and unique (border recompute area).
pub fn with_neighbours(positions: impl IntoIterator<Item = Position>) -> Vec<Position> {
    let mut v: Vec<Position> = Vec::new();
    for p in positions {
        for dy in -1..=1 {
            for dx in -1..=1 {
                if let Some(q) = p.offset(dx, dy, 0) {
                    v.push(q);
                }
            }
        }
    }
    v.sort_unstable();
    v.dedup();
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    fn ground(id: u16) -> Tile {
        Tile { ground: Some(Item::new(id)), ..Tile::new() }
    }

    #[test]
    fn overlay_reads_its_own_writes_without_touching_the_map() {
        let mut map = Map::new();
        let a = Position::new(10, 10, 7);
        let b = Position::new(11, 10, 7);
        map.set_tile(a, ground(1));
        let rev = map.revision;
        let mut s = Staged::new(&map);
        assert_eq!(s.get(a).unwrap().ground.as_ref().unwrap().id, 1);
        s.tile_mut(a).items.push(Item::new(5));
        s.set(b, ground(2));
        assert_eq!(s.get(a).unwrap().items.len(), 1, "read-your-writes");
        assert_eq!(s.tile(b).unwrap().ground.as_ref().unwrap().id, 2);
        s.remove(a);
        assert!(s.get(a).is_none());
        let ch = s.into_changes();
        assert_eq!(map.revision, rev, "map untouched");
        assert!(map.get(a).is_some() && map.get(b).is_none());
        assert_eq!(ch.len(), 2);
        assert_eq!(ch.bounds(), Some((a, b)));
    }

    #[test]
    fn prune_drops_no_op_changes() {
        let mut map = Map::new();
        let a = Position::new(1, 1, 7);
        map.set_tile(a, ground(1));
        let mut s = Staged::new(&map);
        s.set(a, ground(1)); // same as the map
        s.remove(Position::new(2, 2, 7)); // nothing there
        assert!(s.into_changes().is_empty());
    }
}
