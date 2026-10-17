//! Reproducible randomness. Brushes and generators use `fastrand`'s thread-local generator;
//! [`with_seed`] seeds it for one operation and restores the previous state afterwards, so the
//! same seed + the same starting map give the same result.

/// Run `f` with the thread-local generator seeded with `seed`, then restore it.
pub fn with_seed<R>(seed: u64, f: impl FnOnce() -> R) -> R {
    let saved = fastrand::get_seed();
    fastrand::seed(seed);
    let r = f();
    fastrand::seed(saved);
    r
}

/// Mix a base seed with a position (per-tile reproducible brush strokes).
#[inline]
pub fn mix(seed: u64, x: u16, y: u16, z: u8) -> u64 {
    // SplitMix64 finaliser over the combined value.
    let mut v = seed ^ ((x as u64) << 32 | (y as u64) << 8 | z as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15);
    v = (v ^ (v >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    v = (v ^ (v >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    v ^ (v >> 31)
}

/// A fresh random seed (for the 🎲 buttons).
pub fn random_seed() -> u64 {
    fastrand::u64(..)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_sequence_and_state_restored() {
        fastrand::seed(7);
        let a: Vec<u32> = with_seed(42, || (0..8).map(|_| fastrand::u32(..)).collect());
        let after_a = fastrand::u32(..);
        fastrand::seed(7);
        let b: Vec<u32> = with_seed(42, || (0..8).map(|_| fastrand::u32(..)).collect());
        let after_b = fastrand::u32(..);
        assert_eq!(a, b, "same seed → same values");
        assert_eq!(after_a, after_b, "outer generator restored");
        let c: Vec<u32> = with_seed(43, || (0..8).map(|_| fastrand::u32(..)).collect());
        assert_ne!(a, c);
        assert_ne!(mix(1, 10, 10, 7), mix(1, 11, 10, 7));
    }
}
