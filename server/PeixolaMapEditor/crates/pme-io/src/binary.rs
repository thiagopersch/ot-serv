//! OpenTibia node file format (OTB / OTBM): `0xFE type data... children... 0xFF`, with
//! 0xFD escaping any 0xFD/0xFE/0xFF byte inside node data.

use anyhow::{bail, Result};

pub const NODE_START: u8 = 0xFE;
pub const NODE_END: u8 = 0xFF;
pub const ESCAPE: u8 = 0xFD;

/// Streaming reader over an in-memory (usually memory-mapped) node file.
pub struct NodeReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> NodeReader<'a> {
    /// `data` is the whole file; node data starts after the 4-byte identifier.
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 4 }
    }

    pub fn position(&self) -> usize {
        self.pos
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Enter the node starting at the cursor. Its unescaped data (type byte first) is written to
    /// `buf`. The cursor stops at the first child or at the node end.
    pub fn enter(&mut self, buf: &mut Vec<u8>) -> Result<u8> {
        if self.data.get(self.pos) != Some(&NODE_START) {
            bail!("expected node start at offset {}", self.pos);
        }
        self.pos += 1;
        buf.clear();
        let d = self.data;
        let mut i = self.pos;
        loop {
            let Some(&b) = d.get(i) else { bail!("unexpected end of file inside node") };
            match b {
                NODE_START | NODE_END => break,
                ESCAPE => {
                    let Some(&e) = d.get(i + 1) else { bail!("unexpected end of file after escape") };
                    buf.push(e);
                    i += 2;
                }
                _ => {
                    // Copy the run of plain bytes in one go.
                    let start = i;
                    while i < d.len() && !matches!(d[i], NODE_START | NODE_END | ESCAPE) {
                        i += 1;
                    }
                    buf.extend_from_slice(&d[start..i]);
                }
            }
        }
        self.pos = i;
        let Some(&t) = buf.first() else { bail!("empty node at offset {}", self.pos) };
        Ok(t)
    }

    /// After `enter` (or after finishing a child): returns true if another child starts here,
    /// false if the current node ends (the end marker is consumed).
    pub fn next_child(&mut self) -> Result<bool> {
        match self.data.get(self.pos) {
            Some(&NODE_START) => Ok(true),
            Some(&NODE_END) => {
                self.pos += 1;
                Ok(false)
            }
            Some(b) => bail!("unexpected byte {b:#x} at offset {}", self.pos),
            None => bail!("unexpected end of file"),
        }
    }

    /// Skip the node at the cursor including all of its children.
    pub fn skip_node(&mut self) -> Result<()> {
        let mut depth = 0usize;
        let d = self.data;
        let mut i = self.pos;
        while i < d.len() {
            match d[i] {
                ESCAPE => i += 1,
                NODE_START => depth += 1,
                NODE_END => {
                    depth -= 1;
                    if depth == 0 {
                        self.pos = i + 1;
                        return Ok(());
                    }
                }
                _ => {}
            }
            i += 1;
        }
        bail!("unexpected end of file while skipping node")
    }
}

/// Little-endian cursor over unescaped node data.
pub struct Props<'b> {
    pub b: &'b [u8],
    pub pos: usize,
}

impl<'b> Props<'b> {
    pub fn new(b: &'b [u8]) -> Self {
        Self { b, pos: 0 }
    }

    #[inline]
    pub fn remaining(&self) -> usize {
        self.b.len() - self.pos
    }

    #[inline]
    pub fn has_more(&self) -> bool {
        self.pos < self.b.len()
    }

    #[inline]
    fn take(&mut self, n: usize) -> Result<&'b [u8]> {
        if self.pos + n > self.b.len() {
            bail!("unexpected end of node data (need {n}, have {})", self.remaining());
        }
        let s = &self.b[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    #[inline]
    pub fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    #[inline]
    pub fn u16(&mut self) -> Result<u16> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }
    #[inline]
    pub fn u32(&mut self) -> Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    pub fn bytes(&mut self, n: usize) -> Result<&'b [u8]> {
        self.take(n)
    }
    pub fn skip(&mut self, n: usize) -> Result<()> {
        self.take(n).map(|_| ())
    }
    /// u16 length-prefixed string (Latin-1 bytes mapped to chars so round-trips are exact).
    pub fn string(&mut self) -> Result<String> {
        let n = self.u16()? as usize;
        Ok(latin1_to_string(self.take(n)?))
    }
}

pub fn latin1_to_string(b: &[u8]) -> String {
    b.iter().map(|&c| c as char).collect()
}

pub fn string_to_latin1(s: &str) -> Vec<u8> {
    s.chars().map(|c| if (c as u32) < 256 { c as u8 } else { b'?' }).collect()
}

/// Node file writer (in memory).
pub struct NodeWriter {
    pub out: Vec<u8>,
}

impl NodeWriter {
    pub fn new(identifier: &[u8; 4]) -> Self {
        let mut out = Vec::with_capacity(1 << 20);
        out.extend_from_slice(identifier);
        Self { out }
    }

    #[inline]
    pub fn start(&mut self, node_type: u8) {
        self.out.push(NODE_START);
        self.u8(node_type);
    }

    #[inline]
    pub fn end(&mut self) {
        self.out.push(NODE_END);
    }

    #[inline]
    pub fn u8(&mut self, v: u8) {
        if matches!(v, NODE_START | NODE_END | ESCAPE) {
            self.out.push(ESCAPE);
        }
        self.out.push(v);
    }

    pub fn raw(&mut self, b: &[u8]) {
        for &v in b {
            self.u8(v);
        }
    }

    #[inline]
    pub fn u16(&mut self, v: u16) {
        self.raw(&v.to_le_bytes());
    }

    #[inline]
    pub fn u32(&mut self, v: u32) {
        self.raw(&v.to_le_bytes());
    }

    pub fn string(&mut self, s: &str) {
        let b = string_to_latin1(s);
        self.u16(b.len() as u16);
        self.raw(&b);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_roundtrip() {
        let mut w = NodeWriter::new(b"TEST");
        w.start(1);
        w.u32(0xFFFE_FD01);
        w.string("ação");
        w.start(2);
        w.u8(0xFE);
        w.end();
        w.start(3);
        w.end();
        w.end();

        let mut r = NodeReader::new(&w.out);
        let mut buf = Vec::new();
        assert_eq!(r.enter(&mut buf).unwrap(), 1);
        let mut p = Props::new(&buf[1..]);
        assert_eq!(p.u32().unwrap(), 0xFFFE_FD01);
        assert_eq!(p.string().unwrap(), "ação");
        assert!(r.next_child().unwrap());
        assert_eq!(r.enter(&mut buf).unwrap(), 2);
        assert_eq!(buf[1], 0xFE);
        assert!(!r.next_child().unwrap());
        assert!(r.next_child().unwrap());
        r.skip_node().unwrap();
        assert!(!r.next_child().unwrap());
        assert_eq!(r.position(), w.out.len());
    }
}
