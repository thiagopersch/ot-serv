//! items.otb (OTBI) + items.xml loader. Port of RME `items.cpp` (`loadFromOtbVer3`).

use std::path::Path;

use anyhow::{bail, Context, Result};
use pme_core::items::{ItemDb, ItemGroup, ItemType};

use crate::binary::{NodeReader, Props};
use crate::xml;

const ROOT_ATTR_VERSION: u8 = 0x01;
const ITEM_ATTR_SERVERID: u8 = 0x10;
const ITEM_ATTR_CLIENTID: u8 = 0x11;
const ITEM_ATTR_NAME: u8 = 0x12;
const ITEM_ATTR_TOPORDER: u8 = 0x2B;

pub fn load_otb(path: &Path, db: &mut ItemDb) -> Result<()> {
    let data = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    load_otb_bytes(&data, db)
}

pub fn load_otb_bytes(data: &[u8], db: &mut ItemDb) -> Result<()> {
    let mut r = NodeReader::new(data);
    let mut buf = Vec::new();
    r.enter(&mut buf)?;
    let mut p = Props::new(&buf[1..]);
    p.skip(4)?; // flags (unused)
    if p.u8()? == ROOT_ATTR_VERSION {
        let len = p.u16()?;
        if len != 140 {
            bail!("items.otb: invalid version header size {len}");
        }
        db.otb_major = p.u32()?;
        db.otb_minor = p.u32()?;
        db.otb_build = p.u32()?;
    } else {
        bail!("items.otb: expected version attribute");
    }

    let mut items: Vec<ItemType> = Vec::with_capacity(60000);
    while r.next_child()? {
        let group = r.enter(&mut buf)?;
        // Items have no children, but be tolerant.
        while r.next_child()? {
            r.skip_node()?;
        }
        let mut p = Props::new(&buf[1..]);
        let flags = p.u32()?;
        let mut t = ItemType { group: ItemGroup::from_u8(group), flags, valid: true, ..Default::default() };
        while p.has_more() {
            let attr = p.u8()?;
            let len = p.u16()? as usize;
            let data = p.bytes(len)?;
            let mut d = Props::new(data);
            match attr {
                ITEM_ATTR_SERVERID if len >= 2 => t.id = d.u16()?,
                ITEM_ATTR_CLIENTID if len >= 2 => t.client_id = d.u16()?,
                ITEM_ATTR_NAME => t.name = crate::binary::latin1_to_string(data),
                ITEM_ATTR_TOPORDER if len >= 1 => t.top_order = d.u8()?,
                _ => {}
            }
        }
        if group == ItemGroup::Deprecated as u8 || t.id == 0 {
            continue;
        }
        items.push(t);
    }
    let max = items.iter().map(|t| t.id).max().unwrap_or(0);
    db.max_id = max;
    db.items = vec![ItemType::default(); max as usize + 1];
    for t in items {
        let id = t.id as usize;
        db.items[id] = t;
    }
    Ok(())
}

/// Merge names / types from items.xml.
pub fn load_items_xml(path: &Path, db: &mut ItemDb) -> Result<()> {
    let doc = xml::parse_file(path)?;
    let Some(root) = doc.children.iter().find(|e| e.is("items")) else { bail!("items.xml: missing <items>") };
    for e in root.children_named("item") {
        let (from, to) = match (e.int::<u32>("id"), e.int::<u32>("fromid"), e.int::<u32>("toid")) {
            (Some(id), _, _) => (id, id),
            (None, Some(a), Some(b)) => (a, b),
            (None, Some(a), None) => (a, a),
            _ => continue,
        };
        // RME shows `name` + `editorsuffix` (e.g. "nothing special (Invisible Walkable Floor)").
        let name = match (e.attr("name").unwrap_or(""), e.attr("editorsuffix").map(str::trim).filter(|s| !s.is_empty())) {
            (n, Some(sfx)) if !n.is_empty() => format!("{n} {sfx}"),
            (_, Some(sfx)) => sfx.to_owned(),
            (n, None) => n.to_owned(),
        };
        let name = name.as_str();
        let ty = e.children_named("attribute").find(|a| a.attr("key").is_some_and(|k| k.eq_ignore_ascii_case("type"))).and_then(|a| a.attr("value"));
        for id in from..=to.min(u16::MAX as u32) {
            if let Some(t) = db.items.get_mut(id as usize).filter(|t| t.valid) {
                if !name.is_empty() {
                    t.name = name.to_owned();
                }
                if let Some(ty) = ty {
                    t.xml_type = ty.to_ascii_lowercase();
                }
            }
        }
    }
    Ok(())
}
