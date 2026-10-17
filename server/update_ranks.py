import re

def main():
    file_path = r'c:\Users\thiag\Projetos\server-tibia\data\lib\vocation_ranks_config.lua'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Update Archetypes
    content = re.sub(
        r'VocationRankConfig\.Archetypes = \{.*?\}',
        '''VocationRankConfig.Archetypes = {
  ["DPS"] = { damageMult = 2.5, defenseMult = 1.0 },
  ["Bruiser"] = { damageMult = 2.0, defenseMult = 1.05 },
  ["Support"] = { damageMult = 1.0, defenseMult = 1.10, manaRegenBuff = 15000 },
  ["Tank"] = { damageMult = 1.0, defenseMult = 1.20, hpRegenBuff = 15000 }
}''',
        content,
        flags=re.DOTALL
    )

    # Standardize stats per archetype
    stats_templates = {
        '"DPS"': '{ attack = 15, defense = 4, health = 200, mana = 200, magic = 5, distance = 15, shield = 3 }',
        '"Bruiser"': '{ attack = 12, defense = 6, health = 150, mana = 150, magic = 3, distance = 12, shield = 5 }',
        '"Tank"': '{ attack = 13, defense = 10, health = 300, mana = 50, magic = 2, distance = 13, shield = 8 }',
        '"Support"': '{ attack = 5, defense = 8, health = 50, mana = 300, magic = 10, distance = 5, shield = 6 }',
        '"Suporte"': '{ attack = 5, defense = 8, health = 50, mana = 300, magic = 10, distance = 5, shield = 6 }' # just in case
    }
    
    # We want to replace lines like:
    # addVocation(1, "DPS", 4, 49856, { attack = 9, defense = 4, health = 180, mana = 90, magic = 0, distance = 0, shield = 3 },
    #   { [1] = 50, [2] = 75, [3] = 100, [4] = 200 })
    # with standardized versions.
    
    # Let's find all addVocation calls
    def replace_voc(match):
        voc_id = match.group(1)
        archetype = match.group(2)
        specific_id = match.group(3)
        
        # fix the name "Suporte" to "Support" if it happens to be there
        arch_mapped = archetype
        if arch_mapped == '"Suporte"':
            arch_mapped = '"Support"'
            
        stats = stats_templates.get(arch_mapped, stats_templates['"DPS"'])
        
        # Output standardized
        return f'addVocation({voc_id}, {arch_mapped}, 4, {specific_id},\n  {stats},\n  {{ [1] = 50, [2] = 75, [3] = 100, [4] = 200 }})'

    # The regex looks for addVocation(id, "Archetype", maxRank, item_id, { ... }, { ... })
    # It might span multiple lines.
    pattern = r'addVocation\(\s*(\d+)\s*,\s*("[^"]+")\s*,\s*\d+\s*,\s*(\d+)\s*,.*?\)'
    
    content = re.sub(pattern, replace_voc, content, flags=re.DOTALL)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Updated vocation_ranks_config.lua")

if __name__ == '__main__':
    main()
