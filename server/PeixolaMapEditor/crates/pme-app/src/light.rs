//! Light preview. Port of RME `LightDrawer`: an ambient level plus coloured lights from items
//! (Tibia.dat light level/colour), with RME's linear falloff. egui has no multiply blend, so
//! the result is drawn as a vertex-coloured gradient that darkens (black alpha) and adds a
//! weak tint of the light colour.

use eframe::egui::{epaint::Vertex, epaint::WHITE_UV, Color32, Pos2};
use pme_core::map::Map;

use crate::minimap::palette;
use crate::view::{Builder, DrawCtx, TILE};

/// RME limit for light reach.
const MAX_LIGHT: i32 = 8;

/// RME `LightDrawer::calculateIntensity`.
pub fn intensity(dx: i32, dy: i32, level: u8) -> f32 {
    let d = ((dx * dx + dy * dy) as f32).sqrt();
    if d > MAX_LIGHT as f32 {
        return 0.0;
    }
    let i = (level as f32 - d) * 0.2;
    if i < 0.01 { 0.0 } else { i.min(1.0) }
}

/// Add the light overlay for the tile range `(x0, y0, x1, y1)` of the current floor.
pub fn build(dc: &mut DrawCtx, b: &mut Builder, map: &Map, floors: &[u8], ambient: u8, (x0, y0, x1, y1): (i32, i32, i32, i32)) {
    let cam = dc.cam;
    // One extra tile on the top/left so the half tile before the first centre is covered.
    let (x0, y0) = ((x0 - 1).max(0), (y0 - 1).max(0));
    let w = (x1 - x0 + 1).max(0) as usize;
    let h = (y1 - y0 + 1).max(0) as usize;
    if w == 0 || h == 0 || w * h > 600_000 {
        return;
    }
    let mut buf = vec![[ambient; 3]; w * h];
    let db = &dc.assets.db;
    // Collect lights from every drawn floor (lower floors shine through, like RME).
    for &z in floors {
        let o = cam.floor_offset(z) - cam.floor_offset(cam.floor);
        for y in (y0 - MAX_LIGHT + o).max(0)..=(y1 + MAX_LIGHT + o).min(65535) {
            for x in (x0 - MAX_LIGHT + o).max(0)..=(x1 + MAX_LIGHT + o).min(65535) {
                let Some(t) = map.get_xyz(x, y, z) else { continue };
                for it in t.ground.iter().chain(t.items.iter()) {
                    let Some(s) = db.sprite(it.id) else { continue };
                    if s.light_level == 0 {
                        continue;
                    }
                    let level = s.light_level.min(255) as u8;
                    let col = palette(s.light_color as u8);
                    // Position in current-floor tile space.
                    let (lx, ly) = (x - o, y - o);
                    for ty in (ly - MAX_LIGHT).max(y0)..=(ly + MAX_LIGHT).min(y1) {
                        for tx in (lx - MAX_LIGHT).max(x0)..=(lx + MAX_LIGHT).min(x1) {
                            let i = intensity(tx - lx, ty - ly, level);
                            if i == 0.0 {
                                continue;
                            }
                            let px = &mut buf[(ty - y0) as usize * w + (tx - x0) as usize];
                            px[0] = px[0].max((col.r() as f32 * i) as u8);
                            px[1] = px[1].max((col.g() as f32 * i) as u8);
                            px[2] = px[2].max((col.b() as f32 * i) as u8);
                        }
                    }
                }
            }
        }
    }

    // Vertex at each tile centre; quads between centres give smooth gradients.
    let to_color = |p: [u8; 3]| {
        let lum = p.iter().copied().max().unwrap() as f32 / 255.0;
        let dark = ((1.0 - lum) * 0.92).clamp(0.0, 1.0);
        let add = |c: u8| (((c as f32 - ambient as f32).max(0.0)) * 0.30) as u8;
        Color32::from_rgba_premultiplied(add(p[0]), add(p[1]), add(p[2]), (dark * 255.0) as u8)
    };
    let o = cam.floor_offset(cam.floor);
    let pos = |tx: i32, ty: i32| -> Pos2 { cam.world_to_screen(dc.rect, ((tx - o) as f32 + 0.5) * TILE, ((ty - o) as f32 + 0.5) * TILE) };
    let mesh = b.color_mesh();
    let base = mesh.vertices.len() as u32;
    for ty in 0..h as i32 {
        for tx in 0..w as i32 {
            mesh.vertices.push(Vertex { pos: pos(x0 + tx, y0 + ty), uv: WHITE_UV, color: to_color(buf[ty as usize * w + tx as usize]) });
        }
    }
    for ty in 0..h.saturating_sub(1) as u32 {
        for tx in 0..w.saturating_sub(1) as u32 {
            let i = base + ty * w as u32 + tx;
            let (a, bb, c, d) = (i, i + 1, i + w as u32, i + w as u32 + 1);
            mesh.indices.extend_from_slice(&[a, bb, c, bb, d, c]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::intensity;

    #[test]
    fn falloff_like_rme() {
        assert_eq!(intensity(0, 0, 7), 1.0);
        assert!((intensity(3, 0, 7) - 0.8).abs() < 1e-5);
        assert_eq!(intensity(7, 0, 7), 0.0);
        assert_eq!(intensity(9, 0, 20), 0.0, "beyond max reach");
    }
}
