import os
import re

with open("C:/Users/thiag/Projetos/server-tibia/data/spells/spells.xml", "r", encoding="utf-8") as f:
    content = f.read()

# remove comments
content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL)

i = 0
count_spells = 0
count_vocations_total = 0
count_no_vocations = 0

while True:
    s = content.find("<instant", i)
    if s == -1: break
    e = s + 7  # index of 't'
    
    attrEnd = content.find(">", e)
    if attrEnd == -1: break
    
    attributes = content[e+1:attrEnd]
    isSelfClosing = attributes.strip().endswith("/")
    
    body = ""
    if isSelfClosing:
        i = attrEnd + 1
    else:
        bodyEndStart = re.search(r"</\s*instant\s*>", content[attrEnd:])
        if bodyEndStart:
            body = content[attrEnd+1 : attrEnd + bodyEndStart.start()]
            i = attrEnd + bodyEndStart.end()
        else:
            break

    spellName = re.search(r'name="(.*?)"', attributes)
    
    vocations = re.findall(r'<vocation\s+id="(.*?)"', body)
    
    count_spells += 1
    count_vocations_total += len(vocations)
    if len(vocations) == 0:
        count_no_vocations += 1

print(f"Spells: {count_spells}, Vocations extracted: {count_vocations_total}, Spells with NO vocations: {count_no_vocations}")
