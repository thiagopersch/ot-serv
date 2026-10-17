//! Add / remove palette entries of a `<tileset>` (RME tilesets.xml) in place.

use std::path::Path;

use anyhow::Result;
use pme_core::materials::PaletteKind;

use crate::xml::Elem;
use crate::xml_edit;

/// (category to create when missing, categories that feed this palette).
pub fn categories(kind: PaletteKind) -> (&'static str, &'static [&'static str]) {
    match kind {
        PaletteKind::Terrain => ("terrain", &["terrain", "terrain_and_raw"]),
        PaletteKind::Doodad => ("doodad", &["doodad", "doodad_and_raw"]),
        PaletteKind::Items => ("items", &["items", "items_and_raw"]),
        PaletteKind::Raw => ("raw", &["raw", "terrain_and_raw", "doodad_and_raw", "items_and_raw"]),
    }
}

fn category_mut<'a>(tileset: &'a mut Elem, kind: PaletteKind) -> &'a mut Elem {
    let (primary, accepted) = categories(kind);
    let idx = tileset.children.iter().position(|c| accepted.iter().any(|a| c.is(a)));
    match idx {
        Some(i) => &mut tileset.children[i],
        None => {
            tileset.children.push(Elem::new(primary, &[]));
            tileset.children.last_mut().unwrap()
        }
    }
}

/// Append `<item fromid="id"/>` (RME style) to the palette's category.
pub fn add_item(tileset: &mut Elem, kind: PaletteKind, id: u16) {
    category_mut(tileset, kind).children.push(Elem::new("item", &[("fromid", &id.to_string())]));
}

pub fn add_brush(tileset: &mut Elem, kind: PaletteKind, name: &str) {
    category_mut(tileset, kind).children.push(Elem::new("brush", &[("name", name)]));
}

/// Remove item `id` from every category feeding `kind`. A `fromid..toid` range containing it is
/// split so the other items stay. Returns true if something was removed.
pub fn remove_item(tileset: &mut Elem, kind: PaletteKind, id: u16) -> bool {
    let (_, accepted) = categories(kind);
    let mut removed = false;
    for cat in tileset.children.iter_mut().filter(|c| accepted.iter().any(|a| c.is(a))) {
        let mut out = Vec::with_capacity(cat.children.len());
        for e in cat.children.drain(..) {
            if !e.is("item") {
                out.push(e);
                continue;
            }
            let (from, to) = match (e.int::<u16>("id"), e.int::<u16>("fromid"), e.int::<u16>("toid")) {
                (Some(i), _, _) => (i, i),
                (None, Some(a), Some(b)) => (a, b),
                (None, Some(a), None) => (a, a),
                _ => {
                    out.push(e);
                    continue;
                }
            };
            if id < from || id > to {
                out.push(e);
                continue;
            }
            removed = true;
            let range = |a: u16, b: u16| {
                let mut r = Elem::new("item", &[("fromid", &a.to_string())]);
                if b != a {
                    r.set_attr("toid", b.to_string());
                }
                r
            };
            if id > from {
                out.push(range(from, id - 1));
            }
            if id < to {
                out.push(range(id + 1, to));
            }
        }
        cat.children = out;
    }
    removed
}

pub fn remove_brush(tileset: &mut Elem, kind: PaletteKind, name: &str) -> bool {
    let (_, accepted) = categories(kind);
    let mut removed = false;
    for cat in tileset.children.iter_mut().filter(|c| accepted.iter().any(|a| c.is(a))) {
        let before = cat.children.len();
        cat.children.retain(|e| !(e.is("brush") && e.attr("name") == Some(name)));
        removed |= cat.children.len() != before;
    }
    removed
}

/// Load `<tileset name>` from `path`, apply `f`, and write it back in place (`.bak` kept).
pub fn edit(path: &Path, name: &str, f: impl FnOnce(&mut Elem) -> bool) -> Result<bool> {
    let mut e = xml_edit::load_element(path, "tileset", "name", name)?;
    if !f(&mut e) {
        return Ok(false);
    }
    xml_edit::replace_element(path, "tileset", "name", name, &e)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::xml;

    fn sample() -> Elem {
        xml::parse_str(r#"<tileset name="Stairs"><terrain><brush name="ramp"/><item fromid="1" toid="5"/><item id="9"/></terrain><raw><item fromid="7"/></raw></tileset>"#)
            .unwrap()
            .children
            .remove(0)
    }

    #[test]
    fn add_and_remove_with_range_split() {
        let mut t = sample();
        add_item(&mut t, PaletteKind::Terrain, 459);
        add_brush(&mut t, PaletteKind::Terrain, "snowy ramp");
        let terrain = &t.children[0];
        assert!(terrain.children.iter().any(|c| c.attr("fromid") == Some("459")));
        assert!(terrain.children.iter().any(|c| c.attr("name") == Some("snowy ramp")));

        assert!(remove_item(&mut t, PaletteKind::Terrain, 3));
        let items: Vec<(Option<&str>, Option<&str>)> = t.children[0].children.iter().filter(|c| c.is("item")).map(|c| (c.attr("fromid"), c.attr("toid"))).collect();
        assert!(items.contains(&(Some("1"), Some("2"))) && items.contains(&(Some("4"), Some("5"))), "{items:?}");
        assert!(remove_item(&mut t, PaletteKind::Terrain, 9));
        assert!(!remove_item(&mut t, PaletteKind::Terrain, 9));
        assert!(remove_brush(&mut t, PaletteKind::Terrain, "ramp"));
        // Raw category untouched by terrain edits; a missing category is created on add.
        assert_eq!(t.children[1].children.len(), 1);
        add_item(&mut t, PaletteKind::Doodad, 10);
        assert!(t.children.iter().any(|c| c.is("doodad")));
    }
}
