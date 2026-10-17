//! Doodad brush. Port of RME `doodad_brush.cpp` + `GUI::FillDoodadPreviewBuffer`.

use crate::item::Item;
use crate::materials::{BrushId, BrushKind, DoodadAlternative, DoodadBrush, Materials};

/// A generated doodad placement, relative to the cursor: (dx, dy, dz, items).
pub type DoodadBuffer = Vec<(i32, i32, i32, Vec<Item>)>;

pub fn doodad(mat: &Materials, b: BrushId) -> Option<&DoodadBrush> {
    match &mat.brush(b)?.kind {
        BrushKind::Doodad(d) => Some(d),
        _ => None,
    }
}

fn alternative(d: &DoodadBrush, variation: usize) -> Option<&DoodadAlternative> {
    if d.alternatives.is_empty() {
        None
    } else {
        d.alternatives.get(variation % d.alternatives.len())
    }
}

fn pick_single(alt: &DoodadAlternative) -> Option<Item> {
    if alt.single_chance == 0 {
        return None;
    }
    let mut roll = fastrand::u32(1..=alt.single_chance);
    for (item, c) in &alt.singles {
        if roll <= *c {
            return Some(item.clone());
        }
        roll -= c;
    }
    None
}

fn pick_composite(alt: &DoodadAlternative) -> Option<&[(i32, i32, i32, Vec<Item>)]> {
    if alt.composite_chance == 0 {
        return None;
    }
    let roll = fastrand::u32(1..=alt.composite_chance);
    alt.composites.iter().find(|c| roll <= c.chance).map(|c| c.tiles.as_slice())
}

fn add_to(buf: &mut DoodadBuffer, dx: i32, dy: i32, dz: i32, items: impl IntoIterator<Item = Item>) {
    if let Some(e) = buf.iter_mut().find(|e| e.0 == dx && e.1 == dy && e.2 == dz) {
        e.3.extend(items);
    } else {
        buf.push((dx, dy, dz, items.into_iter().collect()));
    }
}

fn occupied(buf: &DoodadBuffer, dx: i32, dy: i32, dz: i32) -> bool {
    buf.iter().any(|e| e.0 == dx && e.1 == dy && e.2 == dz && !e.3.is_empty())
}

/// Generate a doodad placement for the current brush size/shape (RME preview buffer).
pub fn fill_buffer(d: &DoodadBrush, variation: usize, size: i32, circle: bool) -> DoodadBuffer {
    let mut buf = DoodadBuffer::new();
    let Some(alt) = alternative(d, variation) else { return buf };
    let total = alt.composite_chance + alt.single_chance;

    if size > 0 && !d.one_size {
        let area = if circle {
            if size == 1 { 5 } else { (0.5 + (size * size) as f32 * std::f32::consts::PI) as i32 }
        } else {
            let a = 2 * size;
            a * a + 1
        };
        let range = d.thickness * area / d.thickness_ceiling.max(1);
        let target = (range + fastrand::i32(0..=range.max(0))).max(1);
        for _ in 0..target {
            for _retry in 0..5 {
                let (mut xp, mut yp) = (0, 0);
                let mut found = !circle;
                if circle {
                    for _ in 0..5 {
                        xp = fastrand::i32(-size..=size);
                        yp = fastrand::i32(-size..=size);
                        if (((xp * xp + yp * yp) as f32).sqrt()) < size as f32 + 0.005 {
                            found = true;
                            break;
                        }
                    }
                } else {
                    xp = fastrand::i32(-size..=size);
                    yp = fastrand::i32(-size..=size);
                }
                if !found {
                    continue;
                }
                if fastrand::u32(0..=total) <= alt.composite_chance && alt.composite_chance > 0 {
                    let Some(comp) = pick_composite(alt) else { break };
                    if comp.iter().any(|(x, y, z, _)| occupied(&buf, x + xp, y + yp, *z)) {
                        break;
                    }
                    for (x, y, z, items) in comp {
                        add_to(&mut buf, x + xp, y + yp, *z, items.iter().cloned());
                    }
                    break;
                } else if alt.single_chance > 0 {
                    if occupied(&buf, xp, yp, 0) {
                        break;
                    }
                    if let Some(it) = pick_single(alt) {
                        add_to(&mut buf, xp, yp, 0, [it]);
                    }
                    break;
                }
            }
        }
    } else if alt.composite_chance > 0 && fastrand::u32(0..=total) <= alt.composite_chance {
        if let Some(comp) = pick_composite(alt) {
            for (x, y, z, items) in comp {
                add_to(&mut buf, *x, *y, *z, items.iter().cloned());
            }
        }
    } else if let Some(it) = pick_single(alt) {
        add_to(&mut buf, 0, 0, 0, [it]);
    }
    buf
}

/// True if any item of `items` belongs to this doodad brush.
pub fn owns_any(mat: &Materials, brush: BrushId, items: &[Item]) -> bool {
    items.iter().any(|i| mat.info(i.id).doodad == brush)
}
