//! Brush definitions loaded from RME's materials XML (borders, grounds, walls, doodads,
//! carpets, tables, tilesets). The XML parser lives in `pme-io`.

use ahash::AHashMap;

use crate::item::Item;

/// Border/carpet alignment indices (RME `BorderType`).
pub mod border {
    pub const NONE: u8 = 0;
    pub const NORTH: u8 = 1;
    pub const EAST: u8 = 2;
    pub const SOUTH: u8 = 3;
    pub const WEST: u8 = 4;
    pub const NW_CORNER: u8 = 5;
    pub const NE_CORNER: u8 = 6;
    pub const SW_CORNER: u8 = 7;
    pub const SE_CORNER: u8 = 8;
    pub const NW_DIAGONAL: u8 = 9;
    pub const NE_DIAGONAL: u8 = 10;
    pub const SE_DIAGONAL: u8 = 11;
    pub const SW_DIAGONAL: u8 = 12;
    pub const CARPET_CENTER: u8 = 13;

    pub fn from_edge_name(s: &str) -> u8 {
        match s {
            "n" => NORTH,
            "w" => WEST,
            "s" => SOUTH,
            "e" => EAST,
            "cnw" => NW_CORNER,
            "cne" => NE_CORNER,
            "csw" => SW_CORNER,
            "cse" => SE_CORNER,
            "dnw" => NW_DIAGONAL,
            "dne" => NE_DIAGONAL,
            "dsw" => SW_DIAGONAL,
            "dse" => SE_DIAGONAL,
            _ => NONE,
        }
    }
}

pub mod wall {
    pub const POLE: u8 = 0;
    pub const SOUTH_END: u8 = 1;
    pub const EAST_END: u8 = 2;
    pub const NW_DIAGONAL: u8 = 3;
    pub const WEST_END: u8 = 4;
    pub const NE_DIAGONAL: u8 = 5;
    pub const HORIZONTAL: u8 = 6;
    pub const SOUTH_T: u8 = 7;
    pub const NORTH_END: u8 = 8;
    pub const VERTICAL: u8 = 9;
    pub const SW_DIAGONAL: u8 = 10;
    pub const EAST_T: u8 = 11;
    pub const SE_DIAGONAL: u8 = 12;
    pub const WEST_T: u8 = 13;
    pub const NORTH_T: u8 = 14;
    pub const INTERSECTION: u8 = 15;
    pub const UNTOUCHABLE: u8 = 16;
    pub const COUNT: usize = 17;

    pub fn from_name(s: &str) -> Option<u8> {
        Some(match s {
            "vertical" => VERTICAL,
            "horizontal" => HORIZONTAL,
            "corner" | "northwest diagonal" => NW_DIAGONAL,
            "pole" => POLE,
            "south end" => SOUTH_END,
            "east end" => EAST_END,
            "north end" => NORTH_END,
            "west end" => WEST_END,
            "south T" => SOUTH_T,
            "east T" => EAST_T,
            "west T" => WEST_T,
            "north T" => NORTH_T,
            "northeast diagonal" => NE_DIAGONAL,
            "southwest diagonal" => SW_DIAGONAL,
            "southeast diagonal" => SE_DIAGONAL,
            "intersection" => INTERSECTION,
            "untouchable" => UNTOUCHABLE,
            _ => return None,
        })
    }
}

pub mod table {
    pub const NORTH_END: u8 = 0;
    pub const SOUTH_END: u8 = 1;
    pub const EAST_END: u8 = 2;
    pub const WEST_END: u8 = 3;
    pub const HORIZONTAL: u8 = 4;
    pub const VERTICAL: u8 = 5;
    pub const ALONE: u8 = 6;
    pub const COUNT: usize = 7;
}

/// Brush ids are 1-based indices into [`Materials::brushes`]; 0 means "none".
pub type BrushId = u32;
/// `to="all"` in border blocks / `friend name="all"`.
pub const BRUSH_ALL: BrushId = u32::MAX;

#[derive(Clone, Debug, Default)]
pub struct AutoBorder {
    pub id: u32,
    pub group: u16,
    /// Item id per border alignment (index 0..=12).
    pub tiles: [u16; 13],
}

#[derive(Clone, Debug, Default)]
pub struct SpecificCase {
    pub items_to_match: Vec<u16>,
    pub match_group: u16,
    pub group_match_alignment: u8,
    pub to_replace_id: u16,
    pub with_id: u16,
    pub delete_all: bool,
    pub keep_border: bool,
}

#[derive(Clone, Debug, Default)]
pub struct BorderBlock {
    pub outer: bool,
    /// Target brush; 0 = none (zilch), BRUSH_ALL = all.
    pub to: BrushId,
    /// Index into [`Materials::borders`].
    pub autoborder: Option<usize>,
    pub specific_cases: Vec<SpecificCase>,
}

#[derive(Clone, Debug, Default)]
pub struct GroundBrush {
    pub z_order: i32,
    /// (item id, cumulative chance)
    pub items: Vec<(u16, u32)>,
    pub total_chance: u32,
    pub borders: Vec<BorderBlock>,
    pub friends: Vec<BrushId>,
    pub hate_friends: bool,
    pub optional_border: Option<usize>,
    pub use_only_optional: bool,
    pub randomize: bool,
    pub has_outer_border: bool,
    pub has_inner_border: bool,
    pub has_outer_zilch_border: bool,
    pub has_inner_zilch_border: bool,
}

#[derive(Clone, Debug, Default)]
pub struct WallNode {
    pub total_chance: u32,
    /// (item id, cumulative chance)
    pub items: Vec<(u16, u32)>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DoorKind {
    Undefined,
    Archway,
    Normal,
    Locked,
    Quest,
    Magic,
    NormalAlt,
    Window,
    HatchWindow,
}

#[derive(Clone, Debug)]
pub struct DoorDef {
    pub id: u16,
    pub kind: DoorKind,
    pub locked: bool,
}

#[derive(Clone, Debug, Default)]
pub struct WallBrush {
    pub nodes: Vec<WallNode>,      // wall::COUNT
    pub doors: Vec<Vec<DoorDef>>,  // wall::COUNT
    pub friends: Vec<BrushId>,
    pub redirect_to: BrushId,
}

impl WallBrush {
    pub fn new() -> Self {
        Self { nodes: vec![WallNode::default(); wall::COUNT], doors: vec![Vec::new(); wall::COUNT], ..Default::default() }
    }
}

#[derive(Clone, Debug, Default)]
pub struct WeightedNode {
    pub total_chance: u32,
    /// (item id, chance) — non-cumulative, as in RME carpets/tables.
    pub items: Vec<(u16, u32)>,
}

#[derive(Clone, Debug, Default)]
pub struct CarpetBrush {
    pub nodes: Vec<WeightedNode>, // 14
}

#[derive(Clone, Debug, Default)]
pub struct TableBrush {
    pub nodes: Vec<WeightedNode>, // table::COUNT
}

#[derive(Clone, Debug, Default)]
pub struct CompositeBlock {
    /// Cumulative chance.
    pub chance: u32,
    pub tiles: Vec<(i32, i32, i32, Vec<Item>)>,
}

#[derive(Clone, Debug, Default)]
pub struct DoodadAlternative {
    /// (item, chance) — non-cumulative.
    pub singles: Vec<(Item, u32)>,
    pub single_chance: u32,
    pub composites: Vec<CompositeBlock>,
    pub composite_chance: u32,
}

#[derive(Clone, Debug, Default)]
pub struct DoodadBrush {
    pub alternatives: Vec<DoodadAlternative>,
    pub thickness: i32,
    pub thickness_ceiling: i32,
    pub draggable: bool,
    pub on_blocking: bool,
    pub on_duplicate: bool,
    pub redo_borders: bool,
    pub one_size: bool,
    pub clear_optional_border: bool,
}

#[derive(Clone, Debug)]
pub enum BrushKind {
    /// Declared but never defined (stub).
    Unknown,
    Ground(GroundBrush),
    Wall(WallBrush),
    WallDecoration(WallBrush),
    Doodad(DoodadBrush),
    Carpet(CarpetBrush),
    Table(TableBrush),
}

#[derive(Clone, Debug)]
pub struct BrushDef {
    pub name: String,
    /// Server item id shown in palettes.
    pub look_id: u16,
    pub kind: BrushKind,
}

impl BrushDef {
    pub fn kind_name(&self) -> &'static str {
        match self.kind {
            BrushKind::Unknown => "unknown",
            BrushKind::Ground(_) => "ground",
            BrushKind::Wall(_) => "wall",
            BrushKind::WallDecoration(_) => "wall decoration",
            BrushKind::Doodad(_) => "doodad",
            BrushKind::Carpet(_) => "carpet",
            BrushKind::Table(_) => "table",
        }
    }
}

/// Per-item brush information (RME stores these fields on `ItemType`).
#[derive(Clone, Copy, Debug, Default)]
pub struct ItemBrushInfo {
    /// Ground / wall / carpet / table brush owning this item.
    pub brush: BrushId,
    pub doodad: BrushId,
    pub is_border: bool,
    pub is_optional_border: bool,
    pub border_group: u16,
    /// Border alignment for borders, wall alignment for walls.
    pub alignment: u8,
    pub is_wall: bool,
    pub is_brush_door: bool,
    pub wall_hate_me: bool,
    pub is_open: bool,
    pub is_locked: bool,
    pub is_carpet: bool,
    pub is_table: bool,
    /// Ground item that must accompany this border (inline ground borders).
    pub ground_equivalent: u16,
}

#[derive(Clone, Debug)]
pub enum TilesetEntry {
    Brush(BrushId),
    Item(u16),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PaletteKind {
    Terrain,
    Doodad,
    Items,
    Raw,
}

#[derive(Clone, Debug, Default)]
pub struct Tileset {
    pub name: String,
    pub categories: Vec<(PaletteKind, Vec<TilesetEntry>)>,
}

impl Tileset {
    pub fn entries(&self, kind: PaletteKind) -> impl Iterator<Item = &TilesetEntry> {
        self.categories.iter().filter(move |(k, _)| *k == kind).flat_map(|(_, e)| e.iter())
    }
}

#[derive(Default)]
pub struct Materials {
    pub borders: Vec<AutoBorder>,
    pub border_index: AHashMap<u32, usize>,
    pub brushes: Vec<BrushDef>,
    pub brush_index: AHashMap<String, BrushId>,
    pub item_info: Vec<ItemBrushInfo>,
    pub tilesets: Vec<Tileset>,
    pub warnings: Vec<String>,
    /// File that defines each brush (by name) — used to edit brushes in place.
    pub brush_source: AHashMap<String, std::path::PathBuf>,
    /// File that defines each border set (by id).
    pub border_source: AHashMap<u32, std::path::PathBuf>,
    /// First file that defines each tileset (by name) — used to add/remove palette entries.
    pub tileset_source: AHashMap<String, std::path::PathBuf>,
}

impl Materials {
    #[inline]
    pub fn brush(&self, id: BrushId) -> Option<&BrushDef> {
        if id == 0 || id == BRUSH_ALL {
            return None;
        }
        self.brushes.get(id as usize - 1)
    }

    pub fn brush_by_name(&self, name: &str) -> Option<BrushId> {
        self.brush_index.get(name).copied()
    }

    #[inline]
    pub fn info(&self, item_id: u16) -> ItemBrushInfo {
        self.item_info.get(item_id as usize).copied().unwrap_or_default()
    }

    pub fn info_mut(&mut self, item_id: u16) -> &mut ItemBrushInfo {
        let i = item_id as usize;
        if self.item_info.len() <= i {
            self.item_info.resize(i + 1, ItemBrushInfo::default());
        }
        &mut self.item_info[i]
    }

    pub fn ground(&self, id: BrushId) -> Option<&GroundBrush> {
        match &self.brush(id)?.kind {
            BrushKind::Ground(g) => Some(g),
            _ => None,
        }
    }

    pub fn wall(&self, id: BrushId) -> Option<&WallBrush> {
        match &self.brush(id)?.kind {
            BrushKind::Wall(w) | BrushKind::WallDecoration(w) => Some(w),
            _ => None,
        }
    }

    pub fn is_wall_decoration(&self, id: BrushId) -> bool {
        matches!(self.brush(id).map(|b| &b.kind), Some(BrushKind::WallDecoration(_)))
    }

    /// Ground brush of the given ground item (0 when not part of a ground brush).
    #[inline]
    pub fn ground_brush_of(&self, item_id: u16) -> BrushId {
        let b = self.info(item_id).brush;
        if self.ground(b).is_some() { b } else { 0 }
    }

    /// RME `Brush::friendOf` for ground brushes.
    pub fn ground_friend_of(&self, a: BrushId, b: BrushId) -> bool {
        let Some(g) = self.ground(a) else { return false };
        let found = g.friends.iter().any(|&f| f == b || f == BRUSH_ALL);
        found != g.hate_friends
    }

    pub fn wall_friend_of(&self, a: BrushId, b: BrushId) -> bool {
        self.wall(a).is_some_and(|w| w.friends.iter().any(|&f| f == b || f == BRUSH_ALL))
    }

    /// Brush to select for a tile (RME "Select brush"): the first item from the top of the
    /// stack that belongs to a ground/wall/carpet/table/doodad brush, then the ground.
    pub fn brush_of_tile(&self, tile: &crate::tile::Tile) -> Option<BrushId> {
        for it in tile.items.iter().rev() {
            let info = self.info(it.id);
            if info.brush != 0 && self.brush(info.brush).is_some() {
                return Some(info.brush);
            }
            if info.doodad != 0 && self.brush(info.doodad).is_some() {
                return Some(info.doodad);
            }
        }
        let g = tile.ground.as_ref()?;
        let info = self.info(g.id);
        [info.brush, info.doodad].into_iter().find(|&b| b != 0 && self.brush(b).is_some())
    }

    /// Get or create a brush slot by name (used by the loader for forward references).
    pub fn ensure_brush(&mut self, name: &str) -> BrushId {
        if let Some(&id) = self.brush_index.get(name) {
            return id;
        }
        self.brushes.push(BrushDef { name: name.to_owned(), look_id: 0, kind: BrushKind::Unknown });
        let id = self.brushes.len() as BrushId;
        self.brush_index.insert(name.to_owned(), id);
        id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;
    use crate::tile::Tile;

    #[test]
    fn brush_of_tile_prefers_top_item_then_ground() {
        let mut m = Materials::default();
        let ground = m.ensure_brush("grass");
        m.brushes[ground as usize - 1].kind = BrushKind::Ground(GroundBrush::default());
        let wallb = m.ensure_brush("stone wall");
        m.brushes[wallb as usize - 1].kind = BrushKind::Wall(WallBrush::new());
        let tree = m.ensure_brush("tree");
        m.brushes[tree as usize - 1].kind = BrushKind::Doodad(DoodadBrush::default());
        m.info_mut(100).brush = ground;
        m.info_mut(200).is_border = true;
        m.info_mut(300).brush = wallb;
        m.info_mut(400).doodad = tree;

        let mut t = Tile { ground: Some(Item::new(100)), ..Tile::new() };
        t.items.push(Item::new(200)); // border: no brush of its own
        assert_eq!(m.brush_of_tile(&t), Some(ground), "border over ground -> ground brush");
        t.items.push(Item::new(300));
        assert_eq!(m.brush_of_tile(&t), Some(wallb));
        t.items.push(Item::new(400));
        assert_eq!(m.brush_of_tile(&t), Some(tree));
        assert_eq!(m.brush_of_tile(&Tile { ground: Some(Item::new(999)), ..Tile::new() }), None);
    }
}

