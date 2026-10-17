//! Wall brush + automatic wall alignment. Port of RME `wall_brush.cpp`.

use crate::brush_tables::{FULL_BORDER_TYPES, HALF_BORDER_TYPES};
use crate::item::Item;
use crate::items::ItemDb;
use crate::source::TileSource;
use crate::materials::{wall, BrushId, Materials, WallNode};
use crate::position::Position;
use crate::tile::Tile;

fn pick(node: &WallNode) -> Option<u16> {
    if node.total_chance == 0 {
        return None;
    }
    let chance = fastrand::u32(1..=node.total_chance);
    node.items.iter().find(|(_, c)| chance <= *c).map(|(id, _)| *id)
}

/// Like `pick`, but falls back to the first item when the node has no chances.
fn pick_or_first(node: &WallNode) -> Option<u16> {
    if node.total_chance == 0 {
        node.items.first().map(|(id, _)| *id)
    } else {
        pick(node)
    }
}

/// Remove wall items (optionally only those belonging to `brush`).
pub fn clean_walls(mat: &Materials, tile: &mut Tile, brush: Option<BrushId>) {
    tile.items.retain(|i| {
        let info = mat.info(i.id);
        !(info.is_wall && brush.is_none_or(|b| info.brush == b))
    });
}

/// Place a wall item of the brush (any alignment; `do_walls` fixes it afterwards).
pub fn draw(db: &ItemDb, mat: &Materials, brush: BrushId, tile: &mut Tile) {
    clean_walls(mat, tile, Some(brush));
    let mut try_brush = brush;
    let mut id = None;
    while id.is_none() {
        let Some(w) = mat.wall(try_brush) else { return };
        id = w.nodes.iter().find_map(pick);
        try_brush = w.redirect_to;
        if try_brush == brush || try_brush == 0 {
            break;
        }
    }
    if let Some(id) = id {
        tile.add_item(db, Item::new(id));
    }
}

pub fn undraw(mat: &Materials, brush: BrushId, tile: &mut Tile) {
    clean_walls(mat, tile, Some(brush));
}

fn has_matching_wall<S: TileSource + ?Sized>(map: &S, mat: &Materials, brush: BrushId, x: i32, y: i32, z: u8) -> bool {
    let Some(t) = map.tile_xyz(x, y, z) else { return false };
    for item in &t.items {
        let info = mat.info(item.id);
        if info.is_wall {
            let wb = info.brush;
            if wb == brush || mat.wall_friend_of(brush, wb) || mat.wall_friend_of(wb, brush) {
                return !info.wall_hate_me;
            }
        }
    }
    false
}

/// RME `WallBrush::doWalls`: realign every wall on the tile according to its neighbours.
pub fn do_walls<S: TileSource + ?Sized>(map: &S, db: &ItemDb, mat: &Materials, pos: Position, tile: &mut Tile) {
    let (x, y, z) = (pos.x as i32, pos.y as i32, pos.z);
    let mut to_add: Vec<Item> = Vec::new();
    let mut i = tile.items.iter().take_while(|it| mat.info(it.id).is_border).count();

    while i < tile.items.len() {
        let info = mat.info(tile.items[i].id);
        if !info.is_wall || mat.wall(info.brush).is_none() {
            i += 1;
            continue;
        }
        let brush = info.brush;
        if mat.is_wall_decoration(brush) {
            to_add.push(tile.items.remove(i));
            continue;
        }
        let n = [
            has_matching_wall(map, mat, brush, x, y - 1, z),
            has_matching_wall(map, mat, brush, x - 1, y, z),
            has_matching_wall(map, mat, brush, x + 1, y, z),
            has_matching_wall(map, mat, brush, x, y + 1, z),
        ];
        let tiledata = n.iter().enumerate().fold(0usize, |acc, (k, &b)| acc | ((b as usize) << k));

        let mut exit = false;
        for pass in 0..2 {
            if exit {
                break;
            }
            let bt = if pass == 0 { FULL_BORDER_TYPES[tiledata] } else { HALF_BORDER_TYPES[tiledata] } as u8;
            let cur_align = mat.info(tile.items[i].id).alignment;
            if cur_align == wall::UNTOUCHABLE {
                to_add.push(tile.items.remove(i));
                exit = true;
            } else if cur_align == bt {
                to_add.push(tile.items.remove(i));
                exit = true;
                // Following decorations are realigned too.
                while i < tile.items.len() {
                    let dinfo = mat.info(tile.items[i].id);
                    if dinfo.is_wall && mat.is_wall_decoration(dinfo.brush) {
                        if dinfo.alignment == bt {
                            to_add.push(tile.items.remove(i));
                            continue;
                        }
                        if let Some(id) = mat.wall(dinfo.brush).and_then(|w| pick_or_first(&w.nodes[bt as usize])) {
                            to_add.push(Item::new(id));
                        }
                        i += 1;
                    } else {
                        break;
                    }
                }
            } else {
                let mut id = None;
                let mut try_brush = brush;
                let mut exhausted = false;
                loop {
                    let Some(w) = mat.wall(try_brush) else {
                        exhausted = true;
                        break;
                    };
                    let node = &w.nodes[bt as usize];
                    if node.total_chance == 0 && node.items.is_empty() {
                        try_brush = w.redirect_to;
                        if try_brush == brush || try_brush == 0 {
                            exhausted = true;
                            break;
                        }
                        continue;
                    }
                    id = pick_or_first(node);
                    break;
                }
                let Some(id) = id.filter(|_| !exhausted) else {
                    if pass == 1 {
                        i += 1;
                    }
                    continue;
                };
                to_add.push(Item::new(id));
                exit = true;
                i += 1;
                while i < tile.items.len() {
                    let dinfo = mat.info(tile.items[i].id);
                    if dinfo.is_wall && mat.is_wall_decoration(dinfo.brush) {
                        if let Some(id) = mat.wall(dinfo.brush).and_then(|w| pick_or_first(&w.nodes[bt as usize])) {
                            to_add.push(Item::new(id));
                        }
                        i += 1;
                    } else {
                        i += 1;
                        break;
                    }
                }
            }
        }
    }
    clean_walls(mat, tile, None);
    for it in to_add {
        tile.add_item(db, it);
    }
}

/// Wall decoration brush: add a matching decoration on top of every wall of the tile.
pub fn draw_decoration(db: &ItemDb, mat: &Materials, brush: BrushId, tile: &mut Tile) {
    let Some(deco) = mat.wall(brush) else { return };
    clean_walls(mat, tile, Some(brush));
    let mut i = 0;
    while i < tile.items.len() {
        let info = mat.info(tile.items[i].id);
        if info.is_border || !info.is_wall || mat.is_wall_decoration(info.brush) {
            i += 1;
            continue;
        }
        let align = info.alignment as usize;
        let id = if info.is_brush_door {
            let kind = mat.wall(info.brush).and_then(|w| w.doors.iter().flatten().find(|d| d.id == tile.items[i].id).map(|d| d.kind));
            deco.doors.get(align).and_then(|v| v.iter().find(|d| Some(d.kind) == kind && mat.info(d.id).is_open == info.is_open).or_else(|| v.iter().find(|d| Some(d.kind) == kind))).map(|d| d.id)
        } else {
            deco.nodes.get(align).and_then(pick)
        };
        if let Some(id) = id {
            tile.items.insert(i + 1, Item::new(id));
            i += 1;
        }
        i += 1;
    }
    let _ = db;
}
