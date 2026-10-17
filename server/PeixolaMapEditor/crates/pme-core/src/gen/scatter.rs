//! Density distribution ("Distribuir objetos"): scatter items / doodads over an area with a
//! weighted choice, density, minimum spacing and exclusion rules. Deterministic for a seed.
//! The result is staged (preview) — nothing is written to the map here.

use ahash::AHashSet;

use crate::brushes::doodad;
use crate::item::Item;
use crate::items::ItemDb;
use crate::map::Map;
use crate::materials::{BrushId, Materials};
use crate::position::Position;
use crate::staged::{Staged, StagedChanges};
use crate::tile::{flags, Tile};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ScatterEntry {
    /// A single item id.
    Item(u16),
    /// A doodad brush (single item or composite, chosen by the brush's own chances).
    Doodad(BrushId),
}

#[derive(Clone, Debug)]
pub struct ScatterParams {
    /// (what, weight). Weight 0 entries are ignored.
    pub entries: Vec<(ScatterEntry, u32)>,
    /// Probability (0..=1) that an eligible tile receives an object.
    pub density: f32,
    /// Minimum Chebyshev distance between two placed objects (0 = no limit).
    pub min_distance: u16,
    pub seed: u64,
    /// Skip tiles that already have items (other than borders).
    pub preserve_existing: bool,
    pub exclude_blocking: bool,
    pub exclude_houses: bool,
    pub exclude_pz: bool,
    /// Skip tiles with a creature or a spawn centre.
    pub exclude_creatures: bool,
    /// Only tiles whose ground belongs to one of these ground brushes (empty = any ground).
    pub allowed_grounds: Vec<BrushId>,
}

impl Default for ScatterParams {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            density: 0.15,
            min_distance: 1,
            seed: 1,
            preserve_existing: true,
            exclude_blocking: true,
            exclude_houses: true,
            exclude_pz: true,
            exclude_creatures: true,
            allowed_grounds: Vec::new(),
        }
    }
}

/// Why a tile cannot receive an object (used by the checks and the tests).
fn eligible(t: Option<&Tile>, p: &ScatterParams, db: &ItemDb, mat: &Materials) -> bool {
    let Some(t) = t else { return false };
    let Some(g) = &t.ground else { return false };
    if !p.allowed_grounds.is_empty() && !p.allowed_grounds.contains(&mat.ground_brush_of(g.id)) {
        return false;
    }
    if p.exclude_blocking && t.is_blocking(db) {
        return false;
    }
    if t.items.iter().any(|i| mat.info(i.id).is_wall) {
        return false;
    }
    if p.preserve_existing && t.items.iter().any(|i| !mat.info(i.id).is_border) {
        return false;
    }
    if p.exclude_houses && t.house_id != 0 {
        return false;
    }
    if p.exclude_pz && t.flags & flags::PROTECTION_ZONE != 0 {
        return false;
    }
    if p.exclude_creatures && (t.creature.is_some() || t.spawn_radius > 0) {
        return false;
    }
    true
}

fn pick_entry(entries: &[(ScatterEntry, u32)]) -> Option<ScatterEntry> {
    let total: u32 = entries.iter().map(|e| e.1).sum();
    if total == 0 {
        return None;
    }
    let mut roll = fastrand::u32(0..total);
    for (e, w) in entries {
        if roll < *w {
            return Some(*e);
        }
        roll -= w;
    }
    None
}

fn too_close(placed: &AHashSet<Position>, p: Position, d: u16) -> bool {
    if d == 0 {
        return false;
    }
    let d = d as i32;
    for dy in -d..=d {
        for dx in -d..=d {
            if (dx, dy) != (0, 0) && p.offset(dx, dy, 0).is_some_and(|q| placed.contains(&q)) {
                return true;
            }
        }
    }
    false
}

/// Scatter over `area` (candidate positions). Deterministic: same map + params + area → same result.
pub fn scatter(map: &Map, area: &[Position], params: &ScatterParams, db: &ItemDb, mat: &Materials) -> StagedChanges {
    crate::rng::with_seed(params.seed, || {
        let mut st = Staged::new(map);
        let mut cand: Vec<Position> = area.to_vec();
        cand.sort_unstable();
        cand.dedup();
        fastrand::shuffle(&mut cand);
        let entries: Vec<(ScatterEntry, u32)> = params.entries.iter().copied().filter(|e| e.1 > 0).collect();
        let mut placed: AHashSet<Position> = AHashSet::new();
        let density = params.density.clamp(0.0, 1.0);
        for p in cand {
            if fastrand::f32() >= density {
                continue;
            }
            if !eligible(st.get(p), params, db, mat) || too_close(&placed, p, params.min_distance) {
                continue;
            }
            match pick_entry(&entries) {
                Some(ScatterEntry::Item(id)) => {
                    if db.get(id).is_none() {
                        continue; // never place unknown ids
                    }
                    let it = if db.get(id).is_some_and(|t| t.is_stackable()) { Item::with_count(id, 1) } else { Item::new(id) };
                    st.tile_mut(p).add_item(db, it);
                    placed.insert(p);
                }
                Some(ScatterEntry::Doodad(b)) => {
                    let Some(d) = doodad::doodad(mat, b) else { continue };
                    let variation = if d.alternatives.is_empty() { 0 } else { fastrand::usize(0..d.alternatives.len()) };
                    let buf = doodad::fill_buffer(d, variation, 0, false);
                    // All parts must land on eligible tiles (composites are placed whole or not at all).
                    let parts: Vec<(Position, &Vec<Item>)> = buf.iter().filter_map(|(dx, dy, dz, items)| p.offset(*dx, *dy, *dz).map(|q| (q, items))).collect();
                    if parts.is_empty() || parts.len() != buf.len() {
                        continue;
                    }
                    let ok = parts.iter().all(|(q, _)| (*q == p || eligible(st.get(*q), params, db, mat) || d.on_blocking && st.get(*q).is_some()) && !placed.contains(q));
                    if !ok {
                        continue;
                    }
                    for (q, items) in parts {
                        let t = st.tile_mut(q);
                        for it in items {
                            t.add_item(db, it.clone());
                        }
                        placed.insert(q);
                    }
                }
                None => break,
            }
        }
        st.into_changes()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::items::{ItemGroup, ItemType};

    fn db() -> ItemDb {
        let mut db = ItemDb::default();
        db.items = (0..=40u16)
            .map(|id| ItemType { id, valid: id >= 1, group: if id <= 5 { ItemGroup::Ground } else { ItemGroup::None }, flags: if id == 30 { crate::items::otb_flags::UNPASSABLE } else { 0 }, ..Default::default() })
            .collect();
        db
    }

    fn grass_map(w: u16, h: u16) -> Map {
        let mut m = Map::new();
        for y in 0..h {
            for x in 0..w {
                m.set_tile(Position::new(100 + x, 100 + y, 7), Tile { ground: Some(Item::new(1)), ..Tile::new() });
            }
        }
        m
    }

    fn area(w: u16, h: u16) -> Vec<Position> {
        (0..h).flat_map(|y| (0..w).map(move |x| Position::new(100 + x, 100 + y, 7))).collect()
    }

    fn params(seed: u64) -> ScatterParams {
        ScatterParams { entries: vec![(ScatterEntry::Item(10), 3), (ScatterEntry::Item(11), 1)], density: 0.5, min_distance: 1, seed, ..Default::default() }
    }

    #[test]
    fn deterministic_for_a_seed() {
        let (m, db, mat) = (grass_map(30, 30), db(), Materials::default());
        let a = scatter(&m, &area(30, 30), &params(42), &db, &mat);
        let b = scatter(&m, &area(30, 30), &params(42), &db, &mat);
        let c = scatter(&m, &area(30, 30), &params(43), &db, &mat);
        assert!(!a.is_empty());
        assert_eq!(a, b, "same seed → same result");
        assert_ne!(a, c, "different seed → different result");
    }

    #[test]
    fn respects_min_distance_and_exclusions() {
        let (mut m, db, mat) = (grass_map(30, 30), db(), Materials::default());
        // A house tile, a PZ tile, a blocking tile and a tile that already has an item.
        let house = Position::new(105, 105, 7);
        m.get_mut(house).unwrap().house_id = 3;
        let pz = Position::new(106, 105, 7);
        m.get_mut(pz).unwrap().flags = flags::PROTECTION_ZONE;
        let blocked = Position::new(107, 105, 7);
        m.get_mut(blocked).unwrap().items.push(Item::new(30));
        let busy = Position::new(108, 105, 7);
        m.get_mut(busy).unwrap().items.push(Item::new(20));
        let mut p = params(7);
        p.density = 1.0;
        p.min_distance = 2;
        let ch = scatter(&m, &area(30, 30), &p, &db, &mat);
        for q in [house, pz, blocked, busy] {
            assert!(!ch.tiles.contains_key(&q), "excluded tile {q} was changed");
        }
        let placed: Vec<Position> = ch.tiles.keys().copied().collect();
        for (i, a) in placed.iter().enumerate() {
            for b in &placed[i + 1..] {
                let d = (a.x as i32 - b.x as i32).abs().max((a.y as i32 - b.y as i32).abs());
                assert!(d > 2, "objects {a} and {b} closer than min distance");
            }
        }
        // Unknown item ids are never placed.
        let mut bad = params(1);
        bad.entries = vec![(ScatterEntry::Item(999), 1)];
        assert!(scatter(&m, &area(30, 30), &bad, &db, &mat).is_empty());
    }
}
