import os
import xml.etree.ElementTree as ET
import re
import math

MONSTER_DIR = r"C:\Users\thiag\Projetos\server-tibia\data\monster"
OUTPUT_FILE = r"C:\Users\thiag\Projetos\server-tibia\data\lib\tasks\task_config.lua"

DRAGONBALL_KEYWORDS = [
    "goku", "vegeta", "freeza", "frieza", "cell", "buu", "boo", "beerus", "bills",
    "jiren", "saibamen", "nappa", "raditz", "piccolo", "gohan", "trunks", "kuririn",
    "tenshinhan", "yamcha", "picolo", "kinto", "senzu", "dragon ball", "namek",
    "majin", "sayajin", "saiyan", "saiyajin", "oozaru", "bardock", "gogeta", "vegetto",
    "bojack", "dabura", "janemba", "ginyu", "zarbon", "dodoria", "cui", "guldo",
    "recoome", "burter", "jeice", "android", "cell jr", "spopovitch", "paikuhan",
    "king vegeta", "monster goku", "monster vegeta", "monster freeza",
    "turles", "slug", "cooler", "broly", "zeno", "whis", "supreme kai",
    "kibito", "babidi", "morning", "popo", "shenlong", "polunga",
    "gohan", "goten", "chichi", "bulma", "kame", "kaio", "zeni",
    "god of destruction", "dende", "porunga", "shenron",
    "c17", "c18", "c19", "c20", "cell", "boo", "buu",
    "dino hollow", "dino", "t-rex", "tyrannosaurus",
]

BLEACH_KEYWORDS = [
    "ichigo", "kurosaki", "hollow", "shinigami", "aizen", "byakuya", "renji",
    "rukia", "urahara", "sado", "chad", "ishida", "quincy", "arrancar", "espada",
    "yamamoto", "zaraki", "kenpachi", "hitsugaya", "toshiro", "gin", "ichimaru",
    "tosen", "komamura", "soifon", "yoruichi", "neliel", "ulquiorra", "grimmjow",
    "nnoitra", "szayelaporro", "zommari", "barragan", "stark", "halibel",
    "yhawch", "yhwach", "ywhach", "juha", "bach", "wandenreich", "soul society",
    "seireitei", "hueco mundo", "las noches", "zangetsu", "zanpakuto",
    "vizard", "vaizard", "shikai", "bankai", "kido", "cero", "bala",
    "menos", "gillian", "adjucha", "vasto lord", "fishbone", "grand fisher",
    "acid hollow", "spider hollow", "ghost hollow", "wolf hollow",
    "bandit hollow", "bone hollow", "ancient dinosaur hollow",
    "byakuya", "ikkaku", "yumichika", "matsumoto", "rangiku",
    "hisagi", "kensei", "rose", "love", "shinji", "hikifune",
    "kirio", "tenjiro", "ouetsu", "ichibei", "hyorinmaru",
    "senbonzakura", "zanpakuto", "reishi", "reiatsu",
    "gillian", "adjuchas", "vasto lorde", "cifer", "yammy",
    "luppi", "wonderweiss", "aaroniero", "kaien", "miyako",
    "ganju", "kuukaku", "kukaku", "isshin", "masaki", "karin", "yuzu",
    "kisuke", "yoruichi", "jinta", "ururu", "tessai",
    "squad", "gotei", "lieutenant", "fukutaicho",
    "akon", "hachigen", "hachi", "love", "rooster", "hirako",
]

def is_dragonball(name):
    nl = name.lower()
    for kw in DRAGONBALL_KEYWORDS:
        if kw in nl:
            return True
    return False

def is_bleach(name):
    nl = name.lower()
    for kw in BLEACH_KEYWORDS:
        if kw in nl:
            return True
    return False

def get_difficulty(level):
    if level < 50: return "easy"
    if level < 150: return "medium"
    if level < 400: return "hard"
    return "elite"

def calc_kills_required(difficulty):
    return { "easy": 300, "medium": 500, "hard": 750, "elite": 1000 }[difficulty]

def calc_points(difficulty):
    return { "easy": 15, "medium": 50, "hard": 150, "elite": 500 }[difficulty]

def calc_exp(experience, difficulty):
    multipliers = { "easy": 10, "medium": 5, "hard": 3, "elite": 2 }
    return max(experience * multipliers[difficulty], 100000)

def calc_money(difficulty):
    return { "easy": 50000, "medium": 150000, "hard": 500000, "elite": 2000000 }[difficulty]

def level_to_rank_required(level):
    if level < 50: return 0
    if level < 100: return 50
    if level < 200: return 200
    if level < 400: return 500
    if level < 600: return 1500
    return 5000

def make_safe_id(name):
    safe = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())
    safe = re.sub(r'_+', '_', safe).strip('_')
    if not safe: safe = "unknown"
    return safe

def monster_task_sort_key(entry):
    return (entry["level"], entry["name"])

def parse_int(val, default=0):
    try: return int(float(val))
    except: return default

def generate_monster_data():
    monsters = []
    for root_dir, dirs, files in os.walk(MONSTER_DIR):
        for fname in files:
            if not fname.endswith(".xml"): continue
            fpath = os.path.join(root_dir, fname)
            rel_path = os.path.relpath(fpath, MONSTER_DIR)
            try:
                tree = ET.parse(fpath)
                root = tree.getroot()
                mname = root.get("name", "")
                if not mname: continue
                look_type = 21
                look_el = root.find("look")
                if look_el is not None:
                    lt = look_el.get("type")
                    if lt: look_type = parse_int(lt, 21)
                exp = parse_int(root.get("experience", "0"))
                health_el = root.find("health")
                health = parse_int(health_el.get("max", "0")) if health_el is not None else 1
                level = max(1, health // 20)
                monstername = mname

                monsters.append({
                    "name": monstername,
                    "lookType": look_type,
                    "experience": exp,
                    "health": health,
                    "level": level,
                    "race": root.get("race", ""),
                    "original_file": rel_path
                })
            except Exception as e:
                print(f"Error parsing {fname}: {e}")

    return monsters

def generate_task_config(monsters, monster_dir):
    lines = []
    lines.append("-- Auto-generated task configuration from monster directory")
    lines.append("-- Generated on: " + __import__('datetime').datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    lines.append("")
    lines.append("")
    lines.append("TASKS = {")

    # Filter bosses subdirectory
    bosses = [m for m in monsters if m["original_file"].startswith("bosses" + os.sep)]
    regular = [m for m in monsters if m not in bosses]

    known_ids = set()

    def make_unique_id(base):
        tid = base
        n = 1
        while tid in known_ids:
            n += 1
            tid = base + "_" + str(n)
        known_ids.add(tid)
        return tid

    # Only include monsters that match DRAGONBALL_KEYWORDS or BLEACH_KEYWORDS
    dragonball_monsters = []
    bleach_monsters = []

    for monster in regular:
        mname = monster["name"]

        if is_dragonball(mname):
            dragonball_monsters.append(monster)
        elif is_bleach(mname):
            bleach_monsters.append(monster)

    dragonball_monsters.sort(key=lambda m: (m["level"], m["name"]))
    bleach_monsters.sort(key=lambda m: (m["level"], m["name"]))

    all_monsters_sorted = sorted(dragonball_monsters + bleach_monsters, key=lambda m: (m["level"], m["name"]))

    for monster in all_monsters_sorted:
        mname = monster["name"]
        safe = make_safe_id(mname)
        level = monster["level"]
        difficulty = get_difficulty(level)
        kills = calc_kills_required(difficulty)
        points = calc_points(difficulty)
        exp = calc_exp(monster["experience"], difficulty)
        money = calc_money(difficulty)
        rankReq = level_to_rank_required(level)

        category = "dragonball"
        if is_bleach(mname):
            category = "bleach"

        task_id = make_unique_id("task_" + safe)
        lines.append(f"    -- {mname} (Level {level}, {difficulty})")
        lines.append(f"    {task_id} = {{")
        lines.append(f'        id = "{task_id}",')
        lines.append(f'        name = "Hunt: {mname}",')
        lines.append(f"        lookType = {monster['lookType']},")
        lines.append(f'        category = "{category}",')
        lines.append(f'        type = "kill",')
        lines.append(f'        difficulty = "{difficulty}",')
        lines.append(f"        levelRequired = {max(10, level - 10)},")
        lines.append(f"        rankRequired = {rankReq},")
        lines.append(f"        monsters = {{ {{ name = \"{mname}\", kills = {kills} }} }},")
        lines.append(f"        killsRequired = {kills},")
        lines.append(f"        points = {points},")
        lines.append(f"        experience = {exp},")
        lines.append(f"        money = {money},")
        lines.append(f"        rewards = {{ items = {{ {{ 2160, {max(10, money // 1000)} }} }} }},")
        lines.append(f"        delivery = {{ enabled = false }},")
        lines.append(f"        monsterDetails = {{")
        lines.append(f"            {{ name = \"{mname}\", level = {level}, size = \"Medium\", location = \"Unknown\", probability = 50 }}")
        lines.append(f"        }}")
        lines.append(f"    }},")
        lines.append("")

    # Boss tasks (only those matching keywords)
    lines.append("    -- ============================================================")
    lines.append("    -- BOSS TASKS")
    lines.append("    -- ============================================================")
    for monster in bosses:
        mname = monster["name"]

        boss_category = None
        if is_dragonball(mname):
            boss_category = "dragonball"
        elif is_bleach(mname):
            boss_category = "bleach"

        if boss_category is None:
            continue

        safe = make_safe_id(mname)
        level = monster["level"]
        difficulty = get_difficulty(level)
        kills = 10
        points = calc_points(difficulty) * 3
        exp = calc_exp(monster["experience"], difficulty) * 2
        money = calc_money(difficulty) * 2

        task_id = make_unique_id("boss_" + safe)
        lines.append(f"    -- {mname} (Level {level}, {difficulty})")
        lines.append(f"    {task_id} = {{")
        lines.append(f'        id = "{task_id}",')
        lines.append(f'        name = "Boss: {mname}",')
        lines.append(f"        lookType = {monster['lookType']},")
        lines.append(f'        category = "{boss_category}",')
        lines.append(f'        type = "boss",')
        lines.append(f'        difficulty = "{difficulty}",')
        lines.append(f"        levelRequired = {max(10, level - 10)},")
        lines.append(f"        rankRequired = {level_to_rank_required(level)},")
        lines.append(f"        monsters = {{ {{ name = \"{mname}\", kills = {kills} }} }},")
        lines.append(f"        killsRequired = {kills},")
        lines.append(f"        points = {points},")
        lines.append(f"        experience = {exp},")
        lines.append(f"        money = {money},")
        lines.append(f"        rewards = {{ items = {{ {{ 2160, {max(10, money // 1000)} }} }} }},")
        lines.append(f"        delivery = {{ enabled = false }},")
        lines.append(f"        monsterDetails = {{")
        lines.append(f"            {{ name = \"{mname}\", level = {level}, size = \"Boss\", location = \"Dungeon\", probability = 10 }}")
        lines.append(f"        }}")
        lines.append(f"    }},")
        lines.append("")

    lines.append("}")
    lines.append("")
    lines.append('TASK_DIFFICULTY_ORDER = { "easy", "medium", "hard", "elite" }')
    lines.append("")
    lines.append('TASK_CATEGORIES = { "dragonball", "bleach" }')

    return "\n".join(lines)

def main():
    print("Parsing monster directory...")
    monsters = generate_monster_data()
    print(f"Found {len(monsters)} monsters")

    print("Generating task configuration...")
    config = generate_task_config(monsters, MONSTER_DIR)

    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(config)

    print("Done!")

if __name__ == "__main__":
    main()
