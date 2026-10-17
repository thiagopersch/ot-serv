//! Tibia.dat metadata (8.60 layout, "extended" u32 sprite ids optional).
//! Port of RME `GraphicManager::loadSpriteMetadata(Flags)` for DAT_FORMAT_86.

use std::path::Path;

use anyhow::{bail, Context, Result};
use pme_core::items::{ItemDb, SpriteInfo};

#[derive(Clone, Copy, Debug)]
pub struct DatOptions {
    /// u32 sprite ids (OTFI `extended: true`).
    pub extended: bool,
    pub frame_durations: bool,
    pub frame_groups: bool,
}

impl Default for DatOptions {
    fn default() -> Self {
        Self { extended: true, frame_durations: false, frame_groups: false }
    }
}

/// Read `extended / frame-durations / frame-groups` from a `Tibia.otfi` next to the dat.
pub fn read_otfi(path: &Path) -> Option<DatOptions> {
    let text = std::fs::read_to_string(path).ok()?;
    let mut o = DatOptions::default();
    for line in text.lines() {
        let Some((k, v)) = line.trim().split_once(':') else { continue };
        let v = v.trim() == "true";
        match k.trim() {
            "extended" => o.extended = v,
            "frame-durations" => o.frame_durations = v,
            "frame-groups" => o.frame_groups = v,
            _ => {}
        }
    }
    Some(o)
}

struct Cur<'a> {
    d: &'a [u8],
    p: usize,
}

impl Cur<'_> {
    fn u8(&mut self) -> Result<u8> {
        let v = *self.d.get(self.p).context("unexpected end of Tibia.dat")?;
        self.p += 1;
        Ok(v)
    }
    fn u16(&mut self) -> Result<u16> {
        Ok(self.u8()? as u16 | (self.u8()? as u16) << 8)
    }
    fn u32(&mut self) -> Result<u32> {
        Ok(self.u16()? as u32 | (self.u16()? as u32) << 16)
    }
    fn skip(&mut self, n: usize) -> Result<()> {
        if self.p + n > self.d.len() {
            bail!("unexpected end of Tibia.dat");
        }
        self.p += n;
        Ok(())
    }
}

fn read_flags(c: &mut Cur, s: &mut SpriteInfo) -> Result<()> {
    loop {
        let flag = c.u8()?;
        match flag {
            0xFF => return Ok(()),
            0 => {
                s.is_ground = true;
                c.skip(2)?;
            }
            5 => s.is_stackable = true,
            10 => s.is_fluid = true,
            11 => s.is_splash = true,
            17 => s.is_hangable = true,
            18 => s.is_hook_south = true,
            19 => s.is_hook_east = true,
            27 => s.animate_always = true,
            1..=4 | 6 | 7 | 12..=16 | 20 | 22 | 23 | 26 | 30 | 31 | 35..=37 => {}
            8 | 9 | 29 | 32 | 34 => c.skip(2)?,
            21 => {
                s.light_level = c.u16()?;
                s.light_color = c.u16()?;
            }
            24 => {
                s.offset_x = c.u16()?;
                s.offset_y = c.u16()?;
            }
            25 => s.elevation = c.u16()?,
            28 => {
                s.minimap_color = c.u16()?;
                s.has_minimap_color = true;
            }
            33 => {
                c.skip(6)?;
                let n = c.u16()? as usize;
                c.skip(n + 4)?;
            }
            other => bail!("Tibia.dat: unknown flag {other} at offset {}", c.p - 1),
        }
    }
}

fn read_thing(c: &mut Cur, o: &DatOptions, is_outfit: bool) -> Result<SpriteInfo> {
    let mut s = SpriteInfo::default();
    read_flags(c, &mut s)?;
    let groups = if o.frame_groups && is_outfit { c.u8()? } else { 1 };
    for g in 0..groups {
        if o.frame_groups && is_outfit {
            c.u8()?; // group type
        }
        let width = c.u8()?;
        let height = c.u8()?;
        if width > 1 || height > 1 {
            c.u8()?; // exact size
        }
        let layers = c.u8()?;
        let px = c.u8()?;
        let py = c.u8()?;
        let pz = c.u8()?;
        let frames = c.u8()?;
        if frames > 1 && o.frame_durations {
            c.skip(1 + 4 + 1)?;
            c.skip(frames as usize * 8)?;
        }
        let n = width as usize * height as usize * layers as usize * px as usize * py as usize * pz as usize * frames as usize;
        let mut ids = Vec::with_capacity(n);
        for _ in 0..n {
            ids.push(if o.extended { c.u32()? } else { c.u16()? as u32 });
        }
        // Only the first frame group (idle) is kept.
        if g == 0 {
            s.width = width;
            s.height = height;
            s.layers = layers;
            s.pattern_x = px;
            s.pattern_y = py;
            s.pattern_z = pz;
            s.frames = frames;
            s.sprite_ids = ids;
        }
    }
    Ok(s)
}

/// Load item and outfit sprite metadata into `db.sprites` / `db.outfits`.
pub fn load_dat(path: &Path, opts: &DatOptions, db: &mut ItemDb) -> Result<u32> {
    let data = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    let mut c = Cur { d: &data, p: 0 };
    let signature = c.u32()?;
    let item_count = c.u16()? as usize;
    let outfit_count = c.u16()? as usize;
    let _effects = c.u16()?;
    let _missiles = c.u16()?;
    db.sprites = vec![SpriteInfo::default(); item_count + 1];
    for id in 100..=item_count {
        db.sprites[id] = read_thing(&mut c, opts, false).with_context(|| format!("Tibia.dat item {id}"))?;
    }
    db.outfits = vec![SpriteInfo::default(); outfit_count + 1];
    for id in 1..=outfit_count {
        db.outfits[id] = read_thing(&mut c, opts, true).with_context(|| format!("Tibia.dat outfit {id}"))?;
    }
    Ok(signature)
}
