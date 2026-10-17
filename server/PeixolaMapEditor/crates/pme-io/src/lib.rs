//! File formats: OTBM, items.otb/xml, Tibia.dat/spr, houses/spawns XML, RME materials XML.

pub mod binary;
pub mod creatures;
pub mod dat;
pub mod materials_writer;
pub mod materials_xml;
pub mod otb;
pub mod otbm;
pub mod spr;
pub mod tileset_edit;
pub mod world_xml;
pub mod xml;
pub mod xml_edit;

use std::path::Path;

use anyhow::{Context, Result};

/// Write `bytes` to `<path>.tmp`, keep the old file as `<path>.bak`, then rename into place.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = std::path::PathBuf::from(tmp);
    std::fs::write(&tmp, bytes).with_context(|| format!("writing {}", tmp.display()))?;
    if path.exists() {
        let mut bak = path.as_os_str().to_owned();
        bak.push(".bak");
        let _ = std::fs::copy(path, std::path::PathBuf::from(bak));
    }
    std::fs::rename(&tmp, path).with_context(|| format!("replacing {}", path.display()))?;
    Ok(())
}
