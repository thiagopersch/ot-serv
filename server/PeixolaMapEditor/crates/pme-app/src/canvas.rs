//! The map canvas: input (paint / select / move / paste / pan / zoom) and drawing.

use std::time::Instant;

use eframe::egui::{self, Color32, Event, PointerButton, Rect, Sense, Shape, Stroke, Vec2};
use pme_core::brushes::{self, Brush, BrushShape};
use pme_core::item::Item;
use pme_core::materials::BrushKind;
use pme_core::position::Position;
use pme_core::tile::flags;

use crate::app::{App, Gesture};
use crate::properties::PropTarget;
use crate::i18n::t;
use crate::view::{self, Builder, CacheKey, DrawCtx, MapCache, TILE};

/// Tiles on the line between two tiles (Bresenham), so fast strokes leave no gaps.
fn line(a: (i32, i32), b: (i32, i32)) -> Vec<(i32, i32)> {
    let (mut x0, mut y0) = a;
    let (dx, dy) = ((b.0 - x0).abs(), -(b.1 - y0).abs());
    let (sx, sy) = (if x0 < b.0 { 1 } else { -1 }, if y0 < b.1 { 1 } else { -1 });
    let mut err = dx + dy;
    let mut out = Vec::new();
    loop {
        out.push((x0, y0));
        if (x0, y0) == b || out.len() > 4096 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x0 += sx;
        }
        if e2 <= dx {
            err += dx;
            y0 += sy;
        }
    }
    out
}

/// RME `MapTooltip` line handling: wrap at ~40 chars on spaces, cut after 255 chars.
fn wrap_tooltip(text: &str) -> String {
    const MAX_CHARS: usize = 255;
    const PER_LINE: usize = 40;
    let mut out = String::with_capacity(text.len() + 8);
    let mut line = 0usize;
    for (n, c) in text.chars().enumerate() {
        if n >= MAX_CHARS {
            out.push_str("...");
            break;
        }
        if c == '\n' || (line >= PER_LINE && c == ' ') {
            out.push('\n');
            line = 0;
            continue;
        }
        out.push(c);
        line += 1;
    }
    out
}

/// White balloons with a pointer, like RME `MapDrawer::DrawTooltips`.
fn paint_tooltips(painter: &egui::Painter, tips: &[view::Tooltip], zoom: f32) {
    if tips.is_empty() || zoom < 0.5 {
        return;
    }
    let scale = zoom.min(1.0);
    let font = egui::FontId::proportional(12.0 * scale);
    let space = 7.0 * scale;
    let border = Stroke::new(1.0_f32, Color32::BLACK);
    for tip in tips {
        let galley = painter.layout_no_wrap(wrap_tooltip(&tip.text), font.clone(), Color32::BLACK);
        let size = galley.size() + Vec2::new(8.0, 4.0) * scale;
        let x = tip.anchor.x;
        let rect = Rect::from_min_size(egui::pos2(x - size.x / 2.0, tip.anchor.y - space - size.y), size);
        painter.rect(rect, 1.0, Color32::WHITE, border, egui::StrokeKind::Inside);
        let pointer = vec![egui::pos2(x - space, rect.max.y - 0.5), egui::pos2(x + space, rect.max.y - 0.5), egui::pos2(x, tip.anchor.y)];
        painter.add(Shape::convex_polygon(pointer, Color32::WHITE, border));
        // Hide the border line between the box and the pointer.
        painter.line_segment([egui::pos2(x - space + 1.0, rect.max.y - 1.0), egui::pos2(x + space - 1.0, rect.max.y - 1.0)], Stroke::new(2.0_f32, Color32::WHITE));
        painter.galley(rect.min + Vec2::new(4.0, 2.0) * scale, galley, Color32::BLACK);
    }
}

pub fn zone_color(flag: u32) -> Color32 {
    match flag {
        flags::PROTECTION_ZONE => Color32::from_rgb(60, 200, 90),
        flags::NO_PVP => Color32::from_rgb(90, 160, 255),
        flags::NO_LOGOUT => Color32::from_rgb(230, 200, 60),
        flags::PVP_ZONE => Color32::from_rgb(230, 70, 70),
        _ => Color32::GRAY,
    }
}

impl App {
    fn pos_of(&self, xy: (i32, i32)) -> Option<Position> {
        Position::new(0, 0, self.cam.floor).offset(xy.0, xy.1, 0)
    }

    fn label_for(brush: &Brush) -> &'static str {
        match brush {
            Brush::Eraser => "erase",
            Brush::Zone(_) => "zone",
            Brush::House(_) | Brush::HouseExit(_) => "house",
            Brush::Spawn | Brush::Creature { .. } => "spawn",
            _ => "draw",
        }
    }

    /// Apply the current brush at tile `xy`.
    fn apply_brush(&mut self, xy: (i32, i32), erase: bool, size: i32) {
        let (Some(brush), Some(p)) = (self.brush.clone(), self.pos_of(xy)) else { return };
        let Some(ed) = &mut self.editor else { return };
        let buf = self.doodad_buffer.clone();
        ed.draw(&brush, p, size, self.brush_shape, erase, buf.as_ref());
        if matches!(brush, Brush::Material(_)) && buf.is_some() {
            self.regen_doodad();
        }
    }

    /// Ctrl + click: remove the whole tile at `xy` (inside the current undo batch).
    fn clear_tile_at(&mut self, xy: (i32, i32)) {
        let (Some(p), Some(ed)) = (self.pos_of(xy), &mut self.editor) else { return };
        ed.clear_tiles(&[p]);
        if self.inspect_edit.as_ref().is_some_and(|(q, _)| *q == p) {
            self.inspect_edit = None;
        }
        self.sel_rev += 1;
    }

    /// Open the properties of the topmost thing on a tile (item, else creature, else spawn).
    pub fn open_top_properties(&mut self, p: Position) {
        let Some(t) = self.editor.as_ref().and_then(|e| e.map.get(p)) else { return };
        let target = if !t.items.is_empty() {
            PropTarget::Item(t.items.len())
        } else if t.ground.is_some() {
            PropTarget::Item(0)
        } else if t.creature.is_some() {
            PropTarget::Creature
        } else if t.spawn_radius > 0 {
            PropTarget::Spawn
        } else {
            return;
        };
        self.open_properties(p, target);
    }

    fn is_draggable(&self) -> bool {
        match (&self.brush, &self.assets) {
            (Some(Brush::Material(id)), Some(a)) => match a.mat.brush(*id).map(|b| &b.kind) {
                Some(BrushKind::Doodad(d)) => d.draggable,
                _ => true,
            },
            (Some(Brush::HouseExit(_) | Brush::Waypoint(_) | Brush::Spawn), _) => false,
            _ => true,
        }
    }

    pub fn canvas_ui(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        let (rect, resp) = ui.allocate_exact_size(ui.available_size(), Sense::click_and_drag());
        self.canvas_rect = rect;
        let hover_xy = resp.hover_pos().map(|p| self.cam.tile_at(rect, p));
        self.hover = hover_xy.and_then(|xy| self.pos_of(xy));

        self.handle_input(ctx, &resp, rect, hover_xy);
        self.draw(ctx, ui, rect, hover_xy);

        if self.brush.is_none() && !self.paste_mode {
            if resp.secondary_clicked() {
                self.context_pos = self.hover;
            }
            resp.context_menu(|ui| self.context_menu(ctx, ui));
        }
    }

    fn handle_input(&mut self, ctx: &egui::Context, resp: &egui::Response, rect: Rect, hover_xy: Option<(i32, i32)>) {
        let (pressed_l, pressed_r, down_l, down_r, down_m, mods, delta) = ctx.input(|i| {
            (
                i.pointer.button_pressed(PointerButton::Primary),
                i.pointer.button_pressed(PointerButton::Secondary),
                i.pointer.button_down(PointerButton::Primary),
                i.pointer.button_down(PointerButton::Secondary),
                i.pointer.button_down(PointerButton::Middle),
                i.modifiers,
                i.pointer.delta(),
            )
        });
        let hovered = resp.hovered();

        // Pan with middle mouse.
        if down_m && (hovered || resp.dragged_by(PointerButton::Middle)) {
            self.cam.x -= delta.x / self.cam.zoom;
            self.cam.y -= delta.y / self.cam.zoom;
        }
        // Wheel: zoom; Ctrl+wheel: floor (like PgUp / PgDn); Alt+wheel: brush size.
        if hovered {
            let mut wheel = 0.0;
            ctx.input(|i| {
                for e in &i.events {
                    if let Event::MouseWheel { delta, .. } = e {
                        wheel += delta.y;
                    }
                }
            });
            if wheel != 0.0 {
                let steps = wheel.signum();
                if mods.ctrl {
                    // Wheel forward = floor down (z increases), wheel back = floor up.
                    self.change_floor(steps as i32);
                } else if mods.alt {
                    self.brush_size = (self.brush_size + steps as i32).clamp(0, 15);
                    self.regen_doodad();
                } else if let Some(p) = resp.hover_pos() {
                    let z = self.cam.zoom * if steps > 0.0 { 1.2 } else { 1.0 / 1.2 };
                    self.cam.zoom_at(rect, p, z);
                }
            }
        }

        let Some(xy) = hover_xy else {
            if !down_l && !down_r {
                self.finish_gesture(hover_xy);
            }
            return;
        };

        // Teleport destination picking (properties window).
        if self.picking_dest.is_some() && hovered && pressed_l {
            if let Some(p) = self.pos_of(xy) {
                self.deliver_pick(p);
            }
            return;
        }
        // Double click in selection mode opens the top item's properties (like RME).
        if self.brush.is_none() && !self.paste_mode && !mods.ctrl && resp.double_clicked() {
            if let Some(p) = self.pos_of(xy) {
                self.open_top_properties(p);
            }
        }

        // Start gestures.
        if hovered && (pressed_l || pressed_r) && self.gesture == Gesture::None {
            let erase = pressed_r;
            if pressed_l && mods.ctrl && !self.paste_mode {
                // Ctrl + left click (any tool): clear the whole tile.
                if let Some(ed) = &mut self.editor {
                    ed.begin("clear");
                }
                self.clear_tile_at(xy);
                self.gesture = Gesture::Clear { last: xy };
            } else if self.paste_mode {
                if pressed_l {
                    if let (Some(p), Some(ed)) = (self.pos_of(xy), &mut self.editor) {
                        ed.paste(p);
                        self.sel_rev += 1;
                    }
                    if !mods.shift {
                        self.paste_mode = false;
                    }
                } else {
                    self.paste_mode = false;
                }
            } else if let Some(brush) = &self.brush {
                let label = Self::label_for(brush);
                if mods.shift && self.is_draggable() {
                    self.gesture = Gesture::RectFill { erase, start: xy };
                } else {
                    if let Some(ed) = &mut self.editor {
                        ed.begin(label);
                    }
                    self.apply_brush(xy, erase, self.brush_size);
                    self.gesture = Gesture::Paint { erase, last: xy };
                }
            } else if pressed_l {
                let selected = self.pos_of(xy).is_some_and(|p| self.editor.as_ref().is_some_and(|e| e.selection.contains(&p)));
                self.gesture = if selected && !mods.ctrl && !mods.shift { Gesture::MoveSelection { start: xy } } else { Gesture::BoxSelect { start: xy } };
            }
        }

        // Continue gestures.
        if let Gesture::Paint { erase, last } = self.gesture {
            if (down_l || down_r) && xy != last {
                if self.is_draggable() {
                    for p in line(last, xy).into_iter().skip(1) {
                        self.apply_brush(p, erase, self.brush_size);
                    }
                }
                self.gesture = Gesture::Paint { erase, last: xy };
            }
        }
        if let Gesture::Clear { last } = self.gesture {
            if down_l && xy != last {
                for p in line(last, xy).into_iter().skip(1) {
                    self.clear_tile_at(p);
                }
                self.gesture = Gesture::Clear { last: xy };
            }
        }
        if !down_l && !down_r {
            self.finish_gesture(Some(xy));
        }
    }

    fn finish_gesture(&mut self, end: Option<(i32, i32)>) {
        let g = std::mem::replace(&mut self.gesture, Gesture::None);
        match g {
            Gesture::None => {}
            Gesture::Paint { .. } | Gesture::Clear { .. } => {
                if let Some(ed) = &mut self.editor {
                    ed.end();
                }
            }
            Gesture::RectFill { erase, start } => {
                let Some(end) = end else { return };
                let label = self.brush.as_ref().map(Self::label_for).unwrap_or("draw");
                if let Some(ed) = &mut self.editor {
                    ed.begin(label);
                }
                let (x0, x1) = (start.0.min(end.0), start.0.max(end.0));
                let (y0, y1) = (start.1.min(end.1), start.1.max(end.1));
                for y in y0..=y1 {
                    for x in x0..=x1 {
                        self.apply_brush((x, y), erase, 0);
                    }
                }
                if let Some(ed) = &mut self.editor {
                    ed.end();
                }
            }
            Gesture::BoxSelect { start } => {
                let Some(end) = end else { return };
                let mods = self.modifiers_now();
                let (Some(a), Some(b)) = (self.pos_of(start), self.pos_of(end)) else { return };
                if let Some(ed) = &mut self.editor {
                    ed.select_area_mode(a, b, mods.shift || mods.ctrl, self.settings.select_mode());
                }
                self.sel_rev += 1;
                self.inspect = Some(b);
                self.inspect_edit = None;
                self.inspect_item = None;
            }
            Gesture::MoveSelection { start } => {
                let Some(end) = end else { return };
                if start == end {
                    self.inspect = self.pos_of(end);
                    self.inspect_edit = None;
                    self.inspect_item = None;
                    return;
                }
                if let Some(ed) = &mut self.editor {
                    ed.move_selection(end.0 - start.0, end.1 - start.1, 0);
                }
                self.sel_rev += 1;
            }
        }
    }

    fn modifiers_now(&self) -> egui::Modifiers {
        self.last_modifiers
    }

    fn context_menu(&mut self, ctx: &egui::Context, ui: &mut egui::Ui) {
        let has_sel = self.editor.as_ref().is_some_and(|e| !e.selection.is_empty());
        let has_clip = self.editor.as_ref().is_some_and(|e| !e.clipboard.is_empty());
        if ui.add_enabled(has_sel, egui::Button::new(t("menu-copy"))).clicked() {
            self.copy(ctx, false);
            ui.close_menu();
        }
        if ui.add_enabled(has_sel, egui::Button::new(t("menu-cut"))).clicked() {
            self.copy(ctx, true);
            ui.close_menu();
        }
        if ui.add_enabled(has_clip, egui::Button::new(t("menu-paste"))).clicked() {
            self.start_paste();
            ui.close_menu();
        }
        if ui.add_enabled(has_sel, egui::Button::new(t("menu-delete"))).clicked() {
            self.delete_selection();
            ui.close_menu();
        }
        ui.separator();
        let at = self.context_pos.or(self.hover).or(self.inspect);
        if let (Some(h), Some(ed), Some(a)) = (at, &self.editor, &self.assets) {
            if let Some(tile) = ed.map.get(h).cloned() {
                let db = a.db.clone();
                let name = |id: u16| format!("{} [{id}]", db.name(id));
                // Brush for "Select brush" (resolved now: the menu actions below borrow `self`).
                let brush = a.mat.brush_of_tile(&tile);
                let brush_label = match brush.and_then(|b| a.mat.brush(b)) {
                    Some(def) => format!("{}: {}", t("ctx-select-brush"), def.name),
                    None => t("ctx-select-brush").to_owned(),
                };
                let stack: Vec<(usize, u16)> = tile.items.iter().enumerate().rev().map(|(i, it)| (i + 1, it.id)).chain(tile.ground.iter().map(|g| (0, g.id))).collect();
                // RME: copy server id / client id / name of the top item.
                if let Some(&(_, id)) = stack.first() {
                    let client = db.get(id).map(|it| it.client_id).unwrap_or(0);
                    if ui.button(format!("{}: {id}", t("ctx-copy-server-id"))).clicked() {
                        ctx.copy_text(id.to_string());
                        ui.close_menu();
                    }
                    if ui.button(format!("{}: {client}", t("ctx-copy-client-id"))).clicked() {
                        ctx.copy_text(client.to_string());
                        ui.close_menu();
                    }
                    if ui.button(t("ctx-copy-name")).clicked() {
                        ctx.copy_text(db.name(id).to_string());
                        ui.close_menu();
                    }
                    ui.separator();
                }
                if let Some(&(k, id)) = stack.first() {
                    if ui.button(format!("{}: {}", t("ctx-item-properties"), name(id))).clicked() {
                        self.open_properties(h, PropTarget::Item(k));
                        ui.close_menu();
                    }
                }
                if stack.len() > 1 {
                    ui.menu_button(t("ctx-tile-items"), |ui| {
                        for &(k, id) in &stack {
                            if ui.button(name(id)).clicked() {
                                self.open_properties(h, PropTarget::Item(k));
                                ui.close_menu();
                            }
                        }
                    });
                }
                if tile.creature.is_some() && ui.button(t("ctx-creature")).clicked() {
                    self.open_properties(h, PropTarget::Creature);
                    ui.close_menu();
                }
                if tile.spawn_radius > 0 && ui.button(t("ctx-spawn")).clicked() {
                    self.open_properties(h, PropTarget::Spawn);
                    ui.close_menu();
                }
                if let Some(&(_, id)) = stack.first() {
                    if ui.button(t("ctx-replace-item")).clicked() {
                        self.open_replace(Some(id));
                        ui.close_menu();
                    }
                }
                ui.separator();
                // RME "Select RAW" / "Select brush": pick it and jump to it in the palette.
                if let Some(&(_, id)) = stack.first() {
                    if ui.button(format!("{}: {}", t("ctx-select-raw"), name(id))).clicked() {
                        self.select_raw_in_palette(id);
                        ui.close_menu();
                    }
                }
                if ui.add_enabled(brush.is_some(), egui::Button::new(brush_label)).clicked() {
                    if let Some(b) = brush {
                        self.select_brush_in_palette(b);
                    }
                    ui.close_menu();
                }
                ui.separator();
            }
        }
        if let Some(h) = at {
            if ui.button(t("ctx-properties")).clicked() {
                self.inspect = Some(h);
                self.inspect_edit = None;
                ui.close_menu();
            }
            if ui.button(t("ctx-copy-position")).clicked() {
                ctx.copy_text(format!("{}, {}, {}", h.x, h.y, h.z));
                ui.close_menu();
            }
            // Last entry, like RME.
            let has_tile = self.editor.as_ref().is_some_and(|e| e.map.get(h).is_some());
            if has_tile {
                ui.separator();
                if ui.button(format!("\u{1F50D} {}", t("ctx-browse-field"))).clicked() {
                    self.browse = Some(crate::browse::BrowseField { pos: h, sel: None });
                    ui.close_menu();
                }
            }
        }
    }

    // ------------------------------------------------------------------ drawing

    fn draw(&mut self, ctx: &egui::Context, ui: &mut egui::Ui, rect: Rect, hover_xy: Option<(i32, i32)>) {
        let painter = ui.painter_at(rect);
        let (Some(ed), Some(assets), Some(atlas)) = (&self.editor, &self.assets, &mut self.atlas) else { return };
        let frame = crate::app::anim_frame_for(&self.settings, ctx);
        let key = CacheKey {
            anim_tick: frame as u64,
            ambient: if self.settings.view.show_lights { self.settings.view.ambient_light } else { 0 },
            cam: self.cam,
            size: rect.size(),
            map_rev: ed.map.revision,
            atlas_gen: atlas.generation,
            sel_rev: self.sel_rev,
            view_hash: view::view_hash(&self.settings.view),
            house: self.current_house,
        };
        let valid = self.cache.as_ref().is_some_and(|c| c.key == key && c.complete);
        if !valid {
            let t0 = Instant::now();
            let mut dc = DrawCtx { ctx, atlas, assets, cam: self.cam, rect, frame, spawns: Vec::new(), tech: self.settings.view.show_tech_items };
            let (shapes, quads, tooltips) = view::build_map(&mut dc, &ed.map, &self.settings.view, &ed.selection, self.current_house);
            let complete = !dc.atlas.missing;
            self.last_build_ms = t0.elapsed().as_secs_f32() * 1000.0;
            self.last_quads = quads;
            self.cache = Some(MapCache { key, shapes, tooltips, complete });
            if !complete {
                ctx.request_repaint();
            }
        }
        if let Some(c) = &self.cache {
            painter.extend(c.shapes.iter().cloned());
            if self.pending.is_none() {
                paint_tooltips(&painter, &c.tooltips, self.cam.zoom);
            }
        }

        // Grid
        if self.settings.view.show_grid && self.cam.zoom >= 0.35 {
            let col = Color32::from_rgba_unmultiplied(255, 255, 255, 28);
            let ts = TILE * self.cam.zoom;
            let ox = (-self.cam.x * self.cam.zoom).rem_euclid(ts);
            let oy = (-self.cam.y * self.cam.zoom).rem_euclid(ts);
            let mut x = rect.min.x + ox;
            while x < rect.max.x {
                painter.line_segment([egui::pos2(x, rect.min.y), egui::pos2(x, rect.max.y)], Stroke::new(1.0_f32, col));
                x += ts;
            }
            let mut y = rect.min.y + oy;
            while y < rect.max.y {
                painter.line_segment([egui::pos2(rect.min.x, y), egui::pos2(rect.max.x, y)], Stroke::new(1.0_f32, col));
                y += ts;
            }
        }

        self.draw_pending(ctx, &painter, rect);
        self.draw_preview(ctx, &painter, rect, hover_xy);
    }

    /// Ghost of the current brush / paste buffer / selection box under the cursor.
    fn draw_preview(&mut self, ctx: &egui::Context, painter: &egui::Painter, rect: Rect, hover_xy: Option<(i32, i32)>) {
        let (Some(ed), Some(assets), Some(atlas)) = (&self.editor, &self.assets, &mut self.atlas) else { return };
        let cam = self.cam;
        let z = cam.floor;
        let tile_rect = |x: i32, y: i32| cam.tile_rect(rect, x, y, z);

        // Selection box / rectangle fill outline.
        match (self.gesture, hover_xy) {
            (Gesture::BoxSelect { start }, Some(end)) | (Gesture::RectFill { start, .. }, Some(end)) => {
                let a = tile_rect(start.0.min(end.0), start.1.min(end.1));
                let b = tile_rect(start.0.max(end.0), start.1.max(end.1));
                let r = Rect::from_min_max(a.min, b.max);
                painter.rect_filled(r, 0.0, Color32::from_rgba_unmultiplied(80, 160, 255, 30));
                painter.rect_stroke(r, 0.0, Stroke::new(1.5_f32, Color32::from_rgb(120, 190, 255)), egui::StrokeKind::Inside);
                let w = (start.0 - end.0).abs() + 1;
                let h = (start.1 - end.1).abs() + 1;
                painter.text(r.max + Vec2::new(6.0, 6.0), egui::Align2::LEFT_TOP, format!("{w} x {h}"), egui::FontId::proportional(13.0), Color32::WHITE);
            }
            (Gesture::MoveSelection { start }, Some(end)) if start != end => {
                let (dx, dy) = (end.0 - start.0, end.1 - start.1);
                for p in ed.selection.iter().filter(|p| p.z == z) {
                    let r = tile_rect(p.x as i32 + dx, p.y as i32 + dy);
                    painter.rect_filled(r, 0.0, Color32::from_rgba_unmultiplied(255, 255, 255, 40));
                }
            }
            _ => {}
        }
        let Some(hxy) = hover_xy else { return };
        let mut b = Builder::new();
        let ghost = Color32::from_rgba_unmultiplied(255, 255, 255, 150);
        let frame = crate::app::anim_frame_for(&self.settings, ctx);
        let mut dc = DrawCtx { ctx, atlas, assets, cam, rect, frame, spawns: Vec::new(), tech: self.settings.view.show_tech_items };

        if self.paste_mode {
            let base_z = ed.clipboard.tiles.iter().map(|t| t.pos.z).min().unwrap_or(z);
            for pt in ed.clipboard.tiles.iter().filter(|t| t.pos.z == base_z) {
                let pos = Position::new((hxy.0 + pt.pos.x as i32).clamp(0, 65535) as u16, (hxy.1 + pt.pos.y as i32).clamp(0, 65535) as u16, z);
                dc.tile(&mut b, pos, &pt.tile, &self.settings.view, false, 0, 150);
            }
            let r0 = tile_rect(hxy.0, hxy.1);
            let r1 = tile_rect(hxy.0 + ed.clipboard.width as i32 - 1, hxy.1 + ed.clipboard.height as i32 - 1);
            b.outline(Rect::from_min_max(r0.min, r1.max), 1.5, Color32::from_rgb(120, 190, 255));
        } else if let Some(brush) = &self.brush {
            let size = if matches!(self.gesture, Gesture::RectFill { .. }) { 0 } else { self.brush_size };
            let area = brushes::area(hxy.0, hxy.1, size, self.brush_shape);
            let world = |x: i32, y: i32| {
                let o = cam.floor_offset(z);
                (((x - o) as f32) * TILE, ((y - o) as f32) * TILE)
            };
            let square = |b: &mut Builder, x: i32, y: i32, c: Color32| b.fill(tile_rect(x, y), c);
            match brush {
                Brush::Raw(id) => {
                    for &(x, y) in &area {
                        let (wx, wy) = world(x, y);
                        let p = Position::new(x.max(0) as u16, y.max(0) as u16, z);
                        dc.item(&mut b, &Item::new(*id), p, None, wx, wy, ghost);
                    }
                }
                Brush::Material(id) => {
                    let mat = assets.mat.clone();
                    match mat.brush(*id).map(|b| &b.kind) {
                        Some(BrushKind::Doodad(_)) => {
                            if let Some(buf) = &self.doodad_buffer {
                                for (dx, dy, _dz, items) in buf {
                                    let (wx, wy) = world(hxy.0 + dx, hxy.1 + dy);
                                    let p = Position::new((hxy.0 + dx).max(0) as u16, (hxy.1 + dy).max(0) as u16, z);
                                    let (mut ex, mut ey) = (wx, wy);
                                    for it in items {
                                        let e = dc.item(&mut b, it, p, None, ex, ey, ghost);
                                        ex -= e;
                                        ey -= e;
                                    }
                                }
                            }
                        }
                        Some(_) => {
                            let look = mat.brush(*id).map(|b| b.look_id).unwrap_or(0);
                            for &(x, y) in &area {
                                let (wx, wy) = world(x, y);
                                let p = Position::new(x.max(0) as u16, y.max(0) as u16, z);
                                dc.item(&mut b, &Item::new(look), p, None, wx, wy, ghost);
                            }
                        }
                        None => {}
                    }
                }
                Brush::Eraser => {
                    for &(x, y) in &area {
                        square(&mut b, x, y, Color32::from_rgba_unmultiplied(255, 60, 60, 70));
                    }
                }
                Brush::Zone(f) => {
                    let c = zone_color(*f);
                    for &(x, y) in &area {
                        square(&mut b, x, y, Color32::from_rgba_unmultiplied(c.r(), c.g(), c.b(), 90));
                    }
                }
                Brush::House(_) => {
                    for &(x, y) in &area {
                        square(&mut b, x, y, Color32::from_rgba_unmultiplied(80, 140, 255, 90));
                    }
                }
                Brush::HouseExit(_) | Brush::Waypoint(_) => {
                    b.outline(tile_rect(hxy.0, hxy.1).shrink(2.0), 2.0, Color32::from_rgb(80, 220, 255));
                }
                Brush::Spawn => {
                    let r = self.brush_size.max(1);
                    let a = tile_rect(hxy.0 - r, hxy.1 - r);
                    let c = tile_rect(hxy.0 + r, hxy.1 + r);
                    b.outline(Rect::from_min_max(a.min, c.max), 2.0, Color32::from_rgb(255, 140, 0));
                }
                Brush::Creature { name, npc } => {
                    for &(x, y) in &area {
                        let (wx, wy) = world(x, y);
                        dc.creature(&mut b, name, *npc, self.settings.default_direction, wx, wy, ghost);
                    }
                }
            }
            // Cursor outline
            let a = tile_rect(hxy.0 - size, hxy.1 - size);
            let c = tile_rect(hxy.0 + size, hxy.1 + size);
            let outline = Rect::from_min_max(a.min, c.max);
            if self.brush_shape == BrushShape::Circle && size > 0 {
                painter.circle_stroke(outline.center(), outline.width() / 2.0, Stroke::new(1.0_f32, Color32::from_white_alpha(120)));
            } else {
                b.outline(outline, 1.0, Color32::from_white_alpha(120));
            }
        } else {
            b.outline(tile_rect(hxy.0, hxy.1), 1.0, Color32::from_white_alpha(140));
        }
        let shapes: Vec<Shape> = b.into_shapes();
        painter.extend(shapes);
        if dc.atlas.missing {
            ctx.request_repaint();
        }
    }
}
