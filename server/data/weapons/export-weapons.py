import os
import xml.etree.ElementTree as ET

# Diretórios e arquivos
scripts_dir = r'data\weapons\scripts'
items_xml = r'data\items\items.xml'
xml_output = r'data\weapons\newweapons.xml'

# Carrega os itens em um dicionário {name: id}
items_tree = ET.parse(items_xml)
items_root = items_tree.getroot()
item_map = {}
for item in items_root.findall('.//item'):
    name = item.get('name')
    itemid = item.get('id')
    if name and itemid:
        item_map[name.lower()] = itemid

def extract_item_name(filename):
    name = os.path.splitext(os.path.basename(filename))[0]
    return name.replace('_', ' ').lower()

# Criação do elemento root
root = ET.Element('weapons')

for foldername, subfolders, filenames in os.walk(scripts_dir):
    rel_folder = os.path.relpath(foldername, scripts_dir)
    for filename in filenames:
        if filename.endswith('.lua'):
            # Monta o value (pasta + arquivo)
            if rel_folder == '.':
                value_str = filename
            else:
                value_str = f"{rel_folder}\\{filename}"
            # Extrai o nome
            item_name = extract_item_name(filename)
            # Tenta encontrar o id correspondente
            wand_id = item_map.get(item_name, "")
            wand = ET.Element('wand', id=wand_id, event="script", value=value_str)
            root.append(wand)

# Salva XML
tree = ET.ElementTree(root)
tree.write(xml_output, encoding='utf-8', xml_declaration=True)


# import os
# import xml.etree.ElementTree as ET

# # Diretórios
# scripts_dir = r'data\weapons\scripts'
# xml_output = r'data\weapons\newweapons.xml'

# # Criação do elemento root
# root = ET.Element('weapons')

# # Itera sobre todas as pastas/arquivos
# for foldername, subfolders, filenames in os.walk(scripts_dir):
#     # Obtém apenas o caminho relativo à pasta scripts
#     rel_folder = os.path.relpath(foldername, scripts_dir)
#     for filename in filenames:
#         if filename.endswith('.lua'):
#             # Monta o caminho relativo para value (pasta + arquivo)
#             if rel_folder == '.':
#                 value_str = filename
#             else:
#                 value_str = f"{rel_folder}\\{filename}"
#             wand = ET.Element('wand', id="", event="script", value=value_str)
#             root.append(wand)

# # Escreve o XML
# tree = ET.ElementTree(root)
# tree.write(xml_output, encoding='utf-8', xml_declaration=True)
