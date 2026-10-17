//! PeixolaMapEditor core: map model, item database, materials (brush definitions),
//! brushes and undo history. No GPU / IO code lives here so everything is unit-testable.

pub mod brush_tables;
pub mod brushes;
pub mod editor;
pub mod gen;
pub mod history;
pub mod item;
pub mod items;
pub mod map;
pub mod materials;
pub mod position;
pub mod rng;
pub mod source;
pub mod staged;
pub mod tile;

pub use item::{Attr, Item};
pub use items::{ItemDb, ItemGroup, ItemType};
pub use map::{House, Map, Town, Waypoint};
pub use position::Position;
pub use tile::{Creature, Tile};

/// Floor index of the surface (sea level). Floors 0..=7 are above ground.
pub const GROUND_LAYER: u8 = 7;
pub const MAX_LAYER: u8 = 15;
