import re

def main():
    file_path = r'c:\Users\thiag\Projetos\server-tibia\data\lib\vocation_ranks_config.lua'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to find the stats dictionary and multiply all its numeric values by 10
    # Example: { attack = 15, defense = 4, health = 200, mana = 200, magic = 5, distance = 15, shield = 3 }
    
    def multiply(match):
        stats_str = match.group(0)
        # Find all key = number pairs
        def multiply_num(num_match):
            key = num_match.group(1)
            val = int(num_match.group(2))
            return f"{key}= {val * 10}"
        
        new_stats_str = re.sub(r'([a-zA-Z]+)\s*=\s*(\d+)', multiply_num, stats_str)
        return new_stats_str

    # Search for exactly { attack = ..., defense = ..., health = ..., mana = ..., magic = ..., distance = ..., shield = ... }
    # Let's match the inner `{ attack = \d+, ... }`
    pattern = r'\{\s*attack\s*=\s*\d+.*?, shield\s*=\s*\d+\s*\}'
    
    content = re.sub(pattern, multiply, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Updated stats in vocation_ranks_config.lua by multiplying by 10.")

if __name__ == '__main__':
    main()
