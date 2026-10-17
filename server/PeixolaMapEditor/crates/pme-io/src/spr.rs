//! Tibia.spr reader. The file is memory-mapped (1+ GB custom sprite files are fine);
//! sprites are decoded lazily from RLE to RGBA.

use std::fs::File;
use std::path::Path;

use anyhow::{bail, Context, Result};
use memmap2::Mmap;

pub const SPRITE_SIZE: usize = 32;
pub const SPRITE_BYTES: usize = SPRITE_SIZE * SPRITE_SIZE * 4;

pub struct SpriteFile {
    mmap: Mmap,
    pub signature: u32,
    pub count: u32,
    table_start: usize,
    pub alpha: bool,
}

impl SpriteFile {
    pub fn open(path: &Path, extended: bool, alpha: bool) -> Result<Self> {
        let f = File::open(path).with_context(|| format!("opening {}", path.display()))?;
        // SAFETY: the sprite file is opened read-only; external modification while the editor
        // runs is not supported (same as every OT tool).
        let mmap = unsafe { Mmap::map(&f) }.with_context(|| format!("mapping {}", path.display()))?;
        if mmap.len() < 8 {
            bail!("Tibia.spr too small");
        }
        let signature = u32::from_le_bytes(mmap[0..4].try_into().unwrap());
        let (count, table_start) = if extended {
            (u32::from_le_bytes(mmap[4..8].try_into().unwrap()), 8)
        } else {
            (u16::from_le_bytes(mmap[4..6].try_into().unwrap()) as u32, 6)
        };
        if table_start + count as usize * 4 > mmap.len() {
            bail!("Tibia.spr: offset table exceeds file size");
        }
        Ok(Self { mmap, signature, count, table_start, alpha })
    }

    /// Decode sprite `id` (1-based) into `out` (32*32 RGBA, unpremultiplied).
    /// Returns false for empty / invalid sprites (out is cleared to transparent).
    pub fn decode(&self, id: u32, out: &mut [u8; SPRITE_BYTES]) -> bool {
        out.fill(0);
        if id == 0 || id > self.count {
            return false;
        }
        let m = &self.mmap[..];
        let t = self.table_start + (id as usize - 1) * 4;
        let off = u32::from_le_bytes(m[t..t + 4].try_into().unwrap()) as usize;
        if off == 0 || off + 5 > m.len() {
            return false;
        }
        // 3 bytes colour key, u16 data size
        let size = u16::from_le_bytes([m[off + 3], m[off + 4]]) as usize;
        let mut p = off + 5;
        let end = (p + size).min(m.len());
        let bpp = if self.alpha { 4 } else { 3 };
        let mut px = 0usize;
        const TOTAL: usize = SPRITE_SIZE * SPRITE_SIZE;
        while p + 4 <= end && px < TOTAL {
            let transparent = u16::from_le_bytes([m[p], m[p + 1]]) as usize;
            let colored = u16::from_le_bytes([m[p + 2], m[p + 3]]) as usize;
            p += 4;
            px += transparent;
            for _ in 0..colored {
                if px >= TOTAL || p + bpp > end {
                    break;
                }
                let o = px * 4;
                out[o] = m[p];
                out[o + 1] = m[p + 1];
                out[o + 2] = m[p + 2];
                out[o + 3] = if self.alpha { m[p + 3] } else { 255 };
                p += bpp;
                px += 1;
            }
        }
        true
    }
}
