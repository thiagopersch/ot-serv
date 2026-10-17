//! Read access to tiles, shared by the real [`Map`] and a [`crate::staged::Staged`] preview
//! layer, so auto-border / wall / carpet / table logic can run on either.

use crate::map::Map;
use crate::position::Position;
use crate::tile::Tile;

pub trait TileSource {
    fn tile(&self, pos: Position) -> Option<&Tile>;

    /// Like [`TileSource::tile`] with signed coordinates (out of range → `None`).
    #[inline]
    fn tile_xyz(&self, x: i32, y: i32, z: u8) -> Option<&Tile> {
        if !(0..=0xFFFF).contains(&x) || !(0..=0xFFFF).contains(&y) {
            return None;
        }
        self.tile(Position::new(x as u16, y as u16, z))
    }
}

impl TileSource for Map {
    #[inline]
    fn tile(&self, pos: Position) -> Option<&Tile> {
        self.get(pos)
    }
}
