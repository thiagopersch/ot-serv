//! Minimal XML DOM on top of quick-xml. The OT data files are small enough to load whole,
//! and a tree makes the nested RME material formats much simpler to read.

use std::path::Path;

use anyhow::{Context, Result};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use crate::binary::latin1_to_string;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Elem {
    pub name: String,
    pub attrs: Vec<(String, String)>,
    pub children: Vec<Elem>,
}

impl Elem {
    pub fn attr(&self, key: &str) -> Option<&str> {
        self.attrs.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v.as_str())
    }

    pub fn attr_or<'a>(&'a self, key: &str, default: &'a str) -> &'a str {
        self.attr(key).unwrap_or(default)
    }

    pub fn int<T: std::str::FromStr>(&self, key: &str) -> Option<T> {
        self.attr(key).and_then(|v| v.trim().parse().ok())
    }

    pub fn bool(&self, key: &str) -> bool {
        self.attr(key).is_some_and(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "true" | "1" | "yes"))
    }

    pub fn new(name: &str, attrs: &[(&str, &str)]) -> Self {
        Self { name: name.to_owned(), attrs: attrs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(), children: Vec::new() }
    }

    /// Set (or add, keeping attribute order) an attribute.
    pub fn set_attr(&mut self, key: &str, value: impl Into<String>) {
        let value = value.into();
        match self.attrs.iter_mut().find(|(k, _)| k.eq_ignore_ascii_case(key)) {
            Some(slot) => slot.1 = value,
            None => self.attrs.push((key.to_owned(), value)),
        }
    }

    pub fn remove_attr(&mut self, key: &str) {
        self.attrs.retain(|(k, _)| !k.eq_ignore_ascii_case(key));
    }

    /// Indices of the children with this tag name.
    pub fn child_indices(&self, name: &str) -> Vec<usize> {
        self.children.iter().enumerate().filter(|(_, c)| c.is(name)).map(|(i, _)| i).collect()
    }

    /// Serialize; `indent` is the indentation of this element, `nl` the newline to use.
    /// The first line is not indented (the caller already is at the right column).
    pub fn to_xml(&self, indent: &str, nl: &str) -> String {
        let mut s = String::new();
        self.write(&mut s, indent, nl);
        s
    }

    fn write(&self, s: &mut String, indent: &str, nl: &str) {
        s.push('<');
        s.push_str(&self.name);
        for (k, v) in &self.attrs {
            s.push(' ');
            s.push_str(k);
            s.push_str("=\"");
            s.push_str(&escape(v));
            s.push('"');
        }
        if self.children.is_empty() {
            s.push_str("/>");
            return;
        }
        s.push('>');
        let inner = format!("{indent}\t");
        for c in &self.children {
            s.push_str(nl);
            s.push_str(&inner);
            c.write(s, &inner, nl);
        }
        s.push_str(nl);
        s.push_str(indent);
        s.push_str("</");
        s.push_str(&self.name);
        s.push('>');
    }

    pub fn is(&self, name: &str) -> bool {
        self.name.eq_ignore_ascii_case(name)
    }

    pub fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Elem> + 'a {
        self.children.iter().filter(move |c| c.is(name))
    }
}

fn read_start(e: &BytesStart) -> Elem {
    let name = latin1_to_string(e.name().as_ref());
    let attrs = e
        .attributes()
        .flatten()
        .map(|a| {
            let k = latin1_to_string(a.key.as_ref());
            let v = a.unescape_value().map(|c| c.into_owned()).unwrap_or_else(|_| latin1_to_string(&a.value));
            (k, v)
        })
        .collect();
    Elem { name, attrs, children: Vec::new() }
}

/// Parse a whole document; returns a synthetic root whose children are the top-level elements.
pub fn parse_str(text: &str) -> Result<Elem> {
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(true);
    let mut stack: Vec<Elem> = vec![Elem { name: "#document".into(), ..Default::default() }];
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => stack.push(read_start(&e)),
            Ok(Event::Empty(e)) => {
                let el = read_start(&e);
                stack.last_mut().unwrap().children.push(el);
            }
            Ok(Event::End(_)) => {
                if stack.len() > 1 {
                    let el = stack.pop().unwrap();
                    stack.last_mut().unwrap().children.push(el);
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(e) => anyhow::bail!("XML error at byte {}: {e}", reader.buffer_position()),
        }
    }
    while stack.len() > 1 {
        let el = stack.pop().unwrap();
        stack.last_mut().unwrap().children.push(el);
    }
    Ok(stack.pop().unwrap())
}

/// Read a file as UTF-8, falling back to Latin-1 (OT files are often ISO-8859-1).
pub fn read_text(path: &Path) -> Result<String> {
    let bytes = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => latin1_to_string(e.as_bytes()),
    })
}

pub fn parse_file(path: &Path) -> Result<Elem> {
    parse_str(&read_text(path)?).with_context(|| format!("parsing {}", path.display()))
}

/// Escape text for attribute values.
pub fn escape(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => o.push_str("&amp;"),
            '<' => o.push_str("&lt;"),
            '>' => o.push_str("&gt;"),
            '"' => o.push_str("&quot;"),
            _ => o.push(c),
        }
    }
    o
}
