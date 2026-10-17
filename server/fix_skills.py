import re

def main():
    file_path = r'c:\Users\thiag\Projetos\server-tibia\data\lib\vocation_ranks_config.lua'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We replace the entire stats dictionary based on the class logic.
    # To do this safely, we match the class from the line above or within the addVocation call.
    
    # Let's match addVocation calls
    def replace_voc(match):
        voc_id = match.group(1)
        archetype = match.group(2)
        specific_id = match.group(3)
        
        # New base values with HP/Mana kept high (*10) but SKILLS reduced strictly between 1 and 10 per star.
        if archetype == '"DPS"':
            stats = '{ attack = 8, defense = 2, health = 2000, mana = 2000, magic = 3, distance = 8, shield = 2 }'
        elif archetype == '"Bruiser"':
            stats = '{ attack = 6, defense = 4, health = 1500, mana = 1500, magic = 2, distance = 6, shield = 4 }'
        elif archetype == '"Tank"':
            stats = '{ attack = 4, defense = 8, health = 3000, mana = 500, magic = 1, distance = 4, shield = 8 }'
        elif archetype == '"Support"' or archetype == '"Suporte"':
            stats = '{ attack = 2, defense = 6, health = 500, mana = 3000, magic = 8, distance = 2, shield = 6 }'
        else:
            stats = '{ attack = 8, defense = 2, health = 2000, mana = 2000, magic = 3, distance = 8, shield = 2 }'
        
        return f'addVocation({voc_id}, {archetype}, 4, {specific_id},\n  {stats},\n  {{ [1] = 50, [2] = 75, [3] = 100, [4] = 200 }})'

    pattern = r'addVocation\(\s*(\d+)\s*,\s*("[^"]+")\s*,\s*\d+\s*,\s*(\d+)\s*,.*?\)'
    
    content = re.sub(pattern, replace_voc, content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Fixed stats logic in vocation_ranks_config.lua")

if __name__ == '__main__':
    main()
