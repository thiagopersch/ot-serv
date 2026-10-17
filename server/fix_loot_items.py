#!/usr/bin/env python3
"""
Script to convert <item name="..."> to <item id="..."> in monster loot files,
using items.xml as the name-to-ID mapping source.
"""

import os
import re
from collections import OrderedDict

ITEMS_XML = r"C:\Users\thiag\Projetos\server-tibia\data\items\items.xml"
MONSTER_DIR = r"C:\Users\thiag\Projetos\server-tibia\data\monster"

def build_name_to_id_map(items_xml_path):
    """Parse items.xml and build a name -> id mapping."""
    name_to_id = OrderedDict()
    
    with open(items_xml_path, 'r', encoding='iso-8859-1') as f:
        content = f.read()
    
    pattern = re.compile(
        r'<item\s+'
        r'(?:fromid="(\d+)"\s+toid="\d+"|id="(\d+)")\s+'
        r'[^>]*?name="([^"]+)"'
    )
    
    for match in pattern.finditer(content):
        item_id = match.group(1) or match.group(2)
        name = match.group(3).lower().strip()
        if name not in name_to_id:
            name_to_id[name] = item_id
    
    print(f"[INFO] Loaded {len(name_to_id)} unique item names from items.xml")
    return name_to_id

def fix_monster_file(filepath, name_to_id):
    """Fix a single monster file, converting <item name='...'> to <item id='...'>."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    original = content
    
    def replace_item_name(match):
        full_tag = match.group(0)
        name = match.group(1)
        
        name_lower = name.lower().strip()
        
        if name_lower in name_to_id:
            item_id = name_to_id[name_lower]
        else:
            if name in name_to_id:
                item_id = name_to_id[name]
            else:
                print(f"  [WARN] Item not found in items.xml: '{name}' -> keeping as-is")
                return full_tag
        
        if 'id=' in full_tag:
            return full_tag
        
        rest = re.sub(r'\s+name="[^"]*"', '', full_tag, count=1)
        
        if rest.strip().endswith('/>'):
            base = rest.rstrip()
            base = re.sub(r'\s*/>$', '', base)
            result = f'{base} id="{item_id}" /> <!-- {name} -->'
        else:
            base = rest.rstrip()
            if base.endswith('>'):
                base = base[:-1]
            base = base.rstrip()
            result = f'{base} id="{item_id}"> <!-- {name} -->'
        
        return result
    
    pattern = r'<item\s+name="([^"]*)"([^>]*?)/?>'
    new_content = re.sub(pattern, replace_item_name, content)
    
    if new_content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    
    return False

def main():
    name_to_id = build_name_to_id_map(ITEMS_XML)
    
    fixed_files = []
    total_files_checked = 0
    
    for root, dirs, files in os.walk(MONSTER_DIR):
        for filename in files:
            if not filename.endswith('.xml'):
                continue
            
            filepath = os.path.join(root, filename)
            
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content_preview = f.read(4096)
            
            if 'item name="' not in content_preview:
                continue
            
            total_files_checked += 1
            relpath = os.path.relpath(filepath, MONSTER_DIR)
            
            try:
                if fix_monster_file(filepath, name_to_id):
                    fixed_files.append(relpath)
                    print(f"[FIXED] {relpath}")
                else:
                    print(f"[SKIP]  {relpath} (no changes)")
            except Exception as e:
                print(f"[ERROR] {relpath}: {e}")
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total files checked: {total_files_checked}")
    print(f"Total files fixed:   {len(fixed_files)}")
    print(f"\nFixed files:")
    for f in fixed_files:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
