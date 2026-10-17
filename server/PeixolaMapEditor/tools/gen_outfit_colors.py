"""Extracts RME's TemplateOutfitLookupTable (source/graphics.cpp) as a Rust array.
Usage: python gen_outfit_colors.py <RME/source/graphics.cpp>  (prints the Rust snippet)"""
import re
import sys

src = open(sys.argv[1], encoding="utf-8", errors="replace").read()
body = src[src.index("TemplateOutfitLookupTable[] = {"):]
body = body[: body.index("};")]
vals = re.findall(r"0x[0-9A-Fa-f]{6}", body)
print(f"pub const OUTFIT_COLORS: [u32; {len(vals)}] = [")
for i in range(0, len(vals), 8):
    print("    " + ", ".join(v.upper().replace("0X", "0x") for v in vals[i:i + 8]) + ",")
print("];")
