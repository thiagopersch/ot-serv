//! Creature list for the creature palette: monsters from `monster/monsters.xml` and NPCs
//! from `npc/*.xml` of the server data folder.

use std::path::Path;

use crate::xml;

#[derive(Clone, Debug, Default)]
pub struct CreatureType {
    /// Key written to the spawn XML: monster name from monsters.xml, or the NPC *file name*
    /// (TFS loads `data/npc/<name>.xml`).
    pub name: String,
    /// Name shown in game (`<npc name>`); equal to `name` for monsters.
    pub display: String,
    pub look_type: u16,
    pub look_item: u16,
    pub head: u8,
    pub body: u8,
    pub legs: u8,
    pub feet: u8,
    /// Addon bits (1 = first addon, 2 = second).
    pub addons: u8,
    pub is_npc: bool,
}

fn read_look(e: &xml::Elem, c: &mut CreatureType) {
    if let Some(look) = e.children_named("look").next() {
        c.look_type = look.int("type").unwrap_or(0);
        c.look_item = look.int("typeex").unwrap_or(0);
        c.head = look.int("head").unwrap_or(0);
        c.body = look.int("body").unwrap_or(0);
        c.legs = look.int("legs").unwrap_or(0);
        c.feet = look.int("feet").unwrap_or(0);
        c.addons = look.int("addons").unwrap_or(0);
    }
}

/// Load monsters + NPCs. Errors in single files are collected as warnings.
pub fn load(server_data: &Path, warnings: &mut Vec<String>) -> Vec<CreatureType> {
    let mut out = Vec::new();
    let mdir = server_data.join("monster");
    match xml::parse_file(&mdir.join("monsters.xml")) {
        Ok(doc) => {
            for root in doc.children.iter().filter(|e| e.is("monsters")) {
                for m in root.children_named("monster") {
                    let (Some(name), Some(file)) = (m.attr("name"), m.attr("file")) else { continue };
                    let mut c = CreatureType { name: name.to_owned(), display: name.to_owned(), ..Default::default() };
                    match xml::parse_file(&mdir.join(file)) {
                        Ok(d) => {
                            if let Some(me) = d.children.iter().find(|e| e.is("monster")) {
                                read_look(me, &mut c);
                            }
                        }
                        Err(e) => warnings.push(format!("{file}: {e:#}")),
                    }
                    out.push(c);
                }
            }
        }
        Err(e) => warnings.push(format!("monsters.xml: {e:#}")),
    }
    if let Ok(rd) = std::fs::read_dir(server_data.join("npc")) {
        for f in rd.flatten() {
            let p = f.path();
            if p.extension().is_none_or(|e| !e.eq_ignore_ascii_case("xml")) {
                continue;
            }
            match xml::parse_file(&p) {
                Ok(d) => {
                    if let Some(n) = d.children.iter().find(|e| e.is("npc")) {
                        let stem = p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
                        let display = n.attr("name").filter(|s| !s.is_empty()).unwrap_or(&stem).to_owned();
                        let mut c = CreatureType { name: stem, display, is_npc: true, ..Default::default() };
                        read_look(n, &mut c);
                        out.push(c);
                    }
                }
                Err(e) => warnings.push(format!("{}: {e:#}", p.display())),
            }
        }
    }
    out.sort_by(|a, b| {
        a.is_npc.cmp(&b.is_npc).then_with(|| a.display.to_lowercase().cmp(&b.display.to_lowercase())).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    // Same key twice (e.g. a monster listed twice in monsters.xml): keep the first.
    let mut seen = std::collections::HashSet::new();
    out.retain(|c| seen.insert((c.is_npc, c.name.to_lowercase())));
    out
}

/// Value of `attr="..."` in a single XML line (case-insensitive attribute name).
fn line_attr(line: &str, attr: &str) -> Option<String> {
    let low = line.to_ascii_lowercase();
    let key = format!("{attr}=\"");
    let mut from = 0;
    while let Some(i) = low[from..].find(&key) {
        let start = from + i;
        // Must be a whole attribute name (preceded by whitespace).
        if start == 0 || low.as_bytes()[start - 1].is_ascii_whitespace() {
            let v = start + key.len();
            let end = line[v..].find('"')? + v;
            return Some(line[v..end].to_owned());
        }
        from = start + key.len();
    }
    None
}

/// Remove the `<monster name="..">` entry from `monster/monsters.xml` (line-based, so the rest
/// of the file is kept byte for byte; a `.bak` is written). Returns false if it was not listed.
pub fn remove_monster(server_data: &Path, name: &str) -> anyhow::Result<bool> {
    let path = server_data.join("monster/monsters.xml");
    let text = xml::read_text(&path)?;
    let mut removed = false;
    let mut out = String::with_capacity(text.len());
    for line in text.split_inclusive('\n') {
        let t = line.trim_start();
        if !removed && t.starts_with("<monster ") && line_attr(t, "name").is_some_and(|n| n.eq_ignore_ascii_case(name)) {
            removed = true;
            continue;
        }
        out.push_str(line);
    }
    if removed {
        crate::write_atomic(&path, out.as_bytes())?;
    }
    Ok(removed)
}

/// Move `npc/<stem>.xml` to `npc/_removidos/` (the server only loads `npc/<name>.xml`).
pub fn remove_npc(server_data: &Path, stem: &str) -> anyhow::Result<std::path::PathBuf> {
    let src = server_data.join("npc").join(format!("{stem}.xml"));
    anyhow::ensure!(src.is_file(), "{} not found", src.display());
    let dir = server_data.join("npc/_removidos");
    std::fs::create_dir_all(&dir)?;
    let mut dst = dir.join(format!("{stem}.xml"));
    let mut n = 2;
    while dst.exists() {
        dst = dir.join(format!("{stem} ({n}).xml"));
        n += 1;
    }
    std::fs::rename(&src, &dst)?;
    Ok(dst)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_monster_and_npc() {
        let dir = std::env::temp_dir().join(format!("pme-rm-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("monster")).unwrap();
        std::fs::create_dir_all(dir.join("npc")).unwrap();
        let mx = "<?xml version=\"1.0\"?>\r\n<monsters>\r\n  <monster name=\"Dragon\" file=\"d.xml\" />\r\n  <!-- keep -->\r\n  <monster file=\"x.xml\" name=\"Rat\"/>\r\n</monsters>\r\n";
        std::fs::write(dir.join("monster/monsters.xml"), mx).unwrap();
        assert!(remove_monster(&dir, "rat").unwrap());
        assert!(!remove_monster(&dir, "Demon").unwrap());
        let after = std::fs::read_to_string(dir.join("monster/monsters.xml")).unwrap();
        assert_eq!(after, mx.replace("  <monster file=\"x.xml\" name=\"Rat\"/>\r\n", ""));
        std::fs::write(dir.join("npc/Bob.xml"), "<npc name=\"Bob\"/>").unwrap();
        let moved = remove_npc(&dir, "Bob").unwrap();
        assert!(moved.ends_with("_removidos/Bob.xml") && moved.is_file());
        assert!(!dir.join("npc/Bob.xml").exists());
        let mut w = Vec::new();
        assert!(load(&dir, &mut w).iter().all(|c| c.name != "Bob"), "removed NPC must not be listed");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn npcs_are_keyed_by_file_name() {
        let dir = std::env::temp_dir().join(format!("pme-npc-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("npc")).unwrap();
        let npc = |name: &str, look: u16| format!("<?xml version=\"1.0\"?>\n<npc name=\"{name}\"><look type=\"{look}\" head=\"1\"/></npc>");
        std::fs::write(dir.join("npc/Lucius Corvinus.xml"), npc("Lucius Corvinus", 1500)).unwrap();
        std::fs::write(dir.join("npc/Cakev.xml"), npc("Lucius Corvinus", 1173)).unwrap();
        let mut w = Vec::new();
        let list = load(&dir, &mut w);
        let _ = std::fs::remove_dir_all(&dir);
        let mut names: Vec<(&str, &str, u16)> = list.iter().map(|c| (c.name.as_str(), c.display.as_str(), c.look_type)).collect();
        names.sort();
        assert_eq!(names, vec![("Cakev", "Lucius Corvinus", 1173), ("Lucius Corvinus", "Lucius Corvinus", 1500)]);
    }
}
