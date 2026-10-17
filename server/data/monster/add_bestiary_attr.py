#!/usr/bin/env python3
"""
Adiciona o atributo bestiary="monster" ou bestiary="boss" em todos os
arquivos XML de monstros, baseado no diretório onde o XML está.

Monstros na pasta "bosses/" recebem bestiary="boss".
Demais recebem bestiary="monster".
"""

import os
import re
import xml.etree.ElementTree as ET

MONSTER_DIR = os.path.dirname(os.path.abspath(__file__))
REGISTRY_FILE = os.path.join(MONSTER_DIR, "monsters.xml")

BESTIARY_BOSS_DIRS = {"bosses"}

def normalize_path(path):
    return path.replace("\\", "/").lower()

def should_be_boss(filepath):
    normalized = normalize_path(filepath)
    parts = normalized.split("/")
    return any(d in parts for d in BESTIARY_BOSS_DIRS)

def add_bestiary_to_xml(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"  [ERRO] Nao foi possivel ler {filepath}: {e}")
        return False

    original_content = content

    has_bestiary = re.search(r'\bbestiary\s*=', content, re.IGNORECASE)
    if has_bestiary:
        # Ja tem o atributo, verificar se eh valido
        match = re.search(r'<monster\s+[^>]*?bestiary\s*=\s*["\']([^"\']+)["\']', content, re.IGNORECASE)
        if match and match.group(1).lower() in ("monster", "boss"):
            return True
        # Substituir valor invalido
        content = re.sub(
            r'(<monster\s+[^>]*?)bestiary\s*=\s*["\'][^"\']*["\']',
            r'\1',
            content,
            count=1,
            flags=re.IGNORECASE
        )

    category = "boss" if should_be_boss(filepath) else "monster"

    # Inserir bestiary depois do atributo name
    content = re.sub(
        r'(<monster\s+)(name\s*=\s*["\'][^"\']*["\'])',
        lambda m: m.group(1) + m.group(2) + f' bestiary="{category}"',
        content,
        count=1,
    )

    if content == original_content:
        # Tentar inserir de outra forma (monster tag sem name ainda?)
        if "<monster" in content and ">" in content:
            content = content.replace("<monster", f'<monster bestiary="{category}"', 1)
        else:
            print(f"  [AVISO] Nao foi possivel modificar {filepath}")
            return False

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    return True

def main():
    print(f"Lendo registro de monstros: {REGISTRY_FILE}")
    
    try:
        tree = ET.parse(REGISTRY_FILE)
        root = tree.getroot()
    except Exception as e:
        print(f"Erro ao ler {REGISTRY_FILE}: {e}")
        return

    monster_entries = root.findall("monster")
    print(f"Encontrados {len(monster_entries)} monstros no registro.")

    success = 0
    failed = 0
    skipped = 0

    for entry in monster_entries:
        name = entry.get("name", "???")
        file_rel = entry.get("file", "")
        filepath = os.path.normpath(os.path.join(MONSTER_DIR, file_rel))

        if not os.path.isfile(filepath):
            print(f"  [SKIP] Arquivo nao encontrado: {filepath} ({name})")
            skipped += 1
            continue

        if add_bestiary_to_xml(filepath):
            success += 1
        else:
            failed += 1

    print(f"\nConcluido! {success} OK, {failed} falhas, {skipped} skipped")

if __name__ == "__main__":
    main()
