use std::fmt;

/// A map position. x/y are 0..=65535, z is the floor 0..=15 (7 = ground level).
#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default, Debug)]
pub struct Position {
    pub x: u16,
    pub y: u16,
    pub z: u8,
}

impl Position {
    #[inline]
    pub const fn new(x: u16, y: u16, z: u8) -> Self {
        Self { x, y, z }
    }

    /// Offset by a signed delta; returns None when the result leaves the map bounds.
    #[inline]
    pub fn offset(self, dx: i32, dy: i32, dz: i32) -> Option<Self> {
        let x = self.x as i32 + dx;
        let y = self.y as i32 + dy;
        let z = self.z as i32 + dz;
        if (0..=0xFFFF).contains(&x) && (0..=0xFFFF).contains(&y) && (0..=15).contains(&z) {
            Some(Self::new(x as u16, y as u16, z as u8))
        } else {
            None
        }
    }
}

impl fmt::Display for Position {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}, {}, {}", self.x, self.y, self.z)
    }
}
