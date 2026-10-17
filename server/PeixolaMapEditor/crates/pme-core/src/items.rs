//! Item type database (items.otb + items.xml + Tibia.dat sprite metadata).

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
#[repr(u8)]
pub enum ItemGroup {
    #[default]
    None = 0,
    Ground,
    Container,
    Weapon,
    Ammunition,
    Armor,
    Rune,
    Teleport,
    MagicField,
    Writeable,
    Key,
    Splash,
    Fluid,
    Door,
    Deprecated,
    Podium,
}

impl ItemGroup {
    pub fn from_u8(v: u8) -> Self {
        use ItemGroup::*;
        match v {
            1 => Ground,
            2 => Container,
            3 => Weapon,
            4 => Ammunition,
            5 => Armor,
            6 => Rune,
            7 => Teleport,
            8 => MagicField,
            9 => Writeable,
            10 => Key,
            11 => Splash,
            12 => Fluid,
            13 => Door,
            14 => Deprecated,
            15 => Podium,
            _ => None,
        }
    }
}

/// items.otb flag bits.
pub mod otb_flags {
    pub const UNPASSABLE: u32 = 1 << 0;
    pub const BLOCK_MISSILES: u32 = 1 << 1;
    pub const BLOCK_PATHFINDER: u32 = 1 << 2;
    pub const HAS_ELEVATION: u32 = 1 << 3;
    pub const USEABLE: u32 = 1 << 4;
    pub const PICKUPABLE: u32 = 1 << 5;
    pub const MOVEABLE: u32 = 1 << 6;
    pub const STACKABLE: u32 = 1 << 7;
    pub const FLOORCHANGEDOWN: u32 = 1 << 8;
    pub const ALWAYSONTOP: u32 = 1 << 13;
    pub const READABLE: u32 = 1 << 14;
    pub const ROTABLE: u32 = 1 << 15;
    pub const HANGABLE: u32 = 1 << 16;
    pub const HOOK_EAST: u32 = 1 << 17;
    pub const HOOK_SOUTH: u32 = 1 << 18;
    pub const CLIENTCHARGES: u32 = 1 << 22;
}

/// Sprite metadata from Tibia.dat for one client id.
#[derive(Clone, Debug, Default)]
pub struct SpriteInfo {
    pub width: u8,
    pub height: u8,
    pub layers: u8,
    pub pattern_x: u8,
    pub pattern_y: u8,
    pub pattern_z: u8,
    pub frames: u8,
    /// Displacement (draw offset) in pixels.
    pub offset_x: u16,
    pub offset_y: u16,
    /// Elevation in pixels (stacks with following items on the tile).
    pub elevation: u16,
    pub minimap_color: u16,
    pub has_minimap_color: bool,
    pub light_level: u16,
    pub light_color: u16,
    pub is_ground: bool,
    pub is_fluid: bool,
    pub is_splash: bool,
    pub is_stackable: bool,
    pub is_hangable: bool,
    pub is_hook_south: bool,
    pub is_hook_east: bool,
    pub animate_always: bool,
    pub sprite_ids: Vec<u32>,
}

impl SpriteInfo {
    #[inline]
    pub fn num_sprites(&self) -> usize {
        self.sprite_ids.len()
    }

    /// Same as RME `GameSprite::getHardwareID` index computation.
    pub fn sprite_index(&self, cx: u32, cy: u32, layer: u32, subtype: i32, px: u32, py: u32, pz: u32, frame: u32) -> usize {
        let w = self.width.max(1) as u32;
        let h = self.height.max(1) as u32;
        let layers = self.layers.max(1) as u32;
        let pxn = self.pattern_x.max(1) as u32;
        let pyn = self.pattern_y.max(1) as u32;
        let pzn = self.pattern_z.max(1) as u32;
        let frames = self.frames.max(1) as u32;
        let v = if subtype >= 0 && h <= 1 && w <= 1 {
            subtype as u32
        } else {
            ((((((frame % frames) * pzn + pz % pzn) * pyn + py % pyn) * pxn + px % pxn) * layers + layer) * h + cy) * w + cx
        } as usize;
        let n = self.sprite_ids.len();
        if n == 0 {
            0
        } else if v >= n {
            if n == 1 { 0 } else { v % n }
        } else {
            v
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ItemType {
    pub id: u16,
    pub client_id: u16,
    pub group: ItemGroup,
    pub flags: u32,
    pub top_order: u8,
    pub name: String,
    /// items.xml "type" (door, teleport, depot, container, ...).
    pub xml_type: String,
    pub valid: bool,
}

impl ItemType {
    #[inline]
    pub fn is_ground(&self) -> bool {
        self.group == ItemGroup::Ground
    }
    #[inline]
    pub fn has(&self, flag: u32) -> bool {
        self.flags & flag != 0
    }
    #[inline]
    pub fn is_stackable(&self) -> bool {
        self.has(otb_flags::STACKABLE)
    }
    #[inline]
    pub fn is_splash(&self) -> bool {
        self.group == ItemGroup::Splash
    }
    #[inline]
    pub fn is_fluid(&self) -> bool {
        self.group == ItemGroup::Fluid
    }
    /// Items that store a subtype/count in the map file.
    #[inline]
    pub fn has_subtype(&self) -> bool {
        self.is_stackable() || self.is_splash() || self.is_fluid()
    }
    #[inline]
    pub fn always_on_top(&self) -> bool {
        self.has(otb_flags::ALWAYSONTOP)
    }
    #[inline]
    pub fn is_blocking(&self) -> bool {
        self.has(otb_flags::UNPASSABLE)
    }
    #[inline]
    pub fn is_container(&self) -> bool {
        self.group == ItemGroup::Container
    }
    #[inline]
    pub fn is_teleport(&self) -> bool {
        self.group == ItemGroup::Teleport || self.xml_type.eq_ignore_ascii_case("teleport")
    }
    #[inline]
    pub fn is_door(&self) -> bool {
        self.group == ItemGroup::Door || self.xml_type.eq_ignore_ascii_case("door")
    }
    #[inline]
    pub fn is_depot(&self) -> bool {
        self.xml_type.eq_ignore_ascii_case("depot")
    }
}

/// The complete item database, indexed by server id.
#[derive(Default)]
pub struct ItemDb {
    pub items: Vec<ItemType>,
    /// Sprite metadata indexed by client id.
    pub sprites: Vec<SpriteInfo>,
    /// Outfit sprite metadata indexed by looktype.
    pub outfits: Vec<SpriteInfo>,
    pub otb_major: u32,
    pub otb_minor: u32,
    pub otb_build: u32,
    pub max_id: u16,
}

impl ItemDb {
    #[inline]
    pub fn get(&self, id: u16) -> Option<&ItemType> {
        self.items.get(id as usize).filter(|t| t.valid)
    }

    #[inline]
    pub fn sprite(&self, id: u16) -> Option<&SpriteInfo> {
        let t = self.get(id)?;
        self.sprites.get(t.client_id as usize).filter(|s| !s.sprite_ids.is_empty())
    }

    #[inline]
    pub fn is_ground(&self, id: u16) -> bool {
        self.get(id).is_some_and(|t| t.is_ground())
    }

    pub fn name(&self, id: u16) -> &str {
        self.get(id).map(|t| t.name.as_str()).unwrap_or("")
    }

    /// Minimap colour (8-bit Tibia palette index) of an item, if any.
    pub fn minimap_color(&self, id: u16) -> Option<u8> {
        let s = self.sprite(id)?;
        s.has_minimap_color.then_some(s.minimap_color as u8)
    }
}
