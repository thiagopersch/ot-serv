//! Tiny translation layer. Strings live in `assets/i18n/<lang>.txt` as `key = value` lines
//! (embedded at compile time). `t("key")` returns the text for the current language,
//! falling back to Portuguese and then to the key itself.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum Lang {
    Pt,
    En,
}

impl Lang {
    pub fn label(self) -> &'static str {
        match self {
            Lang::Pt => "Português (BR)",
            Lang::En => "English",
        }
    }
}

const PT: &str = include_str!("../../../assets/i18n/pt-BR.txt");
const EN: &str = include_str!("../../../assets/i18n/en.txt");

static CURRENT: AtomicU8 = AtomicU8::new(0);

fn parse(src: &'static str) -> HashMap<&'static str, String> {
    src.lines()
        .filter(|l| !l.trim_start().starts_with('#'))
        .filter_map(|l| l.split_once('='))
        .map(|(k, v)| (k.trim(), v.trim().replace("\\n", "\n")))
        .collect()
}

fn tables() -> &'static [HashMap<&'static str, String>; 2] {
    static T: OnceLock<[HashMap<&'static str, String>; 2]> = OnceLock::new();
    T.get_or_init(|| [parse(PT), parse(EN)])
}

pub fn set_lang(l: Lang) {
    CURRENT.store(l as u8, Ordering::Relaxed);
}

pub fn t(key: &'static str) -> &'static str {
    let tbl = tables();
    let i = CURRENT.load(Ordering::Relaxed) as usize;
    tbl[i].get(key).or_else(|| tbl[0].get(key)).map(|s| s.as_str()).unwrap_or(key)
}

/// `t` with `{0}`, `{1}`... placeholders.
pub fn tf(key: &'static str, args: &[&dyn std::fmt::Display]) -> String {
    let mut s = t(key).to_owned();
    for (i, a) in args.iter().enumerate() {
        s = s.replace(&format!("{{{i}}}"), &a.to_string());
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_languages_have_the_same_keys() {
        let [pt, en] = tables();
        let mut missing: Vec<_> = pt.keys().filter(|k| !en.contains_key(*k)).map(|k| format!("en: {k}")).collect();
        missing.extend(en.keys().filter(|k| !pt.contains_key(*k)).map(|k| format!("pt: {k}")));
        assert!(missing.is_empty(), "missing translations: {missing:?}");
    }

    #[test]
    fn every_key_used_in_source_exists() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let [pt, _] = tables();
        let re_keys = |src: &str| -> Vec<String> {
            let mut out = Vec::new();
            for pat in ["t(\"", "tf(\""] {
                let mut rest = src;
                while let Some(i) = rest.find(pat) {
                    let before = rest[..i].chars().last();
                    rest = &rest[i + pat.len()..];
                    if before.is_some_and(|c| c.is_alphanumeric() || c == '_') {
                        continue;
                    }
                    if let Some(end) = rest.find('"') {
                        out.push(rest[..end].to_owned());
                    }
                }
            }
            out
        };
        let mut missing = Vec::new();
        for f in std::fs::read_dir(dir).unwrap().flatten() {
            let src = std::fs::read_to_string(f.path()).unwrap();
            for k in re_keys(&src) {
                if !pt.contains_key(k.as_str()) && k != "key" {
                    missing.push(k);
                }
            }
        }
        missing.sort();
        missing.dedup();
        assert!(missing.is_empty(), "keys used but not translated: {missing:?}");
    }
}
