import re

with open(r'c:\Users\thiag\Projetos\server-tibia\data\XML\vocations.xml', 'r', encoding='utf-8') as f:
    content = f.read()

DPS = {1, 2, 4, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 28, 31, 37, 40, 41, 42, 44, 45, 50, 52, 53, 64, 66, 67}
BRUISER = {6, 16, 20, 30, 32, 34, 35, 38, 48, 49, 56, 58, 60, 62}
SUPPORT = {5, 13, 22, 23, 24, 27, 29, 33, 36, 39, 43, 47, 51, 54, 55, 57, 59, 61, 63, 65}
TANK = {3, 7, 25, 26}

def replacer(match):
    voc_content = match.group(0)
    id_match = re.search(r'id="(\d+)"', voc_content)
    if not id_match:
        return voc_content
    
    vid = int(id_match.group(1))
    if vid == 0:
        return voc_content
    
    if vid in DPS: archetype = "DPS"
    elif vid in BRUISER: archetype = "Bruiser"
    elif vid in SUPPORT: archetype = "Suporte"
    elif vid in TANK: archetype = "Tank"
    else: return voc_content

    # Insert type_class before the closing > of the starting tag
    # Using re.DOTALL is not needed because we only match inside <vocation ...>
    if 'type_class=' not in voc_content:
        # We need to find the first >
        first_gt_idx = voc_content.find('>')
        if voc_content[first_gt_idx-1] == '/':
            voc_content = voc_content[:first_gt_idx-1] + f' type_class="{archetype}" ' + voc_content[first_gt_idx-1:]
        else:
            voc_content = voc_content[:first_gt_idx] + f' type_class="{archetype}"' + voc_content[first_gt_idx:]
    else:
        voc_content = re.sub(r'type_class="[^"]+"', f'type_class="{archetype}"', voc_content)

    def update_attr(tag, attr, value, text):
        # Find tag block: <tag ... /> or <tag ... > ... </tag>
        # Just find the first occurrence of attribute in the tag
        return re.sub(rf'(<{tag}[^>]*?{attr}=")[^"]+(")', rf'\g<1>{value}\g<2>', text)
    
    if archetype == "DPS":
        voc_content = update_attr('vocation', 'gainhp', '20', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '30', voc_content)
        voc_content = update_attr('vocation', 'gainhpticks', '4', voc_content)
        voc_content = update_attr('vocation', 'gainhpamount', '10', voc_content)
        voc_content = update_attr('vocation', 'gainmanaticks', '3', voc_content)
        voc_content = update_attr('vocation', 'gainmanaamount', '15', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '900', voc_content)
        voc_content = update_attr('vocation', 'soulmax', '1500', voc_content)
        voc_content = update_attr('vocation', 'gainsoulticks', '60', voc_content)

        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.7', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
        
        for attr in ['fist', 'club', 'sword', 'axe', 'distance']:
            voc_content = update_attr('skill', attr, '1.7', voc_content)
        voc_content = update_attr('skill', 'shielding', '1.0', voc_content)

    elif archetype == "Bruiser":
        voc_content = update_attr('vocation', 'gainhp', '30', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '20', voc_content)
        voc_content = update_attr('vocation', 'gainhpticks', '3', voc_content)
        voc_content = update_attr('vocation', 'gainhpamount', '15', voc_content)
        voc_content = update_attr('vocation', 'gainmanaticks', '4', voc_content)
        voc_content = update_attr('vocation', 'gainmanaamount', '10', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1000', voc_content)
        voc_content = update_attr('vocation', 'soulmax', '1500', voc_content)
        voc_content = update_attr('vocation', 'gainsoulticks', '60', voc_content)

        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.6', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.05', voc_content)
        
        for attr in ['fist', 'club', 'sword', 'axe', 'distance']:
            voc_content = update_attr('skill', attr, '1.6', voc_content)
        voc_content = update_attr('skill', 'shielding', '1.05', voc_content)

    elif archetype == "Suporte":
        voc_content = update_attr('vocation', 'gainhp', '15', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '45', voc_content)
        voc_content = update_attr('vocation', 'gainhpticks', '4', voc_content)
        voc_content = update_attr('vocation', 'gainhpamount', '10', voc_content)
        voc_content = update_attr('vocation', 'gainmanaticks', '2', voc_content)
        voc_content = update_attr('vocation', 'gainmanaamount', '25', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1100', voc_content)
        voc_content = update_attr('vocation', 'soulmax', '2000', voc_content)
        voc_content = update_attr('vocation', 'gainsoulticks', '60', voc_content)

        for attr in ['meleeDamage', 'distDamage', 'wandDamage']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
        voc_content = update_attr('formula', 'magDamage', '1.2', voc_content)
        voc_content = update_attr('formula', 'magHealingDamage', '1.5', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.1', voc_content)
        
        for attr in ['fist', 'club', 'sword', 'axe', 'distance']:
            voc_content = update_attr('skill', attr, '1.0', voc_content)
        voc_content = update_attr('skill', 'shielding', '1.1', voc_content)

    elif archetype == "Tank":
        voc_content = update_attr('vocation', 'gainhp', '45', voc_content)
        voc_content = update_attr('vocation', 'gainmana', '15', voc_content)
        voc_content = update_attr('vocation', 'gainhpticks', '2', voc_content)
        voc_content = update_attr('vocation', 'gainhpamount', '25', voc_content)
        voc_content = update_attr('vocation', 'gainmanaticks', '4', voc_content)
        voc_content = update_attr('vocation', 'gainmanaamount', '10', voc_content)
        voc_content = update_attr('vocation', 'attackspeed', '1200', voc_content)
        voc_content = update_attr('vocation', 'soulmax', '1500', voc_content)
        voc_content = update_attr('vocation', 'gainsoulticks', '60', voc_content)

        for attr in ['meleeDamage', 'distDamage', 'wandDamage', 'magDamage', 'magHealingDamage']:
            voc_content = update_attr('formula', attr, '1.0', voc_content)
        for attr in ['defense', 'magDefense', 'armor']:
            voc_content = update_attr('formula', attr, '1.2', voc_content)
        
        for attr in ['fist', 'club', 'sword', 'axe', 'distance']:
            voc_content = update_attr('skill', attr, '1.0', voc_content)
        voc_content = update_attr('skill', 'shielding', '1.2', voc_content)
        
    return voc_content

new_content = re.sub(r'<vocation[\s\S]+?</vocation>', replacer, content)

with open(r'c:\Users\thiag\Projetos\server-tibia\data\XML\vocations.xml', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Vocations updated!")
