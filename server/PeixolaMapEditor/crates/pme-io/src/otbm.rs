//! OTBM map reader/writer. Port of RME `iomap_otbm.cpp` (versions 1-3, items.otb 3.x).
//! Item attributes are kept in file order so load → save round-trips are lossless.

use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};

use anyhow::{bail, Context, Result};
use memmap2::Mmap;
use pme_core::item::{Attr, Item};
use pme_core::items::ItemDb;
use pme_core::map::{Map, Town, Waypoint};
use pme_core::position::Position;
use pme_core::tile::Tile;

use crate::binary::{NodeReader, NodeWriter, Props};

mod node {
    pub const ROOT: u8 = 0;
    pub const MAP_DATA: u8 = 2;
    pub const TILE_AREA: u8 = 4;
    pub const TILE: u8 = 5;
    pub const ITEM: u8 = 6;
    pub const TOWNS: u8 = 12;
    pub const TOWN: u8 = 13;
    pub const HOUSETILE: u8 = 14;
    pub const WAYPOINTS: u8 = 15;
    pub const WAYPOINT: u8 = 16;
}

mod attr {
    pub const DESCRIPTION: u8 = 1;
    pub const TILE_FLAGS: u8 = 3;
    pub const ACTION_ID: u8 = 4;
    pub const UNIQUE_ID: u8 = 5;
    pub const TEXT: u8 = 6;
    pub const DESC: u8 = 7;
    pub const TELE_DEST: u8 = 8;
    pub const ITEM: u8 = 9;
    pub const DEPOT_ID: u8 = 10;
    pub const EXT_SPAWN_FILE: u8 = 11;
    pub const RUNE_CHARGES: u8 = 12;
    pub const EXT_HOUSE_FILE: u8 = 13;
    pub const HOUSEDOORID: u8 = 14;
    pub const COUNT: u8 = 15;
    pub const DURATION: u8 = 16;
    pub const DECAYING_STATE: u8 = 17;
    pub const WRITTENDATE: u8 = 18;
    pub const WRITTENBY: u8 = 19;
    pub const SLEEPERGUID: u8 = 20;
    pub const SLEEPSTART: u8 = 21;
    pub const CHARGES: u8 = 22;
    pub const PODIUMOUTFIT: u8 = 40;
    pub const TIER: u8 = 41;
    pub const ATTRIBUTE_MAP: u8 = 128;
}

/// Load progress in per-mille (0..=1000), readable from another thread.
pub type Progress = AtomicU32;

fn read_pos(p: &mut Props) -> Result<Position> {
    Ok(Position::new(p.u16()?, p.u16()?, p.u8()?))
}

/// Raw bytes of an attribute map (to keep it verbatim).
fn read_attribute_map(p: &mut Props) -> Result<Vec<u8>> {
    let start = p.pos;
    let n = p.u16()?;
    for _ in 0..n {
        let klen = p.u16()? as usize;
        p.skip(klen)?;
        match p.u8()? {
            1 => {
                let len = p.u32()? as usize;
                p.skip(len)?;
            }
            2 | 3 => p.skip(4)?,
            4 => p.skip(1)?,
            5 => p.skip(8)?,
            t => bail!("unknown attribute map value type {t}"),
        }
    }
    Ok(p.b[start..p.pos].to_vec())
}

fn read_item_attrs(p: &mut Props, item: &mut Item) -> Result<()> {
    while p.has_more() {
        let a = p.u8()?;
        let v = match a {
            attr::COUNT => Attr::Count(p.u8()?),
            attr::ACTION_ID => Attr::ActionId(p.u16()?),
            attr::UNIQUE_ID => Attr::UniqueId(p.u16()?),
            attr::TEXT => Attr::Text(p.string()?),
            attr::DESC => Attr::Desc(p.string()?),
            attr::TELE_DEST => Attr::TeleDest(read_pos(p)?),
            attr::DEPOT_ID => Attr::DepotId(p.u16()?),
            attr::RUNE_CHARGES => Attr::RuneCharges(p.u8()?),
            attr::HOUSEDOORID => Attr::HouseDoorId(p.u8()?),
            attr::CHARGES => Attr::Charges(p.u16()?),
            attr::DURATION => Attr::Duration(p.u32()?),
            attr::DECAYING_STATE => Attr::DecayingState(p.u8()?),
            attr::WRITTENDATE => Attr::WrittenDate(p.u32()?),
            attr::WRITTENBY => Attr::WrittenBy(p.string()?),
            attr::SLEEPERGUID => Attr::SleeperGuid(p.u32()?),
            attr::SLEEPSTART => Attr::SleepStart(p.u32()?),
            attr::TIER => Attr::Tier(p.u8()?),
            attr::PODIUMOUTFIT => Attr::PodiumOutfit(p.bytes(15)?.try_into().unwrap()),
            attr::ATTRIBUTE_MAP => Attr::AttributeMap(read_attribute_map(p)?),
            other => bail!("unknown item attribute {other} for item {}", item.id),
        };
        item.ext_mut().attrs.push(v);
    }
    Ok(())
}

struct Loader<'a> {
    r: NodeReader<'a>,
    buf: Vec<u8>,
    db: &'a ItemDb,
    version: u32,
}

impl Loader<'_> {
    /// Read an ITEM node (cursor at its start), including container children.
    fn read_item(&mut self) -> Result<Item> {
        let t = self.r.enter(&mut self.buf)?;
        if t != node::ITEM {
            bail!("expected item node, got {t}");
        }
        let mut p = Props::new(&self.buf[1..]);
        let mut item = Item::new(p.u16()?);
        if self.version == 0 && self.db.get(item.id).is_some_and(|t| t.has_subtype()) {
            let c = p.u8()?;
            item.set_attr_count(c);
        }
        read_item_attrs(&mut p, &mut item).with_context(|| format!("item {}", item.id))?;
        while self.r.next_child()? {
            let child = self.read_item()?;
            item.ext_mut().children.push(child);
        }
        Ok(item)
    }

    fn read_tile(&mut self, area: Position, t: u8, map: &mut Map) -> Result<()> {
        let mut p = Props::new(&self.buf[1..]);
        let x = area.x + p.u8()? as u16;
        let y = area.y + p.u8()? as u16;
        let pos = Position::new(x, y, area.z);
        let mut tile = Tile::new();
        if t == node::HOUSETILE {
            tile.house_id = p.u32()?;
        }
        while p.has_more() {
            match p.u8()? {
                attr::TILE_FLAGS => tile.flags = p.u32()?,
                attr::ITEM => {
                    let it = Item::new(p.u16()?);
                    self.place(&mut tile, it);
                }
                other => bail!("unknown tile attribute {other} at {pos}"),
            }
        }
        while self.r.next_child()? {
            let it = self.read_item().with_context(|| format!("tile {pos}"))?;
            self.place(&mut tile, it);
        }
        map.set_tile(pos, tile);
        Ok(())
    }

    /// Ground goes to `ground` (if free); everything else keeps file order.
    fn place(&self, tile: &mut Tile, it: Item) {
        if tile.ground.is_none() && tile.items.is_empty() && self.db.is_ground(it.id) {
            tile.ground = Some(it);
        } else {
            tile.items.push(it);
        }
    }
}

pub fn load(path: &Path, db: &ItemDb, progress: Option<&Progress>) -> Result<Map> {
    let f = File::open(path).with_context(|| format!("opening {}", path.display()))?;
    // SAFETY: read-only mapping of a file we do not modify while loading.
    let mmap = unsafe { Mmap::map(&f) }.with_context(|| format!("mapping {}", path.display()))?;
    load_bytes(&mmap, db, progress)
}

pub fn load_bytes(data: &[u8], db: &ItemDb, progress: Option<&Progress>) -> Result<Map> {
    if data.len() < 8 {
        bail!("file too small");
    }
    if &data[0..4] != b"OTBM" && data[0..4] != [0, 0, 0, 0] {
        bail!("not an OTBM file");
    }
    let mut l = Loader { r: NodeReader::new(data), buf: Vec::with_capacity(256), db, version: 0 };
    let mut map = Map::new();
    map.descriptions.clear();

    let t = l.r.enter(&mut l.buf)?;
    if t != node::ROOT {
        bail!("bad root node");
    }
    let mut p = Props::new(&l.buf[1..]);
    l.version = p.u32()?;
    if l.version > 3 {
        bail!("unsupported OTBM version {}", l.version + 1);
    }
    map.otbm_version = l.version;
    map.width = p.u16()?;
    map.height = p.u16()?;
    map.otb_major = p.u32()?;
    map.otb_minor = p.u32()?;

    let total = data.len() as u64;
    let mut last_report = 0usize;

    while l.r.next_child()? {
        let t = l.r.enter(&mut l.buf)?;
        if t != node::MAP_DATA {
            l.r.skip_node_body()?;
            continue;
        }
        let mut p = Props::new(&l.buf[1..]);
        while p.has_more() {
            match p.u8()? {
                attr::DESCRIPTION => map.descriptions.push(p.string()?),
                attr::EXT_SPAWN_FILE => map.spawn_file = p.string()?,
                attr::EXT_HOUSE_FILE => map.house_file = p.string()?,
                other => bail!("unknown map attribute {other}"),
            }
        }
        while l.r.next_child()? {
            let t = l.r.enter(&mut l.buf)?;
            match t {
                node::TILE_AREA => {
                    let mut p = Props::new(&l.buf[1..]);
                    let area = read_pos(&mut p)?;
                    while l.r.next_child()? {
                        let t = l.r.enter(&mut l.buf)?;
                        if t == node::TILE || t == node::HOUSETILE {
                            l.read_tile(area, t, &mut map)?;
                        } else {
                            l.r.skip_node_body()?;
                        }
                    }
                    if let Some(pr) = progress {
                        let pos = l.r.position();
                        if pos - last_report > 1 << 18 {
                            last_report = pos;
                            pr.store((pos as u64 * 1000 / total) as u32, Ordering::Relaxed);
                        }
                    }
                }
                node::TOWNS => {
                    while l.r.next_child()? {
                        let t = l.r.enter(&mut l.buf)?;
                        if t == node::TOWN {
                            let mut p = Props::new(&l.buf[1..]);
                            let id = p.u32()?;
                            let name = p.string()?;
                            let temple = read_pos(&mut p)?;
                            map.towns.push(Town { id, name, temple });
                        }
                        l.r.skip_node_body()?;
                    }
                }
                node::WAYPOINTS => {
                    while l.r.next_child()? {
                        let t = l.r.enter(&mut l.buf)?;
                        if t == node::WAYPOINT {
                            let mut p = Props::new(&l.buf[1..]);
                            let name = p.string()?;
                            let pos = read_pos(&mut p)?;
                            map.waypoints.push(Waypoint { name, pos });
                        }
                        l.r.skip_node_body()?;
                    }
                }
                _ => l.r.skip_node_body()?,
            }
        }
    }
    if let Some(pr) = progress {
        pr.store(1000, Ordering::Relaxed);
    }
    map.revision = 0;
    Ok(map)
}

impl NodeReader<'_> {
    /// After `enter`: skip all remaining children and consume the node end.
    pub fn skip_node_body(&mut self) -> Result<()> {
        while self.next_child()? {
            self.skip_node()?;
        }
        Ok(())
    }
}

// ------------------------------------------------------------------------------------ save

fn write_attrs(w: &mut NodeWriter, item: &Item) {
    for a in item.attrs() {
        match a {
            Attr::Count(v) => {
                w.u8(attr::COUNT);
                w.u8(*v);
            }
            Attr::ActionId(v) => {
                w.u8(attr::ACTION_ID);
                w.u16(*v);
            }
            Attr::UniqueId(v) => {
                w.u8(attr::UNIQUE_ID);
                w.u16(*v);
            }
            Attr::Text(s) => {
                w.u8(attr::TEXT);
                w.string(s);
            }
            Attr::Desc(s) => {
                w.u8(attr::DESC);
                w.string(s);
            }
            Attr::TeleDest(p) => {
                w.u8(attr::TELE_DEST);
                w.u16(p.x);
                w.u16(p.y);
                w.u8(p.z);
            }
            Attr::DepotId(v) => {
                w.u8(attr::DEPOT_ID);
                w.u16(*v);
            }
            Attr::RuneCharges(v) => {
                w.u8(attr::RUNE_CHARGES);
                w.u8(*v);
            }
            Attr::HouseDoorId(v) => {
                w.u8(attr::HOUSEDOORID);
                w.u8(*v);
            }
            Attr::Charges(v) => {
                w.u8(attr::CHARGES);
                w.u16(*v);
            }
            Attr::Duration(v) => {
                w.u8(attr::DURATION);
                w.u32(*v);
            }
            Attr::DecayingState(v) => {
                w.u8(attr::DECAYING_STATE);
                w.u8(*v);
            }
            Attr::WrittenDate(v) => {
                w.u8(attr::WRITTENDATE);
                w.u32(*v);
            }
            Attr::WrittenBy(s) => {
                w.u8(attr::WRITTENBY);
                w.string(s);
            }
            Attr::SleeperGuid(v) => {
                w.u8(attr::SLEEPERGUID);
                w.u32(*v);
            }
            Attr::SleepStart(v) => {
                w.u8(attr::SLEEPSTART);
                w.u32(*v);
            }
            Attr::Tier(v) => {
                w.u8(attr::TIER);
                w.u8(*v);
            }
            Attr::PodiumOutfit(b) => {
                w.u8(attr::PODIUMOUTFIT);
                w.raw(b);
            }
            Attr::AttributeMap(b) => {
                w.u8(attr::ATTRIBUTE_MAP);
                w.raw(b);
            }
        }
    }
}

fn write_item(w: &mut NodeWriter, db: &ItemDb, item: &Item, version: u32) {
    w.start(node::ITEM);
    w.u16(item.id);
    if version == 0 && db.get(item.id).is_some_and(|t| t.has_subtype()) {
        w.u8(item.subtype() as u8);
        // The count was written inline; skip the Count attribute.
        let mut copy = item.clone();
        copy.remove_attr(|a| matches!(a, Attr::Count(_)));
        write_attrs(w, &copy);
    } else {
        write_attrs(w, item);
    }
    for c in item.children() {
        write_item(w, db, c, version);
    }
    w.end();
}

/// Serialize the map to OTBM bytes.
pub fn save_bytes(map: &Map, db: &ItemDb) -> Vec<u8> {
    let version = map.otbm_version;
    // 4 zero bytes, like RME's default: TFS 0.4 (`FileLoader::openFile`) reads this as a u32
    // version and refuses the map when it is not 0, so the "OTBM" magic must not be written.
    let mut w = NodeWriter::new(&[0; 4]);
    w.start(node::ROOT);
    w.u32(version);
    w.u16(map.width);
    w.u16(map.height);
    w.u32(map.otb_major);
    w.u32(map.otb_minor);

    w.start(node::MAP_DATA);
    for d in &map.descriptions {
        w.u8(attr::DESCRIPTION);
        w.string(d);
    }
    w.u8(attr::EXT_SPAWN_FILE);
    w.string(&map.spawn_file);
    w.u8(attr::EXT_HOUSE_FILE);
    w.string(&map.house_file);

    // Group tiles in 256x256 areas per floor.
    let mut tiles: Vec<(Position, &Tile)> = map.tiles().collect();
    tiles.sort_unstable_by_key(|(p, _)| (p.z, p.x & 0xFF00, p.y & 0xFF00, p.y, p.x));
    let mut current: Option<(u16, u16, u8)> = None;
    for (pos, tile) in tiles {
        let key = (pos.x & 0xFF00, pos.y & 0xFF00, pos.z);
        if current != Some(key) {
            if current.is_some() {
                w.end();
            }
            w.start(node::TILE_AREA);
            w.u16(key.0);
            w.u16(key.1);
            w.u8(key.2);
            current = Some(key);
        }
        if tile.house_id != 0 {
            w.start(node::HOUSETILE);
            w.u8((pos.x & 0xFF) as u8);
            w.u8((pos.y & 0xFF) as u8);
            w.u32(tile.house_id);
        } else {
            w.start(node::TILE);
            w.u8((pos.x & 0xFF) as u8);
            w.u8((pos.y & 0xFF) as u8);
        }
        if tile.flags != 0 {
            w.u8(attr::TILE_FLAGS);
            w.u32(tile.flags);
        }
        if let Some(g) = &tile.ground {
            if g.ext.is_none() {
                w.u8(attr::ITEM);
                w.u16(g.id);
            } else {
                write_item(&mut w, db, g, version);
            }
        }
        for it in &tile.items {
            write_item(&mut w, db, it, version);
        }
        w.end();
    }
    if current.is_some() {
        w.end();
    }

    w.start(node::TOWNS);
    for t in &map.towns {
        w.start(node::TOWN);
        w.u32(t.id);
        w.string(&t.name);
        w.u16(t.temple.x);
        w.u16(t.temple.y);
        w.u8(t.temple.z);
        w.end();
    }
    w.end();

    if version >= 2 {
        w.start(node::WAYPOINTS);
        for wp in &map.waypoints {
            w.start(node::WAYPOINT);
            w.string(&wp.name);
            w.u16(wp.pos.x);
            w.u16(wp.pos.y);
            w.u8(wp.pos.z);
            w.end();
        }
        w.end();
    }

    w.end(); // MAP_DATA
    w.end(); // ROOT
    w.out
}

/// Write atomically: `<path>.tmp` then rename; the previous file is kept as `<path>.bak`.
pub fn save(path: &Path, map: &Map, db: &ItemDb) -> Result<()> {
    let bytes = save_bytes(map, db);
    crate::write_atomic(path, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_header_is_tfs_compatible() {
        let db = ItemDb::default();
        let mut map = Map::new();
        map.otbm_version = 2;
        let mut t = Tile::new();
        t.flags = 1;
        map.set_tile(Position::new(1000, 1000, 7), t);
        let bytes = save_bytes(&map, &db);
        assert_eq!(&bytes[0..4], &[0, 0, 0, 0], "TFS 0.4 refuses a non-zero file version");
        let back = load_bytes(&bytes, &db, None).unwrap();
        assert_eq!(back.otbm_version, 2);
        assert_eq!(back.get(Position::new(1000, 1000, 7)).map(|t| t.flags), Some(1));
        // Files written with the "OTBM" magic (older PeixolaMapEditor builds) still open.
        let mut magic = bytes.clone();
        magic[0..4].copy_from_slice(b"OTBM");
        assert!(load_bytes(&magic, &db, None).is_ok());
    }
}
