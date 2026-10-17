//! Brushes. Each module is a port of the matching RME brush; the editor (`crate::editor`)
//! drives them the same way RME `Editor::drawInternal` does (draw pass, then border pass).

pub mod carpet_table;
pub mod doodad;
pub mod ground;
pub mod wall;

use crate::materials::BrushId;

/// What the user is painting with.
#[derive(Clone, PartialEq, Debug)]
pub enum Brush {
    /// Place a single item id (RME RAW brush).
    Raw(u16),
    /// A materials brush (ground, wall, wall decoration, doodad, carpet, table).
    Material(BrushId),
    /// Left click removes items (keeps ground), right click removes everything.
    Eraser,
    /// Tile flag(s): PZ, No-PvP, No-Logout, PvP zone.
    Zone(u32),
    House(u32),
    HouseExit(u32),
    /// Spawn area; radius comes from the brush size.
    Spawn,
    Creature { name: String, npc: bool },
    Waypoint(String),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BrushShape {
    Square,
    Circle,
}

/// Positions covered by a brush of radius `size` (0 = single tile) around `cx, cy`.
pub fn area(cx: i32, cy: i32, size: i32, shape: BrushShape) -> Vec<(i32, i32)> {
    let mut v = Vec::with_capacity(((2 * size + 1) * (2 * size + 1)) as usize);
    for dy in -size..=size {
        for dx in -size..=size {
            if shape == BrushShape::Circle {
                let d = ((dx * dx + dy * dy) as f32).sqrt();
                if d >= size as f32 + 0.005 {
                    continue;
                }
            }
            v.push((cx + dx, cy + dy));
        }
    }
    v
}
