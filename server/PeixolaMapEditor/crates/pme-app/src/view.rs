//! Map rendering. Port of RME `MapDrawer::DrawMap / DrawTile / BlitItem` on top of egui
//! meshes: sprites come from the [`Atlas`] and are emitted in painter order into as few
//! meshes as possible (a new mesh only when the texture page changes).

use std::sync::Arc;

use ahash::AHashSet;
use eframe::egui::{self, epaint::WHITE_UV, Color32, Mesh, Pos2, Rect, Shape, TextureId, Vec2};
use pme_core::item::Item;
use pme_core::items::{otb_flags, ItemDb};
use pme_core::map::Map;
use pme_core::position::Position;
use pme_core::tile::{flags, Tile};
use pme_core::GROUND_LAYER;

use crate::assets::Assets;
use crate::atlas::{Atlas, Lookup};
use crate::settings::View;

pub const TILE: f32 = 32.0;

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Camera {
    /// World pixel (zoom 1, floor-offset space) shown at the top-left of the canvas.
    pub x: f32,
    pub y: f32,
    pub zoom: f32,
    pub floor: u8,
}

impl Default for Camera {
    fn default() -> Self {
        Self { x: 1000.0 * TILE, y: 1000.0 * TILE, zoom: 1.0, floor: GROUND_LAYER }
    }
}

impl Camera {
    /// Perspective offset (in tiles) of floor `z` when looking at `self.floor`.
    #[inline]
    pub fn floor_offset(&self, z: u8) -> i32 {
        if z <= GROUND_LAYER {
            (GROUND_LAYER - z) as i32
        } else {
            self.floor as i32 - z as i32
        }
    }

    /// Map tile under a screen point on the current floor.
    pub fn tile_at(&self, rect: Rect, p: Pos2) -> (i32, i32) {
        let wx = (p.x - rect.min.x) / self.zoom + self.x;
        let wy = (p.y - rect.min.y) / self.zoom + self.y;
        let o = self.floor_offset(self.floor);
        ((wx / TILE).floor() as i32 + o, (wy / TILE).floor() as i32 + o)
    }

    /// Screen rect of tile (x, y) on floor z.
    pub fn tile_rect(&self, rect: Rect, x: i32, y: i32, z: u8) -> Rect {
        let o = self.floor_offset(z);
        let min = self.world_to_screen(rect, ((x - o) as f32) * TILE, ((y - o) as f32) * TILE);
        Rect::from_min_size(min, Vec2::splat(TILE * self.zoom))
    }

    #[inline]
    pub fn world_to_screen(&self, rect: Rect, wx: f32, wy: f32) -> Pos2 {
        Pos2::new(rect.min.x + (wx - self.x) * self.zoom, rect.min.y + (wy - self.y) * self.zoom)
    }

    /// Centre the view on a map position (and switch to its floor).
    pub fn center_on(&mut self, rect: Rect, p: Position) {
        self.floor = p.z;
        let o = self.floor_offset(p.z);
        self.x = ((p.x as i32 - o) as f32 + 0.5) * TILE - rect.width() / 2.0 / self.zoom;
        self.y = ((p.y as i32 - o) as f32 + 0.5) * TILE - rect.height() / 2.0 / self.zoom;
    }

    /// Map position at the centre of the view.
    pub fn center(&self, rect: Rect) -> Position {
        let (x, y) = self.tile_at(rect, rect.center());
        Position::new(x.clamp(0, 65535) as u16, y.clamp(0, 65535) as u16, self.floor)
    }

    /// Zoom keeping the world point under `anchor` fixed.
    pub fn zoom_at(&mut self, rect: Rect, anchor: Pos2, new_zoom: f32) {
        let new_zoom = new_zoom.clamp(0.125, 4.0);
        let wx = (anchor.x - rect.min.x) / self.zoom + self.x;
        let wy = (anchor.y - rect.min.y) / self.zoom + self.y;
        self.zoom = new_zoom;
        self.x = wx - (anchor.x - rect.min.x) / new_zoom;
        self.y = wy - (anchor.y - rect.min.y) / new_zoom;
    }

    /// Floors drawn back to front (RME `start_z .. superend_z`).
    pub fn floors(&self, all: bool) -> impl Iterator<Item = u8> {
        let start = if !all {
            self.floor
        } else if self.floor <= GROUND_LAYER {
            GROUND_LAYER
        } else {
            (self.floor + 2).min(15)
        };
        (self.floor..=start).rev()
    }
}

/// Emits quads in painter order, starting a new mesh whenever the texture changes.
pub struct Builder {
    pub meshes: Vec<Mesh>,
    pub quads: usize,
    /// Non-mesh shapes (text, circles) painted after all meshes.
    pub extra: Vec<Shape>,
}

impl Builder {
    pub fn new() -> Self {
        Self { meshes: Vec::new(), quads: 0, extra: Vec::new() }
    }

    /// Mesh using the white texture, for custom coloured geometry (light gradients).
    pub fn color_mesh(&mut self) -> &mut Mesh {
        self.mesh_for(TextureId::default())
    }

    #[inline]
    fn mesh_for(&mut self, tex: TextureId) -> &mut Mesh {
        if self.meshes.last().is_none_or(|m| m.texture_id != tex) {
            self.meshes.push(Mesh::with_texture(tex));
        }
        self.meshes.last_mut().unwrap()
    }

    #[inline]
    pub fn image(&mut self, tex: TextureId, uv: Rect, rect: Rect, tint: Color32) {
        self.quads += 1;
        self.mesh_for(tex).add_rect_with_uv(rect, uv, tint);
    }

    /// Solid colour quad (uses the font texture's white pixel, like egui itself).
    #[inline]
    pub fn fill(&mut self, rect: Rect, color: Color32) {
        self.quads += 1;
        self.mesh_for(TextureId::default()).add_rect_with_uv(rect, Rect::from_min_max(WHITE_UV, WHITE_UV), color);
    }

    pub fn outline(&mut self, rect: Rect, w: f32, color: Color32) {
        self.fill(Rect::from_min_max(rect.min, Pos2::new(rect.max.x, rect.min.y + w)), color);
        self.fill(Rect::from_min_max(Pos2::new(rect.min.x, rect.max.y - w), rect.max), color);
        self.fill(Rect::from_min_max(rect.min, Pos2::new(rect.min.x + w, rect.max.y)), color);
        self.fill(Rect::from_min_max(Pos2::new(rect.max.x - w, rect.min.y), rect.max), color);
    }

    pub fn into_shapes(self) -> Vec<Shape> {
        let mut v: Vec<Shape> = self.meshes.into_iter().filter(|m| !m.is_empty()).map(|m| Shape::mesh(Arc::new(m))).collect();
        v.extend(self.extra);
        v
    }
}

#[inline]
fn mul(c: Color32, r: u8, g: u8, b: u8) -> Color32 {
    let f = |a: u8, m: u8| ((a as u16 * m as u16) / 255) as u8;
    Color32::from_rgba_premultiplied(f(c.r(), r), f(c.g(), g), f(c.b(), b), c.a())
}

/// RME stack-count → sprite frame mapping.
fn stack_subtype(count: u16) -> i32 {
    match count {
        0..=1 => 0,
        2 => 1,
        3 => 2,
        4 => 3,
        5..=9 => 4,
        10..=24 => 5,
        25..=49 => 6,
        _ => 7,
    }
}

pub struct DrawCtx<'a> {
    pub ctx: &'a egui::Context,
    pub atlas: &'a mut Atlas,
    pub assets: &'a Assets,
    pub cam: Camera,
    pub rect: Rect,
    /// Global animation frame (0 when animations are off).
    pub frame: u32,
    /// Spawns around the view on the current floor: (x, y, radius) - used to flag creatures
    /// that are outside every spawn.
    pub spawns: Vec<(i32, i32, i32)>,
    /// Draw invisible "tech" items as coloured squares (RME `show_tech_items`).
    pub tech: bool,
}

/// RME tech items (by client id): invisible stairs (yellow), invisible walkable floor (red),
/// invisible wall (cyan). Same colours/alpha as RME `MapDrawer::BlitItem`.
pub fn tech_color(client_id: u16) -> Option<Color32> {
    match client_id {
        469 => Some(Color32::from_rgba_unmultiplied(255, 255, 0, 170)),
        470 => Some(Color32::from_rgba_unmultiplied(255, 0, 0, 170)),
        2187 => Some(Color32::from_rgba_unmultiplied(0, 255, 255, 80)),
        _ => None,
    }
}

/// Colour for items whose sprite is entirely transparent (so they never vanish).
const INVISIBLE_ITEM: Color32 = Color32::from_rgba_premultiplied(60, 60, 60, 90);

/// Apply the alpha of a (premultiplied) tint to a colour.
fn with_alpha_of(c: Color32, tint: Color32) -> Color32 {
    let a = (c.a() as u16 * tint.a() as u16 / 255) as u8;
    Color32::from_rgba_unmultiplied(c.r(), c.g(), c.b(), a)
}

impl DrawCtx<'_> {
    /// Draw one item whose tile's top-left world pixel is (`wx`, `wy`); returns the item's
    /// elevation so callers can accumulate it (RME `BlitItem` mutating draw_x/draw_y).
    #[allow(clippy::too_many_arguments)]
    pub fn item(&mut self, b: &mut Builder, item: &Item, pos: Position, tile: Option<&Tile>, wx: f32, wy: f32, tint: Color32) -> f32 {
        let db: &ItemDb = &self.assets.db;
        let Some(ty) = db.get(item.id) else { return 0.0 };
        let tile_rect = |cam: &Camera, rect: Rect| Rect::from_min_size(cam.world_to_screen(rect, wx, wy), Vec2::splat(TILE * cam.zoom));
        if self.tech {
            if let Some(c) = tech_color(ty.client_id) {
                b.fill(tile_rect(&self.cam, self.rect), with_alpha_of(c, tint));
                return 0.0;
            }
        }
        let Some(s) = db.sprite(item.id) else { return 0.0 };
        let mut visible = false;
        let sx = wx - s.offset_x as f32;
        let sy = wy - s.offset_y as f32;
        let mut subtype = -1;
        let mut px = pos.x as u32;
        if ty.is_splash() || ty.is_fluid() {
            subtype = item.subtype() as i32;
        } else if s.is_hangable {
            px = match tile {
                Some(t) if t.has_hook(db, otb_flags::HOOK_SOUTH) => 1,
                Some(t) if t.has_hook(db, otb_flags::HOOK_EAST) => 2,
                _ => 0,
            };
        } else if ty.is_stackable() {
            subtype = stack_subtype(item.subtype());
        }
        let z = self.cam.zoom;
        for cx in 0..s.width.max(1) as u32 {
            for cy in 0..s.height.max(1) as u32 {
                for layer in 0..s.layers.max(1) as u32 {
                    let idx = s.sprite_index(cx, cy, layer, subtype, px, pos.y as u32, pos.z as u32, self.frame);
                    let spr = s.sprite_ids[idx];
                    match self.atlas.get(self.ctx, spr) {
                        Lookup::Ready(tex, uv) => {
                            visible = true;
                            let min = self.cam.world_to_screen(self.rect, sx - cx as f32 * TILE, sy - cy as f32 * TILE);
                            b.image(tex, uv, Rect::from_min_size(min, Vec2::splat(TILE * z)), tint);
                        }
                        Lookup::Pending => visible = true,
                        Lookup::Empty => {}
                    }
                }
            }
        }
        if !visible && self.tech {
            // Fully transparent sprite: show a faint square so the item can still be found.
            let r = tile_rect(&self.cam, self.rect);
            b.fill(r.shrink(1.0), with_alpha_of(INVISIBLE_ITEM, tint));
            b.outline(r.shrink(1.0), 1.0, with_alpha_of(Color32::from_rgba_unmultiplied(160, 160, 160, 160), tint));
        }
        s.elevation as f32
    }

    /// Draw a creature outfit (looktype) or its look item, facing south.
    /// `direction`: 0 = north, 1 = east, 2 = south, 3 = west (as saved in the spawn XML).
    #[allow(clippy::too_many_arguments)]
    pub fn creature(&mut self, b: &mut Builder, name: &str, npc: bool, direction: u8, wx: f32, wy: f32, tint: Color32) {
        let Some(ct) = self.assets.creature(name, npc) else {
            let min = self.cam.world_to_screen(self.rect, wx + 8.0, wy + 8.0);
            b.fill(Rect::from_min_size(min, Vec2::splat(16.0 * self.cam.zoom)), Color32::from_rgba_unmultiplied(255, 60, 60, 180));
            return;
        };
        if ct.look_type == 0 && ct.look_item != 0 {
            let it = Item::new(ct.look_item);
            self.item(b, &it, Position::default(), None, wx, wy, tint);
            return;
        }
        let Some(s) = self.assets.db.outfits.get(ct.look_type as usize).filter(|s| !s.sprite_ids.is_empty()) else { return };
        let (sx, sy) = (wx - s.offset_x as f32, wy - s.offset_y as f32);
        let (cam, rect) = (self.cam, self.rect);
        outfit_quads(self.ctx, self.atlas, s, ct, direction, b, tint, |cx, cy| {
            Rect::from_min_size(cam.world_to_screen(rect, sx - cx as f32 * TILE, sy - cy as f32 * TILE), Vec2::splat(TILE * cam.zoom))
        });
    }

    /// Coloured wash + outline under a creature: monsters magenta-red, NPCs cyan.
    /// Creatures outside every spawn blink red (they would not be saved).
    fn creature_marker(&mut self, b: &mut Builder, pos: Position, npc: bool) {
        let r = self.cam.tile_rect(self.rect, pos.x as i32, pos.y as i32, pos.z);
        let (x, y) = (pos.x as i32, pos.y as i32);
        let covered = pos.z != self.cam.floor || self.spawns.iter().any(|&(sx, sy, sr)| (x - sx).abs() <= sr && (y - sy).abs() <= sr);
        let (fill, line) = if npc {
            (Color32::from_rgba_unmultiplied(40, 200, 255, 70), Color32::from_rgb(40, 200, 255))
        } else {
            (Color32::from_rgba_unmultiplied(220, 50, 90, 70), Color32::from_rgb(235, 70, 110))
        };
        b.fill(r, fill);
        let w = (1.5 * self.cam.zoom).max(1.0);
        if covered {
            b.outline(r, w, line);
        } else if self.frame % 2 == 0 {
            b.outline(r.expand(1.0), w * 2.0, Color32::from_rgb(255, 30, 30));
        }
    }

    /// RME `DrawTile` colour tint for zones / houses / selection.
    fn tile_tint(&self, tile: &Tile, view: &View, selected: bool, current_house: u32) -> (u8, u8, u8) {
        let (mut r, mut g, mut b) = (255u8, 255u8, 255u8);
        if view.show_blocking && tile.item_count() > 0 && tile.is_blocking(&self.assets.db) {
            g = g / 3 * 2;
            b = b / 3 * 2;
        }
        if view.highlight_items && !tile.items.is_empty() {
            const F: [f32; 5] = [0.75, 0.6, 0.48, 0.40, 0.33];
            let f = F[tile.items.len().min(5) - 1];
            g = (g as f32 * f) as u8;
            r = (r as f32 * f) as u8;
        }
        if view.show_houses && tile.house_id != 0 {
            r /= 2;
            if tile.house_id != current_house {
                g /= 2;
            }
        } else if view.show_zones && tile.flags & flags::PROTECTION_ZONE != 0 {
            r /= 2;
            b /= 2;
        }
        if view.show_zones {
            if tile.flags & flags::PVP_ZONE != 0 {
                g = r / 4;
                b = b / 3 * 2;
            }
            if tile.flags & flags::NO_LOGOUT != 0 {
                b /= 2;
            }
            if tile.flags & flags::NO_PVP != 0 {
                g /= 2;
            }
        }
        if selected {
            r /= 2;
            g /= 2;
            b /= 2;
        }
        (r, g, b)
    }

    pub fn tile(&mut self, b: &mut Builder, pos: Position, tile: &Tile, view: &View, selected: bool, current_house: u32, alpha: u8) {
        let o = self.cam.floor_offset(pos.z);
        let mut wx = ((pos.x as i32 - o) as f32) * TILE;
        let mut wy = ((pos.y as i32 - o) as f32) * TILE;
        let (r, g, bl) = self.tile_tint(tile, view, selected, current_house);
        let base = Color32::from_rgba_unmultiplied(255, 255, 255, alpha);
        let tinted = mul(base, r, g, bl);
        if let Some(gr) = &tile.ground {
            let e = self.item(b, gr, pos, Some(tile), wx, wy, tinted);
            wx -= e;
            wy -= e;
        } else if (r, g, bl) != (255, 255, 255) {
            let min = self.cam.world_to_screen(self.rect, wx, wy);
            b.fill(Rect::from_min_size(min, Vec2::splat(TILE * self.cam.zoom)), Color32::from_rgba_unmultiplied(r, g, bl, 90));
        }
        let mat = &self.assets.mat;
        let house_tint = if view.show_houses && tile.house_id != 0 { mul(base, 128, if tile.house_id == current_house { 255 } else { 128 }, 255) } else { base };
        let sel_tint = |c: Color32| if selected { mul(c, 128, 128, 128) } else { c };
        for it in &tile.items {
            let c = if mat.info(it.id).is_border { tinted } else { sel_tint(house_tint) };
            let e = self.item(b, it, pos, Some(tile), wx, wy, c);
            wx -= e;
            wy -= e;
        }
        if view.show_creatures {
            if let Some(c) = &tile.creature {
                if alpha == 255 && view.show_spawns {
                    self.creature_marker(b, pos, c.is_npc);
                }
                self.creature(b, &c.name, c.is_npc, c.direction, wx, wy, sel_tint(base));
            }
        }
    }
}

/// What the cached map meshes depend on.
#[derive(Clone, PartialEq)]
pub struct CacheKey {
    pub cam: Camera,
    pub size: Vec2,
    pub map_rev: u64,
    pub atlas_gen: u64,
    pub sel_rev: u64,
    pub view_hash: u64,
    pub house: u32,
    pub anim_tick: u64,
    pub ambient: u8,
}

pub struct MapCache {
    pub key: CacheKey,
    pub shapes: Vec<Shape>,
    pub tooltips: Vec<Tooltip>,
    pub complete: bool,
}

/// RME-style balloon above a tile of the current floor.
#[derive(Clone)]
pub struct Tooltip {
    /// Top-centre of the tile, in screen space (the balloon points here).
    pub anchor: Pos2,
    pub text: String,
}

/// Port of RME `MapDrawer::WriteTooltip(Item*)`: only items with configured content get a tooltip.
pub fn tooltip_text(item: &Item, ty: Option<&pme_core::items::ItemType>, house_tile: bool) -> Option<String> {
    use std::fmt::Write as _;
    if item.id < 100 {
        return None;
    }
    let (aid, uid, text) = (item.action_id(), item.unique_id(), item.text());
    let door = if house_tile && ty.is_some_and(|t| t.is_door()) { item.door_id() } else { 0 };
    let teleport = ty.is_some_and(|t| t.is_teleport()) || item.tele_dest().is_some();
    if aid == 0 && uid == 0 && door == 0 && text.is_empty() && !teleport {
        return None;
    }
    let mut s = format!("id: {}", item.id);
    if aid > 0 {
        let _ = write!(s, "\naid: {aid}");
    }
    if uid > 0 {
        let _ = write!(s, "\nuid: {uid}");
    }
    if door > 0 {
        let _ = write!(s, "\ndoor id: {door}");
    }
    if !text.is_empty() {
        let _ = write!(s, "\ntext: {text}");
    }
    if teleport {
        let d = item.tele_dest().unwrap_or_default();
        let _ = write!(s, "\ndestination: {}, {}, {}", d.x, d.y, d.z);
    }
    Some(s)
}

/// Tooltip of a whole tile (ground + items, plus waypoint), RME style.
fn tile_tooltip(db: &ItemDb, tile: &Tile, waypoint: Option<&str>) -> Option<String> {
    let mut parts: Vec<String> = tile.ground.iter().chain(tile.items.iter()).filter_map(|i| tooltip_text(i, db.get(i.id), tile.house_id != 0)).collect();
    if let Some(w) = waypoint {
        parts.push(format!("wp: {w}"));
    }
    (!parts.is_empty()).then(|| parts.join("\n\n"))
}

pub fn view_hash(v: &View) -> u64 {
    let bits = [
        v.show_all_floors,
        v.show_shade,
        v.show_zones,
        v.show_houses,
        v.show_spawns,
        v.show_creatures,
        v.show_grid,
        v.show_waypoints,
        v.show_blocking,
        v.highlight_items,
        v.show_animation,
        v.show_lights,
        v.hd_sprites,
        v.show_tooltips,
        v.show_tech_items,
    ];
    bits.iter().enumerate().fold(0, |acc, (i, &b)| acc | ((b as u64) << i))
}

/// Build the meshes for the whole visible map.
pub fn build_map(dc: &mut DrawCtx, map: &Map, view: &View, selection: &AHashSet<Position>, current_house: u32) -> (Vec<Shape>, usize, Vec<Tooltip>) {
    const MAX_TOOLTIPS: usize = 400;
    let mut tips: Vec<Tooltip> = Vec::new();
    let waypoints: ahash::AHashMap<Position, &str> = if view.show_tooltips {
        map.waypoints.iter().filter(|w| w.pos.z == dc.cam.floor).map(|w| (w.pos, w.name.as_str())).collect()
    } else {
        Default::default()
    };
    let mut b = Builder::new();
    let cam = dc.cam;
    let rect = dc.rect;
    let floors: Vec<u8> = cam.floors(view.show_all_floors).collect();
    let first = floors[0];
    dc.spawns = visible_spawns(map, cam, rect);
    for &z in &floors {
        if z == cam.floor && first != cam.floor && view.show_shade {
            b.fill(rect, Color32::from_rgba_unmultiplied(0, 0, 0, 110));
        }
        let o = cam.floor_offset(z);
        // Visible tile range for this floor (+2 margin for large sprites drawn up/left).
        let x0 = (cam.x / TILE).floor() as i32 + o;
        let y0 = (cam.y / TILE).floor() as i32 + o;
        let x1 = ((cam.x + rect.width() / cam.zoom) / TILE).ceil() as i32 + o + 2;
        let y1 = ((cam.y + rect.height() / cam.zoom) / TILE).ceil() as i32 + o + 2;
        let (x0, y0) = (x0.max(0), y0.max(0));
        let (x1, y1) = (x1.min(65535), y1.min(65535));
        if x0 > x1 || y0 > y1 {
            continue;
        }
        let cx0 = (x0 as u32) >> 5;
        let cx1 = (x1 as u32) >> 5;
        for y in y0..=y1 {
            let cy = (y as u32) >> 5;
            let ly = (y as u32) & 31;
            for cxi in cx0..=cx1 {
                let Some(chunk) = map.chunk(cxi, cy, z) else { continue };
                let lx0 = if cxi == cx0 { (x0 as u32) & 31 } else { 0 };
                let lx1 = if cxi == cx1 { (x1 as u32) & 31 } else { 31 };
                for lx in lx0..=lx1 {
                    let Some(t) = chunk.get_local(lx, ly) else { continue };
                    let pos = Position::new(((cxi << 5) | lx) as u16, y as u16, z);
                    // Tiles selected on other floors (multi-floor selection mode) are tinted too.
                    let sel = !selection.is_empty() && selection.contains(&pos);
                    dc.tile(&mut b, pos, t, view, sel, current_house, 255);
                    if view.show_tooltips && z == cam.floor && tips.len() < MAX_TOOLTIPS {
                        if let Some(text) = tile_tooltip(&dc.assets.db, t, waypoints.get(&pos).copied()) {
                            let r = cam.tile_rect(rect, pos.x as i32, pos.y as i32, z);
                            if rect.intersects(r) {
                                tips.push(Tooltip { anchor: Pos2::new(r.center().x, r.min.y), text });
                            }
                        }
                    }
                }
            }
        }
        if z == cam.floor {
            if view.show_lights {
                crate::light::build(dc, &mut b, map, &floors, view.ambient_light, (x0, y0, x1, y1));
            }
            draw_markers(dc, &mut b, map, view, (x0, y0, x1, y1));
        }
    }
    let q = b.quads;
    (b.into_shapes(), q, tips)
}

/// Spawns on the current floor within (or reaching into) the view.
fn visible_spawns(map: &Map, cam: Camera, rect: Rect) -> Vec<(i32, i32, i32)> {
    const M: i32 = 30;
    let z = cam.floor;
    let o = cam.floor_offset(z);
    let x0 = (cam.x / TILE).floor() as i32 + o - M;
    let y0 = (cam.y / TILE).floor() as i32 + o - M;
    let x1 = ((cam.x + rect.width() / cam.zoom) / TILE).ceil() as i32 + o + M;
    let y1 = ((cam.y + rect.height() / cam.zoom) / TILE).ceil() as i32 + o + M;
    let mut out = Vec::new();
    for cy in (y0.max(0) >> 5)..=(y1.clamp(0, 65535) >> 5) {
        for cx in (x0.max(0) >> 5)..=(x1.clamp(0, 65535) >> 5) {
            let Some(chunk) = map.chunk(cx as u32, cy as u32, z) else { continue };
            for (lx, ly, t) in chunk.iter() {
                if t.spawn_radius > 0 {
                    out.push(((cx << 5) + lx as i32, (cy << 5) + ly as i32, t.spawn_radius as i32));
                }
            }
        }
    }
    out
}

/// Spawns, waypoints, house exits and town temples on the current floor.
fn draw_markers(dc: &mut DrawCtx, b: &mut Builder, map: &Map, view: &View, (x0, y0, x1, y1): (i32, i32, i32, i32)) {
    let cam = dc.cam;
    let rect = dc.rect;
    let z = cam.floor;
    let in_view = |p: Position| p.z == z && (x0..=x1).contains(&(p.x as i32)) && (y0..=y1).contains(&(p.y as i32));
    let w = (2.0 * cam.zoom).max(1.0);
    if view.show_spawns {
        let spawns = dc.spawns.clone();
        for (x, y, r) in spawns {
            let a = cam.tile_rect(rect, x - r, y - r, z);
            let c = cam.tile_rect(rect, x + r, y + r, z);
            let area = Rect::from_min_max(a.min, c.max);
            b.fill(area, Color32::from_rgba_unmultiplied(255, 120, 0, 16));
            b.outline(area, w, Color32::from_rgba_unmultiplied(255, 140, 0, 190));
            // Centre: flame on a dark disc + radius (like RME's spawn marker).
            let cr = cam.tile_rect(rect, x, y, z);
            let size = (cr.width() * 0.62).max(9.0);
            b.extra.push(Shape::circle_filled(cr.center(), size * 0.62, Color32::from_rgba_unmultiplied(30, 10, 0, 170)));
            b.extra.push(Shape::circle_stroke(cr.center(), size * 0.62, egui::Stroke::new(1.5_f32, Color32::from_rgb(255, 150, 30))));
            dc.ctx.fonts(|f| {
                b.extra.push(Shape::text(f, cr.center(), egui::Align2::CENTER_CENTER, "\u{1F525}", egui::FontId::proportional(size), Color32::from_rgb(255, 170, 40)));
                if cam.zoom >= 0.5 {
                    b.extra.push(Shape::text(f, cr.right_bottom(), egui::Align2::LEFT_TOP, r.to_string(), egui::FontId::proportional(11.0), Color32::from_rgb(255, 200, 120)));
                }
            });
        }
    }
    if view.show_waypoints {
        for wp in map.waypoints.iter().filter(|w| in_view(w.pos)) {
            let r = cam.tile_rect(rect, wp.pos.x as i32, wp.pos.y as i32, z).shrink(8.0 * cam.zoom);
            b.fill(r, Color32::from_rgba_unmultiplied(60, 140, 255, 220));
        }
    }
    if view.show_houses {
        for h in map.houses.iter().filter(|h| in_view(h.entry)) {
            let r = cam.tile_rect(rect, h.entry.x as i32, h.entry.y as i32, z);
            b.outline(r.shrink(3.0 * cam.zoom), w, Color32::from_rgb(80, 220, 255));
        }
    }
    for t in map.towns.iter().filter(|t| in_view(t.temple)) {
        let r = cam.tile_rect(rect, t.temple.x as i32, t.temple.y as i32, z);
        b.outline(r.shrink(2.0 * cam.zoom), w, Color32::from_rgb(255, 230, 60));
    }
}

/// Paint an item icon (all sprite parts, scaled to fit) into `rect` (palettes, properties).
pub fn paint_item_icon(ctx: &egui::Context, painter: &egui::Painter, atlas: &mut Atlas, db: &ItemDb, id: u16, rect: Rect, frame: u32) {
    // Invisible items must still be visible in palettes / pickers (RME shows tech items).
    if let Some(c) = db.get(id).and_then(|t| tech_color(t.client_id)) {
        painter.rect_filled(rect.shrink(2.0), 2.0, c);
        return;
    }
    let Some(s) = db.sprite(id) else { return };
    let mut visible = false;
    let (w, h) = (s.width.max(1) as u32, s.height.max(1) as u32);
    let size = w.max(h) as f32 * TILE;
    let scale = rect.width().min(rect.height()) / size;
    let mut b = Builder::new();
    let stack = db.get(id).is_some_and(|t| t.is_stackable());
    for cx in 0..w {
        for cy in 0..h {
            for layer in 0..s.layers.max(1) as u32 {
                let idx = s.sprite_index(cx, cy, layer, if stack { 0 } else { -1 }, 0, 0, 0, frame);
                match atlas.get(ctx, s.sprite_ids[idx]) {
                    Lookup::Ready(tex, uv) => {
                        visible = true;
                        let ox = (size - (cx + 1) as f32 * TILE) * scale;
                        let oy = (size - (cy + 1) as f32 * TILE) * scale;
                        let r = Rect::from_min_size(rect.min + Vec2::new(ox, oy), Vec2::splat(TILE * scale));
                        b.image(tex, uv, r, Color32::WHITE);
                    }
                    Lookup::Pending => visible = true,
                    Lookup::Empty => {}
                }
            }
        }
    }
    if !visible {
        painter.rect(rect.shrink(3.0), 2.0, INVISIBLE_ITEM, egui::Stroke::new(1.0_f32, Color32::from_gray(150)), egui::StrokeKind::Inside);
    }
    for s in b.into_shapes() {
        painter.add(s);
    }
}

/// Emit a creature outfit facing south, coloured (head/body/legs/feet) and with its addons,
/// like RME `BlitCreature`. `place(cx, cy)` gives the screen rect of each sprite part.
fn outfit_quads(
    ctx: &egui::Context,
    atlas: &mut Atlas,
    s: &pme_core::items::SpriteInfo,
    ct: &pme_io::creatures::CreatureType,
    direction: u8,
    b: &mut Builder,
    tint: Color32,
    place: impl Fn(u32, u32) -> Rect,
) {
    // Outfits have 4 directions in pattern_x (N, E, S, W); others have a single one.
    let dir = if s.pattern_x >= 4 { (direction as u32).min(3) } else { 0 };
    let colors = [ct.head, ct.body, ct.legs, ct.feet];
    // Base outfit, then addon 1 / addon 2 (pattern_y), when the outfit has them.
    let mut patterns = vec![0u32];
    if s.pattern_y > 1 && ct.addons & 1 != 0 {
        patterns.push(1);
    }
    if s.pattern_y > 2 && ct.addons & 2 != 0 {
        patterns.push(2);
    }
    for py in patterns {
        for cx in 0..s.width.max(1) as u32 {
            for cy in 0..s.height.max(1) as u32 {
                let idx = s.sprite_index(cx, cy, 0, -1, dir, py, 0, 0);
                let look = if s.layers >= 2 {
                    // Layer 1 is the colour template (RME TemplateImage).
                    let mask = s.sprite_index(cx, cy, 1, -1, dir, py, 0, 0);
                    atlas.get_outfit(ctx, s.sprite_ids[idx], s.sprite_ids[mask], colors)
                } else {
                    atlas.get(ctx, s.sprite_ids[idx])
                };
                if let Lookup::Ready(tex, uv) = look {
                    b.image(tex, uv, place(cx, cy), tint);
                }
            }
        }
    }
}

/// Paint a creature icon (outfit facing south) into `rect`.
#[allow(clippy::too_many_arguments)]
pub fn paint_creature_icon(ctx: &egui::Context, painter: &egui::Painter, atlas: &mut Atlas, assets: &Assets, name: &str, npc: bool, dir: u8, rect: Rect, frame: u32) {
    let Some(ct) = assets.creature(name, npc) else { return };
    if ct.look_type == 0 {
        if ct.look_item != 0 {
            paint_item_icon(ctx, painter, atlas, &assets.db, ct.look_item, rect, frame);
        }
        return;
    }
    let Some(s) = assets.db.outfits.get(ct.look_type as usize).filter(|s| !s.sprite_ids.is_empty()) else { return };
    let (w, h) = (s.width.max(1) as u32, s.height.max(1) as u32);
    let size = w.max(h) as f32 * TILE;
    let scale = rect.width().min(rect.height()) / size;
    let mut b = Builder::new();
    outfit_quads(ctx, atlas, s, ct, dir, &mut b, Color32::WHITE, |cx, cy| {
        let ox = (size - (cx + 1) as f32 * TILE) * scale;
        let oy = (size - (cy + 1) as f32 * TILE) * scale;
        Rect::from_min_size(rect.min + Vec2::new(ox, oy), Vec2::splat(TILE * scale))
    });
    for s in b.into_shapes() {
        painter.add(s);
    }
}

#[cfg(test)]
mod tests {
    use super::tooltip_text;
    use pme_core::item::Item;
    use pme_core::items::{ItemGroup, ItemType};
    use pme_core::position::Position;

    fn ty(group: ItemGroup, xml: &str) -> ItemType {
        ItemType { id: 1, group, xml_type: xml.into(), valid: true, ..Default::default() }
    }

    #[test]
    fn tech_items_like_rme() {
        use super::tech_color;
        let y = tech_color(469).unwrap(); // premultiplied: compare the hue, not raw channels
        assert!(y.r() == y.g() && y.b() == 0 && y.a() == 170, "invisible stairs: yellow");
        let r = tech_color(470).unwrap();
        assert!(r.r() > 0 && r.g() == 0 && r.b() == 0, "invisible walkable floor: red");
        assert!(tech_color(470).is_some() && tech_color(2187).is_some());
        assert!(tech_color(100).is_none());
    }

    #[test]
    fn tooltip_like_rme() {
        let plain = ty(ItemGroup::None, "");
        assert_eq!(tooltip_text(&Item::new(2000), Some(&plain), false), None);
        assert_eq!(tooltip_text(&Item::new(50), Some(&plain), false), None, "ids < 100 are skipped");

        let mut it = Item::new(50845);
        it.set_action_id(5500);
        assert_eq!(tooltip_text(&it, Some(&plain), false).unwrap(), "id: 50845\naid: 5500");

        let tp = ty(ItemGroup::Teleport, "");
        assert_eq!(tooltip_text(&Item::new(27710), Some(&tp), false).unwrap(), "id: 27710\ndestination: 0, 0, 0");
        let mut t2 = Item::new(27707);
        t2.set_tele_dest(Some(Position::new(31797, 32204, 7)));
        assert_eq!(tooltip_text(&t2, Some(&tp), false).unwrap(), "id: 27707\ndestination: 31797, 32204, 7");

        let mut sign = Item::new(1429);
        sign.set_text("Welcome Main City");
        sign.set_unique_id(9);
        assert_eq!(tooltip_text(&sign, Some(&plain), false).unwrap(), "id: 1429\nuid: 9\ntext: Welcome Main City");

        let door_t = ty(ItemGroup::Door, "");
        let mut door = Item::new(1209);
        door.set_door_id(3);
        assert_eq!(tooltip_text(&door, Some(&door_t), false), None, "door id only on house tiles");
        assert_eq!(tooltip_text(&door, Some(&door_t), true).unwrap(), "id: 1209\ndoor id: 3");
    }
}

