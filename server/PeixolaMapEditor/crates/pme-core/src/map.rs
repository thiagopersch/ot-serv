//! Map storage: sparse 32x32 chunks per floor in a hash map.
//! Cache-friendly viewport iteration and O(1) tile access.

use ahash::AHashMap;

use crate::position::Position;
use crate::tile::Tile;

pub const CHUNK_BITS: u32 = 5;
pub const CHUNK_SIZE: u32 = 1 << CHUNK_BITS; // 32
const CHUNK_MASK: u32 = CHUNK_SIZE - 1;
const CHUNK_TILES: usize = (CHUNK_SIZE * CHUNK_SIZE) as usize;

#[inline]
pub fn chunk_key(x: u16, y: u16, z: u8) -> u32 {
    ((x as u32 >> CHUNK_BITS) << 15) | ((y as u32 >> CHUNK_BITS) << 4) | z as u32
}

#[inline]
pub fn chunk_key_from_coords(cx: u32, cy: u32, z: u8) -> u32 {
    (cx << 15) | (cy << 4) | z as u32
}

pub struct Chunk {
    tiles: Box<[Option<Box<Tile>>]>,
    count: u32,
    /// Bumped whenever a tile in the chunk changes (render/minimap caches key off it).
    pub revision: u64,
}

impl Chunk {
    fn new() -> Self {
        Self { tiles: (0..CHUNK_TILES).map(|_| None).collect(), count: 0, revision: 0 }
    }

    #[inline]
    fn idx(x: u16, y: u16) -> usize {
        (((y as u32 & CHUNK_MASK) << CHUNK_BITS) | (x as u32 & CHUNK_MASK)) as usize
    }

    /// Iterate (local_x, local_y, tile).
    pub fn iter(&self) -> impl Iterator<Item = (u32, u32, &Tile)> {
        self.tiles.iter().enumerate().filter_map(|(i, t)| t.as_deref().map(|t| (i as u32 & CHUNK_MASK, i as u32 >> CHUNK_BITS, t)))
    }

    #[inline]
    pub fn get_local(&self, lx: u32, ly: u32) -> Option<&Tile> {
        self.tiles[((ly << CHUNK_BITS) | lx) as usize].as_deref()
    }

    pub fn len(&self) -> u32 {
        self.count
    }

    pub fn is_empty(&self) -> bool {
        self.count == 0
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Town {
    pub id: u32,
    pub name: String,
    pub temple: Position,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Waypoint {
    pub name: String,
    pub pos: Position,
}

#[derive(Clone, Debug, PartialEq)]
pub struct House {
    pub id: u32,
    pub name: String,
    pub town_id: u32,
    pub rent: u32,
    pub entry: Position,
    pub guildhall: bool,
    /// Size as written by the previous editor (recomputed on save).
    pub size: u32,
}

#[derive(Default)]
pub struct Map {
    chunks: AHashMap<u32, Box<Chunk>>,
    tile_count: usize,
    pub width: u16,
    pub height: u16,
    pub otbm_version: u32,
    pub otb_major: u32,
    pub otb_minor: u32,
    pub descriptions: Vec<String>,
    pub spawn_file: String,
    pub house_file: String,
    pub towns: Vec<Town>,
    pub waypoints: Vec<Waypoint>,
    pub houses: Vec<House>,
    /// Global revision, bumped on every tile change.
    pub revision: u64,
}

impl Map {
    pub fn new() -> Self {
        Self {
            width: 2048,
            height: 2048,
            otbm_version: 2,
            otb_major: 3,
            otb_minor: 20,
            descriptions: vec!["Saved with PeixolaMapEditor".to_owned()],
            ..Default::default()
        }
    }

    #[inline]
    pub fn tile_count(&self) -> usize {
        self.tile_count
    }

    #[inline]
    pub fn get(&self, pos: Position) -> Option<&Tile> {
        self.chunks.get(&chunk_key(pos.x, pos.y, pos.z))?.tiles[Chunk::idx(pos.x, pos.y)].as_deref()
    }

    #[inline]
    pub fn get_xyz(&self, x: i32, y: i32, z: u8) -> Option<&Tile> {
        if !(0..=0xFFFF).contains(&x) || !(0..=0xFFFF).contains(&y) {
            return None;
        }
        self.get(Position::new(x as u16, y as u16, z))
    }

    /// Mutable access. Bumps revisions; prefer going through the editor/history so undo works.
    pub fn get_mut(&mut self, pos: Position) -> Option<&mut Tile> {
        self.revision += 1;
        let rev = self.revision;
        let c = self.chunks.get_mut(&chunk_key(pos.x, pos.y, pos.z))?;
        c.revision = rev;
        c.tiles[Chunk::idx(pos.x, pos.y)].as_deref_mut()
    }

    /// Replace the tile at `pos`, returning the previous one. `None` (or an empty tile) removes it.
    pub fn swap_tile(&mut self, pos: Position, tile: Option<Box<Tile>>) -> Option<Box<Tile>> {
        let tile = tile.filter(|t| !t.is_empty());
        self.revision += 1;
        let rev = self.revision;
        let key = chunk_key(pos.x, pos.y, pos.z);
        let idx = Chunk::idx(pos.x, pos.y);
        if tile.is_none() {
            let c = self.chunks.get_mut(&key)?;
            let old = c.tiles[idx].take();
            if old.is_some() {
                c.count -= 1;
                self.tile_count -= 1;
            }
            c.revision = rev;
            if c.count == 0 {
                self.chunks.remove(&key);
            }
            return old;
        }
        let c = self.chunks.entry(key).or_insert_with(|| Box::new(Chunk::new()));
        let old = std::mem::replace(&mut c.tiles[idx], tile);
        if old.is_none() {
            c.count += 1;
            self.tile_count += 1;
        }
        c.revision = rev;
        old
    }

    pub fn set_tile(&mut self, pos: Position, tile: Tile) {
        self.swap_tile(pos, Some(Box::new(tile)));
    }

    #[inline]
    pub fn chunk(&self, cx: u32, cy: u32, z: u8) -> Option<&Chunk> {
        self.chunks.get(&chunk_key_from_coords(cx, cy, z)).map(|b| &**b)
    }

    /// All chunks as (cx, cy, z, chunk).
    pub fn chunks(&self) -> impl Iterator<Item = (u32, u32, u8, &Chunk)> {
        self.chunks.iter().map(|(k, c)| (k >> 15, (k >> 4) & 0x7FF, (k & 0xF) as u8, &**c))
    }

    /// Iterate every tile with its position (unordered).
    pub fn tiles(&self) -> impl Iterator<Item = (Position, &Tile)> {
        self.chunks().flat_map(|(cx, cy, z, c)| {
            c.iter().map(move |(lx, ly, t)| (Position::new(((cx << CHUNK_BITS) + lx) as u16, ((cy << CHUNK_BITS) + ly) as u16, z), t))
        })
    }

    pub fn house(&self, id: u32) -> Option<&House> {
        self.houses.iter().find(|h| h.id == id)
    }

    pub fn town(&self, id: u32) -> Option<&Town> {
        self.towns.iter().find(|t| t.id == id)
    }

    pub fn clear(&mut self) {
        *self = Map::new();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    #[test]
    fn set_get_remove() {
        let mut m = Map::new();
        let p = Position::new(1000, 2000, 7);
        let mut t = Tile::new();
        t.ground = Some(Item::new(4526));
        m.set_tile(p, t);
        assert_eq!(m.tile_count(), 1);
        assert_eq!(m.get(p).unwrap().ground.as_ref().unwrap().id, 4526);
        assert!(m.get(Position::new(1001, 2000, 7)).is_none());
        let tiles: Vec<_> = m.tiles().map(|(p, _)| p).collect();
        assert_eq!(tiles, vec![p]);
        m.swap_tile(p, None);
        assert_eq!(m.tile_count(), 0);
        assert!(m.chunks().next().is_none());
    }

    #[test]
    fn chunk_key_roundtrip() {
        let m = {
            let mut m = Map::new();
            m.set_tile(Position::new(65535, 65535, 15), Tile { flags: 1, ..Tile::new() });
            m
        };
        let (p, _) = m.tiles().next().unwrap();
        assert_eq!(p, Position::new(65535, 65535, 15));
    }
}
