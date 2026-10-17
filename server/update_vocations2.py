import re

with open(r'c:\Users\thiag\Projetos\server-tibia\vocacoes_classes.txt', 'r', encoding='utf-8') as f:
    lines = f.read().strip().split('\n')

class_map = {}
for line in lines:
    if '->' in line:
        parts = line.split('->')
        name = parts[0].strip()
        cls = parts[1].strip()
        class_map[name] = cls

with open(r'c:\Users\thiag\Projetos\server-tibia\data\XML\vocations.xml', 'r', encoding='utf-8') as f:
    content = f.read()

def update_attr(tag, attr, value, text):
    return re.sub(rf'(<{tag}[^>]*?{attr}=")[^"]+(")', rf'\g<1>{value}\g<2>', text)

def replacer(match):
    voc_content = match.group(0)
    id_match = re.search(r'id="(\d+)"', voc_content)
    if not id_match:
        return voc_content
    
    vid = int(id_match.group(1))
    if vid == 0:
        return voc_content
        
    name_match = re.search(r'name="([^"]+)"', voc_content)
    name = name_match.group(1) if name_match else ""
    
    archetype = class_map.get(name, "DPS")
    universe = "Bleach" if vid >= 47 else ("Dragon Ball" if vid >= 1 else "None")
    
    if 'type_class=' not in voc_content:
        first_gt_idx = voc_content.find('>')
        if voc_content[first_gt_idx-1] == '/':
            voc_content = voc_content[:first_gt_idx-1] + f' type_class="{archetype}" ' + voc_content[first_gt_idx-1:]
        else:
            voc_content = voc_content[:first_gt_idx] + f' type_class="{archetype}"' + voc_content[first_gt_idx:]
    else:
        voc_content = re.sub(r'type_class="[^"]+"', f'type_class="{archetype}"', voc_content)

    if 'type_universe=' not in voc_content:
        first_gt_idx = voc_content.find('>')
        if voc_content[first_gt_idx-1] == '/':
            voc_content = voc_content[:first_gt_idx-1] + f' type_universe="{universe}" ' + voc_content[first_gt_idx-1:]
        else:
            voc_content = voc_content[:first_gt_idx] + f' type_universe="{universe}"' + voc_content[first_gt_idx:]
    else:
        voc_content = re.sub(r'type_universe="[^"]+"', f'type_universe="{universe}"', voc_content)

    voc_content = update_attr('vocation', 'soulmax', '200', voc_content)
    
    for attr in ['fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing', 'experience']:
        voc_content = update_attr('skill', attr, '2.0', voc_content)
        
    if archetype == "DPS":
        voc_content = update_attr('vocation', 'gainhp', '250', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '250', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '900', voc_content)
        voc_content = update_attr('vocation', 'manamultiplier', '1.1', voc_content)
        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.7', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
            
    elif archetype == "Bruiser":
        voc_content = update_attr('vocation', 'gainhp', '250', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '250', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1000', voc_content)
        voc_content = update_attr('vocation', 'manamultiplier', '1.1', voc_content)
        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.6', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.05', voc_content)

    elif archetype == "Suporte":
        voc_content = update_attr('vocation', 'gainhp', '150', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '450', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1000', voc_content)
        voc_content = update_attr('vocation', 'manamultiplier', '1.05', voc_content)
        for attr in ['meleeDamage', 'distDamage', 'wandDamage']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
        voc_content = update_attr('formula', 'magDamage', '1.4', voc_content)
        voc_content = update_attr('formula', 'magHealingDamage', '1.5', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.1', voc_content)
            
    elif archetype == "Tank":
        voc_content = update_attr('vocation', 'gainhp', '450', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '150', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1000', voc_content)
        voc_content = update_attr('vocation', 'manamultiplier', '1.1', voc_content)
        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.2', voc_content)

    return voc_content

new_content = re.sub(r'<vocation[\s\S]+?</vocation>', replacer, content)

with open(r'c:\Users\thiag\Projetos\server-tibia\data\XML\vocations.xml', 'w', encoding='utf-8') as f:
    f.write(new_content)

# Now we must update vocation_ranks_config.lua 
lua_file = r'c:\Users\thiag\Projetos\server-tibia\data\lib\vocation_ranks_config.lua'
with open(lua_file, 'r', encoding='utf-8') as f:
    lua_content = f.read()

# Replace archetype in addVocation(id, "Archetype", ...) calls
for name, cls in class_map.items():
    # Find the vocation id by parsing the xml again or just look at the comment in lua
    pass

import re

# We will use the vocations.xml to get id -> name map to update lua
id_to_class = {}
for voc in re.finditer(r'<vocation[^>]+id="(\d+)"[^>]+name="([^"]+)"', new_content):
    vid = int(voc.group(1))
    name = voc.group(2)
    id_to_class[vid] = class_map.get(name, "DPS")

def lua_replacer(match):
    vid = int(match.group(1))
    archetype = id_to_class.get(vid)
    if not archetype:
        return match.group(0)
    # The Support in lua is Support, but in text is Suporte
    if archetype == "Suporte": archetype = "Support"
    return f'addVocation({vid}, "{archetype}"'

lua_content = re.sub(r'addVocation\((\d+),\s*"[^"]+"', lua_replacer, lua_content)

with open(lua_file, 'w', encoding='utf-8') as f:
    f.write(lua_content)

print("vocations.xml and vocation_ranks_config.lua updated")
