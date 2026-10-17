import os

# Define o próprio diretório onde o script está localizado como padrão
current_dir = os.path.dirname(os.path.abspath(__file__))
directory_in = current_dir
directory_out = current_dir
xml_tags = '<?xml version="1.0" encoding="UTF-8"?>\n<monsters>\n'

# List to store file information
file_list = []

# Walk through directory and subdirectories
for root, _, files in os.walk(directory_in):
    for filename in files:
        # Skip monsters.xml
        if filename.lower() == 'monsters.xml':
            continue
        # Check for .xml files
        if filename.lower().endswith('.xml'):
            # Get relative path from directory_in
            relative_path = os.path.relpath(os.path.join(root, filename), directory_in)
            # Replace backslashes with forward slashes for XML
            relative_path = relative_path.replace('\\', '/')
            # Get name without extension and capitalize
            name = os.path.splitext(filename)[0].capitalize()
            file_list.append((name, relative_path))

# Sort files by name
file_list.sort(key=lambda x: x[0])

# Generate XML tags
for name, file_path in file_list:
    xml_tags += f'  <monster name="{name}" file="{file_path}"/>\n'

xml_tags += '</monsters>'

# Write to output file
with open(os.path.join(directory_out, 'monsters.xml'), 'w', encoding='utf-8') as f:
    f.write(xml_tags)

print('Monsters.xml gerado com sucesso em', directory_out)
