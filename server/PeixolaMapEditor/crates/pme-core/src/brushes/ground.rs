//! Ground brush + automatic borders. Port of RME `ground_brush.cpp` (`draw`, `getBrushTo`,
//! `doBorders`).

use crate::brush_tables::BORDER_TYPES;
use crate::item::Item;
use crate::source::TileSource;
use crate::materials::{border, BorderBlock, BrushId, Materials, BRUSH_ALL};
use crate::position::Position;
use crate::tile::Tile;

/// Pick a random ground item of the brush (cumulative chances).
pub fn random_item(mat: &Materials, brush: BrushId) -> Option<u16> {
    let g = mat.ground(brush)?;
    let first = g.items.first()?.0;
    if g.total_chance == 0 || !g.randomize {
        return Some(first);
    }
    let chance = fastrand::u32(1..=g.total_chance);
    Some(g.items.iter().find(|(_, c)| chance < *c).map(|(id, _)| *id).unwrap_or(first))
}

pub fn draw(mat: &Materials, brush: BrushId, tile: &mut Tile) {
    if let Some(id) = random_item(mat, brush) {
        tile.ground = Some(Item::new(id));
    }
}

pub fn undraw(mat: &Materials, brush: BrushId, tile: &mut Tile) {
    if tile.ground.as_ref().is_some_and(|g| mat.ground_brush_of(g.id) == brush) {
        tile.ground = None;
    }
}

#[inline]
fn brush_at<S: TileSource + ?Sized>(map: &S, mat: &Materials, x: i32, y: i32, z: u8) -> BrushId {
    map.tile_xyz(x, y, z).and_then(|t| t.ground.as_ref()).map_or(0, |g| mat.ground_brush_of(g.id))
}

/// RME `GroundBrush::getBrushTo`.
fn brush_to(mat: &Materials, first: BrushId, second: BrushId) -> Option<&BorderBlock> {
    let fg = mat.ground(first);
    let sg = mat.ground(second);
    match (fg, sg) {
        (Some(f), Some(s)) => {
            if f.z_order < s.z_order && s.has_outer_border {
                if f.has_inner_border {
                    if let Some(bb) = f.borders.iter().find(|bb| !bb.outer && (bb.to == second || bb.to == BRUSH_ALL)) {
                        return Some(bb);
                    }
                }
                s.borders.iter().find(|bb| bb.outer && (bb.to == first || bb.to == BRUSH_ALL))
            } else if f.has_inner_border {
                f.borders.iter().find(|bb| !bb.outer && (bb.to == second || bb.to == BRUSH_ALL))
            } else {
                None
            }
        }
        (Some(f), None) if f.has_inner_zilch_border => f.borders.iter().find(|bb| !bb.outer && bb.to == 0),
        (None, Some(s)) if s.has_outer_zilch_border => s.borders.iter().find(|bb| bb.outer && bb.to == 0),
        _ => None,
    }
}

fn push_specific<'a>(v: &mut Vec<&'a BorderBlock>, bb: &'a BorderBlock) {
    if !bb.specific_cases.is_empty() && !v.iter().any(|x| std::ptr::eq(*x, bb)) {
        v.push(bb);
    }
}

struct Cluster {
    alignment: u32,
    z: i32,
    border: Option<usize>,
}

/// Remove border items at the bottom of the stack (RME `Tile::cleanBorders`).
pub fn clean_borders(mat: &Materials, tile: &mut Tile) {
    let n = tile.items.iter().take_while(|i| mat.info(i.id).is_border).count();
    tile.items.drain(..n);
}

/// Recompute the borders of `tile` (located at `pos`), reading neighbours from `map`.
pub fn do_borders<S: TileSource + ?Sized>(map: &S, mat: &Materials, pos: Position, tile: &mut Tile) {
    let x = pos.x as i32;
    let y = pos.y as i32;
    let z = pos.z;
    let own = tile.ground.as_ref().map_or(0, |g| mat.ground_brush_of(g.id));
    let own_g = mat.ground(own);

    const OFFS: [(i32, i32); 8] = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)];
    let mut neighbours: [(bool, BrushId); 8] = [(false, 0); 8];
    for (i, (dx, dy)) in OFFS.iter().enumerate() {
        neighbours[i].1 = brush_at(map, mat, x + dx, y + dy, z);
    }

    let mut has_optional = tile.items.iter().any(|i| mat.info(i.id).is_optional_border);
    let mut specific: Vec<&BorderBlock> = Vec::new();
    let mut clusters: Vec<Cluster> = Vec::new();

    for i in 0..8 {
        if neighbours[i].0 {
            continue;
        }
        let other = neighbours[i].1;
        let other_g = mat.ground(other);
        if let Some(own_brush) = own_g {
            if let Some(og) = other_g {
                if other == own {
                    continue;
                }
                if og.has_outer_border || own_brush.has_inner_border {
                    let mut only_mountain = false;
                    if mat.ground_friend_of(other, own) || mat.ground_friend_of(own, other) {
                        if og.optional_border.is_none() {
                            continue;
                        }
                        only_mountain = true;
                    }
                    let mut tiledata = 0u32;
                    for (j, n) in neighbours.iter_mut().enumerate().skip(i) {
                        if !n.0 && n.1 == other {
                            n.0 = true;
                            tiledata |= 1 << j;
                        }
                    }
                    if tiledata != 0 {
                        if og.optional_border.is_some() && has_optional {
                            clusters.push(Cluster { alignment: tiledata, z: 0x7FFF_FFFF, border: og.optional_border });
                            if og.use_only_optional {
                                only_mountain = true;
                            }
                        }
                        if !only_mountain {
                            if let Some(bb) = brush_to(mat, own, other) {
                                if let Some(c) = clusters.iter_mut().find(|c| c.border == bb.autoborder) {
                                    c.alignment |= tiledata;
                                    c.z = c.z.max(og.z_order);
                                } else {
                                    clusters.push(Cluster { alignment: tiledata, z: og.z_order, border: bb.autoborder });
                                }
                                push_specific(&mut specific, bb);
                            }
                        }
                    }
                }
            } else if own_brush.has_inner_zilch_border {
                let mut tiledata = 0u32;
                for (j, n) in neighbours.iter_mut().enumerate().skip(i) {
                    if !n.0 && mat.ground(n.1).is_none() {
                        n.0 = true;
                        tiledata |= 1 << j;
                    }
                }
                if tiledata != 0 {
                    let Some(bb) = brush_to(mat, own, 0) else { continue };
                    if bb.autoborder.is_some() {
                        clusters.push(Cluster { alignment: tiledata, z: 5000, border: bb.autoborder });
                    }
                    push_specific(&mut specific, bb);
                }
                continue;
            }
        } else if let Some(og) = other_g.filter(|g| g.has_outer_zilch_border) {
            let mut tiledata = 0u32;
            for (j, n) in neighbours.iter_mut().enumerate().skip(i) {
                if !n.0 && n.1 == other {
                    n.0 = true;
                    tiledata |= 1 << j;
                }
            }
            if tiledata != 0 {
                if let Some(bb) = brush_to(mat, 0, other) {
                    if bb.autoborder.is_some() {
                        clusters.push(Cluster { alignment: tiledata, z: og.z_order, border: bb.autoborder });
                    }
                    push_specific(&mut specific, bb);
                }
                if og.optional_border.is_some() && has_optional {
                    clusters.push(Cluster { alignment: tiledata, z: 0x7FFF_FFFF, border: og.optional_border });
                } else {
                    has_optional = false;
                }
            }
        }
        neighbours[i].0 = true;
    }

    // RME sorts ascending by z and then consumes from the back (highest z first),
    // inserting each border at the bottom of the stack.
    clusters.sort_by_key(|c| c.z);
    clean_borders(mat, tile);
    let mut new_borders: Vec<Item> = Vec::new();
    while let Some(c) = clusters.pop() {
        let Some(ab) = c.border.and_then(|b| mat.borders.get(b)) else { continue };
        let bt = BORDER_TYPES[(c.alignment & 0xFF) as usize];
        for k in 0..4 {
            let dir = ((bt >> (k * 8)) & 0xFF) as u8;
            if dir == border::NONE {
                break;
            }
            let id = ab.tiles[dir as usize];
            if id != 0 {
                new_borders.insert(0, Item::new(id));
            } else {
                let pair = match dir {
                    border::NW_DIAGONAL => [border::WEST, border::NORTH],
                    border::NE_DIAGONAL => [border::EAST, border::NORTH],
                    border::SW_DIAGONAL => [border::SOUTH, border::WEST],
                    border::SE_DIAGONAL => [border::SOUTH, border::EAST],
                    _ => continue,
                };
                for d in pair {
                    let id = ab.tiles[d as usize];
                    if id != 0 {
                        new_borders.insert(0, Item::new(id));
                    }
                }
            }
        }
    }
    // Insert borders at the bottom of the item stack, preserving the order computed above.
    let rest = std::mem::take(&mut tile.items);
    tile.items = new_borders;
    tile.items.extend(rest);

    apply_specific_cases(mat, tile, &specific);
}

fn apply_specific_cases(mat: &Materials, tile: &mut Tile, specific: &[&BorderBlock]) {
    for bb in specific {
        for sc in &bb.specific_cases {
            let mut matches = 0usize;
            for item in &tile.items {
                let info = mat.info(item.id);
                if !info.is_border {
                    break;
                }
                if sc.match_group > 0 && info.border_group == sc.match_group && info.alignment == sc.group_match_alignment {
                    matches += 1;
                    continue;
                }
                matches += sc.items_to_match.iter().filter(|&&m| m == item.id).count();
            }
            if matches < sc.items_to_match.len() {
                continue;
            }
            let mut replaced = sc.delete_all;
            let mut i = 0;
            while i < tile.items.len() {
                if !mat.info(tile.items[i].id).is_border {
                    i += 1;
                    continue;
                }
                let id = tile.items[i].id;
                let mut removed = false;
                for &m in &sc.items_to_match {
                    if id == m {
                        if !replaced && id == sc.to_replace_id {
                            tile.items[i].id = sc.with_id;
                            replaced = true;
                        } else if sc.delete_all || !sc.keep_border {
                            tile.items.remove(i);
                            removed = true;
                            break;
                        }
                    }
                }
                if !removed {
                    i += 1;
                }
            }
        }
    }
}
