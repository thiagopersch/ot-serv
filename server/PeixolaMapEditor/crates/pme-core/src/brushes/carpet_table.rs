//! Carpet and table brushes. Port of RME `carpet_brush.cpp` / `table_brush.cpp`.

use crate::brush_tables::{CARPET_TYPES, TABLE_TYPES};
use crate::item::Item;
use crate::items::ItemDb;
use crate::source::TileSource;
use crate::materials::{border, table, BrushId, BrushKind, Materials, WeightedNode};
use crate::position::Position;
use crate::tile::Tile;

fn pick(node: &WeightedNode) -> Option<u16> {
    if node.total_chance == 0 {
        return None;
    }
    let mut chance = fastrand::u32(1..=node.total_chance);
    for &(id, c) in &node.items {
        if chance <= c {
            return Some(id);
        }
        chance -= c;
    }
    None
}

fn carpet_nodes(mat: &Materials, b: BrushId) -> Option<&[WeightedNode]> {
    match &mat.brush(b)?.kind {
        BrushKind::Carpet(c) => Some(&c.nodes),
        _ => None,
    }
}

fn table_nodes(mat: &Materials, b: BrushId) -> Option<&[WeightedNode]> {
    match &mat.brush(b)?.kind {
        BrushKind::Table(t) => Some(&t.nodes),
        _ => None,
    }
}

/// RME `CarpetBrush::getRandomCarpet`.
fn random_carpet(nodes: &[WeightedNode], alignment: u8) -> Option<u16> {
    if let Some(id) = nodes.get(alignment as usize).and_then(pick) {
        return Some(id);
    }
    if alignment != border::CARPET_CENTER {
        if let Some(id) = nodes.get(border::CARPET_CENTER as usize).and_then(pick) {
            return Some(id);
        }
    }
    nodes.iter().take(12).find_map(pick)
}

pub fn draw_carpet(db: &ItemDb, mat: &Materials, brush: BrushId, tile: &mut Tile) {
    undraw_carpet(mat, tile);
    if let Some(id) = carpet_nodes(mat, brush).and_then(|n| random_carpet(n, border::CARPET_CENTER)) {
        tile.add_item(db, Item::new(id));
    }
}

pub fn undraw_carpet(mat: &Materials, tile: &mut Tile) {
    tile.items.retain(|i| !mat.info(i.id).is_carpet);
}

pub fn draw_table(db: &ItemDb, mat: &Materials, brush: BrushId, tile: &mut Tile) {
    undraw_table(mat, tile);
    let Some(nodes) = table_nodes(mat, brush) else { return };
    let id = nodes.get(table::ALONE as usize).and_then(pick).or_else(|| nodes.iter().find_map(pick));
    if let Some(id) = id {
        tile.add_item(db, Item::new(id));
    }
}

pub fn undraw_table(mat: &Materials, tile: &mut Tile) {
    tile.items.retain(|i| !mat.info(i.id).is_table);
}

fn neighbour_mask<S: TileSource + ?Sized>(map: &S, pos: Position, mut matches: impl FnMut(&Tile) -> bool) -> usize {
    const OFFS: [(i32, i32); 8] = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)];
    let mut mask = 0;
    for (k, (dx, dy)) in OFFS.iter().enumerate() {
        if map.tile_xyz(pos.x as i32 + dx, pos.y as i32 + dy, pos.z).is_some_and(&mut matches) {
            mask |= 1 << k;
        }
    }
    mask
}

pub fn do_carpets<S: TileSource + ?Sized>(map: &S, mat: &Materials, pos: Position, tile: &mut Tile) {
    for i in 0..tile.items.len() {
        let info = mat.info(tile.items[i].id);
        if !info.is_carpet {
            continue;
        }
        let brush = info.brush;
        let Some(nodes) = carpet_nodes(mat, brush) else { continue };
        let mask = neighbour_mask(map, pos, |t| t.items.iter().any(|it| mat.info(it.id).is_carpet && mat.info(it.id).brush == brush));
        if let Some(id) = random_carpet(nodes, CARPET_TYPES[mask] as u8) {
            tile.items[i].id = id;
        }
    }
}

pub fn do_tables<S: TileSource + ?Sized>(map: &S, mat: &Materials, pos: Position, tile: &mut Tile) {
    for i in 0..tile.items.len() {
        let info = mat.info(tile.items[i].id);
        if !info.is_table {
            continue;
        }
        let brush = info.brush;
        let Some(nodes) = table_nodes(mat, brush) else { continue };
        let mask = neighbour_mask(map, pos, |t| t.items.iter().any(|it| mat.info(it.id).is_table && mat.info(it.id).brush == brush));
        if let Some(id) = nodes.get(TABLE_TYPES[mask] as usize).and_then(pick) {
            tile.items[i].id = id;
        }
    }
}
