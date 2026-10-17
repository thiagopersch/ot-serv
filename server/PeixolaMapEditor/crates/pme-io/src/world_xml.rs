//! houses.xml and spawn.xml (TFS / RME format).

use std::fmt::Write as _;
use std::path::Path;

use ahash::AHashSet;
use anyhow::Result;
use pme_core::map::{House, Map};
use pme_core::position::Position;
use pme_core::tile::{Creature, Tile};

use crate::xml;

pub fn load_houses(path: &Path, map: &mut Map) -> Result<()> {
    let doc = xml::parse_file(path)?;
    let Some(root) = doc.children.iter().find(|e| e.is("houses")) else { return Ok(()) };
    for h in root.children_named("house") {
        map.houses.push(House {
            id: h.int("houseid").unwrap_or(0),
            name: h.attr_or("name", "").to_owned(),
            town_id: h.int("townid").unwrap_or(0),
            rent: h.int("rent").unwrap_or(0),
            entry: Position::new(h.int("entryx").unwrap_or(0), h.int("entryy").unwrap_or(0), h.int("entryz").unwrap_or(7)),
            guildhall: h.bool("guildhall"),
            size: h.int("size").unwrap_or(0),
        });
    }
    Ok(())
}

pub fn houses_xml(map: &Map) -> String {
    let mut sizes = ahash::AHashMap::<u32, u32>::new();
    for (_, t) in map.tiles() {
        if t.house_id != 0 {
            *sizes.entry(t.house_id).or_default() += 1;
        }
    }
    let mut s = String::from("<?xml version=\"1.0\"?>\n<houses>\n");
    for h in &map.houses {
        let _ = write!(
            s,
            "\t<house name=\"{}\" houseid=\"{}\" entryx=\"{}\" entryy=\"{}\" entryz=\"{}\" rent=\"{}\"",
            xml::escape(&h.name),
            h.id,
            h.entry.x,
            h.entry.y,
            h.entry.z,
            h.rent
        );
        if h.guildhall {
            s.push_str(" guildhall=\"true\"");
        }
        let _ = writeln!(s, " townid=\"{}\" size=\"{}\" />", h.town_id, sizes.get(&h.id).copied().unwrap_or(0));
    }
    s.push_str("</houses>\n");
    s
}

pub fn load_spawns(path: &Path, map: &mut Map) -> Result<usize> {
    load_spawns_doc(&xml::parse_file(path)?, map)
}

pub fn load_spawns_str(text: &str, map: &mut Map) -> Result<usize> {
    load_spawns_doc(&xml::parse_str(text)?, map)
}

fn load_spawns_doc(doc: &xml::Elem, map: &mut Map) -> Result<usize> {
    let Some(root) = doc.children.iter().find(|e| e.is("spawns")) else { return Ok(0) };
    let mut count = 0;
    for sp in root.children_named("spawn") {
        let (Some(cx), Some(cy), Some(cz)) = (sp.int::<i32>("centerx"), sp.int::<i32>("centery"), sp.int::<u8>("centerz")) else { continue };
        let radius = sp.int::<u16>("radius").unwrap_or(1).max(1);
        let Some(center) = Position::new(0, 0, cz).offset(cx, cy, 0) else { continue };
        let mut t = map.get(center).cloned().unwrap_or_else(Tile::new);
        t.spawn_radius = radius;
        map.set_tile(center, t);
        for c in sp.children.iter().filter(|c| c.is("monster") || c.is("npc")) {
            let Some(name) = c.attr("name") else { continue };
            let z = c.int::<u8>("z").unwrap_or(cz);
            let Some(p) = Position::new(0, 0, z).offset(cx + c.int::<i32>("x").unwrap_or(0), cy + c.int::<i32>("y").unwrap_or(0), 0) else { continue };
            let mut t = map.get(p).cloned().unwrap_or_else(Tile::new);
            t.creature = Some(Box::new(Creature {
                name: name.to_owned(),
                spawn_time: c.int("spawntime").unwrap_or(60),
                direction: c.int("direction").unwrap_or(2),
                is_npc: c.is("npc"),
            }));
            map.set_tile(p, t);
            count += 1;
        }
    }
    map.revision = 0;
    Ok(count)
}

/// Build spawn.xml. Returns (xml, creatures outside any spawn — those are dropped, like RME).
pub fn spawns_xml(map: &Map) -> (String, usize) {
    let mut spawns: Vec<(Position, u16)> = map.tiles().filter(|(_, t)| t.spawn_radius > 0).map(|(p, t)| (p, t.spawn_radius)).collect();
    spawns.sort_unstable();
    let mut used: AHashSet<Position> = AHashSet::new();
    let mut s = String::from("<?xml version=\"1.0\"?>\n<spawns>\n");
    for (c, r) in spawns {
        let r = r as i32;
        let mut body = String::new();
        let mut n = 0;
        for dy in -r..=r {
            for dx in -r..=r {
                let Some(p) = c.offset(dx, dy, 0) else { continue };
                let Some(cr) = map.get(p).and_then(|t| t.creature.as_deref()) else { continue };
                if !used.insert(p) {
                    continue;
                }
                let tag = if cr.is_npc { "npc" } else { "monster" };
                let _ = writeln!(
                    body,
                    "\t\t<{tag} name=\"{}\" x=\"{dx}\" y=\"{dy}\" z=\"{}\" spawntime=\"{}\" direction=\"{}\" />",
                    xml::escape(&cr.name),
                    c.z,
                    cr.spawn_time,
                    cr.direction
                );
                n += 1;
            }
        }
        if n > 0 {
            let _ = writeln!(s, "\t<spawn centerx=\"{}\" centery=\"{}\" centerz=\"{}\" radius=\"{}\">", c.x, c.y, c.z, r);
            s.push_str(&body);
            s.push_str("\t</spawn>\n");
        } else {
            let _ = writeln!(s, "\t<spawn centerx=\"{}\" centery=\"{}\" centerz=\"{}\" radius=\"{}\" />", c.x, c.y, c.z, r);
        }
    }
    s.push_str("</spawns>\n");
    let orphans = map.tiles().filter(|(p, t)| t.creature.is_some() && !used.contains(p)).count();
    (s, orphans)
}
