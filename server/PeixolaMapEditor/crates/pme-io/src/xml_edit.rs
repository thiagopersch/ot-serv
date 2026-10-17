//! In-place editing of one top-level element (a `<brush>` or `<border>`) inside a materials XML
//! file. Only the element's byte range is rewritten; the rest of the file (comments, spacing,
//! line endings, encoding) stays exactly as it was. A `.bak` is written by `write_atomic`.

use std::ops::Range;
use std::path::Path;

use anyhow::{anyhow, Context, Result};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use crate::binary::{latin1_to_string, string_to_latin1};
use crate::xml::{self, Elem};

fn attr_matches(e: &BytesStart, attr: &str, value: &str) -> bool {
    e.attributes().flatten().any(|a| {
        a.key.as_ref().eq_ignore_ascii_case(attr.as_bytes()) && a.unescape_value().map(|v| v.trim() == value.trim()).unwrap_or(false)
    })
}

/// Byte range of the top-level `<tag attr="value">` element (child of the document root).
/// A full definition (with children) wins over an empty stub with the same name.
pub fn find_element(text: &str, tag: &str, attr: &str, value: &str) -> Option<Range<usize>> {
    let mut r = Reader::from_str(text);
    r.config_mut().trim_text(false);
    let mut depth = 0usize;
    let mut stub: Option<Range<usize>> = None;
    loop {
        let start = r.buffer_position() as usize;
        match r.read_event() {
            Ok(Event::Start(e)) => {
                if depth == 1 && e.name().as_ref() == tag.as_bytes() && attr_matches(&e, attr, value) {
                    // Find the matching end tag.
                    let mut d = 1usize;
                    loop {
                        match r.read_event() {
                            Ok(Event::Start(_)) => d += 1,
                            Ok(Event::End(_)) => {
                                d -= 1;
                                if d == 0 {
                                    return Some(start..r.buffer_position() as usize);
                                }
                            }
                            Ok(Event::Eof) | Err(_) => return stub,
                            _ => {}
                        }
                    }
                }
                depth += 1;
            }
            Ok(Event::Empty(e)) => {
                if depth == 1 && stub.is_none() && e.name().as_ref() == tag.as_bytes() && attr_matches(&e, attr, value) {
                    stub = Some(start..r.buffer_position() as usize);
                }
            }
            Ok(Event::End(_)) => depth = depth.saturating_sub(1),
            Ok(Event::Eof) | Err(_) => return stub,
            _ => {}
        }
    }
}

/// Read a file keeping track of its encoding: (text, was_latin1).
fn read(path: &Path) -> Result<(String, bool)> {
    let bytes = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(match String::from_utf8(bytes) {
        Ok(s) => (s, false),
        Err(e) => (latin1_to_string(e.as_bytes()), true),
    })
}

/// Parse the element currently stored in the file.
pub fn load_element(path: &Path, tag: &str, attr: &str, value: &str) -> Result<Elem> {
    let (text, _) = read(path)?;
    let range = find_element(&text, tag, attr, value).ok_or_else(|| anyhow!("<{tag} {attr}=\"{value}\"> not found in {}", path.display()))?;
    let doc = xml::parse_str(&text[range])?;
    doc.children.into_iter().next().ok_or_else(|| anyhow!("empty element"))
}

/// Replace the element in `text`, keeping the original indentation and newline style.
pub fn splice(text: &str, range: Range<usize>, new_elem: &Elem) -> String {
    let line_start = text[..range.start].rfind('\n').map_or(0, |i| i + 1);
    let prefix = &text[line_start..range.start];
    let indent: String = if prefix.chars().all(char::is_whitespace) { prefix.to_owned() } else { String::new() };
    let nl = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let mut out = String::with_capacity(text.len() + 256);
    out.push_str(&text[..range.start]);
    out.push_str(&new_elem.to_xml(&indent, nl));
    out.push_str(&text[range.end..]);
    out
}

/// Replace `<tag attr="value">` in `path` with `new_elem` (atomic write, `.bak` kept).
pub fn replace_element(path: &Path, tag: &str, attr: &str, value: &str, new_elem: &Elem) -> Result<()> {
    let (text, latin1) = read(path)?;
    let range = find_element(&text, tag, attr, value).ok_or_else(|| anyhow!("<{tag} {attr}=\"{value}\"> not found in {}", path.display()))?;
    let out = splice(&text, range, new_elem);
    let bytes = if latin1 { string_to_latin1(&out) } else { out.into_bytes() };
    crate::write_atomic(path, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "<materials>\r\n\t<brush name=\"grass\" type=\"ground\"/>\r\n\t<!-- c -->\r\n\t<brush name=\"sand\" type=\"ground\">\r\n\t\t<item id=\"231\" chance=\"1\"/>\r\n\t</brush>\r\n\t<brush name=\"grass\" type=\"ground\" z-order=\"1\">\r\n\t\t<item id=\"4526\" chance=\"10\"/>\r\n\t\t<border align=\"outer\" id=\"2\">\r\n\t\t\t<specific><conditions><match_border id=\"1\" edge=\"n\"/></conditions></specific>\r\n\t\t</border>\r\n\t</brush>\r\n\t<tileset name=\"x\"><terrain><brush name=\"grass\"/></terrain></tileset>\r\n</materials>\r\n";

    #[test]
    fn finds_full_definition_not_stub_or_tileset_entry() {
        let r = find_element(SAMPLE, "brush", "name", "grass").unwrap();
        assert!(SAMPLE[r.clone()].starts_with("<brush name=\"grass\" type=\"ground\" z-order"));
        assert!(SAMPLE[r].ends_with("</brush>"));
        let r = find_element(SAMPLE, "brush", "name", "sand").unwrap();
        assert!(SAMPLE[r].contains("231"));
        assert!(find_element(SAMPLE, "brush", "name", "nope").is_none());
    }

    #[test]
    fn splice_keeps_rest_of_file() {
        let r = find_element(SAMPLE, "brush", "name", "grass").unwrap();
        let mut e = xml::parse_str(&SAMPLE[r.clone()]).unwrap().children.remove(0);
        // Serialising the unchanged element and parsing it again gives the same tree.
        let again = xml::parse_str(&e.to_xml("", "\n")).unwrap().children.remove(0);
        assert_eq!(again, e);
        e.children.push(Elem::new("item", &[("id", "4527"), ("chance", "5")]));
        let out = splice(SAMPLE, r.clone(), &e);
        assert_eq!(&out[..r.start], &SAMPLE[..r.start], "prefix unchanged");
        assert!(out.ends_with(&SAMPLE[r.end..]), "suffix unchanged");
        assert!(out.contains("<item id=\"4527\" chance=\"5\"/>\r\n\t</brush>"), "CRLF + indentation kept: {out}");
        let r2 = find_element(&out, "brush", "name", "grass").unwrap();
        let back = xml::parse_str(&out[r2]).unwrap().children.remove(0);
        assert_eq!(back, e);
    }

    #[test]
    fn replace_in_latin1_file() {
        let dir = std::env::temp_dir().join(format!("pme-xmledit-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("b.xml");
        let mut bytes = b"<materials>\n<!-- p\xe9 -->\n<border id=\"7\">\n\t<borderitem edge=\"n\" item=\"1\"/>\n</border>\n</materials>\n".to_vec();
        std::fs::write(&p, &bytes).unwrap();
        let mut e = load_element(&p, "border", "id", "7").unwrap();
        e.children[0].set_attr("item", "99");
        replace_element(&p, "border", "id", "7", &e).unwrap();
        let after = std::fs::read(&p).unwrap();
        assert!(after.windows(4).any(|w| w == b"p\xe9 -"), "latin-1 byte preserved");
        bytes.clear();
        assert!(String::from_utf8_lossy(&after).contains("item=\"99\""));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
