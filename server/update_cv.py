import re
import xml.etree.ElementTree as ET

tree = ET.parse(r'c:\Users\thiag\Projetos\server-tibia\data\XML\vocations.xml')
root = tree.getroot()
id_to_class = {}
id_to_univ = {}
for voc in root.findall('vocation'):
    vid = int(voc.get('id', '0'))
    if vid == 0: continue
    id_to_class[vid] = voc.get('type_class', 'DPS')
    id_to_univ[vid] = voc.get('type_universe', 'Dragon Ball')

cv_file = r'c:\Users\thiag\Projetos\server-tibia\data\lib\change_vocation.lua'
with open(cv_file, 'r', encoding='utf-8') as f:
    cv_content = f.read()

def cv_replacer(match):
    vid = int(match.group(1))
    cls = id_to_class.get(vid, "DPS")
    univ = id_to_univ.get(vid, "Dragon Ball")
    inner = match.group(2)
    inner = re.sub(r',\s*class\s*=\s*"[^"]+"', '', inner)
    inner = re.sub(r',\s*universe\s*=\s*"[^"]+"', '', inner)
    return f'[{vid}] = {inner}, class = "{cls}", universe = "{univ}" }}'

new_cv = re.sub(r'\[(\d+)\]\s*=\s*({[^}]+)}', cv_replacer, cv_content)
with open(cv_file, 'w', encoding='utf-8') as f:
    f.write(new_cv)
print("Updated change_vocation.lua")
