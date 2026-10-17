//! Minimap: Tibia minimap colours around the view centre. It fills the sidebar width (square)
//! and is regenerated when the map changes, the view moves far enough or the panel resizes.

use eframe::egui::{self, Color32, ColorImage, Pos2, Rect, Sense, TextureHandle, TextureOptions, Vec2};
use pme_core::items::ItemDb;
use pme_core::map::Map;
use pme_core::position::Position;

/// Tiles shown at minimap zoom 1.
const BASE_SPAN: f32 = 256.0;

pub struct Minimap {
    tex: Option<TextureHandle>,
    origin: (i32, i32, u8),
    span: i32,
    res: usize,
    rev: u64,
    last_build: f64,
    pub scale: f32,
}

impl Default for Minimap {
    fn default() -> Self {
        Self { tex: None, origin: (-1, -1, 255), span: 0, res: 0, rev: u64::MAX, last_build: 0.0, scale: 1.0 }
    }
}

/// Tibia 8-bit minimap palette (6x6x6 colour cube).
pub fn palette(c: u8) -> Color32 {
    let c = c as u32;
    Color32::from_rgb((c / 36 % 6 * 51) as u8, (c / 6 % 6 * 51) as u8, (c % 6 * 51) as u8)
}

impl Minimap {
    /// Texture covers `span` x `span` tiles from (ox, oy), sampled into `res` x `res` pixels.
    #[allow(clippy::too_many_arguments)]
    fn build(&mut self, ctx: &egui::Context, map: &Map, db: &ItemDb, ox: i32, oy: i32, z: u8, span: i32, res: usize) {
        let mut img = ColorImage::new([res, res], Color32::from_rgb(12, 12, 16));
        let step = span as f32 / res as f32;
        for py in 0..res {
            let y = oy + (py as f32 * step) as i32;
            for px in 0..res {
                let x = ox + (px as f32 * step) as i32;
                if let Some(c) = map.get_xyz(x, y, z).and_then(|t| t.minimap_color(db)) {
                    img.pixels[py * res + px] = palette(c);
                }
            }
        }
        match &mut self.tex {
            Some(t) => t.set(img, TextureOptions::NEAREST),
            None => self.tex = Some(ctx.load_texture("minimap", img, TextureOptions::NEAREST)),
        }
        self.origin = (ox, oy, z);
        self.span = span;
        self.res = res;
        self.rev = map.revision;
        self.last_build = ctx.input(|i| i.time);
    }

    /// Show the minimap; returns a map position if the user clicked/dragged on it.
    pub fn ui(&mut self, ui: &mut egui::Ui, map: &Map, db: &ItemDb, center: Position, view_tiles: Vec2) -> Option<Position> {
        let ctx = ui.ctx().clone();
        let side = ui.available_width().max(64.0);
        // Texture resolution follows the on-screen size (sharp on wide sidebars).
        let res = if side > 300.0 { 512 } else { 256 };
        let span = (BASE_SPAN / self.scale).round() as i32;
        let (ox, oy) = (center.x as i32 - span / 2, center.y as i32 - span / 2);
        let now = ctx.input(|i| i.time);
        let moved = (ox - self.origin.0).abs() > span / 8 || (oy - self.origin.1).abs() > span / 8 || center.z != self.origin.2 || span != self.span || res != self.res;
        let changed = map.revision != self.rev && now - self.last_build > 0.5;
        if self.tex.is_none() || moved || changed {
            self.build(&ctx, map, db, ox, oy, center.z, span, res);
        }
        let (rect, resp) = ui.allocate_exact_size(Vec2::splat(side), Sense::click_and_drag());
        let painter = ui.painter_at(rect);
        painter.rect_filled(rect, 2.0, Color32::from_rgb(12, 12, 16));
        let px_per_tile = side / span as f32;
        if let Some(t) = &self.tex {
            // The texture may lag behind the view by up to span/8 tiles: shift the UVs.
            let du = (ox - self.origin.0) as f32 / span as f32;
            let dv = (oy - self.origin.1) as f32 / span as f32;
            painter.image(t.id(), rect, Rect::from_min_size(Pos2::new(du, dv), Vec2::splat(1.0)), Color32::WHITE);
        }
        let vr = Rect::from_center_size(rect.center(), view_tiles * px_per_tile);
        painter.rect_stroke(vr, 0.0, egui::Stroke::new(1.0_f32, Color32::WHITE), egui::StrokeKind::Inside);
        if resp.hovered() {
            let scroll = ui.input(|i| i.smooth_scroll_delta.y);
            if scroll != 0.0 {
                self.scale = (self.scale * if scroll > 0.0 { 1.1 } else { 0.9 }).clamp(0.125, 4.0);
            }
        }
        if resp.clicked() || resp.dragged() {
            if let Some(p) = resp.interact_pointer_pos() {
                let d = (p - rect.min) / px_per_tile;
                let x = (ox + d.x as i32).clamp(0, 65535) as u16;
                let y = (oy + d.y as i32).clamp(0, 65535) as u16;
                return Some(Position::new(x, y, center.z));
            }
        }
        None
    }
}
