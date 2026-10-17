//! Map items. Attributes are kept as an ordered list so a load/save round-trip is lossless
//! (including attributes this editor does not interpret).

use crate::position::Position;

/// One OTBM item attribute, in the order it appeared in the file.
#[derive(Clone, PartialEq, Debug)]
pub enum Attr {
    Count(u8),
    ActionId(u16),
    UniqueId(u16),
    Text(String),
    Desc(String),
    TeleDest(Position),
    DepotId(u16),
    RuneCharges(u8),
    HouseDoorId(u8),
    Charges(u16),
    Duration(u32),
    DecayingState(u8),
    WrittenDate(u32),
    WrittenBy(String),
    SleeperGuid(u32),
    SleepStart(u32),
    Tier(u8),
    PodiumOutfit([u8; 15]),
    /// OTBM_ATTR_ATTRIBUTE_MAP (128) payload, kept raw.
    AttributeMap(Vec<u8>),
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct ItemExt {
    pub attrs: Vec<Attr>,
    /// Container contents (bottom to top as stored in the file).
    pub children: Vec<Item>,
}

/// A map item: a server id plus optional attributes. 16 bytes when it has no attributes.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct Item {
    pub id: u16,
    pub ext: Option<Box<ItemExt>>,
}

macro_rules! simple_attr {
    ($get:ident, $set:ident, $variant:ident, $ty:ty) => {
        pub fn $get(&self) -> $ty {
            self.attrs().iter().find_map(|a| if let Attr::$variant(v) = a { Some(*v) } else { None }).unwrap_or_default()
        }
        /// Sets the attribute; a zero value removes it.
        pub fn $set(&mut self, v: $ty) {
            if v == <$ty>::default() {
                self.remove_attr(|a| matches!(a, Attr::$variant(_)));
            } else {
                self.upsert_attr(|a| matches!(a, Attr::$variant(_)), Attr::$variant(v));
            }
        }
    };
}

impl Item {
    #[inline]
    pub const fn new(id: u16) -> Self {
        Self { id, ext: None }
    }

    pub fn with_count(id: u16, count: u8) -> Self {
        let mut it = Self::new(id);
        it.set_attr_count(count);
        it
    }

    #[inline]
    pub fn attrs(&self) -> &[Attr] {
        self.ext.as_ref().map(|e| e.attrs.as_slice()).unwrap_or(&[])
    }

    #[inline]
    pub fn children(&self) -> &[Item] {
        self.ext.as_ref().map(|e| e.children.as_slice()).unwrap_or(&[])
    }

    pub fn ext_mut(&mut self) -> &mut ItemExt {
        self.ext.get_or_insert_with(Default::default)
    }

    fn shrink(&mut self) {
        if self.ext.as_ref().is_some_and(|e| e.attrs.is_empty() && e.children.is_empty()) {
            self.ext = None;
        }
    }

    pub fn remove_attr(&mut self, pred: impl Fn(&Attr) -> bool) {
        if let Some(e) = self.ext.as_mut() {
            e.attrs.retain(|a| !pred(a));
        }
        self.shrink();
    }

    pub fn upsert_attr(&mut self, pred: impl Fn(&Attr) -> bool, value: Attr) {
        let e = self.ext_mut();
        if let Some(slot) = e.attrs.iter_mut().find(|a| pred(a)) {
            *slot = value;
        } else {
            e.attrs.push(value);
        }
    }

    /// Subtype: stack count, fluid type or charges (RME `getSubtype`).
    pub fn subtype(&self) -> u16 {
        for a in self.attrs() {
            match a {
                Attr::Count(c) | Attr::RuneCharges(c) => return *c as u16,
                Attr::Charges(c) => return *c,
                _ => {}
            }
        }
        0
    }

    pub fn set_attr_count(&mut self, count: u8) {
        self.upsert_attr(|a| matches!(a, Attr::Count(_)), Attr::Count(count));
    }

    simple_attr!(action_id, set_action_id, ActionId, u16);
    simple_attr!(unique_id, set_unique_id, UniqueId, u16);
    simple_attr!(depot_id, set_depot_id, DepotId, u16);
    simple_attr!(door_id, set_door_id, HouseDoorId, u8);

    pub fn text(&self) -> &str {
        self.attrs().iter().find_map(|a| if let Attr::Text(v) = a { Some(v.as_str()) } else { None }).unwrap_or("")
    }

    pub fn set_text(&mut self, v: &str) {
        if v.is_empty() {
            self.remove_attr(|a| matches!(a, Attr::Text(_)));
        } else {
            self.upsert_attr(|a| matches!(a, Attr::Text(_)), Attr::Text(v.to_owned()));
        }
    }

    pub fn description(&self) -> &str {
        self.attrs().iter().find_map(|a| if let Attr::Desc(v) = a { Some(v.as_str()) } else { None }).unwrap_or("")
    }

    pub fn set_description(&mut self, v: &str) {
        if v.is_empty() {
            self.remove_attr(|a| matches!(a, Attr::Desc(_)));
        } else {
            self.upsert_attr(|a| matches!(a, Attr::Desc(_)), Attr::Desc(v.to_owned()));
        }
    }

    pub fn tele_dest(&self) -> Option<Position> {
        self.attrs().iter().find_map(|a| if let Attr::TeleDest(p) = a { Some(*p) } else { None })
    }

    pub fn set_tele_dest(&mut self, p: Option<Position>) {
        match p {
            Some(p) => self.upsert_attr(|a| matches!(a, Attr::TeleDest(_)), Attr::TeleDest(p)),
            None => self.remove_attr(|a| matches!(a, Attr::TeleDest(_))),
        }
    }

    /// True if the item carries data that an eraser in "leave unique" mode must keep.
    pub fn is_complex(&self) -> bool {
        self.action_id() != 0 || self.unique_id() != 0 || !self.children().is_empty() || self.tele_dest().is_some() || !self.text().is_empty()
    }

    /// Rough heap size, used to bound the undo history.
    pub fn mem_size(&self) -> usize {
        std::mem::size_of::<Item>()
            + self.ext.as_ref().map_or(0, |e| {
                std::mem::size_of::<ItemExt>() + e.attrs.len() * std::mem::size_of::<Attr>() + e.children.iter().map(Item::mem_size).sum::<usize>()
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attrs_set_and_remove() {
        let mut it = Item::new(100);
        assert!(it.ext.is_none());
        it.set_action_id(1000);
        it.set_unique_id(2000);
        assert_eq!(it.action_id(), 1000);
        assert_eq!(it.unique_id(), 2000);
        it.set_action_id(0);
        it.set_unique_id(0);
        assert!(it.ext.is_none(), "empty attribute list should be dropped");
        it.set_text("hello");
        assert_eq!(it.text(), "hello");
        it.set_attr_count(7);
        assert_eq!(it.subtype(), 7);
    }
}
