//! Small vector icons painted with egui shapes (crisp at any scale, no image assets).

use eframe::egui::{self, pos2, vec2, Color32, Pos2, Rect, Response, Sense, Shape, Stroke, Vec2};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ToolIcon {
    /// Mouse pointer (selection tool).
    Cursor,
    /// Eraser block.
    Eraser,
}

/// Paint `icon` inside `r`.
pub fn paint(painter: &egui::Painter, r: Rect, icon: ToolIcon) {
    let s = r.width().min(r.height());
    let o = r.center() - vec2(s, s) / 2.0;
    // Map a point in a 16x16 design grid to the rect.
    let p = |x: f32, y: f32| -> Pos2 { o + vec2(x, y) * (s / 16.0) };
    let outline = Stroke::new((s / 16.0).max(1.0), Color32::from_gray(20));
    match icon {
        ToolIcon::Cursor => {
            // Classic arrow pointer.
            let pts = vec![p(3.0, 1.0), p(3.0, 13.5), p(6.2, 10.6), p(8.4, 15.0), p(10.4, 14.0), p(8.3, 9.8), p(12.6, 9.8)];
            painter.add(Shape::convex_polygon(vec![p(3.0, 1.0), p(3.0, 13.5), p(6.2, 10.6), p(8.3, 9.8), p(12.6, 9.8)], Color32::WHITE, Stroke::NONE));
            painter.add(Shape::convex_polygon(vec![p(6.2, 10.6), p(8.4, 15.0), p(10.4, 14.0), p(8.3, 9.8)], Color32::WHITE, Stroke::NONE));
            painter.add(Shape::closed_line(pts, outline));
        }
        ToolIcon::Eraser => {
            // Tilted block: pink body + light band at the bottom-left end.
            let body = vec![p(7.0, 2.5), p(14.5, 10.0), p(10.0, 14.5), p(2.5, 7.0)];
            let band = [p(5.0, 9.5), p(10.0, 14.5)];
            painter.add(Shape::convex_polygon(vec![p(7.0, 2.5), p(14.5, 10.0), p(10.0, 14.5), p(2.5, 7.0)], Color32::from_rgb(240, 120, 150), Stroke::NONE));
            painter.add(Shape::convex_polygon(vec![p(2.5, 7.0), p(10.0, 14.5), p(7.6, 14.9), p(1.6, 8.9)], Color32::from_rgb(235, 235, 245), Stroke::NONE));
            painter.add(Shape::closed_line(body, outline));
            painter.add(Shape::line_segment([band[0], band[1]], outline));
            // Floor line.
            painter.add(Shape::line_segment([p(1.0, 15.3), p(15.0, 15.3)], Stroke::new(outline.width, Color32::from_gray(140))));
        }
    }
}

/// Selectable toolbar button: vector icon + label (like `ui.selectable_label`).
pub fn tool_button(ui: &mut egui::Ui, selected: bool, icon: ToolIcon, label: &str) -> Response {
    let font = egui::TextStyle::Button.resolve(ui.style());
    let galley = ui.painter().layout_no_wrap(label.to_owned(), font, Color32::PLACEHOLDER);
    let pad = ui.spacing().button_padding;
    let icon_size = galley.size().y.max(14.0) + 2.0;
    let size = Vec2::new(pad.x * 2.0 + icon_size + 5.0 + galley.size().x, (pad.y * 2.0 + icon_size).max(ui.spacing().interact_size.y));
    let (rect, resp) = ui.allocate_exact_size(size, Sense::click());
    if ui.is_rect_visible(rect) {
        let visuals = ui.style().interact_selectable(&resp, selected);
        if selected || resp.hovered() || resp.has_focus() {
            ui.painter().rect(rect, visuals.corner_radius, visuals.weak_bg_fill, visuals.bg_stroke, egui::StrokeKind::Inside);
        }
        let icon_rect = Rect::from_min_size(pos2(rect.min.x + pad.x, rect.center().y - icon_size / 2.0), Vec2::splat(icon_size));
        paint(ui.painter(), icon_rect, icon);
        let text_pos = pos2(icon_rect.max.x + 5.0, rect.center().y - galley.size().y / 2.0);
        ui.painter().galley(text_pos, galley, visuals.text_color());
    }
    resp
}
