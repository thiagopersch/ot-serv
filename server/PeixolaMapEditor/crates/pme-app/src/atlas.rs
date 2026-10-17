//! Sprite atlas: sprites are decoded lazily from the memory-mapped Tibia.spr and packed into a
//! few large GPU textures (4096²), updated in place with `set_partial`. A whole map view is then
//! drawn with one mesh per atlas page, instead of one texture per sprite as in RME.
//!
//! HD Mode (like the client's `hdSprites`): every sprite is upscaled 32 → 64 px with xBRZ before
//! upload. Geometry stays in 32 px world units, only the texture resolution changes.

use std::sync::Arc;
use std::time::{Duration, Instant};

use ahash::AHashMap;
use eframe::egui::{self, Color32, ColorImage, Pos2, Rect, TextureFilter, TextureHandle, TextureId, TextureOptions};
use pme_io::spr::{SpriteFile, SPRITE_BYTES, SPRITE_SIZE};

const PAGE: usize = 4096;
/// Time spent decoding/upscaling/uploading sprites per frame (keeps scrolling smooth; the rest
/// arrives over the next frames).
const FRAME_BUDGET: Duration = Duration::from_millis(10);
const EMPTY: u32 = u32::MAX;

pub enum Lookup {
    Ready(TextureId, Rect),
    Empty,
    Pending,
}

/// Upscale a 32x32 RGBA sprite to 64x64 with xBRZ (same algorithm as the client's HD Mode).
///
/// xBRZ treats pixels outside the image as transparent, which turns the border of opaque
/// sprites (grounds) semi-transparent and shows seams between tiles. So the sprite is first
/// padded by 1 px repeating its edges (34x34 → 68x68) and the centre 64x64 is kept.
pub fn hd_upscale(src: &[u8; SPRITE_BYTES]) -> Vec<u8> {
    const S: usize = SPRITE_SIZE;
    const P: usize = S + 2;
    let mut padded = vec![0u8; P * P * 4];
    for y in 0..P {
        let sy = y.saturating_sub(1).min(S - 1);
        for x in 0..P {
            let sx = x.saturating_sub(1).min(S - 1);
            let (d, s) = ((y * P + x) * 4, (sy * S + sx) * 4);
            padded[d..d + 4].copy_from_slice(&src[s..s + 4]);
        }
    }
    let big = xbrz::scale_rgba(&padded, P, P, 2);
    let (bw, out_w) = (P * 2, S * 2);
    let mut out = vec![0u8; out_w * out_w * 4];
    for y in 0..out_w {
        let from = ((y + 2) * bw + 2) * 4;
        out[y * out_w * 4..(y + 1) * out_w * 4].copy_from_slice(&big[from..from + out_w * 4]);
    }
    out
}

/// Surround a `px`x`px` RGBA image with `pad` pixels that repeat its edges (clamp-to-edge).
fn pad_edges(src: &[u8], px: usize, pad: usize) -> Vec<u8> {
    let cell = px + 2 * pad;
    let mut out = vec![0u8; cell * cell * 4];
    for y in 0..cell {
        let sy = y.saturating_sub(pad).min(px - 1);
        for x in 0..cell {
            let sx = x.saturating_sub(pad).min(px - 1);
            let (d, s) = ((y * cell + x) * 4, (sy * px + sx) * 4);
            out[d..d + 4].copy_from_slice(&src[s..s + 4]);
        }
    }
    out
}

/// Slot geometry of the atlas pages.
#[derive(Clone, Copy)]
struct Layout {
    /// Sprite size stored in the atlas (32, or 64 in HD).
    px: usize,
    /// Cell size (sprite + transparent padding, so linear filtering never bleeds).
    cell: usize,
    pad: usize,
    per_row: usize,
    slots: usize,
    max_pages: usize,
    options: TextureOptions,
}

impl Layout {
    fn new(hd: bool) -> Self {
        if hd {
            let cell = 66;
            let per_row = PAGE / cell;
            let options = TextureOptions { magnification: TextureFilter::Nearest, minification: TextureFilter::Linear, ..TextureOptions::NEAREST };
            Self { px: 64, cell, pad: 1, per_row, slots: per_row * per_row, max_pages: 6, options }
        } else {
            let per_row = PAGE / SPRITE_SIZE;
            Self { px: SPRITE_SIZE, cell: SPRITE_SIZE, pad: 0, per_row, slots: per_row * per_row, max_pages: 4, options: TextureOptions::NEAREST }
        }
    }
}

pub struct Atlas {
    spr: Arc<SpriteFile>,
    hd: bool,
    layout: Layout,
    pages: Vec<TextureHandle>,
    /// Keys stored in each page (for eviction).
    page_sprites: Vec<Vec<u64>>,
    /// Key → page/slot handle. Plain sprites use the sprite id; coloured outfit sprites set
    /// bit 63 and pack the four colours in bits 24..56 (sprite ids fit in 24 bits).
    map: AHashMap<u64, u32>,
    mask: Box<[u8; SPRITE_BYTES]>,
    cur_page: usize,
    cur_slot: usize,
    deadline: Instant,
    /// Bumped when sprites are evicted (cached meshes become invalid).
    pub generation: u64,
    /// Set when a lookup returned `Pending` this frame.
    pub missing: bool,
    buf: Box<[u8; SPRITE_BYTES]>,
}

impl Atlas {
    pub fn new(spr: Arc<SpriteFile>, hd: bool) -> Self {
        Self {
            spr,
            hd,
            layout: Layout::new(hd),
            pages: Vec::new(),
            page_sprites: Vec::new(),
            map: AHashMap::new(),
            cur_page: 0,
            cur_slot: 0,
            deadline: Instant::now() + FRAME_BUDGET,
            generation: 0,
            missing: false,
            buf: Box::new([0; SPRITE_BYTES]),
            mask: Box::new([0; SPRITE_BYTES]),
        }
    }

    pub fn hd(&self) -> bool {
        self.hd
    }

    pub fn begin_frame(&mut self) {
        self.deadline = Instant::now() + FRAME_BUDGET;
        self.missing = false;
    }

    #[inline]
    fn uv(&self, handle: u32) -> Rect {
        let l = self.layout;
        let slot = (handle & 0xFFFF) as usize;
        let x = ((slot % l.per_row) * l.cell + l.pad) as f32 / PAGE as f32;
        let y = ((slot / l.per_row) * l.cell + l.pad) as f32 / PAGE as f32;
        let s = l.px as f32 / PAGE as f32;
        Rect::from_min_max(Pos2::new(x, y), Pos2::new(x + s, y + s))
    }

    /// Cached lookup; on a miss `fill` decodes into `self.buf` (returns false if empty).
    fn lookup(&mut self, ctx: &egui::Context, key: u64, fill: impl FnOnce(&mut Self) -> bool) -> Lookup {
        if let Some(&h) = self.map.get(&key) {
            if h == EMPTY {
                return Lookup::Empty;
            }
            return Lookup::Ready(self.pages[(h >> 16) as usize].id(), self.uv(h));
        }
        if Instant::now() > self.deadline {
            self.missing = true;
            return Lookup::Pending;
        }
        if !fill(self) || self.buf.chunks_exact(4).all(|p| p[3] == 0) {
            self.map.insert(key, EMPTY);
            return Lookup::Empty;
        }
        let h = self.alloc(ctx);
        let (page, slot) = ((h >> 16) as usize, (h & 0xFFFF) as usize);
        let l = self.layout;
        // In HD the whole cell is uploaded: the sprite plus a 1 px border that repeats its edge
        // pixels, so linear filtering at the sprite edge never blends with a neighbour or with
        // transparency (that would show seams between ground tiles).
        let img = if self.hd {
            ColorImage::from_rgba_unmultiplied([l.cell, l.cell], &pad_edges(&hd_upscale(&self.buf), l.px, l.pad))
        } else {
            ColorImage::from_rgba_unmultiplied([l.px, l.px], &self.buf[..])
        };
        let pos = [(slot % l.per_row) * l.cell, (slot / l.per_row) * l.cell];
        self.pages[page].set_partial(pos, img, l.options);
        self.page_sprites[page].push(key);
        self.map.insert(key, h);
        Lookup::Ready(self.pages[page].id(), self.uv(h))
    }

    pub fn get(&mut self, ctx: &egui::Context, sprite_id: u32) -> Lookup {
        self.lookup(ctx, sprite_id as u64, |a| a.spr.decode(sprite_id, &mut a.buf))
    }

    /// Outfit sprite coloured with `[head, body, legs, feet]` using the template `mask_id`.
    /// Colouring happens at 32 px, before any HD upscale, so masks never get xBRZ artefacts.
    pub fn get_outfit(&mut self, ctx: &egui::Context, sprite_id: u32, mask_id: u32, colors: [u8; 4]) -> Lookup {
        let key = (1u64 << 63) | ((u32::from_le_bytes(colors) as u64) << 24) | (sprite_id as u64 & 0xFF_FFFF);
        self.lookup(ctx, key, |a| {
            if !a.spr.decode(sprite_id, &mut a.buf) {
                return false;
            }
            if a.spr.decode(mask_id, &mut a.mask) {
                crate::outfit::colorize(&mut a.buf, &a.mask, colors);
            }
            true
        })
    }

    fn alloc(&mut self, ctx: &egui::Context) -> u32 {
        let l = self.layout;
        if self.cur_slot >= l.slots {
            self.cur_slot = 0;
            self.cur_page += 1;
            if self.cur_page >= l.max_pages {
                self.cur_page = 0;
            }
            // Evict whatever lived in the page we are about to reuse.
            if let Some(old) = self.page_sprites.get_mut(self.cur_page) {
                for id in old.drain(..) {
                    self.map.remove(&id);
                }
                self.generation += 1;
            }
        }
        if self.cur_page >= self.pages.len() {
            let img = ColorImage::new([PAGE, PAGE], Color32::TRANSPARENT);
            let name = format!("sprite-atlas-{}{}", if self.hd { "hd-" } else { "" }, self.pages.len());
            self.pages.push(ctx.load_texture(name, img, l.options));
            self.page_sprites.push(Vec::with_capacity(l.slots));
        }
        let h = ((self.cur_page as u32) << 16) | self.cur_slot as u32;
        self.cur_slot += 1;
        h
    }

    pub fn resident(&self) -> usize {
        self.map.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hd_upscale_doubles_and_keeps_colors() {
        let empty = [0u8; SPRITE_BYTES];
        let out = hd_upscale(&empty);
        assert_eq!(out.len(), 64 * 64 * 4);
        assert!(out.chunks_exact(4).all(|p| p[3] == 0), "transparent stays transparent");

        let mut solid = [0u8; SPRITE_BYTES];
        for p in solid.chunks_exact_mut(4) {
            p.copy_from_slice(&[200, 40, 90, 255]);
        }
        let out = hd_upscale(&solid);
        assert!(out.chunks_exact(4).all(|p| p == [200, 40, 90, 255]), "a flat colour stays the same colour");
    }

    #[test]
    fn hd_layout_fits_page() {
        let l = Layout::new(true);
        assert!(l.per_row * l.cell <= PAGE && l.slots < u16::MAX as usize);
        assert_eq!(l.px + 2 * l.pad, l.cell);
    }
}
