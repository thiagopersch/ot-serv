use crate::item::Item;
use crate::items::ItemDb;
use crate::position::Position;

/// Persistent tile map flags (identical bits in RME and TFS 0.4).
pub mod flags {
    pub const PROTECTION_ZONE: u32 = 0x01;
    pub const NO_PVP: u32 = 0x04;
    pub const NO_LOGOUT: u32 = 0x08;
    pub const PVP_ZONE: u32 = 0x10;
    pub const REFRESH: u32 = 0x20;
    /// The server keeps only one of these per tile.
    pub const EXCLUSIVE: u32 = PROTECTION_ZONE | NO_PVP | PVP_ZONE;
}

/// A creature placed on the map (saved to the spawn XML).
#[derive(Clone, PartialEq, Debug)]
pub struct Creature {
    pub name: String,
    pub spawn_time: u32,
    pub direction: u8,
    pub is_npc: bool,
}

#[derive(Clone, PartialEq, Debug)]
pub struct Tile {
    pub ground: Option<Item>,
    /// Bottom to top. Borders first (as in RME).
    pub items: Vec<Item>,
    pub house_id: u32,
    /// OTBM tile flags (see [`flags`]).
    pub flags: u32,
    /// Spawn centred on this tile (radius); 0 = no spawn.
    pub spawn_radius: u16,
    pub creature: Option<Box<Creature>>,
}

impl Tile {
    pub const fn new() -> Self {
        Self { ground: None, items: Vec::new(), house_id: 0, flags: 0, spawn_radius: 0, creature: None }
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.ground.is_none() && self.items.is_empty() && self.house_id == 0 && self.flags == 0 && self.spawn_radius == 0 && self.creature.is_none()
    }

    #[inline]
    pub fn item_count(&self) -> usize {
        self.items.len() + self.ground.is_some() as usize
    }

    /// Insert an item following RME `Tile::addItem` ordering rules.
    pub fn add_item(&mut self, db: &ItemDb, item: Item) {
        let Some(t) = db.get(item.id) else {
            self.items.push(item);
            return;
        };
        if t.is_ground() {
            self.ground = Some(item);
            return;
        }
        let pos = if t.always_on_top() {
            let order = t.top_order;
            self.items
                .iter()
                .position(|it| {
                    let ot = db.get(it.id);
                    match ot {
                        Some(o) if o.always_on_top() => order < o.top_order,
                        _ => true,
                    }
                })
                .unwrap_or(self.items.len())
        } else {
            self.items.len()
        };
        self.items.insert(pos, item);
    }

    pub fn is_blocking(&self, db: &ItemDb) -> bool {
        if self.ground.is_none() && self.items.is_empty() {
            return true;
        }
        self.ground.iter().chain(self.items.iter()).any(|i| db.get(i.id).is_some_and(|t| t.is_blocking()))
    }

    /// Topmost minimap colour.
    pub fn minimap_color(&self, db: &ItemDb) -> Option<u8> {
        self.items.iter().rev().chain(self.ground.iter()).find_map(|i| db.minimap_color(i.id))
    }

    pub fn has_hook(&self, db: &ItemDb, flag: u32) -> bool {
        self.ground.iter().chain(self.items.iter()).any(|i| db.get(i.id).is_some_and(|t| t.has(flag)))
    }

    pub fn mem_size(&self) -> usize {
        std::mem::size_of::<Tile>() + self.ground.as_ref().map_or(0, Item::mem_size) + self.items.iter().map(Item::mem_size).sum::<usize>()
    }
}

impl Default for Tile {
    fn default() -> Self {
        Self::new()
    }
}

/// A tile together with its position (used by copy buffers and brush previews).
#[derive(Clone, Debug)]
pub struct PlacedTile {
    pub pos: Position,
    pub tile: Tile,
}
